'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Building2, Search, CheckCircle2, XCircle, Clock, Eye,
  ChevronLeft, AlertTriangle, Filter, RefreshCw, Shield,
} from 'lucide-react';
import {
  getAllTenants, activateTenant, blockTenant,
  type TenantListItem,
} from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusTab = 'pending' | 'active' | 'expired' | 'all';

// ─── Badge statut ─────────────────────────────────────────────────────────────
function StatusBadge({ tenant }: { tenant: TenantListItem }) {
  const status = tenant.computed_status;

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
        <Clock size={11} /> En attente
      </span>
    );
  }
  if (status === 'trial_active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
        <CheckCircle2 size={11} /> Trial actif — {tenant.trial_days_remaining}j restants
      </span>
    );
  }
  if (status === 'trial_expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
        <XCircle size={11} /> Trial expiré
      </span>
    );
  }
  if (status === 'subscribed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
        <Shield size={11} /> Abonné
      </span>
    );
  }
  if (status === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
        <XCircle size={11} /> Bloqué
      </span>
    );
  }
  return <span className="text-xs text-gray-400">—</span>;
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function CompaniesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');

  // Modale activation
  const [activatingTenant, setActivatingTenant] = useState<TenantListItem | null>(null);
  const [activateNote, setActivateNote] = useState('');
  const [activateChecked, setActivateChecked] = useState(false);
  const [activating, setActivating] = useState(false);

  // Modale blocage
  const [blockingTenant, setBlockingTenant] = useState<TenantListItem | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { router.push('/'); return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    loadTenants(activeTab);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chargement ──────────────────────────────────────────────────────────────
  const loadTenants = useCallback(async (tab: StatusTab, q?: string) => {
    setLoading(true);
    try {
      const data = await getAllTenants({
        status: tab === 'active' ? 'active' : tab === 'expired' ? 'expired' : tab === 'pending' ? 'pending' : 'all',
        search: q,
        limit: 200,
      });
      setTenants(data);
    } catch {
      toast.error('Erreur de chargement des entreprises');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTabChange = (tab: StatusTab) => {
    setActiveTab(tab);
    loadTenants(tab, search);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    loadTenants(activeTab, val);
  };

  // ── Activation ──────────────────────────────────────────────────────────────
  const openActivateModal = (tenant: TenantListItem) => {
    setActivatingTenant(tenant);
    setActivateNote('');
    setActivateChecked(false);
  };

  const confirmActivate = async () => {
    if (!activatingTenant || !activateChecked) return;
    setActivating(true);
    try {
      await activateTenant(activatingTenant.id, { activation_note: activateNote || undefined });
      toast.success(`✅ ${activatingTenant.name} activé — trial 30 jours`);
      setActivatingTenant(null);
      loadTenants(activeTab, search);
    } catch (e: any) {
      toast.error(e.message || 'Erreur activation');
    } finally {
      setActivating(false);
    }
  };

  // ── Blocage ─────────────────────────────────────────────────────────────────
  const openBlockModal = (tenant: TenantListItem) => {
    setBlockingTenant(tenant);
    setBlockReason('');
  };

  const confirmBlock = async () => {
    if (!blockingTenant || !blockReason.trim()) return;
    setBlocking(true);
    try {
      await blockTenant(blockingTenant.id, { reason: blockReason });
      toast.success(`${blockingTenant.name} bloqué`);
      setBlockingTenant(null);
      loadTenants(activeTab, search);
    } catch (e: any) {
      toast.error(e.message || 'Erreur blocage');
    } finally {
      setBlocking(false);
    }
  };

  // ── Tabs config ─────────────────────────────────────────────────────────────
  const tabs: { id: StatusTab; label: string; color: string }[] = [
    { id: 'pending', label: '⏳ En attente', color: 'orange' },
    { id: 'active', label: '✅ Actifs', color: 'green' },
    { id: 'expired', label: '🔴 Expirés', color: 'red' },
    { id: 'all', label: '📋 Tous', color: 'gray' },
  ];

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/platform-admin" className="text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestion des entreprises</h1>
            <p className="text-sm text-gray-500">Activation, suivi et blocage des comptes clients</p>
          </div>
        </div>
        <button
          onClick={() => loadTenants(activeTab, search)}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-6 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Search */}
          <div className="ml-auto flex items-center px-4 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Building2 size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Aucune entreprise dans cette catégorie</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-6 py-3 text-left font-semibold">Entreprise</th>
                  <th className="px-4 py-3 text-left font-semibold">Email admin</th>
                  <th className="px-4 py-3 text-left font-semibold">Téléphone</th>
                  <th className="px-4 py-3 text-left font-semibold">Inscription</th>
                  <th className="px-4 py-3 text-left font-semibold">Statut</th>
                  <th className="px-4 py-3 text-left font-semibold">Employés</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-400">{t.slug}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{t.email || '—'}</td>
                    <td className="px-4 py-4 text-gray-600">{t.phone || '—'}</td>
                    <td className="px-4 py-4 text-gray-500">{fmt(t.created_at)}</td>
                    <td className="px-4 py-4">
                      <StatusBadge tenant={t} />
                    </td>
                    <td className="px-4 py-4 text-center text-gray-600">{t.employees_count}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Voir détails → ouvre le modal de détail dans platform-admin */}
                        <Link
                          href={`/dashboard/platform-admin?tenantId=${t.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          <Eye size={13} />
                          Détails
                        </Link>

                        {/* Activer — uniquement si en attente */}
                        {t.computed_status === 'pending' && (
                          <button
                            onClick={() => openActivateModal(t)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          >
                            <CheckCircle2 size={13} />
                            Activer
                          </button>
                        )}

                        {/* Bloquer — si actif */}
                        {(t.computed_status === 'trial_active' || t.computed_status === 'subscribed') && (
                          <button
                            onClick={() => openBlockModal(t)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          >
                            <XCircle size={13} />
                            Bloquer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modale Activation ──────────────────────────────────────────────── */}
      {activatingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-xl">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Confirmer l'activation</h2>
            </div>

            {/* Récapitulatif */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Entreprise</span>
                <span className="font-semibold text-gray-900">{activatingTenant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email admin</span>
                <span className="text-gray-700">{activatingTenant.email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Téléphone</span>
                <span className="text-gray-700">{activatingTenant.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Durée du trial</span>
                <span className="font-medium text-green-700">30 jours</span>
              </div>
            </div>

            {/* Checkbox frais */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={activateChecked}
                onChange={(e) => setActivateChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-indigo-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700">
                Les frais d'installation de <strong>297 000 FCFA</strong> ont été confirmés
              </span>
            </label>

            {/* Note optionnelle */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Note interne <span className="text-gray-400">(optionnel)</span>
              </label>
              <textarea
                value={activateNote}
                onChange={(e) => setActivateNote(e.target.value)}
                placeholder="Ex: Formés le 12/03/2026, paiement reçu par virement..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setActivatingTenant(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmActivate}
                disabled={!activateChecked || activating}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {activating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Activation...</>
                ) : (
                  <><CheckCircle2 size={15} /> Confirmer l'activation</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Blocage ─────────────────────────────────────────────────── */}
      {blockingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-xl">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Bloquer l'entreprise</h2>
            </div>

            <p className="text-sm text-gray-600">
              Vous allez bloquer l'accès à la plateforme pour <strong>{blockingTenant.name}</strong>.
              Les utilisateurs ne pourront plus se connecter.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Motif du blocage <span className="text-red-500">*</span>
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Impayé, fraude, demande du client..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setBlockingTenant(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmBlock}
                disabled={!blockReason.trim() || blocking}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {blocking ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Blocage...</>
                ) : (
                  <><XCircle size={15} /> Confirmer le blocage</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
