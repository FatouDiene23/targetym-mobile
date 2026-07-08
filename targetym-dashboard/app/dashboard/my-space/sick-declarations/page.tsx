'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, FileText, Heart, Loader2, Plus, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import CustomDatePicker from '@/components/CustomDatePicker';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useI18n } from '@/lib/i18n/I18nContext';
import { API_URL, fetchWithAuth } from '@/lib/api';

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

function isActiveStatus(status: string) {
  return status === 'active' || status === 'prolongee';
}

async function getCurrentUser(): Promise<UserProfile> {
  const res = await fetchWithAuth(`${API_URL}/api/auth/me`);
  if (!res.ok) throw new Error('profile');
  return res.json();
}

async function getDeclarations(employeeId: number): Promise<SickDeclaration[]> {
  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/?employee_id=${employeeId}&standalone=true`);
  if (!res.ok) throw new Error('loadList');
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
    throw new Error(err.detail || 'create');
  }
}

async function closeDeclaration(id: number) {
  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/${id}/recover`, {
    method: 'PUT',
    body: JSON.stringify({ recovery_type: 'return_to_work' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'close');
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
    throw new Error(err.detail || 'certificate');
  }
}

function CertificateModal({
  declaration,
  ts,
  onClose,
  onSuccess,
}: {
  declaration: SickDeclaration;
  ts: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error(ts.certificateModal.required);
      return;
    }
    setSubmitting(true);
    try {
      await uploadCertificate(declaration.id, file);
      toast.success(ts.certificateModal.success);
      onSuccess();
      onClose();
    } catch {
      toast.error(ts.errors.certificate);
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
              {ts.certificateModal.title}
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
              {ts.certificateModal.cancel}
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? ts.certificateModal.submitting : ts.certificateModal.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeclarationModal({ ts, onClose, onSuccess }: { ts: any; onClose: () => void; onSuccess: () => void }) {
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
      toast.success(ts.modal.success);
      onSuccess();
      onClose();
    } catch {
      toast.error(ts.errors.create);
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
              {ts.modal.title}
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{ts.modal.startDate}</label>
            <CustomDatePicker
              value={sickStartDate}
              onChange={setSickStartDate}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{ts.modal.duration}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{ts.modal.certificate}</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{ts.modal.notes}</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
              {ts.modal.cancel}
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? ts.modal.submitting : ts.modal.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MySickDeclarationsPage() {
  const { t } = useI18n();
  const ts = t.mySpace.sickDeclarations;

  const [declarations, setDeclarations] = useState<SickDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [certificateDeclaration, setCertificateDeclaration] = useState<SickDeclaration | null>(null);
  const [closingDeclaration, setClosingDeclaration] = useState<SickDeclaration | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user.employee_id) throw new Error('noProfile');
      setDeclarations(await getDeclarations(user.employee_id));
    } catch {
      toast.error(ts.errors.loadGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCount = declarations.filter((item) => isActiveStatus(item.status)).length;
  const closedCount = declarations.length - activeCount;

  const confirmClose = async () => {
    if (!closingDeclaration) return;
    try {
      await closeDeclaration(closingDeclaration.id);
      toast.success(ts.closeSuccess);
      await loadData();
    } catch {
      toast.error(ts.errors.close);
    } finally {
      setClosingDeclaration(null);
    }
  };

  return (
    <>
      <Header title={ts.title} />
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{ts.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{ts.subtitle}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" />
            {ts.declareButton}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">{ts.statTotal}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{declarations.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">{ts.statActive}</div>
            <div className="mt-1 text-2xl font-bold text-orange-600">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">{ts.statClosed}</div>
            <div className="mt-1 text-2xl font-bold text-green-600">{closedCount}</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {ts.loading}
            </div>
          ) : declarations.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{ts.emptyState}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {declarations.map((item) => (
                <div key={item.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{ts.declarationLabel} #{item.id}</span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          isActiveStatus(item.status) ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {isActiveStatus(item.status) ? ts.statusActive : ts.statusClosed}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(item.sick_start_date)} {'->'} {formatDate(item.actual_end_date || item.estimated_end_date)}
                      {!item.actual_end_date && <span className="text-xs text-gray-500"> {ts.estimatedSuffix}</span>}
                    </p>
                    {item.notes && <p className="text-sm text-gray-500 mt-1">{item.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.certificate_url ? (
                      <a href={item.certificate_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                        <FileText className="w-4 h-4" />
                        {ts.certificateLink}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">{ts.noCertificate}</span>
                    )}
                    {isActiveStatus(item.status) && (
                      <>
                        <button
                          onClick={() => setCertificateDeclaration(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-50"
                        >
                          <Upload className="w-4 h-4" />
                          {item.certificate_url ? ts.replaceCertificate : ts.addCertificate}
                        </button>
                        <button
                          onClick={() => setClosingDeclaration(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {ts.closeAction}
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
          ts={ts}
          onClose={() => setShowModal(false)}
          onSuccess={loadData}
        />
      )}
      {certificateDeclaration && (
        <CertificateModal
          declaration={certificateDeclaration}
          ts={ts}
          onClose={() => setCertificateDeclaration(null)}
          onSuccess={loadData}
        />
      )}
      <ConfirmDialog
        isOpen={!!closingDeclaration}
        onClose={() => setClosingDeclaration(null)}
        onConfirm={confirmClose}
        title={ts.closeAction}
        message={ts.closeSuccess}
      />
    </>
  );
}
