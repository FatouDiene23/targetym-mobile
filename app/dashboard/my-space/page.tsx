'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  User, Edit2, Save, X, AlertCircle,
  Briefcase, MapPin, Phone, Mail, Building, CalendarDays, Building2,
  FileText, Download, Loader2, Trash2, CheckCircle,
  Network, ZoomIn, ZoomOut, Users, ChevronUp, ChevronDown, Lock, Eye, EyeOff,
  PenLine, Clock, CheckCircle2, XCircle, Upload, Bell
} from 'lucide-react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { mySpaceTips } from '@/config/pageTips';
import ConfirmDialog from '@/components/ConfirmDialog';
import SOSButton from '@/components/SOSButton';
import SignatureCanvas from '@/components/SignatureCanvas';
import Header from '@/components/Header';

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
  photo_url?: string;
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

// ============================================
// SIGNATURES - Types
// ============================================
interface PendingSignature {
  id: number;
  document_id: number;
  document_title: string;
  document_type: string;
  file_name?: string;
  status: string;
  expires_at?: string;
  viewed_at?: string;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  contrat_travail: 'Contrat de travail',
  avenant: 'Avenant',
  accord: 'Accord',
  nda: 'NDA / Confidentialité',
  fiche_paie: 'Fiche de paie',
  attestation: 'Attestation',
  reglement_interieur: 'Règlement intérieur',
  autre: 'Autre',
};

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

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

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

  // Photo de profil
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // Certificat de travail
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);

  // Tab
  // Signatures
  const [pendingSignatures, setPendingSignatures] = useState<PendingSignature[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(false);
  const [signingRequest, setSigningRequest] = useState<PendingSignature | null>(null);
  const [signDocData, setSignDocData] = useState<{ file_data: string; file_name: string; title: string } | null>(null);
  const [signDocLoading, setSignDocLoading] = useState(false);
  const [showSignCanvas, setShowSignCanvas] = useState(false);
  const [signUseDefault, setSignUseDefault] = useState(false); // true = use saved sig, false = draw
  const [rejectingRequest, setRejectingRequest] = useState<PendingSignature | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Signature par défaut (depuis Mon Profil)
  const [showDefaultSigCanvas, setShowDefaultSigCanvas] = useState(false);
  const [savingDefaultSig, setSavingDefaultSig] = useState(false);

  // Organigramme personnel
  const [orgTree, setOrgTree] = useState<OrgNode | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgExpanded, setOrgExpanded] = useState<Set<number>>(new Set());
  const [orgZoom, setOrgZoom] = useState(90);

  // Changement de mot de passe
  const [passwordForm, setPasswordForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'profile' | 'orgchart' | 'signatures' | 'alertes'>('profile');

  // Alertes SOS
  const [sosAlerts, setSosAlerts] = useState<Array<{
    id: number; category: string; message: string | null; is_anonymous: boolean;
    status: string; handled_by: string | null; handled_at: string | null;
    resolution_note: string | null; location_hint: string | null; created_at: string;
  }>>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [sosAlertsPending, setSosAlertsPending] = useState(0);

  // Tour tips
  const fetchPendingSignatures = useCallback(async () => {
    setSignaturesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/signatures/pending`, { headers: getAuthHeaders() });
      if (res.ok) setPendingSignatures(await res.json());
    } catch { /* ignore */ } finally {
      setSignaturesLoading(false);
    }
  }, []);

  const saveDefaultSignature = async (base64: string) => {
    if (!employee) return;
    setSavingDefaultSig(true);
    try {
      const res = await fetch(`${API_URL}/api/employees/${employee.id}/signature-canvas`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_b64: base64 }),
      });
      if (!res.ok) throw new Error();
      // Reload signature state
      const updated = await fetch(`${API_URL}/api/employees/${employee.id}/signature`, { headers: getAuthHeaders() });
      if (updated.ok) setSignature(await updated.json());
      setShowDefaultSigCanvas(false);
      toast.success('Signature enregistrée !');
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSavingDefaultSig(false);
    }
  };

  const openSignModal = async (req: PendingSignature) => {
    setSigningRequest(req);
    setShowSignCanvas(false);
    setSignUseDefault(false);
    setSignDocData(null);
    setSignDocLoading(true);
    try {
      // mark as viewed
      await fetch(`${API_URL}/api/signatures/requests/${req.id}/view`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      // load pdf data
      const res = await fetch(`${API_URL}/api/signatures/requests/${req.id}/document-data`, { headers: getAuthHeaders() });
      if (res.ok) setSignDocData(await res.json());
    } catch { /* ignore */ } finally {
      setSignDocLoading(false);
    }
  };

  const handleSign = async (base64: string) => {
    if (!signingRequest) return;
    try {
      const res = await fetch(`${API_URL}/api/signatures/requests/${signingRequest.id}/sign`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_image_b64: base64 }),
      });
      if (!res.ok) throw new Error();
      toast.success('Document signé avec succès !');
      setSigningRequest(null);
      setSignDocData(null);
      setShowSignCanvas(false);
      fetchPendingSignatures();
    } catch {
      toast.error('Erreur lors de la signature');
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;
    try {
      const res = await fetch(`${API_URL}/api/signatures/requests/${rejectingRequest.id}/reject`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || 'Refusé par l\'employé' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Refus enregistré');
      setRejectingRequest(null);
      setRejectReason('');
      fetchPendingSignatures();
    } catch {
      toast.error('Erreur lors du refus');
    }
  };

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

  // Photo de profil
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Format non accepté. Utilisez PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    setPhotoUploading(true);
    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/api/employees/${employee.id}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Erreur upload');
      const data = await res.json();
      setEmployee(prev => prev ? { ...prev, photo_url: data.photo_url } : prev);
      // Persister dans localStorage pour que la Sidebar se mette à jour
      if (data.photo_url) {
        localStorage.setItem('employee_photo_url', data.photo_url);
      }
      window.dispatchEvent(new CustomEvent('user:photo-updated'));
      toast.success('Photo mise à jour !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'upload');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
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
        try {
          await deleteSignature(employee.id);
          setSignature({ employee_id: employee.id, employee_name: `${employee.first_name} ${employee.last_name}`, has_signature: false, signature_url: null });
          toast.success('Signature supprimée.');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
          toast.error(message);
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
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sos/mine`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const items = data.items || [];
      setSosAlerts(items);
      setSosAlertsPending(data.new_count || 0);
    } catch { /* ignore */ } finally {
      setAlertsLoading(false);
    }
  }, []);

  const handleDeleteAlert = (alertId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer l\'alerte SOS',
      message: 'Êtes-vous sûr de vouloir supprimer cette alerte ? Cette action est irréversible.',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`${API_URL}/api/sos/${alertId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          if (!res.ok) throw new Error();
          setSosAlerts(prev => prev.filter(a => a.id !== alertId));
          toast.success('Alerte supprimée');
        } catch {
          toast.error('Impossible de supprimer l\'alerte');
        }
      },
    });
  };

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

      // Filtrer les inactifs, terminés et admins
      const activeEmps = allEmps.filter(e => {
        const s = e.status?.toLowerCase();
        if (s === 'terminated' || s === 'inactive') return false;
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

  useEffect(() => {
    if (activeTab === 'signatures') fetchPendingSignatures();
  }, [activeTab, fetchPendingSignatures]);

  useEffect(() => {
    if (activeTab === 'alertes') fetchAlerts();
  }, [activeTab, fetchAlerts]);

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
    <>
    <Header title="Mon Espace" subtitle="Votre espace personnel" />
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
        <div className="mb-6 flex items-end justify-end">
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
          <button onClick={() => setActiveTab('signatures')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'signatures' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <PenLine className="w-4 h-4" />Mes Signatures
            {pendingSignatures.length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingSignatures.length}</span>
            )}
          </button>
          <button onClick={() => setActiveTab('alertes')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'alertes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <Bell className="w-4 h-4" />Mes Alertes SOS
            {sosAlertsPending > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{sosAlertsPending}</span>
            )}
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
            {/* Avatar éditable */}
            <div className="relative shrink-0 group">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {employee.photo_url ? (
                <img
                  src={employee.photo_url}
                  alt="Photo de profil"
                  className="w-24 h-24 rounded-full object-cover border-2 border-primary-200"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                  {employee.first_name[0]}{employee.last_name[0]}
                </div>
              )}
              {/* Overlay caméra */}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Changer la photo"
              >
                {photoUploading
                  ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                  : <Upload className="w-6 h-6 text-white" />
                }
              </button>
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
        {/* SECTION SIGNATURE PAR DÉFAUT */}
        {/* ============================================ */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-tour="signature-section">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <PenLine className="w-5 h-5 text-blue-600" />
            Ma signature par défaut
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Dessinez votre signature une fois et réutilisez-la automatiquement lors de la signature de vos documents.
          </p>

          {!showDefaultSigCanvas ? (
            signature?.has_signature && signature.signature_url ? (
              /* Signature existante */
              <div className="space-y-4">
                <div className="inline-block border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <p className="text-xs text-gray-400 mb-2">Votre signature enregistrée :</p>
                  <img src={signature.signature_url} alt="Ma signature" className="max-h-20 max-w-xs object-contain" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowDefaultSigCanvas(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <PenLine className="w-4 h-4" /> Modifier (dessiner)
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium cursor-pointer">
                    <Upload className="w-4 h-4" /> Importer une image
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleSignatureUpload}
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
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <PenLine className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">Aucune signature enregistrée</p>
                <p className="text-xs text-gray-400 mb-5">
                  Dessinez votre signature ou importez une image (PNG, JPEG, WebP)
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => setShowDefaultSigCanvas(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <PenLine className="w-4 h-4" /> Dessiner ma signature
                  </button>
                  <label className="inline-flex items-center gap-2 px-5 py-2.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium cursor-pointer">
                    <Upload className="w-4 h-4" /> Importer une image
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleSignatureUpload}
                    />
                  </label>
                </div>
                {signatureUploading && <p className="mt-3 text-sm text-blue-600">Import en cours...</p>}
              </div>
            )
          ) : (
            /* Canvas pour dessiner */
            <div>
              {savingDefaultSig ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 py-10">
                  <Loader2 className="w-5 h-5 animate-spin" /> Enregistrement en cours...
                </div>
              ) : (
                <SignatureCanvas
                  onConfirm={saveDefaultSignature}
                  onCancel={() => setShowDefaultSigCanvas(false)}
                />
              )}
            </div>
          )}

          {pendingSignatures.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setActiveTab('signatures')}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <PenLine className="w-4 h-4" />
                {pendingSignatures.length} document{pendingSignatures.length > 1 ? 's' : ''} en attente de votre signature →
              </button>
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

        {/* ============================================ */}
        {/* Tab: Mes Signatures */}
        {/* ============================================ */}
        {activeTab === 'signatures' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-blue-600" />
                  Documents à signer
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Documents en attente de votre signature électronique</p>
              </div>
            </div>

            {signaturesLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : pendingSignatures.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Aucun document en attente</p>
                <p className="text-sm text-gray-400 mt-1">Tous vos documents ont été traités</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSignatures.map((req) => (
                  <div key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-1 flex-shrink-0 w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{req.document_title}</p>
                        <p className="text-sm text-gray-500">{DOC_TYPE_LABELS[req.document_type] ?? req.document_type}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${req.status === 'viewed' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                            {req.status === 'viewed' ? <Eye className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {req.status === 'viewed' ? 'Consulté' : 'En attente'}
                          </span>
                          {req.expires_at && (
                            <span className="text-xs text-gray-400">
                              Expire le {new Date(req.expires_at).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setRejectingRequest(req)}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                      >
                        Refuser
                      </button>
                      <button
                        onClick={() => openSignModal(req)}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Signer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Sign Modal ── */}
        {signingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-blue-600" />
                  Signer : {signingRequest.document_title}
                </h3>
                <button onClick={() => { setSigningRequest(null); setSignDocData(null); setShowSignCanvas(false); setSignUseDefault(false); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {signDocLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : signDocData ? (
                  <>
                    {/* PDF Preview — toujours visible sauf quand le canvas est affiché */}
                    {!showSignCanvas && !signUseDefault && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">Lisez attentivement le document avant de signer.</p>
                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 h-64 flex items-center justify-center">
                          <div className="text-center">
                            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">{signDocData.file_name}</p>
                            <a
                              href={`data:application/pdf;base64,${signDocData.file_data}`}
                              download={signDocData.file_name}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" /> Télécharger le PDF
                            </a>
                          </div>
                        </div>

                        {/* Choix de signature */}
                        {signature?.has_signature && signature.signature_url ? (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Choisir votre mode de signature</p>
                            {/* Option 1 : signature enregistrée */}
                            <button
                              onClick={() => setSignUseDefault(true)}
                              className="w-full flex items-center gap-4 px-4 py-3 border-2 border-blue-200 bg-blue-50 rounded-xl hover:border-blue-400 hover:bg-blue-100 transition text-left"
                            >
                              <div className="flex-shrink-0 w-20 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                                <img src={signature.signature_url} alt="" className="max-h-10 max-w-full object-contain" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-blue-800">Utiliser ma signature enregistrée</p>
                                <p className="text-xs text-blue-600 mt-0.5">Votre signature par défaut sera apposée automatiquement</p>
                              </div>
                            </button>
                            {/* Option 2 : dessiner maintenant */}
                            <button
                              onClick={() => setShowSignCanvas(true)}
                              className="w-full flex items-center gap-4 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition text-left"
                            >
                              <div className="flex-shrink-0 w-20 h-12 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
                                <PenLine className="w-6 h-6 text-gray-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-700">Signer maintenant</p>
                                <p className="text-xs text-gray-500 mt-0.5">Dessinez une nouvelle signature dans cette fenêtre</p>
                              </div>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowSignCanvas(true)}
                            className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                          >
                            <PenLine className="w-4 h-4" />
                            Procéder à la signature
                          </button>
                        )}
                      </div>
                    )}

                    {/* Confirmation signature enregistrée */}
                    {signUseDefault && signature?.signature_url && (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">Vous allez apposer votre signature enregistrée sur ce document.</p>
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center gap-2">
                          <p className="text-xs text-gray-400">Aperçu de votre signature :</p>
                          <img src={signature.signature_url} alt="Ma signature" className="max-h-20 object-contain" />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleSign(signature.signature_url!.split(',')[1] ?? signature.signature_url!)}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Confirmer et signer
                          </button>
                          <button
                            onClick={() => setSignUseDefault(false)}
                            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition text-sm"
                          >
                            Retour
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Canvas pour dessiner */}
                    {showSignCanvas && (
                      <SignatureCanvas
                        onConfirm={handleSign}
                        onCancel={() => setShowSignCanvas(false)}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-sm text-red-500">Impossible de charger le document.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Reject Modal ── */}
        {rejectingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Refuser la signature
                </h3>
                <button onClick={() => { setRejectingRequest(null); setRejectReason(''); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Vous êtes sur le point de refuser de signer <strong>{rejectingRequest.document_title}</strong>.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motif du refus (optionnel)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Expliquez la raison de votre refus..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setRejectingRequest(null); setRejectReason(''); }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button onClick={handleReject} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                    Confirmer le refus
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Tab: Mes Alertes SOS */}
        {/* ============================================ */}
        {activeTab === 'alertes' && (
          <div className="space-y-4">
            {/* En-tête */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Mes alertes SOS</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Suivez l&apos;évolution de vos alertes de détresse envoyées aux RH
                </p>
              </div>
            </div>

            {alertsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-red-400" />
              </div>
            ) : sosAlerts.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-gray-700 font-semibold">Aucune alerte envoyée</p>
                <p className="text-sm text-gray-400 mt-1">Vous n&apos;avez pas encore déclenché de signal SOS.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sosAlerts.map((alert) => {
                  const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
                    new:          { label: 'Nouveau',              color: 'text-red-700',    bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500' },
                    acknowledged: { label: 'Pris en compte',       color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
                    in_progress:  { label: 'En cours de traitement', color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',  dot: 'bg-blue-500' },
                    resolved:     { label: 'Résolu',               color: 'text-green-700',  bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
                    closed:       { label: 'Fermé',                color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',  dot: 'bg-gray-400' },
                  };
                  const categoryLabels: Record<string, string> = {
                    general:    '🆘 Situation générale',
                    harassment: '🚫 Harcèlement',
                    burnout:    '😔 Épuisement (burnout)',
                    conflict:   '⚡ Conflit',
                    security:   '🛡️ Sécurité physique',
                    health:     '🏥 Problème de santé',
                    equipment:  '💻 Outils / Matériel',
                  };
                  const s = statusConfig[alert.status] ?? statusConfig['new'];
                  const steps = ['new', 'acknowledged', 'in_progress', 'resolved'];
                  const currentStep = steps.indexOf(alert.status === 'closed' ? 'resolved' : alert.status);

                  return (
                    <div key={alert.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      {/* Header carte */}
                      <div className="flex items-start justify-between p-4 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-semibold text-gray-900">
                              {categoryLabels[alert.category] ?? alert.category}
                            </span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${s.bg} ${s.color}`}>
                              {s.label}
                            </span>
                          </div>
                          {alert.message && (
                            <p className="text-sm text-gray-600 mt-1 leading-snug">{alert.message}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Envoyée le {alert.created_at ? new Date(alert.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                        <div className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${s.dot}`} />
                      </div>

                      {/* Barre de progression du statut */}
                      <div className="px-4 pb-3">
                        <div className="flex items-center gap-0">
                          {['Envoyée', 'Prise en compte', 'En traitement', 'Résolue'].map((stepLabel, i) => {
                            const done = i <= currentStep;
                            const active = i === currentStep;
                            return (
                              <div key={i} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                                    done ? (active ? 'border-primary-500 bg-primary-500 text-white' : 'border-green-400 bg-green-400 text-white')
                                         : 'border-gray-200 bg-gray-50 text-gray-400'
                                  }`}>
                                    {done && !active ? '✓' : i + 1}
                                  </div>
                                  <span className={`text-[10px] mt-0.5 text-center w-16 leading-tight ${done ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                                    {stepLabel}
                                  </span>
                                </div>
                                {i < 3 && (
                                  <div className={`h-0.5 flex-1 mx-1 mb-3 rounded ${i < currentStep ? 'bg-green-400' : 'bg-gray-200'}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Note de résolution si disponible */}
                      {alert.resolution_note && (
                        <div className="mx-4 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-semibold text-green-700 mb-0.5">Note de résolution</p>
                          <p className="text-sm text-green-800">{alert.resolution_note}</p>
                          {alert.handled_by && (
                            <p className="text-xs text-green-600 mt-1">Par {alert.handled_by}{alert.handled_at ? ` · ${new Date(alert.handled_at).toLocaleDateString('fr-FR')}` : ''}</p>
                          )}
                        </div>
                      )}
                      {/* Prise en charge sans note */}
                      {!alert.resolution_note && alert.handled_by && (
                        <div className="mx-4 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                          <p className="text-xs text-blue-700">Prise en charge par <span className="font-semibold">{alert.handled_by}</span>{alert.handled_at ? ` · ${new Date(alert.handled_at).toLocaleDateString('fr-FR')}` : ''}</p>
                        </div>
                      )}
                      {/* Bouton supprimer — uniquement si alerte pas encore prise en charge */}
                      {alert.status === 'new' && (
                        <div className="px-4 pb-4">
                          <button
                            onClick={() => handleDeleteAlert(alert.id)}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Supprimer cette alerte
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
    </>
  );
}
