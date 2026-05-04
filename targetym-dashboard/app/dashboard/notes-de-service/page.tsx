'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Loader2, Search, FileText, Paperclip, Eye,
  Edit3, Send, Archive, Trash2, CheckCircle, Clock,
  Users, Download, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { Translations } from '@/lib/i18n/index';
import { fetchWithAuth, API_URL, getDepartments, getEmployees, type Employee } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

interface ServiceNote {
  id: number;
  titre: string;
  contenu: string;
  statut: 'brouillon' | 'publiee' | 'archivee';
  scope: 'tous' | 'departement' | 'individuel';
  attachment_url?: string;
  attachment_name?: string;
  created_by: number;
  published_at?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
  total_recipients: number;
  read_count: number;
  read_percentage: number;
  is_read?: boolean;
}

interface Reader {
  employee_id: number;
  name: string;
  is_read: boolean;
  read_at?: string;
}

interface Department {
  id: number;
  name: string;
}

type TabKey = 'publiee' | 'brouillon' | 'archivee';

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  publiee: 'bg-green-100 text-green-700',
  archivee: 'bg-orange-100 text-orange-700',
};

const ROLES_RH = ['rh', 'admin', 'dg', 'super_admin'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getUserRole(): string {
  if (typeof window === 'undefined') return 'employee';
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return (user.role || 'employee').toLowerCase();
    }
  } catch { /* ignore */ }
  return 'employee';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── API Functions ───────────────────────────────────────────────────────────

async function fetchNotes(statut?: string): Promise<ServiceNote[]> {
  const url = statut
    ? `${API_URL}/api/service-notes/?statut=${statut}`
    : `${API_URL}/api/service-notes/`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error('Erreur lors du chargement des notes');
  return res.json();
}

async function createNote(data: {
  titre: string;
  contenu: string;
  scope: string;
  department_ids?: number[];
  employee_ids?: number[];
  attachment_url?: string;
  attachment_name?: string;
}): Promise<ServiceNote> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la création');
  }
  return res.json();
}

async function updateNote(id: number, data: Record<string, unknown>): Promise<ServiceNote> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la mise à jour');
  }
  return res.json();
}

async function publishNote(id: number): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/${id}/publish`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la publication');
  }
  return res.json();
}

async function archiveNote(id: number): Promise<void> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/${id}/archive`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de l'archivage");
  }
}

async function deleteNote(id: number): Promise<void> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la suppression');
  }
}

async function fetchReaders(id: number): Promise<Reader[]> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/${id}/readers`);
  if (!res.ok) throw new Error('Erreur lors du chargement des lecteurs');
  return res.json();
}

async function uploadAttachment(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const res = await fetch(`${API_URL}/api/media/upload-document`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error("Erreur lors de l'upload");
  return res.json();
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function NotesDeServicePage() {
  const { t: i18n } = useI18n();
  const [notes, setNotes] = useState<ServiceNote[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('publiee');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ServiceNote | null>(null);
  const [selectedNote, setSelectedNote] = useState<ServiceNote | null>(null);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [readersFilter, setReadersFilter] = useState<'all' | 'read' | 'unread'>('all');

  // Role
  const [userRole, setUserRole] = useState('employee');
  const isRH = ROLES_RH.includes(userRole);

  useEffect(() => {
    setUserRole(getUserRole());
  }, []);

  // ── Data loading ────────────────────────────────────────────────────────

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNotes(activeTab);
      setNotes(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handlePublish = async (id: number) => {
    if (!confirm('Publier cette note ? Elle sera envoyée aux destinataires.')) return;
    try {
      const result = await publishNote(id);
      toast.success(result.message);
      loadNotes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleArchive = async (id: number) => {
    if (!confirm('Archiver cette note ?')) return;
    try {
      await archiveNote(id);
      toast.success('Note archivée');
      loadNotes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce brouillon ? Cette action est irréversible.')) return;
    try {
      await deleteNote(id);
      toast.success('Brouillon supprimé');
      loadNotes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleViewDetail = async (note: ServiceNote) => {
    setSelectedNote(note);
    setShowDetailModal(true);
    if (isRH) {
      try {
        const data = await fetchReaders(note.id);
        setReaders(data);
      } catch {
        setReaders([]);
      }
    }
  };

  const handleEdit = (note: ServiceNote) => {
    setEditingNote(note);
    setShowCreateModal(true);
  };

  const handleCreateSaved = () => {
    setShowCreateModal(false);
    setEditingNote(null);
    loadNotes();
  };

  // ── Filtered notes ──────────────────────────────────────────────────────

  const filteredNotes = notes.filter((n) =>
    n.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.contenu.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Tabs ────────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'publiee', label: i18n.serviceNotes.published, icon: <Send className="w-4 h-4" /> },
    { key: 'brouillon', label: i18n.serviceNotes.drafts, icon: <Edit3 className="w-4 h-4" /> },
    { key: 'archivee', label: i18n.serviceNotes.archives, icon: <Archive className="w-4 h-4" /> },
  ];

  // ── Filtered readers ────────────────────────────────────────────────────

  const filteredReaders = readers.filter((r) => {
    if (readersFilter === 'read') return r.is_read;
    if (readersFilter === 'unread') return !r.is_read;
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={i18n.serviceNotes.title} hideAddButton />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={i18n.serviceNotes.searchNote}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {isRH && (
            <button
              onClick={() => { setEditingNote(null); setShowCreateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {i18n.serviceNotes.newNote}
            </button>
          )}
        </div>

        {/* Tabs */}
        {isRH && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === tab.key
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">{i18n.serviceNotes.noNotes}</p>
            <p className="text-sm mt-1">
              {activeTab === 'brouillon'
                ? i18n.serviceNotes.noNotesDraft
                : activeTab === 'publiee'
                ? i18n.serviceNotes.noNotesPublished
                : i18n.serviceNotes.noNotesArchived}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isRH={isRH}
                i18n={i18n}
                onView={() => handleViewDetail(note)}
                onEdit={() => handleEdit(note)}
                onPublish={() => handlePublish(note.id)}
                onArchive={() => handleArchive(note.id)}
                onDelete={() => handleDelete(note.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <CreateEditModal
          note={editingNote}
          i18n={i18n}
          onClose={() => { setShowCreateModal(false); setEditingNote(null); }}
          onSaved={handleCreateSaved}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedNote && (
        <DetailModal
          note={selectedNote}
          readers={filteredReaders}
          readersFilter={readersFilter}
          onFilterChange={setReadersFilter}
          isRH={isRH}
          i18n={i18n}
          onClose={() => { setShowDetailModal(false); setSelectedNote(null); setReaders([]); setReadersFilter('all'); }}
        />
      )}
    </div>
  );
}

// ── NoteCard ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  isRH,
  i18n,
  onView,
  onEdit,
  onPublish,
  onArchive,
  onDelete,
}: {
  note: ServiceNote;
  isRH: boolean;
  i18n: Translations;
  onView: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const statusColor = STATUS_COLORS[note.statut] || STATUS_COLORS.brouillon;
  const statusLabel = i18n.serviceNotes.statuses[note.statut as keyof typeof i18n.serviceNotes.statuses] || note.statut;
  const scopeLabels: Record<string, string> = {
    tous: i18n.serviceNotes.everyone,
    departement: i18n.serviceNotes.byDepartment,
    individuel: i18n.serviceNotes.individual,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">{note.titre}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            {note.attachment_name && (
              <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
          </div>

          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{note.contenu}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {scopeLabels[note.scope] || note.scope}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {note.statut === 'publiee'
                ? formatDate(note.published_at)
                : formatDate(note.created_at)}
            </span>
          </div>

          {/* Read progress bar for published notes */}
          {note.statut === 'publiee' && note.total_recipients > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  {note.read_count}/{note.total_recipients} {i18n.serviceNotes.haveRead} ({note.read_percentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(note.read_percentage, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Employee read status */}
          {!isRH && note.is_read !== null && note.is_read !== undefined && (
            <div className="mt-2">
              {note.is_read ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" /> {i18n.serviceNotes.read}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-orange-500">
                  <Clock className="w-3.5 h-3.5" /> {i18n.serviceNotes.unread}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {note.statut === 'brouillon' && isRH && (
            <>
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                title={i18n.common.edit}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={onPublish}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                title={i18n.serviceNotes.publish}
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title={i18n.common.delete}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {note.statut === 'publiee' && (
            <>
              <button
                onClick={onView}
                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                title={i18n.common.details}
              >
                <Eye className="w-4 h-4" />
              </button>
              {isRH && (
                <button
                  onClick={onArchive}
                  className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                  title={i18n.serviceNotes.archive}
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          {note.statut === 'archivee' && (
            <button
              onClick={onView}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
              title={i18n.common.details}
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CreateEditModal ─────────────────────────────────────────────────────────

function CreateEditModal({
  note,
  i18n,
  onClose,
  onSaved,
}: {
  note: ServiceNote | null;
  i18n: Translations;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!note;
  const [titre, setTitre] = useState(note?.titre || '');
  const [contenu, setContenu] = useState(note?.contenu || '');
  const [scope, setScope] = useState<string>(note?.scope || 'tous');
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [attachmentUrl, setAttachmentUrl] = useState(note?.attachment_url || '');
  const [attachmentName, setAttachmentName] = useState(note?.attachment_name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [empSearch, setEmpSearch] = useState('');

  // Department / employee lists for selectors
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const filteredDepts = departments.filter((d) =>
    d.name.toLowerCase().includes(deptSearch.toLowerCase())
  );
  const filteredEmps = employees.filter((e) =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.position && e.position.toLowerCase().includes(empSearch.toLowerCase()))
  );

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {});
    getEmployees({ page_size: 200 }).then((r) => setEmployees(r.items || [])).catch(() => {});
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const result = await uploadAttachment(file);
      setAttachmentUrl(result.url);
      setAttachmentName(file.name);
      toast.success('Fichier uploadé');
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (andPublish: boolean) => {
    if (!titre.trim() || !contenu.trim()) {
      toast.error('Le titre et le contenu sont requis');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        titre: titre.trim(),
        contenu: contenu.trim(),
        scope,
        department_ids: scope === 'departement' ? departmentIds : [],
        employee_ids: scope === 'individuel' ? employeeIds : [],
        attachment_url: attachmentUrl || undefined,
        attachment_name: attachmentName || undefined,
      };
      let savedNote: ServiceNote;
      if (isEdit && note) {
        savedNote = await updateNote(note.id, payload);
      } else {
        savedNote = await createNote(payload);
      }
      if (andPublish) {
        await publishNote(savedNote.id);
        toast.success('Note publiée avec succès');
      } else {
        toast.success(isEdit ? 'Brouillon mis à jour' : 'Brouillon enregistré');
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? i18n.serviceNotes.editNote : i18n.serviceNotes.newNoteTitle}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.serviceNotes.titleLabel} *</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder={i18n.serviceNotes.titlePlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.serviceNotes.contentLabel} *</label>
            <textarea
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={6}
              placeholder={i18n.serviceNotes.contentPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
            />
          </div>

          {/* Scope / Destinataires */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{i18n.serviceNotes.scope}</label>
            <div className="flex gap-3">
              {(['tous', 'departement', 'individuel'] as const).map((s) => {
                const scopeLabels: Record<string, string> = {
                  tous: i18n.serviceNotes.everyone,
                  departement: i18n.serviceNotes.byDepartment,
                  individuel: i18n.serviceNotes.individual,
                };
                return (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === s}
                    onChange={() => { setScope(s); setDeptSearch(''); setEmpSearch(''); }}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">{scopeLabels[s]}</span>
                </label>
                );
              })}
            </div>

            {/* Department multi-select */}
            {scope === 'departement' && (
              <div className="mt-3">
                <label className="block text-sm text-gray-500 mb-1">{i18n.serviceNotes.selectDepartments}</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder={i18n.serviceNotes.searchDepartment}
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                    {filteredDepts.map((dept) => (
                      <label key={dept.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={departmentIds.includes(dept.id)}
                          onChange={() =>
                            setDepartmentIds((prev) =>
                              prev.includes(dept.id)
                                ? prev.filter((id) => id !== dept.id)
                                : [...prev, dept.id]
                            )
                          }
                          className="text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{dept.name}</span>
                      </label>
                    ))}
                    {filteredDepts.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-2">Aucun résultat</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Employee multi-select */}
            {scope === 'individuel' && (
              <div className="mt-3">
                <label className="block text-sm text-gray-500 mb-1">{i18n.serviceNotes.selectEmployees}</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder={i18n.serviceNotes.searchEmployee}
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                    {filteredEmps.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={employeeIds.includes(emp.id)}
                          onChange={() =>
                            setEmployeeIds((prev) =>
                              prev.includes(emp.id)
                                ? prev.filter((id) => id !== emp.id)
                                : [...prev, emp.id]
                            )
                          }
                          className="text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">
                          {emp.first_name} {emp.last_name}
                          {emp.position && (
                            <span className="text-gray-400 ml-1">- {emp.position}</span>
                          )}
                        </span>
                      </label>
                    ))}
                    {filteredEmps.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-2">Aucun résultat</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.serviceNotes.attachment}</label>
            {attachmentName ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Paperclip className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 flex-1 truncate">{attachmentName}</span>
                <button
                  onClick={() => { setAttachmentUrl(''); setAttachmentName(''); }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                ) : (
                  <>
                    <Paperclip className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500">{i18n.serviceNotes.addFile}</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            {i18n.common.cancel}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
            {i18n.serviceNotes.saveDraft}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {i18n.serviceNotes.publishDirectly}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DetailModal ─────────────────────────────────────────────────────────────

function DetailModal({
  note,
  readers,
  readersFilter,
  onFilterChange,
  isRH,
  i18n,
  onClose,
}: {
  note: ServiceNote;
  readers: Reader[];
  readersFilter: 'all' | 'read' | 'unread';
  onFilterChange: (f: 'all' | 'read' | 'unread') => void;
  isRH: boolean;
  i18n: Translations;
  onClose: () => void;
}) {
  const statusColor = STATUS_COLORS[note.statut] || STATUS_COLORS.brouillon;
  const statusLabel = i18n.serviceNotes.statuses[note.statut as keyof typeof i18n.serviceNotes.statuses] || note.statut;
  const totalReaders = readers.length || note.total_recipients;
  const readCount = readers.filter((r) => r.is_read).length || note.read_count;
  const readPct = totalReaders > 0 ? Math.round((readCount / totalReaders) * 100 * 10) / 10 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{note.titre}</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {({tous: i18n.serviceNotes.everyone, departement: i18n.serviceNotes.byDepartment, individuel: i18n.serviceNotes.individual} as Record<string,string>)[note.scope] || note.scope}
            </span>
            {note.published_at && (
              <span className="flex items-center gap-1">
                <Send className="w-4 h-4" />
                {i18n.serviceNotes.publishedAt} {formatDate(note.published_at)}
              </span>
            )}
            {note.archived_at && (
              <span className="flex items-center gap-1">
                <Archive className="w-4 h-4" />
                {i18n.serviceNotes.archivedAt} {formatDate(note.archived_at)}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {note.contenu}
          </div>

          {/* Attachment */}
          {note.attachment_url && note.attachment_name && (
            <a
              href={note.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700"
            >
              <Download className="w-4 h-4" />
              {note.attachment_name}
            </a>
          )}

          {/* Readers section (RH only) */}
          {isRH && note.statut !== 'brouillon' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {i18n.serviceNotes.readReceipts}
              </h3>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>{readCount} / {totalReaders} {i18n.serviceNotes.haveRead}</span>
                  <span className="font-medium">{readPct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(readPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-3">
                {(['all', 'read', 'unread'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => onFilterChange(f)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      readersFilter === f
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f === 'all' ? `${i18n.serviceNotes.all} (${readers.length})` : f === 'read' ? `${i18n.serviceNotes.read} (${readers.filter((r) => r.is_read).length})` : `${i18n.serviceNotes.unread} (${readers.filter((r) => !r.is_read).length})`}
                  </button>
                ))}
              </div>

              {/* Reader list */}
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {readers.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400 text-center">{i18n.serviceNotes.noRecipients}</p>
                ) : (
                  readers
                    .filter((r) => {
                      if (readersFilter === 'read') return r.is_read;
                      if (readersFilter === 'unread') return !r.is_read;
                      return true;
                    })
                    .map((reader) => (
                      <div key={reader.employee_id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                            {reader.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{reader.name}</span>
                        </div>
                        {reader.is_read ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Lu le {formatDate(reader.read_at)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            Pas encore lu
                          </span>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
