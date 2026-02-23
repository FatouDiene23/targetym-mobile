'use client';

import { useState, useEffect } from 'react';
import { 
  X, Mail, Phone, MapPin, Calendar, Briefcase, User, FileText,
  GraduationCap, Award, Clock, Palmtree, TrendingUp, Edit2, Download,
  Key, Loader2, CheckCircle, XCircle, Shield, DollarSign, Printer
} from 'lucide-react';
import { getEmployeeAccessStatus, activateEmployeeAccess, deactivateEmployeeAccess, type AccessStatus } from '@/lib/api';
import EmployeeDocuments from '@/components/EmployeeDocuments';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

interface Employee {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  department?: string;
  department_name?: string;
  position?: string;
  job_title?: string;
  location?: string;
  site?: string;
  startDate?: string;
  hire_date?: string;
  status: string;
  manager?: string;
  manager_name?: string;
  gender?: string;
  birthYear?: number;
  date_of_birth?: string;
  isManager?: boolean;
  is_manager?: boolean;
  isTopManager?: boolean;
  onLeave?: boolean;
  role?: string;
  salary?: number;
  currency?: string;
  contract_type?: string;
  classification?: string;
  coefficient?: string;
}

interface EmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onEdit?: () => void;
}

interface LeaveBalanceItem {
  id: number;
  leave_type_name: string;
  leave_type_code: string;
  allocated: number;
  taken: number;
  pending: number;
  carried_over: number;
  available: number;
}

interface LeaveBalanceData {
  employee_id: number;
  year: number;
  balances: LeaveBalanceItem[];
  total_available: number;
  total_taken: number;
  total_pending: number;
}

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employé', manager: 'Manager', rh: 'RH', admin: 'Administrateur', dg: 'Direction Générale',
};

const LEAVE_COLORS: Record<string, { bg: string; text: string }> = {
  'ANNUAL': { bg: 'bg-green-100', text: 'text-green-700' },
  'annual': { bg: 'bg-green-100', text: 'text-green-700' },
  'RTT': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'rtt': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'SENIORITY': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'seniority': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'SICK': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'sick': { bg: 'bg-orange-100', text: 'text-orange-700' },
};

function getLeaveColor(code: string) {
  return LEAVE_COLORS[code] || { bg: 'bg-gray-100', text: 'text-gray-700' };
}

function calculateSeniority(hireDate: string): { years: number; months: number; text: string } {
  const hire = new Date(hireDate);
  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < hire.getDate()) { months--; if (months < 0) { years--; months += 12; } }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mois`);
  if (parts.length === 0) parts.push("Moins d'un mois");
  return { years, months, text: parts.join(' ') };
}

function formatCurrency(amount: number, currency: string = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' ' + currency;
}

const CONTRACT_LABELS: Record<string, string> = {
  'cdi': 'CDI', 'CDI': 'CDI', 'cdd': 'CDD', 'CDD': 'CDD',
  'stage': 'Stage', 'STAGE': 'Stage', 'alternance': 'Alternance', 'ALTERNANCE': 'Alternance',
  'consultant': 'Consultant', 'CONSULTANT': 'Consultant', 'interim': 'Intérim', 'INTERIM': 'Intérim',
  'freelance': 'Freelance', 'FREELANCE': 'Freelance',
};

export default function EmployeeModal({ employee, onClose, onEdit }: EmployeeModalProps) {
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(null);
  const [isLoadingLeave, setIsLoadingLeave] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const displayName = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
  const displayPosition = employee.position || employee.job_title || 'Poste non défini';
  const displayDepartment = employee.department || employee.department_name || '-';
  const displayLocation = employee.location || employee.site || '-';
  const displayManager = employee.manager || employee.manager_name || 'Aucun';
  const displayHireDate = employee.startDate || employee.hire_date || '';
  const isManager = employee.isManager || employee.is_manager || false;
  const isOnLeave = employee.onLeave || employee.status === 'on_leave';

  let age = 0;
  if (employee.birthYear) { age = new Date().getFullYear() - employee.birthYear; }
  else if (employee.date_of_birth) { age = new Date().getFullYear() - new Date(employee.date_of_birth).getFullYear(); }

  const seniority = displayHireDate ? calculateSeniority(displayHireDate) : null;
  const contractTypeDisplay = CONTRACT_LABELS[employee.contract_type || ''] || employee.contract_type || '-';

  useEffect(() => { loadAccessStatus(); loadLeaveBalance(); }, [employee.id]);

  async function loadAccessStatus() {
    setIsLoadingAccess(true);
    try { const status = await getEmployeeAccessStatus(employee.id); setAccessStatus(status); }
    catch (err) { console.error('Error loading access status:', err); }
    finally { setIsLoadingAccess(false); }
  }

  async function loadLeaveBalance() {
    setIsLoadingLeave(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`${API_URL}/api/leaves/balance/${employee.id}?year=${year}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const balances = data as LeaveBalanceItem[];
          setLeaveBalance({
            employee_id: employee.id, year,
            balances,
            total_available: balances.reduce((s, b) => s + (b.available || 0), 0),
            total_taken: balances.reduce((s, b) => s + (b.taken || 0), 0),
            total_pending: balances.reduce((s, b) => s + (b.pending || 0), 0),
          });
        } else if (data.balances) {
          setLeaveBalance(data);
        }
      }
    } catch (err) { console.error('Error loading leave balance:', err); }
    finally { setIsLoadingLeave(false); }
  }

  async function handleActivateAccess() {
    setIsActivating(true); setError('');
    try {
      const result = await activateEmployeeAccess(employee.id, false);
      setTempPassword(result.temp_password);
      setAccessStatus({ has_access: true, user_id: result.user_id, is_active: true, is_verified: false, last_login: null, role: result.role });
    } catch (err) { setError(err instanceof Error ? err.message : "Erreur lors de l'activation"); }
    finally { setIsActivating(false); }
  }

  async function handleDeactivateAccess() {
    if (!confirm("Êtes-vous sûr de vouloir désactiver l'accès de cet employé ?")) return;
    setIsDeactivating(true); setError('');
    try { await deactivateEmployeeAccess(employee.id); setAccessStatus(prev => prev ? { ...prev, is_active: false } : null); }
    catch (err) { setError(err instanceof Error ? err.message : "Erreur lors de la désactivation"); }
    finally { setIsDeactivating(false); }
  }

  function handleExportPDF() {
    setIsExporting(true);
    try {
      const hireFmt = displayHireDate ? new Date(displayHireDate).toLocaleDateString('fr-FR') : '-';
      const senText = seniority?.text || '-';
      const genderText = employee.gender === 'female' || employee.gender === 'F' ? 'Femme' : 'Homme';

      const leaveRows = leaveBalance?.balances?.map(b => `
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">${b.leave_type_name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${b.allocated}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${b.taken}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${b.pending}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">${b.available}</td></tr>
      `).join('') || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#999;">Aucun solde configuré</td></tr>';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dossier - ${displayName}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:40px;color:#333}
.header{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;padding:30px;border-radius:12px;margin-bottom:30px}
.header h1{margin:0 0 5px 0;font-size:24px}.header p{margin:0;opacity:0.9}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;background:rgba(255,255,255,0.2);margin-top:8px}
.section{margin-bottom:25px}.section h2{font-size:16px;color:#4F46E5;border-bottom:2px solid #E5E7EB;padding-bottom:8px;margin-bottom:15px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.field{margin-bottom:10px}.field .label{font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px}
.field .value{font-size:14px;font-weight:500;margin-top:2px}
table{width:100%;border-collapse:collapse}th{background:#F9FAFB;padding:10px 8px;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;border-bottom:2px solid #E5E7EB}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center}
@media print{body{padding:20px}.header{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head>
<body>
<div class="header"><h1>${displayName}</h1><p>${displayPosition} — ${displayDepartment}</p>
<span class="badge">${employee.status === 'active' ? 'Actif' : employee.status}</span>
${isManager ? '<span class="badge" style="margin-left:8px;">Manager</span>' : ''}</div>

<div class="section"><h2>📋 Informations Personnelles</h2><div class="grid">
<div class="field"><div class="label">Email</div><div class="value">${employee.email}</div></div>
<div class="field"><div class="label">Téléphone</div><div class="value">${employee.phone || '-'}</div></div>
<div class="field"><div class="label">Localisation</div><div class="value">${displayLocation}</div></div>
<div class="field"><div class="label">Genre</div><div class="value">${genderText}</div></div>
${age > 0 ? `<div class="field"><div class="label">Âge</div><div class="value">${age} ans</div></div>` : ''}
</div></div>

<div class="section"><h2>💼 Poste & Organisation</h2><div class="grid">
<div class="field"><div class="label">Poste</div><div class="value">${displayPosition}</div></div>
<div class="field"><div class="label">Département</div><div class="value">${displayDepartment}</div></div>
<div class="field"><div class="label">Manager</div><div class="value">${displayManager}</div></div>
<div class="field"><div class="label">Site</div><div class="value">${displayLocation}</div></div>
</div></div>

<div class="section"><h2>📄 Contrat</h2><div class="grid">
<div class="field"><div class="label">Type de contrat</div><div class="value">${contractTypeDisplay}</div></div>
<div class="field"><div class="label">Date d'entrée</div><div class="value">${hireFmt}</div></div>
${employee.classification ? `<div class="field"><div class="label">Classification</div><div class="value">${employee.classification}</div></div>` : ''}
${employee.coefficient ? `<div class="field"><div class="label">Coefficient</div><div class="value">${employee.coefficient}</div></div>` : ''}
<div class="field"><div class="label">Ancienneté</div><div class="value">${senText}</div></div>
${employee.salary ? `<div class="field"><div class="label">Salaire brut mensuel</div><div class="value">${formatCurrency(employee.salary, employee.currency || 'XOF')}</div></div>` : ''}
</div></div>

<div class="section"><h2>🌴 Solde de Congés ${leaveBalance?.year || new Date().getFullYear()}</h2>
<table><thead><tr><th>Type</th><th style="text-align:center;">Alloués</th><th style="text-align:center;">Pris</th><th style="text-align:center;">En attente</th><th style="text-align:center;">Disponibles</th></tr></thead>
<tbody>${leaveRows}</tbody></table></div>

<div class="footer">Dossier employé exporté depuis TARGETYM AI — ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    } catch (err) { console.error('Export error:', err); }
    finally { setIsExporting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-bold mr-4">
              {displayName.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{displayName}</h2>
              <p className="text-primary-100">{displayPosition}</p>
              <div className="flex items-center gap-2 mt-1">
                {isOnLeave ? (
                  <span className="px-2 py-0.5 bg-green-400/30 text-white text-xs rounded-full">En congés</span>
                ) : (
                  <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">
                    {employee.status === 'active' ? 'Actif' : employee.status}
                  </span>
                )}
                {employee.role && (
                  <span className="px-2 py-0.5 bg-purple-400/30 text-white text-xs rounded-full">
                    {ROLE_LABELS[employee.role] || employee.role}
                  </span>
                )}
                {isManager && (
                  <span className="px-2 py-0.5 bg-yellow-400/30 text-white text-xs rounded-full">Manager</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button onClick={onEdit} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg" title="Modifier">
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={handleExportPDF} disabled={isExporting} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg" title="Télécharger le dossier">
              {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tempPassword && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <Key className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Compte créé avec succès !</p>
                  <p className="text-sm text-yellow-700 mt-1">Mot de passe temporaire :</p>
                  <p className="font-mono text-lg font-bold text-yellow-900 select-all mt-1">{tempPassword}</p>
                  <p className="text-xs text-yellow-600 mt-2">⚠️ Notez ce mot de passe et communiquez-le à l&apos;employé. Il ne sera plus affiché.</p>
                </div>
              </div>
            </div>
          )}

          {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Colonne 1 */}
            <div className="space-y-6">
              {/* Accès plateforme */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-primary-500" />Accès Plateforme
                </h3>
                {isLoadingAccess ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : accessStatus?.has_access ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Statut</span>
                      {accessStatus.is_active ? (
                        <span className="flex items-center text-sm text-green-600"><CheckCircle className="w-4 h-4 mr-1" />Actif</span>
                      ) : (
                        <span className="flex items-center text-sm text-red-600"><XCircle className="w-4 h-4 mr-1" />Désactivé</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Vérifié</span>
                      <span className="text-sm text-gray-900">{accessStatus.is_verified ? 'Oui' : 'Non (mot de passe temporaire)'}</span>
                    </div>
                    {accessStatus.last_login && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Dernière connexion</span>
                        <span className="text-sm text-gray-900">{new Date(accessStatus.last_login).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                    {accessStatus.is_active && (
                      <button onClick={handleDeactivateAccess} disabled={isDeactivating}
                        className="w-full mt-2 px-3 py-2 text-sm text-red-600 font-medium border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center justify-center">
                        {isDeactivating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Désactiver l&apos;accès
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">Aucun compte d&apos;accès</p>
                    <button onClick={handleActivateAccess} disabled={isActivating}
                      className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center mx-auto">
                      {isActivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                      Activer l&apos;accès
                    </button>
                  </div>
                )}
              </div>

              {/* Infos personnelles */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-4 h-4 mr-2 text-primary-500" />Informations Personnelles
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center text-sm"><Mail className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{employee.email}</span></div>
                  <div className="flex items-center text-sm"><Phone className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{employee.phone || '-'}</span></div>
                  <div className="flex items-center text-sm"><MapPin className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{displayLocation}</span></div>
                  {age > 0 && <div className="flex items-center text-sm"><Calendar className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{age} ans</span></div>}
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 mr-3 text-gray-400 text-center">{employee.gender === 'female' || employee.gender === 'F' ? '♀' : '♂'}</span>
                    <span className="text-gray-600">{employee.gender === 'female' || employee.gender === 'F' ? 'Femme' : 'Homme'}</span>
                  </div>
                </div>
              </div>

              {/* Poste */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-primary-500" />Poste & Organisation
                </h3>
                <div className="space-y-3">
                  <div><p className="text-xs text-gray-500">Poste</p><p className="text-sm font-medium text-gray-900">{displayPosition}</p></div>
                  <div><p className="text-xs text-gray-500">Département</p><p className="text-sm font-medium text-gray-900">{displayDepartment}</p></div>
                  <div><p className="text-xs text-gray-500">Manager</p><p className="text-sm font-medium text-gray-900">{displayManager}</p></div>
                  <div><p className="text-xs text-gray-500">Site</p><p className="text-sm font-medium text-gray-900">{displayLocation}</p></div>
                </div>
              </div>
            </div>

            {/* Colonne 2 */}
            <div className="space-y-6">
              {/* Contrat */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary-500" />Contrat
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Type</span><span className="text-sm font-medium text-gray-900">{contractTypeDisplay}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Date d&apos;entrée</span><span className="text-sm font-medium text-gray-900">{displayHireDate ? new Date(displayHireDate).toLocaleDateString('fr-FR') : '-'}</span></div>
                  {employee.classification && <div className="flex justify-between"><span className="text-sm text-gray-500">Classification</span><span className="text-sm font-medium text-gray-900">{employee.classification}</span></div>}
                  {employee.coefficient && <div className="flex justify-between"><span className="text-sm text-gray-500">Coefficient</span><span className="text-sm font-medium text-gray-900">{employee.coefficient}</span></div>}
                </div>
              </div>

              {/* Salaire */}
              {employee.salary != null && employee.salary > 0 && (
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-primary-500" />Rémunération
                  </h3>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Salaire brut mensuel</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(employee.salary, employee.currency || 'XOF')}</span>
                  </div>
                </div>
              )}

              {/* Solde congés — DONNÉES RÉELLES */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Palmtree className="w-4 h-4 mr-2 text-green-500" />Solde de Congés
                </h3>
                {isLoadingLeave ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : leaveBalance && leaveBalance.balances.length > 0 ? (
                  <div className="space-y-3">
                    {leaveBalance.balances.map((b) => {
                      const c = getLeaveColor(b.leave_type_code);
                      return (
                        <div key={b.id} className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{b.leave_type_name}</span>
                          <span className={`px-2 py-1 ${c.bg} ${c.text} text-sm font-medium rounded-lg`}>{b.available} jours</span>
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Pris cette année</span>
                        <span className="text-sm font-medium text-gray-900">{leaveBalance.total_taken} jours</span>
                      </div>
                      {leaveBalance.total_pending > 0 && (
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-500">En attente</span>
                          <span className="text-sm font-medium text-yellow-600">{leaveBalance.total_pending} jours</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-sm text-gray-400">Aucun solde configuré</p>
                    <p className="text-xs text-gray-400 mt-1">Initialisez les soldes dans le module Congés</p>
                  </div>
                )}
              </div>

              {/* Ancienneté — CALCULÉE */}
              {seniority && (
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-primary-600">Ancienneté</p><p className="text-2xl font-bold text-primary-700">{seniority.text}</p></div>
                    <Clock className="w-10 h-10 text-primary-300" />
                  </div>
                </div>
              )}
            </div>

            {/* Colonne 3 */}
            <div className="space-y-6">
              <EmployeeDocuments employeeId={employee.id} employeeName={displayName} readOnly={false} />
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-primary-500" />Modules à venir
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center p-2 bg-gray-200/50 rounded-lg"><GraduationCap className="w-4 h-4 text-gray-400 mr-2" /><span className="text-sm text-gray-500">Formations (Phase 3)</span></div>
                  <div className="flex items-center p-2 bg-gray-200/50 rounded-lg"><Award className="w-4 h-4 text-gray-400 mr-2" /><span className="text-sm text-gray-500">Performance (Phase 2)</span></div>
                  <div className="flex items-center p-2 bg-gray-200/50 rounded-lg"><TrendingUp className="w-4 h-4 text-gray-400 mr-2" /><span className="text-sm text-gray-500">Carrière (Phase 3)</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Fermer</button>
          <div className="flex gap-2">
            <button onClick={handleExportPDF} disabled={isExporting}
              className="px-4 py-2 text-sm text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}Exporter PDF
            </button>
            {onEdit && (
              <button onClick={onEdit} className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600">
                Modifier le dossier
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}