'use client';

import Header from '@/components/Header';
import { useState, useEffect, useCallback } from 'react';
import { 
  User, 
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

const teamMembers = [
  { id: 1, name: 'Marie Reine', email: 'marie@targetym.ai', role: 'Super Admin', status: 'active' },
  { id: 2, name: 'Jean Martin', email: 'jean@targetym.ai', role: 'Admin RH', status: 'active' },
  { id: 3, name: 'Sophie Bernard', email: 'sophie@targetym.ai', role: 'Manager', status: 'active' },
  { id: 4, name: 'Pierre Leroy', email: 'pierre@targetym.ai', role: 'Recruteur', status: 'pending' },
];

// Types pour les paramètres de certificat
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

  // Charger les paramètres de certificat
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

  useEffect(() => {
    if (activeTab === 'certificates') {
      loadCertificateSettings();
    }
  }, [activeTab, loadCertificateSettings]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Sauvegarder les paramètres de certificat (texte)
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
        alert('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur de connexion');
    } finally {
      setSavingCertSettings(false);
    }
  };

  // Upload d'un fichier (logo, signature, cachet)
  const handleFileUpload = async (fileType: 'logo' | 'signature' | 'stamp', file: File) => {
    setUploadingFile(fileType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/settings/certificate/upload/${fileType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
        alert(error.detail || 'Erreur lors de l\'upload');
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur de connexion');
    } finally {
      setUploadingFile(null);
    }
  };

  // Supprimer un fichier
  const handleFileDelete = async (fileType: 'logo' | 'signature' | 'stamp') => {
    if (!confirm(`Supprimer ${fileType === 'logo' ? 'le logo' : fileType === 'signature' ? 'la signature' : 'le cachet'} ?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/settings/certificate/upload/${fileType}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        setCertificateSettings(prev => ({
          ...prev,
          [`certificate_${fileType}`]: null,
        }));
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  // Composant pour upload de fichier
  const FileUploadBox = ({ 
    fileType, 
    label, 
    icon: Icon,
    currentUrl 
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
              <img 
                src={`${API_URL}${currentUrl}`} 
                alt={label}
                className="max-h-24 mx-auto object-contain rounded-lg"
              />
              <button
                onClick={() => handleFileDelete(fileType)}
                className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
              >
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
            isUploading 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
          }`}>
            {isUploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Upload...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {currentUrl ? 'Changer' : 'Uploader'}
              </span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(fileType, file);
              }}
            />
          </label>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'general', name: 'Général', icon: Building2 },
    { id: 'profile', name: 'Mon Profil', icon: User },
    { id: 'certificates', name: 'Certificats', icon: FileText },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Sécurité', icon: Shield },
    { id: 'integrations', name: 'Intégrations', icon: Link2 },
    { id: 'team', name: 'Équipe', icon: Users },
    { id: 'billing', name: 'Facturation', icon: CreditCard },
  ];

  return (
    <>
      <Header title="Paramètres" subtitle="Configuration de votre espace Targetym AI" />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-fit">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50'
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
            {activeTab === 'general' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres Généraux</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de l&apos;Entreprise
                    </label>
                    <input
                      type="text"
                      defaultValue="Ma Société SAS"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email de Contact
                    </label>
                    <input
                      type="email"
                      defaultValue="contact@masociete.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fuseau Horaire
                    </label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                      <option>Europe/Paris (UTC+1)</option>
                      <option>Africa/Dakar (UTC+0)</option>
                      <option>America/New_York (UTC-5)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Langue
                    </label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                      <option>Français</option>
                      <option>English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Année Fiscale
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                        <option>Janvier</option>
                        <option>Avril</option>
                        <option>Juillet</option>
                        <option>Octobre</option>
                      </select>
                      <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                        <option>Décembre</option>
                        <option>Mars</option>
                        <option>Juin</option>
                        <option>Septembre</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={handleSave}
                    className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {saved ? 'Enregistré !' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Mon Profil</h3>
                
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold">
                    MR
                  </div>
                  <div className="ml-6">
                    <button className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                      Changer la photo
                    </button>
                    <p className="text-sm text-gray-500 mt-2">JPG, PNG. Max 2MB</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                    <input
                      type="text"
                      defaultValue="Marie"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                    <input
                      type="text"
                      defaultValue="Reine"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue="marie.reine@company.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      defaultValue="+221 77 123 45 67"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={handleSave}
                    className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"
                  >
                    {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {saved ? 'Enregistré !' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}

            {/* NOUVEL ONGLET: Certificats */}
            {activeTab === 'certificates' && (
              <div className="space-y-6">
                {/* Section Documents visuels */}
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
                      <FileUploadBox 
                        fileType="logo" 
                        label="Logo de l'entreprise" 
                        icon={ImageIcon}
                        currentUrl={certificateSettings.certificate_logo}
                      />
                      <FileUploadBox 
                        fileType="signature" 
                        label="Signature du signataire" 
                        icon={PenTool}
                        currentUrl={certificateSettings.certificate_signature}
                      />
                      <FileUploadBox 
                        fileType="stamp" 
                        label="Cachet de l'entreprise" 
                        icon={Stamp}
                        currentUrl={certificateSettings.certificate_stamp}
                      />
                    </div>
                  )}
                </div>

                {/* Section Informations entreprise */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Informations de l&apos;Entreprise</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Ces informations apparaîtront dans l&apos;en-tête des certificats.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nom officiel de l&apos;entreprise
                      </label>
                      <input
                        type="text"
                        value={certificateSettings.certificate_company_name || ''}
                        onChange={(e) => setCertificateSettings(prev => ({
                          ...prev,
                          certificate_company_name: e.target.value
                        }))}
                        placeholder="Ex: TARGETYM SARL"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adresse complète
                      </label>
                      <textarea
                        value={certificateSettings.certificate_company_address || ''}
                        onChange={(e) => setCertificateSettings(prev => ({
                          ...prev,
                          certificate_company_address: e.target.value
                        }))}
                        placeholder="Ex: 123 Avenue de la République, Immeuble XYZ, 3ème étage"
                        rows={2}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ville
                      </label>
                      <input
                        type="text"
                        value={certificateSettings.certificate_company_city || ''}
                        onChange={(e) => setCertificateSettings(prev => ({
                          ...prev,
                          certificate_company_city: e.target.value
                        }))}
                        placeholder="Ex: Dakar"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section Signataire habilité */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Signataire Habilité</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Personne autorisée à signer les certificats de travail.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        value={certificateSettings.certificate_signatory_name || ''}
                        onChange={(e) => setCertificateSettings(prev => ({
                          ...prev,
                          certificate_signatory_name: e.target.value
                        }))}
                        placeholder="Ex: Jean-Pierre DUPONT"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fonction
                      </label>
                      <input
                        type="text"
                        value={certificateSettings.certificate_signatory_title || ''}
                        onChange={(e) => setCertificateSettings(prev => ({
                          ...prev,
                          certificate_signatory_title: e.target.value
                        }))}
                        placeholder="Ex: Directeur des Ressources Humaines"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                    <button 
                      onClick={saveCertificateSettings}
                      disabled={savingCertSettings}
                      className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                    >
                      {savingCertSettings ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : saved ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Enregistré !
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Note informative */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Conseil :</strong> Pour un rendu optimal, utilisez un logo avec fond transparent (PNG) 
                    et une signature scannée sur fond blanc. Le cachet doit être au format carré ou rond.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Préférences de Notifications</h3>
                
                <div className="space-y-6">
                  {[
                    { title: 'Nouvelles candidatures', description: 'Recevoir une alerte pour chaque nouvelle candidature' },
                    { title: 'Évaluations en attente', description: 'Rappel pour les évaluations à compléter' },
                    { title: 'Objectifs OKR', description: 'Mises à jour sur les objectifs de l\'équipe' },
                    { title: 'Alertes IA', description: 'Insights et recommandations de l\'IA' },
                    { title: 'Rapports hebdomadaires', description: 'Résumé hebdomadaire par email' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked={index < 3} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
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
                        integration.connected
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                        {integration.connected ? '✓ Connecté' : 'Connecter'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Gestion de l&apos;Équipe</h3>
                  <button className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                    + Inviter un membre
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Membre</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Rôle</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Statut</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => (
                        <tr key={member.id} className="border-t border-gray-100">
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="ml-3">
                                <p className="font-medium text-gray-900">{member.name}</p>
                                <p className="text-sm text-gray-500">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                              <option selected={member.role === 'Super Admin'}>Super Admin</option>
                              <option selected={member.role === 'Admin RH'}>Admin RH</option>
                              <option selected={member.role === 'Manager'}>Manager</option>
                              <option selected={member.role === 'Recruteur'}>Recruteur</option>
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              member.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {member.status === 'active' ? 'Actif' : 'En attente'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                              Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Sécurité</h3>
                
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Changer le mot de passe</h4>
                    <div className="space-y-3">
                      <input
                        type="password"
                        placeholder="Mot de passe actuel"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="password"
                        placeholder="Nouveau mot de passe"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="password"
                        placeholder="Confirmer le nouveau mot de passe"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      />
                      <button className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                        Mettre à jour
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Authentification à deux facteurs</h4>
                      <p className="text-sm text-gray-500">Ajoutez une couche de sécurité supplémentaire</p>
                    </div>
                    <button className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600">
                      Activée
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Sessions actives</h4>
                      <p className="text-sm text-gray-500">Gérez vos appareils connectés</p>
                    </div>
                    <button className="text-sm text-primary-600 font-medium hover:text-primary-700">
                      Voir tout
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Facturation</h3>
                
                <div className="p-6 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-white mb-6">
                  <p className="text-primary-100 text-sm">Plan actuel</p>
                  <h4 className="text-2xl font-bold mt-1">Entreprise</h4>
                  <p className="text-primary-100 mt-2">125€/mois • Jusqu&apos;à 1 000 employés</p>
                  <button className="mt-4 px-4 py-2 bg-white text-primary-600 text-sm font-medium rounded-lg hover:bg-gray-100">
                    Changer de plan
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Historique des factures</h4>
                  {[
                    { date: 'Dec 2024', amount: '125€', status: 'Payée' },
                    { date: 'Nov 2024', amount: '125€', status: 'Payée' },
                    { date: 'Oct 2024', amount: '125€', status: 'Payée' },
                  ].map((invoice, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{invoice.date}</p>
                        <p className="text-sm text-gray-500">{invoice.amount}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          {invoice.status}
                        </span>
                        <button className="text-sm text-primary-600 font-medium hover:text-primary-700">
                          Télécharger
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}