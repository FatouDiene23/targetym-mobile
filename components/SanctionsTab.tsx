'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Search, Plus, Loader2, X, Trash2, Calendar,
  User, Filter, ChevronDown
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import toast from 'react-hot-toast';

// ============================================
// CONFIG
// ============================================
const API_URL = 'https://api.targetym.ai';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}
function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return { Authorization: token ? `Bearer ${token}` : '' };
}
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ============================================
// TYPES
// ============================================
interface SanctionItem {
  id: number;
  employee_id: number;
  employee_name: string | null;
  type: string;
  date: string;
  reason: string;
  notes: string | null;
  status: string;
  issued_by: string | null;
  issued_by_id: number | null;
  created_at: string | null;
}

interface SimpleEmployee {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
}

// ============================================
// CONSTANTS
// ============================================
const SANCTION_TYPES: Record<string, { icon: string; color: string }> = {
  'Avertissement':    { icon: '\u26a0\ufe0f', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'Bl\u00e2me':              { icon: '\ud83d\udccb', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'Mise \u00e0 pied':       { icon: '\ud83d\udeab', color: 'bg-red-100 text-red-800 border-red-200' },
  'R\u00e9trogradation':    { icon: '\u2b07\ufe0f', color: 'bg-red-100 text-red-800 border-red-200' },
  'Licenciement':     { icon: '\u274c', color: 'bg-red-200 text-red-900 border-red-300' },
  'Rappel \u00e0 l\'ordre': { icon: '\ud83d\udcdd', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Autre':            { icon: '\ud83d\udcc4', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const SANCTION_TYPE_OPTIONS = Object.keys(SANCTION_TYPES);

// ============================================
// MAIN COMPONENT
// ============================================
export default function SanctionsTab() {
  // Data
  const [sanctions, setSanctions] = useState<SanctionItem[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEmployee, setFilterEmployee] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSanction, setNewSanction] = useState({
    employee_id: 0,
    type: 'Avertissement',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    notes: '',
  });

  // Delete confirm
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // ---- Data Loading ----
  const loadSanctions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEmployee) params.append('employee_id', String(filterEmployee));
      if (filterType) params.append('type', filterType);
      if (search) params.append('search', search);
      params.append('limit', '200');

      const data = await apiFetch(`/api/sanctions?${params.toString()}`);
      setSanctions(data.items || []);
    } catch {
      setSanctions([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterEmployee, filterType, search]);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await apiFetch('/api/employees?page_size=500');
      console.log('[SanctionsTab] employees response:', data);
      const list = Array.isArray(data) ? data : data.items || [];
      console.log('[SanctionsTab] employees list length:', list.length);
      setEmployees(list.map((e: Record<string, unknown>) => ({
        id: e.id as number,
        first_name: (e.first_name as string) || '',
        last_name: (e.last_name as string) || '',
        job_title: (e.job_title as string) || undefined,
        department_name: (e.department_name as string) || undefined,
      })));
    } catch (err) {
      console.error('[SanctionsTab] loadEmployees error:', err);
      setEmployees([]);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { loadSanctions(); }, [loadSanctions]);

  // ---- Handlers ----
  const handleAdd = async () => {
    if (!newSanction.employee_id || !newSanction.reason.trim()) {
      toast.error('Veuillez sélectionner un employé et saisir un motif');
      return;
    }
    setIsSaving(true);
    try {
      const data = await apiFetch('/api/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSanction),
      });
      setSanctions(prev => [data, ...prev]);
      setNewSanction({ employee_id: 0, type: 'Avertissement', date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
      setShowAddForm(false);
      toast.success('Sanction enregistrée');
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer la sanction',
      message: 'Cette action est irréversible. Voulez-vous vraiment supprimer cette sanction ?',
      danger: true,
      onConfirm: async () => {
        try {
          await apiFetch(`/api/sanctions/${id}`, { method: 'DELETE' });
          setSanctions(prev => prev.filter(s => s.id !== id));
          toast.success('Sanction supprimée');
        } catch {
          toast.error('Erreur lors de la suppression');
        }
        setConfirmDialog(null);
      },
    });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterEmployee(null);
  };

  const hasFilters = search || filterType || filterEmployee;

  // Stats
  const stats = {
    total: sanctions.length,
    avertissements: sanctions.filter(s => s.type === 'Avertissement').length,
    graves: sanctions.filter(s => ['Mise à pied', 'Rétrogradation', 'Licenciement'].includes(s.type)).length,
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total sanctions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <span className="text-lg">{'\u26a0\ufe0f'}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.avertissements}</p>
              <p className="text-xs text-gray-500">Avertissements</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <span className="text-lg">{'\ud83d\udeab'}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.graves}</p>
              <p className="text-xs text-gray-500">Sanctions graves</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par motif..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${showFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter className="w-4 h-4" />
              Filtres
              {hasFilters && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
            </button>
          </div>
          {/* Add button */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle sanction
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 items-center">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Tous les types</option>
              {SANCTION_TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={filterEmployee || ''}
              onChange={(e) => setFilterEmployee(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none min-w-[200px]"
            >
              <option value="">Tous les employés</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Nouvelle sanction disciplinaire
            </h3>
            <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employé */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
              <select
                value={newSanction.employee_id || ''}
                onChange={(e) => setNewSanction(prev => ({ ...prev, employee_id: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Sélectionner un employé</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.first_name} {e.last_name}{e.department_name ? ` - ${e.department_name}` : ''}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de sanction *</label>
              <select
                value={newSanction.type}
                onChange={(e) => setNewSanction(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {SANCTION_TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{SANCTION_TYPES[t].icon} {t}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={newSanction.date}
                onChange={(e) => setNewSanction(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            {/* Motif */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif *</label>
              <textarea
                value={newSanction.reason}
                onChange={(e) => setNewSanction(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
                placeholder="Décrivez le motif de la sanction..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes internes (optionnel)</label>
              <textarea
                value={newSanction.notes}
                onChange={(e) => setNewSanction(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Notes confidentielles RH..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Info box */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Important :</strong> Une sanction ne peut pas être modifiée après création (valeur juridique). Vérifiez les informations avant de valider.
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={isSaving || !newSanction.employee_id || !newSanction.reason.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer la sanction
            </button>
          </div>
        </div>
      )}

      {/* Sanctions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : sanctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <AlertTriangle className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">Aucune sanction enregistrée</p>
            <p className="text-sm text-gray-400 mt-1">
              {hasFilters ? 'Essayez de modifier vos filtres' : 'Les sanctions disciplinaires apparaîtront ici'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employé</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Motif</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Par</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sanctions.map((s) => {
                  const typeInfo = SANCTION_TYPES[s.type] || SANCTION_TYPES['Autre'];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{s.employee_name || `Employé #${s.employee_id}`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${typeInfo.color}`}>
                          <span>{typeInfo.icon}</span>
                          {s.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(s.date).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700 max-w-xs truncate" title={s.reason}>{s.reason}</p>
                        {s.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs" title={s.notes}>{s.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{s.issued_by || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </div>
  );
}
