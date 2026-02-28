// ============================================
// app/dashboard/talents/paths/page.tsx
// Configuration des Parcours de Carrière (Admin RH)
// ============================================

'use client';

import Header from '@/components/Header';
import { useEffect, useState } from 'react';
import {
  Plus, Edit, Trash2, Copy, ChevronDown, ChevronRight, X,
  GraduationCap, Target, Award, Settings, Users, Layers
} from 'lucide-react';
import { useTalents } from '../TalentsContext';
import { CareerPath, CareerLevel, isRH, getInitials } from '../shared';

export default function PathsPage() {
  const {
    paths, selectedPath, loadPaths, loadPathDetail,
    createPath, updatePath, deletePath, duplicatePath,
    createLevel, updateLevel, deleteLevel,
    createCompetency, deleteCompetency,
    createFactor, deleteFactor,
    attitudes, loadAttitudes, linkAttitudes,
  } = useTalents();

  const [showCreate, setShowCreate] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [showAddLevel, setShowAddLevel] = useState(false);
  const canEdit = isRH();

  useEffect(() => { loadPaths(); loadAttitudes(); }, [loadPaths, loadAttitudes]);

  return (
    <>
      <Header title="Parcours de Carrière" subtitle="Configuration des filières et niveaux" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Path List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Filières ({paths.length})</h3>
              {canEdit && (
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600">
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
                        <button onClick={() => { if (confirm('Supprimer ce parcours ?')) deletePath(selectedPath.id); }}
                          className="p-2 text-gray-400 hover:text-red-500" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50"
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
                            <h5 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1 mb-2">
                              <Award className="w-3 h-3" /> Attitudes requises
                            </h5>
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
                            <h5 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1 mb-2">
                              <Target className="w-3 h-3" /> Facteurs de promotion
                            </h5>
                            {level.promotion_factors && level.promotion_factors.length > 0 ? (
                              <div className="space-y-1">
                                {level.promotion_factors.map(f => (
                                  <div key={f.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-xs text-gray-700">{f.factor_name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{f.factor_type}</span>
                                      {f.is_blocking && <span className="text-xs text-red-500">Bloquant</span>}
                                      {canEdit && (
                                        <button onClick={() => deleteFactor(f.id)} className="text-gray-400 hover:text-red-500">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
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
                              <button onClick={() => { if (confirm('Supprimer ce niveau ?')) deleteLevel(level.id); }}
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
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Sélectionnez un parcours pour voir ses détails</p>
              </div>
            )}
          </div>
        </div>

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
