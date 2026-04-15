'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, X, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight,
  XCircle, Archive, RotateCcw, MoreVertical, Users
} from 'lucide-react';
import PerformanceStats from '../components/PerformanceStats';
import Header from '@/components/Header';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useI18n } from '@/lib/i18n/I18nContext';

// =============================================
// TYPES
// =============================================

interface EvaluationCampaign {
  id: number;
  name: string;
  description?: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  total_evaluations: number;
  completed_evaluations: number;
  progress_percentage: number;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  department_id?: number | null;
  department_name?: string | null;
  manager_id?: number | null;
}

interface CurrentUser {
  id: number;
  role: string;
}

// =============================================
// API
// =============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');
const ITEMS_PER_PAGE = 10;

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchCampaigns(includeArchived: boolean = false): Promise<EvaluationCampaign[]> {
  try {
    const url = includeArchived 
      ? `${API_URL}/api/performance/campaigns?page_size=100`
      : `${API_URL}/api/performance/campaigns?page_size=100`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?page_size=200&status=active`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

interface EvaluatorSelection { employee_id: number; peer_ids: number[]; direct_report_ids: number[]; }

async function createCampaign(data: {
  name: string; description?: string; type: string; period?: string; start_date: string; end_date: string;
  employee_ids?: number[];
  include_self_evaluation?: boolean;
  include_manager_evaluation?: boolean;
  include_peer_evaluation?: boolean;
  include_direct_report_evaluation?: boolean;
  weight_self?: number; weight_manager?: number; weight_peer?: number; weight_direct_report?: number;
  evaluator_selections?: EvaluatorSelection[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/campaigns`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: parseApiError(errorData, 'Erreur lors de la création') };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
  }
}

async function cancelCampaign(campaignId: number, reason?: string): Promise<{ success: boolean; error?: string; data?: { evaluations_cancelled: number } }> {
  try {
    const url = `${API_URL}/api/performance/campaigns/${campaignId}/cancel`;
    console.log('Calling cancel API:', url);
    
    const response = await fetch(url, {
      method: 'POST', 
      headers: getAuthHeaders(), 
      body: reason ? JSON.stringify({ reason }) : undefined,
    });
    
    console.log('Cancel response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('Cancel error:', errorData);
      return { success: false, error: parseApiError(errorData, `Erreur ${response.status}`) };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    console.error('Cancel exception:', err);
    return { success: false, error: 'Erreur de connexion: ' + (err instanceof Error ? err.message : String(err)) };
  }
}

async function archiveCampaign(campaignId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${API_URL}/api/performance/campaigns/${campaignId}/archive`;
    console.log('Calling archive API:', url);
    
    const response = await fetch(url, {
      method: 'POST', 
      headers: getAuthHeaders(),
    });
    
    console.log('Archive response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('Archive error:', errorData);
      return { success: false, error: parseApiError(errorData, `Erreur ${response.status}`) };
    }
    return { success: true };
  } catch (err) {
    console.error('Archive exception:', err);
    return { success: false, error: 'Erreur de connexion: ' + (err instanceof Error ? err.message : String(err)) };
  }
}

async function restoreCampaign(campaignId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${API_URL}/api/performance/campaigns/${campaignId}/restore`;
    console.log('Calling restore API:', url);
    
    const response = await fetch(url, {
      method: 'POST', 
      headers: getAuthHeaders(),
    });
    
    console.log('Restore response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('Restore error:', errorData);
      return { success: false, error: parseApiError(errorData, `Erreur ${response.status}`) };
    }
    return { success: true };
  } catch (err) {
    console.error('Restore exception:', err);
    return { success: false, error: 'Erreur de connexion: ' + (err instanceof Error ? err.message : String(err)) };
  }
}

// =============================================
// HELPERS
// =============================================

function parseApiError(errorData: Record<string, unknown>, fallback: string): string {
  if (typeof errorData.detail === 'string') return errorData.detail;
  if (Array.isArray(errorData.detail)) {
    return errorData.detail
      .map((e: { msg?: string; message?: string }) => e.msg || e.message || JSON.stringify(e))
      .join(', ');
  }
  return fallback;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-blue-100 text-blue-700';
    case 'active': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-orange-100 text-orange-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    case 'archived': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// =============================================
// COMPONENTS
// =============================================

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) pageNum = i + 1;
          else if (currentPage <= 3) pageNum = i + 1;
          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
          else pageNum = currentPage - 2 + i;
          return (
            <button key={pageNum} onClick={() => onPageChange(pageNum)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum ? 'bg-primary-500 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
              {pageNum}
            </button>
          );
        })}
      </div>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-500 ml-2">Page {currentPage}/{totalPages}</span>
    </div>
  );
}

// =============================================
// PEER SELECTOR — autocomplete de sélection multi-employés
// =============================================
function PeerSelector({ all, selected, onChange, maxSelectable, placeholder }: {
  all: Employee[]; selected: number[]; onChange: (ids: number[]) => void; maxSelectable: number; placeholder: string;
}) {
  const [searchText, setSearchText] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = all.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchText.toLowerCase()) &&
    !selected.includes(e.id)
  );

  const toggle = (id: number) => {
    if (selected.length < maxSelectable) onChange([...selected, id]);
    setSearchText('');
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 mb-1">
        {selected.map(id => {
          const emp = all.find(e => e.id === id);
          if (!emp) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
              {emp.first_name} {emp.last_name}
              <button type="button" onClick={() => onChange(selected.filter(x => x !== id))} className="hover:text-primary-900"><X className="w-3 h-3" /></button>
            </span>
          );
        })}
      </div>
      {selected.length < maxSelectable && (
        <div className="relative">
          <input
            type="text" value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filtered.slice(0, 10).map(emp => (
                <button key={emp.id} type="button" onMouseDown={() => toggle(emp.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left">
                  <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs shrink-0">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  {emp.first_name} {emp.last_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================
// CREATE CAMPAIGN MODAL — 2 étapes
// =============================================
function CreateCampaignModal({ isOpen, onClose, employees, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; onSuccess: () => void;
}) {
  const { t } = useI18n();

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      draft: t.performance.draft, active: t.performance.active,
      completed: t.performance.completedStatus, cancelled: t.performance.cancelled,
      archived: t.performance.archived,
    };
    return map[status] || status;
  };

  const getTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      annual: t.performance.annualEval, mid_year: t.performance.midYearEval,
      '360': t.performance.eval360, probation: t.performance.probationEval,
      '1on1_eval': t.performance.interview1on1, '1on1_coaching': t.performance.coaching1on1,
      weekly: t.performance.weeklyReview, '360_feedback': t.performance.feedback360,
      onboarding: t.performance.onboardingEval, trial: t.performance.trialEval,
    };
    return map[type] || type;
  };

  const [step, setStep] = useState<1 | 2>(1);
  // Step 1
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [campaignType, setCampaignType] = useState('annual');
  const [period, setPeriod] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [includeSelf, setIncludeSelf] = useState(true);
  const [includeManager, setIncludeManager] = useState(true);
  const [includePeer, setIncludePeer] = useState(false);
  const [includeDirectReport, setIncludeDirectReport] = useState(false);
  const [weightSelf, setWeightSelf] = useState(50);
  const [weightManager, setWeightManager] = useState(50);
  const [weightPeer, setWeightPeer] = useState(0);
  const [weightDirectReport, setWeightDirectReport] = useState(0);
  // Step 2
  const [evaluatorSelections, setEvaluatorSelections] = useState<EvaluatorSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const needsStep2 = includePeer || includeDirectReport;

  // Recalcule les pondérations automatiquement quand on coche/décoche un type
  useEffect(() => {
    const active = [includeSelf, includeManager, includePeer, includeDirectReport].filter(Boolean).length;
    if (active === 0) return;
    const base = Math.floor(100 / active);
    const rem = 100 - base * active;
    setWeightSelf(includeSelf ? base + (rem > 0 && includeSelf ? rem : 0) : 0);
    setWeightManager(includeManager ? base : 0);
    setWeightPeer(includePeer ? base : 0);
    setWeightDirectReport(includeDirectReport ? base : 0);
  }, [includeSelf, includeManager, includePeer, includeDirectReport]);

  // Init sélections étape 2
  useEffect(() => {
    if (step !== 2) return;
    const emps = selectedEmployees.length > 0 ? employees.filter(e => selectedEmployees.includes(e.id)) : employees;
    setEvaluatorSelections(emps.map(e => ({
      employee_id: e.id, peer_ids: [], direct_report_ids: []
    })));
  }, [step, employees, selectedEmployees]);

  const resetForm = () => {
    setStep(1); setName(''); setDescription(''); setCampaignType('annual'); setPeriod('annual');
    setStartDate(''); setEndDate(''); setSelectedEmployees([]);
    setIncludeSelf(true); setIncludeManager(true); setIncludePeer(false); setIncludeDirectReport(false);
    setEvaluatorSelections([]);
  };

  const handleStep1Next = () => {
    if (!name || !startDate || !endDate) { setError(t.performance.fillRequiredFields); return; }
    setError('');
    if (needsStep2) { setStep(2); } else { handleSubmit(); }
  };

  const handleSubmit = async () => {
    setError(''); setSaving(true);
    const result = await createCampaign({
      name, description: description || undefined, type: campaignType, period,
      start_date: startDate, end_date: endDate,
      employee_ids: selectedEmployees.length > 0 ? selectedEmployees : undefined,
      include_self_evaluation: includeSelf, include_manager_evaluation: includeManager,
      include_peer_evaluation: includePeer, include_direct_report_evaluation: includeDirectReport,
      weight_self: weightSelf, weight_manager: weightManager,
      weight_peer: weightPeer, weight_direct_report: weightDirectReport,
      evaluator_selections: needsStep2 ? evaluatorSelections : undefined,
    });
    setSaving(false);
    if (result.success) { resetForm(); onSuccess(); onClose(); }
    else setError(result.error || t.performance.creationErrorGeneric);
  };

  const updateSel = (empId: number, update: Partial<EvaluatorSelection>) => {
    setEvaluatorSelections(prev =>
      prev.map(s => s.employee_id === empId ? { ...s, ...update } : s)
    );
  };

  if (!isOpen) return null;

  const totalWeight = weightSelf + weightManager + weightPeer + weightDirectReport;
  const activeTypeCount = [includeSelf, includeManager, includePeer, includeDirectReport].filter(Boolean).length;
  const empList = selectedEmployees.length > 0 ? employees.filter(e => selectedEmployees.includes(e.id)) : employees;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 1 ? t.performance.newCampaign : t.performance.evaluatorSelection}
            </h2>
            {needsStep2 && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
                <div className={`h-0.5 w-8 ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
                <span className="text-xs text-gray-400 ml-1">{step === 1 ? t.performance.information : t.performance.peerEvaluators}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

          {/* ── ETAPE 1 ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.performance.campaignName} *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.performance.campaignNamePlaceholder} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.common.details}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t.performance.descriptionOptional} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.performance.evaluationType}</label>
                  <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
                    <option value="annual">{t.performance.annualEvaluation}</option>
                    <option value="mid_year">{t.performance.midYearEvaluation}</option>
                    <option value="360">{t.performance.evaluation360}</option>
                    <option value="probation">{t.performance.endOfProbation}</option>
                    <option value="entretien_1on1">{t.performance.interview1on1Eval}</option>
                    <option value="coaching_1on1">{t.performance.coaching1on1Session}</option>
                    <option value="revue_hebdo">{t.performance.weeklyPerfReview}</option>
                    <option value="feedback_360">{t.performance.feedback360Eval}</option>
                    <option value="prise_de_fonction">{t.performance.onboardingEvaluation}</option>
                    <option value="prise_dessai">{t.performance.trialEvaluation}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.performance.periodicity}</label>
                  <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
                    <option value="annual">{t.performance.annual}</option>
                    <option value="semester">{t.performance.semester}</option>
                    <option value="quarterly">{t.performance.quarterly}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.performance.startDate} *</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.performance.endDate} *</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
                </div>
              </div>

              {/* Types d'évaluateurs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.performance.evaluatorTypes}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: t.performance.selfEvaluation, desc: t.performance.selfEvalDesc, checked: includeSelf, set: setIncludeSelf },
                    { label: t.performance.managerEval, desc: t.performance.managerEvalDesc, checked: includeManager, set: setIncludeManager },
                    { label: t.performance.peers, desc: t.performance.peersDesc, checked: includePeer, set: setIncludePeer },
                    { label: t.performance.directReports, desc: t.performance.directReportsDesc, checked: includeDirectReport, set: setIncludeDirectReport },
                  ].map(({ label, desc, checked, set }) => (
                    <label key={label} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${checked ? 'bg-primary-50 border-primary-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pondérations — visible seulement si ≥ 2 types */}
              {activeTypeCount >= 2 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.performance.weights}
                    <span className={`ml-2 text-xs font-normal ${totalWeight === 100 ? 'text-green-600' : 'text-orange-500'}`}>
                      {t.performance.weightTotal} : {totalWeight}% {totalWeight !== 100 ? `(${t.performance.weightMustBe100})` : '✓'}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {includeSelf && (
                      <div><label className="text-xs text-gray-500 mb-1 block">{t.performance.selfEvaluation}</label>
                        <div className="flex items-center gap-2"><input type="range" min={0} max={100} value={weightSelf} onChange={(e) => setWeightSelf(parseInt(e.target.value))} className="flex-1" /><span className="w-10 text-sm font-medium text-right">{weightSelf}%</span></div>
                      </div>
                    )}
                    {includeManager && (
                      <div><label className="text-xs text-gray-500 mb-1 block">{t.performance.managerEval}</label>
                        <div className="flex items-center gap-2"><input type="range" min={0} max={100} value={weightManager} onChange={(e) => setWeightManager(parseInt(e.target.value))} className="flex-1" /><span className="w-10 text-sm font-medium text-right">{weightManager}%</span></div>
                      </div>
                    )}
                    {includePeer && (
                      <div><label className="text-xs text-gray-500 mb-1 block">Pairs</label>
                        <div className="flex items-center gap-2"><input type="range" min={0} max={100} value={weightPeer} onChange={(e) => setWeightPeer(parseInt(e.target.value))} className="flex-1" /><span className="w-10 text-sm font-medium text-right">{weightPeer}%</span></div>
                      </div>
                    )}
                    {includeDirectReport && (
                      <div><label className="text-xs text-gray-500 mb-1 block">Collaborateurs</label>
                        <div className="flex items-center gap-2"><input type="range" min={0} max={100} value={weightDirectReport} onChange={(e) => setWeightDirectReport(parseInt(e.target.value))} className="flex-1" /><span className="w-10 text-sm font-medium text-right">{weightDirectReport}%</span></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Employés */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employés concernés</label>
                <p className="text-xs text-gray-500 mb-2">Laissez vide pour inclure tous les employés actifs</p>
                <select multiple value={selectedEmployees.map(String)} onChange={(e) => setSelectedEmployees(Array.from(e.target.selectedOptions, o => parseInt(o.value)))} className="w-full px-3 py-2.5 border rounded-lg text-sm h-32">
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
                {selectedEmployees.length > 0 && <p className="text-xs text-primary-600 mt-1">{selectedEmployees.length} employé(s) sélectionné(s)</p>}
              </div>
            </>
          )}

          {/* ── ETAPE 2 ── */}
          {step === 2 && (
            <>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
                <Users className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700">
                  Pour chaque employé, sélectionnez les{includePeer ? ' <strong>pairs</strong>' : ''}{includePeer && includeDirectReport ? ' et' : ''}{includeDirectReport ? ' <strong>collaborateurs directs</strong>' : ''} qui les évalueront.
                  {includeManager && <span className="block text-xs text-blue-600 mt-0.5">Les managers sont déjà assignés automatiquement via l&apos;organigramme.</span>}
                </p>
              </div>
              <div className="space-y-4">
                {empList.map(emp => {
                  const sel = evaluatorSelections.find(s => s.employee_id === emp.id) || { employee_id: emp.id, peer_ids: [], direct_report_ids: [] };
                  // Pairs : même département, exclure l'employé lui-même
                  const peerCandidates = employees.filter(e =>
                    e.id !== emp.id &&
                    emp.department_id != null &&
                    e.department_id === emp.department_id
                  );
                  // Collaborateurs directs : employés dont le manager est emp
                  const directReportCandidates = employees.filter(e =>
                    e.id !== emp.id && e.manager_id === emp.id
                  );
                  // Fallback si aucun résultat (données manquantes) : tous sauf lui-même
                  const peerList = peerCandidates.length > 0 ? peerCandidates : employees.filter(e => e.id !== emp.id);
                  const directList = directReportCandidates.length > 0 ? directReportCandidates : employees.filter(e => e.id !== emp.id);
                  return (
                    <div key={emp.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold shrink-0">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</span>
                          {emp.department_name && <span className="ml-2 text-xs text-gray-400">{emp.department_name}</span>}
                        </div>
                      </div>
                      {includePeer && (
                        <div className="mb-4">
                          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                            Pairs évaluateurs (max 3)
                            {peerCandidates.length > 0 && <span className="font-normal text-gray-400 ml-1">— collègues du département {emp.department_name}</span>}
                          </label>
                          <PeerSelector all={peerList} selected={sel.peer_ids} onChange={(ids) => updateSel(emp.id, { peer_ids: ids })} maxSelectable={3} placeholder="Rechercher un pair..." />
                        </div>
                      )}
                      {includeDirectReport && (
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                            Collaborateurs directs évaluateurs (max 3)
                            {directReportCandidates.length === 0 && <span className="font-normal text-orange-400 ml-1">— aucun subordonné direct trouvé</span>}
                          </label>
                          <PeerSelector all={directList} selected={sel.direct_report_ids} onChange={(ids) => updateSel(emp.id, { direct_report_ids: ids })} maxSelectable={3} placeholder="Rechercher un collaborateur direct..." />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 flex justify-between gap-3 rounded-b-2xl sticky bottom-0">
          {step === 2
            ? <button onClick={() => setStep(1)} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100 flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Retour</button>
            : <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          }
          <button
            onClick={step === 1 ? handleStep1Next : handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {step === 1 && needsStep2 ? <><ChevronRight className="w-4 h-4" />Suivant : sélectionner les évaluateurs</> : <><Plus className="w-4 h-4" />Créer la campagne</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE
// =============================================

export default function CampaignsPage() {
  const { t } = useI18n();

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      draft: t.performance.draft, active: t.performance.active,
      completed: t.performance.completedStatus, cancelled: t.performance.cancelled,
      archived: t.performance.archived,
    };
    return map[status] || status;
  };

  const getTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      annual: t.performance.annualEval, mid_year: t.performance.midYearEval,
      '360': t.performance.eval360, probation: t.performance.probationEval,
      '1on1_eval': t.performance.interview1on1, '1on1_coaching': t.performance.coaching1on1,
      weekly: t.performance.weeklyReview, '360_feedback': t.performance.feedback360,
      onboarding: t.performance.onboardingEval, trial: t.performance.trialEval,
    };
    return map[type] || type;
  };

  const [campaigns, setCampaigns] = useState<EvaluationCampaign[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRole, setUserRole] = useState('employee');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const user = await fetchCurrentUser();
    if (user) setUserRole(user.role?.toLowerCase() || 'employee');
    const [campaignsData, employeesData] = await Promise.all([fetchCampaigns(showArchived), fetchEmployees()]);
    setCampaigns(campaignsData);
    setEmployees(employeesData);
    setLoading(false);
  }, [showArchived]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('campaigns-add', handler);
    return () => window.removeEventListener('campaigns-add', handler);
  }, []);

  // Ouvrir la modal si on arrive depuis la page Évaluations (bouton "Nouvelle Évaluation")
  useEffect(() => {
    if (sessionStorage.getItem('open-create-campaign') === 'true') {
      sessionStorage.removeItem('open-create-campaign');
      setShowModal(true);
    }
  }, []);

  const canManageCampaigns = ['admin', 'super_admin', 'rh', 'dg'].includes(userRole);

  const handleCancel = async (campaignId: number, campaignName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Annuler la campagne',
      message: `Êtes-vous sûr de vouloir annuler la campagne "${campaignName}" ?\n\nLes évaluations en attente seront également annulées.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(campaignId);
        setOpenMenu(null);
        const result = await cancelCampaign(campaignId);
        setActionLoading(null);
        
        if (result.success) {
          toast.success(`Campagne annulée. ${result.data?.evaluations_cancelled || 0} évaluation(s) annulée(s).`);
          loadData();
        } else {
          toast.error(result.error || 'Erreur lors de l\'annulation');
        }
      }
    });
  };

  const handleArchive = async (campaignId: number, campaignName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Archiver la campagne',
      message: `Êtes-vous sûr de vouloir archiver la campagne "${campaignName}" ?`,
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(campaignId);
        setOpenMenu(null);
        const result = await archiveCampaign(campaignId);
        setActionLoading(null);
        
        if (result.success) {
          toast.success('Campagne archivée avec succès');
          loadData();
        } else {
          toast.error(result.error || 'Erreur lors de l\'archivage');
        }
      }
    });
  };

  const handleRestore = async (campaignId: number, campaignName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restaurer la campagne',
      message: `Êtes-vous sûr de vouloir restaurer la campagne "${campaignName}" ?`,
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(campaignId);
        setOpenMenu(null);
        const result = await restoreCampaign(campaignId);
        setActionLoading(null);
        
        if (result.success) {
          toast.success('Campagne restaurée avec succès');
          loadData();
        } else {
          toast.error(result.error || 'Erreur lors de la restauration');
        }
      }
    });
  };

  // Filtrer les campagnes
  let filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterStatus === 'all' || c.status === filterStatus)
  );
  
  // Cacher les archivées par défaut
  if (!showArchived) {
    filteredCampaigns = filteredCampaigns.filter(c => c.status !== 'archived');
  }
  
  const paginatedCampaigns = filteredCampaigns.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE);

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

  return (
    <>
      <Header title="Campagnes d'Évaluation" subtitle="Gérez les campagnes d'évaluation" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
      {/* Stats KPIs */}
      <PerformanceStats />

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Rechercher une campagne..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            />
          </div>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
            <option value="all">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="completed">Terminé</option>
            <option value="cancelled">Annulé</option>
            {showArchived && <option value="archived">Archivé</option>}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showArchived} 
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300"
            />
            Afficher archivées
          </label>
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          {paginatedCampaigns.length > 0 ? paginatedCampaigns.map(campaign => (
            <div key={campaign.id} className={`p-4 border rounded-xl transition-shadow ${campaign.status === 'archived' ? 'bg-gray-50 border-gray-200' : 'border-gray-200 hover:shadow-md'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <h3 className={`font-semibold ${campaign.status === 'archived' ? 'text-gray-500' : 'text-gray-900'}`}>{campaign.name}</h3>
                  <p className="text-sm text-gray-500">{getTypeLabel(campaign.type)} • {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                    {getStatusLabel(campaign.status)}
                  </span>
                  
                  {/* Menu d'actions pour RH/Admin */}
                  {canManageCampaigns && (
                    <div className="relative">
                      <button 
                        onClick={() => setOpenMenu(openMenu === campaign.id ? null : campaign.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={actionLoading === campaign.id}
                      >
                        {actionLoading === campaign.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      
                      {openMenu === campaign.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                          {/* Annuler - seulement pour active/draft */}
                          {['active', 'draft'].includes(campaign.status) && (
                            <button 
                              onClick={() => handleCancel(campaign.id, campaign.name)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Annuler
                            </button>
                          )}
                          
                          {/* Archiver - seulement pour completed/cancelled */}
                          {['completed', 'cancelled'].includes(campaign.status) && (
                            <button 
                              onClick={() => handleArchive(campaign.id, campaign.name)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                              <Archive className="w-4 h-4" />
                              Archiver
                            </button>
                          )}
                          
                          {/* Restaurer - seulement pour archived */}
                          {campaign.status === 'archived' && (
                            <button 
                              onClick={() => handleRestore(campaign.id, campaign.name)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Restaurer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${campaign.status === 'cancelled' ? 'bg-red-400' : 'bg-primary-500'}`} 
                    style={{ width: `${campaign.progress_percentage}%` }} 
                  />
                </div>
                <span className="text-sm font-medium text-gray-600">{campaign.completed_evaluations}/{campaign.total_evaluations}</span>
                <span className="text-sm text-gray-400">({Math.round(campaign.progress_percentage)}%)</span>
              </div>
            </div>
          )) : (
            <p className="text-gray-500 text-center py-8">Aucune campagne trouvée</p>
          )}
        </div>

        {/* Pagination */}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Modal */}
      <CreateCampaignModal isOpen={showModal} onClose={() => setShowModal(false)} employees={employees} onSuccess={loadData} />
      
      {/* Fermer le menu si on clique ailleurs */}
      {openMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenu(null)} />
      )}

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
      </main>
    </>
  );
}
