'use client';

// ============================================
// LEARNING MODULE — Référentiel Compétences
// File: app/dashboard/learning/referentiel/page.tsx
// ============================================

import { useState, useCallback, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';
import { useLearning } from '../LearningContext';
import { hasPermission } from '../shared';
import type { Skill } from '../shared';
import type { LucideIcon } from 'lucide-react';
import {
  Plus, Pencil, Trash2, Search, Globe, Building2, ChevronDown, ChevronUp,
  Brain, Code2, Users, RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function useReferentielConfig() {
  const { t } = useI18n();
  const rp = t.training.referentielPage;

  const HIERARCHY_LEVELS = [
    { value: '', label: rp.allLevels },
    { value: 'stagiaire', label: rp.stagiaire },
    { value: 'assistant', label: rp.assistant },
    { value: 'manager', label: rp.manager },
    { value: 'senior_manager', label: rp.seniorManager },
    { value: 'executive', label: rp.executive },
    { value: 'top_executive', label: rp.topExecutive },
  ];

  const DEPARTMENTS = [
    { value: '', label: rp.allDepartments },
    { value: 'all', label: rp.transversal },
    { value: 'operations', label: rp.operations },
    { value: 'finance', label: rp.finance },
    { value: 'rh', label: rp.rh },
    { value: 'admin', label: rp.admin },
    { value: 'it', label: rp.it },
    { value: 'commercial', label: rp.commercial },
    { value: 'direction', label: rp.direction },
  ];

  const SKILL_TYPES: { value: string; label: string; icon?: LucideIcon; color?: string }[] = [
    { value: '', label: rp.allTypes },
    { value: 'soft_skill', label: rp.softSkill, icon: Brain, color: 'bg-purple-100 text-purple-700' },
    { value: 'technical', label: rp.technical, icon: Code2, color: 'bg-blue-100 text-blue-700' },
    { value: 'management', label: rp.management, icon: Users, color: 'bg-green-100 text-green-700' },
  ];

  const SKILL_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    soft_skill:  { label: rp.softSkill,  icon: Brain,  color: 'bg-purple-100 text-purple-700' },
    technical:   { label: rp.technical,   icon: Code2,  color: 'bg-blue-100 text-blue-700' },
    management:  { label: rp.management,  icon: Users,  color: 'bg-green-100 text-green-700' },
  };

  return { HIERARCHY_LEVELS, DEPARTMENTS, SKILL_TYPES, SKILL_TYPE_CONFIG, t };
}

interface SkillForm {
  name: string;
  category: string;
  description: string;
  skill_type: string;
  hierarchy_level: string;
  department: string;
  is_global: boolean;
}

const EMPTY_FORM: SkillForm = {
  name: '', category: 'Technique', description: '',
  skill_type: 'soft_skill', hierarchy_level: '', department: 'all', is_global: false,
};

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const raw = document.cookie.split('; ').find(r => r.startsWith('auth_token='));
  const token = raw
    ? raw.split('=')[1]
    : (localStorage.getItem('access_token') ?? localStorage.getItem('auth_token') ?? '');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function ReferentielPage() {
  const { HIERARCHY_LEVELS, DEPARTMENTS, SKILL_TYPES, SKILL_TYPE_CONFIG, t } = useReferentielConfig();
  const rp = t.training.referentielPage;
  const { userRole, skills, fetchSkillsPublic } = useLearning() as any;

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [allSkills, setAllSkills] = useState<Skill[]>(skills ?? []);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [grouped, setGrouped] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState<SkillForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchSkills = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('skill_type', filterType);
      if (filterLevel) params.set('hierarchy_level', filterLevel);
      if (filterDept) params.set('department', filterDept);
      const res = await fetch(`${API_URL}/api/learning/skills/?${params}`, { headers: getAuthHeaders() });
      if (res.ok) setAllSkills(await res.json());
    } catch { /* silent */ }
  }, [filterType, filterLevel, filterDept]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const openCreate = () => {
    setEditSkill(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: Skill) => {
    setEditSkill(s);
    setForm({
      name: s.name, category: s.category, description: s.description ?? '',
      skill_type: s.skill_type ?? 'soft_skill',
      hierarchy_level: s.hierarchy_level ?? '',
      department: s.department ?? 'all',
      is_global: s.is_global ?? false,
    });
    setError('');
    setShowModal(true);
  };

  const saveSkill = async () => {
    if (!form.name.trim()) { setError(rp.nameRequired); return; }
    setSaving(true); setError('');
    try {
      const url = editSkill
        ? `${API_URL}/api/learning/skills/${editSkill.id}`
        : `${API_URL}/api/learning/skills/`;
      const method = editSkill ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...form,
          hierarchy_level: form.hierarchy_level || null,
          department: form.department || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail ?? rp.errorLabel); return; }
      setShowModal(false);
      fetchSkills();
    } catch { setError(rp.networkError); }
    finally { setSaving(false); }
  };

  const deleteSkill = (id: number) => {
    setConfirmDialog({
      open: true,
      title: rp.deleteSkillTitle,
      message: rp.deleteSkillConfirm,
      danger: true,
      onConfirm: async () => {
        await fetch(`${API_URL}/api/learning/skills/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchSkills();
      },
    });
  };

  const filtered = allSkills.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by hierarchy_level
  const groups: Record<string, Skill[]> = {};
  if (grouped) {
    filtered.forEach(s => {
      const key = s.hierarchy_level ?? 'global';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
  }

  const canEdit = hasPermission(userRole, 'create_skill');

  const levelLabel = (lv: string) =>
    HIERARCHY_LEVELS.find(h => h.value === lv)?.label ?? lv;

  const deptLabel = (d: string | null | undefined) =>
    DEPARTMENTS.find(x => x.value === (d ?? ''))?.label ?? d ?? '—';

  return (
    <div>
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={rp.searchSkill}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <CustomSelect
          value={filterType}
          onChange={(v) => setFilterType(v)}
          options={SKILL_TYPES.map(t => ({ value: t.value, label: t.label }))}
          className="min-w-[140px]"
        />

        <CustomSelect
          value={filterLevel}
          onChange={(v) => setFilterLevel(v)}
          options={HIERARCHY_LEVELS.map(h => ({ value: h.value, label: h.label }))}
          className="min-w-[140px]"
        />

        <CustomSelect
          value={filterDept}
          onChange={(v) => setFilterDept(v)}
          options={DEPARTMENTS.map(d => ({ value: d.value, label: d.label }))}
          className="min-w-[140px]"
        />

        <button onClick={() => setGrouped(g => !g)}
          className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          {grouped ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {grouped ? rp.listView : rp.groupLabel}
        </button>

        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> {rp.newSkill}
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {SKILL_TYPES.filter(t => t.value && t.icon).map(t => {
          const count = allSkills.filter(s => s.skill_type === t.value).length;
          const Ic = t.icon as LucideIcon;
          return (
            <div key={t.value} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3">
              <Ic className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-xl font-bold text-gray-800">{count}</p>
                <p className="text-xs text-gray-500">{t.label}</p>
              </div>
            </div>
          );
        })}
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3">
          <Globe className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-xl font-bold text-gray-800">{allSkills.filter(s => s.is_global).length}</p>
            <p className="text-xs text-gray-500">{rp.crossFunctional}</p>
          </div>
        </div>
      </div>

      {/* Skills list/groups */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 border border-gray-100">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{rp.noSkillFound}</p>
        </div>
      ) : grouped ? (
        Object.entries(groups).map(([lvKey, lvSkills]) => (
          <div key={lvKey} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {lvKey === 'global' ? rp.globalUnclassified : levelLabel(lvKey)}
              <span className="ml-2 text-gray-400 font-normal normal-case">({lvSkills.length})</span>
            </h3>
            <SkillTable skills={lvSkills} canEdit={canEdit} deptLabel={deptLabel} onEdit={openEdit} onDelete={deleteSkill} />
          </div>
        ))
      ) : (
        <SkillTable skills={filtered} canEdit={canEdit} deptLabel={deptLabel} onEdit={openEdit} onDelete={deleteSkill} />
      )}

      {/* Modal create/edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {editSkill ? rp.editSkillTitle : rp.newSkillTitle}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{rp.nameLabel} *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ex: Communication interpersonnelle" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{rp.typeLabel}</label>
                  <CustomSelect
                    value={form.skill_type}
                    onChange={(v) => setForm(f => ({ ...f, skill_type: v }))}
                    options={[
                      { value: 'soft_skill', label: rp.softSkill },
                      { value: 'technical', label: rp.technical },
                      { value: 'management', label: rp.management },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{rp.categoryLabel}</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ex: Leadership" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{rp.hierarchyLevel}</label>
                  <CustomSelect
                    value={form.hierarchy_level}
                    onChange={(v) => setForm(f => ({ ...f, hierarchy_level: v }))}
                    placeholder={rp.allLevels}
                    options={[
                      { value: '', label: rp.allLevels },
                      ...HIERARCHY_LEVELS.filter(h => h.value).map(h => ({ value: h.value, label: h.label })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{rp.departmentLabel}</label>
                  <CustomSelect
                    value={form.department}
                    onChange={(v) => setForm(f => ({ ...f, department: v }))}
                    options={DEPARTMENTS.filter(d => d.value).map(d => ({ value: d.value, label: d.label }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{rp.descriptionLabel}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_global} onChange={e => setForm(f => ({ ...f, is_global: e.target.checked }))}
                  className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">{rp.crossFunctionalCheckbox}</span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                {rp.cancelLabel}
              </button>
              <button onClick={saveSkill} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? rp.saving : editSkill ? rp.update : rp.createBtnLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
}

function SkillTable({
  skills, canEdit, deptLabel, onEdit, onDelete,
}: {
  skills: Skill[];
  canEdit: boolean;
  deptLabel: (d: string | null | undefined) => string;
  onEdit: (s: Skill) => void;
  onDelete: (id: number) => void;
}) {
  const { SKILL_TYPE_CONFIG, t } = useReferentielConfig();
  const rp = t.training.referentielPage;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-3 font-medium text-gray-600">{rp.skill}</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">{rp.typeCol}</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">{rp.categoryCol}</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">{rp.departmentCol}</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">{rp.scope}</th>
            {canEdit && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {skills.map((s, i) => {
            const tc = SKILL_TYPE_CONFIG[s.skill_type ?? 'soft_skill'] ?? SKILL_TYPE_CONFIG['soft_skill'];
            const Ic = tc.icon;
            return (
              <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{s.name}</p>
                  {s.description && <p className="text-xs text-gray-400 truncate max-w-xs">{s.description}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>
                    <Ic className="w-3 h-3" />{tc.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.category}</td>
                <td className="px-4 py-3 text-gray-600">{deptLabel(s.department)}</td>
                <td className="px-4 py-3">
                  {s.is_global ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Globe className="w-3 h-3" />{rp.transversal}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      <Building2 className="w-3 h-3" />{rp.specific}
                    </span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => onEdit(s)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
