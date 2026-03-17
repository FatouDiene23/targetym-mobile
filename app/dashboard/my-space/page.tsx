'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  User, Edit2, Save, X, AlertCircle,
  Briefcase, MapPin, Phone, Mail, Building, CalendarDays, Building2,
  FileText, Download, Loader2, PenTool, Upload, Trash2, CheckCircle,
  Network, ZoomIn, ZoomOut, Users, ChevronUp, ChevronDown, Lock, Eye, EyeOff
} from 'lucide-react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { mySpaceTips } from '@/config/pageTips';
import ConfirmDialog from '@/components/ConfirmDialog';
import SOSButton from '@/components/SOSButton';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  employee_id?: number;
  is_active: boolean;
}

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  department_id?: number;
  department_name?: string;
  manager_id?: number;
  manager_name?: string;
  is_manager?: boolean;
  site?: string;
  hire_date?: string;
  status?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  nationality?: string;
}

interface SignatureData {
  employee_id: number;
  employee_name: string;
  has_signature: boolean;
  signature_url: string | null;
}

// ============================================
// ORGANIGRAMME PERSONNEL - Types & Composants
// ============================================
interface OrgNode {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
  is_manager?: boolean;
  children: OrgNode[];
}

const myOrgCSS = `
.my-org-tree {
  display: flex;
  justify-content: center;
  padding: 20px 20px 40px;
}
.my-org-tree ul {
  display: flex;
  justify-content: center;
  padding-top: 24px;
  position: relative;
  list-style: none;
  margin: 0;
  gap: 2px;
}
.my-org-tree ul::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 24px;
  background: #94a3b8;
}
.my-org-tree li {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 24px 4px 0;
}
.my-org-tree li::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 24px;
  background: #94a3b8;
}
.my-org-tree li::after {
  content: '';
  position: absolute;
  top: 0;
  width: 100%;
  height: 2px;
  background: #94a3b8;
  left: 0;
}
.my-org-tree li:first-child::after {
  left: 50%;
  width: 50%;
}
.my-org-tree li:last-child::after {
  right: 50%;
  left: auto;
  width: 50%;
}
.my-org-tree li:only-child::after {
  display: none;
}
.my-org-tree > ul > li::before,
.my-org-tree > ul > li::after,
.my-org-tree > ul::before {
  display: none;
}
`;

function MyOrgCard({ node, isMe, isManager, level, hasChildren, isExpanded, onToggle }: {
  node: OrgNode; isMe?: boolean; isManager?: boolean; level?: string; hasChildren?: boolean;
  isExpanded?: boolean; onToggle?: () => void;
}) {
  const initials = `${node.first_name?.[0] || ''}${node.last_name?.[0] || ''}`.toUpperCase();
  const bgColor = isMe
    ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-300'
    : isManager
    ? 'bg-orange-50 border-orange-400'
    : 'bg-blue-50 border-blue-300';
  const avatarColor = isMe ? 'bg-primary-600' : isManager ? 'bg-orange-500' : 'bg-blue-500';
  const textColor = isMe ? 'text-primary-800' : isManager ? 'text-orange-800' : 'text-blue-800';
  const badgeColor = isMe ? 'bg-primary-100 text-primary-700' : isManager ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';

  return (
    <div className="relative">
      <div className={`relative px-4 py-3 rounded-xl border-2 ${bgColor} shadow-sm min-w-[140px] max-w-[200px] transition-all`}>
        <div className="flex flex-col items-center text-center">
          {level && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500 text-white shadow-sm">
              {level}
            </span>
          )}
          <div className={`w-11 h-11 ${avatarColor} rounded-full flex items-center justify-center text-white font-bold text-sm mb-2 shadow-sm ${level ? 'mt-1' : ''}`}>
            {initials}
          </div>
          <p className={`font-semibold text-xs leading-tight ${textColor}`}>
            {node.first_name} {node.last_name}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight truncate max-w-[170px]">
            {node.job_title || '-'}
          </p>
          {node.department_name && (
            <span className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium ${badgeColor}`}>
              {node.department_name}
            </span>
          )}
          {isMe && (
            <span className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary-500 text-white">
              Vous
            </span>
          )}
          {hasChildren && node.children.length > 0 && (
            <span className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-gray-200 text-gray-600">
              {node.children.length} N-1{node.children.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      {hasChildren && node.children.length > 0 && onToggle && (
        <button
          onClick={onToggle}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full border-2 border-gray-300 bg-white shadow-sm flex items-center justify-center hover:bg-gray-100 transition-all"
        >
          <span className="text-gray-500 text-xs font-bold leading-none">{isExpanded ? '−' : '+'}</span>
        </button>
      )}
    </div>
  );
}

function MyOrgTreeNode({ node, myId, expanded, onToggle, depthFromMe }: {
  node: OrgNode; myId: number; expanded: Set<number>; onToggle: (id: number) => void;
  depthFromMe?: number;
}) {
  const isMe = node.id === myId;
  const isExp = expanded.has(node.id);
  const hasKids = node.children.length > 0;
  
  // Calculer le label de niveau
  let level: string | undefined;
  if (depthFromMe !== undefined && depthFromMe < 0) {
    const n = Math.abs(depthFromMe);
    level = `N+${n}`;
  }

  // Calculer la profondeur pour les enfants
  let childDepth: number | undefined;
  if (isMe) {
    childDepth = 1; // mes enfants sont N-1
  } else if (depthFromMe !== undefined) {
    if (depthFromMe < 0) {
      // On descend vers moi : on se rapproche
      childDepth = depthFromMe + 1;
    } else {
      childDepth = depthFromMe + 1;
    }
  }

  return (
    <li>
      <MyOrgCard
        node={node}
        isMe={isMe}
        isManager={!isMe && (depthFromMe !== undefined && depthFromMe < 0)}
        level={level}
        hasChildren={hasKids}
        isExpanded={isExp}
        onToggle={() => onToggle(node.id)}
      />
      {hasKids && isExp && (
        <ul>
          {node.children.map(child => (
            <MyOrgTreeNode
              key={child.id}
              node={child}
              myId={myId}
              expanded={expanded}
              onToggle={onToggle}
              depthFromMe={childDepth}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ============================================
// API
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

function getAuthHeadersNoContentType(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement du profil');
  return response.json();
}

async function getEmployee(id: number): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Employé non trouvé');
  return response.json();
}

async function updateEmployeeProfile(id: number, data: Partial<Employee>): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur de mise à jour');
  return response.json();
}

async function getSignature(employeeId: number): Promise<SignatureData> {
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/signature`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement de la signature');
  return response.json();
}

async function uploadSignature(employeeId: number, file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/signature`, {
    method: 'POST',
    headers: getAuthHeadersNoContentType(),
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Erreur lors de l\'upload');
  }
  return response.json();
}

async function deleteSignature(employeeId: number): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/signature`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Erreur lors de la suppression');
  }
  return response.json();
}

// ============================================
// COMPONENT
// ============================================

export default function MyProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
  });
  
  // Signature
  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Certificat de travail
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'profile' | 'orgchart'>('profile');

  // Organigramme personnel
  const [orgTree, setOrgTree] = useState<OrgNode | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgExpanded, setOrgExpanded] = useState<Set<number>>(new Set());
  const [orgZoom, setOrgZoom] = useState(90);

  // Changement de mot de passe
  const [passwordForm, setPasswordForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Tour tips
  const { showTips, dismissTips, resetTips } = usePageTour('mySpace');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const currentUser = await getCurrentUser();

      if (!currentUser.employee_id) {
        setError('Votre compte n\'est pas lié à un profil employé.');
        setLoading(false);
        return;
      }

      const emp = await getEmployee(currentUser.employee_id);
      setEmployee(emp);
      setFormData({
        phone: emp.phone || '',
        address: emp.address || '',
      });
      
      // Charger la signature
      try {
        const sig = await getSignature(currentUser.employee_id);
        setSignature(sig);
      } catch {
        // Pas de signature, c'est OK
        setSignature(null);
      }
    } catch (err) {
      console.error('Erreur de chargement:', err);
      setError('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      await updateEmployeeProfile(employee.id, formData);
      await loadData();
      setIsEditing(false);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setSaving(false);
    }
  };

  // Signature handlers
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    
    // Validation côté client
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setSignatureMessage({ type: 'error', text: 'Format non accepté. Utilisez PNG, JPEG ou WebP.' });
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      setSignatureMessage({ type: 'error', text: 'Fichier trop volumineux (max 2 MB).' });
      return;
    }
    
    setSignatureUploading(true);
    setSignatureMessage(null);
    
    try {
      await uploadSignature(employee.id, file);
      const sig = await getSignature(employee.id);
      setSignature(sig);
      setSignatureMessage({ type: 'success', text: 'Signature uploadée avec succès !' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'upload';
      setSignatureMessage({ type: 'error', text: message });
    } finally {
      setSignatureUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSignatureDelete = async () => {
    if (!employee) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer la signature',
      message: 'Êtes-vous sûr de vouloir supprimer votre signature électronique ?',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setSignatureLoading(true);
        setSignatureMessage(null);
        
        try {
          await deleteSignature(employee.id);
          setSignature({ employee_id: employee.id, employee_name: `${employee.first_name} ${employee.last_name}`, has_signature: false, signature_url: null });
          setSignatureMessage({ type: 'success', text: 'Signature supprimée.' });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
          setSignatureMessage({ type: 'error', text: message });
        } finally {
          setSignatureLoading(false);
        }
      },
    });
  };

  // Auto-clear signature message after 4 seconds
  useEffect(() => {
    if (signatureMessage) {
      const timer = setTimeout(() => setSignatureMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [signatureMessage]);

  // ============================================
  // ORGANIGRAMME PERSONNEL
  // ============================================
  const fetchMyOrgChart = useCallback(async () => {
    if (!employee) return;
    setOrgLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/employees/?page=1&page_size=500`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      const allEmps: Employee[] = data.items || [];

      // Filtrer les inactifs et admins
      const activeEmps = allEmps.filter(e => {
        const s = e.status?.toLowerCase();
        if (s === 'terminated') return false;
        const name = `${e.first_name} ${e.last_name}`.toLowerCase();
        const job = (e.job_title || '').toLowerCase();
        if (name.includes('admin') || job === 'administrateur') return false;
        return true;
      });

      const myId = employee.id;
      const me = activeEmps.find(e => e.id === myId);
      if (!me) { setOrgLoading(false); return; }

      // Construire le noeud "Moi" avec mes N-1 et leurs N-1
      const buildNode = (emp: Employee, depth: number): OrgNode => {
        const children = depth < 2
          ? activeEmps
              .filter(e => e.manager_id === emp.id)
              .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
              .map(e => buildNode(e, depth + 1))
          : [];
        return {
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          job_title: emp.job_title,
          department_name: emp.department_name,
          is_manager: emp.is_manager,
          children,
        };
      };

      const myNode = buildNode(me, 0);

      // Construire la chaîne N+1 → N+2 → N+3 ... vers le haut
      let tree: OrgNode = myNode;
      let currentEmp = me;
      
      while (currentEmp.manager_id) {
        const manager = activeEmps.find(e => e.id === currentEmp.manager_id);
        if (!manager || manager.id === currentEmp.id) break; // sécurité anti-boucle
        tree = {
          id: manager.id,
          first_name: manager.first_name,
          last_name: manager.last_name,
          job_title: manager.job_title,
          department_name: manager.department_name,
          is_manager: manager.is_manager,
          children: [tree],
        };
        currentEmp = manager;
      }

      setOrgTree(tree);

      // Auto-expand tout
      const ids = new Set<number>();
      const collect = (n: OrgNode) => { ids.add(n.id); n.children.forEach(collect); };
      collect(tree);
      setOrgExpanded(ids);
    } catch (err) {
      console.error('Error loading org chart:', err);
    } finally {
      setOrgLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    if (activeTab === 'orgchart' && !orgTree && !orgLoading && employee) {
      fetchMyOrgChart();
    }
  }, [activeTab, orgTree, orgLoading, employee, fetchMyOrgChart]);

  const toggleOrgNode = (id: number) => {
    setOrgExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const countNodes = (node: OrgNode): number => {
    let c = 1;
    node.children.forEach(ch => { c += countNodes(ch); });
    return c;
  };

  // Fonction pour changer le mot de passe
  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.newPwd || !passwordForm.confirm) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (passwordForm.newPwd.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (passwordForm.newPwd !== passwordForm.confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setChangingPassword(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.newPwd,
        }),
      });

      if (response.ok) {
        toast.success('Mot de passe modifié avec succès');
        setPasswordForm({ current: '', newPwd: '', confirm: '' });
        setShowPasswordSection(false);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erreur lors du changement de mot de passe');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Erreur de connexion');
    } finally {
      setChangingPassword(false);
    }
  };

  // Fonction pour générer le certificat de travail
  const generateWorkCertificate = async () => {
    setIsGeneratingCertificate(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/certificates/me/work-certificate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.detail || 'Erreur lors de la génération de votre attestation de travail');
        return;
      }
      
      // Télécharger le PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificat_travail_${employee?.last_name || 'employe'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsGeneratingCertificate(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erreur</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      {showTips && (
        <PageTourTips
          tips={mySpaceTips}
          onDismiss={dismissTips}
          pageTitle="Mon Espace"
        />
      )}
      
      <style dangerouslySetInnerHTML={{ __html: myOrgCSS }} />
      <div className={activeTab === 'orgchart' ? 'max-w-7xl mx-auto' : 'max-w-4xl mx-auto'}>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mon Espace</h1>
            <p className="text-gray-500 mt-1">Votre profil et votre position dans l&apos;organisation</p>
          </div>
          <SOSButton />
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
          <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'profile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <User className="w-4 h-4" />Mon Profil
          </button>
          <button onClick={() => setActiveTab('orgchart')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'orgchart' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <Network className="w-4 h-4" />Mon Organigramme
          </button>
        </div>

        {/* ============================================ */}
        {/* Tab: Organigramme Personnel */}
        {/* ============================================ */}
        {activeTab === 'orgchart' && (
          <div className="space-y-4" data-tour="org-chart">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Network className="w-5 h-5 text-primary-600" />
                    Ma position dans l&apos;organisation
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Toute votre chaîne hiérarchique, vos N-1 et leurs subordonnés
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                    <button onClick={() => setOrgZoom(z => Math.max(50, z - 10))} className="p-1 hover:bg-gray-200 rounded"><ZoomOut className="w-4 h-4 text-gray-600" /></button>
                    <span className="text-xs text-gray-600 w-10 text-center">{orgZoom}%</span>
                    <button onClick={() => setOrgZoom(z => Math.min(150, z + 10))} className="p-1 hover:bg-gray-200 rounded"><ZoomIn className="w-4 h-4 text-gray-600" /></button>
                  </div>
                  <button onClick={() => { setOrgTree(null); fetchMyOrgChart(); }} className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Loader2 className={`w-4 h-4 mr-1.5 ${orgLoading ? 'animate-spin' : ''}`} />Actualiser
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto" style={{ minHeight: 300 }}>
              {orgLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
                    <p className="text-gray-500">Chargement de votre organigramme...</p>
                  </div>
                </div>
              ) : orgTree ? (() => {
                // Calculer profondeur de la racine par rapport à moi
                let depth = 0;
                const findDepth = (n: OrgNode, target: number, d: number): number => {
                  if (n.id === target) return d;
                  for (const c of n.children) {
                    const r = findDepth(c, target, d + 1);
                    if (r >= 0) return r;
                  }
                  return -1;
                };
                depth = findDepth(orgTree, employee.id, 0);
                return (
                <div style={{ transform: `scale(${orgZoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
                  <div className="my-org-tree">
                    <ul>
                      <MyOrgTreeNode
                        node={orgTree}
                        myId={employee.id}
                        expanded={orgExpanded}
                        onToggle={toggleOrgNode}
                        depthFromMe={-depth}
                      />
                    </ul>
                  </div>
                </div>
                );
              })() : (
                <div className="flex items-center justify-center py-20 text-center">
                  <div>
                    <Network className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">Aucune donnée disponible</p>
                  </div>
                </div>
              )}
            </div>

            {/* Légende */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Légende</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-primary-600" />
                  <span className="text-xs text-gray-600">Vous</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-xs text-gray-600">Vos supérieurs (N+1, N+2, N+3...)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-600">Vos subordonnés (N-1 et N-2)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Tab: Mon Profil */}
        {/* ============================================ */}
        {activeTab === 'profile' && (<>

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-tour="profile-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              Informations personnelles
            </h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Edit2 className="w-4 h-4" />
                Modifier
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>

            {/* Info Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div>
                <p className="text-sm text-gray-500 mb-1">Nom complet</p>
                <p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Matricule</p>
                <p className="font-medium text-gray-900">{employee.employee_id}</p>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Poste</p>
                  <p className="font-medium text-gray-900">{employee.job_title || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Département</p>
                  <p className="font-medium text-gray-900">{employee.department_name || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{employee.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Téléphone</p>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ex: +221 77 123 45 67"
                    />
                  ) : (
                    <p className="font-medium text-gray-900">{employee.phone || '-'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Site</p>
                  <p className="font-medium text-gray-900">{employee.site || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Date d&apos;embauche</p>
                  <p className="font-medium text-gray-900">
                    {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>
              </div>

              {isEditing && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Adresse</p>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={2}
                    placeholder="Votre adresse..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Manager info */}
          {employee.manager_name && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500">Manager</p>
              <p className="font-medium text-gray-900">{employee.manager_name}</p>
            </div>
          )}

          {/* Status badges */}
          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              employee.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {employee.status === 'active' ? 'Actif' : employee.status}
            </span>
            {employee.is_manager && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                Manager
              </span>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION SIGNATURE ÉLECTRONIQUE */}
        {/* ============================================ */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-tour="signature-section">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-primary-600" />
            Signature électronique
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Votre signature sera utilisée sur les ordres de mission et autres documents officiels.
          </p>

          {/* Message de feedback */}
          {signatureMessage && (
            <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
              signatureMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {signatureMessage.type === 'success' 
                ? <CheckCircle className="w-4 h-4 shrink-0" /> 
                : <AlertCircle className="w-4 h-4 shrink-0" />
              }
              {signatureMessage.text}
            </div>
          )}

          {signature?.has_signature && signature.signature_url ? (
            /* Signature existante */
            <div>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 inline-block">
                <p className="text-xs text-gray-400 mb-2">Aperçu de votre signature :</p>
                <img 
                  src={signature.signature_url} 
                  alt="Ma signature" 
                  className="max-h-20 max-w-xs object-contain"
                />
              </div>
              <div className="mt-4 flex gap-3">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  {signatureUploading ? 'Upload...' : 'Remplacer'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSignatureUpload}
                    className="hidden"
                    disabled={signatureUploading}
                  />
                </label>
                <button
                  onClick={handleSignatureDelete}
                  disabled={signatureLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {signatureLoading ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          ) : (
            /* Pas de signature */
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <PenTool className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">Aucune signature enregistrée</p>
              <p className="text-xs text-gray-400 mb-4">
                Uploadez une image de votre signature manuscrite (PNG, JPEG ou WebP, max 2 MB)
              </p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium">
                {signatureUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Uploader ma signature
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSignatureUpload}
                  className="hidden"
                  disabled={signatureUploading}
                />
              </label>
            </div>
          )}
        </div>

        {/* Section Attestation de Travail */}
        {employee.status === 'active' && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Attestation de Travail
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Générez votre attestation de travail attestant de votre emploi actuel dans l&apos;entreprise.
              Ce document officiel peut être utilisé pour vos démarches administratives.
            </p>
            <button
              onClick={generateWorkCertificate}
              disabled={isGeneratingCertificate}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isGeneratingCertificate ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Télécharger mon attestation de travail
                </>
              )}
            </button>
          </div>
        )}

        {/* Section Changer le mot de passe */}
        {employee.status === 'active' && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary-600" />
                Mot de passe
              </h3>
              {!showPasswordSection && (
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  Changer le mot de passe
                </button>
              )}
            </div>

            {showPasswordSection && (
              <div className="mt-4 space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Entrez votre mot de passe actuel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={passwordForm.newPwd}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPwd: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Minimum 8 caractères"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Confirmez le nouveau mot de passe"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors font-medium text-sm"
                  >
                    {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                  <button
                    onClick={() => { setShowPasswordSection(false); setPasswordForm({ current: '', newPwd: '', confirm: '' }); }}
                    className="px-4 py-2.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note :</strong> Seules les informations de contact (téléphone, adresse) peuvent être modifiées.
            Pour toute autre modification, veuillez contacter le service RH.
          </p>
        </div>
        </>)}
      </div>
      
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
