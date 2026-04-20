'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  UserMinus, Clock, CheckCircle, XCircle, AlertTriangle, Send,
  Calendar, FileText, ChevronRight, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TYPES
// ============================================

interface MyResignation {
  id: number;
  status: string;
  reason: string | null;
  notification_date: string | null;
  requested_departure_date: string | null;
  notice_period_days: number;
  notice_end_date: string | null;
  effective_date: string | null;
  leave_balance_days: number;
  leave_compensation_amount: number;
  manager_validated_at: string | null;
  manager_comment: string | null;
  rh_validated_at: string | null;
  rh_comment: string | null;
  created_at: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-600 bg-gray-100',
  pending_manager: 'text-yellow-700 bg-yellow-100',
  pending_rh: 'text-orange-700 bg-orange-100',
  validated: 'text-green-700 bg-green-100',
  in_progress: 'text-blue-700 bg-blue-100',
  completed: 'text-emerald-700 bg-emerald-100',
  cancelled: 'text-gray-500 bg-gray-100',
};

function getStatusLabel(status: string, statuses: any): { label: string; color: string; description: string } {
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  const label = statuses[status] || status;
  const description = statuses[`${status}Desc`] || '';
  return { label, color, description };
}

// ============================================
// HELPERS
// ============================================

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ============================================
// COMPONENT
// ============================================

export default function ResignationPage() {
  const { t } = useI18n();
  const ts = t.mySpace.resignation;
  const [resignation, setResignation] = useState<MyResignation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [formReason, setFormReason] = useState('');
  const [formDetail, setFormDetail] = useState('');
  const [formDate, setFormDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  // Load existing resignation
  useEffect(() => {
    loadResignation();
  }, []);

  const loadResignation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/departures/my-resignation`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResignation(data.departure);
    } catch {
      // No resignation found is normal
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formDate) {
      toast.error(ts.missingDate);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/departures/my-resignation`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: formReason || null,
          detailed_reason: formDetail || null,
          requested_departure_date: formDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || ts.submissionError);
      }
      toast.success(ts.resignationSubmittedSuccess);
      setShowForm(false);
      loadResignation();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : ts.submissionError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!resignation) return;
    setConfirmDialog({
      isOpen: true,
      title: ts.cancelTitle,
      message: ts.cancelConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/api/departures/${resignation.id}/cancel`, {
            method: 'POST', headers: getAuthHeaders(),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || ts.cancelError);
          }
          toast.success(ts.resignationCancelled);
          loadResignation();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : ts.cancelError);
        }
      },
    });
  };

  if (loading) {
    return (
      <>
        <Header title={ts.title} subtitle={ts.subtitle} />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={ts.title} subtitle={ts.subtitle} />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {resignation ? (
          // Existing resignation — show status
          <>
            {/* Status card */}
            <div className={`rounded-xl border-2 p-6 ${
              resignation.status === 'cancelled' ? 'border-gray-200 bg-gray-50' :
              resignation.status === 'completed' ? 'border-emerald-200 bg-emerald-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  resignation.status === 'cancelled' ? 'bg-gray-200' :
                  resignation.status === 'completed' ? 'bg-emerald-200' :
                  'bg-blue-200'
                }`}>
                  <UserMinus className={`w-6 h-6 ${
                    resignation.status === 'cancelled' ? 'text-gray-600' :
                    resignation.status === 'completed' ? 'text-emerald-700' :
                    'text-blue-700'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{ts.resignationInProgress}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusLabel(resignation.status, ts.statuses).color}`}>
                      {getStatusLabel(resignation.status, ts.statuses).label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{getStatusLabel(resignation.status, ts.statuses).description}</p>
                  <p className="text-xs text-gray-400 mt-2">{ts.submittedOn} {formatDate(resignation.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{ts.trackingTitle}</h3>
              <div className="space-y-0">
                <TimelineStep
                  label={ts.resignationSubmitted}
                  done={true}
                  date={resignation.created_at}
                  isFirst
                  waitingLabel={ts.waiting}
                />
                <TimelineStep
                  label={ts.managerValidation}
                  done={!!resignation.manager_validated_at}
                  date={resignation.manager_validated_at}
                  active={resignation.status === 'pending_manager'}
                  comment={resignation.manager_comment}
                  waitingLabel={ts.waiting}
                />
                <TimelineStep
                  label={ts.rhValidation}
                  done={!!resignation.rh_validated_at}
                  date={resignation.rh_validated_at}
                  active={resignation.status === 'pending_rh'}
                  comment={resignation.rh_comment}
                  waitingLabel={ts.waiting}
                />
                <TimelineStep
                  label={ts.offboardingProcess}
                  done={['in_progress', 'completed'].includes(resignation.status)}
                  active={resignation.status === 'validated'}
                  waitingLabel={ts.waiting}
                />
                <TimelineStep
                  label={ts.departureFinalised}
                  done={resignation.status === 'completed'}
                  isLast
                  waitingLabel={ts.waiting}
                />
              </div>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">{ts.detailsTitle}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{ts.requestedDepartureDate}</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(resignation.requested_departure_date)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{ts.noticePeriod}</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{resignation.notice_period_days} {ts.days}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{ts.noticeEnd}</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(resignation.notice_end_date)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{ts.effectiveDate}</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(resignation.effective_date)}</p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">{ts.leaveBalance}</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">{ts.remainingDays}</span>
                  <span className="font-medium text-blue-900">{resignation.leave_balance_days} {ts.days}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-blue-700">{ts.estimatedCompensation}</span>
                  <span className="font-medium text-blue-900">{resignation.leave_compensation_amount.toLocaleString()} XOF</span>
                </div>
              </div>

              {resignation.reason && (
                <div>
                  <p className="text-xs text-gray-500">{ts.reason}</p>
                  <p className="text-sm text-gray-700 mt-1">{resignation.reason}</p>
                </div>
              )}
            </div>

            {/* Cancel button */}
            {['draft', 'pending_manager', 'pending_rh'].includes(resignation.status) && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-800">
                    {ts.cancelWarning}
                  </p>
                  <button onClick={handleCancel}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
                    <Ban className="w-4 h-4" /> {ts.cancelResignation}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          // No resignation — show form or prompt
          <>
            {!showForm ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserMinus className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{ts.submitResignation}</h2>
                <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                  {ts.submitDescription}
                </p>
                <button onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">
                  <Send className="w-4 h-4" /> {ts.startProcess}
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-3 sm:p-6 space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 pb-3 sm:pb-4 border-b">
                  <div className="p-2 bg-red-50 rounded-lg shrink-0">
                    <UserMinus className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">{ts.submitFormTitle}</h2>
                    <p className="text-xs sm:text-sm text-gray-500">{ts.submitFormSubtitle}</p>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    {ts.formWarning}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {ts.departureDate} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">{ts.departureReason}</label>
                    <input
                      type="text"
                      value={formReason}
                      onChange={e => setFormReason(e.target.value)}
                      placeholder={ts.departureReasonPlaceholder}
                      className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">{ts.additionalDetails}</label>
                    <textarea
                      value={formDetail}
                      onChange={e => setFormDetail(e.target.value)}
                      rows={3}
                      placeholder={ts.additionalDetailsPlaceholder}
                      className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                    {ts.cancel}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !formDate}
                    className="px-5 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    {submitting ? ts.sending : ts.submitBtn}
                  </button>
                </div>
              </div>
            )}
          </>
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

// ============================================
// TIMELINE STEP COMPONENT
// ============================================

function TimelineStep({ label, done, date, active, comment, isFirst, isLast, waitingLabel }: {
  label: string;
  done: boolean;
  date?: string | null;
  active?: boolean;
  comment?: string | null;
  isFirst?: boolean;
  isLast?: boolean;
  waitingLabel?: string;
}) {
  return (
    <div className="flex gap-3">
      {/* Line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          done ? 'bg-green-500' : active ? 'bg-yellow-500 animate-pulse' : 'bg-gray-200'
        }`}>
          {done ? (
            <CheckCircle className="w-4 h-4 text-white" />
          ) : active ? (
            <Clock className="w-4 h-4 text-white" />
          ) : (
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
          )}
        </div>
        {!isLast && <div className={`w-0.5 h-8 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />}
      </div>

      {/* Content */}
      <div className="pb-6">
        <p className={`text-sm font-medium ${done ? 'text-green-800' : active ? 'text-yellow-800' : 'text-gray-400'}`}>
          {label}
        </p>
        {done && date && (
          <p className="text-xs text-green-600 mt-0.5">
            {formatDate(date)}
          </p>
        )}
        {active && (
          <p className="text-xs text-yellow-600 mt-0.5">{waitingLabel || 'En attente...'}</p>
        )}
        {comment && (
          <p className="text-xs text-gray-500 mt-0.5 italic">&quot;{comment}&quot;</p>
        )}
      </div>
    </div>
  );
}
