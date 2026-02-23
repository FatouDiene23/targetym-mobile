'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Search, Filter, Download, Upload, Plus, Loader2, X,
  AlertTriangle, Clock, CheckCircle, Shield, Eye, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Users, TrendingUp,
  Calendar, BarChart3, Bell, ExternalLink, File
} from 'lucide-react';

// ============================================
// CONFIG
// ============================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}
function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return { Authorization: token ? `Bearer ${token}` : '' };
}

// ============================================
// TYPES
// ============================================
interface DocItem {
  id: number;
  document_type: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_date: string | null;
  expiry_date: string | null;
  visible_to_employee: boolean;
  is_confidential: boolean;
  uploaded_by_email: string | null;
  created_at: string;
  employee_id: number;
  employee_name: string;
  employee_job_title: string | null;
}

interface DocStats {
  total_documents: number;
  by_type: { type: string; count: number }[];
  expired: number;
  expiring_soon: number;
  total_employees: number;
  employees_no_docs: number;
  employees_no_contract: number;
  uploaded_this_month: number;
}

interface Alert {
  type: string;
  severity: string;
  title: string;
  message: string;
  employee_id: number;
  employee_name: string;
  document_id: number | null;
  document_type: string | null;
  date: string | null;
}

interface SimpleEmployee {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
}

// ============================================
// CONSTANTS
// ============================================
const DOC_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  contrat_travail: { label: 'Contrat de travail', icon: '📝' },
  avenant: { label: 'Avenant', icon: '📋' },
  cni: { label: 'CNI', icon: '🪪' },
  passeport: { label: 'Passeport', icon: '🛂' },
  diplome: { label: 'Diplôme', icon: '🎓' },
  cv: { label: 'CV', icon: '📄' },
  attestation_employeur: { label: 'Attestation', icon: '📑' },
  fiche_paie: { label: 'Fiche de paie', icon: '💰' },
  certificat_travail: { label: 'Certificat de travail', icon: '🏅' },
  rib: { label: 'RIB', icon: '🏦' },
  carte_vitale: { label: 'Assurance santé', icon: '🏥' },
  permis_conduire: { label: 'Permis de conduire', icon: '🚗' },
  photo_identite: { label: 'Photo d\'identité', icon: '📸' },
  certificat_residence: { label: 'Certificat de résidence', icon: '🏠' },
  autre: { label: 'Autre', icon: '📁' },
};

const ALL_DOC_TYPES = Object.entries(DOC_TYPE_MAP).map(([value, info]) => ({
  value, ...info
}));

function getDocInfo(type: string) {
  return DOC_TYPE_MAP[type] || { label: 'Autre', icon: '📁' };
}
function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}
function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ============================================
// COMPONENT
// ============================================
interface HRDocumentsTabProps {
  onOpenEmployeeProfile?: (employeeId: number) => void;
}

export default function HRDocumentsTab({ onOpenEmployeeProfile }: HRDocumentsTabProps) {
  // Data
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [stats, setStats] = useState<DocStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployee[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'documents' | 'alerts'>('documents');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);
  const [expiredFilter, setExpiredFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadEmployeeId, setUploadEmployeeId] = useState<number | null>(null);
  const [uploadType, setUploadType] = useState('contrat_travail');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadDocDate, setUploadDocDate] = useState('');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadVisible, setUploadVisible] = useState(true);
  const [uploadConfidential, setUploadConfidential] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchDocuments = useCallback(async (p = 1) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: '30' });
      if (typeFilter !== 'all') params.append('document_type', typeFilter);
      if (employeeFilter) params.append('employee_id', String(employeeFilter));
      if (searchTerm) params.append('search', searchTerm);
      if (expiredFilter) params.append('expired_only', 'true');

      const res = await fetch(`${API_URL}/api/documents/all?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.items || []);
        setTotalPages(data.total_pages || 1);
        setTotalDocs(data.total || 0);
        setPage(p);
      }
    } catch (e) {
      console.error('Error fetching documents:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [typeFilter, employeeFilter, searchTerm, expiredFilter]);

  async function fetchStats() {
    try {
      const res = await fetch(`${API_URL}/api/documents/stats`, { headers: getAuthHeaders() });
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error('Stats error:', e);
    }
  }

  async function fetchAlerts() {
    try {
      const res = await fetch(`${API_URL}/api/documents/alerts`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error('Alerts error:', e);
    }
  }

  async function fetchEmployees() {
    try {
      const res = await fetch(`${API_URL}/api/employees/?page=1&page_size=500`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEmployees((data.items || []).map((e: any) => ({
          id: e.id,
          first_name: e.first_name,
          last_name: e.last_name,
          job_title: e.position || e.job_title,
          department_name: e.department_name,
        })));
      }
    } catch (e) {
      console.error('Employees error:', e);
    }
  }

  useEffect(() => {
    fetchStats();
    fetchAlerts();
    fetchEmployees();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchDocuments(1), 300);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  // ============================================
  // HANDLERS
  // ============================================
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    setUploadFile(file);
    setUploadError('');
    // Auto-fill title if empty
    if (!uploadTitle) {
      const docInfo = getDocInfo(uploadType);
      const selectedEmp = employees.find(e => e.id === uploadEmployeeId);
      if (selectedEmp) {
        setUploadTitle(`${docInfo.label} — ${selectedEmp.first_name} ${selectedEmp.last_name}`);
      }
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadTitle || !uploadType || !uploadEmployeeId) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('employee_id', String(uploadEmployeeId));
      formData.append('document_type', uploadType);
      formData.append('title', uploadTitle);
      if (uploadDesc) formData.append('description', uploadDesc);
      if (uploadDocDate) formData.append('document_date', uploadDocDate);
      if (uploadExpiry) formData.append('expiry_date', uploadExpiry);
      formData.append('visible_to_employee', String(uploadVisible));
      formData.append('is_confidential', String(uploadConfidential));

      const res = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur upload');
      }

      const selectedEmp = employees.find(e => e.id === uploadEmployeeId);
      setUploadSuccess(`Document ajouté au dossier de ${selectedEmp?.first_name} ${selectedEmp?.last_name}`);

      // Reset form but keep employee for batch uploads
      setUploadFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadDocDate('');
      setUploadExpiry('');
      setUploadType('contrat_travail');
      setUploadVisible(true);
      setUploadConfidential(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchDocuments(1);
      fetchStats();
      setTimeout(() => setUploadSuccess(''), 3000);
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: DocItem) {
    setDownloading(doc.id);
    try {
      const res = await fetch(`${API_URL}/api/documents/download/${doc.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.file_data) {
          const byteCharacters = atob(data.file_data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mime_type || 'application/octet-stream' });
          const url = window.URL.createObjectURL(blob);
          const a = window.document.createElement('a');
          a.href = url;
          a.download = data.file_name || 'document';
          window.document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        }
      }
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(doc: DocItem) {
    if (!confirm(`Supprimer "${doc.title}" du dossier de ${doc.employee_name} ?`)) return;
    setDeleting(doc.id);
    try {
      const res = await fetch(`${API_URL}/api/documents/${doc.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchDocuments(page);
        fetchStats();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Erreur');
      }
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeleting(null);
    }
  }

  function resetFilters() {
    setSearchTerm('');
    setTypeFilter('all');
    setEmployeeFilter(null);
    setExpiredFilter(false);
  }

  const hasFilters = searchTerm || typeFilter !== 'all' || employeeFilter || expiredFilter;

  const filteredEmployeesForDropdown = employees.filter(e => {
    if (!employeeSearch) return true;
    const s = employeeSearch.toLowerCase();
    return `${e.first_name} ${e.last_name}`.toLowerCase().includes(s)
      || (e.job_title || '').toLowerCase().includes(s)
      || (e.department_name || '').toLowerCase().includes(s);
  });

  const alertCounts = {
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <FileText className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats.total_documents}</p>
            <p className="text-xs text-gray-500">Documents</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.uploaded_this_month}</p>
            <p className="text-xs text-gray-500">Ce mois</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <Users className="w-5 h-5 text-purple-500 mb-2" />
            <p className="text-2xl font-bold text-purple-600">{stats.total_employees}</p>
            <p className="text-xs text-gray-500">Employés actifs</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-red-200" onClick={() => setExpiredFilter(true)}>
            <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            <p className="text-xs text-gray-500">Expirés</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <Clock className="w-5 h-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold text-orange-600">{stats.expiring_soon}</p>
            <p className="text-xs text-gray-500">Expirent bientôt</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <File className="w-5 h-5 text-red-500 mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats.employees_no_contract}</p>
            <p className="text-xs text-gray-500">Sans contrat</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <Users className="w-5 h-5 text-gray-400 mb-2" />
            <p className="text-2xl font-bold text-gray-500">{stats.employees_no_docs}</p>
            <p className="text-xs text-gray-500">Dossiers vides</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <BarChart3 className="w-5 h-5 text-indigo-500 mb-2" />
            <p className="text-2xl font-bold text-indigo-600">
              {stats.total_employees > 0
                ? Math.round(((stats.total_employees - stats.employees_no_docs) / stats.total_employees) * 100)
                : 0}%
            </p>
            <p className="text-xs text-gray-500">Complétude</p>
          </div>
        </div>
      )}

      {/* Alerts Banner */}
      {alerts.length > 0 && showAlerts && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-gray-900">
                Alertes ({alerts.length})
              </h3>
              {alertCounts.high > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  {alertCounts.high} urgente{alertCounts.high > 1 ? 's' : ''}
                </span>
              )}
              {alertCounts.medium > 0 && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                  {alertCounts.medium} attention
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSubTab('alerts')}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Voir tout
              </button>
              <button onClick={() => setShowAlerts(false)} className="p-1 hover:bg-red-100 rounded">
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {alerts.slice(0, 4).map((alert, i) => (
              <div
                key={i}
                onClick={() => onOpenEmployeeProfile?.(alert.employee_id)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  alert.severity === 'high'
                    ? 'bg-red-100 hover:bg-red-200'
                    : 'bg-orange-100 hover:bg-orange-200'
                }`}
              >
                <p className="text-xs font-medium text-gray-900">{alert.title}</p>
                <p className="text-[11px] text-gray-600">{alert.employee_name}</p>
                {alert.date && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(alert.date)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tabs: Documents / Alertes */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveSubTab('documents')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeSubTab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Documents ({totalDocs})
          </button>
          <button
            onClick={() => setActiveSubTab('alerts')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeSubTab === 'alerts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Alertes
            {alerts.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{alerts.length}</span>
            )}
          </button>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Ajouter un document
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload rapide
            </h4>
            <button onClick={() => { setShowUpload(false); setUploadError(''); setUploadSuccess(''); }}>
              <X className="w-5 h-5 text-blue-400 hover:text-blue-600" />
            </button>
          </div>

          {uploadError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{uploadError}</p>}
          {uploadSuccess && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {uploadSuccess}
            </p>
          )}

          {/* Employee selector */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-700 mb-1 block">Employé *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={e => { setEmployeeSearch(e.target.value); setShowEmployeeDropdown(true); }}
                onFocus={() => setShowEmployeeDropdown(true)}
                placeholder="Rechercher un employé..."
                className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
              {uploadEmployeeId && (
                <button
                  onClick={() => { setUploadEmployeeId(null); setEmployeeSearch(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
            {showEmployeeDropdown && !uploadEmployeeId && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredEmployeesForDropdown.slice(0, 20).map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setUploadEmployeeId(emp.id);
                      setEmployeeSearch(`${emp.first_name} ${emp.last_name}`);
                      setShowEmployeeDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</span>
                      {emp.job_title && <span className="text-gray-500 ml-2">— {emp.job_title}</span>}
                    </div>
                    {emp.department_name && (
                      <span className="text-xs text-gray-400">{emp.department_name}</span>
                    )}
                  </button>
                ))}
                {filteredEmployeesForDropdown.length === 0 && (
                  <p className="px-4 py-3 text-sm text-gray-500">Aucun employé trouvé</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Type de document *</label>
              <select
                value={uploadType}
                onChange={e => setUploadType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
              >
                {ALL_DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Titre *</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="Ex: Contrat CDI Janvier 2026"
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
              <input
                type="text"
                value={uploadDesc}
                onChange={e => setUploadDesc(e.target.value)}
                placeholder="Notes optionnelles..."
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Date du document</label>
              <input type="date" value={uploadDocDate} onChange={e => setUploadDocDate(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Date d&apos;expiration</label>
              <input type="date" value={uploadExpiry} onChange={e => setUploadExpiry(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2.5">
                <input type="checkbox" checked={uploadVisible} onChange={e => setUploadVisible(e.target.checked)} className="rounded" />
                Visible employé
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2.5">
                <input type="checkbox" checked={uploadConfidential} onChange={e => setUploadConfidential(e.target.checked)} className="rounded" />
                <Shield className="w-3.5 h-3.5 text-gray-400" />
                Confidentiel
              </label>
            </div>
            <div className="flex items-end justify-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border rounded-lg ${uploadFile ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
              >
                {uploadFile ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span className="truncate max-w-[120px]">{uploadFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Fichier
                  </>
                )}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" />
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadTitle || !uploadEmployeeId}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Upload...' : 'Uploader'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* SUB-TAB: DOCUMENTS */}
      {/* ============================================ */}
      {activeSubTab === 'documents' && (
        <>
          {/* Search & Filters */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Rechercher par titre, nom d'employé ou fichier..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm"
                />
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Tous les types</option>
                {ALL_DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
              <select
                value={employeeFilter ? String(employeeFilter) : ''}
                onChange={e => setEmployeeFilter(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm max-w-[200px]"
              >
                <option value="">Tous les employés</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={expiredFilter} onChange={e => setExpiredFilter(e.target.checked)} className="rounded" />
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Expirés
              </label>
              {hasFilters && (
                <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                  Effacer
                </button>
              )}
              <button onClick={() => { fetchDocuments(1); fetchStats(); fetchAlerts(); }} className="flex items-center gap-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-2">Aucun document trouvé</p>
                {hasFilters && (
                  <button onClick={resetFilters} className="text-sm text-blue-600 hover:text-blue-800">
                    Effacer les filtres
                  </button>
                )}
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Document</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Employé</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Expiration</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {documents.map(doc => {
                      const info = getDocInfo(doc.document_type);
                      const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                      const expiresSoon = doc.expiry_date && !isExpired && daysUntil(doc.expiry_date) <= 30;

                      return (
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg flex-shrink-0">{info.icon}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{doc.title}</p>
                                <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{doc.file_name} {doc.file_size ? `• ${formatSize(doc.file_size)}` : ''}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => onOpenEmployeeProfile?.(doc.employee_id)}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {doc.employee_name}
                            </button>
                            {doc.employee_job_title && (
                              <p className="text-[11px] text-gray-400">{doc.employee_job_title}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">{info.label}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(doc.created_at)}</td>
                          <td className="px-4 py-3">
                            {doc.expiry_date ? (
                              <span className={`text-sm ${isExpired ? 'text-red-600 font-medium' : expiresSoon ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                                {formatDate(doc.expiry_date)}
                                {isExpired && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                                {expiresSoon && <Clock className="w-3 h-3 inline ml-1" />}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {doc.is_confidential && (
                                <span title="Confidentiel" className="p-1"><Shield className="w-3.5 h-3.5 text-orange-500" /></span>
                              )}
                              {!doc.visible_to_employee && (
                                <span title="Non visible par l'employé" className="p-1"><Eye className="w-3.5 h-3.5 text-gray-400" /></span>
                              )}
                              {doc.visible_to_employee && !doc.is_confidential && (
                                <span className="text-xs text-green-600">✓ Visible</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDownload(doc)}
                                disabled={downloading === doc.id}
                                className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                                title="Télécharger"
                              >
                                {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => onOpenEmployeeProfile?.(doc.employee_id)}
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                                title="Voir le dossier"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(doc)}
                                disabled={deleting === doc.id}
                                className="p-1.5 hover:bg-red-100 rounded text-red-500"
                                title="Supprimer"
                              >
                                {deleting === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Page {page}/{totalPages} • {totalDocs} documents
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchDocuments(page - 1)}
                        disabled={page <= 1}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                      >
                        Précédent
                      </button>
                      <button
                        onClick={() => fetchDocuments(page + 1)}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Distribution par type */}
          {stats && stats.by_type.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Répartition par type
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {stats.by_type.map(item => {
                  const info = getDocInfo(item.type);
                  return (
                    <button
                      key={item.type}
                      onClick={() => setTypeFilter(item.type)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                        typeFilter === item.type
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-sm">{info.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-600 truncate">{info.label}</p>
                        <p className="text-sm font-bold text-gray-900">{item.count}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================ */}
      {/* SUB-TAB: ALERTS */}
      {/* ============================================ */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Toutes les alertes ({alerts.length})
              </h3>
              <button
                onClick={fetchAlerts}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-300" />
                <p className="text-gray-500">Aucune alerte — tous les dossiers sont en ordre !</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between"
                    onClick={() => onOpenEmployeeProfile?.(alert.employee_id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        alert.severity === 'high' ? 'bg-red-100' : 'bg-orange-100'
                      }`}>
                        {alert.type === 'expired' && <AlertTriangle className="w-5 h-5 text-red-600" />}
                        {alert.type === 'expiring_soon' && <Clock className="w-5 h-5 text-orange-600" />}
                        {alert.type === 'missing_contract' && <FileText className="w-5 h-5 text-red-600" />}
                        {alert.type === 'no_documents' && <File className="w-5 h-5 text-orange-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                        <p className="text-sm text-gray-500">{alert.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {alert.severity === 'high' ? 'Urgent' : 'Attention'}
                      </span>
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close employee dropdown */}
      {showEmployeeDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setShowEmployeeDropdown(false)} />
      )}
    </div>
  );
}
