'use client';

import { useLearning } from '../LearningContext';
import { getStatusColor, getStatusLabel } from '../shared';
import { MessageSquarePlus, Check, XCircle, ExternalLink } from 'lucide-react';

export default function RequestsPage() {
  const { courseRequests, reviewCourseRequest } = useLearning();

  return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Demandes de Formation</h2>
                <p className="text-sm text-gray-500">Demandes soumises par les collaborateurs</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
                  <p className="text-lg font-bold text-gray-700">{courseRequests.length}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                {courseRequests.filter(r => r.status === 'pending').length > 0 && (
                  <div className="bg-amber-50 rounded-xl px-4 py-2.5 border border-amber-200 text-center">
                    <p className="text-lg font-bold text-amber-600">{courseRequests.filter(r => r.status === 'pending').length}</p>
                    <p className="text-xs text-amber-600">En attente</p>
                  </div>
                )}
              </div>
            </div>
            {courseRequests.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <MessageSquarePlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune demande de formation</p>
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
                          <p className="text-sm text-gray-500 mb-2">Demandé par {request.requested_by_name}{request.for_employee_name && ` pour ${request.for_employee_name}`}</p>
                          {request.description && <p className="text-sm text-gray-600 mb-2">{request.description}</p>}
                          {request.reason && <p className="text-sm text-gray-500 italic">&quot;{request.reason}&quot;</p>}
                          {request.external_url && (<a href={request.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-2"><ExternalLink className="w-3 h-3" />Lien suggéré</a>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>{getStatusLabel(request.status)}</span>
                        {request.status === 'pending' && (
                          <div className="flex gap-2 ml-4">
                            <button onClick={() => reviewCourseRequest(request.id, true, '')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Approuver"><Check className="w-4 h-4" /></button>
                            <button onClick={() => reviewCourseRequest(request.id, false, 'Formation non disponible')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Rejeter"><XCircle className="w-4 h-4" /></button>
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
