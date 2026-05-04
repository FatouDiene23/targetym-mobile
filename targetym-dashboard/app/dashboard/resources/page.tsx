'use client';
import { getToken, getWebinars, createWebinar, updateWebinar, deleteWebinar } from '@/lib/api';
import type { Webinar } from '@/lib/api';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  PlayCircle, Plus, Search, Pencil, Trash2, Loader2, X,
  FolderOpen, Clock, Eye, Video, FileText, Link2, BookOpen,
  ExternalLink, ChevronDown, ChevronUp, Settings, Upload, Link,
  CalendarDays, Users, Mic, Globe, CheckCircle2, GraduationCap,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';

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
              <div className="bg-primary-50 rounded-xl p-8">
                <Link2 className="w-12 h-12 text-primary-400 mx-auto mb-4" />
                <a
                  href={resource.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
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
        const token = getToken();
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
            <PlayCircle className="w-5 h-5 text-primary-600" />
            {resource ? 'Modifier la ressource' : 'Ajouter une ressource'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titre de la ressource"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-200"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description courte"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <CustomSelect
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                value={form.resource_type}
                onChange={v => setForm(f => ({ ...f, resource_type: v as 'video' | 'pdf' | 'link' | 'article' }))}
                options={[
                  { value: 'video', label: '🎬 Vidéo' },
                  { value: 'pdf', label: '📄 PDF' },
                  { value: 'link', label: '🔗 Lien' },
                  { value: 'article', label: '📖 Article' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <CustomSelect
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                value={form.category_id}
                onChange={v => setForm(f => ({ ...f, category_id: v }))}
                options={[
                  { value: '', label: 'Sans catégorie' },
                  ...categories.filter(c => c.is_published).map(c => ({ value: String(c.id), label: c.name })),
                ]}
              />
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
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${videoMode === 'url' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <Link className="w-3 h-3" /> URL
                  </button>
                  <button type="button" onClick={() => { setVideoMode('upload'); setForm(f => ({ ...f, video_url: '' })); }}
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${videoMode === 'upload' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                </div>
              )}
            </div>
            {form.resource_type === 'video' && videoMode === 'upload' ? (
              <>
                <label className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingVideo ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'}`}>
                  {uploadingVideo ? (
                    <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                value={form.video_url}
                onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder={form.resource_type === 'video' ? 'https://youtube.com/watch?v=... ou https://vimeo.com/...' : 'https://'}
              />
            )}
            {form.resource_type === 'pdf' && (
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200 mt-2"
                value={form.file_url}
                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                placeholder="URL directe du PDF"
              />
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
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
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${thumbMode === 'url' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Link className="w-3 h-3" /> URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setThumbMode('upload')}
                    className={`flex items-center gap-1 px-2 py-1 transition-colors ${thumbMode === 'upload' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                </div>
              </div>
              {thumbMode === 'url' ? (
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                  value={form.thumbnail_url}
                  onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                  placeholder="https://..."
                />
              ) : (
                <label className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingThumb ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'}`}>
                  {uploadingThumb ? (
                    <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
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
              className="w-4 h-4 accent-primary-600"
            />
            <label htmlFor="is_published" className="text-sm text-gray-700">Publier la ressource</label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg disabled:opacity-60"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Onboarding, Sécurité, Management…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-200"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image (URL)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.cover_image_url}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="cat_pub" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 accent-primary-600" />
            <label htmlFor="cat_pub" className="text-sm text-gray-700">Catégorie visible</label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg disabled:opacity-60"
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
// WEBINAR FORM MODAL
// ============================================

function WebinarFormModal({ webinar, onClose, onSaved }: {
  webinar: Webinar | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const empty = {
    title: '', description: '', cover_image_url: '', presenter_name: '',
    webinar_date: '', duration_minutes: '', replay_url: '', registration_url: '', max_attendees: '',
    status: 'draft',
  };
  const [form, setForm] = useState(webinar ? {
    title: webinar.title,
    description: webinar.description || '',
    cover_image_url: webinar.cover_image_url || '',
    presenter_name: webinar.presenter_name || '',
    webinar_date: webinar.webinar_date ? webinar.webinar_date.slice(0, 16) : '',
    duration_minutes: webinar.duration_minutes?.toString() || '',
    replay_url: webinar.replay_url || '',
    registration_url: webinar.registration_url || '',
    max_attendees: webinar.max_attendees?.toString() || '',
    status: webinar.status,
  } : empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleCoverUpload = async (file: File) => {
    setUploading(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm(f => ({ ...f, cover_image_url: data.url }));
      toast.success('Image uploadée');
    } catch { toast.error('Échec de l\'upload'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Le titre est obligatoire'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        cover_image_url: form.cover_image_url.trim() || null,
        presenter_name: form.presenter_name.trim() || null,
        webinar_date: form.webinar_date || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        replay_url: form.replay_url.trim() || null,
        registration_url: form.registration_url.trim() || null,
        max_attendees: form.max_attendees ? parseInt(form.max_attendees) : null,
        status: form.status,
      };
      if (webinar) {
        await updateWebinar(webinar.id, payload);
        toast.success('Webinaire mis à jour');
      } else {
        await createWebinar(payload);
        toast.success('Webinaire créé');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {webinar ? 'Modifier le webinaire' : 'Nouveau webinaire'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="ex: Comment structurer un plan RH efficace" />
          </div>
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-200"
              rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {/* Image cover */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image de couverture</label>
            <div className="flex gap-2">
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                value={form.cover_image_url} onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
                placeholder="https://..." />
              <label className="cursor-pointer flex items-center gap-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 text-xs text-gray-600">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleCoverUpload(e.target.files[0])} />
              </label>
            </div>
            {form.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.cover_image_url} alt="" className="mt-2 h-24 rounded-lg object-cover w-full" />
            )}
          </div>
          {/* Présentateur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Présentateur</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.presenter_name} onChange={e => setForm(f => ({ ...f, presenter_name: e.target.value }))}
              placeholder="Nom du présentateur" />
          </div>
          {/* Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & heure</label>
              <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                value={form.webinar_date} onChange={e => setForm(f => ({ ...f, webinar_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (min)</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="60" min="0" />
            </div>
          </div>
          {/* Max attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Places max (laisser vide = illimité)</label>
            <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.max_attendees} onChange={e => setForm(f => ({ ...f, max_attendees: e.target.value }))}
              placeholder="100" min="0" />
          </div>
          {/* Lien d'inscription externe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lien d&apos;inscription (externe)</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.registration_url} onChange={e => setForm(f => ({ ...f, registration_url: e.target.value }))}
              placeholder="https://forms.google.com/... ou https://zoom.us/..." />
            <p className="text-xs text-gray-400 mt-1">Les visiteurs seront redirigés vers ce lien quand ils cliquent sur &quot;S&apos;inscrire&quot;</p>
          </div>
          {/* Replay URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Replay (après le live)</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.replay_url} onChange={e => setForm(f => ({ ...f, replay_url: e.target.value }))}
              placeholder="https://youtube.com/..." />
          </div>
          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <CustomSelect className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
              value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
              options={[
                { value: 'draft', label: 'Brouillon' },
                { value: 'published', label: 'Publié (visible sur le site)' },
                { value: 'completed', label: 'Terminé (replay disponible)' },
              ]}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg disabled:opacity-60">
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
  const [mainTab, setMainTab] = useState<'resources' | 'webinars'>('resources');

  const [viewResource, setViewResource] = useState<Resource | null>(null);
  const [editResource, setEditResource] = useState<Resource | null | 'new'>(null);
  const [editCategory, setEditCategory] = useState<ResourceCategory | null | 'new'>(null);
  const [deleteResource, setDeleteResource] = useState<Resource | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<ResourceCategory | null>(null);
  const [showCatManage, setShowCatManage] = useState(false);

  // Webinars state
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [webinarsLoading, setWebinarsLoading] = useState(false);
  const [editWebinar, setEditWebinar] = useState<Webinar | null | 'new'>(null);
  const [deleteWebinarItem, setDeleteWebinarItem] = useState<Webinar | null>(null);

  const isAdmin = userInfo && ADMIN_ROLES.includes(userInfo.role);

  // Charger user info
  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setUserInfo({ id: d.id, role: d.role }))
      .catch(() => {});
  }, []);

  const fetchWebinarsData = useCallback(async () => {
    setWebinarsLoading(true);
    try {
      const data = await getWebinars();
      setWebinars(data.items);
    } catch { toast.error('Erreur chargement webinaires'); }
    finally { setWebinarsLoading(false); }
  }, []);

  useEffect(() => {
    if (mainTab === 'webinars') fetchWebinarsData();
  }, [mainTab, fetchWebinarsData]);

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

  const handleDeleteWebinar = async () => {
    if (!deleteWebinarItem) return;
    try {
      await deleteWebinar(deleteWebinarItem.id);
      toast.success('Webinaire supprimé');
      setWebinars(w => w.filter(x => x.id !== deleteWebinarItem.id));
    } catch {
      toast.error('Impossible de supprimer');
    } finally {
      setDeleteWebinarItem(null);
    }
  };

  const webinarStatusLabel = (s: string) => {
    if (s === 'published') return { label: 'Publié', cls: 'bg-green-100 text-green-700' };
    if (s === 'completed') return { label: 'Terminé', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Brouillon', cls: 'bg-yellow-100 text-yellow-700' };
  };

  // Filtrer les ressources
  const filtered = resources.filter(r => {
    if (activeTab !== null && r.category_id !== activeTab) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* En-tête + onglets principaux */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {mainTab === 'webinars' ? <GraduationCap className="w-7 h-7 text-primary-600" /> : <PlayCircle className="w-7 h-7 text-primary-600" />}
            {mainTab === 'webinars' ? 'Formations gratuites' : 'Ressources de formation'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mainTab === 'resources'
              ? `${resources.length} ressource${resources.length !== 1 ? 's' : ''} disponible${resources.length !== 1 ? 's' : ''}`
              : `${webinars.length} webinaire${webinars.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setMainTab('resources')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab === 'resources' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <PlayCircle className="w-4 h-4" /> Ressources
          </button>
          <button
            onClick={() => setMainTab('webinars')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab === 'webinars' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <GraduationCap className="w-4 h-4" /> Formations gratuites
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Actions contextuelles */}
          {mainTab === 'resources' && isAdmin && (
            <button
              onClick={() => setShowCatManage(v => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl transition-colors"
            >
              <Settings className="w-4 h-4" />
              Catégories
              {showCatManage ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {mainTab === 'resources' && isAdmin && (
            <button
              onClick={() => setEditResource('new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          )}
          {mainTab === 'webinars' && isAdmin && (
            <button
              onClick={() => setEditWebinar('new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nouveau webinaire
            </button>
          )}
        </div>
      </div>

      {/* ─── SECTION WEBINAIRES ─────────────────────────────────────── */}
      {mainTab === 'webinars' && (
        <>
          {webinarsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            </div>
          ) : webinars.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <GraduationCap className="mx-auto w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Aucun webinaire pour le moment</p>
              {isAdmin && (
                <button onClick={() => setEditWebinar('new')} className="mt-4 text-sm text-primary-600 hover:underline">
                  Créer le premier webinaire
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {webinars.map(w => {
                const st = webinarStatusLabel(w.status);
                return (
                  <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group">
                    {/* Cover */}
                    <div className="relative aspect-video bg-gradient-to-br from-primary-50 to-indigo-50 overflow-hidden">
                      {w.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.cover_image_url} alt={w.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <GraduationCap className="w-12 h-12 text-primary-300" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                    {/* Body */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2">{w.title}</p>
                      {w.description && <p className="text-xs text-gray-500 line-clamp-2 flex-1 mb-2">{w.description}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 mt-auto pt-2 border-t border-gray-50">
                        {w.presenter_name && (
                          <span className="flex items-center gap-1"><Mic className="w-3 h-3" />{w.presenter_name}</span>
                        )}
                        {w.webinar_date && (
                          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />
                            {new Date(w.webinar_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {w.duration_minutes && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{w.duration_minutes}min</span>
                        )}
                        {w.registration_url && (
                          <span className="flex items-center gap-1 text-primary-500"><Globe className="w-3 h-3" />Lien d&apos;inscription</span>
                        )}
                      </div>
                    </div>
                    {/* Actions admin */}
                    {isAdmin && (
                      <div className="px-4 pb-3 flex gap-2">
                        {w.registration_url && (
                          <a href={w.registration_url} target="_blank" rel="noopener noreferrer"
                            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center justify-center gap-1 truncate">
                            <Globe className="w-3 h-3 shrink-0" /> Voir lien
                          </a>
                        )}
                        <button onClick={() => setEditWebinar(w)} className="p-1.5 hover:bg-primary-50 text-primary-500 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteWebinarItem(w)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    {/* Bouton replay si completed */}
                    {w.replay_url && w.status === 'completed' && !isAdmin && (
                      <div className="px-4 pb-3">
                        <a href={w.replay_url} target="_blank" rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 font-medium">
                          <Globe className="w-3 h-3" /> Voir le replay
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Modals webinaires */}
          {editWebinar !== null && (
            <WebinarFormModal
              webinar={editWebinar === 'new' ? null : editWebinar}
              onClose={() => setEditWebinar(null)}
              onSaved={fetchWebinarsData}
            />
          )}
          {deleteWebinarItem && (
            <ConfirmDialog
              isOpen={true}
              title="Supprimer le webinaire"
              message={`Supprimer "${deleteWebinarItem.title}" ? Cette action est irréversible.`}
              confirmText="Supprimer"
              danger
              onConfirm={handleDeleteWebinar}
              onClose={() => setDeleteWebinarItem(null)}
            />
          )}

        </>
      )}

      {/* ─── SECTION RESSOURCES ─────────────────────────────────────── */}
      {mainTab === 'resources' && (<>

      {/* Panneau gestion catégories (admin) */}
      {showCatManage && isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Gestion des catégories</h3>
            <button
              onClick={() => setEditCategory('new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
            >
              <Plus className="w-3 h-3" /> Nouvelle catégorie
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-800">{cat.name}</p>
                  <p className="text-xs text-gray-500">{cat.resource_count} ressource{cat.resource_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditCategory(cat)} className="p-1.5 hover:bg-primary-50 text-primary-500 rounded-lg">
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
        <div className="flex-1 relative min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 bg-white"
            placeholder="Rechercher une ressource…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab(null)}
            className={`px-3 py-1.5 text-sm rounded-xl transition-colors ${activeTab === null ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Tout ({resources.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-3 py-1.5 text-sm rounded-xl transition-colors ${activeTab === cat.id ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
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
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Aucune ressource trouvée</p>
          {isAdmin && (
            <button
              onClick={() => setEditResource('new')}
              className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm rounded-xl hover:bg-primary-700"
            >
              Ajouter la première ressource
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 group-hover:text-primary-700 transition-colors">
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
                        <button onClick={() => setEditResource(r)} className="p-1 hover:bg-primary-50 text-primary-500 rounded"><Pencil className="w-3.5 h-3.5" /></button>
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
      </>)}
    </div>
  );
}
