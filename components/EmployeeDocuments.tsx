'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileText, Upload, Download, Trash2, Loader2, Plus,
  AlertTriangle, Clock, X, Eye, File, Image, FileSpreadsheet, Shield
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

// ============================================
// CONFIG
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://targetym-alb-380014716.eu-west-1.elb.amazonaws.com';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
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
  visible_to_employee: boolean;
  is_confidential: boolean;
  uploaded_by_email: string | null;
  created_at: string;
}

const DOC_TYPES = [
  { value: 'contrat_travail', label: 'Contrat de travail', icon: '📝' },
  { value: 'avenant', label: 'Avenant', icon: '📋' },
  { value: 'cni', label: 'CNI', icon: '🪪' },
  { value: 'passeport', label: 'Passeport', icon: '🛂' },
  { value: 'diplome', label: 'Diplôme', icon: '🎓' },
  { value: 'cv', label: 'CV', icon: '📄' },
  { value: 'attestation_employeur', label: 'Attestation', icon: '📑' },
  { value: 'fiche_paie', label: 'Fiche de paie', icon: '💰' },
  { value: 'certificat_travail', label: 'Certificat de travail', icon: '🏅' },
  { value: 'rib', label: 'RIB', icon: '🏦' },
  { value: 'carte_vitale', label: 'Assurance santé', icon: '🏥' },
  { value: 'permis_conduire', label: 'Permis de conduire', icon: '🚗' },
  { value: 'photo_identite', label: 'Photo d\'identité', icon: '📸' },
  { value: 'certificat_residence', label: 'Certificat de résidence', icon: '🏠' },
  { value: 'autre', label: 'Autre', icon: '📁' },
];

function getDocLabel(type: string): { label: string; icon: string } {
  return DOC_TYPES.find(d => d.value === type) || { label: 'Autre', icon: '📁' };
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================
// COMPONENT
// ============================================

interface EmployeeDocumentsProps {
  employeeId: number;
  employeeName?: string;
  readOnly?: boolean; // true pour la vue employé, false pour la vue RH
}

export default function EmployeeDocuments({ employeeId, employeeName, readOnly = false }: EmployeeDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Upload form state
  const [uploadType, setUploadType] = useState('contrat_travail');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadDocDate, setUploadDocDate] = useState('');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadVisible, setUploadVisible] = useState(true);
  const [uploadConfidential, setUploadConfidential] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [employeeId]);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/documents/employee/${employeeId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : data.items || []);
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadTitle || !uploadType) return;
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('employee_id', String(employeeId));
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
        const err = await res.json();
        throw new Error(err.detail || 'Erreur upload');
      }

      // Reset form
      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadDocDate('');
      setUploadExpiry('');
      setUploadType('contrat_travail');
      setUploadVisible(true);
      setUploadConfidential(false);
      fetchDocuments();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: Document) {
    setDownloading(doc.id);
    try {
      const res = await fetch(`${API_URL}/api/documents/download/${doc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      });
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

  async function handleDelete(docId: number) {
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer le document',
      message: 'Voulez-vous vraiment supprimer ce document ?',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeleting(docId);
        try {
          await fetch(`${API_URL}/api/documents/${docId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          });
          setDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (e) {
          console.error('Delete error:', e);
        } finally {
          setDeleting(null);
        }
      },
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadTitle) {
        // Auto-fill title from type
        const typeLabel = DOC_TYPES.find(t => t.value === uploadType)?.label;
        setUploadTitle(typeLabel || file.name);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">
            Documents {employeeName ? `— ${employeeName}` : ''}
          </h3>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{documents.length}</span>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-blue-800">Nouveau document</h4>
            <button onClick={() => setShowUpload(false)}><X className="w-4 h-4 text-blue-400" /></button>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Type *</label>
              <select
                value={uploadType}
                onChange={e => setUploadType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {DOC_TYPES.map(t => (
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
                placeholder="Ex: Contrat CDI Janvier 2026"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <input
              type="text"
              value={uploadDesc}
              onChange={e => setUploadDesc(e.target.value)}
              placeholder="Notes optionnelles..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date du document</label>
              <input type="date" value={uploadDocDate} onChange={e => setUploadDocDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date d&apos;expiration</label>
              <input type="date" value={uploadExpiry} onChange={e => setUploadExpiry(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={uploadVisible} onChange={e => setUploadVisible(e.target.checked)} className="rounded" />
              Visible par l&apos;employé
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={uploadConfidential} onChange={e => setUploadConfidential(e.target.checked)} className="rounded" />
              <Shield className="w-3.5 h-3.5 text-gray-400" /> Confidentiel
            </label>
          </div>

          {/* File input */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              uploadFile ? 'border-blue-300 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" />
            {uploadFile ? (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-700">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{uploadFile.name}</span>
                <span className="text-blue-400">({formatSize(uploadFile.size)})</span>
                <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }} className="ml-2 p-0.5 hover:bg-blue-200 rounded">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                <p className="text-sm text-gray-500">Cliquez pour sélectionner un fichier</p>
                <p className="text-xs text-gray-400">PDF, Word, Excel, Image — Max 10 Mo</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowUpload(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Annuler</button>
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

      {/* Liste des documents */}
      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : documents.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">Aucun document</p>
          {!readOnly && <p className="text-xs text-gray-400 mt-1">Cliquez sur &quot;Ajouter&quot; pour uploader un document</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => {
            const { label, icon } = getDocLabel(doc.document_type);
            const expired = doc.expiry_date && new Date(doc.expiry_date) < new Date();

            return (
              <div key={doc.id} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2.5 group hover:bg-gray-50 transition-colors">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                    {doc.is_confidential && <Shield className="w-3 h-3 text-orange-500" />}
                    {!doc.visible_to_employee && <Eye className="w-3 h-3 text-gray-400" />}
                    {expired && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Expiré</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="text-gray-500">{label}</span>
                    <span>•</span>
                    <span>{doc.file_name}</span>
                    {doc.file_size && <><span>•</span><span>{formatSize(doc.file_size)}</span></>}
                    <span>•</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloading === doc.id}
                    className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                    title="Télécharger"
                  >
                    {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      className="p-1.5 hover:bg-red-100 rounded text-red-500"
                      title="Supprimer"
                    >
                      {deleting === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
}
