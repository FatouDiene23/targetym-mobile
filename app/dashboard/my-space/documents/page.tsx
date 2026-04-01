'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { documentsTips } from '@/config/pageTips';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  FileText, Download, Eye, Search, Filter, Loader2, Calendar,
  Clock, AlertTriangle, ChevronLeft, ChevronRight, File,
  FileSpreadsheet, Image, Shield, X, Award, ExternalLink, Upload, Plus, Trash2
} from 'lucide-react';

// ============================================
// CONFIG
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Document {
  id: number;
  document_type: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

interface DownloadRecord {
  id: number;
  document_type: string;
  document_title: string;
  file_name: string;
  downloaded_at: string;
}

const DOC_TYPE_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  contrat_travail: { label: 'Contrat de travail', icon: '📝', color: 'text-blue-600', bg: 'bg-blue-50' },
  avenant: { label: 'Avenant', icon: '📋', color: 'text-blue-500', bg: 'bg-blue-50' },
  cni: { label: 'CNI', icon: '🪪', color: 'text-purple-600', bg: 'bg-purple-50' },
  passeport: { label: 'Passeport', icon: '🛂', color: 'text-purple-500', bg: 'bg-purple-50' },
  diplome: { label: 'Diplôme', icon: '🎓', color: 'text-green-600', bg: 'bg-green-50' },
  cv: { label: 'CV', icon: '📄', color: 'text-gray-600', bg: 'bg-gray-50' },
  lettre_motivation: { label: 'Lettre de motivation', icon: '✉️', color: 'text-gray-500', bg: 'bg-gray-50' },
  attestation_employeur: { label: 'Attestation', icon: '📑', color: 'text-orange-600', bg: 'bg-orange-50' },
  fiche_paie: { label: 'Fiche de paie', icon: '💰', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  certificat_travail: { label: 'Certificat de travail', icon: '🏅', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  rib: { label: 'RIB', icon: '🏦', color: 'text-teal-600', bg: 'bg-teal-50' },
  carte_vitale: { label: 'Assurance santé', icon: '🏥', color: 'text-red-600', bg: 'bg-red-50' },
  permis_conduire: { label: 'Permis de conduire', icon: '🚗', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  photo_identite: { label: 'Photo d\'identité', icon: '📸', color: 'text-pink-600', bg: 'bg-pink-50' },
  certificat_residence: { label: 'Certificat de résidence', icon: '🏠', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  autre: { label: 'Autre', icon: '📁', color: 'text-gray-600', bg: 'bg-gray-50' },
};

function getDocStyle(type: string) {
  return DOC_TYPE_MAP[type] || DOC_TYPE_MAP.autre;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // 30 jours
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('image')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  return File;
}

// ============================================
// PAGE
// ============================================

export default function MyDocumentsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'documents' | 'history'>('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('cni');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('documents');

  const EMPLOYEE_TYPES = [
    { value: 'cni', label: 'Carte nationale d\'identité', icon: '🪪' },
    { value: 'passeport', label: 'Passeport', icon: '🛂' },
    { value: 'diplome', label: 'Diplôme', icon: '🎓' },
    { value: 'cv', label: 'CV', icon: '📄' },
    { value: 'photo_identite', label: 'Photo d\'identité', icon: '📸' },
    { value: 'rib', label: 'RIB', icon: '🏦' },
    { value: 'certificat_residence', label: 'Certificat de résidence', icon: '🏠' },
  ];

  // Get employee ID from user storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setEmployeeId(parsed.employeeId || parsed.employee_id || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchHistory();
  }, []);

  async function handleUpload() {
    if (!uploadFile || !uploadTitle || !employeeId) return;
    setUploading(true);
    setUploadError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('employee_id', String(employeeId));
      formData.append('document_type', uploadType);
      formData.append('title', uploadTitle);
      if (uploadExpiry) formData.append('expiry_date', uploadExpiry);
      formData.append('visible_to_employee', 'true');
      formData.append('is_confidential', 'false');

      const res = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erreur upload');
      }

      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadExpiry('');
      setUploadType('cni');
      fetchDocuments();
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/documents/my-documents`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error('Error fetching documents:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    try {
      const res = await fetch(`${API_URL}/api/documents/download-history?page_size=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items || []);
      }
    } catch (e) {}
  }

  async function handleDownload(doc: Document) {
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
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: data.mime_type || 'application/octet-stream' });
          const url = window.URL.createObjectURL(blob);
          const a = window.document.createElement('a');
          a.href = url;
          a.download = data.file_name || 'document';
          window.document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          fetchHistory(); // refresh history
        }
      }
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloading(null);
    }
  }

  const EMPLOYEE_DELETABLE_TYPES = ['cni', 'passeport', 'diplome', 'cv', 'photo_identite', 'rib', 'certificat_residence'];

  async function handleDelete(doc: Document) {
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer le document',
      message: `Supprimer "${doc.title}" ? Cette action est irréversible.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeleting(doc.id);
        try {
          const res = await fetch(`${API_URL}/api/documents/${doc.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            fetchDocuments();
            toast.success('Document supprimé');
          } else {
            const err = await res.json().catch(() => ({}));
            toast.error(err.detail || 'Erreur lors de la suppression');
          }
        } catch (e) {
          console.error('Delete error:', e);
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  // Filtrage
  const filtered = documents.filter(doc => {
    if (filter !== 'all' && doc.document_type !== filter) return false;
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase()) && !doc.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Types présents (pour le filtre)
  const presentTypes = Array.from(new Set(documents.map(d => d.document_type)));

  // Stats
  const totalDocs = documents.length;
  const expiringDocs = documents.filter(d => isExpiringSoon(d.expiry_date)).length;
  const expiredDocs = documents.filter(d => isExpired(d.expiry_date)).length;

  return (
    <>
      {showTips && (
        <PageTourTips tips={documentsTips} onDismiss={dismissTips} pageTitle="Mes Documents" />
      )}
      <Header title="Mes Documents" subtitle="Vos documents RH et administratifs" />

      <div className="p-6 max-w-5xl mx-auto">
        {/* Raccourci : Générer une attestation */}
        <div
          onClick={() => router.push('/dashboard/my-space?tab=profile')}
          className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-sm transition-shadow group"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-indigo-900">Générer une attestation de travail</h3>
            <p className="text-xs text-indigo-600 mt-0.5">Créez et téléchargez votre attestation depuis Mon Profil</p>
          </div>
          <ExternalLink className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalDocs}</p>
              <p className="text-xs text-gray-500">Document{totalDocs > 1 ? 's' : ''}</p>
            </div>
          </div>
          {expiringDocs > 0 && (
            <div className="bg-white rounded-xl border border-orange-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{expiringDocs}</p>
                <p className="text-xs text-gray-500">Expire bientôt</p>
              </div>
            </div>
          )}
          {expiredDocs > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{expiredDocs}</p>
                <p className="text-xs text-gray-500">Expiré{expiredDocs > 1 ? 's' : ''}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs + Upload button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setTab('documents')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                tab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Mes Documents
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              Historique
            </button>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Ajouter un document
          </button>
        </div>

        {/* Upload Form */}
        {showUpload && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Ajouter un document personnel
              </h3>
              <button onClick={() => setShowUpload(false)}>
                <X className="w-4 h-4 text-blue-400 hover:text-blue-600" />
              </button>
            </div>

            {uploadError && <p className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded">{uploadError}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Type de document *</label>
                <select
                  value={uploadType}
                  onChange={e => {
                    setUploadType(e.target.value);
                    const t = EMPLOYEE_TYPES.find(t => t.value === e.target.value);
                    if (t && !uploadTitle) setUploadTitle(t.label);
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {EMPLOYEE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Ex: CNI - Marie Reine"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date d&apos;expiration</label>
                <input
                  type="date"
                  value={uploadExpiry}
                  onChange={e => setUploadExpiry(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fichier *</label>
                <input
                  type="file"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) {
                        const t = EMPLOYEE_TYPES.find(t => t.value === uploadType);
                        setUploadTitle(t?.label || f.name);
                      }
                    }
                  }}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>
            </div>

            {uploadFile && (
              <p className="text-xs text-blue-700 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} Ko)
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowUpload(false); setUploadFile(null); setUploadTitle(''); }}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadTitle}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Upload...' : 'Uploader'}
              </button>
            </div>
          </div>
        )}

        {/* ============ DOCUMENTS TAB ============ */}
        {tab === 'documents' && (
          <>
            {/* Recherche + Filtres */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un document..."
                  className="flex-1 text-sm outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')}><X className="w-3 h-3 text-gray-400" /></button>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    filter === 'all' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Tous
                </button>
                {presentTypes.map(type => {
                  const style = getDocStyle(type);
                  return (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        filter === type ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {style.icon} {style.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Liste */}
            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium">Aucun document</p>
                <p className="text-sm text-gray-400 mt-1">
                  {documents.length === 0 ? "Vos documents RH apparaîtront ici" : "Essayez un autre filtre"}
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-tour="documents-list">
                {filtered.map(doc => {
                  const style = getDocStyle(doc.document_type);
                  const FileIcon = getFileIcon(doc.mime_type);
                  const expired = isExpired(doc.expiry_date);
                  const expiring = isExpiringSoon(doc.expiry_date);

                  return (
                    <div
                      key={doc.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group"
                    >
                      {/* Icône type */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${style.bg}`}>
                        {style.icon}
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{doc.title}</h3>
                          {expired && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 rounded-full flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Expiré
                            </span>
                          )}
                          {!expired && expiring && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-600 rounded-full flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> Expire bientôt
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className={`font-medium ${style.color}`}>{style.label}</span>
                          <span className="flex items-center gap-1"><FileIcon className="w-3 h-3" />{doc.file_name}</span>
                          {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                          {doc.document_date && <span>📅 {formatDate(doc.document_date)}</span>}
                          {doc.expiry_date && <span>⏳ Expire: {formatDate(doc.expiry_date)}</span>}
                          <span>Ajouté le {formatDate(doc.created_at)}</span>
                        </div>
                        {doc.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{doc.description}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloading === doc.id}
                          className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Télécharger"
                        >
                          {downloading === doc.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Download className="w-5 h-5" />
                          )}
                        </button>
                        {EMPLOYEE_DELETABLE_TYPES.includes(doc.document_type) && (
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={deleting === doc.id}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            {deleting === doc.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ============ HISTORY TAB ============ */}
        {tab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div className="py-16 text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium">Aucun téléchargement</p>
                <p className="text-sm text-gray-400 mt-1">Votre historique apparaîtra ici</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Document</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fichier</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{h.document_title}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{h.file_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(h.downloaded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      
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
