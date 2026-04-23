'use client';

import { useState, useEffect, useCallback } from 'react';
import CustomSelect from '@/components/CustomSelect';
import {
  Scale, Search, Plus, Loader2, X, ChevronLeft, ChevronRight,
  Calendar, User, Filter, Upload, Download, Trash2, FileText,
  Clock, ArrowRight, Eye, Edit3, Gavel, AlertCircle,
  Users, Handshake, CheckCircle, AlertTriangle, BookOpen, Archive,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth, API_URL, getEmployees, type Employee } from '@/lib/api';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';

// ── Types ───────────────────────────────────────────────────────────────────

interface LaborDispute {
  id: number;
  tenant_id: number;
  employee_id: number;
  employee_name?: string;
  reference_number: string;
  title: string;
  description?: string;
  current_stage: string;
  status: string;
  opened_date: string;
  closed_date?: string;
  created_by_id: number;
  created_by_name?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  created_at?: string;
  updated_at?: string;
  stages_history?: StageHistory[];
  audiences?: Audience[];
  documents?: DisputeDocument[];
}

interface StageHistory {
  id: number;
  stage: string;
  started_at: string;
  notes?: string;
  created_by_id: number;
  created_by_name?: string;
  created_at?: string;
}

interface Audience {
  id: number;
  dispute_id: number;
  audience_date: string;
  audience_type: string;
  location?: string;
  notes?: string;
  result?: string;
  next_audience_date?: string;
  created_by_id: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface DisputeDocument {
  id: number;
  dispute_id: number;
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_by_id: number;
  uploaded_by_name?: string;
  created_at?: string;
}

interface SimpleEmployee {
  id: number;
  first_name: string;
  last_name: string;
  department_name?: string;
  is_juriste?: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STAGES: { key: string; color: string; icon: LucideIcon; bg: string; iconColor: string; dotColor: string }[] = [
  { key: 'convocation_it', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: FileText, bg: 'bg-orange-50', iconColor: 'text-orange-500', dotColor: 'bg-orange-500' },
  { key: 'entretien_it', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Users, bg: 'bg-blue-50', iconColor: 'text-blue-500', dotColor: 'bg-blue-500' },
  { key: 'conciliation', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Handshake, bg: 'bg-purple-50', iconColor: 'text-purple-500', dotColor: 'bg-purple-500' },
  { key: 'accord_amiable', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, bg: 'bg-green-50', iconColor: 'text-green-500', dotColor: 'bg-green-500' },
  { key: 'contentieux', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle, bg: 'bg-red-50', iconColor: 'text-red-500', dotColor: 'bg-red-500' },
  { key: 'audience', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Calendar, bg: 'bg-indigo-50', iconColor: 'text-indigo-500', dotColor: 'bg-indigo-500' },
  { key: 'jugement', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: BookOpen, bg: 'bg-yellow-50', iconColor: 'text-yellow-500', dotColor: 'bg-yellow-500' },
  { key: 'cloture', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Archive, bg: 'bg-gray-50', iconColor: 'text-gray-500', dotColor: 'bg-gray-400' },
];

const STATUS_COLORS: Record<string, string> = {
  ouvert: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-orange-100 text-orange-700',
  suspendu: 'bg-yellow-100 text-yellow-700',
  clos_accord: 'bg-green-100 text-green-700',
  clos_jugement: 'bg-gray-100 text-gray-700',
  clos_abandon: 'bg-red-100 text-red-700',
};

function getStageInfo(key: string) {
  return STAGES.find(s => s.key === key) || { key, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: AlertCircle as LucideIcon, bg: 'bg-gray-50', iconColor: 'text-gray-500', dotColor: 'bg-gray-400' };
}

function formatDate(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetchWithAuth(`${API_URL}${path}`, options || {});
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Erreur ${res.status}` }));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ContentieuxPage() {
  const { t } = useI18n();
  // Auth
  const [userRole, setUserRole] = useState('');
  const [isJuriste, setIsJuriste] = useState(false);
  const canCreate = ['rh', 'admin', 'dg', 'super_admin'].includes(userRole);

  // Data
  const [disputes, setDisputes] = useState<LaborDispute[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployee[]>([]);
  const [juristes, setJuristes] = useState<SimpleEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterAssigned, setFilterAssigned] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Pipeline counts
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});

  // Detail view
  const [selectedDispute, setSelectedDispute] = useState<LaborDispute | null>(null);
  const [detailTab, setDetailTab] = useState<'historique' | 'audiences' | 'documents' | 'infos'>('historique');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    employee_id: 0,
    title: '',
    description: '',
    opened_date: new Date().toISOString().split('T')[0],
    assigned_to_id: 0,
    reference_number: '',
  });

  // Stage change form
  const [stageForm, setStageForm] = useState({ stage: '', notes: '' });

  // Audience form
  const [audienceForm, setAudienceForm] = useState({
    audience_date: '',
    audience_type: 'plaidoirie',
    location: '',
    notes: '',
    result: '',
    next_audience_date: '',
  });

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUserRole(u.role?.toLowerCase() || 'employee');
      } catch { /* ignore */ }
    }
    // Check is_juriste via employee endpoint
    const fetchJuristeStatus = async () => {
      try {
        const userStr2 = localStorage.getItem('user');
        if (!userStr2) return;
        const u = JSON.parse(userStr2);
        if (!u.employee_id) return;
        const res = await fetchWithAuth(`${API_URL}/api/employees/${u.employee_id}`, {});
        if (res.ok) {
          const emp = await res.json();
          if (emp?.is_juriste) setIsJuriste(true);
        }
      } catch { /* ignore */ }
    };
    fetchJuristeStatus();
  }, []);

  // ── Load employees ──────────────────────────────────────────────────────

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getEmployees({ page_size: 500, status: 'active' });
      const list = (data.items || []).map((e: Employee) => ({
        id: e.id,
        first_name: e.first_name || '',
        last_name: e.last_name || '',
        department_name: e.department_name || undefined,
        is_juriste: e.is_juriste || false,
      }));
      setEmployees(list);
      setJuristes(list.filter((e: SimpleEmployee) => e.is_juriste));
    } catch {
      setEmployees([]);
      setJuristes([]);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // ── Load disputes ─────────────────────────────────────────────────────

  const loadDisputes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('page_size', '20');
      if (search) params.append('search', search);
      if (filterStatus) params.append('status', filterStatus);
      if (filterStage) params.append('stage', filterStage);
      if (filterAssigned) params.append('assigned_to_id', String(filterAssigned));

      const data = await apiFetch(`/api/contentieux/?${params.toString()}`);
      setDisputes(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
      setDisputes([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterStatus, filterStage, filterAssigned]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  // ── Load pipeline counts ──────────────────────────────────────────────

  const loadStageCounts = useCallback(async () => {
    try {
      // Load all to count by stage
      const data = await apiFetch('/api/contentieux/?page_size=100');
      const counts: Record<string, number> = {};
      STAGES.forEach(s => { counts[s.key] = 0; });
      (data.items || []).forEach((d: LaborDispute) => {
        counts[d.current_stage] = (counts[d.current_stage] || 0) + 1;
      });
      setStageCounts(counts);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStageCounts(); }, [loadStageCounts]);

  // ── Load detail ───────────────────────────────────────────────────────

  const loadDetail = async (id: number) => {
    setIsLoadingDetail(true);
    setDetailTab('historique');
    try {
      const data = await apiFetch(`/api/contentieux/${id}`);
      setSelectedDispute(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ── Create dispute ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.employee_id || !createForm.title.trim() || !createForm.reference_number.trim()) {
      toast.error(t.sanctions.fillRequired);
      return;
    }
    setIsSaving(true);
    try {
      await apiFetch('/api/contentieux/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: createForm.employee_id,
          title: createForm.title,
          description: createForm.description || null,
          opened_date: createForm.opened_date,
          assigned_to_id: createForm.assigned_to_id || null,
          reference_number: createForm.reference_number,
        }),
      });
      toast.success(t.sanctions.caseCreated);
      setShowCreateModal(false);
      setCreateForm({ employee_id: 0, title: '', description: '', opened_date: new Date().toISOString().split('T')[0], assigned_to_id: 0, reference_number: '' });
      loadDisputes();
      loadStageCounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Change stage ──────────────────────────────────────────────────────

  const handleChangeStage = async () => {
    if (!stageForm.stage || !stageForm.notes.trim()) {
      toast.error(t.sanctions.stageAndNotesRequired);
      return;
    }
    if (!selectedDispute) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/contentieux/${selectedDispute.id}/change-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: stageForm.stage, notes: stageForm.notes }),
      });
      toast.success(t.sanctions.stageChanged);
      setShowStageModal(false);
      setStageForm({ stage: '', notes: '' });
      loadDetail(selectedDispute.id);
      loadDisputes();
      loadStageCounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Create audience ───────────────────────────────────────────────────

  const handleCreateAudience = async () => {
    if (!audienceForm.audience_date) {
      toast.error(t.sanctions.dateRequired);
      return;
    }
    if (!selectedDispute) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/contentieux/${selectedDispute.id}/audiences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience_date: audienceForm.audience_date,
          audience_type: audienceForm.audience_type,
          location: audienceForm.location || null,
          notes: audienceForm.notes || null,
          result: audienceForm.result || null,
          next_audience_date: audienceForm.next_audience_date || null,
        }),
      });
      toast.success(t.sanctions.audiencePlanned);
      setShowAudienceModal(false);
      setAudienceForm({ audience_date: '', audience_type: 'plaidoirie', location: '', notes: '', result: '', next_audience_date: '' });
      loadDetail(selectedDispute.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete audience ───────────────────────────────────────────────────

  const handleDeleteAudience = async (audienceId: number) => {
    if (!selectedDispute) return;
    try {
      await apiFetch(`/api/contentieux/${selectedDispute.id}/audiences/${audienceId}`, { method: 'DELETE' });
      toast.success(t.sanctions.audienceDeleted);
      loadDetail(selectedDispute.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    }
  };

  // ── Upload document ───────────────────────────────────────────────────

  const handleUploadDocument = async (file: File) => {
    if (!selectedDispute) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/contentieux/${selectedDispute.id}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Erreur upload' }));
        throw new Error(err.detail);
      }
      toast.success(t.sanctions.documentUploaded);
      loadDetail(selectedDispute.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    }
  };

  // ── Delete document ───────────────────────────────────────────────────

  const handleDeleteDocument = async (docId: number) => {
    if (!selectedDispute) return;
    try {
      await apiFetch(`/api/contentieux/${selectedDispute.id}/documents/${docId}`, { method: 'DELETE' });
      toast.success(t.sanctions.documentDeleted);
      loadDetail(selectedDispute.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    }
  };

  // ── Download document ─────────────────────────────────────────────────

  const handleDownloadDocument = async (docId: number) => {
    if (!selectedDispute) return;
    try {
      const data = await apiFetch(`/api/contentieux/${selectedDispute.id}/documents/${docId}/download`);
      window.open(data.download_url, '_blank');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    }
  };

  // ── Update dispute ────────────────────────────────────────────────────

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', assigned_to_id: 0 });

  const openEditModal = (d: LaborDispute) => {
    setEditForm({ title: d.title, description: d.description || '', assigned_to_id: d.assigned_to_id || 0 });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedDispute) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/contentieux/${selectedDispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title || undefined,
          description: editForm.description || undefined,
          assigned_to_id: editForm.assigned_to_id || undefined,
        }),
      });
      toast.success(t.sanctions.caseUpdated);
      setShowEditModal(false);
      loadDetail(selectedDispute.id);
      loadDisputes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════

  if (selectedDispute) {
    const d = selectedDispute;
    const stageInfo = getStageInfo(d.current_stage);
    const statusColor = STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600';
    const statusLabel = (t.sanctions.statuses as Record<string, string>)[d.status] || d.status;
    const stageLabel = (t.sanctions.stages as Record<string, string>)[d.current_stage] || d.current_stage;
    const isClosed = d.status.startsWith('clos');

    return (
      <div className="p-6 w-full">
        {/* Back button + header */}
        <button onClick={() => setSelectedDispute(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="w-4 h-4" /> {t.sanctions.backToList}
        </button>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900">{d.reference_number}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                  {statusLabel}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${stageInfo.color}`}>
                  <stageInfo.icon className="w-3.5 h-3.5" />
                  {stageLabel}
                </span>
              </div>
              <h2 className="text-lg text-gray-700 mb-1">{d.title}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {d.employee_name || `Employe #${d.employee_id}`}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {t.sanctions.openedOn} {formatDate(d.opened_date)}</span>
                {d.assigned_to_name && <span className="flex items-center gap-1"><Scale className="w-3.5 h-3.5" /> {d.assigned_to_name}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {!isClosed && (
                <button
                  onClick={() => { setStageForm({ stage: '', notes: '' }); setShowStageModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" /> {t.sanctions.changeStage}
                </button>
              )}
              <button
                onClick={() => openEditModal(d)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" /> {t.sanctions.editCase}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="border-b">
            <nav className="flex">
              {[
                { key: 'historique' as const, label: t.sanctions.historyTab, icon: Clock },
                { key: 'audiences' as const, label: t.sanctions.audiencesTab, icon: Gavel },
                { key: 'documents' as const, label: t.sanctions.documentsTab, icon: FileText },
                { key: 'infos' as const, label: t.sanctions.infoTab, icon: AlertCircle },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" /> {tab.label}
                  {tab.key === 'audiences' && d.audiences && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">{d.audiences.length}</span>
                  )}
                  {tab.key === 'documents' && d.documents && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">{d.documents.length}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {isLoadingDetail ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
            ) : (
              <>
                {/* ── Tab: Historique ─────────────────────────────────── */}
                {detailTab === 'historique' && (
                  <div className="space-y-0">
                    {(d.stages_history || []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">{t.sanctions.noHistory}</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                        {(d.stages_history || []).map((h) => {
                          const si = getStageInfo(h.stage);
                          const HistIcon = si.icon;
                          return (
                            <div key={h.id} className="relative pl-12 pb-6">
                              <div className={`absolute left-1.5 top-1 w-6 h-6 rounded-full flex items-center justify-center ${si.dotColor}`}>
                                <HistIcon className="w-3.5 h-3.5 text-white" />
                              </div>
                              <div className={`${si.bg} rounded-lg p-4 border ${si.color.split(' ').find(c => c.startsWith('border-')) || ''}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${si.color}`}>
                                    <HistIcon className="w-3 h-3" />
                                    {(t.sanctions.stages as Record<string, string>)[h.stage] || h.stage}
                                  </span>
                                  <span className="text-xs text-gray-400">{formatDateTime(h.started_at)}</span>
                                </div>
                                {h.notes && <p className="text-sm text-gray-700 mt-1">{h.notes}</p>}
                                {h.created_by_name && <p className="text-xs text-gray-400 mt-1">{t.sanctions.by} {h.created_by_name}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Audiences ──────────────────────────────────── */}
                {detailTab === 'audiences' && (
                  <div>
                    {!isClosed && (
                      <div className="flex justify-end mb-4">
                        <button
                          onClick={() => {
                            setAudienceForm({ audience_date: '', audience_type: 'plaidoirie', location: '', notes: '', result: '', next_audience_date: '' });
                            setShowAudienceModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
                        >
                          <Plus className="w-4 h-4" /> {t.sanctions.scheduleAudience}
                        </button>
                      </div>
                    )}
                    {(d.audiences || []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">{t.sanctions.noAudiencePlanned}</p>
                    ) : (
                      <div className="space-y-3">
                        {(d.audiences || []).map(a => (
                          <div key={a.id} className="bg-gray-50 rounded-lg p-4 flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">{(t.sanctions.audienceTypes as Record<string, string>)[a.audience_type] || a.audience_type}</span>
                                <span className="text-xs text-gray-400">{formatDateTime(a.audience_date)}</span>
                              </div>
                              {a.location && <p className="text-xs text-gray-500">{t.sanctions.locationLabel} : {a.location}</p>}
                              {a.notes && <p className="text-sm text-gray-600 mt-1">{a.notes}</p>}
                              {a.result && <p className="text-sm text-gray-700 mt-1 font-medium">{t.sanctions.resultLabel} : {a.result}</p>}
                              {a.next_audience_date && <p className="text-xs text-primary-600 mt-1">{t.sanctions.nextAudience} : {formatDate(a.next_audience_date)}</p>}
                            </div>
                            {!isClosed && (
                              <button onClick={() => handleDeleteAudience(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Documents ──────────────────────────────────── */}
                {detailTab === 'documents' && (
                  <div>
                    {!isClosed && (
                      <div className="flex justify-end mb-4">
                        <label className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 cursor-pointer">
                          <Upload className="w-4 h-4" /> {t.sanctions.addDocument}
                          <input
                            type="file"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadDocument(f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    )}
                    {(d.documents || []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">{t.sanctions.noDocument}</p>
                    ) : (
                      <div className="space-y-2">
                        {(d.documents || []).map(doc => (
                          <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                                <p className="text-xs text-gray-400">{formatFileSize(doc.file_size)} &middot; {formatDate(doc.created_at)} &middot; {doc.uploaded_by_name || ''}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => handleDownloadDocument(doc.id)} className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg">
                                <Download className="w-4 h-4" />
                              </button>
                              {!isClosed && (
                                <button onClick={() => handleDeleteDocument(doc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Infos ──────────────────────────────────────── */}
                {detailTab === 'infos' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.referenceInfo}</label>
                        <p className="text-sm text-gray-900">{d.reference_number}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.employeeLabel}</label>
                        <p className="text-sm text-gray-900">{d.employee_name || `#${d.employee_id}`}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.disputeSubject}</label>
                        <p className="text-sm text-gray-900">{d.title}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.description}</label>
                        <p className="text-sm text-gray-700">{d.description || '-'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.assignedLawyer}</label>
                        <p className="text-sm text-gray-900">{d.assigned_to_name || t.sanctions.notAssigned}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.openingDate}</label>
                        <p className="text-sm text-gray-900">{formatDate(d.opened_date)}</p>
                      </div>
                      {d.closed_date && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.closingDate}</label>
                          <p className="text-sm text-gray-900">{formatDate(d.closed_date)}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.createdBy}</label>
                        <p className="text-sm text-gray-900">{d.created_by_name || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">{t.sanctions.createdOn}</label>
                        <p className="text-sm text-gray-900">{formatDateTime(d.created_at)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Stage Change Modal ──────────────────────────────────────── */}
        {showStageModal && (
          <ModalOverlay onClose={() => setShowStageModal(false)}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary-500" /> {t.sanctions.changeStage}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.newStage} *</label>
                <CustomSelect
                  value={stageForm.stage}
                  onChange={v => setStageForm(f => ({ ...f, stage: v }))}
                  options={[{value:'', label: t.sanctions.selectStage}, ...STAGES.map(s => ({value: s.key, label: (t.sanctions.stages as Record<string, string>)[s.key] || s.key}))]}
                  className="w-full"
                />
              </div>
              {stageForm.stage === 'conciliation' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-sm text-purple-700">{t.sanctions.conciliationNote}</p>
                </div>
              )}
              {stageForm.stage === 'accord_amiable' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">{t.sanctions.agreementNote}</p>
                </div>
              )}
              {stageForm.stage === 'cloture' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{t.sanctions.closureNote}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.notesLabel} *</label>
                <textarea
                  value={stageForm.notes}
                  onChange={e => setStageForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder={t.sanctions.stageChangeReasonPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowStageModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t.common.cancel}</button>
              <button
                onClick={handleChangeStage}
                disabled={isSaving || !stageForm.stage || !stageForm.notes.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {t.common.confirm}
              </button>
            </div>
          </ModalOverlay>
        )}

        {/* ── Audience Modal ──────────────────────────────────────────── */}
        {showAudienceModal && (
          <ModalOverlay onClose={() => setShowAudienceModal(false)}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary-500" /> {t.sanctions.scheduleAudience}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.dateTime} *</label>
                <input
                  type="datetime-local"
                  value={audienceForm.audience_date}
                  onChange={e => setAudienceForm(f => ({ ...f, audience_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.audienceType} *</label>
                <CustomSelect
                  value={audienceForm.audience_type}
                  onChange={v => setAudienceForm(f => ({ ...f, audience_type: v }))}
                  options={Object.keys(t.sanctions.audienceTypes).map(k => ({value: k, label: (t.sanctions.audienceTypes as Record<string, string>)[k]}))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.locationLabel}</label>
                <input
                  type="text"
                  value={audienceForm.location}
                  onChange={e => setAudienceForm(f => ({ ...f, location: e.target.value }))}
                  placeholder={t.sanctions.tribunalPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.nextAudienceDate}</label>
                <input
                  type="date"
                  value={audienceForm.next_audience_date}
                  onChange={e => setAudienceForm(f => ({ ...f, next_audience_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.notesLabel}</label>
                <textarea
                  value={audienceForm.notes}
                  onChange={e => setAudienceForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAudienceModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t.common.cancel}</button>
              <button
                onClick={handleCreateAudience}
                disabled={isSaving || !audienceForm.audience_date}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {t.sanctions.scheduleAudience}
              </button>
            </div>
          </ModalOverlay>
        )}

        {/* ── Edit Modal ─────────────────────────────────────────────── */}
        {showEditModal && (
          <ModalOverlay onClose={() => setShowEditModal(false)}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary-500" /> {t.sanctions.editCaseTitle}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.disputeSubject}</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.description}</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.assignedLawyer}</label>
                <CustomSelect
                  value={editForm.assigned_to_id ? String(editForm.assigned_to_id) : ''}
                  onChange={v => setEditForm(f => ({ ...f, assigned_to_id: Number(v) }))}
                  options={[{value:'', label: t.sanctions.notAssigned}, ...juristes.map(j => ({value: String(j.id), label: `${j.first_name} ${j.last_name}`}))]}
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t.common.cancel}</button>
              <button
                onClick={handleUpdate}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {t.common.save}
              </button>
            </div>
          </ModalOverlay>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full">
      <Header title={t.sanctions.title} subtitle={t.sanctions.subtitle} />
      <div className="p-6">

      {/* Pipeline visuel */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 w-full">
          {STAGES.map((s) => {
            const count = stageCounts[s.key] || 0;
            const isActive = filterStage === s.key;
            const StageIcon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => { setFilterStage(isActive ? '' : s.key); setPage(1); }}
                className={`flex flex-col items-center px-2 py-3 rounded-lg text-xs font-medium transition-all h-auto border ${
                  isActive
                    ? `ring-2 ring-offset-1 ring-primary-500 ${s.bg} ${s.color}`
                    : `${s.bg} text-gray-600 hover:shadow-sm border-transparent`
                }`}
              >
                <StageIcon className={`w-5 h-5 mb-1 ${s.iconColor}`} />
                <span className="text-lg font-bold">{count}</span>
                <span className="text-xs text-center leading-tight whitespace-normal break-words">{(t.sanctions.stages as Record<string, string>)[s.key] || s.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters + Actions */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 w-full">
        <div className="flex flex-wrap items-center gap-3 w-full">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t.sanctions.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showFilters ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" /> {t.sanctions.filters}
          </button>
          {canCreate && (
            <button
              onClick={() => {
                setCreateForm({ employee_id: 0, title: '', description: '', opened_date: new Date().toISOString().split('T')[0], assigned_to_id: 0, reference_number: '' });
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t.sanctions.newCaseBtn}
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t">
            <CustomSelect value={filterStatus} onChange={v => { setFilterStatus(v); setPage(1); }} placeholder={t.sanctions.allStatuses} className="min-w-[150px]"
              options={[
                { value: '', label: t.sanctions.allStatuses },
                ...Object.keys(STATUS_COLORS).map(k => ({ value: k, label: (t.sanctions.statuses as Record<string, string>)[k] || k })),
              ]}
            />
            <CustomSelect value={filterStage} onChange={v => { setFilterStage(v); setPage(1); }} placeholder={t.sanctions.allStages} className="min-w-[150px]"
              options={[
                { value: '', label: t.sanctions.allStages },
                ...STAGES.map(s => ({ value: s.key, label: (t.sanctions.stages as Record<string, string>)[s.key] || s.key })),
              ]}
            />
            <CustomSelect value={String(filterAssigned)} onChange={v => { setFilterAssigned(v ? Number(v) : ''); setPage(1); }} placeholder={t.sanctions.allLawyers} className="min-w-[180px]"
              options={[
                { value: '', label: t.sanctions.allLawyers },
                ...juristes.map(j => ({ value: String(j.id), label: `${j.first_name} ${j.last_name}` })),
              ]}
            />
            {(filterStatus || filterStage || filterAssigned) && (
              <button
                onClick={() => { setFilterStatus(''); setFilterStage(''); setFilterAssigned(''); setPage(1); }}
                className="text-sm text-primary-600 hover:underline"
              >
                {t.sanctions.reset}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : disputes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Scale className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">{t.sanctions.noCaseFound}</p>
            <p className="text-sm text-gray-400 mt-1">{t.sanctions.casesAppearHere}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.referenceColumn}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.employeeColumn}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.subjectColumn}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.stageColumn}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.statusColumn}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.openingColumn}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.lawyerColumn}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.sanctions.actionsColumn}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {disputes.map(d => {
                    const stageInfo = getStageInfo(d.current_stage);
                    const rowStatusColor = STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600';
                    const rowStatusLabel = (t.sanctions.statuses as Record<string, string>)[d.status] || d.status;
                    const rowStageLabel = (t.sanctions.stages as Record<string, string>)[d.current_stage] || d.current_stage;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => loadDetail(d.id)}>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono font-medium text-primary-600">{d.reference_number}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                              <User className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <span className="text-sm text-gray-900">{d.employee_name || `#${d.employee_id}`}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 max-w-[200px] truncate" title={d.title}>{d.title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${stageInfo.color}`}>
                            <stageInfo.icon className="w-3 h-3" />
                            {rowStageLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rowStatusColor}`}>
                            {rowStatusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(d.opened_date)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{d.assigned_to_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => loadDetail(d.id)} className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg" title={t.common.details}>
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-gray-500">{total} {total > 1 ? t.sanctions.casesCount : t.sanctions.caseCount}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <ModalOverlay onClose={() => setShowCreateModal(false)}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary-500" /> {t.sanctions.newCase}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.referenceLabel} *</label>
              <input
                type="text"
                value={createForm.reference_number}
                onChange={e => setCreateForm(f => ({ ...f, reference_number: e.target.value }))}
                placeholder="CONT-2026-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.employeeLabel} *</label>
              <CustomSelect
                value={createForm.employee_id ? String(createForm.employee_id) : ''}
                onChange={v => setCreateForm(f => ({ ...f, employee_id: Number(v) }))}
                options={[{value:'', label: t.sanctions.selectEmployee}, ...employees.map(e => ({value: String(e.id), label: `${e.first_name} ${e.last_name}${e.department_name ? ` - ${e.department_name}` : ''}`}))]}
                className="w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.disputeSubjectLabel} *</label>
              <input
                type="text"
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                placeholder={t.sanctions.disputeSubjectPlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.description}</label>
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder={t.sanctions.descriptionPlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.openingDateLabel}</label>
              <input
                type="date"
                value={createForm.opened_date}
                onChange={e => setCreateForm(f => ({ ...f, opened_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.sanctions.assignedLawyerLabel}</label>
              <CustomSelect
                value={createForm.assigned_to_id ? String(createForm.assigned_to_id) : ''}
                onChange={v => setCreateForm(f => ({ ...f, assigned_to_id: Number(v) }))}
                options={[{value:'', label: t.sanctions.selectLawyerOption}, ...juristes.map(j => ({value: String(j.id), label: `${j.first_name} ${j.last_name}`}))]}
                className="w-full"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t.common.cancel}</button>
            <button
              onClick={handleCreate}
              disabled={isSaving || !createForm.employee_id || !createForm.title.trim() || !createForm.reference_number.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {t.sanctions.createCase}
            </button>
          </div>
        </ModalOverlay>
      )}
      </div>
    </div>
  );
}

// ── Modal Overlay Component ─────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
