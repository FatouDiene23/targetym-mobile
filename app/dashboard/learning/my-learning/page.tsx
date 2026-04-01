'use client';

import { useLearning } from '../LearningContext';
import { getStatusColor, getStatusLabel, hasPermission } from '../shared';
import {
  Clock, CheckCircle, Play, ExternalLink, Edit, XCircle, RefreshCw, AlertTriangle, BookOpen
} from 'lucide-react';
import Header from '@/components/Header';

export default function MyLearningPage() {
  const {
    userRole, myAssignments, pendingValidations,
    startAssignment, openCompleteModal,
    setSelectedAssignment, setShowValidationModal
  } = useLearning();

  const inProgress = myAssignments.filter(a => a.status === 'in_progress');
  const assigned = myAssignments.filter(a => a.status === 'assigned');
  const pendingValidation = myAssignments.filter(a => a.status === 'pending_validation');
  const completed = myAssignments.filter(a => a.status === 'completed');
  const rejected = myAssignments.filter(a => a.status === 'rejected');

  const renderAssignment = (assignment: typeof myAssignments[0]) => (
    <div key={assignment.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{assignment.course_image || '📚'}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{assignment.course_title}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">{assignment.course_duration}h</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(assignment.status)}`}>{getStatusLabel(assignment.status)}</span>
          </div>
          {assignment.deadline && <p className="text-xs text-gray-400 mt-1">Échéance: {new Date(assignment.deadline).toLocaleDateString('fr-FR')}</p>}
          {assignment.rejection_reason && <p className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">❌ {assignment.rejection_reason}</p>}
        </div>
        <div className="flex flex-col gap-1">
          {assignment.status === 'assigned' && (
            <button onClick={() => startAssignment(assignment.id)} className="px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 flex items-center gap-1"><Play className="w-3 h-3" />Commencer</button>
          )}
          {assignment.status === 'in_progress' && (
            <>
              {assignment.course_external_url && <a href={assignment.course_external_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 flex items-center gap-1"><ExternalLink className="w-3 h-3" />Accéder</a>}
              <button onClick={() => openCompleteModal(assignment)} className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Terminer</button>
            </>
          )}
          {assignment.status === 'pending_validation' && (
            <button onClick={() => openCompleteModal(assignment)} className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 flex items-center gap-1"><Edit className="w-3 h-3" />Modifier</button>
          )}
          {assignment.status === 'rejected' && (
            <button onClick={() => openCompleteModal(assignment)} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 flex items-center gap-1"><RefreshCw className="w-3 h-3" />Resoumettre</button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Header title="Mes Formations" subtitle="Votre parcours de formation" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">À commencer</p>
              <p className="text-2xl font-bold text-gray-700">{assigned.length}</p>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">En cours</p>
              <p className="text-2xl font-bold text-blue-600">{inProgress.length}</p>
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
              <p className="text-2xl font-bold text-green-600">{completed.length}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${pendingValidation.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${pendingValidation.length > 0 ? 'text-amber-600' : 'text-gray-500'}`}>En attente</p>
              <p className={`text-2xl font-bold ${pendingValidation.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{pendingValidation.length}</p>
            </div>
            <div className={`w-10 h-10 ${pendingValidation.length > 0 ? 'bg-amber-100' : 'bg-gray-100'} rounded-lg flex items-center justify-center`}>
              <Clock className={`w-5 h-5 ${pendingValidation.length > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
            </div>
          </div>
        </div>
      </div>
      {pendingValidation.length > 0 && (
        <div><h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />En attente de validation ({pendingValidation.length})</h3><div className="space-y-3">{pendingValidation.map(renderAssignment)}</div></div>
      )}
      {rejected.length > 0 && (
        <div><h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2"><XCircle className="w-4 h-4" />Rejetées ({rejected.length})</h3><div className="space-y-3">{rejected.map(renderAssignment)}</div></div>
      )}
      {inProgress.length > 0 && (
        <div><h3 className="text-sm font-semibold text-blue-700 mb-3">En cours ({inProgress.length})</h3><div className="space-y-3">{inProgress.map(renderAssignment)}</div></div>
      )}
      {assigned.length > 0 && (
        <div><h3 className="text-sm font-semibold text-gray-700 mb-3">À commencer ({assigned.length})</h3><div className="space-y-3">{assigned.map(renderAssignment)}</div></div>
      )}
      {completed.length > 0 && (
        <div><h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Complétées ({completed.length})</h3><div className="space-y-3">{completed.map(renderAssignment)}</div></div>
      )}
      {myAssignments.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center"><p className="text-gray-500">Aucune formation assignée</p></div>
      )}
      {hasPermission(userRole, 'validate_completion') && pendingValidations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" />Validations en attente ({pendingValidations.length})</h3>
          <div className="space-y-3">{pendingValidations.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{a.employee_initials}</div><div><p className="font-medium text-gray-900">{a.employee_name}</p><p className="text-sm text-gray-500">{a.course_title}</p></div></div>
              <button onClick={() => { setSelectedAssignment(a); setShowValidationModal(true); }} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">Valider</button>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
