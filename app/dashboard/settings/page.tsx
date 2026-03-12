'use client';

import Header from '@/components/Header';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Building2,
  Bell,
  Shield,
  Link2,
  Save,
  Check,
  FileText,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Stamp,
  PenTool,
  RefreshCw,
  Unplug,
  ExternalLink
} from 'lucide-react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { settingsTips } from '@/config/pageTips';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getIntegrations, connectIntegration, disconnectIntegration, syncIntegration, type Integration,
  requestGroupConversion, getMyConversionRequestStatus, getMyGroupContext, createMySubsidiary,
  type ConversionRequestItem, type SubsidiaryItem } from '@/lib/api';

const GROUP_BASE_PRICE = 100_000;       // XOF/mois
const GROUP_PRICE_PER_SUB = 30_000;    // XOF/mois par filiale
const calcGroupPrice = (n: number) => GROUP_BASE_PRICE + Math.max(1, n) * GROUP_PRICE_PER_SUB;
const formatXOF = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF';
import { Layers } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

const PROVIDER_COLORS: Record<string, string> = {
  teams: 'bg-[#6264A7]',
  asana: 'bg-[#F06A6A]',
  google: 'bg-[#4285F4]',
};

const PROVIDER_LETTERS: Record<string, string> = {
  teams: 'T',
  asana: 'A',
  google: 'G',
};

// ============================================
// COMPOSANT : Intégration IntoWork
// ============================================
function IntoWorkIntegrationSection() {
  const [status, setStatus] = useState<{ linked: boolean; intowork_company_id?: number; linked_at?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [intoworkApiKey, setIntoworkApiKey] = useState('');
  const [targetymKey, setTargetymKey] = useState('');
  const [targetymKeyPreview, setTargetymKeyPreview] = useState('');
  const [copied, setCopied] = useState(false);
  const [myTenantId, setMyTenantId] = useState<number | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  // Récupérer le tenant_id via l'API (plus fiable que le décodage JWT)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return;
    fetch(`${API_URL}/api/auth/tenant-settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) setMyTenantId(data.id); })
      .catch(() => {
        // Fallback : décoder le JWT
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.tenant_id) setMyTenantId(payload.tenant_id);
        } catch {}
      });
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/integrations/intowork/status`, { headers: getAuthHeaders() }).then(r => r.json()),
      fetch(`${API_URL}/api/integrations/intowork/api-key`, { headers: getAuthHeaders() }).then(r => r.json()),
    ])
      .then(([statusData, keyData]) => {
        setStatus(statusData);
        if (keyData.has_key) setTargetymKeyPreview(keyData.api_key_preview);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateKey = async () => {
    setIsGenerating(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/intowork/api-key/generate`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setTargetymKey(data.api_key);
      setTargetymKeyPreview(data.api_key.slice(0, 8) + '****');
      toast.success('Clé générée — copiez-la dans IntoWork');
    } catch {
      toast.error('Erreur lors de la génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!targetymKey) return;
    navigator.clipboard.writeText(targetymKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLink = async () => {
    if (!companyId || !intoworkApiKey) { toast.error('Veuillez remplir tous les champs'); return; }
    setIsLinking(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/intowork/link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ intowork_company_id: parseInt(companyId), intowork_api_key: intoworkApiKey }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail); }
      const data = await r.json();
      setStatus({ linked: true, intowork_company_id: data.intowork_company_id, linked_at: data.linked_at });
      toast.success('✅ Compte IntoWork lié avec succès !');
      setCompanyId(''); setIntoworkApiKey('');
    } catch (e: any) {
      toast.error(e.message || 'Erreur de liaison');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSyncJobs = async () => {
    setIsSyncing(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/intowork/sync-jobs`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error((await r.json()).detail || 'Erreur');
      const data = await r.json();
      if (data.synced === 0 && data.total === 0) {
        toast('Aucun poste actif à synchroniser', { icon: 'ℹ️' });
      } else if (data.failed > 0) {
        toast.error(`${data.synced} synchronisé(s), ${data.failed} échec(s)`);
      } else {
        toast.success(`✅ ${data.synced} poste(s) synchronisé(s) vers IntoWork`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur de synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnlink = () => {
    setConfirmUnlink(true);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /></div>;

  return (
    <div className="rounded-xl border-2 border-primary-100 overflow-hidden">
      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-primary-50 to-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
            <span className="text-2xl">🔗</span>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-base">IntoWork Search</h4>
                  {myTenantId && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Votre Tenant ID Targetym :</span>
                      <span className="font-mono font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded text-sm select-all">#{myTenantId}</span>
                      <span className="text-xs text-gray-400">(à donner au RH IntoWork)</span>
                    </div>
                  )}
            <p className="text-xs text-gray-500">Plateforme de recrutement B2B2C</p>
          </div>
        </div>
        {status?.linked ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <Check className="w-3.5 h-3.5" /> Liés
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
            Non lié
          </span>
        )}
      </div>
      <div className="p-5 space-y-5">
        {status?.linked ? (
          <>
            <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-sm text-gray-700 space-y-1">
              <p><span className="text-gray-500">Company IntoWork :</span> <span className="font-medium">#{status.intowork_company_id}</span></p>
              <p><span className="text-gray-500">Lié le :</span> <span className="font-medium">{status.linked_at ? new Date(status.linked_at).toLocaleDateString('fr-FR') : '—'}</span></p>
            </div>
            <div className="space-y-2">
              {['Candidats embauchés → Employés créés automatiquement', 'Postes ouverts synchronisés vers IntoWork'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-green-600" />
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={handleSyncJobs} disabled={isSyncing} className="w-full py-2 text-sm font-medium rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isSyncing ? <><Loader2 className="w-4 h-4 animate-spin" />Synchronisation...</> : <><RefreshCw className="w-4 h-4" />Synchroniser les offres maintenant</>}
            </button>
            <button onClick={handleUnlink} disabled={isUnlinking} className="w-full py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50">
              {isUnlinking ? 'Suppression...' : 'Délier IntoWork'}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
                <p className="text-sm font-medium text-gray-800">Générez votre clé API Targetym</p>
              </div>
              <p className="text-xs text-gray-500 ml-7">Copiez cette clé et collez-la dans IntoWork (Dashboard → Intégrations → Targetym).</p>
              {targetymKey ? (
                <div className="ml-7 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-800 text-green-400 rounded-lg text-xs font-mono truncate">{targetymKey}</code>
                  <button onClick={handleCopy} className="px-3 py-2 text-xs font-medium rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors flex items-center gap-1 flex-shrink-0">
                    {copied ? <><Check className="w-3.5 h-3.5" />Copié !</> : 'Copier'}
                  </button>
                </div>
              ) : targetymKeyPreview ? (
                <div className="ml-7 flex items-center gap-2 text-xs text-gray-500">
                  <code className="px-3 py-1.5 bg-gray-100 rounded-lg font-mono">{targetymKeyPreview}</code>
                  <span>— Régénérez si besoin</span>
                </div>
              ) : null}
              <div className="ml-7">
                <button onClick={handleGenerateKey} disabled={isGenerating} className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Génération...</> : targetymKeyPreview ? '🔄 Régénérer la clé' : '⚡ Générer la clé API'}
                </button>
              </div>
            </div>
            <div className="border-t border-gray-100" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
                <p className="text-sm font-medium text-gray-800">Entrez les informations IntoWork</p>
              </div>
              <p className="text-xs text-gray-500 ml-7">Récupérez votre ID Company et votre clé API depuis IntoWork → Intégrations → Targetym.</p>
              <div className="ml-7 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ID Company IntoWork</label>
                  <input type="number" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="ex: 12" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Clé API IntoWork</label>
                  <input type="text" value={intoworkApiKey} onChange={(e) => setIntoworkApiKey(e.target.value)} placeholder="iw_..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono" />
                </div>
              </div>
              <div className="ml-7">
                <button onClick={handleLink} disabled={isLinking || !companyId || !intoworkApiKey || !targetymKeyPreview} className="px-4 py-2.5 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isLinking ? <><Loader2 className="w-4 h-4 animate-spin" />Liaison...</> : <><Link2 className="w-4 h-4" />Lier les comptes</>}
                </button>
                {!targetymKeyPreview && <p className="text-xs text-amber-600 mt-1">⚠ Générez d'abord la clé API (étape 1)</p>}
              </div>
            </div>
          </>
        )}
      </div>
      {confirmUnlink && (
        <ConfirmDialog
          isOpen={confirmUnlink}
          title="Supprimer la liaison IntoWork"
          message="Confirmer la suppression de la liaison avec IntoWork ?"
          danger={true}
          confirmText="Supprimer"
          onClose={() => setConfirmUnlink(false)}
          onConfirm={async () => {
            setConfirmUnlink(false);
            setIsUnlinking(true);
            try {
              const r = await fetch(`${API_URL}/api/integrations/intowork/unlink`, {
                method: 'DELETE', headers: getAuthHeaders(),
              });
              if (!r.ok) { const e = await r.json(); throw new Error(e.detail); }
              setStatus({ linked: false });
              toast.success('Liaison IntoWork supprimée');
            } catch (e: any) {
              toast.error(e.message || 'Erreur');
            } finally {
              setIsUnlinking(false);
            }
          }}
        />
      )}
    </div>
  );
}

// Types
interface TenantData {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  plan: string;
  is_trial: boolean;
  trial_ends_at?: string;
  max_employees: number;
  currency: string;
  is_group?: boolean;
  group_type?: 'standalone' | 'group' | 'subsidiary';
}

interface CurrencyOption {
  code: string;
  label: string;
}

interface CertificateSettings {
  certificate_logo: string | null;
  certificate_signature: string | null;
  certificate_stamp: string | null;
  certificate_company_name: string | null;
  certificate_company_address: string | null;
  certificate_company_city: string | null;
  certificate_signatory_name: string | null;
  certificate_signatory_title: string | null;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Données tenant (chargées depuis l'API)
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  
  // Formulaires éditables
  const [tenantForm, setTenantForm] = useState({
    name: '',
    email: '',
    phone: '',
    currency: 'XOF',
  });
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  
  const [savingTenant, setSavingTenant] = useState(false);
  const [savedTenant, setSavedTenant] = useState(false);

  // États pour les paramètres de certificat
  const [certificateSettings, setCertificateSettings] = useState<CertificateSettings>({
    certificate_logo: null,
    certificate_signature: null,
    certificate_stamp: null,
    certificate_company_name: null,
    certificate_company_address: null,
    certificate_company_city: null,
    certificate_signatory_name: null,
    certificate_signatory_title: null,
  });
  const [loadingCertSettings, setLoadingCertSettings] = useState(false);
  const [savingCertSettings, setSavingCertSettings] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // Tour tips
  const { showTips, dismissTips, resetTips } = usePageTour('settings');

  // États pour la sécurité tenant (2FA)
  const [securitySettings, setSecuritySettings] = useState<{ require_2fa: boolean; total_users: number; users_with_2fa: number }>({ require_2fa: false, total_users: 0, users_with_2fa: 0 });
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  // États pour les préférences de notifications
  const [notifPrefs, setNotifPrefs] = useState<{ key: string; label: string; description: string; enabled: boolean }[]>([]);
  const [loadingNotifPrefs, setLoadingNotifPrefs] = useState(false);
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);

  // États pour la demande de conversion en groupe
  const [conversionRequest, setConversionRequest] = useState<ConversionRequestItem | null>(null);
  const [loadingConvReq, setLoadingConvReq] = useState(false);
  const [submittingConvReq, setSubmittingConvReq] = useState(false);
  const [convReason, setConvReason] = useState('');
  const [convNbSubsidiaries, setConvNbSubsidiaries] = useState(1);
  const [convPhone, setConvPhone] = useState('');
  const [showConvForm, setShowConvForm] = useState(false);

  // États pour la gestion des filiales (si groupe approuvé)
  const [groupSubsidiaries, setGroupSubsidiaries] = useState<SubsidiaryItem[]>([]);
  const [loadingSubsidiaries, setLoadingSubsidiaries] = useState(false);
  const [showSubsidiaryModal, setShowSubsidiaryModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubSlug, setNewSubSlug] = useState('');
  const [newSubEmail, setNewSubEmail] = useState('');
  const [creatingSubsidiary, setCreatingSubsidiary] = useState(false);

  // États pour les intégrations
  const [integrationsList, setIntegrationsList] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);

  // URL params (for OAuth callback redirects)
  const searchParams = useSearchParams();

  // ============================================
  // CHARGEMENT DES DONNÉES
  // ============================================

  // Handle URL params from OAuth callbacks
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);

    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    // If we're in a popup (OAuth redirect), close and let parent refresh
    if ((connected || error) && window.opener) {
      window.close();
      return;
    }

    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connecté avec succès !`);
      window.history.replaceState({}, '', '/dashboard/settings?tab=integrations');
    }
    if (error) {
      toast.error(`Erreur de connexion ${error}`);
      window.history.replaceState({}, '', '/dashboard/settings?tab=integrations');
    }
  }, [searchParams]);

  useEffect(() => {
    loadUserAndTenant();
  }, []);

  async function loadUserAndTenant() {
    setLoading(true);
    try {
      // Charger les paramètres tenant + liste des devises
      const [tenantRes, currenciesRes] = await Promise.all([
        fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/currency/supported`),
      ]);
      if (tenantRes.ok) {
        const tenant = await tenantRes.json();
        setTenantData(tenant);
        setTenantForm({
          name: tenant.name || '',
          email: tenant.email || '',
          phone: tenant.phone || '',
          currency: tenant.currency || 'XOF',
        });
      }
      if (currenciesRes.ok) {
        setCurrencies(await currenciesRes.json());
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // SAUVEGARDE PARAMÈTRES ENTREPRISE
  // ============================================

  const saveTenantSettings = async () => {
    setSavingTenant(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/tenant-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(tenantForm),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.tenant) {
          setTenantData(prev => prev ? { ...prev, ...data.tenant } : prev);
        }
        setSavedTenant(true);
        setTimeout(() => setSavedTenant(false), 2000);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion');
    } finally {
      setSavingTenant(false);
    }
  };

  // ============================================
  // CERTIFICATS
  // ============================================

  const loadCertificateSettings = useCallback(async () => {
    setLoadingCertSettings(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/certificate`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCertificateSettings(data);
      }
    } catch (error) {
      console.error('Erreur chargement paramètres certificat:', error);
    } finally {
      setLoadingCertSettings(false);
    }
  }, []);

  const loadSecuritySettings = useCallback(async () => {
    setLoadingSecurity(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/tenant-security`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSecuritySettings(data);
      }
    } catch (error) {
      console.error('Erreur chargement sécurité:', error);
    } finally {
      setLoadingSecurity(false);
    }
  }, []);

  const saveSecuritySettings = async () => {
    setSavingSecurity(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/tenant-security`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ require_2fa: securitySettings.require_2fa }),
      });
      if (res.ok) {
        toast.success('Paramètres de sécurité enregistrés');
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion');
    } finally {
      setSavingSecurity(false);
    }
  };

  const loadNotifPreferences = useCallback(async () => {
    setLoadingNotifPrefs(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/preferences`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotifPrefs(data.categories);
      }
    } catch (error) {
      console.error('Erreur chargement préférences notifications:', error);
    } finally {
      setLoadingNotifPrefs(false);
    }
  }, []);

  const saveNotifPreferences = async () => {
    setSavingNotifPrefs(true);
    try {
      const preferences: Record<string, boolean> = {};
      notifPrefs.forEach(p => { preferences[p.key] = p.enabled; });
      const res = await fetch(`${API_URL}/api/notifications/preferences`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ preferences }),
      });
      if (res.ok) {
        toast.success('Préférences enregistrées');
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion');
    } finally {
      setSavingNotifPrefs(false);
    }
  };

  const toggleNotifPref = (key: string) => {
    setNotifPrefs(prev => prev.map(p => p.key === key ? { ...p, enabled: !p.enabled } : p));
  };

  // ============================================
  // INTÉGRATIONS
  // ============================================

  const loadIntegrations = useCallback(async () => {
    setLoadingIntegrations(true);
    try {
      const data = await getIntegrations();
      setIntegrationsList(data);
    } catch (error) {
      console.error('Erreur chargement intégrations:', error);
    } finally {
      setLoadingIntegrations(false);
    }
  }, []);

  const handleConnect = async (provider: string) => {
    setConnectingProvider(provider);
    try {
      const { auth_url } = await connectIntegration(provider);
      // Open OAuth in popup
      const popup = window.open(auth_url, 'oauth', 'width=600,height=700,scrollbars=yes');
      // Poll for popup close and refresh
      const interval = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(interval);
          setConnectingProvider(null);
          loadIntegrations();
        }
      }, 500);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur de connexion');
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    setDisconnectingProvider(provider);
    try {
      await disconnectIntegration(provider);
      toast.success('Intégration déconnectée');
      loadIntegrations();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const handleSync = async (provider: string) => {
    setSyncingProvider(provider);
    try {
      await syncIntegration(provider);
      toast.success('Synchronisation réussie');
      loadIntegrations();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur de synchronisation');
    } finally {
      setSyncingProvider(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'certificates') {
      loadCertificateSettings();
    }
    if (activeTab === 'notifications') {
      loadNotifPreferences();
    }
    if (activeTab === 'security') {
      loadSecuritySettings();
    }
    if (activeTab === 'integrations') {
      loadIntegrations();
    }
  }, [activeTab, loadCertificateSettings, loadNotifPreferences, loadSecuritySettings, loadIntegrations]);

  const saveCertificateSettings = async () => {
    setSavingCertSettings(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/certificate`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          certificate_company_name: certificateSettings.certificate_company_name,
          certificate_company_address: certificateSettings.certificate_company_address,
          certificate_company_city: certificateSettings.certificate_company_city,
          certificate_signatory_name: certificateSettings.certificate_signatory_name,
          certificate_signatory_title: certificateSettings.certificate_signatory_title,
        }),
      });
      
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion');
    } finally {
      setSavingCertSettings(false);
    }
  };

  const handleFileUpload = async (fileType: 'logo' | 'signature' | 'stamp', file: File) => {
    setUploadingFile(fileType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/settings/certificate/upload/${fileType}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setCertificateSettings(prev => ({
          ...prev,
          [`certificate_${fileType}`]: data.url,
        }));
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erreur lors de l\'upload');
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error('Erreur de connexion');
    } finally {
      setUploadingFile(null);
    }
  };

  const handleFileDelete = async (fileType: 'logo' | 'signature' | 'stamp') => {
    const fileLabel = fileType === 'logo' ? 'le logo' : fileType === 'signature' ? 'la signature' : 'le cachet';
    setConfirmDialog({
      isOpen: true,
      title: `Supprimer ${fileLabel}`,
      message: `Êtes-vous sûr de vouloir supprimer ${fileLabel} ?`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem('access_token');
          const response = await fetch(`${API_URL}/api/settings/certificate/upload/${fileType}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          
          if (response.ok) {
            setCertificateSettings(prev => ({
              ...prev,
              [`certificate_${fileType}`]: null,
            }));
            toast.success('Fichier supprimé');
          } else {
            toast.error('Erreur lors de la suppression');
          }
        } catch (error) {
          console.error('Erreur suppression:', error);
          toast.error('Erreur de connexion');
        }
      },
    });
  };

  // Composant pour upload de fichier
  const FileUploadBox = ({ 
    fileType, label, icon: Icon, currentUrl 
  }: { 
    fileType: 'logo' | 'signature' | 'stamp';
    label: string;
    icon: React.ElementType;
    currentUrl: string | null;
  }) => {
    const isUploading = uploadingFile === fileType;
    
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-primary-300 transition-colors">
        <div className="flex flex-col items-center">
          {currentUrl ? (
            <div className="relative w-full">
              <img src={`${API_URL}${currentUrl}`} alt={label} className="max-h-24 mx-auto object-contain rounded-lg" />
              <button onClick={() => handleFileDelete(fileType)} className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Icon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
              <p className="text-xs text-gray-500 mb-3">PNG, JPG (max 2MB)</p>
            </>
          )}
          
          <label className={`cursor-pointer px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isUploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
          }`}>
            {isUploading ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Upload...</span>
            ) : (
              <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> {currentUrl ? 'Changer' : 'Uploader'}</span>
            )}
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" className="hidden" disabled={isUploading}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(fileType, file); }}
            />
          </label>
        </div>
      </div>
    );
  };

  const tenantRole = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').role || ''; } catch { return ''; } })()
    : '';
  const canRequestGroup = ['admin', 'dg'].includes(tenantRole?.toLowerCase());

  // Charger le statut de la demande de conversion
  useEffect(() => {
    if (!canRequestGroup) return;
    setLoadingConvReq(true);
    getMyConversionRequestStatus()
      .then(data => setConversionRequest(data))
      .catch(() => {})
      .finally(() => setLoadingConvReq(false));
  }, [canRequestGroup]);

  const handleSubmitConversionRequest = async () => {
    try {
      setSubmittingConvReq(true);
      const result = await requestGroupConversion(
        convReason.trim() || undefined,
        convNbSubsidiaries,
        convPhone.trim() || undefined,
      );
      setConversionRequest(result);
      setShowConvForm(false);
      toast.success('Demande envoyée ! Le SuperAdmin va être notifié.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmittingConvReq(false);
    }
  };

  const fetchGroupSubsidiaries = async () => {
    setLoadingSubsidiaries(true);
    try {
      const ctx = await getMyGroupContext();
      setGroupSubsidiaries(ctx.subsidiaries || []);
    } catch {
      // silently ignore
    } finally {
      setLoadingSubsidiaries(false);
    }
  };

  const handleCreateSubsidiary = async () => {
    if (!newSubName.trim() || !newSubSlug.trim()) {
      toast.error('Le nom et l\'identifiant sont requis');
      return;
    }
    setCreatingSubsidiary(true);
    try {
      await createMySubsidiary(newSubName.trim(), newSubSlug.trim(), newSubEmail.trim() || undefined);
      toast.success(`Filiale "${newSubName}" créée avec succès !`);
      setShowSubsidiaryModal(false);
      setNewSubName('');
      setNewSubSlug('');
      setNewSubEmail('');
      fetchGroupSubsidiaries();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreatingSubsidiary(false);
    }
  };

  const tabs = [
    { id: 'general', name: 'Général', icon: Building2 },
    { id: 'certificates', name: 'Signatures & Cachets', icon: FileText },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Sécurité', icon: Shield },
    { id: 'integrations', name: 'Intégrations', icon: Link2 },
  ];

  if (loading) {
    return (
      <>
        <Header title="Paramètres" subtitle="Configuration de votre espace Targetym AI" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </main>
      </>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips
          tips={settingsTips}
          onDismiss={dismissTips}
          pageTitle="Paramètres"
        />
      )}
      
      <Header title="Paramètres" subtitle="Configuration de votre espace Targetym AI" />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-fit" data-tour="settings-tabs">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-3" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">

            {/* ============================== */}
            {/* ONGLET: GÉNÉRAL (ENTREPRISE)   */}
            {/* ============================== */}
            {activeTab === 'general' && (
              <>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Paramètres de l&apos;Entreprise</h3>
                <p className="text-sm text-gray-500 mb-6">Informations générales de votre organisation.</p>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l&apos;Entreprise</label>
                    <input
                      type="text"
                      value={tenantForm.name}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder="Nom de votre entreprise"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email de Contact</label>
                    <input
                      type="email"
                      value={tenantForm.email}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder="contact@votreentreprise.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={tenantForm.phone}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder="+221 xx xxx xx xx"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Devise par défaut</label>
                    <select
                      value={tenantForm.currency}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                    >
                      {currencies.length > 0 ? currencies.map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                      )) : (
                        <option value={tenantForm.currency}>{tenantForm.currency}</option>
                      )}
                    </select>
                    <p className="mt-1.5 text-xs text-gray-400">
                      Cette devise sera utilisée pour les statistiques salariales. Les salaires dans d&apos;autres devises seront convertis automatiquement.
                    </p>
                  </div>

                  {/* Infos en lecture seule */}
                  {tenantData && (
                    <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Identifiant (slug)</span>
                        <span className="font-medium text-gray-900">{tenantData.slug}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Plan</span>
                        <span className="font-medium text-gray-900 capitalize">{tenantData.plan}</span>
                      </div>
                      {tenantData.is_trial && tenantData.trial_ends_at && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Fin de l&apos;essai</span>
                          <span className="font-medium text-amber-600">
                            {new Date(tenantData.trial_ends_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Employés max</span>
                        <span className="font-medium text-gray-900">{tenantData.max_employees}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={saveTenantSettings}
                    disabled={savingTenant}
                    className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    {savingTenant ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
                    ) : savedTenant ? (
                      <><Check className="w-4 h-4 mr-2" /> Enregistré !</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Enregistrer</>
                    )}
                  </button>
                </div>
              </div>

              {/* ====== Section : Devenir un Groupe ====== */}
              {canRequestGroup && (
                <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1">Organisation Groupe</h4>
                      <p className="text-sm text-gray-500 mb-4">
                        Transformez votre entreprise en groupe pour gérer plusieurs filiales depuis un seul tableau de bord.
                      </p>

                      {loadingConvReq ? (
                        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                      ) : conversionRequest && (conversionRequest.status !== 'approved' || tenantData?.is_group) ? (
                        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                          conversionRequest.status === 'pending' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
                          (conversionRequest.status === 'approved' && tenantData?.is_group) ? 'bg-green-50 text-green-800 border border-green-200' :
                          'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                          {conversionRequest.status === 'pending' && '⏳ Demande en attente de validation'}
                          {conversionRequest.status === 'approved' && tenantData?.is_group && '✅ Demande approuvée — vous êtes maintenant un groupe'}
                          {conversionRequest.status === 'rejected' && `❌ Demande refusée${conversionRequest.review_note ? ` : ${conversionRequest.review_note}` : ''}`}
                        </div>
                      ) : showConvForm ? (
                        <div className="space-y-3">
                          {/* Nombre de filiales */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de filiales souhaitées <span className="text-red-500">*</span></label>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={convNbSubsidiaries}
                              onChange={e => setConvNbSubsidiaries(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          {/* Téléphone */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone de contact</label>
                            <input
                              type="tel"
                              value={convPhone}
                              onChange={e => setConvPhone(e.target.value)}
                              placeholder="Ex: +221 77 000 00 00"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          {/* Motif */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Motif <span className="text-gray-400">(optionnel)</span></label>
                            <textarea
                              value={convReason}
                              onChange={e => setConvReason(e.target.value)}
                              placeholder="Expliquez pourquoi vous souhaitez devenir un groupe..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            />
                          </div>
                          {/* Aperçu du prix */}
                          <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                            <p className="text-xs text-purple-700 font-medium mb-1">Estimation mensuelle</p>
                            <p className="text-xl font-bold text-purple-900">{formatXOF(calcGroupPrice(convNbSubsidiaries))}</p>
                            <p className="text-xs text-purple-600 mt-1">
                              Forfait groupe 100 000 XOF + {convNbSubsidiaries} filiale{convNbSubsidiaries > 1 ? 's' : ''} × 30 000 XOF/mois
                            </p>
                            <p className="text-xs text-purple-500 mt-1 italic">Le SuperAdmin vous contactera pour finaliser le paiement.</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSubmitConversionRequest}
                              disabled={submittingConvReq}
                              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                              {submittingConvReq ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                              Envoyer la demande
                            </button>
                            <button
                              onClick={() => setShowConvForm(false)}
                              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowConvForm(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Layers className="w-4 h-4" />
                          Demander à devenir un groupe
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ====== Section : Gérer mes filiales (si groupe approuvé) ====== */}
              {tenantData?.is_group === true && tenantData?.group_type === 'group' && (
                <div className="mt-4 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Mes filiales</h4>
                        <p className="text-xs text-gray-500">Gérez les entités de votre groupe</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { fetchGroupSubsidiaries(); setShowSubsidiaryModal(true); }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <span className="text-lg leading-none">+</span>
                      Ajouter une filiale
                    </button>
                  </div>

                  {loadingSubsidiaries ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    </div>
                  ) : groupSubsidiaries.length === 0 ? (
                    <div
                      className="text-center py-8 text-gray-400 cursor-pointer hover:text-indigo-500 transition-colors border-2 border-dashed border-gray-200 rounded-lg"
                      onClick={() => { fetchGroupSubsidiaries(); setShowSubsidiaryModal(true); }}
                    >
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Aucune filiale pour l&apos;instant.</p>
                      <p className="text-xs mt-1">Cliquez pour créer votre première filiale</p>
                    </div>
                  ) : (
                    <div
                      className="space-y-2"
                      onClick={() => {
                        if (groupSubsidiaries.length === 0) fetchGroupSubsidiaries();
                      }}
                    >
                      {groupSubsidiaries.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-3">
                            {sub.logo_url ? (
                              <img src={sub.logo_url} alt={sub.name} className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <span className="text-xs font-bold text-indigo-600">{sub.name.charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{sub.name}</p>
                              <p className="text-xs text-gray-500">{sub.slug} · {sub.employee_count} employé{sub.employee_count !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            sub.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {sub.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bouton refresh si pas encore chargé */}
                  {!loadingSubsidiaries && groupSubsidiaries.length === 0 && (
                    <button
                      onClick={fetchGroupSubsidiaries}
                      className="mt-3 text-xs text-indigo-500 hover:text-indigo-700 underline"
                    >
                      Charger mes filiales
                    </button>
                  )}
                </div>
              )}

              {/* Modal création filiale */}
              {showSubsidiaryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900">Créer une filiale</h3>
                      <button onClick={() => setShowSubsidiaryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la filiale <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={newSubName}
                          onChange={e => {
                            setNewSubName(e.target.value);
                            // Auto-générer le slug depuis le nom
                            const slug = e.target.value
                              .toLowerCase()
                              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/^-+|-+$/g, '');
                            setNewSubSlug(slug);
                          }}
                          placeholder="Ex: Filiale Dakar"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant unique (slug) <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={newSubSlug}
                          onChange={e => setNewSubSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          placeholder="Ex: filiale-dakar"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                        <p className="text-xs text-gray-400 mt-1">Lettres minuscules, chiffres et tirets uniquement</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email de contact <span className="text-gray-400">(optionnel)</span></label>
                        <input
                          type="email"
                          value={newSubEmail}
                          onChange={e => setNewSubEmail(e.target.value)}
                          placeholder="Ex: filiale@monentreprise.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 p-6 pt-0">
                      <button
                        onClick={() => setShowSubsidiaryModal(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleCreateSubsidiary}
                        disabled={creatingSubsidiary || !newSubName.trim() || !newSubSlug.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {creatingSubsidiary ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Créer la filiale
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </>
            )}

            {/* ============================== */}
            {/* ONGLET: CERTIFICATS            */}
            {/* ============================== */}
            {activeTab === 'certificates' && (
              <div className="space-y-6" data-tour="certificate-config">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Documents Visuels</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Ces éléments apparaîtront sur vos certificats de travail et autres documents officiels.
                  </p>
                  
                  {loadingCertSettings ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-4">
                      <FileUploadBox fileType="logo" label="Logo de l'entreprise" icon={ImageIcon} currentUrl={certificateSettings.certificate_logo} />
                      <FileUploadBox fileType="signature" label="Signature du signataire" icon={PenTool} currentUrl={certificateSettings.certificate_signature} />
                      <FileUploadBox fileType="stamp" label="Cachet de l'entreprise" icon={Stamp} currentUrl={certificateSettings.certificate_stamp} />
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Informations de l&apos;Entreprise</h3>
                  <p className="text-sm text-gray-500 mb-6">Ces informations apparaîtront dans l&apos;en-tête des certificats.</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nom officiel de l&apos;entreprise</label>
                      <input type="text" value={certificateSettings.certificate_company_name || ''}
                        onChange={(e) => setCertificateSettings(prev => ({ ...prev, certificate_company_name: e.target.value }))}
                        placeholder="Ex: TARGETYM SARL"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Adresse complète</label>
                      <textarea value={certificateSettings.certificate_company_address || ''}
                        onChange={(e) => setCertificateSettings(prev => ({ ...prev, certificate_company_address: e.target.value }))}
                        placeholder="Ex: 123 Avenue de la République" rows={2}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                      <input type="text" value={certificateSettings.certificate_company_city || ''}
                        onChange={(e) => setCertificateSettings(prev => ({ ...prev, certificate_company_city: e.target.value }))}
                        placeholder="Ex: Dakar"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Signataire Habilité</h3>
                  <p className="text-sm text-gray-500 mb-6">Personne autorisée à signer les certificats de travail.</p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet</label>
                      <input type="text" value={certificateSettings.certificate_signatory_name || ''}
                        onChange={(e) => setCertificateSettings(prev => ({ ...prev, certificate_signatory_name: e.target.value }))}
                        placeholder="Ex: Jean-Pierre DUPONT"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fonction</label>
                      <input type="text" value={certificateSettings.certificate_signatory_title || ''}
                        onChange={(e) => setCertificateSettings(prev => ({ ...prev, certificate_signatory_title: e.target.value }))}
                        placeholder="Ex: Directeur des Ressources Humaines"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                    <button onClick={saveCertificateSettings} disabled={savingCertSettings}
                      className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
                      {savingCertSettings ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
                      ) : saved ? (
                        <><Check className="w-4 h-4 mr-2" /> Enregistré !</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Enregistrer</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Conseil :</strong> Pour un rendu optimal, utilisez un logo avec fond transparent (PNG) 
                    et une signature scannée sur fond blanc. Le cachet doit être au format carré ou rond.
                  </p>
                </div>
              </div>
            )}

            {/* ============================== */}
            {/* ONGLET: NOTIFICATIONS           */}
            {/* ============================== */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Préférences de Notifications</h3>
                <p className="text-sm text-gray-500 mb-6">Choisissez les notifications que vous souhaitez recevoir pour chaque module.</p>

                {loadingNotifPrefs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {notifPrefs.map((pref) => (
                        <div key={pref.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                          <div>
                            <p className="font-medium text-gray-900">{pref.label}</p>
                            <p className="text-sm text-gray-500">{pref.description}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={pref.enabled} onChange={() => toggleNotifPref(pref.key)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={saveNotifPreferences}
                        disabled={savingNotifPrefs}
                        className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                      >
                        {savingNotifPrefs ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
                        ) : (
                          <><Save className="w-4 h-4 mr-2" /> Enregistrer</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ============================== */}
            {/* ONGLET: SÉCURITÉ               */}
            {/* ============================== */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentification à deux facteurs (2FA)</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Renforcez la sécurité de votre entreprise en exigeant une vérification via une application d&apos;authentification
                    (Google Authenticator, Authy, Microsoft Authenticator, etc.).
                  </p>

                  {loadingSecurity ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">Exiger la 2FA pour tous les collaborateurs</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Lorsque cette option est activée, chaque utilisateur devra scanner un QR code
                            avec son application d&apos;authentification lors de sa prochaine connexion.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-6">
                          <input
                            type="checkbox"
                            checked={securitySettings.require_2fa}
                            onChange={() => setSecuritySettings(prev => ({ ...prev, require_2fa: !prev.require_2fa }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                      </div>

                      {securitySettings.require_2fa && securitySettings.total_users > 0 && (
                        <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-xl">
                          <h4 className="font-semibold text-blue-900 mb-3">Adoption 2FA</h4>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="w-full h-3 bg-blue-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.round((securitySettings.users_with_2fa / securitySettings.total_users) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-blue-900 whitespace-nowrap">
                              {securitySettings.users_with_2fa}/{securitySettings.total_users} utilisateurs
                            </span>
                          </div>
                          <p className="text-xs text-blue-700 mt-2">
                            {securitySettings.users_with_2fa === securitySettings.total_users
                              ? 'Tous les utilisateurs ont configuré leur 2FA.'
                              : `${securitySettings.total_users - securitySettings.users_with_2fa} utilisateur(s) devront configurer leur 2FA à la prochaine connexion.`
                            }
                          </p>
                        </div>
                      )}

                      <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={saveSecuritySettings}
                          disabled={savingSecurity}
                          className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                        >
                          {savingSecurity ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
                          ) : (
                            <><Save className="w-4 h-4 mr-2" /> Enregistrer</>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Important :</strong> Les utilisateurs qui n&apos;ont pas encore configuré leur 2FA seront invités
                    à scanner un QR code lors de leur prochaine connexion. Assurez-vous de les prévenir au préalable.
                  </p>
                </div>
              </div>
            )}

            {/* ============================== */}
            {/* ONGLET: INTÉGRATIONS           */}
            {/* ============================== */}
            {activeTab === 'integrations' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100" data-tour="integrations">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Intégrations</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Connectez Targetym à vos autres outils pour automatiser vos flux RH.
                </p>

                {/* ── IntoWork ───────────────────────────────── */}
                <IntoWorkIntegrationSection />

                {/* ── Autres intégrations (Teams, Asana, Google...) ── */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-4">Autres intégrations</p>
                  {loadingIntegrations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {integrationsList.map((integration) => (
                        <div key={integration.id} className="border border-gray-200 rounded-xl p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg ${PROVIDER_COLORS[integration.id] || 'bg-gray-400'}`}>
                              {PROVIDER_LETTERS[integration.id] || integration.name[0]}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                              <p className="text-sm text-gray-500">{integration.description}</p>
                            </div>
                            {integration.connected && (
                              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                <Check className="w-3 h-3" /> Connecté
                              </span>
                            )}
                          </div>
                          {integration.connected ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSync(integration.id)}
                                disabled={syncingProvider === integration.id}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncingProvider === integration.id ? 'animate-spin' : ''}`} />
                                Synchroniser
                              </button>
                              <button
                                onClick={() => setConfirmDialog({
                                  isOpen: true,
                                  title: "Déconnecter l'intégration",
                                  message: `Voulez-vous vraiment déconnecter ${integration.name} ?`,
                                  onConfirm: () => { handleDisconnect(integration.id); setConfirmDialog(null); },
                                  danger: true,
                                })}
                                disabled={disconnectingProvider === integration.id}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                {disconnectingProvider === integration.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleConnect(integration.id)}
                              disabled={connectingProvider === integration.id}
                              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                              {connectingProvider === integration.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                              Connecter
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================== */}
            {/* ONGLET: ÉQUIPE                 */}
            {/* ============================== */}
          </div>
        </div>
      </main>
      
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
        />
      )}
    </>
  );
}
