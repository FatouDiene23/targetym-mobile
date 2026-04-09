// ============================================
// app/dashboard/talents/succession/page.tsx
// Plans de Succession
// ============================================

'use client';

import Header from '@/components/Header';
import { useEffect, useState } from 'react';
import { Crown, Plus, Eye, Edit, Trash2, UserPlus, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useTalents } from '../TalentsContext';
import {
  SuccessionPlan, CRITICALITY_LABELS, RISK_LABELS, READINESS_LABELS,
  getInitials, isRH, isManager, apiFetch
} from '../shared';

export default function SuccessionPage() {
  const {
    successionPlans, selectedPlan, loadSuccessionPlans, loadPlanDetail,
    createSuccessionPlan, updateSuccessionPlan, deleteSuccessionPlan,
    addCandidate, updateCandidate, removeCandidate
  } = useTalents();

  const [filterCrit, setFilterCrit] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const canEdit = isRH() || isManager();

  useEffect(() => { loadSuccessionPlans(); }, [loadSuccessionPlans]);

  const handleFilter = (crit: string) => {
    setFilterCrit(crit);
    loadSuccessionPlans(crit || undefined);
  };

  const handleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadPlanDetail(id);
    }
  };

  return (
    <>
      <Header title="Plans de Succession" subtitle="Postes critiques et successeurs identifiés" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Actions */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <div className="flex gap-3">
            <select
              value={filterCrit}
              onChange={e => handleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Toutes criticités</option>
              <option value="critical">Critique</option>
              <option value="high">Élevé</option>
              <option value="medium">Moyen</option>
            </select>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
            >
              <Plus className="w-4 h-4 mr-2" />Nouveau Plan
            </button>
          )}
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {successionPlans.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Crown className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Aucun plan de succession</p>
            </div>
          ) : (
            successionPlans.map(plan => {
              const isExpanded = expandedId === plan.id;
              const critInfo = CRITICALITY_LABELS[plan.criticality] || CRITICALITY_LABELS.medium;
              const riskInfo = RISK_LABELS[plan.vacancy_risk] || RISK_LABELS.low;

              return (
                <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header */}
                  <div
                    className="p-3 lg:p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleExpand(plan.id)}
                  >
                    {/* Ligne 1 : Poste + chevron */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 lg:gap-4 min-w-0">
                        <div className="w-9 h-9 lg:w-12 lg:h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Crown className="w-4 h-4 lg:w-6 lg:h-6 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm lg:text-base truncate">{plan.position_title}</h3>
                          <p className="text-xs lg:text-sm text-gray-500">{plan.department || '-'}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
                    </div>
                    {/* Ligne 2 : Badges + infos */}
                    <div className="flex items-center gap-2 mt-2 ml-11 lg:ml-16 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${critInfo.color}`}>
                        {critInfo.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${riskInfo.color}`}>
                        Risque: {riskInfo.label}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">
                        {plan.candidate_count || 0} candidat(s)
                      </span>
                      {plan.current_holder_name && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          Titulaire: <span className="font-medium text-gray-700">{plan.current_holder_name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded: Candidates */}
                  {isExpanded && selectedPlan?.id === plan.id && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-gray-700">
                          Successeurs Identifiés ({selectedPlan.candidates?.length || 0})
                        </h4>
                        {canEdit && (
                          <button
                            onClick={() => setShowAddCandidate(plan.id)}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center"
                          >
                            <UserPlus className="w-4 h-4 mr-1" />Ajouter
                          </button>
                        )}
                      </div>

                      {selectedPlan.candidates && selectedPlan.candidates.length > 0 ? (
                        <div className="space-y-3">
                          {selectedPlan.candidates.map((cand, i) => {
                            const readyInfo = READINESS_LABELS[cand.readiness] || READINESS_LABELS['3+ years'];
                            return (
                              <div key={cand.id} className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                                    {cand.rank_order}
                                  </div>
                                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 font-medium text-sm">
                                    {getInitials(cand.first_name, cand.last_name)}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{cand.first_name} {cand.last_name}</p>
                                    <p className="text-xs text-gray-500">{cand.job_title} • {cand.department_name || '-'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${readyInfo.color}`}>
                                    {readyInfo.label}
                                  </span>
                                  {/* Scores 9-Box */}
                                  {(cand.latest_perf != null || cand.latest_pot != null) ? (
                                    <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-lg">
                                      <div className="text-center">
                                        <p className="text-xs text-gray-500">Perf.</p>
                                        <p className="text-sm font-bold text-primary-600">{Number(cand.latest_perf).toFixed(1)}</p>
                                      </div>
                                      <div className="w-px h-6 bg-gray-300" />
                                      <div className="text-center">
                                        <p className="text-xs text-gray-500">Pot.</p>
                                        <p className="text-sm font-bold text-green-600">{Number(cand.latest_pot).toFixed(1)}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400 px-2">Non évalué</span>
                                  )}
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-primary-600">{cand.preparation_score}%</p>
                                    <p className="text-xs text-gray-500">Préparation</p>
                                  </div>
                                  <div className="w-24 h-2 bg-gray-200 rounded-full">
                                    <div
                                      className={`h-full rounded-full ${cand.preparation_score >= 80 ? 'bg-green-500' : cand.preparation_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                      style={{ width: `${cand.preparation_score}%` }}
                                    />
                                  </div>
                                  {canEdit && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeCandidate(cand.id); }}
                                      className="p-1 text-gray-400 hover:text-red-500"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">Aucun successeur identifié</p>
                      )}

                      {/* Plan actions */}
                      {canEdit && (
                        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => deleteSuccessionPlan(plan.id)}
                            className="text-sm text-red-500 hover:text-red-700"
                          >
                            Supprimer le plan
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Create Modal */}
        {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} onCreate={createSuccessionPlan} />}

        {/* Add Candidate Modal */}
        {showAddCandidate !== null && (
          <AddCandidateModal
            planId={showAddCandidate}
            onClose={() => { setShowAddCandidate(null); loadPlanDetail(showAddCandidate); }}
            onAdd={addCandidate}
          />
        )}
      </main>
    </>
  );
}

// ============================================
// CREATE PLAN MODAL
// ============================================

function CreatePlanModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => Promise<void> }) {
  const [form, setForm] = useState({
    position_title: '', department: '', criticality: 'medium', vacancy_risk: 'low', notes: '', current_holder_id: null as number | null
  });
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchEmp, setSearchEmp] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchDept, setSearchDept] = useState('');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [showPosDropdown, setShowPosDropdown] = useState(false);

  useEffect(() => {
    apiFetch('/api/employees/?page_size=200').then(data => {
      const list = Array.isArray(data) ? data : (data.items || data.employees || []);
      setEmployees(list);
    }).catch(() => {});
    apiFetch('/api/departments/').then(data => {
      setDepartments(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const filteredEmployees = employees.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchEmp.toLowerCase())
  );

  const allJobTitles = Array.from(new Set(
    employees.map(e => e.job_title).filter(Boolean)
  )).sort() as string[];
  const filteredPositions = allJobTitles.filter(t =>
    t.toLowerCase().includes((form.position_title || '').toLowerCase())
  );

  const selectedHolder = employees.find(e => e.id === form.current_holder_id);

  const handleSubmit = async () => {
    if (!form.position_title.trim()) return;
    setSaving(true);
    try { await onCreate(form); onClose(); } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Nouveau Plan de Succession</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
            <div className="relative">
              {form.position_title && !showPosDropdown ? (
                <div className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-900">{form.position_title}</span>
                  <button onClick={() => { setForm({ ...form, position_title: '' }); }} className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={form.position_title}
                    onChange={e => { setForm({ ...form, position_title: e.target.value }); setShowPosDropdown(true); }}
                    onFocus={() => setShowPosDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPosDropdown(false), 150)}
                    placeholder="Ex: Directeur Technique"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {showPosDropdown && filteredPositions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredPositions.slice(0, 10).map((title, i) => (
                        <button
                          key={i}
                          onMouseDown={() => { setForm({ ...form, position_title: title as string }); setShowPosDropdown(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-900"
                        >
                          {title as string}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
            <div className="relative">
              {form.department ? (
                <div className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-900">{form.department}</span>
                  <button onClick={() => { setForm({ ...form, department: '' }); setSearchDept(''); }} className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={searchDept}
                    onChange={e => { setSearchDept(e.target.value); setShowDeptDropdown(true); }}
                    onFocus={() => setShowDeptDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDeptDropdown(false), 150)}
                    placeholder="Rechercher un département..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {showDeptDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {departments
                        .filter(d => d.name?.toLowerCase().includes(searchDept.toLowerCase()))
                        .slice(0, 10)
                        .map(d => (
                          <button
                            key={d.id}
                            onMouseDown={() => { setForm({ ...form, department: d.name }); setSearchDept(''); setShowDeptDropdown(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-900"
                          >
                            {d.name}
                          </button>
                        ))}
                      {departments.filter(d => d.name?.toLowerCase().includes(searchDept.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-400">Aucun département trouvé</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titulaire Actuel <span className="text-gray-400">(optionnel)</span></label>
            {selectedHolder ? (
              <div className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-900">{selectedHolder.first_name} {selectedHolder.last_name} — {selectedHolder.job_title || ''}</span>
                <button onClick={() => setForm({ ...form, current_holder_id: null })} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={searchEmp}
                  onChange={e => setSearchEmp(e.target.value)}
                  placeholder="Rechercher un employé..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {searchEmp && filteredEmployees.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredEmployees.slice(0, 8).map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => { setForm({ ...form, current_holder_id: emp.id }); setSearchEmp(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between"
                      >
                        <span className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</span>
                        <span className="text-gray-400 text-xs">{emp.job_title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Criticité</label>
              <select value={form.criticality} onChange={e => setForm({ ...form, criticality: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="critical">Critique</option>
                <option value="high">Élevé</option>
                <option value="medium">Moyen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risque Vacance</label>
              <select value={form.vacancy_risk} onChange={e => setForm({ ...form, vacancy_risk: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !form.position_title.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ADD CANDIDATE MODAL
// ============================================

function AddCandidateModal({ planId, onClose, onAdd }: {
  planId: number;
  onClose: () => void;
  onAdd: (planId: number, data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    employee_id: null as number | null,
    readiness: '3+ years',
    preparation_score: 0,
    rank_order: 1,
    development_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchEmp, setSearchEmp] = useState('');

  useEffect(() => {
    apiFetch('/api/employees/?page_size=200').then(data => {
      const list = Array.isArray(data) ? data : (data.items || data.employees || []);
      setEmployees(list);
    }).catch(() => {});
  }, []);

  const filteredEmployees = employees.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchEmp.toLowerCase())
  );
  const selectedEmp = employees.find(e => e.id === form.employee_id);

  const handleSubmit = async () => {
    if (!form.employee_id) return;
    setSaving(true);
    try { await onAdd(planId, form); onClose(); } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Ajouter un Successeur</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          {/* Sélecteur employé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employé <span className="text-red-500">*</span></label>
            {selectedEmp ? (
              <div className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-900">{selectedEmp.first_name} {selectedEmp.last_name} — {selectedEmp.job_title || ''}</span>
                <button onClick={() => setForm({ ...form, employee_id: null })} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={searchEmp}
                  onChange={e => setSearchEmp(e.target.value)}
                  placeholder="Rechercher un employé..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {searchEmp && filteredEmployees.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredEmployees.slice(0, 8).map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => { setForm({ ...form, employee_id: emp.id }); setSearchEmp(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between"
                      >
                        <span className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</span>
                        <span className="text-gray-400 text-xs">{emp.job_title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Readiness */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilité</label>
              <select value={form.readiness} onChange={e => setForm({ ...form, readiness: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="ready">Prêt maintenant</option>
                <option value="1-2 years">Dans 1-2 ans</option>
                <option value="3+ years">Dans 3+ ans</option>
              </select>
            </div>
            {/* Rang */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rang priorité</label>
              <input
                type="number" min={1} max={10}
                value={form.rank_order}
                onChange={e => setForm({ ...form, rank_order: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Score de préparation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Score de préparation : <span className="text-primary-600 font-semibold">{form.preparation_score}%</span>
            </label>
            <input
              type="range" min={0} max={100} step={5}
              value={form.preparation_score}
              onChange={e => setForm({ ...form, preparation_score: parseInt(e.target.value) })}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          {/* Notes de développement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes de développement</label>
            <textarea
              value={form.development_notes}
              onChange={e => setForm({ ...form, development_notes: e.target.value })}
              placeholder="Ce qu'il doit encore acquérir..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !form.employee_id}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
