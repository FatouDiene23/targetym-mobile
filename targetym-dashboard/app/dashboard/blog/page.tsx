'use client';
import { getToken } from '@/lib/api';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  PenLine, Plus, Search, Eye, Pencil, Trash2, Loader2,
  Tag, Calendar, Clock, ChevronLeft, ChevronUp, ChevronDown,
  X, BookOpen, Globe, FileText, Upload, Link, Settings2,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

// ============================================
// CONFIG
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
    const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ============================================
// TYPES
// ============================================

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  cover_image_url?: string;
  category?: string;
  tags?: string;
  status: 'draft' | 'published';
  author_name?: string;
  published_at?: string;
  views_count: number;
  created_at?: string;
  updated_at?: string;
}

interface BlogPostForm {
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category: string;
  tags: string;
  status: 'draft' | 'published';
}

interface BlogCategory {
  id: number;
  name: string;
  color?: string;
  display_order: number;
  is_published: boolean;
  post_count: number;
}

interface UserInfo {
  id: number;
  role: string;
}

const EDITOR_ROLES = ['superadmintech', 'super_admin', 'superadmin', 'platform_admin'];
const ADMIN_ROLES  = ['superadmintech', 'super_admin', 'superadmin', 'platform_admin'];

const EMPTY_FORM: BlogPostForm = {
  title: '',
  excerpt: '',
  content: '',
  cover_image_url: '',
  category: '',
  tags: '',
  status: 'published',
};

// ============================================
// HELPERS
// ============================================

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Préfixe l'URL avec API_URL si c'est un chemin relatif (upload backend) */
function mediaUrl(url?: string): string {
  if (!url) return '';
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

/** Convertit le markdown en HTML pour la prévisualisation */
function parseMarkdown(text: string): string {
  function inline(s: string): string {
    return s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-600 underline">$1</a>');
  }
  const blocks = text.split(/\n\n+/);
  return blocks.map(block => {
    const t = block.trim();
    if (!t) return '';
    if (/^---+$/.test(t)) return '<hr class="border-gray-200 my-4" />';
    if (t.startsWith('#### ')) return `<h4 class="text-sm font-bold text-gray-800 mt-5 mb-1">${inline(t.slice(5))}</h4>`;
    if (t.startsWith('### '))  return `<h3 class="text-base font-bold text-gray-800 mt-6 mb-1">${inline(t.slice(4))}</h3>`;
    if (t.startsWith('## '))   return `<h2 class="text-lg font-bold text-gray-900 mt-7 mb-2">${inline(t.slice(3))}</h2>`;
    if (t.startsWith('# '))    return `<h2 class="text-xl font-bold text-gray-900 mt-7 mb-2">${inline(t.slice(2))}</h2>`;
    if (t.startsWith('> '))    return `<blockquote class="border-l-4 border-yellow-300 bg-yellow-50 pl-4 pr-3 py-2 italic text-gray-600 rounded-r-lg my-3">${inline(t.slice(2))}</blockquote>`;
    if (t.split('\n').every(l => /^[-*]\s/.test(l))) {
      const items = t.split('\n').map(l => `<li>${inline(l.slice(2))}</li>`).join('');
      return `<ul class="list-disc pl-5 space-y-1 my-3 text-gray-700">${items}</ul>`;
    }
    if (t.split('\n').every(l => /^\d+\.\s/.test(l))) {
      const items = t.split('\n').map(l => `<li>${inline(l.replace(/^\d+\.\s/, ''))}</li>`).join('');
      return `<ol class="list-decimal pl-5 space-y-1 my-3 text-gray-700">${items}</ol>`;
    }
    return `<p class="text-gray-700 leading-relaxed my-3">${t.split('\n').map(inline).join('<br />')}</p>`;
  }).filter(Boolean).join('\n');
}

// ============================================
// ÉDITEUR EN BLOCS
// ============================================

type BlockType = 'p' | 'h2' | 'h3' | 'h4' | 'ul' | 'ol' | 'blockquote' | 'hr' | 'code';

interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
}

const BLOCK_TYPES: { type: BlockType; label: string; prefix: string; color: string }[] = [
  { type: 'p',          label: 'Paragraphe',     prefix: 'P',    color: 'bg-gray-100 text-gray-600' },
  { type: 'h2',         label: 'Titre',          prefix: 'H2',   color: 'bg-blue-100 text-blue-700' },
  { type: 'h3',         label: 'Sous-titre',     prefix: 'H3',   color: 'bg-indigo-100 text-indigo-700' },
  { type: 'h4',         label: 'Petit titre',    prefix: 'H4',   color: 'bg-purple-100 text-purple-700' },
  { type: 'ul',         label: 'Liste à puces',  prefix: '•',    color: 'bg-green-100 text-green-700' },
  { type: 'ol',         label: 'Liste numérotée',prefix: '1.',   color: 'bg-teal-100 text-teal-700' },
  { type: 'blockquote', label: 'Citation',       prefix: '❝',    color: 'bg-yellow-100 text-yellow-700' },
  { type: 'hr',         label: 'Séparateur',     prefix: '—',    color: 'bg-gray-100 text-gray-400' },
  { type: 'code',       label: 'Code',           prefix: '</>',  color: 'bg-orange-100 text-orange-700' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'h2':         return `## ${b.content}`;
      case 'h3':         return `### ${b.content}`;
      case 'h4':         return `#### ${b.content}`;
      case 'blockquote': return `> ${b.content}`;
      case 'hr':         return `---`;
      case 'ul':         return b.content.split('\n').filter(l => l.trim()).map(l => `- ${l.trim()}`).join('\n');
      case 'ol':         return b.content.split('\n').filter(l => l.trim()).map((l, i) => `${i + 1}. ${l.trim()}`).join('\n');
      case 'code':       return `\`${b.content}\``;
      default:           return b.content;
    }
  }).filter(Boolean).join('\n\n');
}

function markdownToBlocks(md: string): ContentBlock[] {
  if (!md.trim()) return [{ id: uid(), type: 'p', content: '' }];
  return md.split(/\n\n+/).map(block => {
    const t = block.trim();
    if (!t) return null;
    const id = uid();
    if (/^---+$/.test(t)) return { id, type: 'hr' as BlockType, content: '' };
    if (t.startsWith('#### ')) return { id, type: 'h4' as BlockType, content: t.slice(5) };
    if (t.startsWith('### '))  return { id, type: 'h3' as BlockType, content: t.slice(4) };
    if (t.startsWith('## '))   return { id, type: 'h2' as BlockType, content: t.slice(3) };
    if (t.startsWith('# '))    return { id, type: 'h2' as BlockType, content: t.slice(2) };
    if (t.startsWith('> '))    return { id, type: 'blockquote' as BlockType, content: t.slice(2) };
    if (t.split('\n').every(l => /^[-*]\s/.test(l)))
      return { id, type: 'ul' as BlockType, content: t.split('\n').map(l => l.replace(/^[-*]\s/, '')).join('\n') };
    if (t.split('\n').every(l => /^\d+\.\s/.test(l)))
      return { id, type: 'ol' as BlockType, content: t.split('\n').map(l => l.replace(/^\d+\.\s/, '')).join('\n') };
    if (t.startsWith('`') && t.endsWith('`'))
      return { id, type: 'code' as BlockType, content: t.slice(1, -1) };
    return { id, type: 'p' as BlockType, content: t };
  }).filter(Boolean) as ContentBlock[];
}

function getPlaceholder(type: BlockType): string {
  switch (type) {
    case 'h2': return 'Titre de section…';
    case 'h3': return 'Sous-titre…';
    case 'h4': return 'Petit titre…';
    case 'ul': return 'Un élément par ligne\nDeuxième élément\nTroisième élément';
    case 'ol': return 'Premier élément\nDeuxième élément\nTroisième élément';
    case 'blockquote': return 'Texte de la citation…';
    case 'code': return 'Code…';
    default: return 'Rédigez votre paragraphe…';
  }
}

function BlockEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => markdownToBlocks(value));
  const [showAddMenu, setShowAddMenu] = useState(false);

  function update(newBlocks: ContentBlock[]) {
    setBlocks(newBlocks);
    onChange(blocksToMarkdown(newBlocks));
  }
  function addBlock(type: BlockType) {
    update([...blocks, { id: uid(), type, content: '' }]);
    setShowAddMenu(false);
  }
  function updateBlock(id: string, changes: Partial<ContentBlock>) {
    update(blocks.map(b => b.id === id ? { ...b, ...changes } : b));
  }
  function removeBlock(id: string) {
    if (blocks.length === 1) { update([{ id: uid(), type: 'p', content: '' }]); return; }
    update(blocks.filter(b => b.id !== id));
  }
  function moveBlock(id: string, dir: 'up' | 'down') {
    const idx = blocks.findIndex(b => b.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === blocks.length - 1) return;
    const nb = [...blocks];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [nb[idx], nb[swap]] = [nb[swap], nb[idx]];
    update(nb);
  }

  return (
    <div className="space-y-1.5">
      {blocks.map((block, idx) => (
        <BlockRow
          key={block.id}
          block={block}
          isFirst={idx === 0}
          isLast={idx === blocks.length - 1}
          onChange={c => updateBlock(block.id, c)}
          onRemove={() => removeBlock(block.id)}
          onMoveUp={() => moveBlock(block.id, 'up')}
          onMoveDown={() => moveBlock(block.id, 'down')}
        />
      ))}

      <div className="pt-1">
        {showAddMenu ? (
          <div className="grid grid-cols-3 gap-1 p-3 bg-gray-50 rounded-xl border border-gray-200">
            {BLOCK_TYPES.map(bt => (
              <button key={bt.type} type="button" onClick={() => addBlock(bt.type)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all text-left">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bt.color} min-w-[28px] text-center leading-tight`}>{bt.prefix}</span>
                <span className="text-xs text-gray-600">{bt.label}</span>
              </button>
            ))}
            <button type="button" onClick={() => setShowAddMenu(false)}
              className="col-span-3 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all">
              <X className="w-3 h-3" /> Fermer
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAddMenu(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> Ajouter un bloc
          </button>
        )}
      </div>
    </div>
  );
}

function BlockRow({
  block, isFirst, isLast, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  block: ContentBlock; isFirst: boolean; isLast: boolean;
  onChange: (c: Partial<ContentBlock>) => void;
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const info = BLOCK_TYPES.find(b => b.type === block.type) ?? BLOCK_TYPES[0];
  return (
    <div className="flex gap-2 group items-start">
      <span className={`mt-1 flex-none text-[10px] font-bold px-1.5 py-0.5 rounded ${info.color} min-w-[28px] text-center leading-tight`}>
        {info.prefix}
      </span>
      <div className="flex-1 min-w-0">
        <select value={block.type}
          onChange={e => onChange({ type: e.target.value as BlockType })}
          className="text-[10px] text-gray-400 bg-transparent border-none outline-none cursor-pointer hover:text-gray-600 mb-0.5 py-0">
          {BLOCK_TYPES.map(bt => <option key={bt.type} value={bt.type}>{bt.label}</option>)}
        </select>
        {block.type === 'hr' ? (
          <div className="w-full border-t-2 border-dashed border-gray-300 my-2" />
        ) : (
          <textarea value={block.content}
            onChange={e => onChange({ content: e.target.value })}
            placeholder={getPlaceholder(block.type)}
            rows={block.type === 'p' ? 3 : block.type === 'ul' || block.type === 'ol' ? 3 : 1}
            className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-primary-300 outline-none
              ${block.type === 'h2' ? 'text-base font-bold' : ''}
              ${block.type === 'h3' ? 'text-sm font-semibold' : ''}
              ${block.type === 'code' ? 'font-mono text-xs bg-gray-50' : ''}
              ${block.type === 'blockquote' ? 'italic border-l-4 border-yellow-300 bg-yellow-50/30' : ''}
            `}
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-none">
        <button type="button" onClick={onMoveUp} disabled={isFirst}
          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronUp className="w-3 h-3 text-gray-400" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={isLast}
          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
        <button type="button" onClick={onRemove}
          className="p-0.5 hover:bg-red-50 rounded">
          <Trash2 className="w-3 h-3 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT MODAL ÉDITEUR DE POST
// ============================================

// ============================================
// MODAL GESTION DES CATÉGORIES
// ============================================

function BlogCategoryManagerModal({
  categories,
  isAdmin,
  onClose,
  onChanged,
}: {
  categories: BlogCategory[];
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [list, setList] = useState<BlogCategory[]>(categories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmCat, setConfirmCat] = useState<{ id: number; name: string } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/blog/blog-categories`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName.trim(), color: newColor || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur');
      }
      const cat = await res.json();
      setList(l => [...l, cat]);
      setNewName('');
      setNewColor('');
      onChanged();
      toast.success('Catégorie créée');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/blog/blog-categories/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error('Erreur');
      const updated = await res.json();
      setList(l => l.map(c => c.id === id ? updated : c));
      setEditId(null);
      onChanged();
      toast.success('Catégorie renommée');
    } catch {
      toast.error('Erreur lors du renommage');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/blog/blog-categories/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur');
      setList(l => l.filter(c => c.id !== id));
      setConfirmCat(null);
      onChanged();
      toast.success('Catégorie supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
      setConfirmCat(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary-600" /> Gérer les catégories
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Créer une nouvelle catégorie */}
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              placeholder="Nom de la catégorie…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <input
              type="color"
              title="Couleur (optionnel)"
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1"
              value={newColor || '#6366f1'}
              onChange={e => setNewColor(e.target.value)}
            />
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </button>
          </div>

          {/* Liste des catégories */}
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {list.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Aucune catégorie</p>
            )}
            {list.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 py-2">
                {cat.color && (
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                )}
                {editId === cat.id ? (
                  <input
                    autoFocus
                    className="flex-1 border border-primary-300 rounded px-2 py-1 text-sm outline-none"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditId(null); }}
                  />
                ) : (
                  <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                )}
                <span className="text-xs text-gray-400">{cat.post_count} article{cat.post_count !== 1 ? 's' : ''}</span>
                {editId === cat.id ? (
                  <>
                    <button onClick={() => handleRename(cat.id)} className="text-green-600 hover:text-green-700 p-1">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name); }} className="text-gray-400 hover:text-primary-600 p-1">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => setConfirmCat({ id: cat.id, name: cat.name })} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmCat && (
        <ConfirmDialog
          isOpen={true}
          title="Supprimer la catégorie"
          message={`Supprimer la catégorie "${confirmCat.name}" ? Les articles gardent leur catégorie (texte).`}
          confirmText="Supprimer"
          danger
          onConfirm={() => handleDelete(confirmCat.id)}
          onClose={() => setConfirmCat(null)}
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANT MODAL ÉDITEUR DE POST
// ============================================

function PostEditorModal({
  post,
  categories,
  onClose,
  onSaved,
}: {
  post: BlogPost | null;
  categories: BlogCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BlogPostForm>(
    post
      ? {
          title: post.title,
          excerpt: post.excerpt || '',
          content: post.content,
          cover_image_url: post.cover_image_url || '',
          category: post.category || '',
          tags: post.tags || '',
          status: post.status,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>('url');
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
        const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('Erreur upload');
      const data = await res.json();
      setForm(f => ({ ...f, cover_image_url: data.url }));
      toast.success('Image uploadée');
    } catch {
      toast.error('Échec de l\'upload');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Le titre est obligatoire'); return; }
    if (!form.content.trim()) { toast.error('Le contenu est obligatoire'); return; }
    setSaving(true);
    try {
      const url = post ? `${API_URL}/api/blog/${post.id}` : `${API_URL}/api/blog`;
      const method = post ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur lors de la sauvegarde');
      }
      toast.success(post ? 'Article mis à jour' : 'Article créé');
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary-600" />
            {post ? 'Modifier l\'article' : 'Nouvel article'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              placeholder="Titre de l'article"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Résumé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Résumé</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-primary-300 outline-none"
              placeholder="Un court résumé affiché dans la liste"
              rows={2}
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
            />
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contenu *</label>
            <BlockEditor
              value={form.content}
              onChange={v => setForm(f => ({ ...f, content: v }))}
            />
          </div>

          {/* Image de couverture */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Image de couverture</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setCoverMode('url')}
                  className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${coverMode === 'url' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Link className="w-3 h-3" /> URL
                </button>
                <button
                  type="button"
                  onClick={() => setCoverMode('upload')}
                  className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${coverMode === 'upload' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Upload className="w-3 h-3" /> Upload
                </button>
              </div>
            </div>

            {coverMode === 'url' ? (
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                placeholder="https://..."
                value={form.cover_image_url}
                onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              />
            ) : (
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingCover ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'}`}>
                {uploadingCover ? (
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Cliquer pour choisir une image</span>
                    <span className="text-xs text-gray-400">JPEG, PNG, WebP — max 5 Mo</span>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }}
                />
              </label>
            )}

            {form.cover_image_url && (
              <div className="mt-2 relative w-full h-24 rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.cover_image_url.startsWith('/') ? `${API_URL}${form.cover_image_url}` : form.cover_image_url} alt="Aperçu" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, cover_image_url: '' }))}
                  className="absolute top-1 right-1 bg-white/80 hover:bg-white rounded-full p-1 text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Catégorie + Tags */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              {categories.length > 0 ? (
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none bg-white"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">— Aucune catégorie —</option>
                  {categories.filter(c => c.is_published).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  {/* Article existant avec une catégorie libre-text non dans la liste */}
                  {form.category && !categories.some(c => c.name === form.category) && (
                    <option value={form.category}>{form.category} (ancienne)</option>
                  )}
                </select>
              ) : (
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                  placeholder="ex: RH, Actualités… (créez des catégories via le bouton «&nbsp;Catégories&nbsp;»)"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (séparés par virgule)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                placeholder="ex: sécurité, formation, vie au travail"
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <div className="flex gap-3">
              {(['draft', 'published'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.status === s
                      ? s === 'published' ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'draft' ? '📝 Brouillon' : '🌐 Publié'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {post ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT LECTEUR D'ARTICLE
// ============================================

function PostReaderModal({ post, onClose }: { post: BlogPost; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft className="w-4 h-4" /> Retour
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {post.cover_image_url && (
            <img
              src={mediaUrl(post.cover_image_url)}
              alt={post.title}
              className="w-full h-56 object-cover rounded-xl mb-6"
            />
          )}
          {post.category && (
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full mb-3">
              {post.category}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{post.title}</h1>
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
            {post.author_name && <span>Par {post.author_name}</span>}
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(post.published_at || post.created_at)}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{estimateReadTime(post.content)} min de lecture</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.views_count} vue{post.views_count !== 1 ? 's' : ''}</span>
          </div>
          {post.excerpt && (
            <p className="text-gray-600 italic mb-6 border-l-4 border-primary-200 pl-4">{post.excerpt}</p>
          )}
          <div
            className="max-w-none"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }}
          />
          {post.tags && (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);

  const [viewPost, setViewPost] = useState<BlogPost | null>(null);
  const [editPost, setEditPost] = useState<BlogPost | null | 'new'>( null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);

  const isEditor  = userInfo && EDITOR_ROLES.includes(userInfo.role);
  const isAdmin   = userInfo && ADMIN_ROLES.includes(userInfo.role);

  // Charger le profil utilisateur
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setUserInfo({ id: d.id, role: d.role }))
      .catch(() => {});
  }, []);

  // Charger les catégories
  const fetchCategories = useCallback(() => {
    fetch(`${API_URL}/api/blog/blog-categories`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCategories(data))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Charger les articles
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', skip: '0' });
      if (search) params.append('search', search);
      if (filterCategory) params.append('category', filterCategory);
      if (filterStatus && isEditor) params.append('status', filterStatus);
      const res = await fetch(`${API_URL}/api/blog?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json();
      setPosts(data.items || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Impossible de charger les articles');
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterStatus, isEditor]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_URL}/api/blog/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur suppression');
      toast.success('Article supprimé');
      setPosts(p => p.filter(x => x.id !== deleteTarget.id));
    } catch {
      toast.error('Impossible de supprimer l\'article');
    } finally {
      setDeleteTarget(null);
    }
  };

  const featuredPost = posts.find(p => p.status === 'published');
  const otherPosts = posts.filter(p => p !== featuredPost);

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary-600" />
            Blog de l'entreprise
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} article{total !== 1 ? 's' : ''}</p>
        </div>
        {isEditor && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCatManager(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl transition-colors"
              title="Gérer les catégories"
            >
              <Settings2 className="w-4 h-4" /> Catégories
            </button>
            <button
              onClick={() => setEditPost('new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Nouvel article
            </button>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-200 outline-none bg-white"
            placeholder="Rechercher un article…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 outline-none"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {categories.filter(c => c.is_published).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
        {isEditor && (
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 outline-none"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="published">Publiés</option>
            <option value="draft">Brouillons</option>
          </select>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Aucun article pour le moment</p>
          {isEditor && (
            <button
              onClick={() => setEditPost('new')}
              className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm rounded-xl hover:bg-primary-700"
            >
              Créer le premier article
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Article mis en avant */}
          {featuredPost && (
            <div
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setViewPost(featuredPost)}
            >
              <div className="flex flex-col md:flex-row">
                {featuredPost.cover_image_url ? (
                  <img
                    src={mediaUrl(featuredPost.cover_image_url)}
                    alt={featuredPost.title}
                    className="w-full md:w-80 h-48 md:h-auto object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-full md:w-80 h-48 bg-gradient-to-br from-primary-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-white/50" />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">À la une</span>
                      {featuredPost.category && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{featuredPost.category}</span>
                      )}
                      {featuredPost.status === 'draft' && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Brouillon</span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 group-hover:text-primary-700 transition-colors mb-2">
                      {featuredPost.title}
                    </h2>
                    {featuredPost.excerpt && (
                      <p className="text-gray-500 text-sm line-clamp-2">{featuredPost.excerpt}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {featuredPost.author_name && <span>{featuredPost.author_name}</span>}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{formatDate(featuredPost.published_at || featuredPost.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{estimateReadTime(featuredPost.content)} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />{featuredPost.views_count}
                      </span>
                    </div>
                    {isEditor && (
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setEditPost(featuredPost)}
                          className="p-1.5 hover:bg-primary-50 text-primary-500 rounded-lg"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteTarget(featuredPost)}
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grille d'articles */}
          {otherPosts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {otherPosts.map(post => (
                <div
                  key={post.id}
                  className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                  onClick={() => setViewPost(post)}
                >
                  {post.cover_image_url ? (
                    <img
                      src={mediaUrl(post.cover_image_url)}
                      alt={post.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {post.category && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">{post.category}</span>
                      )}
                      {post.status === 'draft' && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Brouillon</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 transition-colors mb-1 line-clamp-2">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-xs text-gray-500 line-clamp-2 flex-1">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{formatDate(post.published_at || post.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />{post.views_count}
                        </span>
                      </div>
                      {isEditor && (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setEditPost(post)}
                            className="p-1 hover:bg-primary-50 text-primary-500 rounded"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteTarget(post)}
                              className="p-1 hover:bg-red-50 text-red-500 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {viewPost && (
        <PostReaderModal post={viewPost} onClose={() => setViewPost(null)} />
      )}
      {editPost !== null && (
        <PostEditorModal
          post={editPost === 'new' ? null : editPost}
          categories={categories}
          onClose={() => setEditPost(null)}
          onSaved={fetchPosts}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={true}
          title="Supprimer l'article"
          message={`Supprimer l'article "${deleteTarget.title}" ? Cette action est irréversible.`}
          confirmText="Supprimer"
          danger
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {showCatManager && (
        <BlogCategoryManagerModal
          categories={categories}
          isAdmin={!!isAdmin}
          onClose={() => setShowCatManager(false)}
          onChanged={fetchCategories}
        />
      )}
    </div>
  );
}
