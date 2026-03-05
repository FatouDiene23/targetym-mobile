'use client';

import Header from '@/components/Header';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  Building2,
  Bell, 
  Shield, 
  Link2,
  Users,
  CreditCard,
  Save,
  Check,
  FileText,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Stamp,
  PenTool
} from 'lucide-react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { settingsTips } from '@/config/pageTips';
import ConfirmDialog from '@/components/ConfirmDialog';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

const integrations = [
  { id: 'slack', name: 'Slack', description: 'Notifications et alertes', connected: true, icon: '💬' },
  { id: 'teams', name: 'Microsoft Teams', description: 'Communication d\'équipe', connected: false, icon: '👥' },
  { id: 'asana', name: 'Asana', description: 'Gestion de projets', connected: true, icon: '📋' },
  { id: 'notion', name: 'Notion', description: 'Documentation', connected: false, icon: '📝' },
  { id: 'zoho', name: 'Zoho CRM', description: 'Gestion clients', connected: false, icon: '🎯' },
  { id: 'google', name: 'Google Workspace', description: 'Suite Google', connected: true, icon: '🔷' },
];

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
  });
  
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

  // ============================================
  // CHARGEMENT DES DONNÉES
  // ============================================

  useEffect(() => {
    loadUserAndTenant();
  }, []);

  async function loadUserAndTenant() {
    setLoading(true);
    try {
      // Charger les paramètres tenant
      const tenantRes = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
      if (tenantRes.ok) {
        const tenant = await tenantRes.json();
        setTenantData(tenant);
        setTenantForm({
          name: tenant.name || '',
          email: tenant.email || '',
          phone: tenant.phone || '',
        });
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
  }, [activeTab, loadCertificateSettings, loadNotifPreferences, loadSecuritySettings]);

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

  const tabs = [
    { id: 'general', name: 'Général', icon: Building2 },
    { id: 'certificates', name: 'Signatures & Cachets', icon: FileText },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Sécurité', icon: Shield },
    { id: 'integrations', name: 'Intégrations', icon: Link2 },
    { id: 'team', name: 'Équipe', icon: Users },
    { id: 'billing', name: 'Facturation', icon: CreditCard },
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
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Intégrations</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {integrations.map((integration) => (
                    <div key={integration.id} className="border border-gray-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{integration.icon}</span>
                          <div>
                            <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                            <p className="text-sm text-gray-500">{integration.description}</p>
                          </div>
                        </div>
                      </div>
                      <button className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                        integration.connected ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                        {integration.connected ? '✓ Connecté' : 'Connecter'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============================== */}
            {/* ONGLET: ÉQUIPE                 */}
            {/* ============================== */}
            {activeTab === 'team' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Gestion de l&apos;Équipe</h3>
                  <button className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                    + Inviter un membre
                  </button>
                </div>
                <p className="text-sm text-gray-500">La gestion de l&apos;équipe se fait depuis le module Gestion du Personnel.</p>
              </div>
            )}

            {/* ============================== */}
            {/* ONGLET: FACTURATION            */}
            {/* ============================== */}
            {activeTab === 'billing' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Facturation</h3>
                
                <div className="p-6 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-white mb-6">
                  <p className="text-primary-100 text-sm">Plan actuel</p>
                  <h4 className="text-2xl font-bold mt-1 capitalize">{tenantData?.plan || 'Trial'}</h4>
                  <p className="text-primary-100 mt-2">
                    Jusqu&apos;à {tenantData?.max_employees || 10} employés
                    {tenantData?.is_trial && ' • Période d\'essai'}
                  </p>
                  <button className="mt-4 px-4 py-2 bg-white text-primary-600 text-sm font-medium rounded-lg hover:bg-gray-100">
                    Changer de plan
                  </button>
                </div>
              </div>
            )}
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