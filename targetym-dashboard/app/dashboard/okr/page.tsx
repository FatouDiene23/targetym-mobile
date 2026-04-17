'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, ChevronDown, ChevronRight, Trash2, Edit, X,
  Building2, Users, User, Download, Link2, BarChart3, GitBranch, Layers, Loader2
} from 'lucide-react';
import Header from '@/components/Header';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TYPES
// ============================================

interface KeyResult {
  id: number;
  objective_id: number;
  title: string;
  description?: string;
  target: number;
  current: number;
  unit: string;
  weight: number;
  progress: number;
}

interface Initiative {
  id: number;
  objective_id: number;
  title: string;
  description?: string;
  source: string;
  external_id?: string;
  external_url?: string;
  progress: number;
  status: string;
  due_date?: string;
}

interface Objective {
  id: number;
  tenant_id: number;
  title: string;
  description?: string;
  level: 'enterprise' | 'department' | 'individual';
  owner_id?: number;
  owner_name?: string;
  owner_initials?: string;
  department_id?: number;
  department_name?: string;
  parent_id?: number;
  period: string;
  start_date?: string;
  end_date?: string;
  progress: number;
  status: string;
  is_active: boolean;
  key_results: KeyResult[];
  initiatives: Initiative[];
  // UI state
  expanded?: boolean;
}

interface OKRStats {
  total: number;
  by_level: Record<string, number>;
  by_status: Record<string, number>;
  avg_progress: number;
  completed: number;
  in_progress: number;
  not_started: number;
  overdue: number;
  by_department: Record<string, { count: number; avg_progress: number }>;
}

interface Department {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  department_id?: number;
}

// ============================================
// API
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetchObjectives(params?: { level?: string; status?: string; period?: string }): Promise<{ items: Objective[]; total: number }> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('page_size', '100');
    if (params?.level && params.level !== 'all') queryParams.set('level', params.level);
    if (params?.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params?.period && params.period !== 'all') queryParams.set('period', params.period);

    const response = await fetch(`${API_URL}/api/okr/objectives?${queryParams}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Erreur lors du chargement des objectifs');
    return response.json();
  } catch (e) {
    console.error('fetchObjectives error:', e);
    return { items: [], total: 0 };
  }
}

async function fetchOKRStats(): Promise<OKRStats> {
  try {
    const response = await fetch(`${API_URL}/api/okr/stats`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Erreur lors du chargement des stats');
    return response.json();
  } catch (e) {
    console.error('fetchOKRStats error:', e);
    return { total: 0, by_level: {}, by_status: {}, avg_progress: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} };
  }
}

async function fetchDepartments(): Promise<Department[]> {
  try {
    const response = await fetch(`${API_URL}/api/departments/`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : data.items || [];
  } catch (e) {
    console.error('fetchDepartments error:', e);
    return [];
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?page_size=100&status=active`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch (e) {
    console.error('fetchEmployees error:', e);
    return [];
  }
}

async function createObjective(data: Partial<Objective>): Promise<Objective> {
  const response = await fetch(`${API_URL}/api/okr/objectives`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la création');
  }
  return response.json();
}

async function updateObjective(id: number, data: Partial<Objective>): Promise<Objective> {
  const response = await fetch(`${API_URL}/api/okr/objectives/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la modification');
  }
  return response.json();
}

async function deleteObjective(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/okr/objectives/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la suppression');
}

async function createKeyResult(objectiveId: number, data: Partial<KeyResult>): Promise<KeyResult> {
  const response = await fetch(`${API_URL}/api/okr/objectives/${objectiveId}/key-results`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur lors de la création du KR');
  return response.json();
}

async function updateKeyResult(krId: number, data: Partial<KeyResult>): Promise<KeyResult> {
  const response = await fetch(`${API_URL}/api/okr/key-results/${krId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur lors de la modification du KR');
  return response.json();
}

async function deleteKeyResult(krId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/okr/key-results/${krId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la suppression du KR');
}

// ============================================
// HELPERS
// ============================================

const getStatusColor = (s: string) => {
  const m: Record<string, string> = {
    'on_track': 'bg-green-100 text-green-700',
    'at_risk': 'bg-yellow-100 text-yellow-700',
    'behind': 'bg-red-100 text-red-700',
    'exceeded': 'bg-indigo-100 text-indigo-700',
    'completed': 'bg-green-100 text-green-700',
    'draft': 'bg-gray-100 text-gray-700',
    'active': 'bg-blue-100 text-blue-700',
    'cancelled': 'bg-gray-100 text-gray-500',
  };
  return m[s] || 'bg-gray-100 text-gray-700';
};

const getStatusLabel = (s: string, t?: any) => {
  if (t) {
    const m: Record<string, string> = {
      'on_track': t.okr.onTrack,
      'at_risk': t.okr.atRisk,
      'behind': t.okr.behind,
      'exceeded': t.okr.exceeded,
      'completed': t.okr.completed,
      'draft': t.okr.draft,
      'active': t.okr.active,
      'cancelled': t.okr.cancelled,
    };
    return m[s] || s;
  }
  const m: Record<string, string> = {
    'on_track': 'En bonne voie',
    'at_risk': 'À risque',
    'behind': 'En retard',
    'exceeded': 'Dépassé',
    'completed': 'Terminé',
    'draft': 'Brouillon',
    'active': 'Actif',
    'cancelled': 'Annulé',
  };
  return m[s] || s;
};

const getProgressColor = (p: number) => {
  if (p >= 100) return 'bg-indigo-500';
  if (p >= 70) return 'bg-green-500';
  if (p >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getLevelIcon = (l: string) => {
  if (l === 'enterprise') return <Building2 className="w-4 h-4" />;
  if (l === 'department') return <Users className="w-4 h-4" />;
  return <User className="w-4 h-4" />;
};

const getLevelLabel = (l: string, t?: any) => {
  if (t) {
    const m: Record<string, string> = {
      enterprise: t.okr.enterprise,
      department: t.okr.department,
      individual: t.okr.individual,
    };
    return m[l] || l;
  }
  const m: Record<string, string> = {
    enterprise: 'Entreprise',
    department: 'Département',
    individual: 'Individuel',
  };
  return m[l] || l;
};

const getLevelColor = (l: string) => {
  const m: Record<string, string> = {
    enterprise: 'bg-purple-100 text-purple-700',
    department: 'bg-blue-100 text-blue-700',
    individual: 'bg-teal-100 text-teal-700',
  };
  return m[l] || 'bg-gray-100';
};

// Export OKRs to CSV
function exportOKRsToCSV(objectives: Objective[]): void {
  const headers = [
    'Niveau', 'Titre', 'Département', 'Propriétaire', 'Période', 
    'Progression', 'Statut', 'Key Results'
  ];

  const rows = objectives.map(obj => [
    getLevelLabel(obj.level),
    obj.title,
    obj.department_name || '',
    obj.owner_name || '',
    obj.period,
    `${Math.round(obj.progress)}%`,
    getStatusLabel(obj.status),
    obj.key_results.map(kr => `${kr.title}: ${kr.current}/${kr.target} ${kr.unit || ''}`).join(' | ')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `okr_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// COMPONENTS
// ============================================

// Modal pour créer/éditer un objectif
function ObjectiveModal({
  isOpen,
  onClose,
  onSave,
  objective,
  departments,
  employees,
  parentObjectives,
  canCreateEnterprise = true,
  userDepartmentId,
  canSeeAll,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Objective>) => Promise<void>;
  objective?: Objective | null;
  departments: Department[];
  employees: Employee[];
  parentObjectives: Objective[];
  canCreateEnterprise?: boolean;
  userDepartmentId?: number | null;
  canSeeAll?: boolean;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 'individual' as 'enterprise' | 'department' | 'individual',
    owner_id: undefined as number | undefined,
    department_id: undefined as number | undefined,
    parent_id: undefined as number | undefined,
    period: '2026',
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (objective) {
      setFormData({
        title: objective.title,
        description: objective.description || '',
        level: objective.level,
        owner_id: objective.owner_id,
        department_id: objective.department_id,
        parent_id: objective.parent_id,
        period: objective.period,
        status: objective.status,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        level: canCreateEnterprise ? 'individual' : 'department',
        owner_id: undefined,
        department_id: userDepartmentId || undefined,
        parent_id: undefined,
        period: '2026',
        status: 'draft',
      });
    }
  }, [objective, isOpen, canCreateEnterprise, userDepartmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {objective ? t.okr.editObjective : t.okr.newObjective}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.titleLabel} *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.description}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.level} *</label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value as 'enterprise' | 'department' | 'individual' })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {canCreateEnterprise && <option value="enterprise">{t.okr.enterprise}</option>}
                <option value="department">{t.okr.department}</option>
                <option value="individual">{t.okr.individual}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.period} *</label>
              <select
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="2026">2026</option>
                <option value="Q1 2026">Q1 2026</option>
                <option value="Q2 2026">Q2 2026</option>
                <option value="Q3 2026">Q3 2026</option>
                <option value="Q4 2026">Q4 2026</option>
                <option value="2025">2025</option>
                <option value="Q1 2025">Q1 2025</option>
                <option value="Q2 2025">Q2 2025</option>
                <option value="Q3 2025">Q3 2025</option>
                <option value="Q4 2025">Q4 2025</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.departmentLabel}</label>
              <select
                value={formData.department_id || ''}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{t.okr.none}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {!canSeeAll && departments.length === 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t.okr.departmentPreselected}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.owner}</label>
              <select
                value={formData.owner_id || ''}
                onChange={(e) => setFormData({ ...formData, owner_id: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{t.okr.none}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
              {!canSeeAll && employees.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t.okr.directReportsHint}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.parentObjective}</label>
            <select
              value={formData.parent_id || ''}
              onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{t.okr.none}</option>
              {parentObjectives.filter(o => o.id !== objective?.id).map((o) => (
                <option key={o.id} value={o.id}>[{getLevelLabel(o.level, t)}] {o.title}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.statusLabel}</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="draft">{t.okr.draft}</option>
              <option value="active">{t.okr.active}</option>
              <option value="on_track">{t.okr.onTrack}</option>
              <option value="at_risk">{t.okr.atRisk}</option>
              <option value="behind">{t.okr.behind}</option>
              <option value="completed">{t.okr.completed}</option>
              <option value="exceeded">{t.okr.exceeded}</option>
            </select>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              {t.okr.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {objective ? t.okr.edit : t.okr.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const UNIT_OPTIONS = [
  { value: '%',      label: '% — Pourcentage' },
  { value: 'nombre', label: 'Nombre (sans unité)' },
  { value: 'XOF',   label: 'XOF — Franc CFA (UEMOA)' },
  { value: 'k XOF', label: 'k XOF — Milliers CFA' },
  { value: 'M XOF', label: 'M XOF — Millions CFA' },
  { value: 'FCFA',  label: 'FCFA' },
  { value: 'GNF',   label: 'GNF — Franc guinéen' },
  { value: 'GHS',   label: 'GHS — Cedi ghanéen' },
  { value: 'NGN',   label: 'NGN — Naira nigérian' },
  { value: 'USD',   label: 'USD — Dollar américain' },
  { value: 'EUR',   label: 'EUR — Euro' },
  { value: 'clients', label: 'Clients' },
  { value: 'leads',   label: 'Leads' },
  { value: 'points',  label: 'Points' },
  { value: 'heures',  label: 'Heures' },
  { value: 'jours',   label: 'Jours' },
  { value: '__autre__', label: 'Autre…' },
];
const STANDARD_UNIT_VALUES = UNIT_OPTIONS.filter((o) => o.value !== '__autre__').map((o) => o.value);

// Modal pour ajouter un Key Result
function KeyResultModal({
  isOpen,
  onClose,
  onSave,
  objectiveId,
  keyResult,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (objectiveId: number, data: Partial<KeyResult>) => Promise<void>;
  objectiveId: number;
  keyResult?: KeyResult | null;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    title: '',
    target: 100,
    current: 0,
    unit: '',
    weight: 100,
  });
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (keyResult) {
      const unit = keyResult.unit || '';
      const isCustom = unit !== '' && !STANDARD_UNIT_VALUES.includes(unit);
      setIsCustomUnit(isCustom);
      setFormData({
        title: keyResult.title,
        target: keyResult.target,
        current: keyResult.current,
        unit,
        weight: keyResult.weight,
      });
    } else {
      setIsCustomUnit(false);
      setFormData({ title: '', target: 100, current: 0, unit: '', weight: 100 });
    }
  }, [keyResult, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(objectiveId, formData);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {keyResult ? t.okr.editKeyResult : t.okr.newKeyResult}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.titleLabel} *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.target} *</label>
              <input
                type="number"
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.current}</label>
              <input
                type="number"
                value={formData.current}
                onChange={(e) => setFormData({ ...formData, current: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.unit}</label>
              <select
                value={isCustomUnit ? '__autre__' : (formData.unit || '')}
                onChange={(e) => {
                  if (e.target.value === '__autre__') {
                    setIsCustomUnit(true);
                    setFormData({ ...formData, unit: '' });
                  } else {
                    setIsCustomUnit(false);
                    setFormData({ ...formData, unit: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t.okr.chooseUnit}</option>
                {UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {isCustomUnit && (
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder={t.okr.customUnitPlaceholder}
                  autoFocus
                />
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.weightPercent}</label>
            <input
              type="number"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              min="0"
              max="100"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              {t.okr.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {keyResult ? t.okr.edit : t.okr.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

interface UserData {
  employee_id?: number;
  department_id?: number;
  role?: string;
  is_manager?: boolean;
}

function normalizeRole(role: string | undefined): UserRole {
  if (!role) return 'employee';
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'dg' || r === 'director') return 'dg';
  if (r === 'rh' || r === 'hr') return 'rh';
  if (r === 'manager') return 'manager';
  return 'employee';
}

export default function OKRPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [stats, setStats] = useState<OKRStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // User context for role-based filtering
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [userDepartmentId, setUserDepartmentId] = useState<number | null>(null);
  const [userEmployeeId, setUserEmployeeId] = useState<number | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'list' | 'cascade' | 'dashboard'>('list');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  
  // Section collapse state (pour replier par niveau)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    enterprise: false,
    department: false,
    individual: false,
  });
  
  // Modals
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [showKRModal, setShowKRModal] = useState(false);
  const [krObjectiveId, setKrObjectiveId] = useState<number>(0);
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // Écouter le bouton "+ Ajouter" du Header
  useEffect(() => {
    const handleHeaderAdd = () => { setEditingObjective(null); setShowObjectiveModal(true); };
    window.addEventListener('okr-add', handleHeaderAdd);
    return () => window.removeEventListener('okr-add', handleHeaderAdd);
  }, []);

  // Toggle section collapse
  const toggleSection = (level: string) => {
    setCollapsedSections(prev => ({ ...prev, [level]: !prev[level] }));
  };

  // Employees for assignment (filtered based on role)
  const [assignableEmployees, setAssignableEmployees] = useState<Employee[]>([]);
  // All higher-level objectives for parent alignment dropdown
  const [parentCandidates, setParentCandidates] = useState<Objective[]>([]);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData: UserData = JSON.parse(userStr);
          console.log('User data from localStorage:', userData);
          const role = normalizeRole(userData.role);
          setUserRole(role);
          setUserEmployeeId(userData.employee_id || null);
          setIsManager(userData.is_manager || userData.role?.toLowerCase() === 'manager');
          
          // Pour RH/Admin/DG, pas besoin de department_id
          if (['rh', 'admin', 'dg'].includes(role)) {
            setUserLoaded(true);
            return;
          }
          
          // Si department_id est disponible directement
          if (userData.department_id) {
            setUserDepartmentId(userData.department_id);
            setUserLoaded(true);
          } 
          // Sinon, récupérer depuis l'API employee
          else if (userData.employee_id) {
            try {
              const response = await fetch(`${API_URL}/api/employees/${userData.employee_id}`, {
                headers: getAuthHeaders(),
              });
              if (response.ok) {
                const empData = await response.json();
                console.log('Employee data from API:', empData);
                setUserDepartmentId(empData.department_id || null);
              }
            } catch (e) {
              console.error('Error fetching employee:', e);
            }
            setUserLoaded(true);
          } else {
            setUserLoaded(true);
          }
        } catch (e) {
          console.error('Error parsing user:', e);
          setUserLoaded(true);
        }
      } else {
        setUserLoaded(true);
      }
    };
    
    loadUserData();
  }, []);

  // Check if user can see all OKRs (RH, Admin, DG)
  const canSeeAll = ['rh', 'admin', 'dg'].includes(userRole);
  
  // Check if user can create/edit OKRs (general permission)
  const canEdit = ['manager', 'rh', 'admin', 'dg'].includes(userRole) || isManager;
  
  // Check if user can edit a specific OKR
  const canEditObjective = (obj: Objective): boolean => {
    // RH, Admin, DG can edit everything
    if (['rh', 'admin', 'dg'].includes(userRole)) return true;
    
    // Managers cannot edit Enterprise-level OKRs
    if (obj.level === 'enterprise') return false;
    
    // Managers can edit Department OKRs of their department
    if (obj.level === 'department') {
      return userDepartmentId !== null && obj.department_id === userDepartmentId;
    }
    
    // Managers can edit Individual OKRs of their department or their own
    if (obj.level === 'individual') {
      if (userDepartmentId !== null && obj.department_id === userDepartmentId) return true;
      if (userEmployeeId !== null && obj.owner_id === userEmployeeId) return true;
    }
    
    return false;
  };

  const loadData = useCallback(async () => {
    // Attendre que les données utilisateur soient chargées
    if (!userLoaded) {
      return;
    }
    
    setLoading(true);
    try {
      const [objData, statsData, deptData, empData] = await Promise.all([
        fetchObjectives({ level: filterLevel !== 'all' ? filterLevel : undefined, period: filterPeriod !== 'all' ? filterPeriod : undefined }),
        fetchOKRStats(),
        fetchDepartments(),
        fetchEmployees(),
      ]);
      
      // Filter objectives based on role
      let filteredObjectives = objData.items;
      
      console.log('Filtering OKRs - canSeeAll:', canSeeAll, 'userDepartmentId:', userDepartmentId, 'userEmployeeId:', userEmployeeId);
      
      if (!canSeeAll) {
        // Manager: sees enterprise OKRs + their department OKRs + their individual OKRs
        filteredObjectives = objData.items.filter(obj => {
          // Always show enterprise-level OKRs (for context)
          if (obj.level === 'enterprise') return true;
          
          // Show department OKRs for user's department only
          if (obj.level === 'department') {
            if (userDepartmentId && obj.department_id === userDepartmentId) return true;
            return false;
          }
          
          // Show individual OKRs for user's department or owned by user
          if (obj.level === 'individual') {
            if (userDepartmentId && obj.department_id === userDepartmentId) return true;
            if (userEmployeeId && obj.owner_id === userEmployeeId) return true;
            return false;
          }
          
          return false;
        });
        
        console.log('Filtered from', objData.items.length, 'to', filteredObjectives.length, 'OKRs');
      }
      
      setObjectives(filteredObjectives.map(o => ({ ...o, expanded: false })));
      setStats(statsData);
      setDepartments(deptData);

      // Stocker tous les objectifs enterprise/department comme candidats parent (pour le dropdown alignement)
      setParentCandidates(objData.items.filter(o => o.level === 'enterprise' || o.level === 'department'));

      // Charger les employés assignables selon le rôle
      if (canSeeAll) {
        // RH/Admin/DG voient tous les employés
        setAssignableEmployees(empData);
      } else if (userEmployeeId) {
        // Manager: charger lui-même + ses direct-reports
        try {
          // Trouver le manager dans empData, sinon le fetch directement
          let currentEmployee = empData.find((e: Employee) => e.id === userEmployeeId);
          if (!currentEmployee) {
            try {
              const meRes = await fetch(`${API_URL}/api/employees/${userEmployeeId}`, { headers: getAuthHeaders() });
              if (meRes.ok) {
                const meData = await meRes.json();
                currentEmployee = { id: meData.id, first_name: meData.first_name, last_name: meData.last_name, department_id: meData.department_id };
              }
            } catch { /* ignore */ }
          }

          const allAssignable: Employee[] = [];
          if (currentEmployee) {
            allAssignable.push(currentEmployee);
          }

          // Charger les direct-reports
          const directReportsRes = await fetch(`${API_URL}/api/employees/${userEmployeeId}/direct-reports`, {
            headers: getAuthHeaders(),
          });
          if (directReportsRes.ok) {
            const directReports = await directReportsRes.json();
            const drArray = Array.isArray(directReports) ? directReports : [];
            for (const dr of drArray) {
              allAssignable.push({
                id: dr.id,
                first_name: dr.first_name,
                last_name: dr.last_name,
                department_id: dr.department_id,
              });
            }
            console.log('Direct reports loaded:', drArray.length);
          }

          setAssignableEmployees(allAssignable);
        } catch (e) {
          console.error('Error fetching assignable employees:', e);
        }
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }, [filterLevel, filterPeriod, canSeeAll, userDepartmentId, userEmployeeId, userLoaded]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: number) => {
    setObjectives(objectives.map(obj => obj.id === id ? { ...obj, expanded: !obj.expanded } : obj));
  };

  const handleSaveObjective = async (data: Partial<Objective>) => {
    if (editingObjective) {
      await updateObjective(editingObjective.id, data);
    } else {
      await createObjective(data);
    }
    await loadData();
  };

  const handleDeleteObjective = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t.okr.deleteObjectiveTitle,
      message: t.okr.deleteObjectiveMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteObjective(id);
        await loadData();
      },
    });
  };

  const handleSaveKR = async (objectiveId: number, data: Partial<KeyResult>) => {
    if (editingKR) {
      await updateKeyResult(editingKR.id, data);
    } else {
      await createKeyResult(objectiveId, data);
    }
    await loadData();
  };

  const handleDeleteKR = async (krId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t.okr.deleteKrTitle,
      message: t.okr.deleteKrMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteKeyResult(krId);
        await loadData();
      },
    });
  };

  const enterpriseOKRs = objectives.filter(o => o.level === 'enterprise');
  const departmentOKRs = objectives.filter(o => o.level === 'department');
  const individualOKRs = objectives.filter(o => o.level === 'individual');

  // Stats pour le dashboard
  const statusDistribution = stats ? [
    { name: t.okr.onTrack, value: stats.by_status['on_track'] || 0, color: '#10B981' },
    { name: t.okr.atRisk, value: stats.by_status['at_risk'] || 0, color: '#F59E0B' },
    { name: t.okr.behind, value: stats.by_status['behind'] || 0, color: '#EF4444' },
    { name: t.okr.exceeded, value: stats.by_status['exceeded'] || 0, color: '#6366F1' },
  ].filter(d => d.value > 0) : [];

  const departmentProgress = stats ? Object.entries(stats.by_department).map(([name, data]) => ({
    name: name.length > 10 ? name.substring(0, 10) + '...' : name,
    progress: data.avg_progress,
  })) : [];

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('okr');

  if (loading) {
    return (
      <>
        <Header title={t.okr.title} subtitle={t.okr.loading} />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-gray-500">{t.okr.loadingOkrs}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips
          pageId="okr"
          onDismiss={dismissTips}
          pageTitle={t.okr.title}
        />
      )}
      <Header
        title={t.okr.title}
        subtitle={canSeeAll
          ? t.okr.subtitle
          : t.okr.subtitleRestricted
        }
      />

      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{t.okr.totalOkrs}</p>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
          </div>
          <div data-tour="okr-progress" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{t.okr.avgProgress}</p>
            <p className="text-2xl font-bold">{stats?.avg_progress || 0}%</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{t.okr.onTrack}</p>
            <p className="text-2xl font-bold text-green-600">{stats?.by_status['on_track'] || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{t.okr.atRisk}</p>
            <p className="text-2xl font-bold text-yellow-600">{stats?.by_status['at_risk'] || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{t.okr.behind}</p>
            <p className="text-2xl font-bold text-red-600">{stats?.by_status['behind'] || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{t.okr.exceededPlural}</p>
            <p className="text-2xl font-bold text-indigo-600">{stats?.by_status['exceeded'] || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div data-tour="okr-tabs" className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('list')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'list' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Layers className="w-4 h-4 inline mr-2" />{t.okr.listTab}
            </button>
            <button onClick={() => setActiveTab('cascade')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'cascade' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <GitBranch className="w-4 h-4 inline mr-2" />{t.okr.cascadeTab}
            </button>
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'dashboard' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <BarChart3 className="w-4 h-4 inline mr-2" />{t.okr.dashboardTab}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <div className="flex gap-3">
            <CustomSelect value={filterPeriod} onChange={setFilterPeriod} options={[
              { value: 'all', label: t.okr.allPeriods },
              { value: '2026', label: '2026' },
              { value: 'Q1 2026', label: 'Q1 2026' },
              { value: 'Q2 2026', label: 'Q2 2026' },
              { value: 'Q3 2026', label: 'Q3 2026' },
              { value: 'Q4 2026', label: 'Q4 2026' },
              { value: '2025', label: '2025' },
              { value: 'Q1 2025', label: 'Q1 2025' },
              { value: 'Q2 2025', label: 'Q2 2025' },
              { value: 'Q3 2025', label: 'Q3 2025' },
              { value: 'Q4 2025', label: 'Q4 2025' },
            ]} className="min-w-[130px]" />
            <CustomSelect value={filterLevel} onChange={setFilterLevel} options={[
              { value: 'all', label: t.okr.allLevels },
              { value: 'enterprise', label: t.okr.enterprise },
              { value: 'department', label: t.okr.department },
              { value: 'individual', label: t.okr.individual },
            ]} className="min-w-[130px]" />
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => exportOKRsToCSV(objectives)}
              className="flex items-center px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />{t.okr.export}
            </button>
            {canEdit && (
              <button 
                data-tour="create-okr"
                onClick={() => { setEditingObjective(null); setShowObjectiveModal(true); }}
                className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
              >
                <Plus className="w-4 h-4 mr-2" />{t.okr.newOkr}
              </button>
            )}
          </div>
        </div>

        {/* Tab Content: List */}
        {activeTab === 'list' && (
          <div className="space-y-6">
            {[
              { level: 'enterprise', title: t.okr.enterpriseOkrs, data: enterpriseOKRs, icon: Building2, color: 'purple', bgColor: 'bg-purple-600', bgLight: 'bg-purple-100', textColor: 'text-purple-700' },
              { level: 'department', title: t.okr.departmentOkrs, data: departmentOKRs, icon: Users, color: 'primary', bgColor: 'bg-primary-600', bgLight: 'bg-primary-100', textColor: 'text-primary-700' },
              { level: 'individual', title: t.okr.individualOkrs, data: individualOKRs, icon: User, color: 'teal', bgColor: 'bg-teal-600', bgLight: 'bg-teal-100', textColor: 'text-teal-700' },
            ].map(section => section.data.length > 0 && (
              <div key={section.title}>
                {/* Section Header avec flèche de repli */}
                <button 
                  onClick={() => toggleSection(section.level)}
                  className="w-full flex items-center gap-3 mb-4 group"
                >
                  <div className={`w-8 h-8 ${section.bgColor} rounded-lg flex items-center justify-center transition-transform ${collapsedSections[section.level] ? '' : ''}`}>
                    {collapsedSections[section.level] 
                      ? <ChevronRight className="w-5 h-5 text-white" />
                      : <ChevronDown className="w-5 h-5 text-white" />
                    }
                  </div>
                  <section.icon className={`w-5 h-5 ${section.textColor}`} />
                  <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  <span className={`px-2.5 py-1 ${section.bgLight} ${section.textColor} text-xs font-medium rounded-full`}>
                    {section.data.length}
                  </span>
                  <span className="text-xs text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {collapsedSections[section.level] ? t.okr.clickToExpand : t.okr.clickToCollapse}
                  </span>
                </button>
                
                {/* Section Content */}
                {!collapsedSections[section.level] && (
                  <div className="space-y-3">
                    {section.data.map((obj) => (
                      <div key={obj.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(obj.id)}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start flex-1">
                              {/* Flèche de repli OKR individuel - PLUS VISIBLE */}
                              <button className={`mt-0.5 mr-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${obj.expanded ? `${section.bgLight} ${section.textColor}` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                {obj.expanded 
                                  ? <ChevronDown className="w-5 h-5" /> 
                                  : <ChevronRight className="w-5 h-5" />
                                }
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(obj.level)}`}>
                                    {getLevelIcon(obj.level)}{getLevelLabel(obj.level, t)}
                                  </span>
                                  {obj.department_name && <span className="text-xs text-gray-500">• {obj.department_name}</span>}
                                </div>
                                <h3 className="text-base font-semibold text-gray-900">{obj.title}</h3>
                                <div className="flex items-center gap-3 mt-2">
                                  {obj.owner_name && (
                                    <div className="flex items-center">
                                      <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs font-medium text-primary-700">
                                        {obj.owner_initials}
                                      </div>
                                      <span className="ml-2 text-sm text-gray-600">{obj.owner_name}</span>
                                    </div>
                                  )}
                                  <span className="text-sm text-gray-500">{obj.period}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(obj.status)}`}>
                                    {getStatusLabel(obj.status, t)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="text-2xl font-bold text-gray-900">{Math.round(obj.progress)}%</span>
                                <div className="w-28 h-2 bg-gray-200 rounded-full mt-1">
                                  <div className={`h-full rounded-full ${getProgressColor(obj.progress)}`} style={{ width: `${Math.min(obj.progress, 100)}%` }} />
                                </div>
                              </div>
                              {canEditObjective(obj) && (
                                <div className="relative">
                                  <button 
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingObjective(obj);
                                      setShowObjectiveModal(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button 
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteObjective(obj.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {obj.expanded && (
                          <div className="border-t border-gray-100 bg-gray-50 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-700">{t.okr.keyResultsCount} ({obj.key_results.length})</h4>
                              {canEditObjective(obj) && (
                                <button 
                                  onClick={() => { setKrObjectiveId(obj.id); setEditingKR(null); setShowKRModal(true); }}
                                  className="flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                                >
                                  <Plus className="w-4 h-4 mr-1" />{t.okr.addKr}
                                </button>
                              )}
                            </div>
                            
                            {obj.key_results.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">{t.okr.noKeyResult}</p>
                            ) : (
                              <div className="space-y-3">
                                {obj.key_results.map((kr) => (
                                  <div key={kr.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-900">{kr.title}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">{t.okr.weight}: {kr.weight}%</span>
                                        <span className="text-sm font-medium text-gray-700">{kr.current} / {kr.target} {kr.unit}</span>
                                        {canEditObjective(obj) && (
                                          <>
                                            <button 
                                              onClick={() => { setKrObjectiveId(obj.id); setEditingKR(kr); setShowKRModal(true); }}
                                              className="p-1 text-gray-400 hover:text-gray-600"
                                            >
                                              <Edit className="w-3 h-3" />
                                            </button>
                                            <button 
                                              onClick={() => handleDeleteKR(kr.id)}
                                              className="p-1 text-gray-400 hover:text-red-600"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full">
                                      <div className={`h-full rounded-full ${getProgressColor(kr.progress)}`} style={{ width: `${Math.min(kr.progress, 100)}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {obj.initiatives && obj.initiatives.length > 0 && (
                              <>
                                <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-3">{t.okr.initiativesTitle}</h4>
                                <div className="space-y-2">
                                  {obj.initiatives.map((init) => (
                                    <div key={init.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                      <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center">
                                        <Link2 className="w-4 h-4 text-indigo-600" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{init.title}</p>
                                        <p className="text-xs text-gray-500">{init.source} • {init.due_date}</p>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(init.status)}`}>
                                        {init.progress}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {objectives.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t.okr.noObjectiveFound}</p>
                <button 
                  onClick={() => { setEditingObjective(null); setShowObjectiveModal(true); }}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  {t.okr.createObjective}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Cascade */}
        {activeTab === 'cascade' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">{t.okr.cascadeView}</h2>
            
            {enterpriseOKRs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t.okr.noEnterpriseOkr}</p>
            ) : (
              <div className="space-y-8">
                {enterpriseOKRs.map((entOKR) => (
                  <div key={entOKR.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-purple-50 p-4 border-b border-purple-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-purple-600 uppercase">{t.okr.enterprise}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(entOKR.status)}`}>
                              {getStatusLabel(entOKR.status, t)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{entOKR.title}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-purple-600">{Math.round(entOKR.progress)}%</span>
                          <div className="w-32 h-2 bg-purple-200 rounded-full mt-1">
                            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${Math.min(entOKR.progress, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4">
                      <div className="pl-8 border-l-2 border-purple-300 ml-4 space-y-4">
                        {departmentOKRs.filter(d => d.parent_id === entOKR.id).map((deptOKR) => (
                          <div key={deptOKR.id}>
                            <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                  <Users className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-primary-600">{deptOKR.department_name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deptOKR.status)}`}>
                                      {getStatusLabel(deptOKR.status, t)}
                                    </span>
                                  </div>
                                  <h4 className="font-medium text-gray-900 text-sm">{deptOKR.title}</h4>
                                  {deptOKR.owner_name && <p className="text-xs text-gray-500 mt-1">{t.okr.responsible}: {deptOKR.owner_name}</p>}
                                </div>
                                <div className="text-right">
                                  <span className="text-xl font-bold text-primary-600">{Math.round(deptOKR.progress)}%</span>
                                  <div className="w-24 h-1.5 bg-primary-200 rounded-full mt-1">
                                    <div className="h-full bg-primary-600 rounded-full" style={{ width: `${Math.min(deptOKR.progress, 100)}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="pl-8 border-l-2 border-primary-300 ml-4 mt-3 space-y-2">
                              {individualOKRs.filter(i => i.parent_id === deptOKR.id).map((indOKR) => (
                                <div key={indOKR.id} className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-teal-600 rounded flex items-center justify-center text-xs font-medium text-white">
                                      {indOKR.owner_initials || '?'}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">{indOKR.title}</p>
                                      <p className="text-xs text-gray-500">{indOKR.owner_name}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(indOKR.status)}`}>
                                      {Math.round(indOKR.progress)}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        
                        {departmentOKRs.filter(d => d.parent_id === entOKR.id).length === 0 && (
                          <p className="text-sm text-gray-500 italic">{t.okr.noDepartmentOkrLinked}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.statusDistribution}</h3>
              {statusDistribution.length > 0 ? (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {statusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-600">{item.name} ({item.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.progressByDepartment}</h3>
              {departmentProgress.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentProgress} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="progress" fill="#6366F1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.criticalOkrs}</h3>
              {objectives.filter(o => o.status === 'at_risk' || o.status === 'behind').length > 0 ? (
                <div className="space-y-3">
                  {objectives.filter(o => o.status === 'at_risk' || o.status === 'behind').slice(0, 5).map((okr) => (
                    <div key={okr.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${okr.status === 'behind' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{okr.title}</p>
                        <p className="text-xs text-gray-500">{okr.owner_name || t.okr.notAssigned} • {okr.department_name || t.okr.enterprise}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(okr.status)}`}>
                        {Math.round(okr.progress)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">{t.okr.noCriticalOkr}</p>
              )}
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.summaryByLevel}</h3>
              <div className="space-y-4">
                {[
                  { level: 'enterprise', label: t.okr.enterprise, icon: Building2, color: 'purple' },
                  { level: 'department', label: t.okr.department, icon: Users, color: 'blue' },
                  { level: 'individual', label: t.okr.individual, icon: User, color: 'teal' },
                ].map(({ level, label, icon: Icon, color }) => {
                  const count = stats?.by_level[level] || 0;
                  const levelObjs = objectives.filter(o => o.level === level);
                  const avgProg = levelObjs.length > 0 ? Math.round(levelObjs.reduce((sum, o) => sum + o.progress, 0) / levelObjs.length) : 0;
                  return (
                    <div key={level} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-10 h-10 bg-${color}-100 rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 text-${color}-600`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{count} {t.okr.objectiveCount}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900">{avgProg}%</span>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                          <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${avgProg}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ObjectiveModal
        isOpen={showObjectiveModal}
        onClose={() => { setShowObjectiveModal(false); setEditingObjective(null); }}
        onSave={handleSaveObjective}
        objective={editingObjective}
        departments={canSeeAll ? departments : departments.filter(d => d.id === userDepartmentId)}
        employees={assignableEmployees}
        parentObjectives={parentCandidates}
        canCreateEnterprise={canSeeAll}
        userDepartmentId={userDepartmentId}
        canSeeAll={canSeeAll}
      />
      
      <KeyResultModal
        isOpen={showKRModal}
        onClose={() => { setShowKRModal(false); setEditingKR(null); }}
        onSave={handleSaveKR}
        objectiveId={krObjectiveId}
        keyResult={editingKR}
      />
      
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
    </>
  );
}
