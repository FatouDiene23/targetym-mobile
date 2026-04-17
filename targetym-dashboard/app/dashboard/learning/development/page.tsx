'use client';

import { useLearning } from '../LearningContext';
import { useI18n } from '@/lib/i18n/I18nContext';
import { hasPermission, getPlanStatusColor, getStatusColor, getStatusLabel } from '../shared';
import { GraduationCap, Plus, Edit, Ban, Archive, Target, TrendingUp, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function DevelopmentPage() {
  const {
    userRole, getVisiblePlans, setShowCreatePlan, setShowCreateSkill,
    openEditPlanModal, setPlanToCancel, setShowCancelPlan, archiveDevelopmentPlan, setCancelReason
  } = useLearning();
  const { t } = useI18n();
  const td = t.training.development;

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  const visiblePlans = getVisiblePlans();

  return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{td.activePlans}</p>
                    <p className="text-2xl font-bold text-primary-600">{visiblePlans.filter(p => !p.status || p.status === 'active').length}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{td.totalPlans}</p>
                    <p className="text-2xl font-bold text-gray-700">{visiblePlans.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-gray-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{td.avgProgression}</p>
                    <p className="text-2xl font-bold text-purple-600">{visiblePlans.length ? Math.round(visiblePlans.reduce((s, p) => s + (p.progress || 0), 0) / visiblePlans.length) : 0}%</p>
                  </div>
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
            {hasPermission(userRole, 'create_plan') && (
              <div className="flex justify-end mb-2">
                <button onClick={() => setShowCreatePlan(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />{td.createPlan}
                </button>
              </div>
            )}
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-100 rounded-xl text-sm text-purple-800">
              <GraduationCap className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{td.personalizedPlans}</p>
                <p className="text-purple-600 mt-0.5">{td.planDescription} <span className="font-semibold">{td.pathsLabel}</span> {td.pathsSuffix}</p>
              </div>
            </div>

            {getVisiblePlans().length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{td.noDevelopmentPlan}</p>
              </div>
            ) : (
              getVisiblePlans().map((plan) => (
                <div key={plan.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${plan.status === 'cancelled' ? 'border-red-200 bg-red-50/30' : plan.status === 'archived' ? 'border-gray-200 bg-gray-50/50' : 'border-gray-100'}`}>
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${plan.status === 'cancelled' ? 'bg-red-100 text-red-700' : plan.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-primary-100 text-primary-700'}`}>{plan.initials}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{plan.employee}</h4>
                            {plan.status && plan.status !== 'active' && (<span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPlanStatusColor(plan.status)}`}>{getStatusLabel(plan.status)}</span>)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500"><span>{plan.role}</span><ArrowRight className="w-4 h-4" /><span className="text-primary-600 font-medium">{plan.targetRole}</span></div>
                          {plan.status === 'cancelled' && plan.cancellation_reason && (<p className="text-xs text-red-600 mt-1">{td.reason}: {plan.cancellation_reason}</p>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`text-3xl font-bold ${plan.status === 'cancelled' ? 'text-red-400' : plan.status === 'archived' ? 'text-gray-400' : 'text-primary-600'}`}>{plan.progress}%</p>
                          <p className="text-xs text-gray-500">{td.progression}</p>
                        </div>
                        {hasPermission(userRole, 'create_plan') && plan.status !== 'cancelled' && plan.status !== 'archived' && (
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); openEditPlanModal(plan); }} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title={t.common.edit}><Edit className="w-5 h-5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, title: td.archivePlanTitle, message: td.archiveConfirmMessage, danger: false, onConfirm: async () => { setConfirmDialog(null); await archiveDevelopmentPlan(plan.id); } }); }} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title={td.archivePlanTitle}><Archive className="w-5 h-5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setPlanToCancel(plan); setCancelReason(''); setShowCancelPlan(true); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t.common.cancel}><Ban className="w-5 h-5" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`p-5 grid md:grid-cols-2 gap-6 ${plan.status === 'cancelled' || plan.status === 'archived' ? 'opacity-60' : ''}`}>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">{td.skillsToDevelop}</h5>
                      {plan.skills.length === 0 ? (<p className="text-sm text-gray-400">{td.noSkillDefined}</p>) : (
                        <div className="space-y-3">
                          {plan.skills.map((skill, i) => (
                            <div key={i}>
                              <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{skill.name}</span><span className="font-medium">{skill.current}% → {skill.target}%</span></div>
                              <div className="h-2 bg-gray-200 rounded-full relative"><div className="absolute h-full bg-gray-400 rounded-full" style={{ width: `${skill.target}%` }} /><div className="absolute h-full bg-primary-500 rounded-full" style={{ width: `${skill.current}%` }} /></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">{td.assignedTrainings}</h5>
                      {plan.courses.length === 0 ? (<p className="text-sm text-gray-400">{td.noAssignedTraining}</p>) : (
                        <div className="space-y-2">
                          {plan.courses.map((course, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-900">{course.title}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(course.status)}`}>{getStatusLabel(course.status)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

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
    </div>
  );
}
