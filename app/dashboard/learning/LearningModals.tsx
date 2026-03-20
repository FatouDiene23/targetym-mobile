'use client';

// ============================================
// LEARNING MODULE - ALL MODALS
// File: app/dashboard/learning/LearningModals.tsx
// ============================================

import { useLearning } from './LearningContext';
import {
  API_URL, getAuthHeaders, hasPermission, getLevelColor, getLevelLabel,
  getStatusColor, getStatusLabel, getPlanStatusColor, getCertStatusColor,
  getEpfStatusColor, getEpfStatusLabel, getRecommendationColor, getRecommendationLabel,
  getScoreColor, getTrendIcon, CriteriaScore, skillCategories
} from './shared';
import {
  X, Clock, Users, User, Upload, ExternalLink, Check, XCircle,
  RefreshCw, CheckCircle, AlertTriangle, FileCheck, FileWarning,
  Plus, Edit, Archive, Ban, Target, TrendingUp, Eye, Link, Zap, Settings, Send
} from 'lucide-react';

export function LearningModals() {
  const ctx = useLearning();
  const {
    userRole, courses, employees, skills, certHolders,
    epfStats, epfSettings, setEpfSettings,
    // Modal states
    selectedCourse, setSelectedCourse,
    showCreateCourse, setShowCreateCourse,
    showEditCourse, setShowEditCourse, editCourseData, setEditCourseData,
    showAssignModal, setShowAssignModal,
    showValidationModal, setShowValidationModal,
    selectedAssignment, setSelectedAssignment,
    showCreateCertification, setShowCreateCertification,
    showCreatePlan, setShowCreatePlan,
    showEditPlan, setShowEditPlan,
    selectedPlan, setSelectedPlan,
    showCertHolders, setShowCertHolders,
    showCreatePath, setShowCreatePath,
    showRequestCourse, setShowRequestCourse,
    showCreateSkill, setShowCreateSkill,
    showCancelPlan, setShowCancelPlan,
    cancelReason, setCancelReason,
    planToCancel, setPlanToCancel,
    showCompleteModal, setShowCompleteModal,
    assignmentToComplete, setAssignmentToComplete,
    completionNote, setCompletionNote,
    completionFile, setCompletionFile,
    isSubmitting,
    showEvalModal, setShowEvalModal,
    selectedEpf, setSelectedEpf,
    evalCriteria, setEvalCriteria,
    evalComments, setEvalComments,
    evalStrengths, setEvalStrengths,
    evalImprovements, setEvalImprovements,
    showEpfDetail, setShowEpfDetail,
    showEpfHistory, setShowEpfHistory,
    showEpfSettings, setShowEpfSettings,
    showAssignEvaluator, setShowAssignEvaluator,
    selectedEvaluatorId, setSelectedEvaluatorId,
    // Forms
    newCourse, setNewCourse,
    assignData, setAssignData,
    validationData, setValidationData,
    newCertification, setNewCertification,
    newPath, setNewPath,
    newPlan, setNewPlan,
    editPlanData, setEditPlanData,
    newRequest, setNewRequest,
    newSkill, setNewSkill,
    // Provider states
    providers,
    showCreateProvider, setShowCreateProvider,
    showEditProvider, setShowEditProvider,
    newProvider, setNewProvider,
    // Actions
    completeAssignment, createCourse, openEditCourse, updateCourse, createPath, assignCourse,
    validateAssignment, createCertificationType, createSkill,
    createDevelopmentPlan, updateDevelopmentPlan, cancelDevelopmentPlan,
    submitCourseRequest, submitEvaluation, assignEvaluator,
    computeWeightedScore, syncCareer, fetchEpfStats,
    createProvider, updateProvider, deactivateProvider,
  } = ctx;

  return (
    <>
      {/* Modal: Compléter/Resoumettre formation */}
      {showCompleteModal && assignmentToComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{assignmentToComplete.status === 'pending_validation' ? 'Modifier la soumission' : assignmentToComplete.status === 'rejected' ? 'Resoumettre' : 'Terminer la formation'}</h2>
                <button onClick={() => { setShowCompleteModal(false); setAssignmentToComplete(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-2xl">{assignmentToComplete.course_image || '📚'}</span>
                <div><p className="font-medium text-gray-900">{assignmentToComplete.course_title}</p><p className="text-sm text-gray-500">{assignmentToComplete.course_duration}h</p></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optionnel)</label>
                <textarea value={completionNote} onChange={(e) => setCompletionNote(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} placeholder="Commentaires sur la formation..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Certificat/Justificatif {assignmentToComplete.requires_certificate ? <span className="text-red-500">*</span> : '(optionnel)'}</label>
                {assignmentToComplete.certificate_file && !completionFile && (
                  <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"><FileCheck className="w-4 h-4 text-green-600" /><span className="text-sm text-green-700">Certificat déjà uploadé: {assignmentToComplete.certificate_filename}</span></div>
                )}
                <div className={`border-2 border-dashed rounded-lg p-4 text-center ${assignmentToComplete.requires_certificate && !assignmentToComplete.certificate_file ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
                  <input type="file" id="certificate-upload" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setCompletionFile(e.target.files?.[0] || null)} />
                  {completionFile ? (
                    <div className="flex items-center justify-center gap-2"><FileCheck className="w-5 h-5 text-green-600" /><span className="text-sm text-gray-700">{completionFile.name}</span><button onClick={() => setCompletionFile(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></div>
                  ) : (
                    <label htmlFor="certificate-upload" className="cursor-pointer"><Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" /><p className="text-sm text-gray-500">Cliquez pour uploader</p><p className="text-xs text-gray-400">PDF, PNG, JPG (max 5MB)</p></label>
                  )}
                </div>
                {assignmentToComplete.requires_certificate && !assignmentToComplete.certificate_file && !completionFile && (<p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Un certificat est requis</p>)}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-sm text-amber-800"><AlertTriangle className="w-4 h-4 inline mr-1" />Votre manager/RH devra valider la complétion.</p></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowCompleteModal(false); setAssignmentToComplete(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={completeAssignment} disabled={isSubmitting || (assignmentToComplete.requires_certificate && !assignmentToComplete.certificate_file && !completionFile)} className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Soumettre</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Détail Course */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="relative h-48 bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <span className="text-7xl">{selectedCourse.image_emoji || '📚'}</span>
              <button onClick={() => setSelectedCourse(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
              {selectedCourse.is_mandatory && <span className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-lg">Obligatoire</span>}
              {selectedCourse.requires_certificate && <span className="absolute top-4 left-28 px-3 py-1 bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-1"><FileWarning className="w-4 h-4" />Certificat requis</span>}
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2"><span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(selectedCourse.level)}`}>{getLevelLabel(selectedCourse.level)}</span><span className="text-sm text-gray-500">{selectedCourse.category}</span></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCourse.title}</h2>
              <p className="text-gray-600 mb-4">{selectedCourse.description}</p>
              <div className="flex items-center gap-6 mb-6 text-sm text-gray-500">
                <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{selectedCourse.duration_hours}h</span>
                <span className="flex items-center"><User className="w-4 h-4 mr-1" />{selectedCourse.provider || 'Interne'}</span>
                <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{selectedCourse.enrolled} inscrits</span>
              </div>
              {selectedCourse.external_url && (<a href={selectedCourse.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"><ExternalLink className="w-4 h-4" />Accéder à la formation externe</a>)}
              {hasPermission(userRole, 'assign_course') && (
                <button onClick={() => { setAssignData({ ...assignData, course_id: selectedCourse.id.toString() }); setSelectedCourse(null); setShowAssignModal(true); }} className="w-full flex items-center justify-center px-4 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"><User className="w-5 h-5 mr-2" />Assigner à un employé</button>
              )}
              {hasPermission(userRole, 'create_course') && (
                <button onClick={() => openEditCourse(selectedCourse)} className="w-full mt-2 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"><Edit className="w-4 h-4 mr-2" />Modifier la formation</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Créer Formation */}
      {showCreateCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouvelle Formation</h2><button onClick={() => setShowCreateCourse(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Leadership & Management" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label><select value={newCourse.category} onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="Soft Skills">Soft Skills</option><option value="Technique">Technique</option><option value="Management">Management</option><option value="Commercial">Commercial</option><option value="Innovation">Innovation</option><option value="Juridique">Juridique</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label><select value={newCourse.level} onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="beginner">Débutant</option><option value="intermediate">Intermédiaire</option><option value="advanced">Avancé</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Durée (heures)</label><input type="number" value={newCourse.duration_hours} onChange={(e) => setNewCourse({ ...newCourse, duration_hours: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="8" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label><input type="text" value={newCourse.image_emoji} onChange={(e) => setNewCourse({ ...newCourse, image_emoji: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="📚" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                {providers.length > 0 ? (
                  <select value={newCourse.provider_id || ''} onChange={(e) => { const p = providers.find(p => p.id === Number(e.target.value)); setNewCourse({ ...newCourse, provider_id: e.target.value ? Number(e.target.value) : null, provider: p ? p.name : '' }); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">-- Aucun fournisseur --</option>
                    {providers.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                  </select>
                ) : (
                  <input type="text" value={newCourse.provider} onChange={(e) => setNewCourse({ ...newCourse, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Coursera, Udemy..." />
                )}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">URL externe</label><input type="url" value={newCourse.external_url} onChange={(e) => setNewCourse({ ...newCourse, external_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://..." /></div>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><input type="checkbox" id="mandatory" checked={newCourse.is_mandatory} onChange={(e) => setNewCourse({ ...newCourse, is_mandatory: e.target.checked })} className="rounded" /><label htmlFor="mandatory" className="text-sm text-gray-700">Formation obligatoire</label></div>
                <div className="flex items-center gap-2"><input type="checkbox" id="requires_certificate" checked={newCourse.requires_certificate} onChange={(e) => setNewCourse({ ...newCourse, requires_certificate: e.target.checked })} className="rounded" /><label htmlFor="requires_certificate" className="text-sm text-gray-700 flex items-center gap-1"><FileWarning className="w-4 h-4 text-purple-600" />Certificat requis pour validation</label></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Compétences développées</label>
                {skills.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Aucune compétence disponible</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {skills.map((skill) => (
                      <label key={skill.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={(newCourse.skill_ids as number[]).includes(skill.id)} onChange={(e) => { const ids = newCourse.skill_ids as number[]; setNewCourse({ ...newCourse, skill_ids: e.target.checked ? [...ids, skill.id] : ids.filter((id) => id !== skill.id) }); }} className="rounded text-primary-600" />
                        <span className="text-sm text-gray-700">{skill.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{skill.category}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreateCourse(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createCourse} disabled={!newCourse.title} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modifier Formation */}
      {showEditCourse && editCourseData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Modifier la formation</h2><button onClick={() => { setShowEditCourse(false); setEditCourseData(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={editCourseData.title} onChange={(e) => setEditCourseData({ ...editCourseData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={editCourseData.description} onChange={(e) => setEditCourseData({ ...editCourseData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label><select value={editCourseData.category} onChange={(e) => setEditCourseData({ ...editCourseData, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="Soft Skills">Soft Skills</option><option value="Technique">Technique</option><option value="Management">Management</option><option value="Commercial">Commercial</option><option value="Innovation">Innovation</option><option value="Juridique">Juridique</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label><select value={editCourseData.level} onChange={(e) => setEditCourseData({ ...editCourseData, level: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="beginner">Débutant</option><option value="intermediate">Intermédiaire</option><option value="advanced">Avancé</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Durée (heures)</label><input type="number" value={editCourseData.duration_hours} onChange={(e) => setEditCourseData({ ...editCourseData, duration_hours: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label><input type="text" value={editCourseData.image_emoji} onChange={(e) => setEditCourseData({ ...editCourseData, image_emoji: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                {providers.length > 0 ? (
                  <select value={editCourseData.provider_id || ''} onChange={(e) => { const p = providers.find(p => p.id === Number(e.target.value)); setEditCourseData({ ...editCourseData, provider_id: e.target.value ? Number(e.target.value) : null, provider: p ? p.name : editCourseData.provider }); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">-- Aucun fournisseur --</option>
                    {providers.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                  </select>
                ) : (
                  <input type="text" value={editCourseData.provider} onChange={(e) => setEditCourseData({ ...editCourseData, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                )}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">URL externe</label><input type="url" value={editCourseData.external_url} onChange={(e) => setEditCourseData({ ...editCourseData, external_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><input type="checkbox" id="edit-mandatory" checked={editCourseData.is_mandatory} onChange={(e) => setEditCourseData({ ...editCourseData, is_mandatory: e.target.checked })} className="rounded" /><label htmlFor="edit-mandatory" className="text-sm text-gray-700">Formation obligatoire</label></div>
                <div className="flex items-center gap-2"><input type="checkbox" id="edit-requires-cert" checked={editCourseData.requires_certificate} onChange={(e) => setEditCourseData({ ...editCourseData, requires_certificate: e.target.checked })} className="rounded" /><label htmlFor="edit-requires-cert" className="text-sm text-gray-700 flex items-center gap-1"><FileWarning className="w-4 h-4 text-purple-600" />Certificat requis pour validation</label></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Compétences développées</label>
                {skills.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Aucune compétence disponible</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {skills.map((skill) => (
                      <label key={skill.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={(editCourseData.skill_ids as number[]).includes(skill.id)} onChange={(e) => { const ids = editCourseData.skill_ids as number[]; setEditCourseData({ ...editCourseData, skill_ids: e.target.checked ? [...ids, skill.id] : ids.filter((id: number) => id !== skill.id) }); }} className="rounded text-primary-600" />
                        <span className="text-sm text-gray-700">{skill.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{skill.category}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowEditCourse(false); setEditCourseData(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={updateCourse} disabled={!editCourseData.title} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assigner */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Assigner une Formation</h2><button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label><select value={assignData.employee_id} onChange={(e) => setAssignData({ ...assignData, employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Sélectionner...</option>{employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} - {emp.job_title}</option>))}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Formation *</label><select value={assignData.course_id} onChange={(e) => setAssignData({ ...assignData, course_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Sélectionner...</option>{courses.map((course) => (<option key={course.id} value={course.id}>{course.title}</option>))}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Date limite (optionnel)</label><input type="date" value={assignData.deadline} onChange={(e) => setAssignData({ ...assignData, deadline: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={assignCourse} disabled={!assignData.employee_id || !assignData.course_id} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Assigner</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Validation */}
      {showValidationModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Valider la Formation</h2><button onClick={() => setShowValidationModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{selectedAssignment.employee_initials}</div><div><p className="font-semibold text-gray-900">{selectedAssignment.employee_name}</p><p className="text-sm text-gray-500">{selectedAssignment.course_title}</p></div></div>
              {selectedAssignment.completion_note && (<div className="mb-4 p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Note de l&apos;employé:</p><p className="text-sm text-gray-700">{selectedAssignment.completion_note}</p></div>)}
              {selectedAssignment.certificate_file && (<div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2"><Upload className="w-4 h-4 text-blue-600" /><span className="text-sm text-blue-700">{selectedAssignment.certificate_filename}</span><a href={`${API_URL}${selectedAssignment.certificate_file}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:underline text-sm">Voir</a></div>)}
              {selectedAssignment.requires_certificate && !selectedAssignment.certificate_file && (<div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-sm text-red-700">Certificat requis mais non fourni!</span></div>)}
              <div className="flex gap-3 mb-4">
                <button onClick={() => setValidationData({ ...validationData, approved: true })} className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${validationData.approved ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}><Check className="w-5 h-5" />Approuver</button>
                <button onClick={() => setValidationData({ ...validationData, approved: false })} className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${!validationData.approved ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}><XCircle className="w-5 h-5" />Rejeter</button>
              </div>
              {!validationData.approved && (<div><label className="block text-sm font-medium text-gray-700 mb-1">Raison du rejet</label><textarea value={validationData.rejection_reason} onChange={(e) => setValidationData({ ...validationData, rejection_reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Expliquez..." /></div>)}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowValidationModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={validateAssignment} className={`flex-1 px-4 py-2 text-white rounded-lg ${validationData.approved ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>{validationData.approved ? 'Approuver' : 'Rejeter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Créer Certification */}
      {showCreateCertification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouvelle Certification</h2><button onClick={() => setShowCreateCertification(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" value={newCertification.name} onChange={(e) => setNewCertification({ ...newCertification, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="AWS Solutions Architect" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                {providers.length > 0 ? (
                  <select value={newCertification.provider_id || ''} onChange={(e) => { const p = providers.find(p => p.id === Number(e.target.value)); setNewCertification({ ...newCertification, provider_id: e.target.value ? Number(e.target.value) : null, provider: p ? p.name : '' }); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sélectionner un fournisseur</option>
                    {providers.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                  </select>
                ) : (
                  <input type="text" value={newCertification.provider} onChange={(e) => setNewCertification({ ...newCertification, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Amazon" />
                )}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newCertification.description} onChange={(e) => setNewCertification({ ...newCertification, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Validité (mois)</label><input type="number" value={newCertification.validity_months} onChange={(e) => setNewCertification({ ...newCertification, validity_months: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Permanent si vide" /></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreateCertification(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createCertificationType} disabled={!newCertification.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cert Holders */}
      {showCertHolders && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-gray-900">{showCertHolders.name}</h2><p className="text-sm text-gray-500">{showCertHolders.provider}</p></div><button onClick={() => setShowCertHolders(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Titulaires ({certHolders.length})</h3>
              {certHolders.length === 0 ? (<p className="text-gray-500 text-center py-8">Aucun titulaire</p>) : (
                <div className="space-y-3">
                  {certHolders.map((holder) => (
                    <div key={holder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{holder.employee_initials}</div><div><p className="font-medium text-gray-900">{holder.employee_name}</p><p className="text-xs text-gray-500">Obtenue le {holder.obtained_date}</p></div></div>
                      <div className="text-right"><p className={`text-sm font-medium ${getCertStatusColor(holder.status)}`}>{holder.status === 'expiring' && <AlertTriangle className="w-3 h-3 inline mr-1" />}{holder.expiry_date}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Créer Plan */}
      {showCreatePlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouveau Plan de Développement</h2><button onClick={() => setShowCreatePlan(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label><select value={newPlan.employee_id} onChange={(e) => setNewPlan({ ...newPlan, employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Sélectionner...</option>{employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Poste actuel</label><input type="text" value={newPlan.current_role} onChange={(e) => setNewPlan({ ...newPlan, current_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Poste cible</label><input type="text" value={newPlan.target_role} onChange={(e) => setNewPlan({ ...newPlan, target_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Date cible</label><input type="date" value={newPlan.target_date} onChange={(e) => setNewPlan({ ...newPlan, target_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Compétences</label><button onClick={() => setShowCreateSkill(true)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center"><Plus className="w-3 h-3 mr-1" />Ajouter</button></div>
                {skills.length === 0 ? (<div className="text-center py-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Aucune compétence</p></div>) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">{skills.map((skill) => (<label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={newPlan.skill_ids.includes(skill.id)} onChange={(e) => { if (e.target.checked) { setNewPlan({ ...newPlan, skill_ids: [...newPlan.skill_ids, skill.id] }); } else { setNewPlan({ ...newPlan, skill_ids: newPlan.skill_ids.filter((id: number) => id !== skill.id) }); } }} className="rounded" /><span className="text-sm text-gray-700">{skill.name}</span><span className="text-xs text-gray-400">({skill.category})</span></label>))}</div>
                )}
              </div>
              {newPlan.skill_ids.length > 0 && (() => {
                const recommended = courses.filter(c => c.skills?.some(s => newPlan.skill_ids.includes(s.id)) && !newPlan.course_ids.includes(c.id));
                return recommended.length > 0 ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-2">✨ Formations recommandées pour les compétences sélectionnées</p>
                    <div className="space-y-1">
                      {recommended.map((course) => (
                        <div key={course.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-700">{course.image_emoji} {course.title}</span>
                          <button onClick={() => setNewPlan({ ...newPlan, course_ids: [...newPlan.course_ids, course.id] })} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">+ Ajouter</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formations à assigner</label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">{courses.map((course) => (<label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={newPlan.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setNewPlan({ ...newPlan, course_ids: [...newPlan.course_ids, course.id] }); } else { setNewPlan({ ...newPlan, course_ids: newPlan.course_ids.filter((id: number) => id !== course.id) }); } }} className="rounded" /><span className="text-sm text-gray-700">{course.title}</span></label>))}</div>
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Les formations seront automatiquement assignées</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreatePlan(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createDevelopmentPlan} disabled={!newPlan.employee_id} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Plan */}
      {showEditPlan && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Modifier le Plan</h2><button onClick={() => { setShowEditPlan(false); setSelectedPlan(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{selectedPlan.initials}</div><div><p className="font-medium text-gray-900">{selectedPlan.employee}</p><p className="text-sm text-gray-500">{selectedPlan.role}</p></div></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Poste cible</label><input type="text" value={editPlanData.target_role} onChange={(e) => setEditPlanData({ ...editPlanData, target_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Date cible</label><input type="date" value={editPlanData.target_date} onChange={(e) => setEditPlanData({ ...editPlanData, target_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Compétences</label><div className="flex items-center gap-2"><span className="text-xs text-gray-500">{editPlanData.skill_ids.length} sélectionnée(s)</span><button onClick={() => setShowCreateSkill(true)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center"><Plus className="w-3 h-3 mr-1" />Ajouter</button></div></div>
                {skills.length === 0 ? (<div className="text-center py-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Aucune compétence</p><button onClick={() => setShowCreateSkill(true)} className="text-xs text-primary-600 hover:text-primary-700 mt-1">Créer une compétence</button></div>) : (<div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">{skills.map((skill) => (<label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={editPlanData.skill_ids.includes(skill.id)} onChange={(e) => { if (e.target.checked) { setEditPlanData({ ...editPlanData, skill_ids: [...editPlanData.skill_ids, skill.id] }); } else { setEditPlanData({ ...editPlanData, skill_ids: editPlanData.skill_ids.filter((id: number) => id !== skill.id) }); } }} className="rounded text-primary-600" /><span className="text-sm text-gray-700">{skill.name}</span><span className="text-xs text-gray-400 ml-auto">({skill.category})</span></label>))}</div>)}
              </div>
              {editPlanData.skill_ids.length > 0 && (() => {
                const recommended = courses.filter(c => c.skills?.some(s => editPlanData.skill_ids.includes(s.id)) && !editPlanData.course_ids.includes(c.id));
                return recommended.length > 0 ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-2">✨ Formations recommandées pour les compétences sélectionnées</p>
                    <div className="space-y-1">
                      {recommended.map((course) => (
                        <div key={course.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-700">{course.image_emoji} {course.title}</span>
                          <button onClick={() => setEditPlanData({ ...editPlanData, course_ids: [...editPlanData.course_ids, course.id] })} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">+ Ajouter</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              <div>
                <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Formations</label><span className="text-xs text-gray-500">{editPlanData.course_ids.length} sélectionnée(s)</span></div>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">{courses.map((course) => (<label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={editPlanData.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setEditPlanData({ ...editPlanData, course_ids: [...editPlanData.course_ids, course.id] }); } else { setEditPlanData({ ...editPlanData, course_ids: editPlanData.course_ids.filter((id: number) => id !== course.id) }); } }} className="rounded text-primary-600" /><span className="text-2xl">{course.image_emoji || '📚'}</span><span className="text-sm text-gray-700 flex-1">{course.title}</span><span className="text-xs text-gray-400">{course.duration_hours}h</span></label>))}</div>
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Les nouvelles formations seront auto-assignées</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowEditPlan(false); setSelectedPlan(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={updateDevelopmentPlan} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel Plan */}
      {showCancelPlan && planToCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Annuler le Plan</h2><button onClick={() => { setShowCancelPlan(false); setPlanToCancel(null); setCancelReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200"><div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-bold">{planToCancel.initials}</div><div><p className="font-medium text-gray-900">{planToCancel.employee}</p><p className="text-sm text-gray-500">{planToCancel.role} → {planToCancel.targetRole}</p></div></div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><div className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-amber-800">Attention</p><p className="text-xs text-amber-700">Cette action est irréversible.</p></div></div></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Motif d&apos;annulation *</label><textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} placeholder="Ex: Départ de l'employé..." /></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowCancelPlan(false); setPlanToCancel(null); setCancelReason(''); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Retour</button>
              <button onClick={cancelDevelopmentPlan} disabled={!cancelReason.trim()} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"><Ban className="w-4 h-4" />Annuler le plan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Créer Parcours */}
      {showCreatePath && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouveau Parcours</h2><button onClick={() => setShowCreatePath(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={newPath.title} onChange={(e) => setNewPath({ ...newPath, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Onboarding Développeur" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newPath.description} onChange={(e) => setNewPath({ ...newPath, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label><select value={newPath.category} onChange={(e) => setNewPath({ ...newPath, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="Technique">Technique</option><option value="Management">Management</option><option value="Onboarding">Onboarding</option><option value="Commercial">Commercial</option></select></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formations</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">{courses.map((course) => (<label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={newPath.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setNewPath({ ...newPath, course_ids: [...newPath.course_ids, course.id] }); } else { setNewPath({ ...newPath, course_ids: newPath.course_ids.filter((id: number) => id !== course.id) }); } }} className="rounded" /><span className="text-sm text-gray-700">{course.image_emoji} {course.title}</span><span className="text-xs text-gray-400 ml-auto">{course.duration_hours}h</span></label>))}</div>
                <p className="text-xs text-gray-500 mt-1">{newPath.course_ids.length} formation(s)</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreatePath(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createPath} disabled={!newPath.title} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Demander Formation */}
      {showRequestCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Demander une Formation</h2><button onClick={() => setShowRequestCourse(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={newRequest.title} onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Formation React Avancé" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newRequest.description} onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Pourquoi ? *</label><textarea value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="En quoi serait-elle utile..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Lien (optionnel)</label><input type="url" value={newRequest.external_url} onChange={(e) => setNewRequest({ ...newRequest, external_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label><input type="text" value={newRequest.provider} onChange={(e) => setNewRequest({ ...newRequest, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Coursera, LinkedIn..." /></div>
              {hasPermission(userRole, 'assign_course') && (<div><label className="block text-sm font-medium text-gray-700 mb-1">Pour qui ?</label><select value={newRequest.for_employee_id} onChange={(e) => setNewRequest({ ...newRequest, for_employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Moi-même</option>{employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}</select></div>)}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowRequestCourse(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={submitCourseRequest} disabled={!newRequest.title || !newRequest.reason} className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center"><Send className="w-4 h-4 mr-2" />Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Créer Compétence */}
      {showCreateSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouvelle Compétence</h2><button onClick={() => setShowCreateSkill(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Leadership, Python..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label><select value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">{skillCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreateSkill(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createSkill} disabled={!newSkill.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Évaluer (EPF) */}
      {showEvalModal && selectedEpf && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-gray-900">Évaluation Post-Formation</h2><p className="text-sm text-gray-500 mt-1">{selectedEpf.course_title}</p></div><button onClick={() => { setShowEvalModal(false); setSelectedEpf(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{selectedEpf.employee_initials}</div><div><p className="font-medium text-gray-900">{selectedEpf.employee_name}</p><p className="text-sm text-gray-500">{selectedEpf.employee_job_title}</p></div></div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Critères d&apos;évaluation</h3>
                <div className="space-y-4">
                  {evalCriteria.map((criterion, idx) => (
                    <div key={criterion.code} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">{criterion.label}</label>
                        <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Poids: {criterion.weight}%</span><span className={`text-sm font-bold ${criterion.score >= (epfStats?.passing_threshold || 70) ? 'text-green-600' : criterion.score >= 50 ? 'text-orange-600' : 'text-red-600'}`}>{criterion.score}/100</span></div>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={criterion.score} onChange={(e) => { const updated = [...evalCriteria]; updated[idx] = { ...updated[idx], score: parseInt(e.target.value) }; setEvalCriteria(updated); }} className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary-500" />
                      <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-200">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-gray-700">Score final pondéré</p><p className="text-xs text-gray-500 mt-0.5">Seuil de validation: {epfStats?.passing_threshold || 70}/100</p></div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${computeWeightedScore(evalCriteria) >= (epfStats?.passing_threshold || 70) ? 'text-green-600' : 'text-red-600'}`}>{computeWeightedScore(evalCriteria)}/100</p>
                    <p className={`text-xs font-medium ${computeWeightedScore(evalCriteria) >= (epfStats?.passing_threshold || 70) ? 'text-green-600' : 'text-red-600'}`}>{computeWeightedScore(evalCriteria) >= (epfStats?.passing_threshold || 70) ? '✅ Compétence validée' : '⚠️ Sous le seuil'}</p>
                  </div>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Points forts observés</label><textarea value={evalStrengths} onChange={(e) => setEvalStrengths(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Ex: Bonne compréhension des concepts..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Axes d&apos;amélioration</label><textarea value={evalImprovements} onChange={(e) => setEvalImprovements(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Ex: Manque de pratique sur..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Commentaire global</label><textarea value={evalComments} onChange={(e) => setEvalComments(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Commentaire général..." /></div>
              {computeWeightedScore(evalCriteria) < (epfStats?.passing_threshold || 70) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-red-800">Score insuffisant</p><p className="text-xs text-red-600">Une re-formation sera automatiquement recommandée pour ce collaborateur.</p></div></div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowEvalModal(false); setSelectedEpf(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={submitEvaluation} disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Soumettre l&apos;évaluation</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Détail évaluation EPF */}
      {showEpfDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Détail de l&apos;évaluation</h2><button onClick={() => setShowEpfDetail(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"><span className="text-3xl">{showEpfDetail.course_emoji}</span><div><p className="font-medium text-gray-900">{showEpfDetail.course_title}</p><p className="text-sm text-gray-500">{showEpfDetail.employee_name} • {showEpfDetail.course_category}</p></div></div>
              {showEpfDetail.score !== null && (
                <div className="text-center p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg">
                  <p className={`text-4xl font-bold ${getScoreColor(showEpfDetail.score, epfStats?.passing_threshold || 70)}`}>{showEpfDetail.score}/100</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(showEpfDetail.recommendation)}`}>{getRecommendationLabel(showEpfDetail.recommendation)}</span>
                </div>
              )}
              {showEpfDetail.criteria_scores && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Scores par critère</h4>
                  <div className="space-y-2">
                    {showEpfDetail.criteria_scores.map((c: CriteriaScore) => (
                      <div key={c.code} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">{c.label}</span>
                        <div className="flex items-center gap-2"><div className="w-24 h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${c.score >= (epfStats?.passing_threshold || 70) ? 'bg-green-500' : c.score >= 50 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${c.score}%` }} /></div><span className="text-sm font-medium text-gray-900 w-12 text-right">{c.score}/100</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {showEpfDetail.strengths && (<div><p className="text-xs text-gray-500 mb-1">Points forts</p><p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{showEpfDetail.strengths}</p></div>)}
              {showEpfDetail.improvements && (<div><p className="text-xs text-gray-500 mb-1">Axes d&apos;amélioration</p><p className="text-sm text-gray-700 bg-orange-50 p-2 rounded">{showEpfDetail.improvements}</p></div>)}
              {showEpfDetail.comments && (<div><p className="text-xs text-gray-500 mb-1">Commentaire</p><p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{showEpfDetail.comments}</p></div>)}
              {showEpfDetail.recommendation_details && (<div className={`p-3 rounded-lg border ${showEpfDetail.competency_validated ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}><p className={`text-sm ${showEpfDetail.competency_validated ? 'text-green-700' : 'text-red-700'}`}>{showEpfDetail.recommendation_details}</p></div>)}
              {showEpfDetail.retrain_course_title && (<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg"><p className="text-sm font-medium text-amber-800">🔄 Re-formation assignée</p><p className="text-xs text-amber-600 mt-1">{showEpfDetail.retrain_course_title}</p></div>)}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-2 rounded"><p className="text-xs text-gray-500">Évaluateur</p><p className="font-medium">{showEpfDetail.evaluator_name || '—'}</p></div>
                <div className="bg-gray-50 p-2 rounded"><p className="text-xs text-gray-500">Complétée le</p><p className="font-medium">{showEpfDetail.completed_at ? new Date(showEpfDetail.completed_at).toLocaleDateString('fr-FR') : '—'}</p></div>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Sync module Carrière</span>
                {showEpfDetail.career_synced ? (<span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1"><Link className="w-3 h-3" />Synchronisé</span>) : (<span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">Non synchronisé</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assigner Évaluateur */}
      {showAssignEvaluator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Assigner un évaluateur</h2><button onClick={() => setShowAssignEvaluator(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg"><span className="text-2xl">{showAssignEvaluator.course_emoji}</span><div><p className="font-medium text-gray-900">{showAssignEvaluator.course_title}</p><p className="text-sm text-gray-500">Pour: {showAssignEvaluator.employee_name}</p></div></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Évaluateur *</label><select value={selectedEvaluatorId} onChange={(e) => setSelectedEvaluatorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Sélectionner...</option>{employees.filter(e => e.id !== showAssignEvaluator.employee_id).map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} - {emp.job_title}</option>))}</select></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAssignEvaluator(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={assignEvaluator} disabled={!selectedEvaluatorId} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Assigner</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Paramètres EPF */}
      {showEpfSettings && epfSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Paramètres Éval. Post-Formation</h2><button onClick={() => setShowEpfSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Délai de déclenchement</label><select value={epfSettings.trigger_delay_days} onChange={(e) => setEpfSettings({...epfSettings, trigger_delay_days: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="0">Immédiat (dès validation)</option><option value="3">J+3 (3 jours après)</option><option value="7">J+7 (7 jours après)</option><option value="14">J+14 (14 jours après)</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Évaluateur par défaut</label><select value={epfSettings.default_evaluator_type} onChange={(e) => setEpfSettings({...epfSettings, default_evaluator_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="internal">Évaluateur interne (manager)</option><option value="trainer">Formateur</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Seuil de validation (/100)</label><input type="number" min="0" max="100" value={epfSettings.passing_threshold} onChange={(e) => setEpfSettings({...epfSettings, passing_threshold: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /><p className="text-xs text-gray-400 mt-1">Score minimum pour valider la compétence théorique</p></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="auto_retrain" checked={epfSettings.auto_retrain} onChange={(e) => setEpfSettings({...epfSettings, auto_retrain: e.target.checked})} className="rounded" /><label htmlFor="auto_retrain" className="text-sm text-gray-700">Re-formation automatique si score insuffisant</label></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowEpfSettings(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Fermer</button>
              <button onClick={async () => {
                try { const response = await fetch(`${API_URL}/api/learning/post-eval/settings/config`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(epfSettings) }); if (response.ok) { setShowEpfSettings(false); fetchEpfStats(); } } catch (error) { console.error('Error saving settings:', error); }
              }} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Créer Fournisseur */}
      {showCreateProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouveau Fournisseur</h2><button onClick={() => setShowCreateProvider(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: CEGOS, Coursera..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={newProvider.type} onChange={(e) => setNewProvider({ ...newProvider, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="externe">Externe</option><option value="interne">Interne</option></select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact</label><input type="text" value={newProvider.contact_name} onChange={(e) => setNewProvider({ ...newProvider, contact_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Nom du contact" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label><input type="text" value={newProvider.phone} onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="+225 07 00 00 00" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={newProvider.email} onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="contact@fournisseur.com" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Site web</label><input type="url" value={newProvider.website} onChange={(e) => setNewProvider({ ...newProvider, website: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Spécialités</label><textarea value={newProvider.specialties} onChange={(e) => setNewProvider({ ...newProvider, specialties: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} placeholder="Ex: Management, Leadership, Techniques commerciales..." /></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreateProvider(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createProvider} disabled={!newProvider.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modifier Fournisseur */}
      {showEditProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Modifier le fournisseur</h2><button onClick={() => setShowEditProvider(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" value={showEditProvider.name} onChange={(e) => setShowEditProvider({ ...showEditProvider, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={showEditProvider.type} onChange={(e) => setShowEditProvider({ ...showEditProvider, type: e.target.value as 'interne' | 'externe' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="externe">Externe</option><option value="interne">Interne</option></select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact</label><input type="text" value={showEditProvider.contact_name || ''} onChange={(e) => setShowEditProvider({ ...showEditProvider, contact_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label><input type="text" value={showEditProvider.phone || ''} onChange={(e) => setShowEditProvider({ ...showEditProvider, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={showEditProvider.email || ''} onChange={(e) => setShowEditProvider({ ...showEditProvider, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Site web</label><input type="url" value={showEditProvider.website || ''} onChange={(e) => setShowEditProvider({ ...showEditProvider, website: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Spécialités</label><textarea value={showEditProvider.specialties || ''} onChange={(e) => setShowEditProvider({ ...showEditProvider, specialties: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} /></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="edit-prov-active" checked={showEditProvider.is_active} onChange={(e) => setShowEditProvider({ ...showEditProvider, is_active: e.target.checked })} className="rounded" /><label htmlFor="edit-prov-active" className="text-sm text-gray-700">Fournisseur actif</label></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowEditProvider(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={updateProvider} disabled={!showEditProvider.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
