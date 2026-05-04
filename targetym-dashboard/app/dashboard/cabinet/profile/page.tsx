'use client';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Loader2, User, Mail } from 'lucide-react';
import { getToken, API_URL } from '@/lib/api';
import Header from '@/components/Header';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function CabinetProfilePage() {
  const [userInfo, setUserInfo] = useState<{ email: string; full_name?: string; name?: string } | null>(null);

  // Password form
  const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (raw) {
      try { setUserInfo(JSON.parse(raw)); } catch {}
    }
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPwd.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (form.newPwd !== form.confirm) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ current_password: form.current, new_password: form.newPwd }),
      });
      if (res.ok) {
        toast.success('Mot de passe modifié avec succès.');
        setForm({ current: '', newPwd: '', confirm: '' });
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Erreur lors du changement de mot de passe.');
      }
    } catch {
      toast.error('Erreur de connexion.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = userInfo?.full_name || userInfo?.name || '—';
  const initials = displayName === '—' ? '?' : displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="max-w-2xl mx-auto">
      <Header title="Mon profil" subtitle="Informations de votre compte cabinet" />

      <div className="p-6 space-y-5">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-primary-500 to-primary-700" />
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-8 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-md bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">{initials}</span>
              </div>
              <div className="pb-1">
                <h2 className="font-bold text-gray-900">{displayName}</h2>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 mt-0.5">
                  Cabinet de recrutement
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-100 flex-shrink-0">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Nom complet</p>
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                </div>
              </div>
              {userInfo?.email && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-100 flex-shrink-0">
                    <Mail className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{userInfo.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Changement de mot de passe */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center">
            <Lock className="w-4 h-4 text-primary-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Changer le mot de passe</h2>
            <p className="text-xs text-gray-400">Minimum 8 caractères</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Mot de passe actuel */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                value={form.current}
                onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                required
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowCurrent(v => !v)}>
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                value={form.newPwd}
                onChange={e => setForm(f => ({ ...f, newPwd: e.target.value }))}
                required
                minLength={8}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowNew(v => !v)}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Minimum 8 caractères</p>
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Confirmer le mot de passe</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.confirm && form.newPwd !== form.confirm && (
              <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {saving ? 'Enregistrement...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
