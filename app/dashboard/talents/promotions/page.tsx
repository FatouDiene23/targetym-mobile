// ============================================
// app/dashboard/talents/promotions/page.tsx
// Demandes de Promotion & Approbations
// ============================================

'use client';

import Header from '@/components/Header';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowUpRight, Check, X, Clock, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { promotionsTips } from '@/config/pageTips';
import { useTalents } from '../TalentsContext';
import { ELIGIBILITY_LABELS, getInitials, formatDate, isRH } from '../shared';

export default function PromotionsPage() {
  const {
    promotions, loadPromotions, decidePromotion,
    employeeCareers, loadEmployeeCareers, requestPromotion,
    syncAllProgress
  } = useTalents();

  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'requests' | 'eligible'>('requests');
  const [syncing, setSyncing] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [decisionForm, setDecisionForm] = useState({ comments: '', committee: '' });
  const canApprove = isRH();

  const { showTips, dismissTips, resetTips } = usePageTour('promotions');

  useEffect(() => {
    loadPromotions();
    loadEmployeeCareers();
  }, [loadPromotions, loadEmployeeCareers]);

  const handleFilter = (status: string) => {
    setFilterStatus(status);
    loadPromotions(status || undefined);
  };

  const handleSync = async () => {
    setSyncing(true);
    try { await syncAllProgress(); await loadEmployeeCareers(); }
    finally { setSyncing(false); }
  };

  const handleDecision = async (reqId: number, status: 'approved' | 'rejected') => {
    try {
      await decidePromotion(reqId, status, decisionForm.comments, decisionForm.committee);
      setDecidingId(null);
      setDecisionForm({ comments: '', committee: '' });
    } catch {}
  };

  const handleRequestPromo = async (ecId: number) => {
    try {
      await requestPromotion(ecId);
      await loadPromotions();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const eligibles = employeeCareers.filter(ec => ec.eligibility_status === 'eligible');
  const pendingCount = promotions.filter(p => p.status === 'pending').length;

  return (
    <>
      {showTips && (
        <PageTourTips tips={promotionsTips} onDismiss={dismissTips} pageTitle="Promotions" />
      )}
      <Header title="Promotions" subtitle="Demandes, éligibilités et approbations" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'requests' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Demandes de Promotion
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">{pendingCount}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('eligible')}
              className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'eligible' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
            >
              <ArrowUpRight className="w-4 h-4 inline mr-2" />
              Employés Éligibles
              {eligibles.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{eligibles.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* TAB: Promotion Requests */}
        {activeTab === 'requests' && (
          <>
            <div className="flex justify-between items-center gap-4 mb-4" data-tour="eligibility-filters">
              <select
                value={filterStatus}
                onChange={e => handleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvées</option>
                <option value="rejected">Rejetées</option>
              </select>
            </div>

            <div className="space-y-3" data-tour="promotions-list">
              {promotions.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <ArrowUpRight className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">Aucune demande de promotion</p>
                </div>
              ) : (
                promotions.map(req => {
                  const statusInfo = {
                    pending: { label: 'En attente', color: 'text-orange-600 bg-orange-100', icon: Clock },
                    approved: { label: 'Approuvée', color: 'text-green-600 bg-green-100', icon: Check },
                    rejected: { label: 'Rejetée', color: 'text-red-600 bg-red-100', icon: X },
                  }[req.status] || { label: req.status, color: 'text-gray-600 bg-gray-100', icon: Clock };

                  const StatusIcon = statusInfo.icon;

                  return (
                    <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">
                            {getInitials(req.first_name, req.last_name)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{req.first_name} {req.last_name}</h4>
                            <p className="text-sm text-gray-500">{req.job_title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">{req.from_level}</span>
                              <ArrowUpRight className="w-3 h-3 text-primary-500" />
                              <span className="text-xs font-medium text-primary-600">{req.to_level}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right text-xs text-gray-400">
                            <p>{req.path_name}</p>
                            <p>{formatDate(req.created_at)}</p>
                          </div>

                          <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>

                          {/* Decision buttons */}
                          {canApprove && req.status === 'pending' && (
                            <div className="flex gap-2">
                              {decidingId === req.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    value={decisionForm.comments}
                                    onChange={e => setDecisionForm({ ...decisionForm, comments: e.target.value })}
                                    placeholder="Commentaire..."
                                    className="px-2 py-1 border border-gray-300 rounded text-xs w-32"
                                  />
                                  <button onClick={() => handleDecision(req.id, 'approved')}
                                    className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600" title="Approuver">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleDecision(req.id, 'rejected')}
                                    className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600" title="Rejeter">
                                    <X className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setDecidingId(null)}
                                    className="p-1.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 text-xs">
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDecidingId(req.id)}
                                  className="px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded hover:bg-primary-600"
                                >
                                  Décider
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Decision info */}
                      {req.status !== 'pending' && req.comments && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            <strong>Commentaire :</strong> {req.comments}
                          </p>
                          {req.decision_date && (
                            <p className="text-xs text-gray-400 mt-1">Décision le {formatDate(req.decision_date)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* TAB: Eligible Employees */}
        {activeTab === 'eligible' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{eligibles.length} employé(s) éligible(s) à une promotion</p>
              {canApprove && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Synchronisation...' : 'Synchroniser toutes les progressions'}
                </button>
              )}
            </div>

            {/* All employees with eligibility */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left">Employé</th>
                    <th className="px-4 py-3 text-left">Parcours</th>
                    <th className="px-4 py-3 text-left">Niveau actuel</th>
                    <th className="px-4 py-3 text-left">Prochain</th>
                    <th className="px-4 py-3 text-center">Progression</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(filterStatus === '' ? employeeCareers : employeeCareers.filter(ec => ec.eligibility_status === filterStatus)).map(ec => {
                    const eligInfo = ELIGIBILITY_LABELS[ec.eligibility_status] || ELIGIBILITY_LABELS.not_eligible;
                    const progress = ec.total_count ? Math.round(((ec.validated_count || 0) / ec.total_count) * 100) : 0;

                    return (
                      <tr key={ec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs">
                              {getInitials(ec.first_name, ec.last_name)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{ec.first_name} {ec.last_name}</p>
                              <p className="text-xs text-gray-500">{ec.job_title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{ec.path_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{ec.current_level_title}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{ec.next_level_title || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                              <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                                style={{ width: `${Math.min(progress, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{ec.validated_count}/{ec.total_count}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${eligInfo.color}`}>
                            {eligInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ec.eligibility_status === 'eligible' && canApprove && (
                            <button
                              onClick={() => handleRequestPromo(ec.id)}
                              className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600"
                            >
                              Promouvoir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {employeeCareers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Aucun employé assigné à un parcours
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
