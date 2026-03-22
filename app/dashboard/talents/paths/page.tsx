// ============================================
// app/dashboard/talents/paths/page.tsx
// Configuration des Parcours de Carrière (Admin RH)
// ============================================

'use client';

import Header from '@/components/Header';
import { useEffect, useState } from 'react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { pathsTips } from '@/config/pageTips';
import {
  Plus, Edit, Trash2, Copy, ChevronDown, ChevronRight, X,
  GraduationCap, Target, Award, Settings, Users, Layers
} from 'lucide-react';
import { useTalents } from '../TalentsContext';
import { CareerPath, CareerLevel, isRH, getInitials, apiFetch, ELIGIBILITY_LABELS } from '../shared';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function PathsPage() {
  const {
    paths, selectedPath, loadPaths, loadPathDetail,
    createPath, updatePath, deletePath, duplicatePath,
    createLevel, updateLevel, deleteLevel,
    createCompetency, deleteCompetency,
    createFactor, updateFactor, deleteFactor,
    attitudes, loadAttitudes, linkAttitudes,
    employeeCareers, loadEmployeeCareers, assignEmployee, unassignCareer,
  } = useTalents();

  const [showCreate, setShowCreate] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [editLevelId, setEditLevelId] = useState<number | null>(null);
  const [editFactorId, setEditFactorId] = useState<number | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [activeTab, setActiveTab] = useState<'levels' | 'employees'>('levels');
  const [addCompForLevel, setAddCompForLevel] = useState<number | null>(null);
  const [addAttForLevel, setAddAttForLevel] = useState<number | null>(null);
  const [addFactorForLevel, setAddFactorForLevel] = useState<number | null>(null);
  const canEdit = isRH();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('paths');

  useEffect(() => { loadPaths(); loadAttitudes(); }, [loadPaths, loadAttitudes]);

  useEffect(() => {
    if (selectedPath) {
      loadEmployeeCareers(selectedPath.id);
      setActiveTab('levels');
    }
  }, [selectedPath?.id]);

  return (
    <>
      {showTips && (
        <PageTourTips tips={pathsTips} onDismiss={dismissTips} pageTitle="Parcours de Carrière" />
      )}
      <Header title="Parcours de Carrière" subtitle="Configuration des filières et niveaux" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Path List */}
          <div className="space-y-4" data-tour="paths-list">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Filières ({paths.length})</h3>
              {canEdit && (
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600"
                  data-tour="create-path"
                >
                  <Plus className="w-3 h-3 mr-1" />Nouvelle
                </button>
              )}
            </div>

            {paths.map(path => (
              <div
                key={path.id}
                onClick={() => loadPathDetail(path.id)}
                className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-colors ${
                  selectedPath?.id === path.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{path.name}</h4>
                    {path.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{path.description}</p>}
                  </div>
                  {!path.is_active && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">Inactif</span>
                  )}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{path.level_count || 0} niveaux</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{path.employee_count || 0} employés</span>
                </div>
              </div>
            ))}

            {paths.length === 0 && (
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
                <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400">Aucun parcours créé</p>
              </div>
            )}
          </div>

          {/* Right: Path Detail */}
          <div className="lg:col-span-2">
            {selectedPath ? (
              <div className="space-y-4">
                {/* Path Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedPath.name}</h2>
                      {selectedPath.description && <p className="text-sm text-gray-500 mt-1">{selectedPath.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>{selectedPath.levels?.length || 0} niveaux</span>
                        <span>{selectedPath.employee_count || 0} employés assignés</span>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button onClick={() => duplicatePath(selectedPath.id)}
                          className="p-2 text-gray-400 hover:text-primary-500" title="Dupliquer">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Supprimer le parcours',
                            message: 'Supprimer ce parcours ?',
                            danger: true,
                            onConfirm: () => { setConfirmDialog(null); deletePath(selectedPath.id); },
                          });
                        }}
                          className="p-2 text-gray-400 hover:text-red-500" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-5 pt-3">
                  <button
                    onClick={() => setActiveTab('levels')}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'levels' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Niveaux ({selectedPath.levels?.length || 0})
                  </button>
                  <button
                    onClick={() => { setActiveTab('employees'); loadEmployeeCareers(selectedPath.id); }}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'employees' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Employés ({selectedPath.employee_count || employeeCareers.length || 0})
                  </button>
                </div>

                {/* ── LEVELS TAB ── */}
                {activeTab === 'levels' && (<>

                {/* Timeline visual */}
                {selectedPath.levels && selectedPath.levels.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Parcours</h3>
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                      {selectedPath.levels.map((lv: CareerLevel, i: number) => (
                        <div key={lv.id} className="flex items-center">
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                            lv.is_entry_level ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {lv.title}
                          </div>
                          {i < (selectedPath.levels?.length ?? 0) - 1 && (
                            <ChevronRight className="w-4 h-4 text-gray-400 mx-1 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Levels */}
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Niveaux</h3>
                  {canEdit && (
                    <button onClick={() => setShowAddLevel(true)}
                      className="flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50">
                      <Plus className="w-3 h-3 mr-1" />Ajouter niveau
                    </button>
                  )}
                </div>

                {selectedPath.levels?.map((level: CareerLevel) => {
                  const isExpanded = expandedLevel === level.id;
                  return (
                    <div key={level.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedLevel(isExpanded ? null : level.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-bold text-sm">
                              {level.level_order}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{level.title}</h4>
                              <p className="text-xs text-gray-500">
                                {level.competencies?.length || 0} compétences
                                {level.min_tenure_months > 0 && ` • ${level.min_tenure_months} mois min`}
                                {level.is_entry_level && ' • Niveau d\'entrée'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{level.employee_count || 0} emp.</span>
                            {canEdit && (
                              <button
                                onClick={e => { e.stopPropagation(); setEditLevelId(level.id); }}
                                className="p-1 text-gray-400 hover:text-primary-500"
                                title="Modifier le niveau"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4 space-y-4">
                          {/* Compétences */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" /> Compétences
                              </h5>
                              {canEdit && (
                                <button onClick={() => setAddCompForLevel(level.id)}
                                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                                  <Plus className="w-3 h-3" />Ajouter
                                </button>
                              )}
                            </div>
                            {level.competencies && level.competencies.length > 0 ? (
                              <div className="space-y-2">
                                {level.competencies.map(comp => (
                                  <div key={comp.id} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{comp.competency_name}</p>
                                        {comp.description && <p className="text-xs text-gray-500 mt-0.5">{comp.description}</p>}
                                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                          <span>Perf ≥ {comp.performance_threshold}%</span>
                                          <span>Attitude ≥ {comp.attitude_threshold}%</span>
                                          {comp.is_mandatory && <span className="text-red-500">Obligatoire</span>}
                                        </div>
                                        {comp.trainings && comp.trainings.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {comp.trainings.map(t => (
                                              <span key={t.id} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                                {t.emoji || '📚'} {t.title}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      {canEdit && (
                                        <button onClick={() => deleteCompetency(comp.id)}
                                          className="p-1 text-gray-400 hover:text-red-500">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Aucune compétence définie</p>
                            )}
                          </div>

                          {/* Attitudes requises */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1">
                                <Award className="w-3 h-3" /> Attitudes requises
                              </h5>
                              {canEdit && (
                                <button onClick={() => setAddAttForLevel(level.id)}
                                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                                  <Plus className="w-3 h-3" />Configurer
                                </button>
                              )}
                            </div>
                            {level.required_attitudes && level.required_attitudes.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {level.required_attitudes.map(att => (
                                  <span key={att.id} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded flex items-center gap-1">
                                    {att.attitude_icon || '🎯'} {att.attitude_name} (≥{att.threshold}%)
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Aucune attitude requise</p>
                            )}
                          </div>

                          {/* Facteurs de promotion */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1">
                                <Target className="w-3 h-3" /> Facteurs de promotion
                              </h5>
                              {canEdit && (
                                <button onClick={() => setAddFactorForLevel(level.id)}
                                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                                  <Plus className="w-3 h-3" />Ajouter
                                </button>
                              )}
                            </div>
                            {level.promotion_factors && level.promotion_factors.length > 0 ? (
                              <div className="space-y-1">
                                {level.promotion_factors.map(f => (
                                  <div key={f.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-xs text-gray-700">{f.factor_name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{f.factor_type}</span>
                                      {f.is_blocking && <span className="text-xs text-red-500">Bloquant</span>}
                                      {canEdit && (
                                        <>
                                          <button onClick={() => setEditFactorId(f.id)} className="text-gray-400 hover:text-primary-500" title="Modifier">
                                            <Edit className="w-3 h-3" />
                                          </button>
                                          <button onClick={() => deleteFactor(f.id)} className="text-gray-400 hover:text-red-500" title="Supprimer">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Aucun facteur défini</p>
                            )}
                          </div>

                          {/* Actions */}
                          {canEdit && (
                            <div className="flex gap-2 pt-2 border-t border-gray-200">
                              <button onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Supprimer le niveau',
                                  message: 'Supprimer ce niveau ?',
                                  danger: true,
                                  onConfirm: () => { setConfirmDialog(null); deleteLevel(level.id); },
                                });
                              }}
                                className="text-xs text-red-500 hover:text-red-700">Supprimer le niveau</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(!selectedPath.levels || selectedPath.levels.length === 0) && (
                  <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
                    <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-400">Aucun niveau dans ce parcours</p>
                  </div>
                )}

                </>)}

                {/* ── EMPLOYEES TAB ── */}
                {activeTab === 'employees' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">
                        Employés assignés ({employeeCareers.length})
                      </h3>
                      {canEdit && (
                        <button
                          onClick={() => setShowAssign(true)}
                          className="flex items-center px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600"
                        >
                          <Plus className="w-3 h-3 mr-1" />Assigner un employé
                        </button>
                      )}
                    </div>

                    {employeeCareers.length === 0 ? (
                      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
                        <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm text-gray-400">Aucun employé assigné à ce parcours</p>
                        {canEdit && (
                          <button
                            onClick={() => setShowAssign(true)}
                            className="mt-3 inline-flex items-center px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                          >
                            <Plus className="w-4 h-4 mr-1" />Assigner le premier employé
                          </button>
                        )}
                      </div>
                    ) : (
                      employeeCareers.map(ec => {
                        const elig = ELIGIBILITY_LABELS[ec.eligibility_status] || { label: ec.eligibility_status, color: 'text-gray-600 bg-gray-100' };
                        const initials = `${(ec.first_name || '')[0] || ''}${(ec.last_name || '')[0] || ''}`.toUpperCase();
                        return (
                          <div key={ec.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center gap-3">
                              {ec.photo_url ? (
                                <img src={ec.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                                  {initials}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">
                                  {ec.first_name} {ec.last_name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{ec.job_title}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">{ec.current_level_title}</p>
                                  {ec.overall_progress != null && (
                                    <p className="text-xs text-gray-400">{ec.overall_progress}% progression</p>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${elig.color}`}>
                                  {elig.label}
                                </span>
                                {canEdit && (
                                  <button
                                    onClick={async () => {
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Retirer du parcours',
                                        message: `Retirer ${ec.first_name} ${ec.last_name} de ce parcours ?`,
                                        danger: true,
                                        onConfirm: async () => {
                                          setConfirmDialog(null);
                                          await unassignCareer(ec.employee_id, selectedPath.id);
                                          loadEmployeeCareers(selectedPath.id);
                                        },
                                      });
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                                    title="Retirer du parcours"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {ec.overall_progress != null && (
                              <div className="mt-3">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary-500 rounded-full transition-all"
                                    style={{ width: `${ec.overall_progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Sélectionnez un parcours pour voir ses détails</p>
              </div>
            )}
          </div>
        </div>

        {/* Edit Level Modal */}
        {editLevelId !== null && selectedPath && (() => {
          const lvl = selectedPath.levels?.find((l: CareerLevel) => l.id === editLevelId);
          if (!lvl) return null;
          return (
            <EditLevelModal
              level={lvl}
              onClose={() => setEditLevelId(null)}
              onSave={async (data) => {
                await updateLevel(editLevelId, data);
                setEditLevelId(null);
              }}
            />
          );
        })()}

        {/* Edit Factor Modal */}
        {editFactorId !== null && selectedPath && (() => {
          const factor = selectedPath.levels?.flatMap((l: CareerLevel) => l.promotion_factors || []).find((f: any) => f.id === editFactorId);
          if (!factor) return null;
          return (
            <EditFactorModal
              factor={factor}
              onClose={() => setEditFactorId(null)}
              onSave={async (data) => {
                await updateFactor(editFactorId, data);
                setEditFactorId(null);
              }}
            />
          );
        })()}

        {/* Create Path Modal */}
        {showCreate && <CreatePathModal onClose={() => setShowCreate(false)} onCreate={createPath} />}

        {/* Add Level Modal */}
        {showAddLevel && selectedPath && (
          <AddLevelModal
            pathId={selectedPath.id}
            existingCount={selectedPath.levels?.length || 0}
            onClose={() => setShowAddLevel(false)}
            onAdd={createLevel}
          />
        )}

        {/* Add Competency Modal */}
        {addCompForLevel !== null && (
          <AddCompetencyModal
            levelId={addCompForLevel}
            onClose={() => setAddCompForLevel(null)}
            onAdd={async (data) => {
              await createCompetency(addCompForLevel, data);
              setAddCompForLevel(null);
            }}
          />
        )}

        {/* Link Attitudes Modal */}
        {addAttForLevel !== null && selectedPath && (
          <LinkAttitudesModal
            levelId={addAttForLevel}
            currentAttitudes={selectedPath.levels?.find((l: CareerLevel) => l.id === addAttForLevel)?.required_attitudes || []}
            availableAttitudes={attitudes}
            onClose={() => setAddAttForLevel(null)}
            onSave={async (attitudeIds, threshold) => {
              await linkAttitudes(addAttForLevel, attitudeIds, threshold);
              setAddAttForLevel(null);
            }}
          />
        )}

        {/* Add Factor Modal */}
        {addFactorForLevel !== null && (
          <AddFactorModal
            levelId={addFactorForLevel}
            onClose={() => setAddFactorForLevel(null)}
            onAdd={async (data) => {
              await createFactor(addFactorForLevel, data);
              setAddFactorForLevel(null);
            }}
          />
        )}

        {/* Assign Employee Modal */}
        {showAssign && selectedPath && (
          <AssignEmployeeModal
            path={selectedPath}
            onClose={() => setShowAssign(false)}
            onAssign={async (employeeId, levelId) => {
              await assignEmployee(employeeId, selectedPath.id, levelId);
              await loadEmployeeCareers(selectedPath.id);
              setShowAssign(false);
            }}
          />
        )}
        
        {/* Confirm Dialog */}
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
      </main>
    </>
  );
}

// ============================================
// MODALS
// ============================================

function CreatePathModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, desc?: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onCreate(name, desc || undefined); onClose(); } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Nouveau Parcours</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la filière</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ex: Carrière Direction Technique" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignEmployeeModal({ path, onClose, onAssign }: {
  path: any;
  onClose: () => void;
  onAssign: (employeeId: number, levelId: number) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<number>(
    path.levels?.find((l: CareerLevel) => l.is_entry_level)?.id || path.levels?.[0]?.id || 0
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/employees/?page_size=200')
      .then(data => {
        const list = data.items || data.employees || [];
        setEmployees(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered([]); return; }
    const q = search.toLowerCase();
    setFiltered(
      employees
        .filter(e => `${e.first_name} ${e.last_name} ${e.job_title || ''}`.toLowerCase().includes(q))
        .slice(0, 8)
    );
  }, [search, employees]);

  const handleSubmit = async () => {
    if (!selectedEmployee || !selectedLevelId) return;
    setSaving(true);
    try { await onAssign(selectedEmployee.id, selectedLevelId); }
    catch { setSaving(false); }
  };

  const levels: CareerLevel[] = path.levels || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Assigner un Employé</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-4">
          {/* Employee search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employé</label>
            {selectedEmployee ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-primary-300 bg-primary-50 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-primary-200 flex items-center justify-center text-primary-700 text-xs font-semibold flex-shrink-0">
                  {`${(selectedEmployee.first_name || '')[0] || ''}${(selectedEmployee.last_name || '')[0] || ''}`.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900 flex-1">
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </span>
                <button onClick={() => { setSelectedEmployee(null); setSearch(''); }}
                  className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder={loading ? 'Chargement...' : 'Rechercher un employé...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {showDropdown && filtered.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map(emp => (
                      <button
                        key={emp.id}
                        type="button"
                        onMouseDown={() => { setSelectedEmployee(emp); setSearch(''); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-semibold flex-shrink-0">
                          {`${(emp.first_name || '')[0] || ''}${(emp.last_name || '')[0] || ''}`.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                          {emp.job_title && <p className="text-xs text-gray-500">{emp.job_title}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && search.trim() && filtered.length === 0 && !loading && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-400 text-center">
                    Aucun employé trouvé
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Level selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau d'entrée</label>
            <select
              value={selectedLevelId}
              onChange={e => setSelectedLevelId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {levels.map((lv: CareerLevel) => (
                <option key={lv.id} value={lv.id}>
                  {lv.level_order}. {lv.title}{lv.is_entry_level ? ' (entrée)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedEmployee || !selectedLevelId}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? 'Assignation...' : 'Assigner'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddLevelModal({ pathId, existingCount, onClose, onAdd }: {
  pathId: number; existingCount: number; onClose: () => void; onAdd: (pathId: number, data: any) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [order, setOrder] = useState(existingCount + 1);
  const [tenure, setTenure] = useState(0);
  const [isEntry, setIsEntry] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onAdd(pathId, { title, level_order: order, min_tenure_months: tenure, is_entry_level: isEntry });
      onClose();
    } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Ajouter un Niveau</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre du niveau</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ex: Chef de Service" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
              <input type="number" value={order} onChange={e => setOrder(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ancienneté min (mois)</label>
              <input type="number" value={tenure} onChange={e => setTenure(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isEntry} onChange={e => setIsEntry(e.target.checked)}
              className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">Niveau d'entrée</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AddCompetencyModal
// ============================================

function AddCompetencyModal({ levelId, onClose, onAdd }: {
  levelId: number;
  onClose: () => void;
  onAdd: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [perfThreshold, setPerfThreshold] = useState(75);
  const [attThreshold, setAttThreshold] = useState(75);
  const [isMandatory, setIsMandatory] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        competency_name: name,
        description: desc || null,
        performance_threshold: perfThreshold,
        attitude_threshold: attThreshold,
        is_mandatory: isMandatory,
      });
    } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Ajouter une Compétence</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la compétence *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: Maîtrise des outils de gestion de projet" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2}
              placeholder="Description de la compétence attendue..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seuil Performance <span className="text-primary-600 font-bold">{perfThreshold}%</span>
              </label>
              <input type="range" min={0} max={100} step={5} value={perfThreshold}
                onChange={e => setPerfThreshold(Number(e.target.value))}
                className="w-full accent-primary-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0%</span><span>100%</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seuil Attitude <span className="text-purple-600 font-bold">{attThreshold}%</span>
              </label>
              <input type="range" min={0} max={100} step={5} value={attThreshold}
                onChange={e => setAttThreshold(Number(e.target.value))}
                className="w-full accent-purple-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0%</span><span>100%</span></div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)}
              className="rounded border-gray-300 text-primary-500" />
            <span className="text-sm text-gray-700">Compétence obligatoire</span>
            <span className="text-xs text-gray-400">(bloque la promotion si non validée)</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LinkAttitudesModal
// ============================================

function LinkAttitudesModal({ levelId, currentAttitudes, availableAttitudes, onClose, onSave }: {
  levelId: number;
  currentAttitudes: any[];
  availableAttitudes: any[];
  onClose: () => void;
  onSave: (attitudeIds: number[], threshold: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>(currentAttitudes.map(a => a.attitude_id));
  const [threshold, setThreshold] = useState(95);
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(selected, threshold); }
    catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Configurer les Attitudes</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seuil minimum requis : <span className="text-purple-600 font-bold">{threshold}%</span>
          </label>
          <input type="range" min={50} max={100} step={5} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-purple-500" />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>50%</span><span>100%</span></div>
        </div>

        <p className="text-xs text-gray-500 mb-3">Sélectionnez les attitudes requises pour ce niveau :</p>

        {availableAttitudes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune attitude disponible. Configurez-les dans les paramètres.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {availableAttitudes.map(att => (
              <label key={att.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                selected.includes(att.id) ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="checkbox" checked={selected.includes(att.id)} onChange={() => toggle(att.id)}
                  className="rounded border-gray-300 text-purple-500" />
                <span className="text-lg">{att.icon || '🎯'}</span>
                <span className="text-sm text-gray-800 font-medium">{att.name}</span>
              </label>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          {selected.length} attitude{selected.length !== 1 ? 's' : ''} sélectionnée{selected.length !== 1 ? 's' : ''}
        </p>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AddFactorModal
// ============================================

function AddFactorModal({ levelId, onClose, onAdd }: {
  levelId: number;
  onClose: () => void;
  onAdd: (data: { name: string; is_blocking: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    await onAdd({ name, is_blocking: isBlocking });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Ajouter un Facteur d'Évolution</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du facteur d'évolution</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="ex: Certification obtenue"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isBlocking} onChange={e => setIsBlocking(e.target.checked)}
              className="rounded border-gray-300 text-red-500" />
            <span className="text-sm text-gray-700">Facteur bloquant</span>
            <span className="text-xs text-gray-400">(la promotion est impossible sans ce critère)</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddFactorModalNew({ levelId, onClose, onAdd }: {
  levelId: number;
  onClose: () => void;
  onAdd: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [factorType, setFactorType] = useState<'auto' | 'committee' | 'n_plus_1'>('auto');
  const [thresholdValue, setThresholdValue] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [saving, setSaving] = useState(false);

  const FACTOR_TYPES = [
    { value: 'auto', label: 'Automatique', desc: 'Validé automatiquement par le système' },
    { value: 'committee', label: 'Comité RH', desc: 'Requiert l\'approbation du comité' },
    { value: 'n_plus_1', label: 'Manager N+1', desc: 'Validé par le manager direct' },
  ];

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        factor_name: name,
        factor_type: factorType,
        threshold_value: thresholdValue || null,
        is_blocking: isBlocking,
      });
    } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Ajouter un Facteur de Promotion</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du facteur *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: Ancienneté ≥ 12 mois, Évaluation ≥ 4/5..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de validation</label>
            <div className="space-y-2">
              {FACTOR_TYPES.map(ft => (
                <label key={ft.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  factorType === ft.value ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" name="factorType" value={ft.value} checked={factorType === ft.value}
                    onChange={() => setFactorType(ft.value as any)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ft.label}</p>
                    <p className="text-xs text-gray-500">{ft.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seuil / Valeur (optionnel)</label>
            <input value={thresholdValue} onChange={e => setThresholdValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: 12, 80%, Approuvé..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isBlocking} onChange={e => setIsBlocking(e.target.checked)}
              className="rounded border-gray-300 text-red-500" />
            <span className="text-sm text-gray-700">Facteur bloquant</span>
            <span className="text-xs text-gray-400">(la promotion est impossible sans ce critère)</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditLevelModal({ level, onClose, onSave }: {
  level: CareerLevel;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [title, setTitle] = useState(level.title);
  const [tenure, setTenure] = useState(level.min_tenure_months);
  const [isEntry, setIsEntry] = useState(level.is_entry_level);
  const [description, setDescription] = useState(level.description || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title, min_tenure_months: tenure, is_entry_level: isEntry, description: description || null });
    } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Modifier le Niveau</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: Chef de Service" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ancienneté minimum (mois)</label>
            <input type="number" value={tenure} onChange={e => setTenure(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" min={0} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isEntry} onChange={e => setIsEntry(e.target.checked)}
              className="rounded border-gray-300 text-primary-500" />
            <span className="text-sm text-gray-700">Niveau d'entrée dans le parcours</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditFactorModal({ factor, onClose, onSave }: {
  factor: PromotionFactor;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState(factor.factor_name);
  const [factorType, setFactorType] = useState<'auto' | 'committee' | 'n_plus_1'>(factor.factor_type);
  const [thresholdValue, setThresholdValue] = useState(factor.threshold_value || '');
  const [isBlocking, setIsBlocking] = useState(factor.is_blocking);
  const [saving, setSaving] = useState(false);

  const FACTOR_TYPES = [
    { value: 'auto', label: 'Automatique', desc: 'Validé automatiquement par le système' },
    { value: 'committee', label: 'Comité RH', desc: "Requiert l'approbation du comité" },
    { value: 'n_plus_1', label: 'Manager N+1', desc: 'Validé par le manager direct' },
  ];

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        factor_name: name,
        factor_type: factorType,
        threshold_value: thresholdValue || null,
        is_blocking: isBlocking,
      });
    } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Modifier le Facteur de Promotion</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du facteur *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: Ancienneté ≥ 12 mois..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de validation</label>
            <div className="space-y-2">
              {FACTOR_TYPES.map(ft => (
                <label key={ft.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  factorType === ft.value ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" name="editFactorType" value={ft.value} checked={factorType === ft.value}
                    onChange={() => setFactorType(ft.value as any)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ft.label}</p>
                    <p className="text-xs text-gray-500">{ft.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seuil / Valeur (optionnel)</label>
            <input value={thresholdValue} onChange={e => setThresholdValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: 12, 80%, Approuvé..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isBlocking} onChange={e => setIsBlocking(e.target.checked)}
              className="rounded border-gray-300 text-red-500" />
            <span className="text-sm text-gray-700">Facteur bloquant</span>
            <span className="text-xs text-gray-400">(la promotion est impossible sans ce critère)</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
