'use client';

import { useState, useEffect, useCallback } from 'react';
import CustomSelect from '@/components/CustomSelect';
import toast from 'react-hot-toast';
import {
  PenLine, Plus, Search, Eye, Pencil, Trash2, Loader2,
  Tag, Calendar, Clock, ChevronLeft, X, BookOpen, Globe, FileText,
  Upload, Link,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

// ============================================
// CONFIG
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
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
  categories: string[];
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder="Titre de l'article"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Résumé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Résumé</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder="Un court résumé affiché dans la liste"
              rows={2}
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
            />
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu *</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-y min-h-[200px] focus:ring-2 focus:ring-blue-300 outline-none font-mono text-sm"
              placeholder="Rédigez votre article ici..."
              rows={10}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                placeholder="https://..."
                value={form.cover_image_url}
                onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              />
            ) : (
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingCover ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-blue-400 hover:bg-primary-50'}`}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                placeholder="ex: RH, Actualités, Bien-être…"
                list="cat-suggestions"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              />
              <datalist id="cat-suggestions">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (séparés par virgule)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
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
            <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full mb-3">
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
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </div>
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
  const [categories, setCategories] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const [viewPost, setViewPost] = useState<BlogPost | null>(null);
  const [editPost, setEditPost] = useState<BlogPost | null | 'new'>( null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);

  const isEditor  = userInfo && EDITOR_ROLES.includes(userInfo.role);
  const isAdmin   = userInfo && ADMIN_ROLES.includes(userInfo.role);

  // Charger le profil utilisateur
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setUserInfo({ id: d.id, role: d.role }))
      .catch(() => {});
  }, []);

  // Charger les catégories
  useEffect(() => {
    fetch(`${API_URL}/api/blog/categories`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCategories(data.map((c: { category: string }) => c.category)))
      .catch(() => {});
  }, []);

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
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary-600" />
            Blog de l'entreprise
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} article{total !== 1 ? 's' : ''}</p>
        </div>
        {isEditor && (
          <button
            onClick={() => setEditPost('new')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvel article
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-200 outline-none bg-white"
            placeholder="Rechercher un article…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <CustomSelect
            value={filterCategory}
            onChange={v => setFilterCategory(v)}
            options={[{value:'', label:'Toutes les catégories'}, ...categories.map(c => ({value: c, label: c}))]}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          />
        )}
        {isEditor && (
          <CustomSelect
            value={filterStatus}
            onChange={v => setFilterStatus(v)}
            options={[{value:'', label:'Tous les statuts'},{value:'published', label:'Publiés'},{value:'draft', label:'Brouillons'}]}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          />
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
                  <div className="w-full md:w-80 h-48 bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-white/50" />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">À la une</span>
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
                        <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded-full">{post.category}</span>
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
    </div>
  );
}
