'use client';

import Header from '@/components/Header';
import EmployeeModal from '@/components/EmployeeModal';
import AddModal from '@/components/AddModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';
import LeaveRequestModal from '@/components/LeaveRequestModal';
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Plus, Mail, Phone, MapPin, Calendar, Building2, Download,
  Edit2, Eye, Users, UserCheck, UserPlus, TrendingDown,
  Palmtree, CheckCircle, XCircle, Filter, ChevronDown, Briefcase,
  User, Loader2, RefreshCw, X, Send, Clock, MailCheck, AlertCircle,
  Copy, Check, ChevronRight, Maximize2, Minimize2, Network
} from 'lucide-react';
import { 
  getEmployees, getEmployeeStats, getDepartments, exportEmployeesToCSV,
  getLeaveRequests, approveLeaveRequest, rejectLeaveRequest,
  type Employee, type EmployeeStats, type Department, type LeaveRequest
} from '@/lib/api';

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
// COMPOSANT ORGANIGRAMME - Noeud récursif
// ============================================

function OrgTreeNode({ 
  node, expanded, onToggle, level = 0, onSelectEmployee
}: { 
  node: OrgNode; 
  expanded: Set<number>; 
  onToggle: (id: number) => void;
  level?: number;
  onSelectEmployee?: (id: number) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isVirtual = node.id === 0;

  const getInit = (fn: string, ln: string) => `${fn?.[0] || ''}${ln?.[0] || ''}`.toUpperCase();

  const levelColors = [
    'border-primary-500 bg-primary-50',
    'border-blue-400 bg-blue-50',
    'border-indigo-400 bg-indigo-50',
    'border-purple-400 bg-purple-50',
    'border-violet-400 bg-violet-50',
    'border-gray-300 bg-gray-50',
  ];

  const avatarColors = [
    'bg-primary-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-purple-500', 'bg-violet-500', 'bg-gray-500',
  ];

  const ci = Math.min(level, levelColors.length - 1);

  return (
    <div className={level > 0 ? 'ml-6 md:ml-10' : ''}>
      {level > 0 && (
        <div className="relative">
          <div className="absolute -left-6 md:-left-10 top-0 bottom-1/2 w-6 md:w-10 border-l-2 border-b-2 border-gray-200 rounded-bl-lg" />
        </div>
      )}
      <div className={`relative flex items-center gap-3 p-3 rounded-xl border-l-4 ${levelColors[ci]} shadow-sm mb-2 transition-all hover:shadow-md group`}>
        {hasChildren ? (
          <button onClick={() => onToggle(node.id)} className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-200 hover:bg-gray-100">
            <ChevronRight className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        ) : <div className="w-6" />}

        {!isVirtual ? (
          <div className={`w-10 h-10 ${avatarColors[ci]} rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
            {getInit(node.first_name, node.last_name)}
          </div>
        ) : (
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{node.first_name} {node.last_name}</p>
            {node.is_manager && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded shrink-0">Mgr</span>}
          </div>
          <p className="text-xs text-gray-500 truncate">{node.job_title || '-'}</p>
          {node.department_name && <p className="text-[10px] text-gray-400 truncate">{node.department_name}</p>}
        </div>

        {hasChildren && (
          <span className="shrink-0 px-2 py-0.5 bg-white border border-gray-200 text-xs text-gray-500 rounded-full">{node.children.length}</span>
        )}

        {!isVirtual && onSelectEmployee && (
          <button onClick={(e) => { e.stopPropagation(); onSelectEmployee(node.id); }} className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/80 text-gray-400 hover:text-primary-600 transition-all" title="Voir le profil">
            <Eye className="w-4 h-4" />
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="relative">
          {node.children.map((child) => (
            <OrgTreeNode key={child.id} node={child} expanded={expanded} onToggle={onToggle} level={level + 1} onSelectEmployee={onSelectEmployee} />
          ))}
        </div>
      )}
    </div>
  );
}

// Types pour les invitations
interface InvitationEmployee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department_name?: string;
  invitation_status: 'not_invited' | 'pending' | 'accepted';
  invitation_sent_at?: string;
  last_login?: string;
  has_user_account: boolean;
}

interface InvitationStats {
  total_employees: number;
  not_invited: number;
  pending: number;
  accepted: number;
}

// API pour les invitations
const API_URL = 'https://web-production-06c3.up.railway.app';

async function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

async function getInvitations(statusFilter?: string, search?: string): Promise<{ items: InvitationEmployee[], stats: InvitationStats }> {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') params.append('status_filter', statusFilter);
  if (search) params.append('search', search);
  const response = await fetch(`${API_URL}/api/invitations/?${params}`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur lors du chargement des invitations');
  return response.json();
}

async function sendInvitation(employeeId: number): Promise<{ success: boolean; message: string; email_sent: boolean; temp_password?: string }> {
  const response = await fetch(`${API_URL}/api/invitations/${employeeId}/send`, { method: 'POST', headers: await getAuthHeaders() });
  if (!response.ok) { const error = await response.json(); throw new Error(error.detail || 'Erreur'); }
  return response.json();
}

async function resendInvitation(employeeId: number): Promise<{ success: boolean; message: string; email_sent: boolean; temp_password?: string }> {
  const response = await fetch(`${API_URL}/api/invitations/${employeeId}/resend`, { method: 'POST', headers: await getAuthHeaders() });
  if (!response.ok) { const error = await response.json(); throw new Error(error.detail || 'Erreur'); }
  return response.json();
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
              <p className="text-sm text-gray-500 mt-1">{emailSent ? `Un email a été envoyé à ${employeeName}` : `L\u0027email n\u0027a pas pu être envoyé. Transmettez les identifiants manuellement.`}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="mb-3"><label className="text-xs text-gray-500">Email</label><p className="font-medium text-gray-900">{email}</p></div>
              <div><label className="text-xs text-gray-500">Mot de passe temporaire</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-200 font-mono text-sm">{tempPassword}</code>
                  <button onClick={handleCopy} className={`p-2 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title="Copier">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {!emailSent && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"><p className="text-sm text-yellow-800"><strong>Note :</strong> Veuillez transmettre ces identifiants à {employeeName} de manière sécurisée.</p></div>)}
            <button onClick={onClose} className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');
  const [selectedLocation, setSelectedLocation] = useState('Tous');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'employees' | 'leaves' | 'invitations' | 'orgchart'>('employees');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const isInitialized = useRef(false);
  const departmentsRef = useRef<Department[]>([]);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [showLeaveFilter, setShowLeaveFilter] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('all');

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

  const buildOrgTree = useCallback((emps: Employee[]): OrgNode | null => {
    const activeEmps = emps.filter(e => e.status?.toLowerCase() !== 'terminated');
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
    const sortChildren = (node: OrgNode) => {
      node.children.sort((a, b) => { if (a.is_manager && !b.is_manager) return -1; if (!a.is_manager && b.is_manager) return 1; return a.last_name.localeCompare(b.last_name); });
      node.children.forEach(sortChildren);
    };
    if (roots.length === 1) { sortChildren(roots[0]); return roots[0]; }
    if (roots.length > 1) { roots.sort((a, b) => a.last_name.localeCompare(b.last_name)); roots.forEach(sortChildren); return { id: 0, first_name: 'Direction', last_name: 'Générale', job_title: 'Organisation', children: roots }; }
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
        tree.children.forEach(c => { ids.add(c.id); c.children.forEach(gc => ids.add(gc.id)); });
        setExpandedNodes(ids);
      }
    } catch (err) { console.error('Error building org chart:', err); }
    finally { setOrgLoading(false); }
  }, [buildOrgTree]);

  const toggleOrgNode = (id: number) => { setExpandedNodes(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  const expandAllNodes = () => { if (!orgData) return; const ids = new Set<number>(); const traverse = (n: OrgNode) => { ids.add(n.id); n.children.forEach(traverse); }; traverse(orgData); setExpandedNodes(ids); };

  const collapseAllNodes = () => { if (orgData) setExpandedNodes(new Set([orgData.id])); };

  const countDescendants = (node: OrgNode): number => { let count = node.id === 0 ? 0 : 1; node.children.forEach(c => { count += countDescendants(c); }); return count; };

  // Recherche organigramme
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

  // Data fetching
  const fetchEmployees = async (depts: Department[]) => {
    try {
      const deptId = selectedDepartment !== 'Tous' ? depts.find(d => d.name === selectedDepartment)?.id : undefined;
      const response = await getEmployees({ page: currentPage, page_size: 10, search: searchTerm || undefined, department_id: deptId });
      setEmployees(response.items || []); setTotalPages(response.total_pages || 1); setTotalEmployees(response.total || 0);
    } catch (err) { console.error('Error loading employees:', err); setEmployees([]); }
  };

  const fetchStats = async () => { try { const data = await getEmployeeStats(); setStats(data); } catch (err) { console.error('Error loading stats:', err); setStats({ total: 0, active: 0, inactive: 0, on_leave: 0, by_department: {}, by_gender: {}, by_contract_type: {} }); } };

  const fetchDepartments = async (): Promise<Department[]> => { try { const data = await getDepartments(); setDepartments(data || []); departmentsRef.current = data || []; return data || []; } catch (err) { console.error('Error loading departments:', err); setDepartments([]); return []; } };

  const fetchLeaveRequests = async () => { setIsLoadingLeaves(true); try { const response = await getLeaveRequests({ page_size: 100 }); setLeaveRequests(response.items || []); } catch (err) { console.error('Error loading leave requests:', err); setLeaveRequests([]); } finally { setIsLoadingLeaves(false); } };

  const fetchInvitations = async () => {
    setIsLoadingInvitations(true);
    try { const data = await getInvitations(invitationFilter !== 'all' ? invitationFilter : undefined, invitationSearch || undefined); setInvitations(data.items || []); setInvitationStats(data.stats); }
    catch (err) { console.error('Error loading invitations:', err); setInvitations([]); }
    finally { setIsLoadingInvitations(false); }
  };

  const loadAllData = async () => {
    setIsLoading(true); setError(null);
    try { const depts = await fetchDepartments(); await fetchStats(); await fetchEmployees(depts); await fetchLeaveRequests(); await fetchInvitations(); }
    catch (err) { console.error('Error loading data:', err); setError('Erreur lors du chargement des données'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (!isInitialized.current) { isInitialized.current = true; loadAllData(); } }, []);
  useEffect(() => { if (isInitialized.current && !isLoading) { const timer = setTimeout(() => { fetchEmployees(departmentsRef.current); }, 300); return () => clearTimeout(timer); } }, [searchTerm, selectedDepartment, currentPage]);
  useEffect(() => { if (isInitialized.current && activeTab === 'invitations') { const timer = setTimeout(() => { fetchInvitations(); }, 300); return () => clearTimeout(timer); } }, [invitationFilter, invitationSearch, activeTab]);

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

  const filteredLeaveRequests = leaveRequests.filter(leave => leaveStatusFilter === 'all' ? true : leave.status === leaveStatusFilter);
  const leaveStats = { pending: leaveRequests.filter(l => l.status === 'pending').length, approved: leaveRequests.filter(l => l.status === 'approved').length, rejected: leaveRequests.filter(l => l.status === 'rejected').length, total: leaveRequests.length };

  const getInitials = (firstName: string, lastName: string) => `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const formatDate = (dateString?: string) => { if (!dateString) return '-'; return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const formatDateTime = (dateString?: string) => { if (!dateString) return '-'; return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

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

  const handleApproveLeave = async (id: number) => { try { await approveLeaveRequest(id); setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'approved' as const } : req)); if (showLeaveModal && selectedLeaveRequest?.id === id) { setShowLeaveModal(false); setSelectedLeaveRequest(null); } } catch (err) { console.error(err); alert('Erreur lors de l\'approbation'); } };
  const handleRejectLeave = async (id: number, reason: string) => { try { await rejectLeaveRequest(id, reason); setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' as const, rejection_reason: reason } : req)); setShowLeaveModal(false); setSelectedLeaveRequest(null); } catch (err) { console.error(err); alert('Erreur lors du refus'); } };

  const handleSendInvitation = async (employee: InvitationEmployee) => {
    setSendingInvitation(employee.id);
    try { const result = await sendInvitation(employee.id); if (result.temp_password) { setTempPasswordData({ employeeName: `${employee.first_name} ${employee.last_name}`, email: employee.email, tempPassword: result.temp_password, emailSent: result.email_sent }); setShowTempPasswordModal(true); } await fetchInvitations(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Erreur'); }
    finally { setSendingInvitation(null); }
  };

  const handleResendInvitation = async (employee: InvitationEmployee) => {
    setSendingInvitation(employee.id);
    try { const result = await resendInvitation(employee.id); if (result.temp_password) { setTempPasswordData({ employeeName: `${employee.first_name} ${employee.last_name}`, email: employee.email, tempPassword: result.temp_password, emailSent: result.email_sent }); setShowTempPasswordModal(true); } await fetchInvitations(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Erreur'); }
    finally { setSendingInvitation(null); }
  };

  const handleExport = () => exportEmployeesToCSV(filteredEmployees);
  const handleSuccess = () => { loadAllData(); setSelectedEmployee(null); };
  const hasActiveFilter = selectedDepartment !== 'Tous' || selectedLocation !== 'Tous' || searchTerm !== '';

  if (isLoading) {
    return (<><Header title="Gestion du Personnel" subtitle="Administration RH, effectifs et congés" /><main className="flex-1 p-6 flex items-center justify-center"><div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" /><p className="text-gray-500">Chargement des données...</p></div></main></>);
  }

  return (
    <>
      <Header title="Gestion du Personnel" subtitle="Administration RH, effectifs et congés" />
      <main className="flex-1 p-6 overflow-auto">
        {error && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"><span className="text-red-700">{error}</span><button onClick={loadAllData} className="flex items-center text-red-600 hover:text-red-800"><RefreshCw className="w-4 h-4 mr-1" />Réessayer</button></div>)}

        {hasActiveFilter && (
          <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-700"><Filter className="w-4 h-4 inline mr-2" />Filtres actifs : {selectedDepartment !== 'Tous' && <span className="ml-2 px-2 py-0.5 bg-blue-100 rounded">{selectedDepartment}</span>}{selectedLocation !== 'Tous' && <span className="ml-2 px-2 py-0.5 bg-blue-100 rounded">{selectedLocation}</span>}{searchTerm && <span className="ml-2 px-2 py-0.5 bg-blue-100 rounded">&quot;{searchTerm}&quot;</span>}</span>
            <button onClick={() => { setSelectedDepartment('Tous'); setSelectedLocation('Tous'); setSearchTerm(''); setCurrentPage(1); }} className="text-sm text-blue-600 hover:text-blue-800 flex items-center"><X className="w-4 h-4 mr-1" />Effacer</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Users className="w-5 h-5 text-blue-500 mb-2" /><p className="text-2xl font-bold text-gray-900">{dynamicStats.total}</p><p className="text-xs text-gray-500">Total</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><UserCheck className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{dynamicStats.active}</p><p className="text-xs text-gray-500">Actifs</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><UserPlus className="w-5 h-5 text-blue-500 mb-2" /><p className="text-2xl font-bold text-blue-600">{dynamicStats.new_this_month}</p><p className="text-xs text-gray-500">Nouveaux</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><TrendingDown className="w-5 h-5 text-red-500 mb-2" /><p className="text-2xl font-bold text-red-600">{dynamicStats.inactive}</p><p className="text-xs text-gray-500">Inactifs</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Building2 className="w-5 h-5 text-purple-500 mb-2" /><p className="text-2xl font-bold text-purple-600">{departments.length}</p><p className="text-xs text-gray-500">Départements</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Briefcase className="w-5 h-5 text-indigo-500 mb-2" /><p className="text-2xl font-bold text-indigo-600">{dynamicStats.managers}</p><p className="text-xs text-gray-500">Managers</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><Palmtree className="w-5 h-5 text-green-500 mb-2" /><p className="text-2xl font-bold text-green-600">{dynamicStats.on_leave}</p><p className="text-xs text-gray-500">En congés</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><span className="text-sm font-bold text-pink-500 block mb-2">♀</span><p className="text-2xl font-bold text-pink-600">{dynamicStats.female}</p><p className="text-xs text-gray-500">Femmes</p></div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
          <button onClick={() => setActiveTab('employees')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'employees' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Users className="w-4 h-4 inline mr-2" />Annuaire</button>
          <button onClick={() => setActiveTab('orgchart')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'orgchart' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Network className="w-4 h-4 inline mr-2" />Organigramme</button>
          <button onClick={() => setActiveTab('leaves')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'leaves' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Palmtree className="w-4 h-4 inline mr-2" />Congés{leaveStats.pending > 0 && <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">{leaveStats.pending}</span>}</button>
          <button onClick={() => setActiveTab('invitations')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'invitations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><Send className="w-4 h-4 inline mr-2" />Invitations{invitationStats && invitationStats.pending > 0 && <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">{invitationStats.pending}</span>}</button>
        </div>

        {/* ============================================ */}
        {/* Tab: Organigramme */}
        {/* ============================================ */}
        {activeTab === 'orgchart' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="Rechercher dans l'organigramme..." value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={expandAllNodes} className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Maximize2 className="w-4 h-4 mr-2" />Tout déplier</button>
                  <button onClick={collapseAllNodes} className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Minimize2 className="w-4 h-4 mr-2" />Tout replier</button>
                  <button onClick={fetchOrgChart} className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><RefreshCw className={`w-4 h-4 mr-2 ${orgLoading ? 'animate-spin' : ''}`} />Actualiser</button>
                </div>
              </div>
              {orgData && <p className="text-xs text-gray-400 mt-3">{countDescendants(orgData)} collaborateurs • Cliquez sur les flèches pour déplier/replier • Survolez pour voir le profil</p>}
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 min-h-[400px]">
              {orgLoading ? (
                <div className="flex items-center justify-center py-16"><div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" /><p className="text-gray-500">Construction de l&apos;organigramme...</p></div></div>
              ) : orgData ? (
                <OrgTreeNode node={orgData} expanded={expandedNodes} onToggle={toggleOrgNode} onSelectEmployee={handleOrgSelectEmployee} />
              ) : (
                <div className="flex items-center justify-center py-16 text-center"><div><Network className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500 mb-2">Aucune donnée pour l&apos;organigramme</p><p className="text-sm text-gray-400">Vérifiez que les relations manager sont configurées</p></div></div>
              )}
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {filteredEmployees.length === 0 ? (
                    <div className="p-12 text-center"><Users className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p className="text-gray-500 mb-4">Aucun employé trouvé</p><button onClick={loadAllData} className="flex items-center mx-auto px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg"><RefreshCw className="w-4 h-4 mr-2" />Actualiser</button></div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Employé</th><th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Département</th><th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Localisation</th><th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Statut</th><th className="text-right px-5 py-3 text-sm font-semibold text-gray-600">Actions</th></tr></thead>
                      <tbody>
                        {filteredEmployees.map((employee) => (
                          <tr key={employee.id} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${selectedEmployee?.id === employee.id ? 'bg-primary-50' : ''}`} onClick={() => setSelectedEmployee(employee)}>
                            <td className="px-5 py-4"><div className="flex items-center"><div className="relative"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{getInitials(employee.first_name, employee.last_name)}</div>{employee.status?.toLowerCase() === 'on_leave' && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><Palmtree className="w-2.5 h-2.5 text-white" /></div>}</div><div className="ml-3"><div className="flex items-center"><p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>{employee.is_manager && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Mgr</span>}</div><p className="text-sm text-gray-500">{employee.position || employee.job_title || '-'}</p></div></div></td>
                            <td className="px-5 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{employee.department_name || '-'}</span></td>
                            <td className="px-5 py-4 text-sm text-gray-600">{employee.location || employee.site || '-'}</td>
                            <td className="px-5 py-4">{getStatusBadge(employee.status)}</td>
                            <td className="px-5 py-4 text-right"><div className="flex items-center justify-end gap-1"><button onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setShowEditModal(true); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Modifier"><Edit2 className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setShowViewModal(true); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Voir"><Eye className="w-4 h-4" /></button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {totalPages > 1 && (<div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between"><p className="text-sm text-gray-500">Page {currentPage} sur {totalPages} • {totalEmployees} employé{totalEmployees > 1 ? 's' : ''}</p><div className="flex gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Précédent</button><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Suivant</button></div></div>)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit sticky top-6">
                {selectedEmployee ? (<><div className="text-center mb-6"><div className="relative inline-block"><div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">{getInitials(selectedEmployee.first_name, selectedEmployee.last_name)}</div>{selectedEmployee.status?.toLowerCase() === 'on_leave' && <div className="absolute bottom-2 right-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"><Palmtree className="w-3.5 h-3.5 text-white" /></div>}</div><h3 className="text-xl font-bold text-gray-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3><p className="text-sm text-gray-500">{selectedEmployee.position || selectedEmployee.job_title || '-'}</p><div className="flex items-center justify-center gap-2 mt-2">{getStatusBadge(selectedEmployee.status)}{selectedEmployee.is_manager && <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Manager</span>}</div></div><div className="space-y-4 mb-6"><div className="flex items-center text-sm text-gray-600"><Mail className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.email}</div>{selectedEmployee.phone && <div className="flex items-center text-sm text-gray-600"><Phone className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.phone}</div>}{(selectedEmployee.location || selectedEmployee.site) && <div className="flex items-center text-sm text-gray-600"><MapPin className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.location || selectedEmployee.site}</div>}{selectedEmployee.department_name && <div className="flex items-center text-sm text-gray-600"><Building2 className="w-4 h-4 mr-3 text-gray-400" />{selectedEmployee.department_name}</div>}<div className="flex items-center text-sm text-gray-600"><Calendar className="w-4 h-4 mr-3 text-gray-400" />Depuis le {formatDate(selectedEmployee.hire_date)}</div></div><div className="pt-4 border-t border-gray-100"><p className="text-sm text-gray-500 mb-2">Type de contrat</p><p className="font-medium text-gray-900">{selectedEmployee.contract_type?.toUpperCase() || '-'}</p></div><div className="flex gap-2 mt-6"><button onClick={() => setShowViewModal(true)} className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Eye className="w-4 h-4 mr-2" />Voir profil</button><button onClick={() => setShowEditModal(true)} className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"><Edit2 className="w-4 h-4" /></button></div></>) : (<div className="text-center text-gray-500 py-12"><User className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>Sélectionnez un employé</p></div>)}
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
                      {showLeaveFilter && (<div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"><button onClick={() => { setLeaveStatusFilter('all'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'all' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}>Toutes</button><button onClick={() => { setLeaveStatusFilter('pending'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'pending' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>En attente ({leaveStats.pending})</button><button onClick={() => { setLeaveStatusFilter('approved'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'approved' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>Approuvées ({leaveStats.approved})</button><button onClick={() => { setLeaveStatusFilter('rejected'); setShowLeaveFilter(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${leaveStatusFilter === 'rejected' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}><span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>Refusées ({leaveStats.rejected})</button></div>)}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {isLoadingLeaves ? (<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" /></div>) : filteredLeaveRequests.length === 0 ? (<div className="p-8 text-center text-gray-500"><Palmtree className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>Aucune demande</p></div>) : (
                    filteredLeaveRequests.map((leave) => (
                      <div key={leave.id} className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setSelectedLeaveRequest(leave); setShowLeaveModal(true); }}>
                        <div className="flex items-center justify-between"><div className="flex items-center"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{leave.employee_name ? leave.employee_name.split(' ').map(n => n[0]).join('') : '?'}</div><div className="ml-3"><p className="font-medium text-gray-900">{leave.employee_name || 'Inconnu'}</p><p className="text-sm text-gray-500">{leave.leave_type_name || 'Congé'}</p></div></div><div className="text-right"><p className="text-sm font-medium text-gray-900">{leave.days_requested} jour{leave.days_requested > 1 ? 's' : ''}</p><p className="text-xs text-gray-500">{formatDate(leave.start_date)} → {formatDate(leave.end_date)}</p></div></div>
                        <div className="flex items-center justify-between mt-3"><span className={`px-2 py-1 text-xs font-medium rounded-full ${leave.status === 'approved' ? 'bg-green-100 text-green-700' : leave.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{leave.status === 'approved' ? 'Approuvé' : leave.status === 'pending' ? 'En attente' : leave.status === 'rejected' ? 'Refusé' : leave.status}</span>{leave.status === 'pending' && (<div className="flex gap-2" onClick={(e) => e.stopPropagation()}><button onClick={(e) => { e.stopPropagation(); handleApproveLeave(leave.id); }} className="flex items-center px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600"><CheckCircle className="w-3.5 h-3.5 mr-1" />Approuver</button><button onClick={(e) => { e.stopPropagation(); setSelectedLeaveRequest(leave); setShowLeaveModal(true); }} className="flex items-center px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"><XCircle className="w-3.5 h-3.5 mr-1" />Refuser</button></div>)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4"><div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"><h3 className="font-semibold text-gray-900 mb-4">Résumé</h3><div className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-gray-600">En congés</span><span className="font-semibold text-green-600">{stats?.on_leave || 0}</span></div><div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('pending')}><span className="text-sm text-gray-600">En attente</span><span className="font-semibold text-yellow-600">{leaveStats.pending}</span></div><div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('approved')}><span className="text-sm text-gray-600">Approuvées</span><span className="font-semibold text-blue-600">{leaveStats.approved}</span></div><div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setLeaveStatusFilter('rejected')}><span className="text-sm text-gray-600">Refusées</span><span className="font-semibold text-red-600">{leaveStats.rejected}</span></div></div></div></div>
          </div>
        )}

        {/* Tab: Invitations */}
        {activeTab === 'invitations' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><div className="flex flex-col md:flex-row gap-4"><div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Rechercher..." value={invitationSearch} onChange={(e) => setInvitationSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" /></div><select value={invitationFilter} onChange={(e) => setInvitationFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm"><option value="all">Tous</option><option value="not_invited">Non invités</option><option value="pending">En attente</option><option value="accepted">Acceptées</option></select><button onClick={fetchInvitations} className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"><RefreshCw className={`w-4 h-4 mr-2 ${isLoadingInvitations ? 'animate-spin' : ''}`} />Actualiser</button></div></div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Invitations ({invitations.length})</h3></div>
                <div className="divide-y divide-gray-100">
                  {isLoadingInvitations ? (<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" /></div>) : invitations.length === 0 ? (<div className="p-8 text-center text-gray-500"><Send className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>Aucune invitation</p></div>) : (
                    invitations.map((inv) => (
                      <div key={inv.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between"><div className="flex items-center"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${inv.invitation_status === 'accepted' ? 'bg-green-100 text-green-700' : inv.invitation_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{getInitials(inv.first_name, inv.last_name)}</div><div className="ml-3"><p className="font-medium text-gray-900">{inv.first_name} {inv.last_name}</p><p className="text-sm text-gray-500">{inv.email}</p></div></div>
                          <div className="flex items-center gap-3">{getInvitationStatusBadge(inv.invitation_status)}{inv.invitation_status === 'not_invited' && (<button onClick={() => handleSendInvitation(inv)} disabled={sendingInvitation === inv.id} className="flex items-center px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50">{sendingInvitation === inv.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}Inviter</button>)}{inv.invitation_status === 'pending' && (<button onClick={() => handleResendInvitation(inv)} disabled={sendingInvitation === inv.id} className="flex items-center px-3 py-1.5 bg-yellow-500 text-white text-xs font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50">{sendingInvitation === inv.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}Relancer</button>)}</div>
                        </div>
                        <div className="mt-2 ml-13 flex items-center gap-4 text-xs text-gray-500">{inv.job_title && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{inv.job_title}</span>}{inv.department_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{inv.department_name}</span>}{inv.invitation_sent_at && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />Invité le {formatDateTime(inv.invitation_sent_at)}</span>}{inv.last_login && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Connecté le {formatDateTime(inv.last_login)}</span>}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"><h3 className="font-semibold text-gray-900 mb-4">Résumé</h3><div className="space-y-3"><div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('all')}><span className="text-sm text-gray-600">Total</span><span className="font-semibold text-gray-900">{invitationStats?.total_employees || 0}</span></div><div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('not_invited')}><span className="text-sm text-gray-600 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />Non invités</span><span className="font-semibold text-gray-600">{invitationStats?.not_invited || 0}</span></div><div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('pending')}><span className="text-sm text-gray-600 flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" />En attente</span><span className="font-semibold text-yellow-600">{invitationStats?.pending || 0}</span></div><div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => setInvitationFilter('accepted')}><span className="text-sm text-gray-600 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" />Acceptées</span><span className="font-semibold text-green-600">{invitationStats?.accepted || 0}</span></div></div></div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Comment ça marche ?</h4><ul className="text-sm text-blue-800 space-y-2"><li className="flex items-start gap-2"><span className="text-blue-500">1.</span>Cliquez sur &quot;Inviter&quot; pour envoyer les identifiants</li><li className="flex items-start gap-2"><span className="text-blue-500">2.</span>L&apos;employé reçoit son mot de passe temporaire</li><li className="flex items-start gap-2"><span className="text-blue-500">3.</span>Une fois connecté, l&apos;invitation passe en &quot;Acceptée&quot;</li></ul></div>
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
    </>
  );
}