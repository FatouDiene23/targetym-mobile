'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, CheckCircle, Clock, FileText, Loader2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { API_URL, fetchWithAuth } from '@/lib/api';

interface AbsenceReport {
  id: number;
  type: string;
  status: string;
  absence_date: string;
  expected_start_time?: string | null;
  actual_start_time?: string | null;
  duration_minutes?: number | null;
  reason?: string | null;
  notes?: string | null;
  document?: string | null;
  reporter_name?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  absence: 'Absence',
  tardiness: 'Retard',
  early_departure: 'Départ anticipé',
  unauthorized_absence: 'Absence non autorisée',
  sick_leave: 'Arrêt maladie',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de traitement RH',
  notified: 'Notifié',
  justified: 'Justifié',
  unjustified: 'Injustifié',
};

async function getMyReports(): Promise<AbsenceReport[]> {
  const response = await fetchWithAuth(`${API_URL}/api/absences/mine`);
  if (!response.ok) throw new Error('Impossible de charger vos constats');
  return response.json();
}

async function sendResponse(reportId: number, reason: string, document: string) {
  const response = await fetchWithAuth(`${API_URL}/api/absences/${reportId}/employee-response`, {
    method: 'PUT',
    body: JSON.stringify({ reason: reason || null, document: document || null }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "Impossible d'enregistrer votre réponse");
  }
}

function MyAbsencesContent() {
  const searchParams = useSearchParams();
  const highlightedId = Number(searchParams.get('report_id')) || null;
  const [reports, setReports] = useState<AbsenceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<number | null>(highlightedId);
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setReports(await getMyReports());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const submitResponse = async (reportId: number) => {
    if (!reason.trim() && !document.trim()) {
      toast.error('Ajoutez une explication ou un lien vers un justificatif');
      return;
    }
    setSaving(true);
    try {
      await sendResponse(reportId, reason.trim(), document.trim());
      toast.success('Votre réponse a été transmise aux RH');
      setRespondingId(null);
      setReason('');
      setDocument('');
      await loadReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="Mes constats d'absence" subtitle="Consultez les constats et transmettez vos explications aux RH" />
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement...
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-300" />
            Aucun constat d'absence ou de retard ne vous concerne.
          </div>
        ) : reports.map(report => {
          const canRespond = report.status === 'pending' || report.status === 'notified';
          return (
            <div
              key={report.id}
              className={`rounded-xl border bg-white p-5 shadow-sm ${highlightedId === report.id ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{TYPE_LABELS[report.type] || report.type}</h2>
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                      {STATUS_LABELS[report.status] || report.status}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    {new Date(report.absence_date).toLocaleDateString('fr-FR')}
                  </p>
                  {report.duration_minutes && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="h-4 w-4" /> {report.duration_minutes} minutes
                    </p>
                  )}
                  {report.reporter_name && <p className="mt-1 text-xs text-gray-400">Constaté par {report.reporter_name}</p>}
                </div>
                {canRespond && (
                  <button
                    type="button"
                    onClick={() => {
                      setRespondingId(respondingId === report.id ? null : report.id);
                      setReason(report.reason || '');
                      setDocument(report.document || '');
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
                  >
                    <MessageSquare className="h-4 w-4" /> Répondre
                  </button>
                )}
              </div>

              {report.notes && (
                <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <span className="font-medium">Observation :</span> {report.notes}
                </div>
              )}
              {report.reason && respondingId !== report.id && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <span className="font-medium">Votre explication :</span> {report.reason}
                </div>
              )}
              {report.document && respondingId !== report.id && (
                <a href={report.document} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
                  <FileText className="h-4 w-4" /> Voir le justificatif
                </a>
              )}

              {respondingId === report.id && canRespond && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    placeholder="Expliquez la situation..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400"
                  />
                  <input
                    type="url"
                    value={document}
                    onChange={event => setDocument(event.target.value)}
                    placeholder="Lien vers un justificatif (facultatif)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setRespondingId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">Annuler</button>
                    <button type="button" disabled={saving} onClick={() => submitResponse(report.id)} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                      {saving ? 'Envoi...' : 'Transmettre aux RH'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function MyAbsencesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
      <MyAbsencesContent />
    </Suspense>
  );
}
