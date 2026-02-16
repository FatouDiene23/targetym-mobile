'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, Edit2, Save, X, AlertCircle,
  Briefcase, MapPin, Phone, Mail, Building, CalendarDays,
  FileText, Download, Loader2, PenTool, Upload, Trash2, CheckCircle
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  employee_id?: number;
  is_active: boolean;
}

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  department_id?: number;
  department_name?: string;
  manager_id?: number;
  manager_name?: string;
  is_manager?: boolean;
  site?: string;
  hire_date?: string;
  status?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  nationality?: string;
}

interface SignatureData {
  employee_id: number;
  employee_name: string;
  has_signature: boolean;
  signature_url: string | null;
}

// ============================================
// API
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

function getAuthHeadersNoContentType(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement du profil');
  return response.json();
}

async function getEmployee(id: number): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Employé non trouvé');
  return response.json();
}

async function updateEmployeeProfile(id: number, data: Partial<Employee>): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur de mise à jour');
  return response.json();
}

async function getSignature(employeeId: number): Promise<SignatureData> {
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/signature`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement de la signature');
  return response.json();
}

async function uploadSignature(employeeId: number, file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/signature`, {
    method: 'POST',
    headers: getAuthHeadersNoContentType(),
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Erreur lors de l\'upload');
  }
  return response.json();
}

async function deleteSignature(employeeId: number): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/signature`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Erreur lors de la suppression');
  }
  return response.json();
}

// ============================================
// COMPONENT
// ============================================

export default function MyProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
  });
  
  // Signature
  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Certificat de travail
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const currentUser = await getCurrentUser();

      if (!currentUser.employee_id) {
        setError('Votre compte n\'est pas lié à un profil employé.');
        setLoading(false);
        return;
      }

      const emp = await getEmployee(currentUser.employee_id);
      setEmployee(emp);
      setFormData({
        phone: emp.phone || '',
        address: emp.address || '',
      });
      
      // Charger la signature
      try {
        const sig = await getSignature(currentUser.employee_id);
        setSignature(sig);
      } catch {
        // Pas de signature, c'est OK
        setSignature(null);
      }
    } catch (err) {
      console.error('Erreur de chargement:', err);
      setError('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      await updateEmployeeProfile(employee.id, formData);
      await loadData();
      setIsEditing(false);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setSaving(false);
    }
  };

  // Signature handlers
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    
    // Validation côté client
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setSignatureMessage({ type: 'error', text: 'Format non accepté. Utilisez PNG, JPEG ou WebP.' });
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      setSignatureMessage({ type: 'error', text: 'Fichier trop volumineux (max 2 MB).' });
      return;
    }
    
    setSignatureUploading(true);
    setSignatureMessage(null);
    
    try {
      await uploadSignature(employee.id, file);
      const sig = await getSignature(employee.id);
      setSignature(sig);
      setSignatureMessage({ type: 'success', text: 'Signature uploadée avec succès !' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'upload';
      setSignatureMessage({ type: 'error', text: message });
    } finally {
      setSignatureUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSignatureDelete = async () => {
    if (!employee) return;
    if (!confirm('Supprimer votre signature électronique ?')) return;
    
    setSignatureLoading(true);
    setSignatureMessage(null);
    
    try {
      await deleteSignature(employee.id);
      setSignature({ employee_id: employee.id, employee_name: `${employee.first_name} ${employee.last_name}`, has_signature: false, signature_url: null });
      setSignatureMessage({ type: 'success', text: 'Signature supprimée.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setSignatureMessage({ type: 'error', text: message });
    } finally {
      setSignatureLoading(false);
    }
  };

  // Auto-clear signature message after 4 seconds
  useEffect(() => {
    if (signatureMessage) {
      const timer = setTimeout(() => setSignatureMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [signatureMessage]);

  // Fonction pour générer le certificat de travail
  const generateWorkCertificate = async () => {
    setIsGeneratingCertificate(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/certificates/me/work-certificate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        alert(error.detail || 'Erreur lors de la génération du certificat');
        return;
      }
      
      // Télécharger le PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificat_travail_${employee?.last_name || 'employe'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Erreur de connexion');
    } finally {
      setIsGeneratingCertificate(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erreur</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mon Profil</h1>
          <p className="text-gray-500 mt-1">Consultez et modifiez vos informations personnelles</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              Informations personnelles
            </h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Edit2 className="w-4 h-4" />
                Modifier
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>

            {/* Info Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div>
                <p className="text-sm text-gray-500 mb-1">Nom complet</p>
                <p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Matricule</p>
                <p className="font-medium text-gray-900">{employee.employee_id}</p>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Poste</p>
                  <p className="font-medium text-gray-900">{employee.job_title || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Département</p>
                  <p className="font-medium text-gray-900">{employee.department_name || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{employee.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Téléphone</p>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ex: +221 77 123 45 67"
                    />
                  ) : (
                    <p className="font-medium text-gray-900">{employee.phone || '-'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Site</p>
                  <p className="font-medium text-gray-900">{employee.site || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Date d&apos;embauche</p>
                  <p className="font-medium text-gray-900">
                    {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>
              </div>

              {isEditing && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Adresse</p>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={2}
                    placeholder="Votre adresse..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Manager info */}
          {employee.manager_name && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500">Manager</p>
              <p className="font-medium text-gray-900">{employee.manager_name}</p>
            </div>
          )}

          {/* Status badges */}
          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              employee.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {employee.status === 'active' ? 'Actif' : employee.status}
            </span>
            {employee.is_manager && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                Manager
              </span>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION SIGNATURE ÉLECTRONIQUE */}
        {/* ============================================ */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-primary-600" />
            Signature électronique
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Votre signature sera utilisée sur les ordres de mission et autres documents officiels.
          </p>

          {/* Message de feedback */}
          {signatureMessage && (
            <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
              signatureMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {signatureMessage.type === 'success' 
                ? <CheckCircle className="w-4 h-4 shrink-0" /> 
                : <AlertCircle className="w-4 h-4 shrink-0" />
              }
              {signatureMessage.text}
            </div>
          )}

          {signature?.has_signature && signature.signature_url ? (
            /* Signature existante */
            <div>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 inline-block">
                <p className="text-xs text-gray-400 mb-2">Aperçu de votre signature :</p>
                <img 
                  src={signature.signature_url} 
                  alt="Ma signature" 
                  className="max-h-20 max-w-xs object-contain"
                />
              </div>
              <div className="mt-4 flex gap-3">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  {signatureUploading ? 'Upload...' : 'Remplacer'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSignatureUpload}
                    className="hidden"
                    disabled={signatureUploading}
                  />
                </label>
                <button
                  onClick={handleSignatureDelete}
                  disabled={signatureLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {signatureLoading ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          ) : (
            /* Pas de signature */
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <PenTool className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">Aucune signature enregistrée</p>
              <p className="text-xs text-gray-400 mb-4">
                Uploadez une image de votre signature manuscrite (PNG, JPEG ou WebP, max 2 MB)
              </p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium">
                {signatureUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Uploader ma signature
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSignatureUpload}
                  className="hidden"
                  disabled={signatureUploading}
                />
              </label>
            </div>
          )}
        </div>

        {/* Section Certificat de Travail */}
        {employee.status === 'active' && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Certificat de Travail
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Générez votre certificat de travail attestant de votre emploi actuel dans l&apos;entreprise.
              Ce document officiel peut être utilisé pour vos démarches administratives.
            </p>
            <button
              onClick={generateWorkCertificate}
              disabled={isGeneratingCertificate}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isGeneratingCertificate ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Télécharger mon certificat
                </>
              )}
            </button>
          </div>
        )}

        {/* Info notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note :</strong> Seules les informations de contact (téléphone, adresse) peuvent être modifiées. 
            Pour toute autre modification, veuillez contacter le service RH.
          </p>
        </div>
      </div>
    </div>
  );
}