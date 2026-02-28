'use client';

import { useLearning } from '../LearningContext';
import { hasPermission, getEpfStatusColor, getEpfStatusLabel, getRecommendationColor, getRecommendationLabel, getScoreColor, getTrendIcon } from '../shared';
import { ClipboardCheck, Clock, CheckCircle, AlertTriangle, Eye, UserPlus, Link, Settings, Zap, TrendingUp, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function PostEvalPage() {
  const {
    userRole, epfPending, epfAll, epfStats, epfSettings, employees,
    epfSubTab, setEpfSubTab, showEpfHistory,
    openEvalModal, setShowEpfDetail, setShowAssignEvaluator,
    syncCareer, fetchEmployeeHistory, setShowEpfSettings,
    fetchEpfSettings, setSelectedEvaluatorId
  } = useLearning();

  return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Évaluations Post-Formation</h2>
                <p className="text-sm text-gray-500">Suivi de l'efficacité des formations</p>
              </div>
            </div>
            {/* Stats EPF */}
            {epfStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">En attente</p><p className="text-2xl font-bold text-amber-600">{epfStats.pending}</p></div>
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">Complétées</p><p className="text-2xl font-bold text-green-600">{epfStats.completed}</p></div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">Score moyen</p><p className="text-2xl font-bold text-primary-600">{epfStats.avg_score}/100</p></div>
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-primary-600" /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">Taux validation</p><p className="text-2xl font-bold text-blue-600">{epfStats.validation_rate}%</p></div>
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Award className="w-5 h-5 text-blue-600" /></div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex gap-2 items-center">
              <button onClick={() => setEpfSubTab('pending')} className={`px-4 py-2 text-sm font-medium rounded-lg ${epfSubTab === 'pending' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>En attente ({epfPending.length})</button>
              <button onClick={() => setEpfSubTab('all')} className={`px-4 py-2 text-sm font-medium rounded-lg ${epfSubTab === 'all' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Toutes</button>
              <button onClick={() => setEpfSubTab('history')} className={`px-4 py-2 text-sm font-medium rounded-lg ${epfSubTab === 'history' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Historique</button>
              {hasPermission(userRole, 'view_analytics') && (
                <button onClick={() => { fetchEpfSettings(); setShowEpfSettings(true); }} className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Paramètres EPF"><Settings className="w-5 h-5" /></button>
              )}
            </div>

            {/* Sub-tab: En attente */}
            {epfSubTab === 'pending' && (
              <div className="space-y-4">
                {epfPending.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center">
                    <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucune évaluation en attente</p>
                    <p className="text-sm text-gray-400 mt-1">Les évaluations apparaissent ici quand une formation est validée</p>
                  </div>
                ) : (
                  epfPending.map((epf) => (
                    <div key={epf.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{epf.course_emoji}</div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{epf.course_title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-bold">{epf.employee_initials}</div>
                                <span className="text-sm text-gray-600">{epf.employee_name}</span>
                              </div>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-sm text-gray-500">{epf.course_category}</span>
                            </div>
                            {epf.scheduled_date && (<p className="text-xs text-gray-400 mt-1">Prévue: {epf.scheduled_date} • Limite: {epf.due_date}</p>)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {epf.evaluator_name ? (
                            <div className="text-right"><p className="text-xs text-gray-500">Évaluateur</p><p className="text-sm font-medium text-gray-700">{epf.evaluator_name}</p></div>
                          ) : (
                            <button onClick={() => { setShowAssignEvaluator(epf); setSelectedEvaluatorId(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 flex items-center gap-1"><UserPlus className="w-4 h-4" />Assigner</button>
                          )}
                          <button onClick={() => openEvalModal(epf)} className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 flex items-center gap-2"><ClipboardCheck className="w-4 h-4" />Évaluer</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sub-tab: Toutes */}
            {epfSubTab === 'all' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Formation</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Collaborateur</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Évaluateur</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Score</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Statut</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Recommandation</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {epfAll.map((epf) => (
                        <tr key={epf.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-lg">{epf.course_emoji}</span><span className="text-sm font-medium text-gray-900 truncate max-w-48">{epf.course_title}</span></div></td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-bold">{epf.employee_initials}</div><span className="text-sm text-gray-700">{epf.employee_name}</span></div></td>
                          <td className="px-4 py-3"><span className="text-sm text-gray-600">{epf.evaluator_name || '—'}</span></td>
                          <td className="px-4 py-3 text-center">{epf.score !== null ? (<span className={`text-sm font-bold ${getScoreColor(epf.score, epfStats?.passing_threshold || 70)}`}>{epf.score}/100</span>) : (<span className="text-sm text-gray-400">—</span>)}</td>
                          <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getEpfStatusColor(epf.status)}`}>{getEpfStatusLabel(epf.status)}</span></td>
                          <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getRecommendationColor(epf.recommendation)}`}>{getRecommendationLabel(epf.recommendation)}</span></td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setShowEpfDetail(epf)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded" title="Détail"><Eye className="w-4 h-4" /></button>
                              {epf.status === 'pending' && (<button onClick={() => openEvalModal(epf)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Évaluer"><ClipboardCheck className="w-4 h-4" /></button>)}
                              {epf.status === 'completed' && !epf.career_synced && hasPermission(userRole, 'view_analytics') && (<button onClick={() => syncCareer(epf.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Sync Carrière"><Zap className="w-4 h-4" /></button>)}
                              {epf.career_synced && (<span className="p-1.5 text-green-500" title="Synchronisé"><Link className="w-4 h-4" /></span>)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab: Historique */}
            {epfSubTab === 'history' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-3">Sélectionner un collaborateur</h4>
                  <select onChange={(e) => { if (e.target.value) fetchEmployeeHistory(parseInt(e.target.value)); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Choisir un collaborateur...</option>
                    {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}
                  </select>
                </div>

                {showEpfHistory && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">{showEpfHistory.employee_name}</h4>
                        <span className="text-2xl">{getTrendIcon(showEpfHistory.summary.trend)}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg"><p className="text-2xl font-bold text-gray-900">{showEpfHistory.summary.total_evaluations}</p><p className="text-xs text-gray-500">Évaluations</p></div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg"><p className="text-2xl font-bold text-primary-600">{showEpfHistory.summary.avg_score}</p><p className="text-xs text-gray-500">Score moyen</p></div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg"><p className="text-2xl font-bold text-green-600">{showEpfHistory.summary.validation_rate}%</p><p className="text-xs text-gray-500">Taux validation</p></div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg"><p className="text-2xl font-bold text-red-600">{showEpfHistory.summary.retrain_count}</p><p className="text-xs text-gray-500">Re-formations</p></div>
                      </div>
                    </div>

                    {showEpfHistory.evaluations.length > 1 && (
                      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <h4 className="font-semibold text-gray-900 mb-4">Tendance des scores</h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={showEpfHistory.evaluations.map((e) => ({ name: e.course_title?.substring(0, 15) + '...', score: e.score, seuil: epfStats?.passing_threshold || 70 }))}>
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
                              <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2} dot={{ fill: '#6366F1', r: 4 }} />
                              <Line type="monotone" dataKey="seuil" stroke="#EF4444" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-gray-400 text-center mt-2">Ligne rouge: seuil de validation ({epfStats?.passing_threshold || 70}/100)</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {showEpfHistory.evaluations.map((epf) => (
                        <div key={epf.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{epf.course_emoji}</span>
                              <div>
                                <p className="font-medium text-gray-900">{epf.course_title}</p>
                                <p className="text-xs text-gray-500">{epf.completed_at ? new Date(epf.completed_at).toLocaleDateString('fr-FR') : ''} • Éval: {epf.evaluator_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className={`text-xl font-bold ${getScoreColor(epf.score || 0, epfStats?.passing_threshold || 70)}`}>{epf.score}/100</p>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRecommendationColor(epf.recommendation)}`}>{getRecommendationLabel(epf.recommendation)}</span>
                              <button onClick={() => setShowEpfDetail(epf)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

  );
}
