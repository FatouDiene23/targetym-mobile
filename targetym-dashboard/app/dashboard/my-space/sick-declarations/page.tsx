'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, FileText, Heart, Loader2, Plus, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { API_URL, fetchWithAuth } from '@/lib/api';
import CustomDatePicker from '@/components/CustomDatePicker';

interface UserProfile {
  id: number;
  employee_id?: number;
}

interface SickDeclaration {
  id: number;
  employee_id: number;
  sick_start_date: string;
  estimated_duration_days: number;
  estimated_end_date: string;
  actual_end_date?: string | null;
  certificate_url?: string | null;
  certificate_filename?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR');
}

function statusLabel(status: string) {
  if (status === 'active' || status === 'prolongee') return 'En cours';
  if (status === 'guerie_retour_travail' || status === 'cloture') return 'Cloturee';
  return status;
}

function statusClass(status: string) {
  if (status === 'active' || status === 'prolongee') return 'bg-orange-100 text-orange-800';
  if (status === 'guerie_retour_travail' || status === 'cloture') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}

async function getCurrentUser(): Promise<UserProfile> {
  const res = await fetchWithAuth(`${API_URL}/api/auth/me`);
  if (!res.ok) throw new Error('Impossible de charger votre profil');
  return res.json();
}

async function getDeclarations(employeeId: number): Promise<SickDeclaration[]> {
  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/?employee_id=${employeeId}&standalone=true`);
  if (!res.ok) throw new Error('Erreur lors du chargement des declarations');
  return res.json();
}

async function createDeclaration(payload: {
  sick_start_date: string;
  estimated_duration_days: number;
  notes?: string;
  certificate?: File | null;
}) {
  const formData = new FormData();
  formData.append('sick_start_date', payload.sick_start_date);
  formData.append('estimated_duration_days', String(payload.estimated_duration_days));
  if (payload.notes) formData.append('notes', payload.notes);
  if (payload.certificate) formData.append('certificate', payload.certificate);

  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la declaration');
  }
}

async function closeDeclaration(id: number) {
  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/${id}/recover`, {
    method: 'PUT',
    body: JSON.stringify({ recovery_type: 'return_to_work' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la cloture');
  }
}

async function uploadCertificate(id: number, certificate: File) {
  const formData = new FormData();
  formData.append('certificate', certificate);

  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/${id}/certificate`, {
    method: 'PUT',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de l'envoi du justificatif");
  }
}

function CertificateModal({
  declaration,
  onClose,
  onSuccess,
}: {
  declaration: SickDeclaration;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('Justificatif requis');
      return;
    }
    setSubmitting(true);
    try {
      await uploadCertificate(declaration.id, file);
      toast.success('Justificatif enregistré');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <form onSubmit={submit} className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-500" />
              Justificatif maladie
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <input
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="w-full text-sm text-gray-700"
          />

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? 'Envoi...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeclarationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [sickStartDate, setSickStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(1);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createDeclaration({
        sick_start_date: sickStartDate,
        estimated_duration_days: duration,
        notes: notes || undefined,
        certificate: file,
      });
      toast.success('Declaration maladie enregistree');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <form onSubmit={submit} className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-500" />
              Declarer une maladie
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de debut</label>
            <CustomDatePicker value={sickStartDate} onChange={(v) => setSickStartDate(v)} className="w-full" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duree estimee (jours)</label>
            <input
              type="number"
              min={1}
              required
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value) || 1)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Justificatif (facultatif)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? 'Envoi...' : 'Declarer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MySickDeclarationsPage() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [declarations, setDeclarations] = useState<SickDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [certificateDeclaration, setCertificateDeclaration] = useState<SickDeclaration | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user.employee_id) throw new Error('Profil employe introuvable');
      setEmployeeId(user.employee_id);
      setDeclarations(await getDeclarations(user.employee_id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCount = declarations.filter((item) => item.status === 'active' || item.status === 'prolongee').length;
  const closedCount = declarations.length - activeCount;

  return (
    <>
      <Header title="Mes declarations maladie" />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes declarations maladie</h1>
            <p className="text-sm text-gray-500 mt-1">Declarations hors conges, avec justificatif facultatif.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" />
            Declarer une maladie
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">Total</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{declarations.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">En cours</div>
            <div className="mt-1 text-2xl font-bold text-orange-600">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">Cloturees</div>
            <div className="mt-1 text-2xl font-bold text-green-600">{closedCount}</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Chargement...
            </div>
          ) : declarations.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune declaration maladie pour le moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {declarations.map((item) => (
                <div key={item.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">Declaration #{item.id}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(item.sick_start_date)} {'->'} {formatDate(item.actual_end_date || item.estimated_end_date)}
                      {!item.actual_end_date && <span className="text-xs text-gray-500"> (estime)</span>}
                    </p>
                    {item.notes && <p className="text-sm text-gray-500 mt-1">{item.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.certificate_url ? (
                      <a href={item.certificate_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                        <FileText className="w-4 h-4" />
                        Justificatif
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">Aucun justificatif</span>
                    )}
                    {(item.status === 'active' || item.status === 'prolongee') && (
                      <>
                        <button
                          onClick={() => setCertificateDeclaration(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-50"
                        >
                          <Upload className="w-4 h-4" />
                          {item.certificate_url ? 'Remplacer' : 'Ajouter'}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await closeDeclaration(item.id);
                              toast.success('Declaration cloturee');
                              await loadData();
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'Erreur');
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Cloturer
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <DeclarationModal
          onClose={() => setShowModal(false)}
          onSuccess={loadData}
        />
      )}
      {certificateDeclaration && (
        <CertificateModal
          declaration={certificateDeclaration}
          onClose={() => setCertificateDeclaration(null)}
          onSuccess={loadData}
        />
      )}
    </>
  );
}
