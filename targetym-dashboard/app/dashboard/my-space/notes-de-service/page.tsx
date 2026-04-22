'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, FileText, Paperclip, Clock, CheckCircle, X, Download, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';
import { fetchWithAuth, API_URL } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

interface ServiceNote {
  id: number;
  titre: string;
  contenu: string;
  statut: 'publiee';
  scope: string;
  attachment_url?: string;
  attachment_name?: string;
  published_at: string;
  total_recipients: number;
  read_count: number;
  read_percentage: number;
  is_read: boolean;
}

type FilterKey = 'toutes' | 'non_lues' | 'lues';

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── API ─────────────────────────────────────────────────────────────────────

async function fetchMyNotes(): Promise<ServiceNote[]> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/`);
  if (!res.ok) throw new Error('Erreur lors du chargement des notes');
  return res.json();
}

async function markAsRead(id: number): Promise<void> {
  const res = await fetchWithAuth(`${API_URL}/api/service-notes/${id}/mark-read`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur');
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MesNotesDeServicePage() {
  const { t: i18n } = useI18n();
  const [notes, setNotes] = useState<ServiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('toutes');
  const [selectedNote, setSelectedNote] = useState<ServiceNote | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMyNotes();
      setNotes(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // ── Mark as read ────────────────────────────────────────────────────────

  const handleMarkAsRead = async (note: ServiceNote) => {
    if (note.is_read) return;
    try {
      await markAsRead(note.id);
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, is_read: true } : n))
      );
      if (selectedNote?.id === note.id) {
        setSelectedNote((prev) => (prev ? { ...prev, is_read: true } : prev));
      }
    } catch {
      // silent — non-blocking
    }
  };

  const handleOpenDetail = (note: ServiceNote) => {
    setSelectedNote(note);
    if (!note.is_read) {
      handleMarkAsRead(note);
    }
  };

  // ── Filtered notes ──────────────────────────────────────────────────────

  const filteredNotes = notes.filter((n) => {
    if (filter === 'non_lues') return !n.is_read;
    if (filter === 'lues') return n.is_read;
    return true;
  });

  const unreadCount = notes.filter((n) => !n.is_read).length;

  // ── Filter tabs ─────────────────────────────────────────────────────────

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'toutes', label: `${i18n.serviceNotes.all} (${notes.length})` },
    { key: 'non_lues', label: `${i18n.serviceNotes.unread} (${unreadCount})` },
    { key: 'lues', label: `${i18n.serviceNotes.read} (${notes.length - unreadCount})` },
  ];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={i18n.serviceNotes.myTitle} hideAddButton />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Badge + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{i18n.serviceNotes.receivedNotes}</h2>
            {unreadCount > 0 && (
              <span className="bg-primary-600 text-white rounded-full px-2.5 py-0.5 text-xs font-medium">
                {unreadCount} {i18n.serviceNotes.unread}
              </span>
            )}
          </div>

          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  filter === f.key
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">
              {filter === 'non_lues'
                ? i18n.serviceNotes.noUnread
                : i18n.serviceNotes.noNotes}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleOpenDetail(note)}
                className={`w-full text-left rounded-xl border p-4 transition hover:shadow-md ${
                  note.is_read
                    ? 'border-l-4 border-l-gray-200 border-gray-200 bg-gray-50'
                    : 'border-l-4 border-l-primary-500 border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!note.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                      )}
                      <h3 className={`text-sm font-semibold truncate ${note.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                        {note.titre}
                      </h3>
                      {note.attachment_name && (
                        <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{note.contenu}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatDate(note.published_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!note.is_read && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleMarkAsRead(note); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {i18n.serviceNotes.markAsRead}
                      </span>
                    )}
                    {note.is_read && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-500">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {i18n.serviceNotes.read}
                      </span>
                    )}
                    <Eye className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{selectedNote.titre}</h2>
                {selectedNote.is_read ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3" /> {i18n.serviceNotes.read}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    {i18n.serviceNotes.newBadge}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <div className="text-sm text-gray-400 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {i18n.serviceNotes.publishedAt} {formatDate(selectedNote.published_at)}
              </div>

              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {selectedNote.contenu}
              </div>

              {selectedNote.attachment_url && selectedNote.attachment_name && (
                <a
                  href={selectedNote.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700"
                >
                  <Download className="w-4 h-4" />
                  {selectedNote.attachment_name}
                </a>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-2xl">
              {!selectedNote.is_read ? (
                <button
                  onClick={() => handleMarkAsRead(selectedNote)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  {i18n.serviceNotes.markAsRead}
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setSelectedNote(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                {i18n.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
