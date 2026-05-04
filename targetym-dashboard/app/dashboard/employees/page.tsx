'use client';

import Header from '@/components/Header';
import CustomSelect from '@/components/CustomSelect';
import EmployeeModal from '@/components/EmployeeModal';
import AddModal from '@/components/AddModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';
import LeaveRequestModal from '@/components/LeaveRequestModal';
import HRDocumentsTab from '@/components/HRDocumentsTab';
import DepartmentManagementTab from '@/components/DepartmentManagementTab';
import ImportEmployeesTab from '@/components/ImportEmployeesTab';
import SanctionsTab from '@/components/SanctionsTab';
import AbsencesTab from '@/components/AbsencesTab';
import FormationsTab from '@/components/FormationsTab';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { employeesTips } from '@/config/pageTips';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  Search, Plus, Mail, Phone, MapPin, Calendar, Building2, Download,
  Edit2, Eye, Users, UserCheck, UserPlus, TrendingDown,
  Palmtree, CheckCircle, XCircle, Filter, ChevronDown, Briefcase,
  User, Loader2, RefreshCw, X, Send, Clock, MailCheck, AlertCircle, AlertTriangle,
  Copy, Check, Maximize2, Minimize2, Network, ZoomIn, ZoomOut, FileText,
  Trash2, UserX, MoreHorizontal, Layers
} from 'lucide-react';
import { useGroupContext } from '@/hooks/useGroupContext';
import { 
  getEmployees, getEmployee, getEmployeeStats, getDepartments, getDepartmentsTree, exportEmployeesToCSV,
  getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, getGroupViewMobility, getGroupViewPersonnel,
  type Employee, type EmployeeStats, type Department, type DepartmentWithChildren, type LeaveRequest, type GroupMobilityView
} from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useI18n } from '@/lib/i18n/I18nContext';

const locations = ['Tous', 'Abidjan', 'Dakar', 'Bamako', 'Ouagadougou', 'Conakry', 'Remote'];

// ============================================
// TYPES ORGANIGRAMME
// ============================================
interface OrgNode {
  id: number;           // dept id (positive), 0 (virtual root), or -(dept.id) for vacant
  employeeId?: number;  // actual employee id, for profile click
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
  department_level?: string; // 'president' | 'dg' | etc.
  is_manager?: boolean;
  status?: string;
  isVacant?: boolean;
  children: OrgNode[];
}

// ============================================
// CSS organigramme pyramidal (lignes de connexion)
// ============================================
const orgChartCSS = `
.org-tree {
  display: flex;
  justify-content: center;
  padding: 20px 40px 40px;
  min-width: max-content;
}
.org-tree ul {
  display: flex;
  justify-content: center;
  padding-top: 24px;
  position: relative;
  list-style: none;
  margin: 0;
  gap: 2px;
}
.org-tree ul::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 24px;
  background: #94a3b8;
}
.org-tree li {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 24px 4px 0;
}
.org-tree li::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 24px;
  background: #94a3b8;
}
.org-tree li::after {
  content: '';
  position: absolute;
  top: 0;
  width: 100%;
  height: 2px;
  background: #94a3b8;
  left: 0;
}
.org-tree li:first-child::after {
  left: 50%;
  width: 50%;
}
.org-tree li:last-child::after {
  right: 50%;
  left: auto;
  width: 50%;
}
.org-tree li:only-child::after {
  display: none;
}
.org-tree > ul > li::before,
.org-tree > ul > li::after,
.org-tree > ul::before {
  display: none;
}
/* Responsive card sizes */
.org-card { min-width: 100px; max-width: 160px; }
.org-card p.org-card-name { font-size: 11px; }
.org-card p.org-card-job { font-size: 9px; }
@media (min-width: 768px) {
  .org-card { min-width: 120px; max-width: 180px; }
  .org-card p.org-card-name { font-size: 12px; }
  .org-card p.org-card-job { font-size: 10px; }
}
@media (min-width: 1024px) {
  .org-card { min-width: 140px; max-width: 200px; }
  .org-card p.org-card-name { font-size: 12px; }
  .org-card p.org-card-job { font-size: 10px; }
}
.org-mobile-hint {
  display: flex;
}
@media (min-width: 768px) {
  .org-mobile-hint { display: none; }
}
`;

// ============================================
// Couleurs fixes par type d'unité organisationnelle
// ============================================
type UnitStyleKey = 'president' | 'vice_president' | 'dg' | 'dga' | 'direction_centrale' | 'direction' | 'departement' | 'service' | 'default';

const UNIT_TYPE_STYLES: Record<UnitStyleKey, { bg: string; border: string; text: string; avatar: string; badge: string }> = {
  president:          { bg: 'bg-orange-50',  border: 'border-orange-500',  text: 'text-orange-900',  avatar: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700' },
  vice_president:     { bg: 'bg-amber-50',   border: 'border-amber-500',   text: 'text-amber-900',   avatar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  dg:                 { bg: 'bg-orange-50',  border: 'border-orange-700',  text: 'text-orange-900',  avatar: 'bg-orange-700',  badge: 'bg-orange-200 text-orange-900' },
  dga:                { bg: 'bg-green-50',   border: 'border-green-500',   text: 'text-green-900',   avatar: 'bg-green-500',   badge: 'bg-green-100 text-green-700' },
  direction_centrale: { bg: 'bg-purple-50',  border: 'border-purple-500',  text: 'text-purple-900',  avatar: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700' },
  direction:          { bg: 'bg-primary-50',    border: 'border-primary-500',    text: 'text-primary-900',    avatar: 'bg-primary-500',    badge: 'bg-primary-100 text-primary-700' },
  departement:        { bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-700',  avatar: 'bg-orange-300',  badge: 'bg-orange-50 text-orange-600' },
  service:            { bg: 'bg-gray-50',    border: 'border-gray-400',    text: 'text-gray-700',    avatar: 'bg-gray-500',    badge: 'bg-gray-100 text-gray-600' },
  default:            { bg: 'bg-slate-50',   border: 'border-slate-400',   text: 'text-slate-700',   avatar: 'bg-slate-500',   badge: 'bg-slate-100 text-slate-600' },
};

function getUnitStyle(deptLevel?: string) {
  return UNIT_TYPE_STYLES[(deptLevel as UnitStyleKey)] ?? UNIT_TYPE_STYLES.default;
}

// Mapping niveau département → label court (badge sur la carte)
const DEPT_LEVEL_LABELS: Record<string, string> = {
  president: 'PCA', vice_president: 'VP', dg: 'DG', dga: 'DGA',
  direction_centrale: 'DC', direction: 'DIR', departement: 'DEPT', service: 'SRV',
};

// Mapping niveau → couleur hex pour l'enregistrement en base
export const LEVEL_COLOR_MAP: Record<string, string> = {
  president:          '#f97316',
  vice_president:     '#f59e0b',
  dg:                 '#c2410c',
  dga:                '#22c55e',
  direction_centrale: '#a855f7',
  direction:          '#066C6C',
  departement:        '#fdba74',
  service:            '#6b7280',
};

// ============================================
// Composant Carte Noeud
// ============================================
function OrgCard({ node, isExpanded, hasChildren, onToggle, onSelect }: {
  node: OrgNode; isExpanded: boolean; hasChildren: boolean;
  onToggle: () => void; onSelect?: () => void;
}) {
  const { t } = useI18n();
  const s = getUnitStyle(node.department_level);
  const initials = `${node.first_name?.[0] || ''}${node.last_name?.[0] || ''}`.toUpperCase();
  const isVirtual = node.id === 0;
  const isVacant = node.isVacant === true;
  const childCount = node.children.length;
  const levelLabel = node.department_level ? DEPT_LEVEL_LABELS[node.department_level] : null;

  if (isVacant) {
    return (
      <div className="relative group">
        <div className="org-card relative px-3 py-3 rounded-xl border-2 border-dashed border-orange-400 bg-orange-50/60">
          <div className="flex flex-col items-center text-center">
            <div className="w-9 h-9 border-2 border-dashed border-orange-400 rounded-full flex items-center justify-center text-orange-500 mb-1.5">
              <Building2 className="w-4 h-4" />
            </div>
            {levelLabel && (
              <span className="mb-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-600">{levelLabel}</span>
            )}
            <p className="org-card-name font-semibold leading-tight text-orange-700 truncate w-full text-center">
              {node.first_name}
            </p>
            <p className="org-card-job text-orange-500 mt-0.5 leading-tight font-medium">
              {t.employees.orgchart.vacantPosition}
            </p>
          </div>
        </div>
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full border-2 border-orange-300 bg-white shadow-sm flex items-center justify-center hover:bg-orange-50 transition-all"
          >
            {isExpanded
              ? <span className="text-orange-500 text-xs font-bold leading-none">−</span>
              : <span className="text-orange-500 text-xs font-bold leading-none">+</span>}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        className={`org-card relative px-3 py-3 rounded-xl border-2 ${s.border} ${s.bg} shadow-sm hover:shadow-lg transition-all cursor-pointer ${node.is_manager ? 'ring-1 ring-offset-1 ring-opacity-30 ring-current' : ''}`}
        onClick={onSelect}
      >
        <div className="flex flex-col items-center text-center">
          {!isVirtual ? (
            <div className={`w-9 h-9 ${s.avatar} rounded-full flex items-center justify-center text-white font-bold text-xs mb-1.5 shadow-sm`}>
              {initials}
            </div>
          ) : (
            <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white mb-1.5 shadow-sm">
              <Building2 className="w-4 h-4" />
            </div>
          )}
          {levelLabel && (
            <span className={`mb-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${s.badge}`}>{levelLabel}</span>
          )}
          <p className={`org-card-name font-semibold leading-tight ${s.text} truncate w-full text-center`}>
            {node.first_name}{node.last_name ? ` ${node.last_name}` : ''}
          </p>
          <p className="org-card-job text-gray-500 mt-0.5 leading-tight truncate w-full text-center">
            {node.job_title || (isVirtual ? 'Organisation' : '—')}
          </p>
          {node.department_name && !isVirtual && (
            <span className={`mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${s.badge} truncate max-w-full`}>
              {node.department_name}
            </span>
          )}
          {hasChildren && (
            <span className="mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-200 text-gray-600">
              {childCount} N-1{childCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full border-2 border-gray-300 bg-white shadow-sm flex items-center justify-center hover:bg-gray-100 hover:border-gray-400 transition-all"
        >
          {isExpanded
            ? <span className="text-gray-500 text-xs font-bold leading-none">−</span>
            : <span className="text-gray-500 text-xs font-bold leading-none">+</span>}
        </button>
      )}
    </div>
  );
}

// ============================================
// Composant Arbre récursif pyramidal
// ============================================
function OrgTreeVisual({ node, expanded, onToggle, level = 0, onSelectEmployee }: {
  node: OrgNode; expanded: Set<number>; onToggle: (id: number) => void;
  level?: number; onSelectEmployee?: (id: number) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  // Use employeeId for profile click; skip for virtual root and vacant nodes
  const canSelect = !node.isVacant && node.id !== 0 && !!node.employeeId && !!onSelectEmployee;

  return (
    <li>
      <OrgCard
        node={node}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
        onToggle={() => onToggle(node.id)}
        onSelect={canSelect ? () => onSelectEmployee!(node.employeeId!) : undefined}
      />
      {hasChildren && isExpanded && (
        <ul>
          {node.children.map(child => (
            <OrgTreeVisual
              key={child.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              level={level + 1}
              onSelectEmployee={onSelectEmployee}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ============================================
// Types et API invitations
// ============================================
interface InvitationEmployee {
  id: number; first_name: string; last_name: string; email: string;
  job_title?: string; department_name?: string;
  invitation_status: 'not_invited' | 'pending' | 'accepted';
  invitation_sent_at?: string; last_login?: string; has_user_account: boolean;
}
interface InvitationStats { total_employees: number; not_invited: number; pending: number; accepted: number; }

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

async function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' };
}

async function getInvitations(statusFilter?: string, search?: string, subsidiaryTenantId?: number): Promise<{ items: InvitationEmployee[], stats: InvitationStats }> {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') params.append('status_filter', statusFilter);
  if (search) params.append('search', search);
  if (subsidiaryTenantId) params.append('subsidiary_tenant_id', String(subsidiaryTenantId));
  const r = await fetch(`${API_URL}/api/invitations/?${params}`, { headers: await getAuthHeaders() });
  if (!r.ok) throw new Error('Erreur');
  return r.json();
}

async function sendInvitation(employeeId: number): Promise<{ success: boolean; message: string; email_sent: boolean; temp_password?: string }> {
  const r = await fetch(`${API_URL}/api/invitations/${employeeId}/send`, { method: 'POST', headers: await getAuthHeaders() });
  if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Erreur'); }
  return r.json();
}

async function resendInvitation(employeeId: number): Promise<{ success: boolean; message: string; email_sent: boolean; temp_password?: string }> {
  const r = await fetch(`${API_URL}/api/invitations/${employeeId}/resend`, { method: 'POST', headers: await getAuthHeaders() });
  if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Erreur'); }
  return r.json();
}

function TempPasswordModal({ isOpen, onClose, employeeName, email, tempPassword, emailSent }: { isOpen: boolean; onClose: () => void; employeeName: string; email: string; tempPassword: string; emailSent: boolean; }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${emailSent ? 'bg-green-100' : 'bg-yellow-100'}`}>
                {emailSent ? <MailCheck className="w-8 h-8 text-green-600" /> : <AlertCircle className="w-8 h-8 text-yellow-600" />}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{emailSent ? t.employees.invitationSent : t.employees.accountCreated}</h3>
              <p className="text-sm text-gray-500 mt-1">{emailSent ? `${t.employees.emailSentTo} ${employeeName}` : t.employees.emailNotSent}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="mb-3"><label className="text-xs text-gray-500">{t.auth.email}</label><p className="font-medium text-gray-900">{email}</p></div>
              <div>
                <label className="text-xs text-gray-500">{t.employees.tempPassword}</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-200 font-mono text-sm">{tempPassword}</code>
                  <button onClick={handleCopy} className={`p-2 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {!emailSent && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"><p className="text-sm text-yellow-800"><strong>{t.employees.secureNote.split('{name}')[0]}</strong>{employeeName}{t.employees.secureNote.split('{name}')[1]}</p></div>)}
            <button onClick={onClose} className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">{t.common.close}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================
function EmployeesPageInner() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');
  const [selectedLocation, setSelectedLocation] = useState('Tous');
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'employees' | 'leaves' | 'invitations' | 'orgchart' | 'documents' | 'departments' | 'import' | 'sanctions' | 'absences' | 'formations' | 'mobility'>('employees');
  // Réagir aux changements de ?tab= dans l'URL (sidebar navigation)
  useEffect(() => {
    const tab = searchParams.get('tab');
    const validTabs = ['employees', 'leaves', 'invitations', 'orgchart', 'documents', 'departments', 'import', 'sanctions', 'absences', 'formations', 'mobility'];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab as 'employees' | 'leaves' | 'invitations' | 'orgchart' | 'documents' | 'departments' | 'import' | 'sanctions' | 'absences' | 'formations' | 'mobility');
    }
  }, [searchParams]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const isInitialized = useRef(false);
  const departmentsRef = useRef<Department[]>([]);

  // Congés
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [showLeaveFilter, setShowLeaveFilter] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('all');
  const leaveFilterBtnRef = useRef<HTMLButtonElement | null>(null);
  const [leaveFilterPos, setLeaveFilterPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [portalMounted, setPortalMounted] = useState(false);
  useEffect(() => { setPortalMounted(true); }, []);

  // Invitations
  const [invitations, setInvitations] = useState<InvitationEmployee[]>([]);
  const [invitationStats, setInvitationStats] = useState<InvitationStats | null>(null);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [invitationFilter, setInvitationFilter] = useState<string>('all');
  const [invitationSearch, setInvitationSearch] = useState('');
  const [sendingInvitation, setSendingInvitation] = useState<number | null>(null);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPasswordData, setTempPasswordData] = useState<{ employeeName: string; email: string; tempPassword: string; emailSent: boolean; } | null>(null);

  // Organigramme
  const [orgData, setOrgData] = useState<OrgNode | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [orgSearch, setOrgSearch] = useState('');
  const [orgZoom, setOrgZoom] = useState(70);
  const lastPinchDistRef = useRef<number | null>(null);

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  // Page Tour
  const { showTips, dismissTips, resetTips } = usePageTour('employees');

  // Contexte groupe / filiale
  const { context: groupContext, selectedTenantId, selectedSubsidiary, selectTenant, isGlobalDashboardMode } = useGroupContext();
  const isReadOnly = selectedTenantId !== null;
  const [mobilityData, setMobilityData] = useState<GroupMobilityView | null>(null);
  const [mobilityLoading, setMobilityLoading] = useState(false);

  // Recharger données quand la filiale sélectionnée change
  useEffect(() => {
    if (isInitialized.current) {
      // Reset et recharge toutes les données pour la filiale sélectionnée
      isInitialized.current = false;
      setEmployees([]);
      setStats(null);
      setDepartments([]);
      setCurrentPage(1);
      setTimeout(() => { isInitialized.current = true; loadAllData(); }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

  // ============================================
  // ORGANIGRAMME LOGIC — arbre basé sur les départements
  // ============================================
  const LEVEL_ORDER: Record<string, number> = {
    president: 0, vice_president: 1, dg: 1, dga: 2,
    direction_centrale: 3, direction: 4, departement: 5, service: 6,
  };

  const buildDeptOrgTree = useCallback((
    depts: DepartmentWithChildren[],
    empMap: Map<number, Employee>
  ): OrgNode | null => {
    function convertDept(dept: DepartmentWithChildren): OrgNode {
      const headEmp = dept.head_id ? empMap.get(dept.head_id) : undefined;
      const sortedChildren = [...dept.children].sort(
        (a, b) => (LEVEL_ORDER[a.level ?? ''] ?? 99) - (LEVEL_ORDER[b.level ?? ''] ?? 99)
      );
      const children = sortedChildren.map(convertDept);

      if (!headEmp) {
        return {
          id: -(dept.id),
          first_name: dept.name,
          last_name: '',
          job_title: t.employees.orgchart.vacantPosition,
          department_name: dept.name,
          department_level: dept.level,
          isVacant: true,
          children,
        };
      }
      return {
        id: dept.id,
        employeeId: headEmp.id,
        first_name: headEmp.first_name,
        last_name: headEmp.last_name,
        job_title: headEmp.position || headEmp.job_title,
        department_name: dept.name,
        department_level: dept.level,
        is_manager: headEmp.is_manager,
        status: headEmp.status,
        children,
      };
    }

    if (!depts.length) return null;
    const sorted = [...depts].sort(
      (a, b) => (LEVEL_ORDER[a.level ?? ''] ?? 99) - (LEVEL_ORDER[b.level ?? ''] ?? 99)
    );
    if (sorted.length === 1) return convertDept(sorted[0]);
    return {
      id: 0,
      first_name: 'Organisation',
      last_name: '',
      job_title: t.employees.orgchart.overview,
      children: sorted.map(convertDept),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const fetchOrgChart = useCallback(async () => {
    setOrgLoading(true);
    try {
      const [empResponse, deptTree] = await Promise.all([
        getEmployees({ page: 1, page_size: 500, subsidiary_tenant_id: selectedTenantId ?? undefined }),
        getDepartmentsTree(selectedTenantId ?? undefined),
      ]);
      const empMap = new Map<number, Employee>(
        (empResponse.items || []).map(e => [e.id, e])
      );
      const tree = buildDeptOrgTree(deptTree || [], empMap);
      setOrgData(tree);
      if (tree) {
        const ids = new Set<number>();
        ids.add(tree.id);
        tree.children.forEach(c => {
          ids.add(c.id);
          c.children.forEach(gc => ids.add(gc.id));
        });
        setExpandedNodes(ids);
      }
    } catch (err) { console.error('Error building org chart:', err); }
    finally { setOrgLoading(false); }
  }, [buildDeptOrgTree, selectedTenantId]);

  const toggleOrgNode = (id: number) => { setExpandedNodes(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const expandAllNodes = () => { if (!orgData) return; const ids = new Set<number>(); const t = (n: OrgNode) => { ids.add(n.id); n.children.forEach(t); }; t(orgData); setExpandedNodes(ids); };
  const collapseAllNodes = () => { if (orgData) setExpandedNodes(new Set([orgData.id])); };
  const countDescendants = (node: OrgNode): number => { let c = node.id === 0 || node.isVacant ? 0 : 1; node.children.forEach(ch => { c += countDescendants(ch); }); return c; };

  useEffect(() => {
    if (!orgSearch || !orgData) return;
    const sl = orgSearch.toLowerCase();
    const matchIds = new Set<number>();
    const find = (node: OrgNode, ancestors: number[]): boolean => {
      const m = `${node.first_name} ${node.last_name} ${node.job_title || ''} ${node.department_name || ''}`.toLowerCase().includes(sl);
      let cm = false;
      node.children.forEach(c => { if (find(c, [...ancestors, node.id])) cm = true; });
      if (m || cm) { ancestors.forEach(id => matchIds.add(id)); matchIds.add(node.id); return true; }
      return false;
    };
    find(orgData, []);
    if (matchIds.size > 0) setExpandedNodes(matchIds);
  }, [orgSearch, orgData]);

  // Charge l'organigramme à chaque changement de filiale ou d'onglet
  useEffect(() => {
    if (activeTab !== 'orgchart') return;
    // Réinitialise puis charge avec le bon tenant
    setOrgData(null);
    setOrgLoading(false);
    // Petit délai pour laisser les callbacks se mettre à jour
    const t = setTimeout(() => { fetchOrgChart(); }, 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedTenantId]);

  const handleOrgSelectEmployee = (empId: number) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) { setSelectedEmployee(emp); setShowViewModal(true); }
    else { getEmployees({ page: 1, page_size: 1, search: empId.toString() }).then(res => { if (res.items?.[0]) { setSelectedEmployee(res.items[0]); setShowViewModal(true); } }); }
  };

  // ============================================
  // DATA FETCHING
  // ============================================
  const fetchEmployees = async (depts: Department[]) => {
    try {
      const deptId = selectedDepartment !== 'Tous' ? depts.find(d => d.name === selectedDepartment)?.id : undefined;
      const response = await getEmployees({ page: currentPage, page_size: 10, search: searchTerm || undefined, department_id: deptId, subsidiary_tenant_id: selectedTenantId ?? undefined });
      setEmployees(response.items || []); setTotalPages(response.total_pages || 1); setTotalEmployees(response.total || 0);
    } catch (err) { console.error(err); setEmployees([]); }
  };

  const fetchStats = async () => {
    try {
      const data = await getEmployeeStats({ subsidiary_tenant_id: selectedTenantId ?? undefined });
      setStats(data);
    } catch {
      setStats({ total: 0, active: 0, inactive: 0, on_leave: 0, by_department: {}, by_gender: {}, by_contract_type: {} });
    }
  };
  const fetchDepartments = async (): Promise<Department[]> => { try { const data = await getDepartments(undefined, selectedTenantId ?? undefined); setDepartments(data || []); departmentsRef.current = data || []; return data || []; } catch { setDepartments([]); return []; } };
  const fetchLeaveRequests = async () => { setIsLoadingLeaves(true); try { const response = await getLeaveRequests({ page_size: 100, subsidiary_tenant_id: selectedTenantId ?? undefined }); setLeaveRequests(response.items || []); } catch { setLeaveRequests([]); } finally { setIsLoadingLeaves(false); } };
  const fetchInvitations = async () => { setIsLoadingInvitations(true); try { const data = await getInvitations(invitationFilter !== 'all' ? invitationFilter : undefined, invitationSearch || undefined, selectedTenantId ?? undefined); setInvitations(data.items || []); setInvitationStats(data.stats); } catch { setInvitations([]); } finally { setIsLoadingInvitations(false); } };
  const fetchMobility = async () => { setMobilityLoading(true); try { const data = await getGroupViewMobility(); setMobilityData(data); } catch { setMobilityData(null); } finally { setMobilityLoading(false); } };

  const loadAllData = async () => {
    setIsLoading(true); setError(null);
    try { const depts = await fetchDepartments(); await fetchStats(); await fetchEmployees(depts); await fetchLeaveRequests(); await fetchInvitations(); }
    catch { setError(t.employees.loadingError); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (!isInitialized.current) { isInitialized.current = true; loadAllData(); } }, []);
  useEffect(() => { if (isInitialized.current && !isLoading) { const timer = setTimeout(() => { fetchEmployees(departmentsRef.current); }, 300); return () => clearTimeout(timer); } }, [searchTerm, selectedDepartment, currentPage]);
  useEffect(() => { if (isInitialized.current && activeTab === 'invitations') { const timer = setTimeout(() => { fetchInvitations(); }, 300); return () => clearTimeout(timer); } }, [invitationFilter, invitationSearch, activeTab]);
  useEffect(() => { if (activeTab === 'mobility' && !mobilityLoading) { fetchMobility(); } }, [activeTab]);  // toujours rafraîchir au changement d'onglet

  // ============================================
  // COMPUTED
  // ============================================
  const filteredEmployees = employees.filter(emp => selectedLocation === 'Tous' || emp.location === selectedLocation || emp.site === selectedLocation);

  const dynamicStats = {
    total: selectedDepartment === 'Tous' && selectedLocation === 'Tous' && !searchTerm ? (stats?.total || totalEmployees) : filteredEmployees.length,
    active: selectedDepartment === 'Tous' && selectedLocation === 'Tous' && !searchTerm ? (stats?.active || 0) : filteredEmployees.filter(e => !['terminated', 'suspended', 'inactive'].includes(e.status?.toLowerCase() || '')).length,
    inactive: selectedDepartment === 'Tous' && selectedLocation === 'Tous' && !searchTerm ? (stats?.inactive || 0) : filteredEmployees.filter(e => ['terminated', 'suspended', 'inactive'].includes(e.status?.toLowerCase() || '')).length,
    on_leave: selectedDepartment === 'Tous' && selectedLocation === 'Tous' && !searchTerm ? (stats?.on_leave || 0) : filteredEmployees.filter(e => e.status?.toLowerCase() === 'on_leave').length,
    managers: selectedDepartment === 'Tous' && selectedLocation === 'Tous' && !searchTerm ? (stats?.managers || filteredEmployees.filter(e => e.is_manager).length) : filteredEmployees.filter(e => e.is_manager).length,
    female: selectedDepartment === 'Tous' && selectedLocation === 'Tous' && !searchTerm ? (stats?.female || 0) : filteredEmployees.filter(e => { const g = e.gender?.toLowerCase(); return g === 'female' || g === 'f'; }).length,
    new_this_month: selectedDepartment === 'Tous' && selectedLocation === 'Tous' && !searchTerm ? (stats?.new_this_month || 0) : filteredEmployees.filter(e => { if (!e.hire_date) return false; const h = new Date(e.hire_date); const n = new Date(); return h.getMonth() === n.getMonth() && h.getFullYear() === n.getFullYear(); }).length
  };

  // Apply card filter for display
  const displayedEmployees = cardFilter ? filteredEmployees.filter(emp => {
    const status = emp.status?.toLowerCase() || '';
    switch (cardFilter) {
      case 'active': return !['terminated', 'suspended', 'inactive'].includes(status);
      case 'inactive': return ['terminated', 'suspended', 'inactive'].includes(status);
      case 'on_leave': return status === 'on_leave';
      case 'managers': return emp.is_manager;
      case 'female': { const g = emp.gender?.toLowerCase(); return g === 'female' || g === 'f'; }
      case 'new_this_month': { if (!emp.hire_date) return false; const h = new Date(emp.hire_date); const n = new Date(); return h.getMonth() === n.getMonth() && h.getFullYear() === n.getFullYear(); }
      default: return true;
    }
  }) : filteredEmployees;

  const cardFilterLabels: Record<string, string> = {
    active: t.employees.stats.active, inactive: t.employees.inactive, on_leave: t.employees.onLeave,
    managers: t.employees.managers, female: t.employees.women, new_this_month: t.employees.newThisMonth
  };

  const filteredLeaveRequests = leaveRequests.filter(leave => leaveStatusFilter === 'all' ? true : leave.status === leaveStatusFilter);
  const leaveStats = { pending: leaveRequests.filter(l => l.status === 'pending').length, approved: leaveRequests.filter(l => l.status === 'approved').length, rejected: leaveRequests.filter(l => l.status === 'rejected').length, total: leaveRequests.length };

  // Sélection multiple — helpers
  const allSelected = displayedEmployees.length > 0 && displayedEmployees.every(e => selectedIds.has(e.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedEmployees.map(e => e.id)));
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

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!someSelected) return;
    const count = selectedIds.size;
    const statusLabels: Record<string, string> = { active: t.employees.active, inactive: t.employees.inactive, terminated: t.employees.terminated, suspended: t.employees.suspended };
    setConfirmDialog({
      isOpen: true,
      title: t.employees.bulkActions.statusChange,
      message: t.employees.bulkActions.statusChangeConfirm.replace('{count}', String(count)).replace('{status}', statusLabels[newStatus] || newStatus),
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setBulkActionLoading(true);
        try {
          const token = localStorage.getItem('access_token');
          await Promise.all(Array.from(selectedIds).map(id =>
            fetch(`${API_URL}/api/employees/${id}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
            })
          ));
          setSelectedIds(new Set());
          loadAllData();
          toast.success(`Statut modifié pour ${count} employé(s)`);
        } catch (err) {
          console.error('Bulk status update failed', err);
          toast.error('Échec du changement de statut');
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    if (!someSelected) return;
    const count = selectedIds.size;
    setConfirmDialog({
      isOpen: true,
      title: t.employees.bulkActions.bulkDelete,
      message: t.employees.bulkActions.bulkDeleteConfirm.replace('{count}', String(count)),
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setBulkActionLoading(true);
        try {
          const token = localStorage.getItem('access_token');
          await Promise.all(Array.from(selectedIds).map(id =>
            fetch(`${API_URL}/api/employees/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            })
          ));
          setSelectedIds(new Set());
          loadAllData();
          toast.success(`${count} employé(s) supprimé(s)`);
        } catch (err) {
          console.error('Bulk delete failed', err);
          toast.error('Échec de la suppression');
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  const handleBulkExport = async () => {
    const selected = employees.filter(e => selectedIds.has(e.id));
    const headers = [t.employees.firstName, t.employees.lastName, t.common.email, t.common.department, t.common.position, t.employees.location, t.common.status, t.employees.contract];
    const rows = selected.map(e => [
      e.first_name, e.last_name, e.email, e.department_name || '',
      e.position || e.job_title || '', e.location || e.site || '',
      e.status, e.contract_type || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const { downloadFile } = await import('@/lib/capacitor-plugins');
    await downloadFile(blob, `employes_selection_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ============================================
  // HELPERS
  // ============================================
  const getInitials = (firstName: string, lastName: string) => `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const formatDate = (ds?: string) => { if (!ds) return '-'; return new Date(ds).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const formatDateTime = (ds?: string) => { if (!ds) return '-'; return new Date(ds).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'active': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{t.employees.active}</span>;
      case 'inactive': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{t.employees.inactive}</span>;
      case 'on_leave': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">{t.employees.onLeave}</span>;
      case 'terminated': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">{t.employees.terminated}</span>;
      case 'probation': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">{t.employees.probation}</span>;
      case 'suspended': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">{t.employees.suspended}</span>;
      default: return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t.employees.invitations.accepted}</span>;
      case 'pending': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><Clock className="w-3 h-3" />{t.employees.invitations.pending}</span>;
      case 'not_invited': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" />{t.employees.invitations.notInvited}</span>;
      default: return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  // ============================================
  // HANDLERS
  // ============================================
  const handleApproveLeave = async (id: number) => { try { await approveLeaveRequest(id); setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'approved' as const } : req)); if (showLeaveModal && selectedLeaveRequest?.id === id) { setShowLeaveModal(false); setSelectedLeaveRequest(null); } } catch { toast.error('Erreur'); } };
  const handleRejectLeave = async (id: number, reason: string) => { try { await rejectLeaveRequest(id, reason); setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' as const, rejection_reason: reason } : req)); setShowLeaveModal(false); setSelectedLeaveRequest(null); } catch { toast.error('Erreur'); } };

  const handleSendInvitation = async (employee: InvitationEmployee) => {
    setSendingInvitation(employee.id);
    try { const result = await sendInvitation(employee.id); if (result.temp_password) { setTempPasswordData({ employeeName: `${employee.first_name} ${employee.last_name}`, email: employee.email, tempPassword: result.temp_password, emailSent: result.email_sent }); setShowTempPasswordModal(true); } await fetchInvitations(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
    finally { setSendingInvitation(null); }
  };

  const handleResendInvitation = async (employee: InvitationEmployee) => {
    setSendingInvitation(employee.id);
    try { const result = await resendInvitation(employee.id); if (result.temp_password) { setTempPasswordData({ employeeName: `${employee.first_name} ${employee.last_name}`, email: employee.email, tempPassword: result.temp_password, emailSent: result.email_sent }); setShowTempPasswordModal(true); } await fetchInvitations(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur'); }
    finally { setSendingInvitation(null); }
  };

  // Sélection multiple — Invitations
  const [selectedInvIds, setSelectedInvIds] = useState<Set<number>>(new Set());
  const [bulkInvLoading, setBulkInvLoading] = useState(false);

  const allInvSelected = invitations.length > 0 && invitations.every(i => selectedInvIds.has(i.id));
  const someInvSelected = selectedInvIds.size > 0;

  const toggleSelectAllInv = () => {
    if (allInvSelected) setSelectedInvIds(new Set());
    else setSelectedInvIds(new Set(invitations.map(i => i.id)));
  };

  const toggleSelectInv = (id: number) => {
    setSelectedInvIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkInvite = async () => {
    const toInvite = invitations.filter(i => selectedInvIds.has(i.id) && i.invitation_status === 'not_invited');
    const toResend = invitations.filter(i => selectedInvIds.has(i.id) && i.invitation_status === 'pending');
    const count = toInvite.length + toResend.length;
    if (count === 0) { toast.error(t.employees.invitations.noEmployeeToInvite); return; }
    setConfirmDialog({
      isOpen: true,
      title: t.employees.invitations.sendInvitations,
      message: t.employees.invitations.sendConfirm.replace('{invites}', String(toInvite.length)).replace('{resends}', String(toResend.length)),
      danger: false,
      onConfirm: async () => {
        setBulkInvLoading(true);
        try {
          for (const inv of toInvite) { await sendInvitation(inv.id); }
          for (const inv of toResend) { await resendInvitation(inv.id); }
          setSelectedInvIds(new Set());
          await fetchInvitations();
        } catch (err) { console.error('Bulk invite failed', err); }
        setBulkInvLoading(false);
      },
    });
  };

  const handleBulkExportInv = async () => {
    const selected = invitations.filter(i => selectedInvIds.has(i.id));
    const headers = [t.employees.firstName, t.employees.lastName, t.common.email, t.common.position, t.common.department, t.common.status, t.employees.invitations.invitedOn, t.employees.invitations.connectedOn];
    const statusLabels: Record<string, string> = { not_invited: t.employees.invitations.notInvited, pending: t.employees.invitations.pending, accepted: t.employees.invitations.accepted };
    const rows = selected.map(i => [
      i.first_name, i.last_name, i.email, i.job_title || '', i.department_name || '',
      statusLabels[i.invitation_status] || i.invitation_status,
      i.invitation_sent_at ? formatDateTime(i.invitation_sent_at) : '', i.last_login ? formatDateTime(i.last_login) : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const { downloadFile } = await import('@/lib/capacitor-plugins');
    await downloadFile(blob, `invitations_selection_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExport = async () => { await exportEmployeesToCSV(filteredEmployees); };
  const handleSuccess = async (patch?: Partial<Employee>) => {
    const prevSelectedId = selectedEmployee?.id;
    const isEdit = patch !== undefined;
    setSelectedEmployee(null);
    await loadAllData();
    if (prevSelectedId) {
      try {
        const updated = await getEmployee(prevSelectedId);
        const merged = patch
          ? { ...updated, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null && v !== undefined)) }
          : updated;
        setSelectedEmployee(merged as Employee);
        if (isEdit) {
          toast.success('Employé mis à jour avec succès');
          setShowViewModal(true);
        }
      } catch { /* si supprimé, on ne re-sélectionne pas */ }
    }
  };
  const hasActiveFilter = selectedDepartment !== 'Tous' || selectedLocation !== 'Tous' || searchTerm !== '' || cardFilter !== null;

  // Handler for opening employee profile from Documents tab
  const handleOpenEmployeeProfile = (empId: number) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) { setSelectedEmployee(emp); setShowViewModal(true); }
    else { getEmployees({ page: 1, page_size: 1, search: empId.toString() }).then(res => { if (res.items?.[0]) { setSelectedEmployee(res.items[0]); setShowViewModal(true); } }); }
  };

  // ============================================
  // RENDER
  // ============================================
  const tabHeaders: Record<string, { title: string; subtitle: string }> = {
    employees:   { title: t.employees.tabs.employees,    subtitle: t.employees.tabs.employeesSubtitle },
    departments: { title: t.employees.tabs.departments,  subtitle: t.employees.tabs.departmentsSubtitle },
    orgchart:    { title: t.employees.tabs.orgchart,     subtitle: t.employees.tabs.orgchartSubtitle },
    documents:   { title: t.employees.tabs.documents,    subtitle: t.employees.tabs.documentsSubtitle },
    leaves:      { title: t.employees.tabs.leaves,       subtitle: t.employees.tabs.leavesSubtitle },
    absences:    { title: t.employees.tabs.absences,     subtitle: t.employees.tabs.absencesSubtitle },
    formations:  { title: t.employees.tabs.formations,   subtitle: t.employees.tabs.formationsSubtitle },
    sanctions:   { title: t.employees.tabs.sanctions,    subtitle: t.employees.tabs.sanctionsSubtitle },
    invitations: { title: t.employees.tabs.invitations,  subtitle: t.employees.tabs.invitationsSubtitle },
    import:      { title: t.employees.tabs.import,       subtitle: t.employees.tabs.importSubtitle },
    mobility:    { title: t.employees.tabs.mobility,     subtitle: t.employees.tabs.mobilitySubtitle },
  };
  const currentHeader = tabHeaders[activeTab] ?? { title: t.employees.title, subtitle: t.employees.tabs.defaultSubtitle };
  const showMobilityTab = groupContext?.is_group || groupContext?.group_type === 'subsidiary';

  if (isLoading) {
    return (<><Header title={currentHeader.title} subtitle={currentHeader.subtitle} /><main className="flex-1 p-6 flex items-center justify-center"><div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" /><p className="text-gray-500">{t.common.loading}</p></div></main></>);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: orgChartCSS }} />
      {showTips && (
        <PageTourTips
          tips={employeesTips}
          onDismiss={dismissTips}
          pageTitle={currentHeader.title}
        />
      )}
      <Header title={currentHeader.title} subtitle={currentHeader.subtitle} />
      <main className="flex-1 p-6 overflow-auto">
        {error && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"><span className="text-red-700">{error}</span><button onClick={loadAllData} className="flex items-center text-red-600 hover:text-red-800"><RefreshCw className="w-4 h-4 mr-1" />{t.employees.retry}</button></div>)}

        {hasActiveFilter && activeTab === 'employees' && (
          <div className="mb-4 px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary-700"><Filter className="w-4 h-4 inline mr-2" />{t.employees.filters} : {selectedDepartment !== 'Tous' && <span className="ml-2 px-2 py-0.5 bg-primary-100 rounded">{selectedDepartment}</span>}{selectedLocation !== 'Tous' && <span className="ml-2 px-2 py-0.5 bg-primary-100 rounded">{selectedLocation}</span>}{searchTerm && <span className="ml-2 px-2 py-0.5 bg-primary-100 rounded">&quot;{searchTerm}&quot;</span>}{cardFilter && <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 rounded">{cardFilterLabels[cardFilter]}</span>}</span>
            <button onClick={() => { setSelectedDepartment('Tous'); setSelectedLocation('Tous'); setSearchTerm(''); setCardFilter(null); setCurrentPage(1); }} className="text-sm text-primary-600 hover:text-primary-800 flex items-center"><X className="w-4 h-4 mr-1" />{t.employees.clear}</button>
          </div>
        )}

        {/* Stats — contextuelles par onglet */}
        {activeTab === 'employees' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <div onClick={() => { setCardFilter(null); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${!cardFilter ? 'border-primary-300 ring-2 ring-primary-100' : 'border-gray-100'}`}><Users className="w-5 h-5 text-primary-500 mb-2" /><p className="text-2xl font-bold text-gray-900">{dynamicStats.total}</p><p className="text-xs text-gray-500">{t.common.total}</p></div>
            <div onClick={() => { setCardFilter(cardFilter === 'active' ? null : 'active'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'active' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'}`}><UserCheck className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{dynamicStats.active}</p><p className="text-xs text-gray-500">{t.employees.stats.active}</p></div>
            <div onClick={() => { setCardFilter(cardFilter === 'new_this_month' ? null : 'new_this_month'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'new_this_month' ? 'border-primary-300 ring-2 ring-primary-100' : 'border-gray-100'}`}><UserPlus className="w-5 h-5 text-primary-500 mb-2" /><p className="text-2xl font-bold text-primary-600">{dynamicStats.new_this_month}</p><p className="text-xs text-gray-500">{t.employees.newEmployees}</p></div>
            <div onClick={() => { setCardFilter(cardFilter === 'inactive' ? null : 'inactive'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'inactive' ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'}`}><TrendingDown className="w-5 h-5 text-red-500 mb-2" /><p className="text-2xl font-bold text-red-600">{dynamicStats.inactive}</p><p className="text-xs text-gray-500">{t.employees.inactive}</p></div>
            <div onClick={() => { setCardFilter(cardFilter === 'managers' ? null : 'managers'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'managers' ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'}`}><Briefcase className="w-5 h-5 text-indigo-500 mb-2" /><p className="text-2xl font-bold text-indigo-600">{dynamicStats.managers}</p><p className="text-xs text-gray-500">{t.employees.managers}</p></div>
            <div onClick={() => { setCardFilter(cardFilter === 'on_leave' ? null : 'on_leave'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'on_leave' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'}`}><Palmtree className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{dynamicStats.on_leave}</p><p className="text-xs text-gray-500">{t.employees.onLeave}</p></div>
            <div onClick={() => { setCardFilter(cardFilter === 'female' ? null : 'female'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'female' ? 'border-pink-300 ring-2 ring-pink-100' : 'border-gray-100'}`}><span className="text-sm font-bold text-pink-500 block mb-2">♀</span><p className="text-2xl font-bold text-pink-600">{dynamicStats.female}</p><p className="text-xs text-gray-500">{t.employees.women}</p></div>
          </div>
        )}

        {activeTab === 'orgchart' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Users className="w-5 h-5 text-primary-500 mb-2" /><p className="text-2xl font-bold text-gray-900">{dynamicStats.total}</p><p className="text-xs text-gray-500">{t.employees.collaborators}</p></div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Building2 className="w-5 h-5 text-purple-500 mb-2" /><p className="text-2xl font-bold text-purple-600">{departments.length}</p><p className="text-xs text-gray-500">{t.employees.units}</p></div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Briefcase className="w-5 h-5 text-indigo-500 mb-2" /><p className="text-2xl font-bold text-indigo-600">{dynamicStats.managers}</p><p className="text-xs text-gray-500">{t.employees.managers}</p></div>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Palmtree className="w-5 h-5 text-primary-500 mb-2" /><p className="text-2xl font-bold text-gray-900">{leaveStats.total}</p><p className="text-xs text-gray-500">{t.employees.leaveRequests.totalRequests}</p></div>
            <div onClick={() => setLeaveStatusFilter('pending')} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${leaveStatusFilter === 'pending' ? 'border-yellow-300 ring-2 ring-yellow-100' : 'border-gray-100'}`}><Clock className="w-5 h-5 text-yellow-500 mb-2" /><p className="text-2xl font-bold text-yellow-600">{leaveStats.pending}</p><p className="text-xs text-gray-500">{t.employees.leaveRequests.pending}</p></div>
            <div onClick={() => setLeaveStatusFilter('approved')} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${leaveStatusFilter === 'approved' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'}`}><CheckCircle className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{leaveStats.approved}</p><p className="text-xs text-gray-500">{t.employees.leaveRequests.approved}</p></div>
            <div onClick={() => setLeaveStatusFilter('rejected')} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${leaveStatusFilter === 'rejected' ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'}`}><XCircle className="w-5 h-5 text-red-500 mb-2" /><p className="text-2xl font-bold text-red-600">{leaveStats.rejected}</p><p className="text-xs text-gray-500">{t.employees.leaveRequests.rejected}</p></div>
          </div>
        )}

        {activeTab === 'invitations' && invitationStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Users className="w-5 h-5 text-primary-500 mb-2" /><p className="text-2xl font-bold text-gray-900">{invitationStats.total_employees}</p><p className="text-xs text-gray-500">{t.employees.invitations.total}</p></div>
            <div onClick={() => setInvitationFilter(invitationFilter === 'not_invited' ? 'all' : 'not_invited')} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${invitationFilter === 'not_invited' ? 'border-gray-400 ring-2 ring-gray-100' : 'border-gray-100'}`}><UserX className="w-5 h-5 text-gray-400 mb-2" /><p className="text-2xl font-bold text-gray-600">{invitationStats.not_invited}</p><p className="text-xs text-gray-500">{t.employees.invitations.notInvited}</p></div>
            <div onClick={() => setInvitationFilter(invitationFilter === 'pending' ? 'all' : 'pending')} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${invitationFilter === 'pending' ? 'border-yellow-300 ring-2 ring-yellow-100' : 'border-gray-100'}`}><Clock className="w-5 h-5 text-yellow-500 mb-2" /><p className="text-2xl font-bold text-yellow-600">{invitationStats.pending}</p><p className="text-xs text-gray-500">{t.employees.invitations.pending}</p></div>
            <div onClick={() => setInvitationFilter(invitationFilter === 'accepted' ? 'all' : 'accepted')} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${invitationFilter === 'accepted' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'}`}><UserCheck className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{invitationStats.accepted}</p><p className="text-xs text-gray-500">{t.employees.invitations.accepted}</p></div>
          </div>
        )}

        {/* Card filter indicator */}
        {cardFilter && activeTab === 'employees' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700 mb-4 w-fit">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium">{cardFilterLabels[cardFilter]}</span>
            <span className="text-primary-500">({cardFilter === 'active' ? dynamicStats.active : cardFilter === 'inactive' ? dynamicStats.inactive : cardFilter === 'on_leave' ? dynamicStats.on_leave : cardFilter === 'managers' ? dynamicStats.managers : cardFilter === 'female' ? dynamicStats.female : cardFilter === 'new_this_month' ? dynamicStats.new_this_month : displayedEmployees.length})</span>
            <button onClick={() => setCardFilter(null)} className="ml-1 p-0.5 hover:bg-primary-100 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* ============================================ */}
        {/* Tab: Documents (NEW) */}
        {/* ============================================ */}
        {activeTab === 'documents' && (
          <HRDocumentsTab onOpenEmployeeProfile={handleOpenEmployeeProfile} />
        )}

        {/* ============================================ */}
        {/* Tab: Gestion des Départements */}
        {/* ============================================ */}
        {activeTab === 'departments' && (
          <DepartmentManagementTab subsidiaryTenantId={selectedTenantId ?? undefined} />
        )}

        {/* ============================================ */}
        {/* Tab: Organigramme Pyramidal */}
        {/* ============================================ */}
        {activeTab === 'orgchart' && (
          <div className="space-y-4">
            {/* Barre de contrôles — sticky sur mobile */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 sticky top-0 z-20">
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <div className="flex-1 relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder={`${t.common.search}...`} value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                    <button onClick={() => setOrgZoom(z => Math.max(30, z - 10))} className="p-1 hover:bg-gray-200 rounded"><ZoomOut className="w-4 h-4 text-gray-600" /></button>
                    <span className="text-xs text-gray-600 w-9 text-center">{orgZoom}%</span>
                    <button onClick={() => setOrgZoom(z => Math.min(150, z + 10))} className="p-1 hover:bg-gray-200 rounded"><ZoomIn className="w-4 h-4 text-gray-600" /></button>
                  </div>
                  <button onClick={expandAllNodes} className="flex items-center px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Maximize2 className="w-3.5 h-3.5 mr-1" />{t.employees.orgchart.expand}</button>
                  <button onClick={collapseAllNodes} className="flex items-center px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Minimize2 className="w-3.5 h-3.5 mr-1" />{t.employees.orgchart.collapse}</button>
                  <button onClick={() => { setOrgData(null); fetchOrgChart(); }} className="flex items-center px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><RefreshCw className={`w-3.5 h-3.5 mr-1 ${orgLoading ? 'animate-spin' : ''}`} />{t.employees.orgchart.refresh}</button>
                </div>
              </div>
              {orgData && <p className="text-xs text-gray-400 mt-2">{countDescendants(orgData)} {t.employees.orgchart.touchHint}</p>}
            </div>

            {/* Conteneur scrollable avec support pinch-to-zoom */}
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto overflow-y-hidden w-full"
              style={{ minHeight: 400, touchAction: 'pan-x pan-y' }}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const ratio = dist / lastPinchDistRef.current;
                  lastPinchDistRef.current = dist;
                  setOrgZoom(z => Math.min(150, Math.max(30, Math.round(z * ratio))));
                }
              }}
              onTouchEnd={() => { lastPinchDistRef.current = null; }}
            >
              {orgLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
                    <p className="text-gray-500">{t.employees.orgchart.building}</p>
                  </div>
                </div>
              ) : orgData ? (
                <>
                  {/* Hint scroll mobile */}
                  <div className="org-mobile-hint items-center justify-center gap-2 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    <span>←</span>
                    <span>{t.employees.orgchart.dragToNavigate}</span>
                    <span>→</span>
                  </div>
                  <div style={{ transform: `scale(${orgZoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s' }}>
                    <div className="org-tree">
                      <ul>
                        <OrgTreeVisual node={orgData} expanded={expandedNodes} onToggle={toggleOrgNode} onSelectEmployee={handleOrgSelectEmployee} />
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-20 text-center">
                  <div>
                    <Network className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    {false ? (
                      <>
                        <p className="text-gray-500 mb-2 font-medium">{t.employees.orgchart.notAvailable}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-500 mb-2">{t.employees.orgchart.noData}</p>
                        <p className="text-sm text-gray-400">{t.employees.orgchart.checkDepartments}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Légende */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">{t.employees.orgchart.legend}</p>
              <div className="flex flex-wrap gap-3">
                {([
                  { label: 'Présidence',                key: 'president'          },
                  { label: 'Vice-Présidence',           key: 'vice_president'     },
                  { label: 'Direction Générale',        key: 'dg'                 },
                  { label: 'Dir. Générale Adjointe',    key: 'dga'                },
                  { label: 'Direction Centrale',        key: 'direction_centrale' },
                  { label: 'Direction',                 key: 'direction'          },
                  { label: 'Département',               key: 'departement'        },
                  { label: 'Service',                   key: 'service'            },
                ] as { label: string; key: UnitStyleKey }[]).map(({ label, key }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${UNIT_TYPE_STYLES[key].avatar}`} />
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-dashed border-orange-400 bg-orange-50" />
                  <span className="text-xs text-orange-600">{t.employees.orgchart.vacantPosition}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Employees */}
        {activeTab === 'employees' && (
          <>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder={t.employees.searchByNameEmailPosition} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" /></div>
                <div className="flex gap-3 flex-wrap">
                  <CustomSelect
                    value={selectedDepartment}
                    onChange={v => { setSelectedDepartment(v); setCurrentPage(1); }}
                    options={[
                      { value: 'Tous', label: t.employees.allDepartments },
                      ...departments.map(dept => ({ value: dept.name, label: dept.parent_id ? `  ↳ ${dept.name}` : dept.name })),
                    ]}
                    className="min-w-[150px]"
                  />
                  <CustomSelect
                    value={selectedLocation}
                    onChange={v => { setSelectedLocation(v); setCurrentPage(1); }}
                    options={locations.map(loc => ({ value: loc, label: loc === 'Tous' ? t.employees.allLocations : loc }))}
                    className="min-w-[130px]"
                  />
                  {!isReadOnly && <button onClick={() => setShowAddModal(true)} className="flex items-center px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />{t.employees.add}</button>}
                  <button onClick={handleExport} className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"><Download className="w-4 h-4 mr-2" />{t.common.export}</button>
                </div>
              </div>
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {/* Barre d'actions groupées */}
                {someSelected && (
                  <div className="mb-3 flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                    <span className="text-sm font-medium text-primary-700">{selectedIds.size} {selectedIds.size > 1 ? t.employees.selectedPlural : t.employees.selected}</span>
                    <div className="h-5 w-px bg-primary-200" />
                    <button onClick={handleBulkExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <Download className="w-3.5 h-3.5" />{t.common.export}
                    </button>
                    <div className="relative group">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <UserX className="w-3.5 h-3.5" />{t.employees.bulkActions.changeStatus}<ChevronDown className="w-3 h-3 ml-0.5" />
                      </button>
                      <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 hidden group-hover:block">
                        <button onClick={() => handleBulkStatusChange('active')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />{t.employees.active}</button>
                        <button onClick={() => handleBulkStatusChange('inactive')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400" />{t.employees.inactive}</button>
                        <button onClick={() => handleBulkStatusChange('suspended')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" />{t.employees.suspended}</button>
                        <button onClick={() => handleBulkStatusChange('terminated')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />{t.employees.terminated}</button>
                      </div>
                    </div>
                    {!isReadOnly && <button onClick={handleBulkDelete} disabled={bulkActionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" />{t.common.delete}</button>}
                    <div className="flex-1" />
                    <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    {bulkActionLoading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {displayedEmployees.length === 0 ? (
                    isGlobalDashboardMode && groupContext?.is_group ? (
                      <div className="p-12 text-center"><Users className="w-12 h-12 mx-auto mb-4 text-purple-300" /><p className="text-gray-700 mb-2 font-medium">{t.employees.groupView}</p><p className="text-sm text-gray-400 mb-4">{t.employees.groupViewDescription}</p></div>
                    ) : (
                      <div className="p-12 text-center"><Users className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p className="text-gray-500 mb-4">{t.employees.noEmployeeFound}</p><button onClick={loadAllData} className="flex items-center mx-auto px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg"><RefreshCw className="w-4 h-4 mr-2" />{t.employees.refresh}</button></div>
                    )
                  ) : (
                    <div className="w-full overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="w-10 px-3 py-3">
                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                          </th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">{t.common.employee}</th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">{t.common.department}</th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">{t.employees.location}</th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">{t.common.status}</th>
                          <th className="text-right px-5 py-3 text-sm font-semibold text-gray-600">{t.common.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedEmployees.map((employee) => (
                          <tr key={employee.id} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(employee.id) ? 'bg-primary-50/50' : selectedEmployee?.id === employee.id ? 'bg-primary-50' : ''}`} onClick={() => setSelectedEmployee(employee)}>
                            <td className="w-10 px-3 py-4">
                              <input type="checkbox" checked={selectedIds.has(employee.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(employee.id); }} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                            </td>
                            <td className="px-5 py-4"><div className="flex items-center"><div className="relative">{employee.photo_url ? (<img src={employee.photo_url} alt={`${employee.first_name} ${employee.last_name}`} className="w-10 h-10 rounded-full object-cover" />) : (<div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{getInitials(employee.first_name, employee.last_name)}</div>)}{employee.status?.toLowerCase() === 'on_leave' && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><Palmtree className="w-2.5 h-2.5 text-white" /></div>}</div><div className="ml-3"><div className="flex items-center"><p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>{employee.is_manager && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Mgr</span>}</div><p className="text-sm text-gray-500">{employee.position || employee.job_title || '-'}</p></div></div></td>
                            <td className="px-5 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{employee.department_name || '-'}</span></td>
                            <td className="px-5 py-4 text-sm text-gray-600">{employee.location || employee.site || '-'}</td>
                            <td className="px-5 py-4"><div className="flex items-center gap-1">{getStatusBadge(employee.status)}{employee.hire_date && (new Date().getTime() - new Date(employee.hire_date).getTime()) < 30 * 24 * 60 * 60 * 1000 && <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">{t.employees.new}</span>}</div></td>
                            <td className="px-5 py-4 text-right"><div className="flex items-center justify-end gap-1">{!isReadOnly && <button onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setShowEditModal(true); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4" /></button>}<button onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setShowViewModal(true); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4" /></button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                  {totalPages > 1 && (<div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between"><p className="text-sm text-gray-500">{t.employees.page} {currentPage}/{totalPages} • {totalEmployees} {t.employees.employees}</p><div className="flex gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">{t.employees.previous}</button><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">{t.employees.next}</button></div></div>)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit sticky top-6">
                {selectedEmployee ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="relative inline-block">{selectedEmployee.photo_url ? (<img src={selectedEmployee.photo_url} alt={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`} className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-primary-100" />) : (<div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">{getInitials(selectedEmployee.first_name, selectedEmployee.last_name)}</div>)}{selectedEmployee.status?.toLowerCase() === 'on_leave' && <div className="absolute bottom-2 right-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"><Palmtree className="w-3.5 h-3.5 text-white" /></div>}</div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                      <p className="text-sm text-gray-500">{selectedEmployee.position || selectedEmployee.job_title || '-'}</p>
                      <div className="flex items-center justify-center gap-2 mt-2">{getStatusBadge(selectedEmployee.status)}{selectedEmployee.is_manager && <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Manager</span>}</div>
                    </div>
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center text-sm text-gray-600"><Mail className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.email}</div>
                      {selectedEmployee.phone && <div className="flex items-center text-sm text-gray-600"><Phone className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.phone}</div>}
                      {(selectedEmployee.location || selectedEmployee.site) && <div className="flex items-center text-sm text-gray-600"><MapPin className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.location || selectedEmployee.site}</div>}
                      {selectedEmployee.department_name && <div className="flex items-center text-sm text-gray-600"><Building2 className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.department_name}</div>}
                      <div className="flex items-center text-sm text-gray-600"><Calendar className="w-4 h-4 mr-3 text-gray-400" />{t.employees.since} {formatDate(selectedEmployee.hire_date)}</div>
                    </div>
                    <div className="pt-4 border-t border-gray-100"><p className="text-sm text-gray-500 mb-2">{t.employees.contract}</p><p className="font-medium text-gray-900">{selectedEmployee.contract_type?.toUpperCase() || '-'}</p></div>
                    <div className="flex gap-2 mt-6"><button onClick={() => setShowViewModal(true)} className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Eye className="w-4 h-4 mr-2" />{t.employees.profile}</button>{!isReadOnly && <button onClick={() => setShowEditModal(true)} className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"><Edit2 className="w-4 h-4" /></button>}</div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-12"><User className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>{t.employees.selectEmployee}</p></div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab: Leaves */}
        {activeTab === 'leaves' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{t.employees.leaveRequests.title}{leaveStatusFilter !== 'all' && <span className="ml-2 text-sm font-normal text-gray-500">({leaveStatusFilter === 'pending' ? t.employees.leaveRequests.pending : leaveStatusFilter === 'approved' ? t.employees.leaveRequests.approved : t.employees.leaveRequests.rejected})</span>}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={fetchLeaveRequests} className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"><RefreshCw className={`w-4 h-4 mr-2 ${isLoadingLeaves ? 'animate-spin' : ''}`} />{t.employees.refresh}</button>
                    <div>
                      <button
                        ref={leaveFilterBtnRef}
                        onClick={() => {
                          if (!showLeaveFilter && leaveFilterBtnRef.current) {
                            const r = leaveFilterBtnRef.current.getBoundingClientRect();
                            setLeaveFilterPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                          }
                          setShowLeaveFilter(!showLeaveFilter);
                        }}
                        className={`flex items-center px-3 py-1.5 text-sm rounded-lg ${leaveStatusFilter !== 'all' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        <Filter className="w-4 h-4 mr-2" />{t.common.filter}<ChevronDown className="w-4 h-4 ml-1" />
                      </button>
                      {showLeaveFilter && portalMounted && createPortal(
                        <>
                          <div className="fixed inset-0 z-[9998]" onClick={() => setShowLeaveFilter(false)} />
                          <div
                            className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
                            style={{ top: `${leaveFilterPos.top}px`, right: `${leaveFilterPos.right}px` }}
                          >
                            <button onClick={() => { setLeaveStatusFilter('all'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'all' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}>{t.employees.leaveRequests.all}</button>
                            <button onClick={() => { setLeaveStatusFilter('pending'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'pending' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>{t.employees.leaveRequests.pending} ({leaveStats.pending})</button>
                            <button onClick={() => { setLeaveStatusFilter('approved'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'approved' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>{t.employees.leaveRequests.approved} ({leaveStats.approved})</button>
                            <button onClick={() => { setLeaveStatusFilter('rejected'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'rejected' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>{t.employees.leaveRequests.rejected} ({leaveStats.rejected})</button>
                          </div>
                        </>,
                        document.body
                      )}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {isLoadingLeaves ? (<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" /></div>) : filteredLeaveRequests.length === 0 ? (<div className="p-8 text-center text-gray-500"><Palmtree className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>{t.employees.leaveRequests.noRequest}</p></div>) : (
                    filteredLeaveRequests.map((leave) => (
                      <div key={leave.id} className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setSelectedLeaveRequest(leave); setShowLeaveModal(true); }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{leave.employee_name ? leave.employee_name.split(' ').map(n => n[0]).join('') : '?'}</div><div className="ml-3"><p className="font-medium text-gray-900">{leave.employee_name || 'Inconnu'}</p><p className="text-sm text-gray-500">{leave.leave_type_name || 'Congé'}</p></div></div>
                          <div className="text-right"><p className="text-sm font-medium text-gray-900">{leave.days_requested} jour{leave.days_requested > 1 ? 's' : ''}</p><p className="text-xs text-gray-500">{formatDate(leave.start_date)} → {formatDate(leave.end_date)}</p></div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${leave.status === 'approved' ? 'bg-green-100 text-green-700' : leave.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{leave.status === 'approved' ? t.employees.leaveRequests.approvedStatus : leave.status === 'pending' ? t.employees.leaveRequests.pendingStatus : leave.status === 'rejected' ? t.employees.leaveRequests.rejectedStatus : leave.status}</span>
                          {leave.status === 'pending' && (<div className="flex gap-2" onClick={(e) => e.stopPropagation()}><button onClick={(e) => { e.stopPropagation(); handleApproveLeave(leave.id); }} className="flex items-center px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600"><CheckCircle className="w-3.5 h-3.5 mr-1" />{t.employees.leaveRequests.approve}</button><button onClick={(e) => { e.stopPropagation(); setSelectedLeaveRequest(leave); setShowLeaveModal(true); }} className="flex items-center px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"><XCircle className="w-3.5 h-3.5 mr-1" />{t.employees.leaveRequests.reject}</button></div>)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">{t.employees.leaveRequests.summary}</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600">{t.employees.leaveRequests.onLeave}</span><span className="font-semibold text-green-600">{stats?.on_leave || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('pending')}><span className="text-sm text-gray-600">{t.employees.leaveRequests.pending}</span><span className="font-semibold text-yellow-600">{leaveStats.pending}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('approved')}><span className="text-sm text-gray-600">{t.employees.leaveRequests.approved}</span><span className="font-semibold text-primary-600">{leaveStats.approved}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('rejected')}><span className="text-sm text-gray-600">{t.employees.leaveRequests.rejected}</span><span className="font-semibold text-red-600">{leaveStats.rejected}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Invitations */}
        {activeTab === 'invitations' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder={`${t.common.search}...`} value={invitationSearch} onChange={(e) => setInvitationSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" /></div>
                  <CustomSelect
                    value={invitationFilter}
                    onChange={v => setInvitationFilter(v)}
                    options={[
                      { value: 'all', label: t.common.all },
                      { value: 'not_invited', label: t.employees.invitations.notInvited },
                      { value: 'pending', label: t.employees.invitations.pending },
                      { value: 'accepted', label: t.employees.invitations.accepted },
                    ]}
                    className="min-w-[140px]"
                  />
                  <button onClick={fetchInvitations} className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"><RefreshCw className={`w-4 h-4 mr-2 ${isLoadingInvitations ? 'animate-spin' : ''}`} />{t.employees.refresh}</button>
                </div>
              </div>
              {/* Barre d'actions groupées — Invitations */}
              {someInvSelected && (
                <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-primary-700">{selectedInvIds.size} {selectedInvIds.size > 1 ? t.employees.selectedPlural : t.employees.selected}</span>
                  <div className="h-5 w-px bg-primary-200" />
                  {!isReadOnly && <button onClick={handleBulkInvite} disabled={bulkInvLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors">
                    <Send className="w-3.5 h-3.5" />{t.employees.invitations.inviteResend}
                  </button>}
                  <button onClick={handleBulkExportInv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-3.5 h-3.5" />{t.common.export}
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => setSelectedInvIds(new Set())} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  {bulkInvLoading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{t.employees.invitations.title} ({invitations.length})</h3>
                  {invitations.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={allInvSelected} onChange={toggleSelectAllInv} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                      {t.employees.invitations.selectAll}
                    </label>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {isLoadingInvitations ? (<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" /></div>) : invitations.length === 0 ? (<div className="p-8 text-center text-gray-500"><Send className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>{t.employees.invitations.noInvitation}</p></div>) : (
                    invitations.map((inv) => (
                      <div key={inv.id} className={`px-5 py-4 hover:bg-gray-50 transition-colors ${selectedInvIds.has(inv.id) ? 'bg-primary-50/50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input type="checkbox" checked={selectedInvIds.has(inv.id)} onChange={() => toggleSelectInv(inv.id)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer mr-3 flex-shrink-0" />
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${inv.invitation_status === 'accepted' ? 'bg-green-100 text-green-700' : inv.invitation_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{getInitials(inv.first_name, inv.last_name)}</div><div className="ml-3"><p className="font-medium text-gray-900">{inv.first_name} {inv.last_name}</p><p className="text-sm text-gray-500">{inv.email}</p></div></div>
                          <div className="flex items-center gap-3">
                            {getInvitationStatusBadge(inv.invitation_status)}
                            {inv.invitation_status === 'not_invited' && !isReadOnly && (<button onClick={() => handleSendInvitation(inv)} disabled={sendingInvitation === inv.id} className="flex items-center px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50">{sendingInvitation === inv.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}{t.employees.invitations.invite}</button>)}
                            {inv.invitation_status === 'pending' && !isReadOnly && (<button onClick={() => handleResendInvitation(inv)} disabled={sendingInvitation === inv.id} className="flex items-center px-3 py-1.5 bg-yellow-500 text-white text-xs font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50">{sendingInvitation === inv.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}{t.employees.invitations.resend}</button>)}
                          </div>
                        </div>
                        <div className="mt-2 ml-[66px] flex items-center gap-4 text-xs text-gray-500">{inv.job_title && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{inv.job_title}</span>}{inv.department_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{inv.department_name}</span>}{inv.invitation_sent_at && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{t.employees.invitations.invitedOn} {formatDateTime(inv.invitation_sent_at)}</span>}{inv.last_login && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />{t.employees.invitations.connectedOn} {formatDateTime(inv.last_login)}</span>}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">{t.employees.leaveRequests.summary}</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('all')}><span className="text-sm text-gray-600">{t.common.total}</span><span className="font-semibold text-gray-900">{invitationStats?.total_employees || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('not_invited')}><span className="text-sm text-gray-600 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />{t.employees.invitations.notInvited}</span><span className="font-semibold text-gray-600">{invitationStats?.not_invited || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('pending')}><span className="text-sm text-gray-600 flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" />{t.employees.invitations.pending}</span><span className="font-semibold text-yellow-600">{invitationStats?.pending || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('accepted')}><span className="text-sm text-gray-600 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />{t.employees.invitations.accepted}</span><span className="font-semibold text-green-600">{invitationStats?.accepted || 0}</span></div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{t.employees.invitations.howItWorks}</h4>
                <ul className="text-sm text-blue-800 space-y-2"><li className="flex items-start gap-2"><span className="text-blue-500">1.</span>{t.employees.invitations.step1}</li><li className="flex items-start gap-2"><span className="text-blue-500">2.</span>{t.employees.invitations.step2}</li><li className="flex items-start gap-2"><span className="text-blue-500">3.</span>{t.employees.invitations.step3}</li></ul>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Tab: Sanctions */}
        {/* ============================================ */}
        {activeTab === 'sanctions' && (
          <SanctionsTab />
        )}

        {/* ============================================ */}
        {/* Tab: Import */}
        {/* ============================================ */}
        {activeTab === 'import' && (
          isReadOnly
            ? <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700">{t.employees.importDisabledReadOnly}</div>
            : <ImportEmployeesTab onImportDone={handleSuccess} />
        )}

        {/* ============================================ */}
        {/* Tab: Absences / Retards */}
        {/* ============================================ */}
        {activeTab === 'absences' && (
          <AbsencesTab employeesList={employees} subsidiaryTenantId={selectedTenantId ?? undefined} />
        )}

        {/* ============================================ */}
        {/* Tab: Formations */}
        {/* ============================================ */}
        {activeTab === 'formations' && (
          <FormationsTab employeesList={employees} />
        )}

        {/* ============================================ */}
        {/* Tab: Mobilité Interne */}
        {/* ============================================ */}
        {activeTab === 'mobility' && (
          <div className="space-y-6">
            {mobilityLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              </div>
            ) : !mobilityData ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                <Network className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">{t.employees.mobility.dataNotAvailable}</p>
                <button onClick={fetchMobility} className="mt-4 text-sm text-primary-600 hover:underline">{t.employees.retry}</button>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <Users className="w-5 h-5 text-indigo-500 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{mobilityData.total_transfers}</p>
                    <p className="text-xs text-gray-500">{t.employees.mobility.totalTransfers}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <Clock className="w-5 h-5 text-yellow-500 mb-2" />
                    <p className="text-2xl font-bold text-yellow-600">{mobilityData.pending_transfers}</p>
                    <p className="text-xs text-gray-500">{t.employees.mobility.inProgress}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
                    <p className="text-2xl font-bold text-green-600">{mobilityData.completed_transfers}</p>
                    <p className="text-xs text-gray-500">{t.employees.mobility.completed}</p>
                  </div>
                </div>

                {/* Historique des transferts */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{t.employees.mobility.transferHistory}</h3>
                    <button onClick={fetchMobility} className="flex items-center text-sm text-gray-500 hover:text-gray-700"><RefreshCw className="w-4 h-4 mr-1" />{t.employees.refresh}</button>
                  </div>
                  {mobilityData.transfers.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      <Network className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>{t.employees.mobility.noTransfer}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.common.employee}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.employees.mobility.from}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.employees.mobility.to}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.common.date}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.common.status}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {mobilityData.transfers.map(tr => (
                            <tr key={tr.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  {tr.photo_url ? (
                                    <img src={tr.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold">
                                      {tr.employee_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                  )}
                                  <span className="text-sm font-medium text-gray-900">{tr.employee_name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{tr.from_subsidiary}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{tr.to_subsidiary}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{tr.transfer_date ? new Date(tr.transfer_date).toLocaleDateString('fr-FR') : '—'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  tr.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  tr.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{tr.status === 'completed' ? t.employees.mobility.completedStatus : tr.status === 'pending' ? t.employees.mobility.pendingStatus : tr.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {showLeaveFilter && <div className="fixed inset-0 z-0" onClick={() => setShowLeaveFilter(false)} />}
      {showViewModal && selectedEmployee && <EmployeeModal employee={selectedEmployee} onClose={() => setShowViewModal(false)} onEdit={!isReadOnly ? () => { setShowViewModal(false); setShowEditModal(true); } : undefined} isReadOnly={isReadOnly} />}
      {showAddModal && <AddModal onClose={() => setShowAddModal(false)} onSuccess={handleSuccess} />}
      {showEditModal && selectedEmployee && <EditEmployeeModal employee={selectedEmployee} onClose={() => setShowEditModal(false)} onSuccess={handleSuccess} />}
      {showLeaveModal && selectedLeaveRequest && <LeaveRequestModal request={{ id: selectedLeaveRequest.id, employee_id: selectedLeaveRequest.employee_id, employee_name: selectedLeaveRequest.employee_name || 'Employé', leave_type_id: selectedLeaveRequest.leave_type_id, leave_type_name: selectedLeaveRequest.leave_type_name || 'Congé', leave_type_code: selectedLeaveRequest.leave_type_code, start_date: selectedLeaveRequest.start_date, end_date: selectedLeaveRequest.end_date, days_requested: selectedLeaveRequest.days_requested, start_half_day: selectedLeaveRequest.start_half_day, end_half_day: selectedLeaveRequest.end_half_day, status: selectedLeaveRequest.status, reason: selectedLeaveRequest.reason, department: selectedLeaveRequest.department, job_title: selectedLeaveRequest.job_title, manager_name: selectedLeaveRequest.manager_name, leave_balance: selectedLeaveRequest.leave_balance, approved_by_name: selectedLeaveRequest.approved_by_name, approved_at: selectedLeaveRequest.approved_at, rejection_reason: selectedLeaveRequest.rejection_reason, created_at: selectedLeaveRequest.created_at }} onClose={() => { setShowLeaveModal(false); setSelectedLeaveRequest(null); }} onApprove={handleApproveLeave} onReject={handleRejectLeave} />}
      {tempPasswordData && <TempPasswordModal isOpen={showTempPasswordModal} onClose={() => { setShowTempPasswordModal(false); setTempPasswordData(null); }} employeeName={tempPasswordData.employeeName} email={tempPasswordData.email} tempPassword={tempPasswordData.tempPassword} emailSent={tempPasswordData.emailSent} />}
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
export default function EmployeesPage() {
  return (
    <Suspense>
      <EmployeesPageInner />
    </Suspense>
  );
}