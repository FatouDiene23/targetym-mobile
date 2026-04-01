'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  PenLine, FileText, Plus, X, Loader2, CheckCircle2,
  Clock, XCircle, Trash2, Send, Ban, Download,
  ChevronDown, ChevronRight, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

type DocType = 'contrat_travail' | 'avenant' | 'accord' | 'nda' | 'fiche_paie' | 'attestation' | 'reglement_interieur' | 'autre';
type DocStatus = 'draft' | 'sent' | 'partially_signed' | 'fully_signed' | 'expired' | 'cancelled';
type ReqStatus = 'pending' | 'viewed' | 'signed' | 'rejected' | 'expired';

interface SignatoryOut {
  id: number;
  employee_id: number;
  employee_name: string;
  order_index: number;
  status: ReqStatus;
  signed_at?: string;
  viewed_at?: string;
  rejection_reason?: string;
}

interface DocumentOut {
  id: number;
  title: string;
  description?: string;
  document_type: DocType;
  status: DocStatus;
  file_name?: string;
  hash_sha256?: string;
  expires_at?: string;
  notes?: string;
  created_by_user_id?: number;
  created_at: string;
  updated_at: string;
  requests: SignatoryOut[];
}

interface StatsOut {
  total: number;
  draft: number;
  sent: number;
  partially_signed: number;
  fully_signed: number;
  expired: number;
  cancelled: number;
  pending_for_me: number;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
}

// ============================================
// CONFIG
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  contrat_travail: 'Contrat de travail',
  avenant: 'Avenant',
  accord: 'Accord',
  nda: 'NDA / Confidentialité',
  fiche_paie: 'Fiche de paie',
  attestation: 'Attestation',
  reglement_interieur: 'Règlement intérieur',
  autre: 'Autre',
};

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft:            { label: 'Brouillon',     color: 'bg-gray-100 text-gray-600',    icon: <FileText className="w-3 h-3" /> },
  sent:             { label: 'Envoyé',        color: 'bg-blue-100 text-blue-700',    icon: <Send className="w-3 h-3" /> },
  partially_signed: { label: 'Partiel',       color: 'bg-orange-100 text-orange-700', icon: <Clock className="w-3 h-3" /> },
  fully_signed:     { label: 'Signé',         color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" /> },
  expired:          { label: 'Expiré',        color: 'bg-red-100 text-red-600',      icon: <XCircle className="w-3 h-3" /> },
  cancelled:        { label: 'Annulé',        color: 'bg-gray-100 text-gray-500',    icon: <Ban className="w-3 h-3" /> },
};

const REQ_STATUS_CONFIG: Record<ReqStatus, { label: string; color: string }> = {
  pending:  { label: 'En attente', color: 'bg-orange-50 text-orange-700' },
  viewed:   { label: 'Consulté',   color: 'bg-blue-50 text-blue-700' },
  signed:   { label: 'Signé',      color: 'bg-green-50 text-green-700' },
  rejected: { label: 'Refusé',     color: 'bg-red-50 text-red-600' },
  expired:  { label: 'Expiré',     color: 'bg-gray-100 text-gray-500' },
};

// ============================================
// COMPONENT
// ============================================

export default function SignaturesPage() {
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [stats, setStats] = useState<StatsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    document_type: 'contrat_travail' as DocType,
    file_data: '',
    file_name: '',
    expires_at: '',
    notes: '',
  });
  const [selectedSignatories, setSelectedSignatories] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Signataires search
  const [sigSearch, setSigSearch] = useState('');
  const [sigDropOpen, setSigDropOpen] = useState(false);
  const sigSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sigSearchRef.current && !sigSearchRef.current.contains(e.target as Node)) {
        setSigDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredEmployeesForSearch = employees.filter(emp => {
    const q = sigSearch.toLowerCase();
    if (!q) return !selectedSignatories.includes(emp.id);
    const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const job = (emp.job_title ?? '').toLowerCase();
    return (name.includes(q) || job.includes(q)) && !selectedSignatories.includes(emp.id);
  });

  const addSignatory = (empId: number) => {
    setSelectedSignatories(prev => [...prev, empId]);
    setSigSearch('');
  };

  const removeSignatory = (empId: number) => {
    setSelectedSignatories(prev => prev.filter(id => id !== empId));
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/signatures/documents`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/signatures/stats`, { headers: getAuthHeaders() }),
      ]);
      if (docsRes.ok) setDocs(await docsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/employees/?page=1&page_size=500`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.items ?? data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchEmployees();
  }, [fetchAll, fetchEmployees]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      setCreateForm(f => ({ ...f, file_data: b64, file_name: file.name }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!createForm.title || !createForm.file_data) {
      toast.error('Titre et fichier PDF obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...createForm,
        expires_at: createForm.expires_at || null,
        signatories: selectedSignatories.map((id, i) => ({ employee_id: id, order_index: i })),
      };
      const res = await fetch(`${API_URL}/api/signatures/documents`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success('Document créé !');
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', document_type: 'contrat_travail', file_data: '', file_name: '', expires_at: '', notes: '' });
      setSelectedSignatories([]);
      setSigSearch('');
      setSigDropOpen(false);
      fetchAll();
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async (docId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/signatures/documents/${docId}/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      toast.success('Document envoyé aux signataires');
      fetchAll();
    } catch {
      toast.error('Erreur lors de l\'envoi');
    }
  };

  const handleCancel = (docId: number) => {
    setConfirmDialog({
      open: true,
      title: 'Annuler le document',
      message: 'Annuler ce document ? Les signataires ne pourront plus signer.',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/api/signatures/documents/${docId}/cancel`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });
          if (!res.ok) throw new Error();
          toast.success('Document annulé');
          fetchAll();
        } catch {
          toast.error("Erreur lors de l'annulation");
        }
      },
    });
  };

  const handleDelete = (docId: number) => {
    setConfirmDialog({
      open: true,
      title: 'Supprimer le document',
      message: 'Supprimer définitivement ce document ? Cette action est irréversible.',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/api/signatures/documents/${docId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          if (!res.ok) throw new Error();
          toast.success('Document supprimé');
          fetchAll();
        } catch {
          toast.error('Erreur lors de la suppression');
        }
      },
    });
  };

  const handleDownloadFinalPdf = async (doc: DocumentOut) => {
    try {
      const res = await fetch(`${API_URL}/api/signatures/documents/${doc.id}/final-pdf`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed_${doc.title.replace(/\s+/g, '_').slice(0, 50)}_${doc.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement');
    }
  };

  const filtered = filterStatus === 'all' ? docs : docs.filter(d => d.status === filterStatus);

  return (
    <div className="p-6 space-y-6">
      <Header
        title="Signatures électroniques"
        subtitle="Gérer les documents à signer, suivre les signatures et l'audit trail"
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'bg-gray-50 text-gray-700' },
            { label: 'Brouillons', value: stats.draft, color: 'bg-gray-100 text-gray-600' },
            { label: 'Envoyés', value: stats.sent, color: 'bg-blue-50 text-blue-700' },
            { label: 'Partiels', value: stats.partially_signed, color: 'bg-orange-50 text-orange-700' },
            { label: 'Signés', value: stats.fully_signed, color: 'bg-green-50 text-green-700' },
            { label: 'Expirés', value: stats.expired, color: 'bg-red-50 text-red-600' },
            { label: 'Annulés', value: stats.cancelled, color: 'bg-gray-100 text-gray-500' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'draft', 'sent', 'partially_signed', 'fully_signed', 'expired', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {s === 'all' ? 'Tous' : STATUS_CONFIG[s as DocStatus]?.label ?? s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau document
        </button>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <PenLine className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun document trouvé</p>
          <p className="text-sm text-gray-400 mt-1">Créez votre premier document à signer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => {
            const sc = STATUS_CONFIG[doc.status];
            const isExpanded = expandedDoc === doc.id;
            const signedCount = doc.requests.filter(r => r.status === 'signed').length;
            const totalCount = doc.requests.length;
            return (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{DOC_TYPE_LABELS[doc.document_type]}</span>
                      {doc.file_name && <span className="text-xs text-gray-400">· {doc.file_name}</span>}
                      <span className="text-xs text-gray-400">· {new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {totalCount > 0 && (
                      <span className="text-xs text-gray-500">{signedCount}/{totalCount} signé{signedCount > 1 ? 's' : ''}</span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${sc.color}`}>
                      {sc.icon}{sc.label}
                    </span>
                    {/* Actions */}
                    {doc.status === 'draft' && (
                      <>
                        <button onClick={() => handleSend(doc.id)} title="Envoyer" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Send className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(doc.id)} title="Supprimer" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                    {(doc.status === 'sent' || doc.status === 'partially_signed') && (
                      <button onClick={() => handleCancel(doc.id)} title="Annuler" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"><Ban className="w-4 h-4" /></button>
                    )}
                    {(doc.status === 'sent' || doc.status === 'partially_signed' || doc.status === 'fully_signed') && (
                      <button onClick={() => handleDownloadFinalPdf(doc)} title="Télécharger PDF final signé" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Download className="w-4 h-4" /></button>
                    )}
                    {totalCount > 0 && (
                      <button
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded signatories */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Signataires</p>
                    <div className="space-y-2">
                      {doc.requests.map(r => {
                        const rc = REQ_STATUS_CONFIG[r.status];
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-4 text-right">{r.order_index + 1}.</span>
                              <span className="text-sm text-gray-700">{r.employee_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.signed_at && <span className="text-xs text-gray-400">{new Date(r.signed_at).toLocaleDateString('fr-FR')}</span>}
                              {r.rejection_reason && <span className="text-xs text-red-400 italic max-w-[160px] truncate" title={r.rejection_reason}>«&nbsp;{r.rejection_reason}&nbsp;»</span>}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rc.color}`}>{rc.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {doc.hash_sha256 && (
                      <p className="mt-3 text-xs text-gray-400 font-mono truncate">SHA-256 : {doc.hash_sha256}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Nouveau document à signer
              </h3>
              <button onClick={() => { setShowCreateModal(false); setSigSearch(''); setSigDropOpen(false); setSelectedSignatories([]); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Contrat CDI – Jean Dupont"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de document *</label>
                <select
                  value={createForm.document_type}
                  onChange={e => setCreateForm(f => ({ ...f, document_type: e.target.value as DocType }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fichier PDF *</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                  {createForm.file_name ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      {createForm.file_name}
                      <button onClick={() => setCreateForm(f => ({ ...f, file_data: '', file_name: '' }))} className="text-gray-400 hover:text-gray-600 ml-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <label className="cursor-pointer text-sm text-blue-600 hover:underline">
                        Sélectionner un PDF
                        <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Description optionnelle..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration (optionnel)</label>
                <input
                  type="date"
                  value={createForm.expires_at}
                  onChange={e => setCreateForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Signatories – recherche */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signataires
                  {selectedSignatories.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-blue-600">{selectedSignatories.length} sélectionné(s)</span>
                  )}
                </label>

                {/* Pills des signataires sélectionnés (ordonnés) */}
                {selectedSignatories.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedSignatories.map((id, idx) => {
                      const emp = employees.find(e => e.id === id);
                      if (!emp) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2.5 py-1 rounded-full"
                        >
                          <span className="w-4 h-4 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          {emp.first_name} {emp.last_name}
                          <button
                            type="button"
                            onClick={() => removeSignatory(id)}
                            className="text-blue-400 hover:text-blue-700 ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedSignatories([])}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition"
                    >
                      <X className="w-3 h-3" /> Tout effacer
                    </button>
                  </div>
                )}

                {/* Champ de recherche */}
                <div className="relative" ref={sigSearchRef}>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300 bg-white">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={sigSearch}
                      onChange={e => { setSigSearch(e.target.value); setSigDropOpen(true); }}
                      onFocus={() => setSigDropOpen(true)}
                      placeholder="Rechercher un employé..."
                      className="flex-1 text-sm outline-none bg-transparent"
                    />
                    {sigSearch && (
                      <button type="button" onClick={() => setSigSearch('')} className="text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown résultats */}
                  {sigDropOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredEmployeesForSearch.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          {sigSearch ? 'Aucun résultat' : 'Tous les employés sont déjà sélectionnés'}
                        </p>
                      ) : (
                        filteredEmployeesForSearch.map(emp => (
                          <button
                            key={emp.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addSignatory(emp.id); setSigDropOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition"
                          >
                            <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {emp.first_name[0]}{emp.last_name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800">{emp.first_name} {emp.last_name}</p>
                              {emp.job_title && <p className="text-xs text-gray-400 truncate">{emp.job_title}</p>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => { setShowCreateModal(false); setSigSearch(''); setSigDropOpen(false); setSelectedSignatories([]); }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !createForm.title || !createForm.file_data}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer le document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
}