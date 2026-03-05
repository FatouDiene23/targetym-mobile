'use client';

import Header from '@/components/Header';
import EmployeeModal from '@/components/EmployeeModal';
import AddModal from '@/components/AddModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';
import LeaveRequestModal from '@/components/LeaveRequestModal';
import HRDocumentsTab from '@/components/HRDocumentsTab';
import DepartmentManagementTab from '@/components/DepartmentManagementTab';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { employeesTips } from '@/config/pageTips';
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  Search, Plus, Mail, Phone, MapPin, Calendar, Building2, Download,
  Edit2, Eye, Users, UserCheck, UserPlus, TrendingDown,
  Palmtree, CheckCircle, XCircle, Filter, ChevronDown, Briefcase,
  User, Loader2, RefreshCw, X, Send, Clock, MailCheck, AlertCircle,
  Copy, Check, Maximize2, Minimize2, Network, ZoomIn, ZoomOut, FileText,
  Trash2, UserX, MoreHorizontal
} from 'lucide-react';
import { 
  getEmployees, getEmployeeStats, getDepartments, exportEmployeesToCSV,
  getLeaveRequests, approveLeaveRequest, rejectLeaveRequest,
  type Employee, type EmployeeStats, type Department, type LeaveRequest
} from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';

const locations = ['Tous', 'Abidjan', 'Dakar', 'Bamako', 'Ouagadougou', 'Conakry', 'Remote'];

// ============================================
// TYPES ORGANIGRAMME
// ============================================
interface OrgNode {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
  is_manager?: boolean;
  status?: string;
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
`;

// ============================================
// Couleurs par niveau hiérarchique
// ============================================
const levelStyles = [
  { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-800', avatar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', avatar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', avatar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800', avatar: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800', avatar: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-800', avatar: 'bg-pink-500', badge: 'bg-pink-100 text-pink-700' },
  { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700', avatar: 'bg-gray-500', badge: 'bg-gray-100 text-gray-600' },
];

function getLS(level: number) {
  return levelStyles[Math.min(level, levelStyles.length - 1)];
}

// ============================================
// Composant Carte Noeud
// ============================================
function OrgCard({ node, level, isExpanded, hasChildren, onToggle, onSelect }: {
  node: OrgNode; level: number; isExpanded: boolean; hasChildren: boolean;
  onToggle: () => void; onSelect?: () => void;
}) {
  const s = getLS(level);
  const initials = `${node.first_name?.[0] || ''}${node.last_name?.[0] || ''}`.toUpperCase();
  const isVirtual = node.id === 0;
  const childCount = node.children.length;

  return (
    <div className="relative group">
      <div
        className={`relative px-4 py-3 rounded-xl border-2 ${s.border} ${s.bg} shadow-sm hover:shadow-lg transition-all cursor-pointer min-w-[140px] max-w-[200px] ${node.is_manager ? 'ring-1 ring-offset-1 ring-opacity-30 ring-current' : ''}`}
        onClick={onSelect}
      >
        <div className="flex flex-col items-center text-center">
          {!isVirtual ? (
            <div className={`w-11 h-11 ${s.avatar} rounded-full flex items-center justify-center text-white font-bold text-sm mb-2 shadow-sm`}>
              {initials}
            </div>
          ) : (
            <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white mb-2 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <p className={`font-semibold text-xs leading-tight ${s.text}`}>
            {node.first_name} {node.last_name}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight truncate max-w-[170px]">
            {node.job_title || '-'}
          </p>
          {node.department_name && (
            <span className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium ${s.badge}`}>
              {node.department_name}
            </span>
          )}
          {hasChildren && (
            <span className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-gray-200 text-gray-600">
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
          {isExpanded ? (
            <span className="text-gray-500 text-xs font-bold leading-none">−</span>
          ) : (
            <span className="text-gray-500 text-xs font-bold leading-none">+</span>
          )}
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

  return (
    <li>
      <OrgCard
        node={node}
        level={level}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
        onToggle={() => onToggle(node.id)}
        onSelect={node.id !== 0 && onSelectEmployee ? () => onSelectEmployee(node.id) : undefined}
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

const API_URL = 'https://web-production-06c3.up.railway.app';

async function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' };
}

async function getInvitations(statusFilter?: string, search?: string): Promise<{ items: InvitationEmployee[], stats: InvitationStats }> {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') params.append('status_filter', statusFilter);
  if (search) params.append('search', search);
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
              <h3 className="text-lg font-semibold text-gray-900">{emailSent ? 'Invitation envoyée !' : 'Compte créé'}</h3>
              <p className="text-sm text-gray-500 mt-1">{emailSent ? `Un email a été envoyé à ${employeeName}` : `L\u0027email n\u0027a pas pu être envoyé.`}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="mb-3"><label className="text-xs text-gray-500">Email</label><p className="font-medium text-gray-900">{email}</p></div>
              <div>
                <label className="text-xs text-gray-500">Mot de passe temporaire</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-200 font-mono text-sm">{tempPassword}</code>
                  <button onClick={handleCopy} className={`p-2 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {!emailSent && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"><p className="text-sm text-yellow-800"><strong>Note :</strong> Transmettez ces identifiants à {employeeName} de manière sécurisée.</p></div>)}
            <button onClick={onClose} className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================
export default function EmployeesPage() {
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
  const [activeTab, setActiveTab] = useState<'employees' | 'leaves' | 'invitations' | 'orgchart' | 'documents' | 'departments'>('employees');
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

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  // Page Tour
  const { showTips, dismissTips, resetTips } = usePageTour('employees');

  // ============================================
  // ORGANIGRAMME LOGIC
  // ============================================
  const buildOrgTree = useCallback((emps: Employee[]): OrgNode | null => {
    const activeEmps = emps.filter(e => {
      const s = e.status?.toLowerCase();
      if (s === 'terminated') return false;
      const name = `${e.first_name} ${e.last_name}`.toLowerCase();
      const job = (e.position || e.job_title || '').toLowerCase();
      if (name.includes('admin') || job === 'administrateur') return false;
      return true;
    });
    const map = new Map<number, OrgNode>();
    activeEmps.forEach(emp => {
      map.set(emp.id, { id: emp.id, first_name: emp.first_name, last_name: emp.last_name, job_title: emp.position || emp.job_title, department_name: emp.department_name, is_manager: emp.is_manager, status: emp.status, children: [] });
    });
    const roots: OrgNode[] = [];
    activeEmps.forEach(emp => {
      const node = map.get(emp.id);
      if (!node) return;
      if (emp.manager_id && map.has(emp.manager_id)) { map.get(emp.manager_id)!.children.push(node); }
      else { roots.push(node); }
    });
    const sortC = (node: OrgNode) => {
      node.children.sort((a, b) => {
        const aHasKids = a.children.length > 0 ? 1 : 0;
        const bHasKids = b.children.length > 0 ? 1 : 0;
        if (aHasKids !== bHasKids) return bHasKids - aHasKids;
        if (a.is_manager && !b.is_manager) return -1;
        if (!a.is_manager && b.is_manager) return 1;
        return a.last_name.localeCompare(b.last_name);
      });
      node.children.forEach(sortC);
    };
    if (roots.length === 1) { sortC(roots[0]); return roots[0]; }
    if (roots.length > 1) {
      roots.sort((a, b) => {
        const aHasKids = a.children.length > 0 ? 1 : 0;
        const bHasKids = b.children.length > 0 ? 1 : 0;
        if (aHasKids !== bHasKids) return bHasKids - aHasKids;
        if (a.is_manager && !b.is_manager) return -1;
        if (!a.is_manager && b.is_manager) return 1;
        return a.last_name.localeCompare(b.last_name);
      });
      roots.forEach(sortC);
      return { id: 0, first_name: 'Direction', last_name: 'Générale', job_title: 'Organisation', children: roots };
    }
    return null;
  }, []);

  const fetchOrgChart = useCallback(async () => {
    setOrgLoading(true);
    try {
      const response = await getEmployees({ page: 1, page_size: 500 });
      const tree = buildOrgTree(response.items || []);
      setOrgData(tree);
      if (tree) {
        const ids = new Set<number>();
        ids.add(tree.id);
        tree.children.forEach(c => {
          ids.add(c.id);
          if (c.children.length > 0) {
            c.children.forEach(gc => ids.add(gc.id));
          }
        });
        setExpandedNodes(ids);
      }
    } catch (err) { console.error('Error building org chart:', err); }
    finally { setOrgLoading(false); }
  }, [buildOrgTree]);

  const toggleOrgNode = (id: number) => { setExpandedNodes(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const expandAllNodes = () => { if (!orgData) return; const ids = new Set<number>(); const t = (n: OrgNode) => { ids.add(n.id); n.children.forEach(t); }; t(orgData); setExpandedNodes(ids); };
  const collapseAllNodes = () => { if (orgData) setExpandedNodes(new Set([orgData.id])); };
  const countDescendants = (node: OrgNode): number => { let c = node.id === 0 ? 0 : 1; node.children.forEach(ch => { c += countDescendants(ch); }); return c; };

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

  useEffect(() => { if (activeTab === 'orgchart' && !orgData && !orgLoading) fetchOrgChart(); }, [activeTab, orgData, orgLoading, fetchOrgChart]);

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
      const response = await getEmployees({ page: currentPage, page_size: 10, search: searchTerm || undefined, department_id: deptId });
      setEmployees(response.items || []); setTotalPages(response.total_pages || 1); setTotalEmployees(response.total || 0);
    } catch (err) { console.error(err); setEmployees([]); }
  };

  const fetchStats = async () => { try { const data = await getEmployeeStats(); setStats(data); } catch { setStats({ total: 0, active: 0, inactive: 0, on_leave: 0, by_department: {}, by_gender: {}, by_contract_type: {} }); } };
  const fetchDepartments = async (): Promise<Department[]> => { try { const data = await getDepartments(); setDepartments(data || []); departmentsRef.current = data || []; return data || []; } catch { setDepartments([]); return []; } };
  const fetchLeaveRequests = async () => { setIsLoadingLeaves(true); try { const response = await getLeaveRequests({ page_size: 100 }); setLeaveRequests(response.items || []); } catch { setLeaveRequests([]); } finally { setIsLoadingLeaves(false); } };
  const fetchInvitations = async () => { setIsLoadingInvitations(true); try { const data = await getInvitations(invitationFilter !== 'all' ? invitationFilter : undefined, invitationSearch || undefined); setInvitations(data.items || []); setInvitationStats(data.stats); } catch { setInvitations([]); } finally { setIsLoadingInvitations(false); } };

  const loadAllData = async () => {
    setIsLoading(true); setError(null);
    try { const depts = await fetchDepartments(); await fetchStats(); await fetchEmployees(depts); await fetchLeaveRequests(); await fetchInvitations(); }
    catch { setError('Erreur lors du chargement'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (!isInitialized.current) { isInitialized.current = true; loadAllData(); } }, []);
  useEffect(() => { if (isInitialized.current && !isLoading) { const timer = setTimeout(() => { fetchEmployees(departmentsRef.current); }, 300); return () => clearTimeout(timer); } }, [searchTerm, selectedDepartment, currentPage]);
  useEffect(() => { if (isInitialized.current && activeTab === 'invitations') { const timer = setTimeout(() => { fetchInvitations(); }, 300); return () => clearTimeout(timer); } }, [invitationFilter, invitationSearch, activeTab]);

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
    active: 'Actifs', inactive: 'Inactifs', on_leave: 'En congés',
    managers: 'Managers', female: 'Femmes', new_this_month: 'Nouveaux ce mois'
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
    const statusLabels: Record<string, string> = { active: 'Actif', inactive: 'Inactif', terminated: 'Terminé', suspended: 'Suspendu' };
    setConfirmDialog({
      isOpen: true,
      title: 'Changement de statut',
      message: `Changer le statut de ${count} employé(s) en "${statusLabels[newStatus] || newStatus}" ?`,
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setBulkActionLoading(true);
        try {
          const token = localStorage.getItem('access_token');
          await Promise.all(Array.from(selectedIds).map(id =>
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app'}/api/employees/${id}`, {
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
      title: 'Suppression en masse',
      message: `Supprimer définitivement ${count} employé(s) ? Cette action est irréversible.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setBulkActionLoading(true);
        try {
          const token = localStorage.getItem('access_token');
          await Promise.all(Array.from(selectedIds).map(id =>
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app'}/api/employees/${id}`, {
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

  const handleBulkExport = () => {
    const selected = employees.filter(e => selectedIds.has(e.id));
    const headers = ['Prénom', 'Nom', 'Email', 'Département', 'Poste', 'Localisation', 'Statut', 'Contrat'];
    const rows = selected.map(e => [
      e.first_name, e.last_name, e.email, e.department_name || '',
      e.position || e.job_title || '', e.location || e.site || '',
      e.status, e.contract_type || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `employes_selection_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
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
      case 'active': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Actif</span>;
      case 'inactive': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Inactif</span>;
      case 'on_leave': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">En congés</span>;
      case 'terminated': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Terminé</span>;
      case 'probation': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Période d&apos;essai</span>;
      case 'suspended': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Suspendu</span>;
      default: return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Acceptée</span>;
      case 'pending': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><Clock className="w-3 h-3" />En attente</span>;
      case 'not_invited': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" />Non invité</span>;
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
    if (count === 0) { alert('Aucun employé à inviter/relancer dans la sélection.'); return; }
    if (!confirm(`Envoyer ${toInvite.length} invitation(s) et ${toResend.length} relance(s) ?`)) return;
    setBulkInvLoading(true);
    try {
      for (const inv of toInvite) { await sendInvitation(inv.id); }
      for (const inv of toResend) { await resendInvitation(inv.id); }
      setSelectedInvIds(new Set());
      await fetchInvitations();
    } catch (err) { console.error('Bulk invite failed', err); }
    setBulkInvLoading(false);
  };

  const handleBulkExportInv = () => {
    const selected = invitations.filter(i => selectedInvIds.has(i.id));
    const headers = ['Prénom', 'Nom', 'Email', 'Poste', 'Département', 'Statut', 'Invité le', 'Dernière connexion'];
    const statusLabels: Record<string, string> = { not_invited: 'Non invité', pending: 'En attente', accepted: 'Acceptée' };
    const rows = selected.map(i => [
      i.first_name, i.last_name, i.email, i.job_title || '', i.department_name || '',
      statusLabels[i.invitation_status] || i.invitation_status,
      i.invitation_sent_at ? formatDateTime(i.invitation_sent_at) : '', i.last_login ? formatDateTime(i.last_login) : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `invitations_selection_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExport = () => exportEmployeesToCSV(filteredEmployees);
  const handleSuccess = () => { loadAllData(); setSelectedEmployee(null); };
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
  if (isLoading) {
    return (<><Header title="Gestion du Personnel" subtitle="Administration RH, effectifs et congés" /><main className="flex-1 p-6 flex items-center justify-center"><div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" /><p className="text-gray-500">Chargement...</p></div></main></>);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: orgChartCSS }} />
      {showTips && (
        <PageTourTips
          tips={employeesTips}
          onDismiss={dismissTips}
          pageTitle="Gestion du Personnel"
        />
      )}
      <Header title="Gestion du Personnel" subtitle="Administration RH, effectifs et congés" />
      <main className="flex-1 p-6 overflow-auto">
        {error && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"><span className="text-red-700">{error}</span><button onClick={loadAllData} className="flex items-center text-red-600 hover:text-red-800"><RefreshCw className="w-4 h-4 mr-1" />Réessayer</button></div>)}

        {hasActiveFilter && (
          <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-700"><Filter className="w-4 h-4 inline mr-2" />Filtres : {selectedDepartment !== 'Tous' && <span className="ml-2 px-2 py-0.5 bg-blue-100 rounded">{selectedDepartment}</span>}{selectedLocation !== 'Tous' && <span className="ml-2 px-2 py-0.5 bg-blue-100 rounded">{selectedLocation}</span>}{searchTerm && <span className="ml-2 px-2 py-0.5 bg-blue-100 rounded">&quot;{searchTerm}&quot;</span>}{cardFilter && <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 rounded">{cardFilterLabels[cardFilter]}</span>}</span>
            <button onClick={() => { setSelectedDepartment('Tous'); setSelectedLocation('Tous'); setSearchTerm(''); setCardFilter(null); setCurrentPage(1); }} className="text-sm text-blue-600 hover:text-blue-800 flex items-center"><X className="w-4 h-4 mr-1" />Effacer</button>
          </div>
        )}

        {/* Stats — clickable cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div onClick={() => { setCardFilter(null); setActiveTab('employees'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${!cardFilter ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'}`}><Users className="w-5 h-5 text-blue-500 mb-2" /><p className="text-2xl font-bold text-gray-900">{dynamicStats.total}</p><p className="text-xs text-gray-500">Total</p></div>
          <div onClick={() => { setCardFilter(cardFilter === 'active' ? null : 'active'); setActiveTab('employees'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'active' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'}`}><UserCheck className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{dynamicStats.active}</p><p className="text-xs text-gray-500">Actifs</p></div>
          <div onClick={() => { setCardFilter(cardFilter === 'new_this_month' ? null : 'new_this_month'); setActiveTab('employees'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'new_this_month' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'}`}><UserPlus className="w-5 h-5 text-blue-500 mb-2" /><p className="text-2xl font-bold text-blue-600">{dynamicStats.new_this_month}</p><p className="text-xs text-gray-500">Nouveaux</p></div>
          <div onClick={() => { setCardFilter(cardFilter === 'inactive' ? null : 'inactive'); setActiveTab('employees'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'inactive' ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'}`}><TrendingDown className="w-5 h-5 text-red-500 mb-2" /><p className="text-2xl font-bold text-red-600">{dynamicStats.inactive}</p><p className="text-xs text-gray-500">Inactifs</p></div>
          <div onClick={() => { setActiveTab('departments'); setCardFilter(null); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${activeTab === 'departments' ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-100'}`}><Building2 className="w-5 h-5 text-purple-500 mb-2" /><p className="text-2xl font-bold text-purple-600">{departments.length}</p><p className="text-xs text-gray-500">Départements</p></div>
          <div onClick={() => { setCardFilter(cardFilter === 'managers' ? null : 'managers'); setActiveTab('employees'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'managers' ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'}`}><Briefcase className="w-5 h-5 text-indigo-500 mb-2" /><p className="text-2xl font-bold text-indigo-600">{dynamicStats.managers}</p><p className="text-xs text-gray-500">Managers</p></div>
          <div onClick={() => { setCardFilter(cardFilter === 'on_leave' ? null : 'on_leave'); setActiveTab('employees'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'on_leave' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'}`}><Palmtree className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{dynamicStats.on_leave}</p><p className="text-xs text-gray-500">En congés</p></div>
          <div onClick={() => { setCardFilter(cardFilter === 'female' ? null : 'female'); setActiveTab('employees'); }} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${cardFilter === 'female' ? 'border-pink-300 ring-2 ring-pink-100' : 'border-gray-100'}`}><span className="text-sm font-bold text-pink-500 block mb-2">♀</span><p className="text-2xl font-bold text-pink-600">{dynamicStats.female}</p><p className="text-xs text-gray-500">Femmes</p></div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button onClick={() => { setActiveTab('employees'); }} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'employees' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Users className="w-4 h-4 inline mr-2" />Annuaire</button>
            <button onClick={() => { setActiveTab('departments'); setCardFilter(null); }} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'departments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Building2 className="w-4 h-4 inline mr-2" />Départements</button>
            <button onClick={() => { setActiveTab('orgchart'); setCardFilter(null); }} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'orgchart' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Network className="w-4 h-4 inline mr-2" />Organigramme</button>
            <button onClick={() => { setActiveTab('documents'); setCardFilter(null); }} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><FileText className="w-4 h-4 inline mr-2" />Documents</button>
            <button onClick={() => { setActiveTab('leaves'); setCardFilter(null); }} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'leaves' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Palmtree className="w-4 h-4 inline mr-2" />Congés{leaveStats.pending > 0 && <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">{leaveStats.pending}</span>}</button>
            <button onClick={() => { setActiveTab('invitations'); setCardFilter(null); }} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'invitations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Send className="w-4 h-4 inline mr-2" />Invitations{invitationStats && invitationStats.pending > 0 && <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">{invitationStats.pending}</span>}</button>
          </div>

          {/* Card filter indicator */}
          {cardFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
              <Filter className="w-3.5 h-3.5" />
              <span className="font-medium">{cardFilterLabels[cardFilter]}</span>
              <span className="text-primary-500">({displayedEmployees.length})</span>
              <button onClick={() => setCardFilter(null)} className="ml-1 p-0.5 hover:bg-primary-100 rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>

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
          <DepartmentManagementTab />
        )}

        {/* ============================================ */}
        {/* Tab: Organigramme Pyramidal */}
        {/* ============================================ */}
        {activeTab === 'orgchart' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="Rechercher un collaborateur..." value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                    <button onClick={() => setOrgZoom(z => Math.max(30, z - 10))} className="p-1 hover:bg-gray-200 rounded"><ZoomOut className="w-4 h-4 text-gray-600" /></button>
                    <span className="text-xs text-gray-600 w-10 text-center">{orgZoom}%</span>
                    <button onClick={() => setOrgZoom(z => Math.min(150, z + 10))} className="p-1 hover:bg-gray-200 rounded"><ZoomIn className="w-4 h-4 text-gray-600" /></button>
                  </div>
                  <button onClick={expandAllNodes} className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Maximize2 className="w-4 h-4 mr-1.5" />Déplier</button>
                  <button onClick={collapseAllNodes} className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Minimize2 className="w-4 h-4 mr-1.5" />Replier</button>
                  <button onClick={() => { setOrgData(null); fetchOrgChart(); }} className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><RefreshCw className={`w-4 h-4 mr-1.5 ${orgLoading ? 'animate-spin' : ''}`} />Actualiser</button>
                </div>
              </div>
              {orgData && <p className="text-xs text-gray-400 mt-3">{countDescendants(orgData)} collaborateurs • Cliquez sur une carte pour voir le profil • +/− pour déplier/replier</p>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto" style={{ minHeight: 400 }}>
              {orgLoading ? (
                <div className="flex items-center justify-center py-20"><div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" /><p className="text-gray-500">Construction de l&apos;organigramme...</p></div></div>
              ) : orgData ? (
                <div style={{ transform: `scale(${orgZoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
                  <div className="org-tree">
                    <ul>
                      <OrgTreeVisual node={orgData} expanded={expandedNodes} onToggle={toggleOrgNode} onSelectEmployee={handleOrgSelectEmployee} />
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-center"><div><Network className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500 mb-2">Aucune donnée</p><p className="text-sm text-gray-400">Vérifiez les relations manager</p></div></div>
              )}
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Légende par niveau hiérarchique</p>
              <div className="flex flex-wrap gap-3">
                {['DG / Président', 'Vice-Président', 'Directeur', 'Responsable', 'Chef de service', 'Coordinateur', 'Collaborateur'].map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${levelStyles[Math.min(i, levelStyles.length - 1)].avatar}`} />
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Employees */}
        {activeTab === 'employees' && (
          <>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Rechercher par nom, email ou poste..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" /></div>
                <div className="flex gap-3 flex-wrap">
                  <select value={selectedDepartment} onChange={(e) => { setSelectedDepartment(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="Tous">Tous les départements</option>{departments.map(dept => <option key={dept.id} value={dept.name}>{dept.parent_id ? `  ↳ ${dept.name}` : dept.name}</option>)}</select>
                  <select value={selectedLocation} onChange={(e) => { setSelectedLocation(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm">{locations.map(loc => <option key={loc} value={loc}>{loc === 'Tous' ? 'Toutes les localisations' : loc}</option>)}</select>
                  <button onClick={() => setShowAddModal(true)} className="flex items-center px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Ajouter</button>
                  <button onClick={handleExport} className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"><Download className="w-4 h-4 mr-2" />Exporter</button>
                </div>
              </div>
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {/* Barre d'actions groupées */}
                {someSelected && (
                  <div className="mb-3 flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                    <span className="text-sm font-medium text-primary-700">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                    <div className="h-5 w-px bg-primary-200" />
                    <button onClick={handleBulkExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <Download className="w-3.5 h-3.5" />Exporter
                    </button>
                    <div className="relative group">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <UserX className="w-3.5 h-3.5" />Changer statut<ChevronDown className="w-3 h-3 ml-0.5" />
                      </button>
                      <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 hidden group-hover:block">
                        <button onClick={() => handleBulkStatusChange('active')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Actif</button>
                        <button onClick={() => handleBulkStatusChange('inactive')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400" />Inactif</button>
                        <button onClick={() => handleBulkStatusChange('suspended')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" />Suspendu</button>
                        <button onClick={() => handleBulkStatusChange('terminated')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />Terminé</button>
                      </div>
                    </div>
                    <button onClick={handleBulkDelete} disabled={bulkActionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />Supprimer
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    {bulkActionLoading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {displayedEmployees.length === 0 ? (
                    <div className="p-12 text-center"><Users className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p className="text-gray-500 mb-4">Aucun employé trouvé</p><button onClick={loadAllData} className="flex items-center mx-auto px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg"><RefreshCw className="w-4 h-4 mr-2" />Actualiser</button></div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="w-10 px-3 py-3">
                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                          </th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Employé</th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Département</th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Localisation</th>
                          <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Statut</th>
                          <th className="text-right px-5 py-3 text-sm font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedEmployees.map((employee) => (
                          <tr key={employee.id} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(employee.id) ? 'bg-primary-50/50' : selectedEmployee?.id === employee.id ? 'bg-primary-50' : ''}`} onClick={() => setSelectedEmployee(employee)}>
                            <td className="w-10 px-3 py-4">
                              <input type="checkbox" checked={selectedIds.has(employee.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(employee.id); }} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                            </td>
                            <td className="px-5 py-4"><div className="flex items-center"><div className="relative"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{getInitials(employee.first_name, employee.last_name)}</div>{employee.status?.toLowerCase() === 'on_leave' && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><Palmtree className="w-2.5 h-2.5 text-white" /></div>}</div><div className="ml-3"><div className="flex items-center"><p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>{employee.is_manager && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Mgr</span>}</div><p className="text-sm text-gray-500">{employee.position || employee.job_title || '-'}</p></div></div></td>
                            <td className="px-5 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{employee.department_name || '-'}</span></td>
                            <td className="px-5 py-4 text-sm text-gray-600">{employee.location || employee.site || '-'}</td>
                            <td className="px-5 py-4">{getStatusBadge(employee.status)}</td>
                            <td className="px-5 py-4 text-right"><div className="flex items-center justify-end gap-1"><button onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setShowEditModal(true); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setShowViewModal(true); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4" /></button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {totalPages > 1 && (<div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between"><p className="text-sm text-gray-500">Page {currentPage}/{totalPages} • {totalEmployees} employés</p><div className="flex gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Précédent</button><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Suivant</button></div></div>)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit sticky top-6">
                {selectedEmployee ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="relative inline-block"><div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">{getInitials(selectedEmployee.first_name, selectedEmployee.last_name)}</div>{selectedEmployee.status?.toLowerCase() === 'on_leave' && <div className="absolute bottom-2 right-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"><Palmtree className="w-3.5 h-3.5 text-white" /></div>}</div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                      <p className="text-sm text-gray-500">{selectedEmployee.position || selectedEmployee.job_title || '-'}</p>
                      <div className="flex items-center justify-center gap-2 mt-2">{getStatusBadge(selectedEmployee.status)}{selectedEmployee.is_manager && <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Manager</span>}</div>
                    </div>
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center text-sm text-gray-600"><Mail className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.email}</div>
                      {selectedEmployee.phone && <div className="flex items-center text-sm text-gray-600"><Phone className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.phone}</div>}
                      {(selectedEmployee.location || selectedEmployee.site) && <div className="flex items-center text-sm text-gray-600"><MapPin className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.location || selectedEmployee.site}</div>}
                      {selectedEmployee.department_name && <div className="flex items-center text-sm text-gray-600"><Building2 className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.department_name}</div>}
                      <div className="flex items-center text-sm text-gray-600"><Calendar className="w-4 h-4 mr-3 text-gray-400" />Depuis le {formatDate(selectedEmployee.hire_date)}</div>
                    </div>
                    <div className="pt-4 border-t border-gray-100"><p className="text-sm text-gray-500 mb-2">Contrat</p><p className="font-medium text-gray-900">{selectedEmployee.contract_type?.toUpperCase() || '-'}</p></div>
                    <div className="flex gap-2 mt-6"><button onClick={() => setShowViewModal(true)} className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Eye className="w-4 h-4 mr-2" />Profil</button><button onClick={() => setShowEditModal(true)} className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"><Edit2 className="w-4 h-4" /></button></div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-12"><User className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>Sélectionnez un employé</p></div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab: Leaves */}
        {activeTab === 'leaves' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Demandes de congés{leaveStatusFilter !== 'all' && <span className="ml-2 text-sm font-normal text-gray-500">({leaveStatusFilter === 'pending' ? 'En attente' : leaveStatusFilter === 'approved' ? 'Approuvées' : 'Refusées'})</span>}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={fetchLeaveRequests} className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"><RefreshCw className={`w-4 h-4 mr-2 ${isLoadingLeaves ? 'animate-spin' : ''}`} />Actualiser</button>
                    <div className="relative">
                      <button onClick={() => setShowLeaveFilter(!showLeaveFilter)} className={`flex items-center px-3 py-1.5 text-sm rounded-lg ${leaveStatusFilter !== 'all' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><Filter className="w-4 h-4 mr-2" />Filtrer<ChevronDown className="w-4 h-4 ml-1" /></button>
                      {showLeaveFilter && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button onClick={() => { setLeaveStatusFilter('all'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'all' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}>Toutes</button>
                          <button onClick={() => { setLeaveStatusFilter('pending'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'pending' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>En attente ({leaveStats.pending})</button>
                          <button onClick={() => { setLeaveStatusFilter('approved'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'approved' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>Approuvées ({leaveStats.approved})</button>
                          <button onClick={() => { setLeaveStatusFilter('rejected'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'rejected' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>Refusées ({leaveStats.rejected})</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {isLoadingLeaves ? (<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" /></div>) : filteredLeaveRequests.length === 0 ? (<div className="p-8 text-center text-gray-500"><Palmtree className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>Aucune demande</p></div>) : (
                    filteredLeaveRequests.map((leave) => (
                      <div key={leave.id} className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setSelectedLeaveRequest(leave); setShowLeaveModal(true); }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{leave.employee_name ? leave.employee_name.split(' ').map(n => n[0]).join('') : '?'}</div><div className="ml-3"><p className="font-medium text-gray-900">{leave.employee_name || 'Inconnu'}</p><p className="text-sm text-gray-500">{leave.leave_type_name || 'Congé'}</p></div></div>
                          <div className="text-right"><p className="text-sm font-medium text-gray-900">{leave.days_requested} jour{leave.days_requested > 1 ? 's' : ''}</p><p className="text-xs text-gray-500">{formatDate(leave.start_date)} → {formatDate(leave.end_date)}</p></div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${leave.status === 'approved' ? 'bg-green-100 text-green-700' : leave.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{leave.status === 'approved' ? 'Approuvé' : leave.status === 'pending' ? 'En attente' : leave.status === 'rejected' ? 'Refusé' : leave.status}</span>
                          {leave.status === 'pending' && (<div className="flex gap-2" onClick={(e) => e.stopPropagation()}><button onClick={(e) => { e.stopPropagation(); handleApproveLeave(leave.id); }} className="flex items-center px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600"><CheckCircle className="w-3.5 h-3.5 mr-1" />Approuver</button><button onClick={(e) => { e.stopPropagation(); setSelectedLeaveRequest(leave); setShowLeaveModal(true); }} className="flex items-center px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"><XCircle className="w-3.5 h-3.5 mr-1" />Refuser</button></div>)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Résumé</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600">En congés</span><span className="font-semibold text-green-600">{stats?.on_leave || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('pending')}><span className="text-sm text-gray-600">En attente</span><span className="font-semibold text-yellow-600">{leaveStats.pending}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('approved')}><span className="text-sm text-gray-600">Approuvées</span><span className="font-semibold text-blue-600">{leaveStats.approved}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('rejected')}><span className="text-sm text-gray-600">Refusées</span><span className="font-semibold text-red-600">{leaveStats.rejected}</span></div>
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
                  <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Rechercher..." value={invitationSearch} onChange={(e) => setInvitationSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" /></div>
                  <select value={invitationFilter} onChange={(e) => setInvitationFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="all">Tous</option><option value="not_invited">Non invités</option><option value="pending">En attente</option><option value="accepted">Acceptées</option></select>
                  <button onClick={fetchInvitations} className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"><RefreshCw className={`w-4 h-4 mr-2 ${isLoadingInvitations ? 'animate-spin' : ''}`} />Actualiser</button>
                </div>
              </div>
              {/* Barre d'actions groupées — Invitations */}
              {someInvSelected && (
                <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-primary-700">{selectedInvIds.size} sélectionné{selectedInvIds.size > 1 ? 's' : ''}</span>
                  <div className="h-5 w-px bg-primary-200" />
                  <button onClick={handleBulkInvite} disabled={bulkInvLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors">
                    <Send className="w-3.5 h-3.5" />Inviter / Relancer
                  </button>
                  <button onClick={handleBulkExportInv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-3.5 h-3.5" />Exporter
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
                  <h3 className="font-semibold text-gray-900">Invitations ({invitations.length})</h3>
                  {invitations.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={allInvSelected} onChange={toggleSelectAllInv} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                      Tout sélectionner
                    </label>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {isLoadingInvitations ? (<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" /></div>) : invitations.length === 0 ? (<div className="p-8 text-center text-gray-500"><Send className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>Aucune invitation</p></div>) : (
                    invitations.map((inv) => (
                      <div key={inv.id} className={`px-5 py-4 hover:bg-gray-50 transition-colors ${selectedInvIds.has(inv.id) ? 'bg-primary-50/50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input type="checkbox" checked={selectedInvIds.has(inv.id)} onChange={() => toggleSelectInv(inv.id)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer mr-3 flex-shrink-0" />
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${inv.invitation_status === 'accepted' ? 'bg-green-100 text-green-700' : inv.invitation_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{getInitials(inv.first_name, inv.last_name)}</div><div className="ml-3"><p className="font-medium text-gray-900">{inv.first_name} {inv.last_name}</p><p className="text-sm text-gray-500">{inv.email}</p></div></div>
                          <div className="flex items-center gap-3">
                            {getInvitationStatusBadge(inv.invitation_status)}
                            {inv.invitation_status === 'not_invited' && (<button onClick={() => handleSendInvitation(inv)} disabled={sendingInvitation === inv.id} className="flex items-center px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50">{sendingInvitation === inv.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}Inviter</button>)}
                            {inv.invitation_status === 'pending' && (<button onClick={() => handleResendInvitation(inv)} disabled={sendingInvitation === inv.id} className="flex items-center px-3 py-1.5 bg-yellow-500 text-white text-xs font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50">{sendingInvitation === inv.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}Relancer</button>)}
                          </div>
                        </div>
                        <div className="mt-2 ml-[66px] flex items-center gap-4 text-xs text-gray-500">{inv.job_title && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{inv.job_title}</span>}{inv.department_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{inv.department_name}</span>}{inv.invitation_sent_at && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />Invité le {formatDateTime(inv.invitation_sent_at)}</span>}{inv.last_login && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Connecté le {formatDateTime(inv.last_login)}</span>}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Résumé</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('all')}><span className="text-sm text-gray-600">Total</span><span className="font-semibold text-gray-900">{invitationStats?.total_employees || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('not_invited')}><span className="text-sm text-gray-600 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />Non invités</span><span className="font-semibold text-gray-600">{invitationStats?.not_invited || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('pending')}><span className="text-sm text-gray-600 flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" />En attente</span><span className="font-semibold text-yellow-600">{invitationStats?.pending || 0}</span></div>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('accepted')}><span className="text-sm text-gray-600 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Acceptées</span><span className="font-semibold text-green-600">{invitationStats?.accepted || 0}</span></div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Comment ça marche ?</h4>
                <ul className="text-sm text-blue-800 space-y-2"><li className="flex items-start gap-2"><span className="text-blue-500">1.</span>Cliquez sur &quot;Inviter&quot;</li><li className="flex items-start gap-2"><span className="text-blue-500">2.</span>L&apos;employé reçoit son mot de passe</li><li className="flex items-start gap-2"><span className="text-blue-500">3.</span>Une fois connecté → &quot;Acceptée&quot;</li></ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {showLeaveFilter && <div className="fixed inset-0 z-0" onClick={() => setShowLeaveFilter(false)} />}
      {showViewModal && selectedEmployee && <EmployeeModal employee={selectedEmployee} onClose={() => setShowViewModal(false)} onEdit={() => { setShowViewModal(false); setShowEditModal(true); }} />}
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