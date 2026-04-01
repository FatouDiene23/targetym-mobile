'use client';

import { useLearning } from '../LearningContext';
import { getStatusColor, getStatusLabel } from '../shared';
import { UsersRound, Play, CheckCircle, Clock } from 'lucide-react';
import Header from '@/components/Header';

export default function TeamPage() {
  const { employees, teamAssignments, setSelectedAssignment, setShowValidationModal } = useLearning();

  const inProgressCount = teamAssignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length;
  const completedCount = teamAssignments.filter(a => a.status === 'completed').length;
  const pendingValCount = teamAssignments.filter(a => a.status === 'pending_validation').length;

  return (
          <div className="space-y-6">
            <Header title="Formation Équipe" subtitle="Formations de votre équipe" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Membres</p>
                    <p className="text-2xl font-bold text-gray-700">{employees.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <UsersRound className="w-5 h-5 text-gray-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">En cours</p>
                    <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Play className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Terminées</p>
                    <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>
              <div className={`rounded-xl p-4 shadow-sm border ${pendingValCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs ${pendingValCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>À valider</p>
                    <p className={`text-2xl font-bold ${pendingValCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{pendingValCount}</p>
                  </div>
                  <div className={`w-10 h-10 ${pendingValCount > 0 ? 'bg-amber-100' : 'bg-gray-100'} rounded-lg flex items-center justify-center`}>
                    <Clock className={`w-5 h-5 ${pendingValCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                  </div>
                </div>
              </div>
            </div>
            {teamAssignments.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <UsersRound className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune formation assignée à votre équipe</p>
              </div>
            ) : (
              <div className="space-y-4">
                {employees.map((emp) => {
                  const empAssignments = teamAssignments.filter(a => a.employee_id === emp.id);
                  if (empAssignments.length === 0) return null;
                  const inProgress = empAssignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length;
                  const pending = empAssignments.filter(a => a.status === 'pending_validation').length;
                  const completed = empAssignments.filter(a => a.status === 'completed').length;
                  return (
                    <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{emp.first_name[0]}{emp.last_name[0]}</div>
                          <div>
                            <p className="font-semibold text-gray-900">{emp.first_name} {emp.last_name}</p>
                            <p className="text-sm text-gray-500">{emp.job_title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {inProgress > 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{inProgress} en cours</span>}
                          {pending > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">{pending} à valider</span>}
                          {completed > 0 && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">{completed} terminé(s)</span>}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        {empAssignments.map((a) => (
                          <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${a.status === 'pending_validation' ? 'bg-amber-50' : a.status === 'completed' ? 'bg-green-50' : a.status === 'rejected' ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{a.course_image || '📚'}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{a.course_title}</p>
                                <p className="text-xs text-gray-500">{a.course_duration}h • Deadline: {a.deadline || 'Non définie'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(a.status)}`}>{getStatusLabel(a.status)}</span>
                              {a.status === 'pending_validation' && (
                                <button onClick={() => { setSelectedAssignment(a); setShowValidationModal(true); }} className="px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600">Valider</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

  );
}
