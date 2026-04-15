'use client';

import { useLearning } from '../LearningContext';
import { getStatusColor, getStatusLabel } from '../shared';
import { MessageSquarePlus, Check, XCircle, ExternalLink, Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';

export default function RequestsPage() {
  const { t } = useI18n();
  const { courseRequests, reviewCourseRequest } = useLearning();

  const pendingCount = courseRequests.filter(r => r.status === 'pending').length;
  const approvedCount = courseRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = courseRequests.filter(r => r.status === 'rejected').length;

  return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{t.training.requestsPage.totalRequests}</p>
                    <p className="text-2xl font-bold text-gray-700">{courseRequests.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <MessageSquarePlus className="w-5 h-5 text-gray-600" />
                  </div>
                </div>
              </div>
              <div className={`rounded-xl p-4 shadow-sm border ${pendingCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs ${pendingCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>{t.training.requestsPage.pendingLabel}</p>
                    <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{pendingCount}</p>
                  </div>
                  <div className={`w-10 h-10 ${pendingCount > 0 ? 'bg-amber-100' : 'bg-gray-100'} rounded-lg flex items-center justify-center`}>
                    <Clock className={`w-5 h-5 ${pendingCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{t.training.requestsPage.approved}</p>
                    <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{t.training.requestsPage.rejectedLabel}</p>
                    <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
                  </div>
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
            {courseRequests.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <MessageSquarePlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t.training.requestsPage.noTrainingRequest}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {courseRequests.map((request) => (
                  <div key={request.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold">{request.requested_by_initials}</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{request.title}</h4>
                          <p className="text-sm text-gray-500 mb-2">{t.training.requestsPage.requestedBy} {request.requested_by_name}{request.for_employee_name && ` ${t.training.requestsPage.forLabel} ${request.for_employee_name}`}</p>
                          {request.description && <p className="text-sm text-gray-600 mb-2">{request.description}</p>}
                          {request.reason && <p className="text-sm text-gray-500 italic">&quot;{request.reason}&quot;</p>}
                          {request.external_url && (<a href={request.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-2"><ExternalLink className="w-3 h-3" />{t.training.requestsPage.suggestedLink}</a>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>{getStatusLabel(request.status)}</span>
                        {request.status === 'pending' && (
                          <div className="flex gap-2 ml-4">
                            <button onClick={() => reviewCourseRequest(request.id, true, '')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title={t.training.requestsPage.approveTitle}><Check className="w-4 h-4" /></button>
                            <button onClick={() => reviewCourseRequest(request.id, false, 'Formation non disponible')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title={t.training.requestsPage.rejectTitle}><XCircle className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

  );
}
