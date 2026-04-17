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
import { useI18n } from '@/lib/i18n/I18nContext';
import type { Translations } from '@/lib/i18n';

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
function getEmployeeColumns(x: Translations['components']['exportModal'], common: Translations['common']): ColumnDef[] {
  return [
    { key: 'employee_id', label: x.colEmployeeId, checked: true, getValue: (e: Employee) => e.employee_id || '' },
    { key: 'last_name', label: x.colLastName, checked: true, getValue: (e: Employee) => e.last_name },
    { key: 'first_name', label: x.colFirstName, checked: true, getValue: (e: Employee) => e.first_name },
    { key: 'email', label: x.colEmail, checked: true, getValue: (e: Employee) => e.email },
    { key: 'phone', label: x.colPhone, checked: false, getValue: (e: Employee) => e.phone || '' },
    { key: 'gender', label: x.colGender, checked: false, getValue: (e: Employee) => {
      const g = e.gender?.toLowerCase();
      return g === 'male' ? x.colMale : g === 'female' ? x.colFemale : g || '';
    }},
    { key: 'date_of_birth', label: x.colBirthDate, checked: false, getValue: (e: Employee) => fmtDate(e.date_of_birth) },
    { key: 'nationality', label: x.colNationality, checked: false, getValue: (e: Employee) => e.nationality || '' },
    { key: 'address', label: x.colAddress, checked: false, getValue: (e: Employee) => e.address || '' },
    { key: 'job_title', label: x.colJobTitle, checked: true, getValue: (e: Employee) => e.job_title || e.position || '' },
    { key: 'department_name', label: x.colDepartment, checked: true, getValue: (e: Employee) => e.department_name || '' },
    { key: 'site', label: x.colSite, checked: true, getValue: (e: Employee) => e.site || e.location || '' },
    { key: 'manager_name', label: x.colManager, checked: false, getValue: (e: Employee) => e.manager_name || '' },
    { key: 'role', label: x.colRole, checked: false, getValue: (e: Employee) => {
      const roles: Record<string, string> = { employee: x.roleEmployee, manager: x.roleManager, rh: x.roleRH, admin: x.roleAdmin, dg: x.roleDG };
      return roles[e.role || ''] || e.role || '';
    }},
    { key: 'is_manager', label: x.colIsManager, checked: false, getValue: (e: Employee) => e.is_manager ? common.yes : common.no },
    { key: 'hire_date', label: x.colHireDate, checked: true, getValue: (e: Employee) => fmtDate(e.hire_date) },
    { key: 'status', label: x.colStatus, checked: true, getValue: (e: Employee) => {
      const s: Record<string, string> = { active: x.statusActive, inactive: x.statusInactive, on_leave: x.statusOnLeave, terminated: x.statusTerminated, probation: x.statusProbation, suspended: x.statusSuspended };
      return s[e.status?.toLowerCase() || ''] || e.status || '';
    }},
    { key: 'contract_type', label: x.colContractType, checked: true, getValue: (e: Employee) => (e.contract_type || '').toUpperCase() },
    { key: 'classification', label: x.colClassification, checked: false, getValue: (e: Employee) => e.classification || '' },
    { key: 'coefficient', label: x.colCoefficient, checked: false, getValue: (e: Employee) => e.coefficient || '' },
    { key: 'salary', label: x.colSalary, checked: false, getValue: (e: Employee) => e.salary ? `${Number(e.salary).toLocaleString('fr-FR')} ${e.currency || 'XOF'}` : '' },
    { key: 'probation_end_date', label: x.colProbationEnd, checked: false, getValue: (e: Employee) => fmtDate(e.probation_end_date) },
    { key: 'contract_end_date', label: x.colContractEnd, checked: false, getValue: (e: Employee) => fmtDate(e.contract_end_date) },
  ];
}

function getLeaveColumns(x: Translations['components']['exportModal']): ColumnDef[] {
  return [
    { key: 'employee_name', label: x.colEmployee, checked: true, getValue: (l: LeaveRequest) => l.employee_name || '' },
    { key: 'leave_type_name', label: x.colLeaveType, checked: true, getValue: (l: LeaveRequest) => l.leave_type_name || '' },
    { key: 'start_date', label: x.colStartDate, checked: true, getValue: (l: LeaveRequest) => fmtDate(l.start_date) },
    { key: 'end_date', label: x.colEndDate, checked: true, getValue: (l: LeaveRequest) => fmtDate(l.end_date) },
    { key: 'days_requested', label: x.colDaysRequested, checked: true, getValue: (l: LeaveRequest) => l.days_requested?.toString() || '' },
    { key: 'status', label: x.colStatus, checked: true, getValue: (l: LeaveRequest) => {
      const s: Record<string, string> = { pending: x.statusPending, approved: x.statusApproved, rejected: x.statusRejected, cancelled: x.statusCancelled, draft: x.statusDraft };
      return s[l.status] || l.status;
    }},
    { key: 'reason', label: x.colReason, checked: false, getValue: (l: LeaveRequest) => l.reason || '' },
    { key: 'department', label: x.colDepartment, checked: true, getValue: (l: LeaveRequest) => l.department || '' },
    { key: 'approved_by_name', label: x.colApprovedBy, checked: false, getValue: (l: LeaveRequest) => l.approved_by_name || '' },
    { key: 'approved_at', label: x.colApprovalDate, checked: false, getValue: (l: LeaveRequest) => fmtDate(l.approved_at) },
    { key: 'rejection_reason', label: x.colRejectionReason, checked: false, getValue: (l: LeaveRequest) => l.rejection_reason || '' },
    { key: 'created_at', label: x.colRequestDate, checked: true, getValue: (l: LeaveRequest) => fmtDate(l.created_at) },
  ];
}

function getDepartmentColumns(x: Translations['components']['exportModal'], common: Translations['common']): ColumnDef[] {
  return [
    { key: 'name', label: x.colName, checked: true, getValue: (d: Department) => d.name },
    { key: 'code', label: x.colCode, checked: true, getValue: (d: Department) => d.code || '' },
    { key: 'level', label: x.colLevel, checked: true, getValue: (d: Department) => {
      const levels: Record<string, string> = { president: x.levelPresident, vice_president: x.levelVicePresident, dg: x.levelDG, dga: x.levelDGA, direction_centrale: x.levelCentralDir, direction: x.levelDirection, departement: x.levelDepartment, service: x.levelService };
      return levels[d.level || ''] || d.level || '';
    }},
    { key: 'employee_count', label: x.colHeadcount, checked: true, getValue: (d: Department) => d.employee_count?.toString() || '0' },
    { key: 'is_active', label: x.colActive, checked: false, getValue: (d: Department) => d.is_active !== false ? common.yes : common.no },
    { key: 'description', label: x.colDescription, checked: false, getValue: (d: Department) => d.description || '' },
  ];
}

function getTaskColumns(x: Translations['components']['exportModal'], common: Translations['common']): ColumnDef[] {
  return [
    { key: 'title', label: x.colTitle, checked: true, getValue: (tk: Task) => tk.title },
    { key: 'assigned_to_name', label: x.colAssignedTo, checked: true, getValue: (tk: Task) => tk.assigned_to_name || '' },
    { key: 'due_date', label: x.colDueDate, checked: true, getValue: (tk: Task) => fmtDate(tk.due_date) },
    { key: 'status', label: x.colStatus, checked: true, getValue: (tk: Task) => {
      const s: Record<string, string> = { pending: x.statusPending, in_progress: x.statusInProgress, completed: x.statusCompleted, cancelled: x.statusCancelled };
      return s[tk.status] || tk.status;
    }},
    { key: 'priority', label: x.colPriority, checked: true, getValue: (tk: Task) => {
      const p: Record<string, string> = { low: x.priorityLow, medium: x.priorityMedium, high: x.priorityHigh, urgent: x.priorityUrgent };
      return p[tk.priority] || tk.priority;
    }},
    { key: 'description', label: x.colDescription, checked: false, getValue: (tk: Task) => tk.description || '' },
    { key: 'created_by_name', label: x.colCreatedBy, checked: false, getValue: (tk: Task) => tk.created_by_name || '' },
    { key: 'completed_at', label: x.colCompletedAt, checked: false, getValue: (tk: Task) => fmtDate(tk.completed_at) },
    { key: 'is_overdue', label: x.colOverdue, checked: false, getValue: (tk: Task) => tk.is_overdue ? common.yes : common.no },
    { key: 'objective_title', label: x.colObjective, checked: false, getValue: (tk: Task) => tk.objective_title || '' },
    { key: 'created_at', label: x.colCreatedAt, checked: true, getValue: (tk: Task) => fmtDate(tk.created_at) },
  ];
}

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
function getDataTypes(x: Translations['components']['exportModal']) {
  return [
    { key: 'employees' as DataType, label: x.employees, sublabel: x.employeesSublabel, icon: Users, color: 'bg-primary-500' },
    { key: 'leaves' as DataType, label: x.leaves, sublabel: x.leavesSublabel, icon: Palmtree, color: 'bg-green-500' },
    { key: 'departments' as DataType, label: x.organization, sublabel: x.organizationSublabel, icon: Building2, color: 'bg-purple-500' },
    { key: 'tasks' as DataType, label: x.tasks, sublabel: x.tasksSublabel, icon: ClipboardList, color: 'bg-amber-500' },
  ];
}

function getFormatOptions(x: Translations['components']['exportModal']) {
  return [
    { key: 'csv' as ExportFormat, label: 'CSV', sublabel: x.csvSublabel, icon: FileText, ext: '.csv' },
    { key: 'xlsx' as ExportFormat, label: 'Excel', sublabel: x.excelSublabel, icon: FileSpreadsheet, ext: '.xlsx' },
    { key: 'pdf' as ExportFormat, label: 'PDF', sublabel: x.pdfSublabel, icon: File, ext: '.pdf' },
  ];
}

// ============================================
// MAIN COMPONENT
// ============================================
interface ExportDataModalProps {
  onClose: () => void;
  initialDataType?: DataType;
  departments?: Department[];
}

export default function ExportDataModal({ onClose, initialDataType, departments: propDepartments }: ExportDataModalProps) {
  const { t } = useI18n();
  const x = t.components.exportModal;
  const DATA_TYPES = getDataTypes(x);
  const FORMAT_OPTIONS = getFormatOptions(x);

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
      employees: getEmployeeColumns(x, t.common),
      leaves: getLeaveColumns(x),
      departments: getDepartmentColumns(x, t.common),
      tasks: getTaskColumns(x, t.common),
    };
    setColumns(colMap[dataType].map(c => ({ ...c })));
    setFilters({});
    setDataCount(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.error(x.exportError);
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
    const title = `Export ${DATA_TYPES.find(d => d.key === dataType)?.label || dataType}`;

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
    const title = `Export ${DATA_TYPES.find(d => d.key === dataType)?.label || dataType}`;
    const dateStr = new Date().toLocaleDateString('fr-FR');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(x.popupError);
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
<p class="meta">${x.generatedOn} ${dateStr} — ${rows.length} enregistrement${rows.length > 1 ? 's' : ''}</p>
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
        <h3 className="text-sm font-medium text-gray-500 mb-4">{x.whatDataType}</h3>
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
            <Filter className="w-4 h-4" /> {x.filters}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(dataType === 'employees' || dataType === 'leaves') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{x.colDepartment}</label>
                <select
                  value={filters.department_id || ''}
                  onChange={(e) => setFilters(f => ({ ...f, department_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{x.allDepartments}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {dataType === 'employees' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{x.colStatus}</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{x.allStatuses}</option>
                  <option value="active">{x.activeSt}</option>
                  <option value="probation">{x.probation}</option>
                  <option value="on_leave">{x.onLeave}</option>
                  <option value="suspended">{x.suspended}</option>
                  <option value="terminated">{x.terminated}</option>
                </select>
              </div>
            )}

            {dataType === 'leaves' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{x.colStatus}</label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="">{x.allFilter}</option>
                    <option value="pending">{x.pendingSt}</option>
                    <option value="approved">{x.approved}</option>
                    <option value="rejected">{x.rejected}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{x.from}</label>
                  <input type="date" value={filters.date_from || ''} onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value || undefined }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{x.to}</label>
                  <input type="date" value={filters.date_to || ''} onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value || undefined }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
              </>
            )}

            {dataType === 'tasks' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{x.colStatus}</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{x.allFilter}</option>
                  <option value="pending">{x.pendingSt}</option>
                  <option value="in_progress">{x.inProgressSt}</option>
                  <option value="completed">{x.completedSt}</option>
                </select>
              </div>
            )}

            {dataType === 'employees' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">{x.search}</label>
                <input type="text" placeholder={x.searchPlaceholder} value={filters.search || ''}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {isLoadingData ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <div className="w-2 h-2 bg-green-500 rounded-full" />}
            <span className="text-xs text-gray-500">
              {dataCount !== null ? x.recordsFound.replace('{n}', String(dataCount)) : 'x.loadingData'}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Columns className="w-4 h-4" /> {x.columns} ({checkedColumns.length}/{columns.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={selectAllColumns} className="text-xs text-primary-600 hover:text-primary-700 font-medium">{x.checkAll}</button>
              <span className="text-gray-300">|</span>
              <button onClick={deselectAllColumns} className="text-xs text-gray-500 hover:text-gray-700 font-medium">{x.uncheckAll}</button>
            </div>
          </div>

          {columns.length > 8 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder={x.filterColumns} value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)}
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
          <h3 className="text-sm font-medium text-gray-500 mb-3">{x.exportFormat}</h3>
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
          <h3 className="text-sm font-semibold text-gray-700">{x.exportSummary}</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">{x.data}</span>
            <span className="font-medium text-gray-900">{DATA_TYPES.find(d => d.key === dataType)?.label}</span>
            <span className="text-gray-500">{x.columns}</span>
            <span className="font-medium text-gray-900">{x.selectedColumns.replace('{n}', String(checkedColumns.length))}</span>
            <span className="text-gray-500">{x.records}</span>
            <span className="font-medium text-gray-900">{dataCount ?? '...'}</span>
            <span className="text-gray-500">{x.format}</span>
            <span className="font-medium text-gray-900">{FORMAT_OPTIONS.find(f => f.key === format)?.label} ({FORMAT_OPTIONS.find(f => f.key === format)?.ext})</span>
          </div>
        </div>

        {exportSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <Check className="w-4 h-4" />
            {x.exportSuccess}
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
              {x.title}
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
                    {s === 1 ? x.dataStep : s === 2 ? x.columnsStep : x.exportStep}
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
            {step > 1 ? x.back : x.cancel}
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
              {isExporting ? x.exporting : x.exportBtn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
