// ============================================
// app/dashboard/talents/my-promotions/page.tsx
// Vue employé — Mes demandes de promotion
// ============================================

'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { myPromotionsTips } from '@/config/pageTips';
import {
  ArrowUpRight, CheckCircle2, Clock, XCircle, AlertCircle,
  Trophy, ChevronRight, MessageSquare
} from 'lucide-react';
import { apiFetch, formatDate, ELIGIBILITY_LABELS } from '../shared';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useI18n } from '@/lib/i18n/I18nContext';

export default function MyPromotionsPage() {
  const { t } = useI18n();
  const tp = t.talents.myPromotions;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('myPromotions');

  const load = async () => {
    try {
      const res = await apiFetch('/api/careers/employees/my-career');
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRequestPromotion = async (ecId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: tp.promotionRequestTitle,
      message: tp.promotionRequestMessage,
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setRequesting(true);
        setRequestSuccess(false);
        try {
          await apiFetch('/api/careers/promotions/request', {
            method: 'POST',
            body: JSON.stringify({ employee_career_id: ecId }),
          });
          setRequestSuccess(true);
          await load();
          toast.success(tp.requestSent);
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setRequesting(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <>
        {showTips && (
          <PageTourTips tips={myPromotionsTips} onDismiss={dismissTips} pageTitle={tp.title} />
        )}
        <Header title={tp.title} subtitle={tp.loading} />
        <main className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title={tp.title} subtitle={tp.error} />
        <main className="flex-1 p-6 bg-gray-50">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        </main>
      </>
    );
  }

  if (!data?.careers?.length) {
    return (
      <>
        <Header title={tp.title} subtitle={tp.requestHistory} />
        <main className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm px-12">
            <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">{tp.noPathAssigned}</p>
            <p className="text-sm text-gray-400 mt-1">{tp.contactHR}</p>
          </div>
        </main>
      </>
    );
  }

  const career = data.careers[0];
  const elig = ELIGIBILITY_LABELS[career.eligibility_status] || ELIGIBILITY_LABELS.not_eligible;
  const hasPendingPromotion = career.promotion_history?.some((pr: any) => pr.status === 'pending');
  const promotions = career.promotion_history || [];

  const totalRequests = promotions.length;
  const approvedCount = promotions.filter((p: any) => p.status === 'approved').length;
  const pendingCount = promotions.filter((p: any) => p.status === 'pending').length;
  const rejectedCount = promotions.filter((p: any) => p.status === 'rejected').length;

  return (
    <>
      <Header
        title={tp.title}
        subtitle={`${career.path_name} · ${career.current_level_title}`}
      />
      <main className="flex-1 p-6 overflow-auto bg-gray-50 space-y-6">

        {requestSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700 text-sm font-medium">{tp.requestSentSuccess}</p>
          </div>
        )}

        {/* ── Statut éligibilité + action ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6" data-tour="eligibility-criteria">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{tp.eligibilityStatus}</h3>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${elig.color}`}>
                  {elig.label}
                </span>
                <span className="text-sm text-gray-500">
                  {career.current_level_title}
                  {career.next_level_title && (
                    <>
                      {' '}
                      <ChevronRight className="w-3.5 h-3.5 inline text-gray-400" />
                      {' '}
                      <span className="text-primary-600 font-medium">{career.next_level_title}</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {career.eligibility_status === 'eligible' && career.next_level_id && !hasPendingPromotion && (
              <button
                onClick={() => handleRequestPromotion(career.id)}
                disabled={requesting}
                className="px-5 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                <ArrowUpRight className="w-4 h-4" />
                {requesting ? tp.sendingRequest : tp.requestMyPromotion}
              </button>
            )}
            {hasPendingPromotion && (
              <span className="px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200 text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {tp.requestBeingProcessed}
              </span>
            )}
            {!career.next_level_id && (
              <span className="px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm font-medium flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                {tp.maxLevelReached}
              </span>
            )}
          </div>
        </div>

        {/* ── Statistiques ── */}
        {totalRequests > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-3xl font-bold text-gray-900">{totalRequests}</p>
              <p className="text-sm text-gray-500 mt-1">{tp.totalRequests}</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-100 shadow-sm p-5 text-center">
              <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
              <p className="text-sm text-green-600 mt-1">{tp.approved}</p>
            </div>
            <div className={`rounded-xl border shadow-sm p-5 text-center ${pendingCount > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-3xl font-bold ${pendingCount > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{pendingCount}</p>
              <p className={`text-sm mt-1 ${pendingCount > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{tp.pending}</p>
            </div>
          </div>
        )}

        {/* ── Historique des demandes ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6" data-tour="promotion-status">
          <div className="flex items-center gap-2 mb-5">
            <ArrowUpRight className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-gray-900">{tp.requestHistory2}</h3>
            {totalRequests > 0 && (
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {tp.requestCount(totalRequests)}
              </span>
            )}
          </div>

          {totalRequests === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ArrowUpRight className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="font-medium text-gray-500">{tp.noPromotionRequest}</p>
              {career.eligibility_status !== 'eligible' && career.next_level_id && (
                <p className="text-sm mt-2 text-gray-400">
                  {tp.validateCompetencies}
                </p>
              )}
              {career.eligibility_status === 'eligible' && !hasPendingPromotion && (
                <p className="text-sm mt-2 text-green-600 font-medium">
                  {tp.eligibleMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((pr: any) => (
                <div
                  key={pr.id}
                  className={`rounded-xl border p-5
                    ${pr.status === 'approved' ? 'bg-green-50 border-green-200' :
                      pr.status === 'rejected' ? 'bg-red-50 border-red-200' :
                      'bg-yellow-50 border-yellow-200'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                        ${pr.status === 'approved' ? 'bg-green-100' :
                          pr.status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                        {pr.status === 'approved'
                          ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                          : pr.status === 'rejected'
                          ? <XCircle className="w-5 h-5 text-red-500" />
                          : <Clock className="w-5 h-5 text-yellow-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                            ${pr.status === 'approved' ? 'bg-green-100 text-green-700' :
                              pr.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'}`}>
                            {pr.status === 'approved' ? tp.approved2 : pr.status === 'rejected' ? tp.rejected : tp.pendingStatus}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {pr.from_level_title}
                            {' '}<ChevronRight className="w-3.5 h-3.5 inline text-gray-400" />{' '}
                            {pr.to_level_title}
                          </span>
                        </div>
                        {pr.comments && (
                          <div className="flex items-start gap-1.5 mt-2">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-600 italic">"{pr.comments}"</p>
                          </div>
                        )}
                        {pr.committee_decision && (
                          <p className="text-sm text-gray-500 mt-1.5">
                            <span className="font-medium">{tp.committeeDecision} :</span> {pr.committee_decision}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {pr.decision_date ? (
                        <p className="text-xs text-gray-500">{formatDate(pr.decision_date)}</p>
                      ) : (
                        <p className="text-xs text-yellow-600 font-medium">{tp.beingProcessed}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
      
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
