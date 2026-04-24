'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CustomSelect from '@/components/CustomSelect';
import { useSearchParams } from 'next/navigation';
import {
  Building2, Users, UserCheck, Activity, Shield, AlertCircle, CheckCircle2,
  Search, Edit2, Eye, LogIn, Clock, ChevronRight, X, Save, RotateCcw,
  FileText, ExternalLink, Lock, GitBranch, Plus, Unlink, Layers, Power, PowerOff
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  getPlatformStats, getAllTenants, getTenantDetail, updatePlatformTenant,
  impersonateUser, getAuditLogs, platformSearch,
  convertTenantToGroup, revertTenantToStandalone,
  getSubsidiaries, addSubsidiary, detachSubsidiary,
  listConversionRequests, reviewConversionRequest, markConversionAsPaid,
  createPlatformTenant, updateGroupMaxSubsidiaries,
  type PlatformStats, type TenantListItem, type TenantDetail,
  type AuditLogItem, type SearchResult, type TenantUpdateData, type SubsidiaryItem,
  type ConversionRequestItem, type TenantCreateData,
} from '@/lib/api';

type Tab = 'overview' | 'tenants' | 'users' | 'audit' | 'conversions';

const ACTION_COLORS: Record<string, string> = {
  VIEW: 'bg-primary-100 text-primary-700',
  IMPERSONATE: 'bg-red-100 text-red-700',
  EDIT: 'bg-yellow-100 text-yellow-700',
  RESET: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-800',
  CREATE_USER: 'bg-green-100 text-green-700',
  VIEW_SEARCH: 'bg-gray-100 text-gray-600',
};

export default function PlatformAdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);

  // Filters - tenants
  const [tenantSearch, setTenantSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

  // Unified search
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Audit filters
  const [auditFilter, setAuditFilter] = useState('');

  // Tenant detail modal
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(false);
  const [tenantEditData, setTenantEditData] = useState<TenantUpdateData>({});
  const [savingTenant, setSavingTenant] = useState(false);

  // Impersonation
  const [impersonating, setImpersonating] = useState<number | null>(null);

  // Groupe / Filiales
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryItem[]>([]);
  const [subsidiariesLoading, setSubsidiariesLoading] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [showAddSubForm, setShowAddSubForm] = useState(false);
  const [addSubMode, setAddSubMode] = useState<'attach' | 'create'>('attach');
  const [addSubData, setAddSubData] = useState({ existing_tenant_slug: '', name: '', slug: '', email: '' });

  // Modal conversion en groupe
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertNbSubsidiaries, setConvertNbSubsidiaries] = useState(1);

  // Édition quota filiales
  const [editingMaxSubs, setEditingMaxSubs] = useState(false);
  const [maxSubsInput, setMaxSubsInput] = useState(0);
  const [savingMaxSubs, setSavingMaxSubs] = useState(false);

  // Création tenant
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [createTenantForm, setCreateTenantForm] = useState<TenantCreateData>({
    company_name: '', email: '', first_name: '', last_name: '', password: '',
    plan: 'basique', max_employees: 25, is_trial: false,
  });

  // Demandes de conversion groupe
  const [conversionRequests, setConversionRequests] = useState<ConversionRequestItem[]>([]);
  const [convReqLoading, setConvReqLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewOpenId, setReviewOpenId] = useState<number | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [paymentRefInput, setPaymentRefInput] = useState<Record<number, string>>({});

  // Toggle actif/inactif tenant
  const [togglingTenantId, setTogglingTenantId] = useState<number | null>(null);

  // Confirm dialog (remplace les confirm() natifs)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant: 'danger' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const getPlanBadgeClass = (plan: string) => {
    if (plan === 'enterprise') return 'bg-purple-100 text-purple-800';
    if (plan === 'professional') return 'bg-primary-100 text-primary-800';
    if (plan === 'basique') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Auth guard
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { router.push('/'); return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'super_admin') { router.push('/dashboard'); return; }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, tenantsData] = await Promise.all([
        getPlatformStats(),
        getAllTenants({ page_size: 200 }),
      ]);
      setStats(statsData);
      const tenantsList: TenantListItem[] = Array.isArray(tenantsData)
        ? tenantsData
        : (tenantsData as unknown as { items?: TenantListItem[] })?.items ?? [];
      setTenants(tenantsList);
    } catch (err) {
      console.error(err);
      toast.error('Erreur chargement données');
    } finally {
      setLoading(false);
    }
  };

  // Deep-link: si l'URL contient ?tenantId=X, ouvrir le modal de détail directement
  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (!tenantIdParam || loading || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    openTenantDetail(parseInt(tenantIdParam, 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  const loadAuditLogs = useCallback(async (action?: string) => {
    try {
      setAuditLoading(true);
      const logs = await getAuditLogs({ limit: 100, action_type: action || undefined });
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
      toast.error('Erreur chargement audit');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs(auditFilter || undefined);
  }, [activeTab, auditFilter, loadAuditLogs]);

  // Charger les demandes de conversion
  const loadConversionRequests = useCallback(async () => {
    try {
      setConvReqLoading(true);
      const data = await listConversionRequests();
      setConversionRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setConvReqLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'conversions') loadConversionRequests();
  }, [activeTab, loadConversionRequests]);

  const handleReviewConversion = async (requestId: number, approved: boolean) => {
    try {
      setReviewingId(requestId);
      await reviewConversionRequest(requestId, approved, reviewNote.trim() || undefined);
      toast.success(approved ? 'Demande approuvée !' : 'Demande refusée');
      setReviewOpenId(null);
      setReviewNote('');
      loadConversionRequests();
      if (approved) loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
      setReviewingId(null);
    } finally {
      setReviewingId(null);
    }
  };

  const handleMarkPaid = async (requestId: number) => {
    try {
      setMarkingPaidId(requestId);
      const ref = paymentRefInput[requestId]?.trim() || undefined;
      await markConversionAsPaid(requestId, ref);
      toast.success('Paiement confirmé ✔');
      loadConversionRequests();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleToggleTenant = (tenant: TenantListItem) => {
    if (tenant.is_active) {
      // Désactivation → confirmation obligatoire
      setConfirmDialog({
        title: `Désactiver « ${tenant.name} » ?`,
        message: `Les utilisateurs de ce tenant ne pourront plus se connecter tant que le compte est désactivé. Cette action est réversible.`,
        confirmLabel: 'Désactiver',
        variant: 'danger',
        onConfirm: async () => {
          try {
            setTogglingTenantId(tenant.id);
            await updatePlatformTenant(tenant.id, { is_active: false });
            setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, is_active: false } : t));
            toast.success(`Tenant « ${tenant.name} » désactivé`);
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erreur lors de la désactivation');
          } finally {
            setTogglingTenantId(null);
          }
        },
      });
    } else {
      // Réactivation → direct sans confirmation
      (async () => {
        try {
          setTogglingTenantId(tenant.id);
          await updatePlatformTenant(tenant.id, { is_active: true });
          setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, is_active: true } : t));
          toast.success(`Tenant « ${tenant.name} » réactivé ✔`);
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Erreur lors de la réactivation');
        } finally {
          setTogglingTenantId(null);
        }
      })();
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingTenant(true);
      const result = await createPlatformTenant(createTenantForm);
      toast.success(`Tenant "${result.name}" créé (/${result.slug})`);
      setShowCreateTenant(false);
      setCreateTenantForm({ company_name: '', email: '', first_name: '', last_name: '', password: '', plan: 'basique', max_employees: 25, is_trial: false });
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur création tenant');
    } finally {
      setCreatingTenant(false);
    }
  };

  // Unified search
  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    try {
      setSearchLoading(true);
      const result = await platformSearch(globalSearch.trim());
      setSearchResult(result);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de recherche');
    } finally {
      setSearchLoading(false);
    }
  };

  // Open tenant detail modal
  const openTenantDetail = async (tenantId: number) => {
    try {
      const detail = await getTenantDetail(tenantId);
      setSelectedTenant(detail);
      setTenantModalOpen(true);
      setEditingTenant(false);
      setShowAddSubForm(false);
      setSubsidiaries([]);
      // Charger les filiales si c'est un groupe
      if (detail.is_group || detail.group_type === 'group') {
        loadSubsidiaries(tenantId);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur chargement tenant');
    }
  };

  const loadSubsidiaries = async (groupId: number) => {
    try {
      setSubsidiariesLoading(true);
      const subs = await getSubsidiaries(groupId);
      setSubsidiaries(subs);
    } catch (err) {
      console.error(err);
    } finally {
      setSubsidiariesLoading(false);
    }
  };

  const handleConvertToGroup = () => {
    if (!selectedTenant) return;
    setConvertNbSubsidiaries(1);
    setShowConvertModal(true);
  };

  const handleConvertToGroupConfirm = async () => {
    if (!selectedTenant) return;
    try {
      setGroupActionLoading(true);
      setShowConvertModal(false);
      await convertTenantToGroup(selectedTenant.id, convertNbSubsidiaries);
      toast.success(`Tenant converti en groupe avec ${convertNbSubsidiaries} filiale(s) autorisée(s) !`);
      const updated = await getTenantDetail(selectedTenant.id);
      setSelectedTenant({ ...updated, is_group: true, group_type: 'group' });
      setTenants(prev => prev.map(t => t.id === updated.id ? { ...t, is_group: true, group_type: 'group' } : t));
      await loadSubsidiaries(selectedTenant.id);
      setShowAddSubForm(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleUpdateMaxSubsidiaries = async () => {
    if (!selectedTenant) return;
    try {
      setSavingMaxSubs(true);
      await updateGroupMaxSubsidiaries(selectedTenant.id, maxSubsInput);
      toast.success(`Quota mis à jour : ${maxSubsInput} filiale(s) autorisée(s)`);
      setEditingMaxSubs(false);
      // Mettre à jour le tenant sélectionné et la liste
      setSelectedTenant(prev => prev ? { ...prev, max_subsidiaries: maxSubsInput } : prev);
      setTenants(prev => prev.map(t => t.id === selectedTenant.id ? { ...t, max_subsidiaries: maxSubsInput } : t));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingMaxSubs(false);
    }
  };

  const handleRevertToStandalone = () => {
    if (!selectedTenant) return;
    setConfirmDialog({
      title: 'Annuler le groupe',
      message: `"${selectedTenant.name}" repassera en standalone. Assurez-vous qu’aucune filiale n’est rattachée.`,
      confirmLabel: 'Annuler le groupe',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setGroupActionLoading(true);
          await revertTenantToStandalone(selectedTenant.id);
          toast.success('Tenant repassé en standalone');
          const updated = await getTenantDetail(selectedTenant.id);
          setSelectedTenant({ ...updated, is_group: false, group_type: 'standalone' });
          setTenants(prev => prev.map(t => t.id === updated.id ? { ...t, is_group: false, group_type: 'standalone' } : t));
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Erreur');
        } finally {
          setGroupActionLoading(false);
        }
      },
    });
  };

  const handleAddSubsidiary = async () => {
    if (!selectedTenant) return;
    try {
      setGroupActionLoading(true);
      if (addSubMode === 'attach') {
        if (!addSubData.existing_tenant_slug.trim()) { toast.error('Slug requis'); return; }
        await addSubsidiary(selectedTenant.id, { existing_tenant_slug: addSubData.existing_tenant_slug.trim() });
      } else {
        if (!addSubData.name.trim() || !addSubData.slug.trim()) { toast.error('Nom et slug requis'); return; }
        await addSubsidiary(selectedTenant.id, { name: addSubData.name.trim(), slug: addSubData.slug.trim(), email: addSubData.email.trim() || undefined });
      }
      toast.success('Filiale ajoutée !');
      setShowAddSubForm(false);
      setAddSubData({ existing_tenant_slug: '', name: '', slug: '', email: '' });
      loadSubsidiaries(selectedTenant.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleDetachSubsidiary = (subsidiaryId: number, subsidiaryName: string) => {
    if (!selectedTenant) return;
    setConfirmDialog({
      title: 'Détacher la filiale',
      message: `"${subsidiaryName}" sera détachée du groupe et redeviendra un tenant standalone.`,
      confirmLabel: 'Détacher',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await detachSubsidiary(selectedTenant.id, subsidiaryId);
          toast.success(`« ${subsidiaryName} » détachée`);
          loadSubsidiaries(selectedTenant.id);
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Erreur');
        }
      },
    });
  };

  // Save tenant edits
  const saveTenantEdit = async () => {
    if (!selectedTenant) return;
    try {
      setSavingTenant(true);
      const updated = await updatePlatformTenant(selectedTenant.id, tenantEditData);
      setSelectedTenant(updated);
      setEditingTenant(false);
      toast.success('Tenant mis à jour');
      loadData(); // refresh list
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur mise à jour';
      toast.error(msg);
    } finally {
      setSavingTenant(false);
    }
  };

  // Impersonate user
  const handleImpersonate = (userId: number, userEmail: string, tenantId?: number) => {
    setConfirmDialog({
      title: 'Impersonation',
      message: `Vous allez accéder au dashboard de ${userEmail} en tant qu'administrateur. Cette action est enregistrée dans l'audit.`,
      confirmLabel: 'Accéder',
      variant: 'warning',
      onConfirm: async () => {
        try {
          setImpersonating(userId);
          const result = await impersonateUser(userId);
          // Backup du token et user actuels
          const currentToken = localStorage.getItem('access_token');
          const currentUser = localStorage.getItem('user');
          const currentUserObj = currentUser ? JSON.parse(currentUser) : null;
          localStorage.setItem('access_token_backup', currentToken || '');
          localStorage.setItem('user_backup', currentUser || '');
          localStorage.setItem('employee_photo_url_backup', localStorage.getItem('employee_photo_url') || '');
          localStorage.removeItem('employee_photo_url');
          // Appliquer le nouveau token
          localStorage.setItem('access_token', result.access_token);
          // Mettre à jour l'objet user pour que le sidebar affiche les bons menus
          localStorage.setItem('user', JSON.stringify({
            id: result.impersonated_user_id,
            email: result.impersonated_user_email,
            first_name: result.first_name || '',
            last_name: result.last_name || '',
            role: result.user_role || result.employee_role || 'employee',
            is_manager: result.is_manager || false,
            tenant_id: result.impersonated_tenant_id,
          }));
          // Flags d'impersonation pour la bannière
          localStorage.setItem('is_impersonating', 'true');
          localStorage.setItem('impersonated_user_email', result.impersonated_user_email);
          localStorage.setItem('impersonated_by_email', currentUserObj?.email || 'admin');
          if (result.tenant_slug) localStorage.setItem('impersonated_tenant_slug', result.tenant_slug);
          toast.success(`Impersonation OK. Token valide 30min. Redirection...`, { duration: 3000 });
          setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Erreur impersonation';
          toast.error(msg);
        } finally {
          setImpersonating(null);
        }
      },
    });
  };
  // Filtered tenants
  const filteredTenants = tenants.filter(t => {
    let match = true;
    if (tenantSearch) {
      const s = tenantSearch.toLowerCase();
      match = match && (t.name.toLowerCase().includes(s) || t.email?.toLowerCase().includes(s) || t.slug.toLowerCase().includes(s));
    }
    if (filterPlan) match = match && t.plan === filterPlan;
    if (filterActive !== undefined) match = match && t.is_active === filterActive;
    return match;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary-600" />
            Back-Office Plateforme
          </h1>
          <p className="text-gray-500 mt-1 text-sm flex items-center gap-1">
            <Lock className="w-3 h-3" /> Accès SUPER_ADMIN uniquement — Toutes les actions sont tracées
          </p>
        </div>
        {/* Unified search */}
        <form onSubmit={handleGlobalSearch} className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 min-w-0 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Recherche globale (email, nom, ID, slug)..."
              value={globalSearch}
              onChange={e => { setGlobalSearch(e.target.value); if (!e.target.value) setSearchResult(null); }}
              className="pl-9 pr-4 py-2 w-full sm:w-72 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          <button type="submit" disabled={searchLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50 whitespace-nowrap">
            {searchLoading ? '...' : 'Chercher'}
          </button>
        </form>
      </div>

      {/* Global search results */}
      {searchResult && (
        <div className="bg-white rounded-xl shadow border border-primary-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">
              Résultats pour « {searchResult.query} » — {searchResult.total_tenants} tenant(s), {searchResult.total_users} user(s)
            </h2>
            <button onClick={() => setSearchResult(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {searchResult.tenants.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tenants</p>
                {searchResult.tenants.map(t => (
                  <button key={t.id} onClick={() => openTenantDetail(t.id)}
                    className="w-full text-left p-2 rounded-lg hover:bg-primary-50 flex items-center justify-between group mb-1">
                    <div>
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.email} · {t.plan} · {t.users_count} users</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600" />
                  </button>
                ))}
              </div>
            )}
            {searchResult.users.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Utilisateurs</p>
                {searchResult.users.map(u => (
                  <div key={u.id} className="p-2 rounded-lg hover:bg-gray-50 flex items-center justify-between mb-1">
                    <div>
                      <p className="font-medium text-gray-900">{u.email}</p>
                      <p className="text-xs text-gray-500">{u.tenant_name || 'Sans tenant'} · {u.role}</p>
                    </div>
                    <button onClick={() => handleImpersonate(u.id, u.email, u.tenant_id)}
                      disabled={impersonating === u.id}
                      className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-1">
                      <LogIn className="w-3 h-3" />
                      {impersonating === u.id ? '...' : 'Impersonner'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {searchResult.total_tenants === 0 && searchResult.total_users === 0 && (
              <p className="text-gray-500 col-span-2 text-sm text-center py-4">Aucun résultat trouvé</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {([
            { key: 'overview', label: 'Vue globale', icon: Activity },
            { key: 'tenants', label: `Tenants (${tenants.length})`, icon: Building2 },
            { key: 'users', label: 'Utilisateurs', icon: Users },
            { key: 'audit', label: 'Audit', icon: FileText },
            { key: 'conversions', label: `Groupes${conversionRequests.filter(r => r.status === 'pending').length > 0 ? ` (${conversionRequests.filter(r => r.status === 'pending').length})` : ''}`, icon: Layers },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </nav>
      </div>

      {/* ===== TAB: OVERVIEW ===== */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Entreprises" value={stats.total_tenants} icon={<Building2 className="w-7 h-7 text-primary-500" />}
              badge={`+${stats.new_tenants_this_month} ce mois`} sub={`${stats.active_tenants} actifs · ${stats.trial_tenants} trial`} />
            <StatCard label="Utilisateurs" value={stats.total_users} icon={<Users className="w-7 h-7 text-purple-500" />}
              badge={`+${stats.new_users_this_month} ce mois`} sub={`${stats.active_users} actifs`} />
            <StatCard label="Employés" value={stats.total_employees} icon={<UserCheck className="w-7 h-7 text-green-500" />} />
            <StatCard label="Messages IA aujourd'hui" value={stats.total_messages_today} icon={<Activity className="w-7 h-7 text-orange-500" />}
              sub={`${stats.total_leave_requests_pending} demandes congé en attente`} />
          </div>
          {/* Quick links */}
          <div className="grid md:grid-cols-4 gap-4">
            <QuickLink title="Gérer les utilisateurs" desc="CRUD complet, reset MDP, désactiver" icon={<Users className="w-5 h-5" />} href="/dashboard/platform-admin/users" />
            <QuickLink title="Audit trail" desc="Historique toutes les actions support" icon={<FileText className="w-5 h-5" />} onClick={() => setActiveTab('audit')} />
            <QuickLink title="Tenants" desc={`${stats.trial_tenants} en trial · ${stats.active_tenants} actifs`} icon={<Building2 className="w-5 h-5" />} onClick={() => setActiveTab('tenants')} />
            <QuickLink title="Entreprises — Activation" desc="En attente, activer, bloquer" icon={<CheckCircle2 className="w-5 h-5" />} href="/dashboard/platform-admin/companies" />
          </div>
        </div>
      )}

      {/* ===== TAB: TENANTS ===== */}
      {activeTab === 'tenants' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-200">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-0 sm:min-w-[220px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Filtrer nom, email, slug..." value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <CustomSelect value={filterPlan} onChange={v => setFilterPlan(v)} options={[{value:'', label:'Tous les plans'},{value:'trial', label:'Trial'},{value:'basique', label:'Basique'},{value:'professional', label:'Professionnel'},{value:'enterprise', label:'Entreprise'}]} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <CustomSelect value={filterActive === undefined ? '' : filterActive.toString()} onChange={v => setFilterActive(v === '' ? undefined : v === 'true')} options={[{value:'', label:'Tous les statuts'},{value:'true', label:'Actifs'},{value:'false', label:'Inactifs'}]} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <span className="text-sm text-gray-500">{filteredTenants.length} résultat(s)</span>
              <button onClick={() => setShowCreateTenant(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors ml-auto">
                <Plus className="w-4 h-4" /> Nouveau tenant
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Entreprise', 'Plan', 'Statut', 'Users', 'Employés', 'Trial', 'Créé le', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTenants.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Aucun tenant trouvé</td></tr>
                ) : filteredTenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                        {tenant.is_group && <span title="Groupe" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium"><Layers className="w-3 h-3" /> Groupe</span>}
                        {tenant.group_type === 'subsidiary' && <span title="Filiale" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium"><GitBranch className="w-3 h-3" /> Filiale</span>}
                        {tenant.name}
                      </p>
                      <p className="text-xs text-gray-500">{tenant.email}</p>
                      <p className="text-xs text-gray-400">/{tenant.slug} · #{tenant.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeClass(tenant.plan)}`}>
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tenant.is_active
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" />Actif</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />Inactif</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{tenant.users_count}</td>
                    <td className="px-4 py-3 text-gray-700">{tenant.employees_count} / {tenant.max_employees}</td>
                    <td className="px-4 py-3">
                      {tenant.is_trial
                        ? <span className="text-xs text-yellow-600 flex items-center gap-1"><Clock className="w-3 h-3" />Trial</span>
                        : <span className="text-xs text-green-600">Payant</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openTenantDetail(tenant.id)}
                          className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg" title="Voir détail">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleTenant(tenant)}
                          disabled={togglingTenantId === tenant.id}
                          className={`p-1.5 rounded-lg disabled:opacity-40 ${
                            tenant.is_active
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={tenant.is_active ? 'Désactiver ce tenant' : 'Réactiver ce tenant'}
                        >
                          {tenant.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB: USERS ===== */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <Users className="w-16 h-16 text-blue-100 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Gestion complète des utilisateurs</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Créer, modifier, désactiver, reset mot de passe, impersonner des utilisateurs sur toute la plateforme.
          </p>
          <Link href="/dashboard/platform-admin/users"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium">
            <ExternalLink className="w-4 h-4" />
            Ouvrir la gestion utilisateurs
          </Link>
        </div>
      )}

      {/* ===== TAB: AUDIT ===== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between">
            <h2 className="font-semibold text-gray-800">Historique des actions support</h2>
            <div className="flex gap-2 items-center">
              <CustomSelect value={auditFilter} onChange={v => setAuditFilter(v)} options={[{value:'', label:'Toutes les actions'}, ...['VIEW','IMPERSONATE','EDIT','RESET','DELETE','CREATE_USER','VIEW_SEARCH'].map(a => ({value: a, label: a}))]} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button onClick={() => loadAuditLogs(auditFilter || undefined)} disabled={auditLoading}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1">
                <RotateCcw className="w-4 h-4" /> {auditLoading ? '...' : 'Rafraîchir'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {auditLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Date', 'Agent', 'Action', 'Cible User', 'Cible Tenant', 'IP', 'Détails'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucun log</td></tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 font-mono">{log.agent_email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[log.action_type] || 'bg-gray-100 text-gray-600'}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{log.target_user_email || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{log.target_tenant_name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ip_address || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                        {log.action_detail ? (
                          <ul className="space-y-0.5">
                            {Object.entries(log.action_detail).map(([k, v]) => (
                              <li key={k} className="flex gap-1 flex-wrap">
                                <span className="text-gray-400 capitalize">{k.replace(/_/g, ' ')} :</span>
                                <span className="text-gray-700 font-medium truncate max-w-[140px]">{String(v)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: GROUPES - DEMANDES DE CONVERSION ===== */}
      {activeTab === 'conversions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" /> Demandes de Conversion en Groupe
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Tenants qui demandent à passer en mode groupe</p>
            </div>
            <button onClick={loadConversionRequests} disabled={convReqLoading}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1">
              <RotateCcw className="w-4 h-4" /> {convReqLoading ? '...' : 'Rafraîchir'}
            </button>
          </div>

          {convReqLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
          ) : conversionRequests.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Layers className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p>Aucune demande de conversion</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversionRequests.map(req => (
                <div key={req.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">{req.tenant_name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          req.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {req.status === 'pending' ? '⏳ En attente' : req.status === 'approved' ? '✅ Approuvée' : '❌ Refusée'}
                        </span>
                        {/* Badge paiement */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          req.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {req.payment_status === 'paid' ? '💳 Payé' : '⏳ Paiement en attente'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        Par <span className="font-medium">{req.requested_by_email}</span> · {new Date(req.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      {/* Infos commerciales */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
                        {req.nb_subsidiaries && (
                          <span>🏗️ <strong>{req.nb_subsidiaries}</strong> filiale{req.nb_subsidiaries > 1 ? 's' : ''} souhaitée{req.nb_subsidiaries > 1 ? 's' : ''}</span>
                        )}
                        {req.quote_amount && (
                          <span>💰 Devis : <strong className="text-purple-700">{new Intl.NumberFormat('fr-FR').format(req.quote_amount)} XOF/mois</strong></span>
                        )}
                        {req.contact_phone && (
                          <span>📞 {req.contact_phone}</span>
                        )}
                        {req.payment_ref && (
                          <span>🧳 Réf : <span className="font-mono text-gray-800">{req.payment_ref}</span></span>
                        )}
                      </div>
                      {req.reason && (
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mt-2 italic">&ldquo;{req.reason}&rdquo;</p>
                      )}
                      {req.review_note && (
                        <p className="text-xs text-gray-500 mt-1">Note : {req.review_note}</p>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex-shrink-0">
                        {reviewOpenId === req.id ? (
                          <div className="flex flex-col gap-2 min-w-0 sm:min-w-[240px]">
                            {/* Paiement non confirmé : montrer le panneau de confirmation paiement */}
                            {req.payment_status !== 'paid' && (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-1">
                                <p className="text-xs font-semibold text-orange-800 mb-2">⚠️ Paiement requis avant approbation</p>
                                <input
                                  type="text"
                                  placeholder="Référence paiement (optionnel)"
                                  value={paymentRefInput[req.id] || ''}
                                  onChange={e => setPaymentRefInput(prev => ({ ...prev, [req.id]: e.target.value }))}
                                  className="w-full px-2 py-1.5 border border-orange-300 rounded text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
                                />
                                <button
                                  onClick={() => handleMarkPaid(req.id)}
                                  disabled={markingPaidId === req.id}
                                  className="w-full px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                  {markingPaidId === req.id ? <span className="animate-spin">...</span> : '💳'}
                                  {markingPaidId === req.id ? 'Confirmation...' : 'Marquer paiement reçu'}
                                </button>
                              </div>
                            )}
                            <input
                              type="text"
                              placeholder="Note (optionnel)"
                              value={reviewNote}
                              onChange={e => setReviewNote(e.target.value)}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReviewConversion(req.id, true)}
                                disabled={reviewingId === req.id || req.payment_status !== 'paid'}
                                title={req.payment_status !== 'paid' ? 'Confirmez le paiement d\'abord' : ''}
                                className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {reviewingId === req.id ? '...' : 'Approuver'}
                              </button>
                              <button
                                onClick={() => handleReviewConversion(req.id, false)}
                                disabled={reviewingId === req.id}
                                className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                Refuser
                              </button>
                            </div>
                            <button
                              onClick={() => { setReviewOpenId(null); setReviewNote(''); }}
                              className="text-xs text-gray-400 hover:text-gray-600 text-center"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReviewOpenId(req.id)}
                            className="px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Traiter
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CONFIRM DIALOG ===== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDialog(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl ${confirmDialog.variant === 'danger' ? 'bg-red-100' : 'bg-orange-100'}`}>
                <AlertCircle className={`w-5 h-5 ${confirmDialog.variant === 'danger' ? 'text-red-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{confirmDialog.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: CRÉER TENANT ===== */}
      {showCreateTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateTenant(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" /> Créer un tenant
              </h2>
              <button onClick={() => setShowCreateTenant(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;entreprise *</label>
                  <input required type="text" value={createTenantForm.company_name}
                    onChange={e => setCreateTenantForm(f => ({ ...f, company_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom admin *</label>
                  <input required type="text" value={createTenantForm.first_name}
                    onChange={e => setCreateTenantForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Jean" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom admin *</label>
                  <input required type="text" value={createTenantForm.last_name}
                    onChange={e => setCreateTenantForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Dupont" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email admin *</label>
                  <input required type="email" value={createTenantForm.email}
                    onChange={e => setCreateTenantForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="admin@acmecorp.com" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                  <input required type="password" value={createTenantForm.password}
                    onChange={e => setCreateTenantForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Min. 8 caractères" minLength={8} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                  <CustomSelect value={createTenantForm.plan} onChange={v => {
                    const p = v as 'basique' | 'professional' | 'enterprise';
                    const limits: Record<string, number> = { basique: 25, professional: 50, enterprise: 100 };
                    setCreateTenantForm(f => ({ ...f, plan: p, max_employees: limits[p] }));
                  }} options={[{value:'basique', label:'Basique — 25 employés'},{value:'professional', label:'Professionnel — 50 employés'},{value:'enterprise', label:'Entreprise — 100 employés'}]} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max employés</label>
                  <input type="number" readOnly value={createTenantForm.max_employees}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="is_trial" checked={createTenantForm.is_trial}
                    onChange={e => setCreateTenantForm(f => ({ ...f, is_trial: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded" />
                  <label htmlFor="is_trial" className="text-sm text-gray-700">Mode trial (expire dans 30 jours)</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateTenant(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={creatingTenant}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {creatingTenant ? <><RotateCcw className="w-4 h-4 animate-spin" /> Création...</> : <><Plus className="w-4 h-4" /> Créer le tenant</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== TENANT DETAIL MODAL ===== */}
      {tenantModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTenantModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-600" /> {selectedTenant.name}
                </h3>
                <p className="text-xs text-gray-500">#{selectedTenant.id} · /{selectedTenant.slug}</p>
              </div>
              <div className="flex gap-2">
                {editingTenant ? (
                  <>
                    <button onClick={saveTenantEdit} disabled={savingTenant}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-green-700">
                      <Save className="w-3 h-3" /> {savingTenant ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                    <button onClick={() => setEditingTenant(false)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                      Annuler
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setEditingTenant(true); setTenantEditData({}); }}
                    className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-primary-700">
                    <Edit2 className="w-3 h-3" /> Modifier
                  </button>
                )}
                <button onClick={() => setTenantModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Stats bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-primary-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary-700">{selectedTenant.users_count}</p>
                  <p className="text-xs text-primary-600">Utilisateurs</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{selectedTenant.employees_count}</p>
                  <p className="text-xs text-green-600">Employés / {selectedTenant.max_employees}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{selectedTenant.trial_days_remaining}</p>
                  <p className="text-xs text-yellow-600">Jours trial restants</p>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TenantField label="Plan" value={selectedTenant.plan}
                  editing={editingTenant}
                  editType="select" options={['trial', 'professional', 'enterprise']}
                  editValue={tenantEditData.plan}
                  onChange={v => setTenantEditData(p => ({ ...p, plan: v }))} />
                <TenantField label="Max employés" value={String(selectedTenant.max_employees)}
                  editing={editingTenant} editType="number"
                  editValue={tenantEditData.max_employees !== undefined ? String(tenantEditData.max_employees) : undefined}
                  onChange={v => setTenantEditData(p => ({ ...p, max_employees: parseInt(v) }))} />
                <TenantField label="Email" value={selectedTenant.email || '-'}
                  editing={editingTenant} editType="text"
                  editValue={tenantEditData.email}
                  onChange={v => setTenantEditData(p => ({ ...p, email: v }))} />
                <TenantField label="Téléphone" value={selectedTenant.phone || '-'}
                  editing={editingTenant} editType="text"
                  editValue={tenantEditData.phone}
                  onChange={v => setTenantEditData(p => ({ ...p, phone: v }))} />
                <TenantField label="Statut" value={selectedTenant.is_active ? 'Actif' : 'Inactif'}
                  editing={editingTenant} editType="select" options={['true', 'false']}
                  editValue={tenantEditData.is_active !== undefined ? String(tenantEditData.is_active) : undefined}
                  onChange={v => setTenantEditData(p => ({ ...p, is_active: v === 'true' }))} />
                <TenantField label="Mode trial" value={selectedTenant.is_trial ? 'Oui' : 'Non'}
                  editing={editingTenant} editType="select" options={['true', 'false']}
                  editValue={tenantEditData.is_trial !== undefined ? String(tenantEditData.is_trial) : undefined}
                  onChange={v => setTenantEditData(p => ({ ...p, is_trial: v === 'true' }))} />
                <TenantField label="Devise" value={selectedTenant.currency}
                  editing={editingTenant} editType="text"
                  editValue={tenantEditData.currency}
                  onChange={v => setTenantEditData(p => ({ ...p, currency: v }))} />
                <TenantField label="2FA requis" value={selectedTenant.require_2fa ? 'Oui' : 'Non'}
                  editing={editingTenant} editType="select" options={['true', 'false']}
                  editValue={tenantEditData.require_2fa !== undefined ? String(tenantEditData.require_2fa) : undefined}
                  onChange={v => setTenantEditData(p => ({ ...p, require_2fa: v === 'true' }))} />
              </div>

              {/* Readonly info */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                <p><span className="text-gray-500">Créé le:</span> <span className="font-medium">{selectedTenant.created_at ? new Date(selectedTenant.created_at).toLocaleString('fr-FR') : '-'}</span></p>
                {selectedTenant.intowork_company_id && (
                  <p><span className="text-gray-500">IntoWork Company ID:</span> <span className="font-mono text-primary-600">#{selectedTenant.intowork_company_id}</span></p>
                )}
                {selectedTenant.trial_ends_at && (
                  <p><span className="text-gray-500">Fin trial:</span> <span className="font-medium">{new Date(selectedTenant.trial_ends_at).toLocaleDateString('fr-FR')}</span></p>
                )}
              </div>

              {/* ===== SECTION GROUPE / FILIALES ===== */}
              <div className="border border-purple-200 rounded-xl p-4 bg-purple-50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Organisation Groupe
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    (selectedTenant.is_group || selectedTenant.group_type === 'group') ? 'bg-purple-200 text-purple-800' :
                    selectedTenant.group_type === 'subsidiary' ? 'bg-indigo-200 text-primary-800' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {(selectedTenant.is_group || selectedTenant.group_type === 'group') ? '🏢 Groupe' : selectedTenant.group_type === 'subsidiary' ? '🔗 Filiale' : '⬜ Standalone'}
                  </span>
                </div>

                {/* Standalone → convertir en groupe */}
                {selectedTenant.group_type !== 'subsidiary' && !selectedTenant.is_group && selectedTenant.group_type !== 'group' && (
                  <div className="space-y-3">
                    <p className="text-xs text-purple-700">Cette entreprise est autonome. Vous pouvez la convertir en groupe pour lui rattacher des filiales.</p>
                    {!showConvertModal ? (
                      <button onClick={handleConvertToGroup} disabled={groupActionLoading}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50">
                        <GitBranch className="w-4 h-4" /> {groupActionLoading ? 'En cours...' : 'Convertir en groupe'}
                      </button>
                    ) : (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
                        <p className="text-xs font-medium text-purple-800">Conversion de &quot;{selectedTenant.name}&quot; en groupe</p>
                        <div>
                          <label className="block text-xs text-purple-700 mb-1">Nombre de filiales autorisées *</label>
                          <input
                            type="number"
                            min={1}
                            value={convertNbSubsidiaries}
                            onChange={e => setConvertNbSubsidiaries(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-1.5 border border-purple-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Ce nombre pourra être modifié ultérieurement.</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleConvertToGroupConfirm} disabled={groupActionLoading}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
                            <GitBranch className="w-3 h-3" /> {groupActionLoading ? 'En cours...' : 'Confirmer la conversion'}
                          </button>
                          <button onClick={() => setShowConvertModal(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Groupe → afficher filiales + actions */}
                {(selectedTenant.is_group || selectedTenant.group_type === 'group') && (
                  <div className="space-y-3">
                    {/* Quota de filiales — affichage + édition */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                      {!editingMaxSubs ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-purple-700 font-medium">
                              Filiales : <span className="font-bold">{subsidiaries.length}</span> rattachée(s)
                              {(selectedTenant as any).max_subsidiaries !== undefined && (
                                <span className="text-purple-500"> / {(selectedTenant as any).max_subsidiaries} autorisée(s)</span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => { setMaxSubsInput((selectedTenant as any).max_subsidiaries ?? subsidiaries.length); setEditingMaxSubs(true); }}
                            className="text-xs text-purple-600 hover:text-purple-800 underline flex items-center gap-1 ml-2">
                            <Edit2 className="w-3 h-3" /> Modifier quota
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-xs text-purple-700 font-medium">Nb de filiales autorisées</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={subsidiaries.length}
                              value={maxSubsInput}
                              onChange={e => setMaxSubsInput(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-24 px-2 py-1 border border-purple-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button onClick={handleUpdateMaxSubsidiaries} disabled={savingMaxSubs}
                              className="px-2.5 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
                              <Save className="w-3 h-3" /> {savingMaxSubs ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                            <button onClick={() => setEditingMaxSubs(false)} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
                              Annuler
                            </button>
                          </div>
                          {maxSubsInput < subsidiaries.length && (
                            <p className="text-xs text-red-500">Le quota doit être ≥ {subsidiaries.length} (filiales déjà rattachées).</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-purple-700 font-medium">{subsidiaries.length} filiale(s) rattachée(s)</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddSubForm(v => !v)}
                          className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Ajouter une filiale
                        </button>
                        <button
                          onClick={() => {
                            if (subsidiaries.length > 0) {
                              toast.error(`Détachez d’abord les ${subsidiaries.length} filiale(s) avant d’annuler le groupe.`);
                              return;
                            }
                            handleRevertToStandalone();
                          }}
                          disabled={groupActionLoading}
                          className="px-2.5 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300 flex items-center gap-1 disabled:opacity-50">
                          <RotateCcw className="w-3 h-3" /> Annuler groupe
                        </button>
                      </div>
                    </div>

                    {/* Formulaire ajout filiale */}
                    {showAddSubForm && (
                      <div className="bg-white border border-purple-200 rounded-lg p-3 space-y-2">
                        <div className="flex gap-2 mb-2">
                          <button onClick={() => setAddSubMode('attach')}
                            className={`px-3 py-1 rounded text-xs font-medium ${addSubMode === 'attach' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            Rattacher un tenant existant
                          </button>
                          <button onClick={() => setAddSubMode('create')}
                            className={`px-3 py-1 rounded text-xs font-medium ${addSubMode === 'create' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            Créer une nouvelle filiale
                          </button>
                        </div>
                        {addSubMode === 'attach' ? (
                          <input type="text" placeholder="Slug du tenant (ex: acme-paris)" value={addSubData.existing_tenant_slug}
                            onChange={e => setAddSubData(p => ({ ...p, existing_tenant_slug: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500" />
                        ) : (
                          <div className="space-y-2">
                            <input type="text" placeholder="Nom de la filiale *" value={addSubData.name}
                              onChange={e => setAddSubData(p => ({ ...p, name: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500" />
                            <input type="text" placeholder="Slug (ex: acme-marseille) *" value={addSubData.slug}
                              onChange={e => setAddSubData(p => ({ ...p, slug: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500" />
                            <input type="email" placeholder="Email (optionnel)" value={addSubData.email}
                              onChange={e => setAddSubData(p => ({ ...p, email: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500" />
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button onClick={handleAddSubsidiary} disabled={groupActionLoading}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50">
                            {groupActionLoading ? 'En cours...' : 'Confirmer'}
                          </button>
                          <button onClick={() => setShowAddSubForm(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">Annuler</button>
                        </div>
                      </div>
                    )}

                    {/* Liste des filiales */}
                    {subsidiariesLoading ? (
                      <div className="flex justify-center py-3"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" /></div>
                    ) : subsidiaries.length === 0 ? (
                      <p className="text-xs text-purple-600 text-center py-3 italic">Aucune filiale rattachée pour l&apos;instant</p>
                    ) : (
                      <div className="space-y-2">
                        {subsidiaries.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between bg-white border border-purple-100 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{sub.name}</p>
                              <p className="text-xs text-gray-500">/{sub.slug} · {sub.employee_count} employés · <span className={sub.is_active ? 'text-green-600' : 'text-red-500'}>{sub.is_active ? 'Actif' : 'Inactif'}</span></p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => openTenantDetail(sub.id)} title="Voir détail"
                                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDetachSubsidiary(sub.id, sub.name)} title="Détacher cette filiale"
                                className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded border border-red-200 hover:border-red-300">
                                <Unlink className="w-3 h-3" /> Détacher
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Filiale → info groupe parent */}
                {selectedTenant.group_type === 'subsidiary' && selectedTenant.parent_tenant_id && (
                  <div>
                    <p className="text-xs text-primary-700 mb-2">Cette entreprise est une filiale rattachée à un groupe.</p>
                    <button onClick={() => selectedTenant.parent_tenant_id && openTenantDetail(selectedTenant.parent_tenant_id)}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5" /> Voir le groupe parent (#{selectedTenant.parent_tenant_id})
                    </button>
                  </div>
                )}
              </div>

              {/* Impersonate section */}
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <p className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> Impersonation
                </p>
                <p className="text-xs text-orange-700 mb-3">
                  Pour impersonner un utilisateur de ce tenant, allez dans la gestion utilisateurs et filtrez par tenant.
                </p>
                <Link href={`/dashboard/platform-admin/users?tenant_id=${selectedTenant.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                  <Users className="w-4 h-4" /> Voir les users du tenant
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Sub-components =====

function StatCard({ label, value, icon, badge, sub }: {
  label: string; value: number; icon: React.ReactNode; badge?: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        {icon}
        {badge && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{badge}</span>}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function QuickLink({ title, desc, icon, href, onClick }: {
  title: string; desc: string; icon: React.ReactNode; href?: string; onClick?: () => void;
}) {
  const cls = "flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer text-left";
  const inner = (
    <>
      <div className="p-2 bg-primary-50 rounded-lg text-primary-600">{icon}</div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </>
  );
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}

function TenantField({ label, value, editing, editType, options, editValue, onChange }: {
  label: string; value: string; editing: boolean;
  editType?: 'text' | 'number' | 'select'; options?: string[];
  editValue?: string; onChange?: (v: string) => void;
}) {
  if (!editing) {
    return (
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      {editType === 'select' ? (
        <CustomSelect value={editValue ?? value} onChange={v => onChange?.(v)} options={(options || []).map(o => ({value: o, label: o}))} className="w-full" />
      ) : (
        <input type={editType || 'text'} value={editValue ?? value} onChange={e => onChange?.(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      )}
    </div>
  );
}
