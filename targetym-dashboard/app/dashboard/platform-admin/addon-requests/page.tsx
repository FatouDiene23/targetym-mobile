'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Package, Search, CheckCircle2, XCircle, Clock, RefreshCw,
  ChevronLeft, ToggleLeft, ToggleRight, Users, X,
} from 'lucide-react';
import {
  getAllTenants, adminGetPayrollRequests, adminApprovePayrollRequest,
  adminRejectPayrollRequest, adminToggleHrProgramsAddon, adminToggleAiScoringAddon, adminToggleCbModule, adminTogglePayrollModule,
  type TenantListItem, type PayrollModuleRequest,
} from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ADMIN_ROLES = ['superadmintech', 'super_admin', 'superadmin', 'platform_admin'];
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

function PayrollStatusBadge({ status }: { status: PayrollModuleRequest['status'] }) {
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <CheckCircle2 size={11} /> Approuvée
    </span>
  );
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <XCircle size={11} /> Rejetée
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Clock size={11} /> En attente
    </span>
  );
}

// ─── Toggle Switch ──────────────────────────────────────────────────────────────
function ToggleSwitch({
  enabled, onToggle, loading, label,
}: { enabled: boolean; onToggle: (val: boolean) => void; loading: boolean; label: string }) {
  return (
    <button
      onClick={() => !loading && onToggle(!enabled)}
      disabled={loading}
      title={label}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${enabled ? 'bg-primary-600' : 'bg-gray-200'} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className="sr-only">{label}</span>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
        ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function AddonRequestsPage() {
  const router = useRouter();

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { router.push('/auth/signin'); return; }
    try {
      const u = JSON.parse(userStr);
      if (!ADMIN_ROLES.includes(u.role)) { router.push('/dashboard'); }
    } catch { router.push('/auth/signin'); }
  }, [router]);

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'payroll' | 'addons'>('payroll');

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1 — Module Paie requests
  // ─────────────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<PayrollModuleRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Reject modal
  const [rejectingReq, setRejectingReq] = useState<PayrollModuleRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const filter = statusFilter === 'all' ? undefined : statusFilter;
      const data = await adminGetPayrollRequests(filter);
      setRequests(data);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur chargement demandes');
    } finally {
      setReqLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = async (req: PayrollModuleRequest) => {
    setApproving(req.id);
    try {
      await adminApprovePayrollRequest(req.id);
      toast.success(`Demande de ${req.tenant_name} approuvée`);
      loadRequests();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur approbation');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingReq || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await adminRejectPayrollRequest(rejectingReq.id, rejectReason.trim());
      toast.success(`Demande de ${rejectingReq.tenant_name} rejetée`);
      setRejectingReq(null);
      setRejectReason('');
      loadRequests();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur rejet');
    } finally {
      setRejecting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2 — Add-ons par tenant
  // ─────────────────────────────────────────────────────────────────────────
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [togglingHr, setTogglingHr] = useState<number | null>(null);
  const [togglingAi, setTogglingAi] = useState<number | null>(null);
  const [togglingCb, setTogglingCb] = useState<number | null>(null);
  const [togglingPayroll, setTogglingPayroll] = useState<number | null>(null);

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const data = await getAllTenants({ page: 1, page_size: 200 });
      setTenants(data.items);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur chargement tenants');
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const handleToggleHr = async (tenant: TenantListItem, enabled: boolean) => {
    setTogglingHr(tenant.id);
    try {
      await adminToggleHrProgramsAddon(tenant.id, enabled);
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, has_hr_programs_addon: enabled } : t));
      toast.success(`Add-on RH ${enabled ? 'activé' : 'désactivé'} pour ${tenant.name}`);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur toggle add-on RH');
    } finally {
      setTogglingHr(null);
    }
  };

  const handleToggleAi = async (tenant: TenantListItem, enabled: boolean) => {
    setTogglingAi(tenant.id);
    try {
      await adminToggleAiScoringAddon(tenant.id, enabled);
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, has_ai_scoring_addon: enabled } : t));
      toast.success(`Add-on IA Scoring ${enabled ? 'activé' : 'désactivé'} pour ${tenant.name}`);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur toggle add-on IA');
    } finally {
      setTogglingAi(null);
    }
  };

  const handleToggleCb = async (tenant: TenantListItem, enabled: boolean) => {
    setTogglingCb(tenant.id);
    try {
      await adminToggleCbModule(tenant.id, enabled);
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, has_cb_module: enabled } : t));
      toast.success(`Module Budget RH ${enabled ? 'activé' : 'désactivé'} pour ${tenant.name}`);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur toggle Budget RH');
    } finally {
      setTogglingCb(null);
    }
  };

  const handleTogglePayroll = async (tenant: TenantListItem, enabled: boolean) => {
    setTogglingPayroll(tenant.id);
    try {
      await adminTogglePayrollModule(tenant.id, enabled);
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, has_payroll_module: enabled } : t));
      toast.success(`Module Paie ${enabled ? 'activé' : 'désactivé'} pour ${tenant.name}`);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erreur toggle Module Paie');
    } finally {
      setTogglingPayroll(null);
    }
  };

  // Les tenants Enterprise ont tous les add-ons inclus — on les exclut du tableau de gestion
  const nonEnterpriseTenants = tenants.filter(t => t.plan !== 'enterprise');
  const enterpriseCount = tenants.length - nonEnterpriseTenants.length;

  const filteredTenants = nonEnterpriseTenants.filter(t =>
    t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    (t.email ?? '').toLowerCase().includes(tenantSearch.toLowerCase())
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-xl">
                <Package size={20} className="text-violet-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Demandes & Add-ons</h1>
                <p className="text-xs text-gray-500">Toutes les demandes · Gestion modules &amp; add-ons par tenant</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                ${activeTab === 'payroll'
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Toutes les demandes
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('addons')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                ${activeTab === 'addons'
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Modules &amp; Add-ons par tenant
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ─── TAB 1 : Module Paie ─────────────────────────────────────────── */}
        {activeTab === 'payroll' && (
          <div>
            {/* Filtres statut */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors
                    ${statusFilter === s
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'}`}
                >
                  {{ all: 'Toutes', pending: 'En attente', approved: 'Approuvées', rejected: 'Rejetées' }[s]}
                </button>
              ))}
              <button
                onClick={loadRequests}
                disabled={reqLoading}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-violet-600 bg-white border border-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw size={13} className={reqLoading ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {/* Tableau */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {reqLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw size={24} className="text-violet-400 animate-spin" />
                  <p className="text-sm text-gray-500">Chargement des demandes…</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Package size={32} className="text-gray-300" />
                  <p className="text-sm text-gray-500">Aucune demande</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Demandeur</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employés</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pays / Devise</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {requests.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">{req.tenant_name}</p>
                            <p className="text-xs text-gray-400">ID {req.tenant_id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                              Module Paie
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{req.requested_by_email}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{fmt(req.requested_at)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{req.nb_employees ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{req.country_code ?? '—'}</span>
                            {req.currency_code && (
                              <span className="ml-1 text-xs text-gray-400">({req.currency_code})</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <PayrollStatusBadge status={req.status} />
                            {req.rejection_reason && (
                              <p className="mt-1 text-xs text-red-500 max-w-xs truncate" title={req.rejection_reason}>
                                {req.rejection_reason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {req.status === 'pending' ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApprove(req)}
                                  disabled={approving === req.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle2 size={13} />
                                  {approving === req.id ? 'En cours…' : 'Approuver'}
                                </button>
                                <button
                                  onClick={() => { setRejectingReq(req); setRejectReason(''); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  <XCircle size={13} /> Rejeter
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {req.approved_by_email
                                  ? `Par ${req.approved_by_email} le ${fmt(req.approved_at)}`
                                  : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2 : Add-ons par tenant ───────────────────────────────────── */}
        {activeTab === 'addons' && (
          <div>
            {/* Bandeau info Enterprise */}
            {enterpriseCount > 0 && (
              <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 mb-5 text-sm text-violet-700">
                <Package size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong>{enterpriseCount} tenant{enterpriseCount > 1 ? 's' : ''} Entreprise</strong>{' '}{enterpriseCount > 1 ? 'ont' : 'a'} tous les add-ons inclus dans leur plan — ils n&apos;apparaissent pas dans ce tableau.
                </span>
              </div>
            )}

            {/* Barre recherche */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un tenant…"
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-300 outline-none bg-white"
                />
              </div>
              <button
                onClick={loadTenants}
                disabled={tenantsLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-violet-600 bg-white border border-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw size={13} className={tenantsLoading ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {/* Tableau */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {tenantsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw size={24} className="text-violet-400 animate-spin" />
                  <p className="text-sm text-gray-500">Chargement des tenants…</p>
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Users size={32} className="text-gray-300" />
                  <p className="text-sm text-gray-500">Aucun tenant trouvé</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Add-on Programmes RH</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Add-on Scoring IA CVs</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Module Budget RH</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Module Paie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTenants.map((tenant) => (
                        <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-400">{tenant.email ?? `ID ${tenant.id}`}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                              {tenant.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <ToggleSwitch
                                enabled={!!tenant.has_hr_programs_addon}
                                onToggle={(val) => handleToggleHr(tenant, val)}
                                loading={togglingHr === tenant.id}
                                label="Toggle Programmes RH"
                              />
                              <span className={`text-xs font-medium ${tenant.has_hr_programs_addon ? 'text-green-600' : 'text-gray-400'}`}>
                                {tenant.has_hr_programs_addon ? 'Activé' : 'Désactivé'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <ToggleSwitch
                                enabled={!!tenant.has_ai_scoring_addon}
                                onToggle={(val) => handleToggleAi(tenant, val)}
                                loading={togglingAi === tenant.id}
                                label="Toggle IA Scoring"
                              />
                              <span className={`text-xs font-medium ${tenant.has_ai_scoring_addon ? 'text-green-600' : 'text-gray-400'}`}>
                                {tenant.has_ai_scoring_addon ? 'Activé' : 'Désactivé'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <ToggleSwitch
                                enabled={!!tenant.has_cb_module}
                                onToggle={(val) => handleToggleCb(tenant, val)}
                                loading={togglingCb === tenant.id}
                                label="Toggle Budget RH"
                              />
                              <span className={`text-xs font-medium ${tenant.has_cb_module ? 'text-green-600' : 'text-gray-400'}`}>
                                {tenant.has_cb_module ? 'Activé' : 'Désactivé'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <ToggleSwitch
                                enabled={!!tenant.has_payroll_module}
                                onToggle={(val) => handleTogglePayroll(tenant, val)}
                                loading={togglingPayroll === tenant.id}
                                label="Toggle Module Paie"
                              />
                              <span className={`text-xs font-medium ${tenant.has_payroll_module ? 'text-green-600' : 'text-gray-400'}`}>
                                {tenant.has_payroll_module ? 'Activé' : 'Désactivé'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal Rejeter ──────────────────────────────────────────────────── */}
      {rejectingReq && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Rejeter la demande</h3>
              <button
                onClick={() => { setRejectingReq(null); setRejectReason(''); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Demande de <strong>{rejectingReq.tenant_name}</strong>
            </p>
            <p className="text-xs text-gray-400 mb-4">par {rejectingReq.requested_by_email}</p>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Motif du rejet <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison du rejet…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300 outline-none resize-none"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setRejectingReq(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {rejecting ? 'Rejet en cours…' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
