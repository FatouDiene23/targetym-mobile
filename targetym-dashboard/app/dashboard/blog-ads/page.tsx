'use client';
import { getToken } from '@/lib/api';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Megaphone, Plus, Pencil, Trash2, Loader2, X, Eye, EyeOff,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface BlogAd {
  id: number; title: string; description: string | null; image_url: string | null;
  cta_label: string; cta_url: string; style: 'gradient' | 'image' | 'minimal';
  position: number; badge_label: string | null; is_active: boolean; created_at?: string;
}
interface BlogAdForm {
  title: string; description: string; image_url: string;
  cta_label: string; cta_url: string; style: 'gradient' | 'image' | 'minimal';
  position: number; badge_label: string; is_active: boolean;
}
interface UserInfo { id: number; role: string; }

const ADMIN_ROLES = ['superadmintech', 'super_admin', 'superadmin', 'platform_admin'];
const EMPTY_FORM: BlogAdForm = { title: '', description: '', image_url: '', cta_label: 'En savoir plus', cta_url: '', style: 'gradient', position: 1, badge_label: 'Sponsorisé', is_active: true };
const STYLE_CONFIG = {
  gradient: { label: 'Dégradé', dot: 'bg-primary-500' },
  image:    { label: 'Image',   dot: 'bg-blue-500' },
  minimal:  { label: 'Minimal', dot: 'bg-gray-400' },
};

export default function BlogAdsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [ads, setAds] = useState<BlogAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<BlogAd | null>(null);
  const [form, setForm] = useState<BlogAdForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setUser({ id: d.id, role: d.role })).catch(() => {});
  }, []);

  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/blog-ads`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data: BlogAd[] = await res.json();
      setAds(data.sort((a, b) => a.position - b.position));
    } catch { toast.error('Impossible de charger les publicités'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  function openCreate() { setEditingAd(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(ad: BlogAd) {
    setEditingAd(ad);
    setForm({ title: ad.title, description: ad.description ?? '', image_url: ad.image_url ?? '', cta_label: ad.cta_label, cta_url: ad.cta_url, style: ad.style, position: ad.position, badge_label: ad.badge_label ?? 'Sponsorisé', is_active: ad.is_active });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.cta_url.trim() || !form.cta_label.trim()) { toast.error('Titre, URL et libellé sont obligatoires'); return; }
    setSaving(true);
    try {
      const body = { ...form, description: form.description || null, image_url: form.image_url || null, badge_label: form.badge_label || null };
      const url = editingAd ? `${API_URL}/api/blog-ads/${editingAd.id}` : `${API_URL}/api/blog-ads`;
      const res = await fetch(url, { method: editingAd ? 'PUT' : 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? 'Erreur serveur'); }
      toast.success(editingAd ? 'Publicité modifiée' : 'Publicité créée');
      setShowModal(false); fetchAds();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erreur inconnue'); }
    finally { setSaving(false); }
  }

  async function toggleActive(ad: BlogAd) {
    try {
      await fetch(`${API_URL}/api/blog-ads/${ad.id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ ...ad, is_active: !ad.is_active }) });
      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a));
    } catch { toast.error('Erreur'); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`${API_URL}/api/blog-ads/${deleteId}`, { method: 'DELETE', headers: getAuthHeaders() });
      toast.success('Publicité supprimée'); setDeleteId(null); fetchAds();
    } catch { toast.error('Erreur lors de la suppression'); }
    finally { setDeleting(false); }
  }

  async function movePosition(ad: BlogAd, dir: 'up' | 'down') {
    const newPos = dir === 'up' ? Math.max(1, ad.position - 1) : ad.position + 1;
    try {
      await fetch(`${API_URL}/api/blog-ads/${ad.id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ ...ad, position: newPos }) });
      fetchAds();
    } catch { toast.error('Erreur'); }
  }

  if (!isAdmin && user) return (
    <div className="p-8 text-center text-gray-400">
      <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">Accès réservé aux administrateurs.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-100 rounded-xl">
            <Megaphone className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Publicités du Blog</h1>
            <p className="text-xs text-gray-500">Gérez les blocs publicitaires de la sidebar du blog.</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle pub
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /></div>
      ) : ads.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Aucune publicité configurée</p>
          <p className="text-xs text-gray-400 mt-1">Créez votre première publicité pour la sidebar du blog.</p>
          {isAdmin && (
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Créer une pub
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ads.map(ad => (
            <AdCard key={ad.id} ad={ad} isAdmin={!!isAdmin} onEdit={openEdit} onToggle={toggleActive} onDelete={id => setDeleteId(id)} onMoveUp={a => movePosition(a, 'up')} onMoveDown={a => movePosition(a, 'down')} />
          ))}
        </div>
      )}

      {showModal && <AdModal form={form} setForm={setForm} editing={editingAd} saving={saving} onSubmit={handleSave} onClose={() => setShowModal(false)} />}

      <ConfirmDialog isOpen={deleteId !== null} title="Supprimer la publicité" message="Cette action est irréversible. La publicité sera retirée immédiatement du blog." confirmText="Supprimer" onConfirm={handleDelete} onClose={() => setDeleteId(null)} danger />
    </div>
  );
}

function AdCard({ ad, isAdmin, onEdit, onToggle, onDelete, onMoveUp, onMoveDown }: {
  ad: BlogAd; isAdmin: boolean;
  onEdit: (ad: BlogAd) => void; onToggle: (ad: BlogAd) => void;
  onDelete: (id: number) => void; onMoveUp: (ad: BlogAd) => void; onMoveDown: (ad: BlogAd) => void;
}) {
  const style = STYLE_CONFIG[ad.style] ?? STYLE_CONFIG.gradient;
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 ${!ad.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{ad.title}</p>
          {ad.badge_label && <p className="text-[11px] text-gray-400 mt-0.5">{ad.badge_label}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} /> {style.label}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-mono">#{ad.position}</span>
        </div>
      </div>
      {ad.description && <p className="text-xs text-gray-500 line-clamp-2">{ad.description}</p>}
      <div className="text-xs truncate">
        <span className="text-primary-600 font-medium">{ad.cta_label}</span>
        <span className="text-gray-400 mx-1">→</span>
        <span className="text-gray-400">{ad.cta_url}</span>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
          <button onClick={() => onToggle(ad)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${ad.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {ad.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {ad.is_active ? 'Active' : 'Inactive'}
          </button>
          <button onClick={() => onMoveUp(ad)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMoveDown(ad)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
          <div className="flex-1" />
          <button onClick={() => onEdit(ad)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(ad.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}

function AdModal({ form, setForm, editing, saving, onSubmit, onClose }: {
  form: BlogAdForm; setForm: React.Dispatch<React.SetStateAction<BlogAdForm>>;
  editing: BlogAd | null; saving: boolean;
  onSubmit: (e: React.FormEvent) => void; onClose: () => void;
}) {
  function set<K extends keyof BlogAdForm>(key: K, value: BlogAdForm[K]) { setForm(prev => ({ ...prev, [key]: value })); }
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none transition-colors';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{editing ? 'Modifier la publicité' : 'Nouvelle publicité'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Titre *</label>
            <input type="text" placeholder="Ex: Gérez vos RH avec l'IA" value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea placeholder="Sous-titre ou accroche" value={form.description} onChange={e => set('description', e.target.value)} className={`${inputCls} resize-none`} rows={2} />
          </div>
          <div>
            <label className={labelCls}>Style visuel</label>
            <div className="flex gap-2">
              {(['gradient', 'image', 'minimal'] as const).map(s => (
                <button key={s} type="button" onClick={() => set('style', s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.style === s ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${STYLE_CONFIG[s].dot}`} />
                  {STYLE_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
          {form.style === 'image' && (
            <div>
              <label className={labelCls}>URL de l&apos;image de fond</label>
              <input type="url" placeholder="https://..." value={form.image_url} onChange={e => set('image_url', e.target.value)} className={inputCls} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Libellé du bouton *</label>
              <input type="text" placeholder="En savoir plus" value={form.cta_label} onChange={e => set('cta_label', e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>URL de destination *</label>
              <input type="text" placeholder="https://..." value={form.cta_url} onChange={e => set('cta_url', e.target.value)} className={inputCls} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Position (ordre)</label>
              <input type="number" min={1} value={form.position} onChange={e => set('position', parseInt(e.target.value) || 1)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Label badge</label>
              <input type="text" placeholder="Sponsorisé" value={form.badge_label} onChange={e => set('badge_label', e.target.value)} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 rounded-full bg-gray-200 peer-checked:bg-primary-600 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm text-gray-700">Publicité active (visible sur le blog)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
