'use client';

import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import {
  X, Download, FileSpreadsheet, FileText, File,
  ChevronRight, ChevronLeft, Check, Loader2,
  Users, Palmtree, Building2, ClipboardList,
  Filter, Columns, CheckSquare, Square, Search
} from 'lucide-react';
import {
  getEmployees, getLeaveRequests, getDepartments, getTeamTasks,
  type Employee, type LeaveRequest, type Department, type Task
} from '@/lib/api';

// ============================================
// TYPES
// ============================================
type DataType = 'employees' | 'leaves' | 'departments' | 'tasks';
type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface ColumnDef {
  key: string;
  label: string;
  checked: boolean;
  getValue: (item: any) => string;
}

interface ExportFilters {
  department_id?: number;
  status?: string;
  contract_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// ============================================
// COLUMN DEFINITIONS PER DATA TYPE
// ============================================
const EMPLOYEE_COLUMNS: ColumnDef[] = [
  { key: 'employee_id', label: 'Matricule', checked: true, getValue: (e: Employee) => e.employee_id || '' },
  { key: 'last_name', label: 'Nom', checked: true, getValue: (e: Employee) => e.last_name },
  { key: 'first_name', label: 'Prénom', checked: true, getValue: (e: Employee) => e.first_name },
  { key: 'email', label: 'Email', checked: true, getValue: (e: Employee) => e.email },
  { key: 'phone', label: 'Téléphone', checked: false, getValue: (e: Employee) => e.phone || '' },
  { key: 'gender', label: 'Genre', checked: false, getValue: (e: Employee) => {
    const g = e.gender?.toLowerCase();
    return g === 'male' ? 'Homme' : g === 'female' ? 'Femme' : g || '';
  }},
  { key: 'date_of_birth', label: 'Date de naissance', checked: false, getValue: (e: Employee) => fmtDate(e.date_of_birth) },
  { key: 'nationality', label: 'Nationalité', checked: false, getValue: (e: Employee) => e.nationality || '' },
  { key: 'address', label: 'Adresse', checked: false, getValue: (e: Employee) => e.address || '' },
  { key: 'job_title', label: 'Poste', checked: true, getValue: (e: Employee) => e.job_title || e.position || '' },
  { key: 'department_name', label: 'Département', checked: true, getValue: (e: Employee) => e.department_name || '' },
  { key: 'site', label: 'Site / Localisation', checked: true, getValue: (e: Employee) => e.site || e.location || '' },
  { key: 'manager_name', label: 'Manager', checked: false, getValue: (e: Employee) => e.manager_name || '' },
  { key: 'role', label: 'Rôle système', checked: false, getValue: (e: Employee) => {
    const roles: Record<string, string> = { employee: 'Employé', manager: 'Manager', rh: 'RH', admin: 'Admin', dg: 'DG' };
    return roles[e.role || ''] || e.role || '';
  }},
  { key: 'is_manager', label: 'Est manager', checked: false, getValue: (e: Employee) => e.is_manager ? 'Oui' : 'Non' },
  { key: 'hire_date', label: "Date d'embauche", checked: true, getValue: (e: Employee) => fmtDate(e.hire_date) },
  { key: 'status', label: 'Statut', checked: true, getValue: (e: Employee) => {
    const s: Record<string, string> = { active: 'Actif', inactive: 'Inactif', on_leave: 'En congés', terminated: 'Terminé', probation: "Période d'essai", suspended: 'Suspendu' };
    return s[e.status?.toLowerCase() || ''] || e.status || '';
  }},
  { key: 'contract_type', label: 'Type de contrat', checked: true, getValue: (e: Employee) => (e.contract_type || '').toUpperCase() },
  { key: 'classification', label: 'Classification', checked: false, getValue: (e: Employee) => e.classification || '' },
  { key: 'coefficient', label: 'Coefficient', checked: false, getValue: (e: Employee) => e.coefficient || '' },
  { key: 'salary', label: 'Salaire', checked: false, getValue: (e: Employee) => e.salary ? `${Number(e.salary).toLocaleString('fr-FR')} ${e.currency || 'XOF'}` : '' },
  { key: 'probation_end_date', label: "Fin période d'essai", checked: false, getValue: (e: Employee) => fmtDate(e.probation_end_date) },
  { key: 'contract_end_date', label: 'Fin de contrat', checked: false, getValue: (e: Employee) => fmtDate(e.contract_end_date) },
];

const LEAVE_COLUMNS: ColumnDef[] = [
  { key: 'employee_name', label: 'Employé', checked: true, getValue: (l: LeaveRequest) => l.employee_name || '' },
  { key: 'leave_type_name', label: 'Type de congé', checked: true, getValue: (l: LeaveRequest) => l.leave_type_name || '' },
  { key: 'start_date', label: 'Date début', checked: true, getValue: (l: LeaveRequest) => fmtDate(l.start_date) },
  { key: 'end_date', label: 'Date fin', checked: true, getValue: (l: LeaveRequest) => fmtDate(l.end_date) },
  { key: 'days_requested', label: 'Jours demandés', checked: true, getValue: (l: LeaveRequest) => l.days_requested?.toString() || '' },
  { key: 'status', label: 'Statut', checked: true, getValue: (l: LeaveRequest) => {
    const s: Record<string, string> = { pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé', cancelled: 'Annulé', draft: 'Brouillon' };
    return s[l.status] || l.status;
  }},
  { key: 'reason', label: 'Motif', checked: false, getValue: (l: LeaveRequest) => l.reason || '' },
  { key: 'department', label: 'Département', checked: true, getValue: (l: LeaveRequest) => l.department || '' },
  { key: 'approved_by_name', label: 'Approuvé par', checked: false, getValue: (l: LeaveRequest) => l.approved_by_name || '' },
  { key: 'approved_at', label: 'Date approbation', checked: false, getValue: (l: LeaveRequest) => fmtDate(l.approved_at) },
  { key: 'rejection_reason', label: 'Motif refus', checked: false, getValue: (l: LeaveRequest) => l.rejection_reason || '' },
  { key: 'created_at', label: 'Date demande', checked: true, getValue: (l: LeaveRequest) => fmtDate(l.created_at) },
];

const DEPARTMENT_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Nom', checked: true, getValue: (d: Department) => d.name },
  { key: 'code', label: 'Code', checked: true, getValue: (d: Department) => d.code || '' },
  { key: 'level', label: 'Niveau', checked: true, getValue: (d: Department) => {
    const levels: Record<string, string> = { president: 'Présidence', vice_president: 'Vice-Présidence', dg: 'DG', dga: 'DGA', direction_centrale: 'Dir. Centrale', direction: 'Direction', departement: 'Département', service: 'Service' };
    return levels[d.level || ''] || d.level || '';
  }},
  { key: 'employee_count', label: 'Effectif', checked: true, getValue: (d: Department) => d.employee_count?.toString() || '0' },
  { key: 'is_active', label: 'Actif', checked: false, getValue: (d: Department) => d.is_active !== false ? 'Oui' : 'Non' },
  { key: 'description', label: 'Description', checked: false, getValue: (d: Department) => d.description || '' },
];

const TASK_COLUMNS: ColumnDef[] = [
  { key: 'title', label: 'Titre', checked: true, getValue: (t: Task) => t.title },
  { key: 'assigned_to_name', label: 'Assigné à', checked: true, getValue: (t: Task) => t.assigned_to_name || '' },
  { key: 'due_date', label: 'Échéance', checked: true, getValue: (t: Task) => fmtDate(t.due_date) },
  { key: 'status', label: 'Statut', checked: true, getValue: (t: Task) => {
    const s: Record<string, string> = { pending: 'En attente', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };
    return s[t.status] || t.status;
  }},
  { key: 'priority', label: 'Priorité', checked: true, getValue: (t: Task) => {
    const p: Record<string, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' };
    return p[t.priority] || t.priority;
  }},
  { key: 'description', label: 'Description', checked: false, getValue: (t: Task) => t.description || '' },
  { key: 'created_by_name', label: 'Créé par', checked: false, getValue: (t: Task) => t.created_by_name || '' },
  { key: 'completed_at', label: 'Date achèvement', checked: false, getValue: (t: Task) => fmtDate(t.completed_at) },
  { key: 'is_overdue', label: 'En retard', checked: false, getValue: (t: Task) => t.is_overdue ? 'Oui' : 'Non' },
  { key: 'objective_title', label: 'Objectif lié', checked: false, getValue: (t: Task) => t.objective_title || '' },
  { key: 'created_at', label: 'Date création', checked: true, getValue: (t: Task) => fmtDate(t.created_at) },
];

function fmtDate(ds?: string): string {
  if (!ds) return '';
  try { return new Date(ds).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return ds; }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================
// DATA TYPE / FORMAT CONFIG
// ============================================
const DATA_TYPES = [
  { key: 'employees' as DataType, label: 'Employés', sublabel: 'Annuaire complet', icon: Users, color: 'bg-blue-500' },
  { key: 'leaves' as DataType, label: 'Congés', sublabel: 'Demandes & absences', icon: Palmtree, color: 'bg-green-500' },
  { key: 'departments' as DataType, label: 'Organisation', sublabel: 'Départements & unités', icon: Building2, color: 'bg-purple-500' },
  { key: 'tasks' as DataType, label: 'Tâches', sublabel: 'Suivi des activités', icon: ClipboardList, color: 'bg-amber-500' },
];

const FORMAT_OPTIONS = [
  { key: 'csv' as ExportFormat, label: 'CSV', sublabel: 'Tableur simple', icon: FileText, ext: '.csv' },
  { key: 'xlsx' as ExportFormat, label: 'Excel', sublabel: 'Microsoft Excel', icon: FileSpreadsheet, ext: '.xlsx' },
  { key: 'pdf' as ExportFormat, label: 'PDF', sublabel: 'Document PDF', icon: File, ext: '.pdf' },
];

// ============================================
// MAIN COMPONENT
// ============================================
interface ExportDataModalProps {
  onClose: () => void;
  initialDataType?: DataType;
  departments?: Department[];
}

export default function ExportDataModal({ onClose, initialDataType, departments: propDepartments }: ExportDataModalProps) {
  const [step, setStep] = useState(initialDataType ? 2 : 1);
  const [dataType, setDataType] = useState<DataType>(initialDataType || 'employees');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [filters, setFilters] = useState<ExportFilters>({});
  const [departments, setDepartments] = useState<Department[]>(propDepartments || []);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataCount, setDataCount] = useState<number | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');

  useEffect(() => {
    if (!propDepartments || propDepartments.length === 0) {
      getDepartments().then(d => setDepartments(d || [])).catch(() => {});
    }
  }, [propDepartments]);

  useEffect(() => {
    const colMap: Record<DataType, ColumnDef[]> = {
      employees: EMPLOYEE_COLUMNS,
      leaves: LEAVE_COLUMNS,
      departments: DEPARTMENT_COLUMNS,
      tasks: TASK_COLUMNS,
    };
    setColumns(colMap[dataType].map(c => ({ ...c })));
    setFilters({});
    setDataCount(null);
  }, [dataType]);

  useEffect(() => {
    if (step < 2) return;
    const timer = setTimeout(() => fetchDataCount(), 500);
    return () => clearTimeout(timer);
  }, [filters, dataType, step]);

  async function fetchDataCount() {
    setIsLoadingData(true);
    try {
      switch (dataType) {
        case 'employees': {
          const res = await getEmployees({ page: 1, page_size: 1, department_id: filters.department_id, status: filters.status, search: filters.search });
          setDataCount(res.total);
          break;
        }
        case 'leaves': {
          const res = await getLeaveRequests({ page: 1, page_size: 1, status: filters.status, department_id: filters.department_id, start_date: filters.date_from, end_date: filters.date_to });
          setDataCount(res.total);
          break;
        }
        case 'departments': {
          const depts = await getDepartments();
          setDataCount(depts.length);
          break;
        }
        case 'tasks': {
          const res = await getTeamTasks({ page: 1, page_size: 1, status: filters.status as any });
          setDataCount(res.total);
          break;
        }
      }
    } catch { setDataCount(null); }
    finally { setIsLoadingData(false); }
  }

  function toggleColumn(key: string) {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, checked: !c.checked } : c));
  }

  function selectAllColumns() { setColumns(prev => prev.map(c => ({ ...c, checked: true }))); }
  function deselectAllColumns() { setColumns(prev => prev.map(c => ({ ...c, checked: false }))); }

  const checkedColumns = columns.filter(c => c.checked);
  const filteredColumns = columnSearch
    ? columns.filter(c => c.label.toLowerCase().includes(columnSearch.toLowerCase()))
    : columns;

  // ============================================
  // FETCH ALL DATA
  // ============================================
  async function fetchAllData(): Promise<any[]> {
    switch (dataType) {
      case 'employees': {
        const res = await getEmployees({ page: 1, page_size: 1000, department_id: filters.department_id, status: filters.status, search: filters.search });
        return res.items || [];
      }
      case 'leaves': {
        const res = await getLeaveRequests({ page: 1, page_size: 1000, status: filters.status, department_id: filters.department_id, start_date: filters.date_from, end_date: filters.date_to });
        return res.items || [];
      }
      case 'departments': {
        return await getDepartments();
      }
      case 'tasks': {
        const res = await getTeamTasks({ page: 1, page_size: 1000, status: filters.status as any });
        return res.items || [];
      }
    }
  }

  // ============================================
  // EXPORT FUNCTIONS (zero dependencies)
  // ============================================
  async function handleExport() {
    if (checkedColumns.length === 0) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const data = await fetchAllData();
      const headers = checkedColumns.map(c => c.label);
      const rows = data.map(item => checkedColumns.map(c => c.getValue(item)));
      const typeLabels: Record<DataType, string> = { employees: 'employes', leaves: 'conges', departments: 'organisation', tasks: 'taches' };
      const filename = `${typeLabels[dataType]}_${new Date().toISOString().split('T')[0]}`;

      switch (format) {
        case 'csv': exportCSV(headers, rows, filename); break;
        case 'xlsx': exportXLSX(headers, rows, filename); break;
        case 'pdf': exportPDF(headers, rows, filename); break;
      }

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Export error:', err);
      toast.error("Erreur lors de l'export.");
    } finally {
      setIsExporting(false);
    }
  }

  // --- CSV ---
  function exportCSV(headers: string[], rows: string[][], filename: string) {
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    downloadBlob(new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
  }

  // --- XLSX (via HTML table that Excel opens natively) ---
  function exportXLSX(headers: string[], rows: string[][], filename: string) {
    const typeLabels: Record<DataType, string> = { employees: 'Employés', leaves: 'Congés', departments: 'Organisation', tasks: 'Tâches' };
    const title = `Export ${typeLabels[dataType]}`;

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${title}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  td, th { padding: 4px 8px; border: 1px solid #ccc; font-family: Calibri, sans-serif; font-size: 11pt; }
  th { background: #066C6C; color: white; font-weight: bold; }
  tr:nth-child(even) { background: #F5F7FA; }
</style>
</head><body>
<table>
<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>
${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></body></html>`;

    downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${filename}.xls`);
  }

  // --- PDF (via print window) ---
  function exportPDF(headers: string[], rows: string[][], filename: string) {
    const typeLabels: Record<DataType, string> = { employees: 'Employés', leaves: 'Congés', departments: 'Organisation', tasks: 'Tâches' };
    const title = `Export ${typeLabels[dataType]}`;
    const dateStr = new Date().toLocaleDateString('fr-FR');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Veuillez autoriser les popups pour exporter en PDF.');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head>
<title>${filename}</title>
<style>
  @page { size: ${headers.length > 6 ? 'landscape' : 'portrait'}; margin: 15mm; }
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 20px; }
  h1 { font-size: 18px; color: #1e3a5f; margin: 0 0 4px 0; }
  .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #066C6C; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f8f9fb; }
  tr:hover { background: #eef2ff; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">Généré le ${dateStr} — ${rows.length} enregistrement${rows.length > 1 ? 's' : ''}</p>
<table>
<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>
${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('\n')}
</tbody></table>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    printWindow.document.close();
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ============================================
  // RENDER - STEP 1
  // ============================================
  function renderStep1() {
    return (
      <div className="p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Quel type de données exporter ?</h3>
        <div className="grid grid-cols-2 gap-3">
          {DATA_TYPES.map(dt => {
            const Icon = dt.icon;
            const isSelected = dataType === dt.key;
            return (
              <button
                key={dt.key}
                onClick={() => setDataType(dt.key)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 ${dt.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>{dt.label}</p>
                  <p className="text-xs text-gray-500">{dt.sublabel}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - STEP 2
  // ============================================
  function renderStep2() {
    return (
      <div className="p-6 space-y-5">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtres
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(dataType === 'employees' || dataType === 'leaves') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Département</label>
                <select
                  value={filters.department_id || ''}
                  onChange={(e) => setFilters(f => ({ ...f, department_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">Tous les départements</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {dataType === 'employees' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">Tous les statuts</option>
                  <option value="active">Actif</option>
                  <option value="probation">Période d&apos;essai</option>
                  <option value="on_leave">En congés</option>
                  <option value="suspended">Suspendu</option>
                  <option value="terminated">Terminé</option>
                </select>
              </div>
            )}

            {dataType === 'leaves' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="">Tous</option>
                    <option value="pending">En attente</option>
                    <option value="approved">Approuvé</option>
                    <option value="rejected">Refusé</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
                  <input type="date" value={filters.date_from || ''} onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value || undefined }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
                  <input type="date" value={filters.date_to || ''} onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value || undefined }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
              </>
            )}

            {dataType === 'tasks' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">Tous</option>
                  <option value="pending">En attente</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminée</option>
                </select>
              </div>
            )}

            {dataType === 'employees' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Recherche</label>
                <input type="text" placeholder="Nom, email, poste..." value={filters.search || ''}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {isLoadingData ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <div className="w-2 h-2 bg-green-500 rounded-full" />}
            <span className="text-xs text-gray-500">
              {dataCount !== null ? `${dataCount} enregistrement${dataCount > 1 ? 's' : ''} trouvé${dataCount > 1 ? 's' : ''}` : 'Chargement...'}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Columns className="w-4 h-4" /> Colonnes ({checkedColumns.length}/{columns.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={selectAllColumns} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Tout cocher</button>
              <span className="text-gray-300">|</span>
              <button onClick={deselectAllColumns} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Tout décocher</button>
            </div>
          </div>

          {columns.length > 8 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Filtrer les colonnes..." value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-2">
            {filteredColumns.map(col => (
              <button
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors text-left ${
                  col.checked ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {col.checked
                  ? <CheckSquare className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                  : <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                <span className="truncate">{col.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - STEP 3
  // ============================================
  function renderStep3() {
    return (
      <div className="p-6 space-y-5">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Format d&apos;export</h3>
          <div className="grid grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map(f => {
              const Icon = f.icon;
              const isSelected = format === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-8 h-8 ${isSelected ? 'text-primary-500' : 'text-gray-400'}`} />
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>{f.label}</p>
                    <p className="text-[10px] text-gray-500">{f.sublabel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Résumé de l&apos;export</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Données</span>
            <span className="font-medium text-gray-900">{DATA_TYPES.find(d => d.key === dataType)?.label}</span>
            <span className="text-gray-500">Colonnes</span>
            <span className="font-medium text-gray-900">{checkedColumns.length} sélectionnée{checkedColumns.length > 1 ? 's' : ''}</span>
            <span className="text-gray-500">Enregistrements</span>
            <span className="font-medium text-gray-900">{dataCount ?? '...'}</span>
            <span className="text-gray-500">Format</span>
            <span className="font-medium text-gray-900">{FORMAT_OPTIONS.find(f => f.key === format)?.label} ({FORMAT_OPTIONS.find(f => f.key === format)?.ext})</span>
          </div>
        </div>

        {exportSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <Check className="w-4 h-4" />
            Export réussi ! Le fichier a été téléchargé.
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  const canGoNext = step === 1 || (step === 2 && checkedColumns.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-primary-500" />
              Exporter des données
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    s < step ? 'bg-primary-500 text-white' :
                    s === step ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  <span className={`text-xs ${s === step ? 'text-primary-700 font-medium' : 'text-gray-400'}`}>
                    {s === 1 ? 'Données' : s === 2 ? 'Colonnes' : 'Export'}
                  </span>
                  {s < 3 && <ChevronRight className="w-3 h-3 text-gray-300 mx-1" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
            {step > 1 ? 'Retour' : 'Annuler'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext}
              className="flex items-center gap-1 px-5 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={isExporting || checkedColumns.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Export en cours...' : 'Exporter'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
