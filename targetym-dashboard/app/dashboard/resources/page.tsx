'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  PlayCircle, Plus, Search, Pencil, Trash2, Loader2, X,
  FolderOpen, Clock, Eye, Video, FileText, Link2, BookOpen,
  ExternalLink, ChevronDown, ChevronUp, Settings, Upload, Link,
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

interface ResourceCategory {
  id: number;
  name: string;
  description?: string;
  cover_image_url?: string;
  display_order: number;
  is_published: boolean;
  resource_count: number;
}

interface Resource {
  id: number;
  title: string;
  description?: string;
  video_url?: string;
  file_url?: string;
  thumbnail_url?: string;
  resource_type: 'video' | 'pdf' | 'link' | 'article';
  duration_minutes?: number;
  category_id?: number;
  category_name?: string;
  display_order: number;
  is_published: boolean;
  views_count: number;
  created_by_name?: string;
  created_at?: string;
}

interface UserInfo {
  id: number;
  role: string;
}

const ADMIN_ROLES = ['superadmintech', 'super_admin', 'superadmin', 'platform_admin'];

// ============================================
// HELPERS
// ============================================

function getYoutubeEmbedUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  if (url.includes('youtube.com/embed/')) return url;
  return null;
}

function getVimeoEmbedUrl(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function getEmbedUrl(url: string): string | null {
  return getYoutubeEmbedUrl(url) || getVimeoEmbedUrl(url) || null;
}

/** Préfixe l'URL avec API_URL si c'est un chemin relatif (upload backend) */
function mediaUrl(url?: string): string {
  if (!url) return '';
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'video':   return <Video className="w-4 h-4 text-red-500" />;
    case 'pdf':     return <FileText className="w-4 h-4 text-orange-500" />;
    case 'link':    return <Link2 className="w-4 h-4 text-blue-500" />;
    case 'article': return <BookOpen className="w-4 h-4 text-green-500" />;
    default:        return <PlayCircle className="w-4 h-4 text-gray-400" />;
  }
}

function TypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = { video: 'Vidéo', pdf: 'PDF', link: 'Lien', article: 'Article' };
  return <span>{labels[type] || type}</span>;
}

// ============================================
// MODAL — LECTURE RESOURCE
// ============================================

function ResourcePlayerModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const embedUrl = resource.video_url ? getEmbedUrl(resource.video_url) : null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 line-clamp-1">{resource.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Lecteur vidéo / embed */}
          {resource.resource_type === 'video' && resource.video_url && (
            embedUrl ? (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={resource.title}
                />
              </div>
            ) : (
              <div className="p-6 text-center">
                <video
                  controls
                  className="w-full rounded-xl"
                  src={mediaUrl(resource.video_url)}
                >
                  Votre navigateur ne supporte pas la lecture vidéo.
                </video>
              </div>
            )
          )}

          {/* PDF viewer */}
          {resource.resource_type === 'pdf' && resource.file_url && (
            <div className="p-4">
              <iframe
                src={resource.file_url}
                className="w-full rounded-xl border border-gray-200"
                style={{ height: '60vh' }}
                title={resource.title}
              />
            </div>
          )}

          {/* Lien externe */}
          {resource.resource_type === 'link' && resource.video_url && (
            <div className="p-6 text-center">
              <div className="bg-blue-50 rounded-xl p-8">
                <Link2 className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <a
                  href={resource.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Ouvrir le lien <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* Détails */}
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <TypeIcon type={resource.resource_type} /><TypeLabel type={resource.resource_type} />
              </span>
              {resource.duration_minutes && (
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{resource.duration_minutes} min</span>
              )}
              <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{resource.views_count} vue{resource.views_count !== 1 ? 's' : ''}</span>
              {resource.created_by_name && <span>Par {resource.created_by_name}</span>}
            </div>
            {resource.description && (
              <p className="text-gray-600 text-sm leading-relaxed">{resource.description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL — FORMULAIRE RESOURCE
// ============================================

function ResourceFormModal({
  resource,
  categories,
  onClose,
  onSaved,
}: {
  resource: Resource | null;
  categories: ResourceCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: resource?.title || '',
    description: resource?.description || '',
    video_url: resource?.video_url || '',
    file_url: resource?.file_url || '',
    thumbnail_url: resource?.thumbnail_url || '',
    resource_type: resource?.resource_type || 'video' as 'video' | 'pdf' | 'link' | 'article',
    duration_minutes: resource?.duration_minutes?.toString() || '',
    category_id: resource?.category_id?.toString() || '',
    display_order: resource?.display_order?.toString() || '0',
    is_published: resource?.is_published ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [thumbMode, setThumbMode] = useState<'url' | 'upload'>('url');
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [videoMode, setVideoMode] = useState<'url' | 'upload'>('url');
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const handleVideoUpload = async (file: File) => {
    setUploadingVideo(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/media/upload-video`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('Erreur upload');
      const data = await res.json();
      setForm(f => ({ ...f, video_url: data.url }));
      toast.success('Vidéo uploadée');
    } catch {
      toast.error('Échec de l\'upload vidéo');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleThumbUpload = async (file: File) => {
    setUploadingThumb(true);
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
      setForm(f => ({ ...f, thumbnail_url: data.url }));
      toast.success('Image uploadée');
    } catch {
      toast.error('Échec de l\'upload');
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Le titre est obligatoire'); return; }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        video_url: form.video_url || null,
        file_url: form.file_url || null,
        thumbnail_url: form.thumbnail_url || null,
        resource_type: form.resource_type,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        display_order: parseInt(form.display_order) || 0,
        is_published: form.is_published,
      };
      const url = resource ? `${API_URL}/api/resources/${resource.id}` : `${API_URL}/api/resources`;
      const method = resource ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur sauvegarde');
      }
      toast.success(resource ? 'Ressource mise à jour' : 'Ressource ajoutée');
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-blue-600" />
            {resource ? 'Modifier la ressource' : 'Ajouter une ressource'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titre de la ressource"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-200"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description courte"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                value={form.resource_type}
                onChange={e => setForm(f => ({ ...f, resource_type: e.target.value as 'video' | 'pdf' | 'link' | 'article' }))}
              >
                <option value="video">🎬 Vidéo</option>
                <option value="pdf">📄 PDF</option>
                <option value="link">🔗 Lien</option>
                <option value="article">📖 Article</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">Sans catégorie</option>
                {categories.filter(c => c.is_published).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {form.resource_type === 'pdf' ? 'URL du fichier PDF' : form.resource_type === 'video' ? 'Vidéo' : 'URL du lien'}
              </label>
              {form.resource_type === 'video' && (
                <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                  <button type="button" onClick={() => { setVideoMode('url'); setForm(f => ({ ...f, video_url: '' })); }}
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${videoMode === 'url' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <Link className="w-3 h-3" /> URL
                  </button>
                  <button type="button" onClick={() => { setVideoMode('upload'); setForm(f => ({ ...f, video_url: '' })); }}
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${videoMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                </div>
              )}
            </div>
            {form.resource_type === 'video' && videoMode === 'upload' ? (
              <>
                <label className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingVideo ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                  {uploadingVideo ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">MP4, WebM, MOV — max 200 Mo</span>
                    </>
                  )}
                  <input type="file" className="hidden" accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); }} />
                </label>
                {form.video_url && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                    <span className="truncate">{form.video_url}</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, video_url: '' }))} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </>
            ) : (
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                value={form.video_url}
                onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder={form.resource_type === 'video' ? 'https://youtube.com/watch?v=... ou https://vimeo.com/...' : 'https://'}
              />
            )}
            {form.resource_type === 'pdf' && (
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 mt-2"
                value={form.file_url}
                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                placeholder="URL directe du PDF"
              />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="ex: 15"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Thumbnail</label>
                <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setThumbMode('url')}
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${thumbMode === 'url' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Link className="w-3 h-3" /> URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setThumbMode('upload')}
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${thumbMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                </div>
              </div>
              {thumbMode === 'url' ? (
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.thumbnail_url}
                  onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                  placeholder="https://..."
                />
              ) : (
                <label className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingThumb ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                  {uploadingThumb ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">Choisir une image</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbUpload(f); }}
                  />
                </label>
              )}
              {form.thumbnail_url && (
                <div className="mt-1 relative w-full h-14 rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.thumbnail_url.startsWith('/') ? `${API_URL}${form.thumbnail_url}` : form.thumbnail_url} alt="Aperçu" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, thumbnail_url: '' }))}
                    className="absolute top-0.5 right-0.5 bg-white/80 hover:bg-white rounded-full p-0.5 text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_published"
              checked={form.is_published}
              onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="is_published" className="text-sm text-gray-700">Publier la ressource</label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {resource ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL — FORMULAIRE CATEGORIE
// ============================================

function CategoryFormModal({
  category,
  onClose,
  onSaved,
}: {
  category: ResourceCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    cover_image_url: category?.cover_image_url || '',
    is_published: category?.is_published ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Le nom est obligatoire'); return; }
    setSaving(true);
    try {
      const url = category
        ? `${API_URL}/api/resources/categories/${category.id}`
        : `${API_URL}/api/resources/categories`;
      const method = category ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: form.name.trim(), description: form.description || null, cover_image_url: form.cover_image_url || null, is_published: form.is_published }),
      });
      if (!res.ok) throw new Error('Erreur sauvegarde');
      toast.success(category ? 'Catégorie mise à jour' : 'Catégorie créée');
      onSaved();
      onClose();
    } catch {
      toast.error('Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Onboarding, Sécurité, Management…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-200"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image (URL)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              value={form.cover_image_url}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="cat_pub" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
            <label htmlFor="cat_pub" className="text-sm text-gray-700">Catégorie visible</label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function ResourcesPage() {
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<number | null>(null); // null = Tous
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const [viewResource, setViewResource] = useState<Resource | null>(null);
  const [editResource, setEditResource] = useState<Resource | null | 'new'>(null);
  const [editCategory, setEditCategory] = useState<ResourceCategory | null | 'new'>(null);
  const [deleteResource, setDeleteResource] = useState<Resource | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<ResourceCategory | null>(null);
  const [showCatManage, setShowCatManage] = useState(false);

  const isAdmin = userInfo && ADMIN_ROLES.includes(userInfo.role);

  // Charger user info
  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setUserInfo({ id: d.id, role: d.role }))
      .catch(() => {});
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, resRes] = await Promise.all([
        fetch(`${API_URL}/api/resources/categories`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/resources?limit=200`, { headers: getAuthHeaders() }),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (resRes.ok) {
        const d = await resRes.json();
        setResources(d.items || []);
      }
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDeleteResource = async () => {
    if (!deleteResource) return;
    try {
      const res = await fetch(`${API_URL}/api/resources/${deleteResource.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      toast.success('Ressource supprimée');
      setResources(r => r.filter(x => x.id !== deleteResource.id));
    } catch {
      toast.error('Impossible de supprimer');
    } finally {
      setDeleteResource(null);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory) return;
    try {
      const res = await fetch(`${API_URL}/api/resources/categories/${deleteCategory.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      toast.success('Catégorie supprimée');
      await fetchAll();
    } catch {
      toast.error('Impossible de supprimer');
    } finally {
      setDeleteCategory(null);
    }
  };

  // Filtrer les ressources
  const filtered = resources.filter(r => {
    if (activeTab !== null && r.category_id !== activeTab) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PlayCircle className="w-7 h-7 text-blue-600" />
            Ressources de formation
          </h1>
          <p className="text-sm text-gray-500 mt-1">{resources.length} ressource{resources.length !== 1 ? 's' : ''} disponible{resources.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setShowCatManage(v => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl transition-colors"
            >
              <Settings className="w-4 h-4" />
              Catégories
              {showCatManage ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setEditResource('new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Panneau gestion catégories (admin) */}
      {showCatManage && isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Gestion des catégories</h3>
            <button
              onClick={() => setEditCategory('new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
            >
              <Plus className="w-3 h-3" /> Nouvelle catégorie
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-800">{cat.name}</p>
                  <p className="text-xs text-gray-500">{cat.resource_count} ressource{cat.resource_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditCategory(cat)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteCategory(cat)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 col-span-3">Aucune catégorie. Créez-en une pour organiser vos ressources.</p>
            )}
          </div>
        </div>
      )}

      {/* Onglets + recherche */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative min-w-0 sm:min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            placeholder="Rechercher une ressource…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab(null)}
            className={`px-3 py-1.5 text-sm rounded-xl transition-colors ${activeTab === null ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Tout ({resources.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-3 py-1.5 text-sm rounded-xl transition-colors ${activeTab === cat.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {cat.name} ({cat.resource_count})
            </button>
          ))}
          <button
            onClick={() => setActiveTab(-1)}
            className={`px-3 py-1.5 text-sm rounded-xl transition-colors ${activeTab === -1 ? 'bg-gray-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <FolderOpen className="w-4 h-4 inline mr-1" />
            Sans catégorie
          </button>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Aucune ressource trouvée</p>
          {isAdmin && (
            <button
              onClick={() => setEditResource('new')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
            >
              Ajouter la première ressource
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(r => {
            const embedUrl = r.video_url ? getEmbedUrl(r.video_url) : null;
            return (
              <div
                key={r.id}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                onClick={() => setViewResource(r)}
              >
                {/* Thumbnail */}
                <div className="relative w-full h-40 bg-gradient-to-br from-slate-100 to-gray-200 overflow-hidden">
                  {r.thumbnail_url ? (
                    <img src={mediaUrl(r.thumbnail_url)} alt={r.title} className="w-full h-full object-cover" />
                  ) : embedUrl ? (
                    <img
                      src={`https://img.youtube.com/vi/${embedUrl.split('/embed/')[1]?.split('?')[0]}/hqdefault.jpg`}
                      alt={r.title}
                      className="w-full h-full object-cover"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  ) : null}
                  {/* Overlay play icon */}
                  <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                    <div className="bg-white/90 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform">
                      <TypeIcon type={r.resource_type} />
                    </div>
                  </div>
                  {/* Badge type */}
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 bg-white/90 text-xs font-medium rounded-full flex items-center gap-1">
                      <TypeIcon type={r.resource_type} /><TypeLabel type={r.resource_type} />
                    </span>
                  </div>
                  {/* Badge non publié */}
                  {!r.is_published && (
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Brouillon</span>
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 group-hover:text-blue-700 transition-colors">
                    {r.title}
                  </p>
                  {r.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 flex-1">{r.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {r.duration_minutes && (
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{r.duration_minutes}min</span>
                      )}
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{r.views_count}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditResource(r)} className="p-1 hover:bg-blue-50 text-blue-500 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteResource(r)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {viewResource && (
        <ResourcePlayerModal resource={viewResource} onClose={() => setViewResource(null)} />
      )}
      {editResource !== null && (
        <ResourceFormModal
          resource={editResource === 'new' ? null : editResource}
          categories={categories}
          onClose={() => setEditResource(null)}
          onSaved={fetchAll}
        />
      )}
      {editCategory !== null && (
        <CategoryFormModal
          category={editCategory === 'new' ? null : editCategory}
          onClose={() => setEditCategory(null)}
          onSaved={fetchAll}
        />
      )}
      {deleteResource && (
        <ConfirmDialog
          isOpen={true}
          title="Supprimer la ressource"
          message={`Supprimer "${deleteResource.title}" ? Cette action est irréversible.`}
          confirmText="Supprimer"
          danger
          onConfirm={handleDeleteResource}
          onClose={() => setDeleteResource(null)}
        />
      )}
      {deleteCategory && (
        <ConfirmDialog
          isOpen={true}
          title="Supprimer la catégorie"
          message={`Supprimer la catégorie "${deleteCategory.name}" et ses ressources associées ?`}
          confirmText="Supprimer"
          danger
          onConfirm={handleDeleteCategory}
          onClose={() => setDeleteCategory(null)}
        />
      )}
    </div>
  );
}
