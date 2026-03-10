'use client';

import { useState, useEffect } from 'react';
import {
  Building2, Plus, Edit2, Trash2, ChevronRight, ChevronDown,
  Users, Loader2, X, Save, ArrowUpRight, Search, Network,
  Download
} from 'lucide-react';
import {
  getDepartments, updateDepartment, deleteDepartment,
  getEmployees,
  type Department, type DepartmentCreate, type Employee
} from '@/lib/api';
import AddOrganizationalUnitModal from './AddOrganizationalUnitModal';
import ConfirmDialog from './ConfirmDialog';

// ============================================
// TYPES
// ============================================
interface DeptTreeNode extends Department {
  children: DeptTreeNode[];
  depth: number;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function DepartmentManagementTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Department | null>(null);

  // Expanded nodes in tree
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [depts, empResponse] = await Promise.all([
        getDepartments(),
        getEmployees({ page_size: 500, status: 'active' })
      ]);
      setDepartments(depts || []);
      setEmployees(empResponse.items || []);
      // Expand all by default
      const allIds = new Set((depts || []).map(d => d.id));
      setExpandedNodes(allIds);
    } catch (err) {
      setError('Erreur lors du chargement');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ============================================
  // BUILD TREE
  // ============================================
  function buildTree(depts: Department[]): DeptTreeNode[] {
    const map = new Map<number, DeptTreeNode>();
    const roots: DeptTreeNode[] = [];

    depts.forEach(d => map.set(d.id, { ...d, children: [], depth: 0 }));

    map.forEach(node => {
      if (node.parent_id && map.has(node.parent_id)) {
        const parent = map.get(node.parent_id)!;
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // ============================================
  // ACTIONS
  // ============================================
  function handleAdd() {
    setShowAddModal(true);
  }

  function handleEdit(dept: Department) {
    setEditingDept(dept);
    setShowEditModal(true);
  }

  async function handleDelete(dept: Department) {
    try {
      await deleteDepartment(dept.id);
      setShowDeleteConfirm(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  }

  async function handleSaveEdit(data: DepartmentCreate) {
    if (!editingDept) return;
    try {
      await updateDepartment(editingDept.id, data);
      setShowEditModal(false);
      setEditingDept(null);
      loadData();
    } catch (err) {
      throw err;
    }
  }

  function toggleExpand(id: number) {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getEmployeeCount(deptId: number): number {
    return employees.filter(e => e.department_id === deptId).length;
  }

  function getHeadName(deptId: number): string | null {
    const dept = departments.find(d => d.id === deptId);
    if (!dept?.head_id) return null;
    const head = employees.find(e => e.id === dept.head_id);
    return head ? `${head.first_name} ${head.last_name}` : null;
  }

  function getParentName(parentId?: number): string {
    if (!parentId) return '— Aucun (racine)';
    const parent = departments.find(d => d.id === parentId);
    return parent ? parent.name : '—';
  }

  const filteredDepts = searchTerm
    ? departments.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || (d.code || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : departments;

  const tree = buildTree(filteredDepts);

  // Sélection multiple — helpers
  const allSelected = filteredDepts.length > 0 && filteredDepts.every(d => selectedIds.has(d.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDepts.map(d => d.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!someSelected) return;
    const count = selectedIds.size;
    const hasEmployees = Array.from(selectedIds).some(id => getEmployeeCount(id) > 0);
    const warning = hasEmployees ? '\n\nAttention : certaines unités contiennent des employés !' : '';
    setConfirmDialog({
      isOpen: true,
      title: 'Suppression en masse',
      message: `Supprimer ${count} unité(s) ?${warning}`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setBulkLoading(true);
        try {
          for (const id of Array.from(selectedIds)) {
            await deleteDepartment(id);
          }
          setSelectedIds(new Set());
          loadData();
        } catch {}
        finally { setBulkLoading(false); }
      },
    });
  };

  const handleBulkExport = () => {
    const selected = departments.filter(d => selectedIds.has(d.id));
    const headers = ['Nom', 'Code', 'Niveau', 'Rattachement', 'Responsable', 'Effectif'];
    const rows = selected.map(d => [
      d.name, d.code || '', d.level || '', getParentName(d.parent_id),
      getHeadName(d.id) || '', String(getEmployeeCount(d.id))
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `unites_selection_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ============================================
  // LEVEL BADGE
  // ============================================
  function LevelBadge({ level }: { level?: string }) {
    if (!level) return null;
    const config: Record<string, { bg: string; text: string; label: string }> = {
      president: { bg: 'bg-slate-200', text: 'text-slate-800', label: 'Présidence' },
      vice_president: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Vice-Présidence' },
      dg: { bg: 'bg-red-100', text: 'text-red-700', label: 'DG' },
      dga: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'DGA' },
      direction_centrale: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Dir. Centrale' },
      direction: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Direction' },
      departement: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Département' },
      service: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Service' },
    };
    const c = config[level] || config.service;
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.bg} ${c.text}`}>{c.label}</span>;
  }

  // ============================================
  // TREE NODE RENDER
  // ============================================
  function TreeNode({ node }: { node: DeptTreeNode }) {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const empCount = getEmployeeCount(node.id);
    const headName = getHeadName(node.id);

    return (
      <div>
        <div
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 group transition-colors ${node.depth === 0 ? 'bg-gray-50/50' : ''}`}
          style={{ paddingLeft: `${12 + node.depth * 28}px` }}
        >
          {/* Expand toggle */}
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={`w-5 h-5 flex items-center justify-center rounded ${hasChildren ? 'text-gray-500 hover:bg-gray-200 cursor-pointer' : 'text-transparent cursor-default'}`}
          >
            {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
          </button>

          {/* Color dot */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: node.color || '#6366f1' }}
          />

          {/* Name & info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-sm truncate">{node.name}</span>
              {node.code && <span className="text-xs text-gray-400">{node.code}</span>}
              <LevelBadge level={node.level} />
            </div>
            {headName && (
              <p className="text-xs text-gray-500 mt-0.5">Responsable : {headName}</p>
            )}
          </div>

          {/* Employee count */}
          <div className="flex items-center gap-1 text-xs text-gray-500 mr-2">
            <Users className="w-3.5 h-3.5" />
            <span>{empCount}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleEdit(node)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
              title="Modifier"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(node)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // LIST VIEW ROW
  // ============================================
  function ListRow({ dept }: { dept: Department }) {
    const empCount = getEmployeeCount(dept.id);
    const headName = getHeadName(dept.id);

    return (
      <tr className={`hover:bg-gray-50 group ${selectedIds.has(dept.id) ? 'bg-primary-50/50' : ''}`}>
        <td className="w-10 px-3 py-3">
          <input type="checkbox" checked={selectedIds.has(dept.id)} onChange={() => toggleSelect(dept.id)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color || '#6366f1' }} />
            <div>
              <p className="font-medium text-gray-900 text-sm">{dept.name}</p>
              {dept.code && <p className="text-xs text-gray-400">{dept.code}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3"><LevelBadge level={dept.level} /></td>
        <td className="px-4 py-3 text-sm text-gray-600">{getParentName(dept.parent_id)}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{headName || '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Users className="w-3.5 h-3.5" />
            <span>{empCount}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleEdit(dept)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowDeleteConfirm(dept)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </td>
      </tr>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une unité..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Liste
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'tree' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Network className="w-3.5 h-3.5 inline mr-1" />Arbre
            </button>
          </div>
        </div>

        <button
          onClick={() => handleAdd()}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouvelle unité
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total unités</p>
          <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Niveaux racine</p>
          <p className="text-2xl font-bold text-purple-600">{departments.filter(d => !d.parent_id).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Employés affectés</p>
          <p className="text-2xl font-bold text-blue-600">{employees.filter(e => e.department_id).length}/{employees.length}</p>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'tree' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Network className="w-4 h-4 text-gray-500" />
              Hiérarchie organisationnelle
            </p>
          </div>
          <div className="py-2">
            {tree.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Aucune unité trouvée</p>
              </div>
            ) : (
              tree.map(node => <TreeNode key={node.id} node={node} />)
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Barre d'actions groupées */}
          {someSelected && (
            <div className="mb-3 flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-primary-700">{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
              <div className="h-5 w-px bg-primary-200" />
              <button onClick={handleBulkExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-3.5 h-3.5" />Exporter
              </button>
              <button onClick={handleBulkDelete} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Supprimer
              </button>
              <div className="flex-1" />
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
              {bulkLoading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unité</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Niveau</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rattachement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Responsable</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Effectif</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDepts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500 text-sm">Aucune unité trouvée</td></tr>
                ) : (
                  filteredDepts.map(dept => <ListRow key={dept.id} dept={dept} />)
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* DELETE CONFIRM */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Supprimer l&apos;unité</h3>
            <p className="text-sm text-gray-600 mb-1">
              Voulez-vous supprimer <strong>{showDeleteConfirm.name}</strong> ?
            </p>
            {getEmployeeCount(showDeleteConfirm.id) > 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg mb-3">
                ⚠️ Cette unité contient {getEmployeeCount(showDeleteConfirm.id)} employé(s). Ils seront détachés.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MODAL - Unified AddOrganizationalUnitModal */}
      {showAddModal && (
        <AddOrganizationalUnitModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => loadData()}
        />
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingDept && (
        <EditDepartmentModal
          department={editingDept}
          departments={departments}
          employees={employees}
          onClose={() => { setShowEditModal(false); setEditingDept(null); }}
          onSave={handleSaveEdit}
        />
      )}

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

// ============================================
// EDIT FORM MODAL
// ============================================
function EditDepartmentModal({
  department,
  departments,
  employees,
  onClose,
  onSave,
}: {
  department: Department;
  departments: Department[];
  employees: Employee[];
  onClose: () => void;
  onSave: (data: DepartmentCreate) => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const LEVEL_OPTIONS = [
    { value: 'president', label: 'Présidence' },
    { value: 'vice_president', label: 'Vice-Présidence' },
    { value: 'dg', label: 'Direction Générale' },
    { value: 'dga', label: 'Direction Générale Adjointe' },
    { value: 'direction_centrale', label: 'Direction Centrale' },
    { value: 'direction', label: 'Direction' },
    { value: 'departement', label: 'Département' },
    { value: 'service', label: 'Service' },
  ];

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b'];

  const [form, setForm] = useState({
    name: department.name || '',
    code: department.code || '',
    description: department.description || '',
    color: department.color || '#6366f1',
    level: department.level || '',
    parent_id: department.parent_id?.toString() || '',
    head_id: department.head_id?.toString() || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await onSave({
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        color: form.color,
        level: (form.level || undefined) as any,
        parent_id: form.parent_id ? parseInt(form.parent_id) : undefined,
        head_id: form.head_id ? parseInt(form.head_id) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  const availableParents = departments.filter(d => d.id !== department.id);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900">Modifier l&apos;unité</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Direction des Ressources Humaines"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="DRH"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Niveau */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niveau hiérarchique</label>
              <select
                value={form.level}
                onChange={(e) => setForm(f => ({ ...f, level: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Non défini</option>
                {LEVEL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rattachement (parent) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ArrowUpRight className="w-4 h-4 inline mr-1" />
              Rattaché à
            </label>
            <select
              value={form.parent_id}
              onChange={(e) => setForm(f => ({ ...f, parent_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">Aucun (niveau racine)</option>
              {availableParents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.level ? `[${d.level.toUpperCase()}] ` : ''}{d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Responsable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
            <select
              value={form.head_id}
              onChange={(e) => setForm(f => ({ ...f, head_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">Non assigné</option>
              {employees.map(m => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} {m.job_title ? `— ${m.job_title}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description de l'unité..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>

    </>
  );
}
