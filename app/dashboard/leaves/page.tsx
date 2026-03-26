'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  Calendar, Clock, CheckCircle, XCircle, AlertCircle,
  Download, RefreshCw, Users, Settings, BarChart3, CalendarDays,
  ChevronLeft, ChevronRight, X, Search, Plus, Brain, Sparkles
} from 'lucide-react';
import Header from '@/components/Header';
import Pagination from '@/components/Pagination';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { leavesTips } from '@/config/pageTips';

// ============================================
// TYPES
// ============================================

interface LeaveType {
  id: number;
  name: string;
  code: string;
  default_days: number;
  is_annual?: boolean;
  accrual_rate?: number;
  max_carryover?: number | null;
  is_active: boolean;
  requires_justification?: boolean;
  description?: string;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  department_name?: string;
  leave_type_id: number;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: string;
  created_at: string;
  approved_at?: string;
  approved_by_name?: string;
  rejection_reason?: string;
}

interface LeaveStats {
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  on_leave_today: number;
  avg_days_per_request: number;
}

interface Department {
  id: number;
  name: string;
}

interface OkrAtRisk {
  id: number;
  title: string;
  period: string;
  end_date: string | null;
  progress: number;
  deadline_during_leave: boolean;
  days_until_deadline: number | null;
  key_results: Array<{ title: string; progress: number; current: number; target: number }>;
}

interface OkrImpact {
  has_okrs: boolean;
  okrs_at_risk: OkrAtRisk[];
  warning_level: 'none' | 'low' | 'medium' | 'high';
  message: string | null;
}

interface ManagerSuggestion {
  recommendation: 'approve' | 'caution' | 'review';
  color: string;
  ai_text: string;
  okrs_at_risk: OkrAtRisk[];
  has_okr_issues: boolean;
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

async function getLeaveTypes(): Promise<LeaveType[]> {
  const response = await fetch(`${API_URL}/api/leaves/types`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function getLeaveRequests(params: {
  status?: string;
  department_id?: number;
  leave_type_id?: number;
  page?: number;
  page_size?: number;
}): Promise<{ items: LeaveRequest[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.status && params.status !== 'all') searchParams.append('status', params.status);
  if (params.department_id) searchParams.append('department_id', params.department_id.toString());
  if (params.leave_type_id) searchParams.append('leave_type_id', params.leave_type_id.toString());
  searchParams.append('page', (params.page || 1).toString());
  searchParams.append('page_size', (params.page_size || 20).toString());

  const response = await fetch(`${API_URL}/api/leaves/requests?${searchParams}`, { headers: getAuthHeaders() });
  if (!response.ok) return { items: [], total: 0 };
  return response.json();
}

async function getLeaveStats(): Promise<LeaveStats> {
  try {
    const response = await fetch(`${API_URL}/api/leaves/stats`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const total = data.total_requests || 0;
    const days = data.total_days_taken || 0;
    return {
      total_requests: total,
      pending: data.pending_requests ?? data.pending ?? 0,
      approved: data.approved_requests ?? data.approved ?? 0,
      rejected: data.rejected_requests ?? data.rejected ?? 0,
      on_leave_today: data.on_leave_today ?? 0,
      avg_days_per_request: total > 0 ? Math.round((days / total) * 10) / 10 : 0,
    };
  } catch {
    return {
      total_requests: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      on_leave_today: 0,
      avg_days_per_request: 0
    };
  }
}

async function getLeaveCalendar(year: number, month: number): Promise<LeaveRequest[]> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    const response = await fetch(
      `${API_URL}/api/leaves/calendar?start_date=${startDate}&end_date=${endDate}`, 
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.entries || [];
  } catch {
    return [];
  }
}
async function getDepartments(): Promise<Department[]> {
  const response = await fetch(`${API_URL}/api/departments`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function approveLeaveRequest(requestId: number, approved: boolean, rejectionReason?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${requestId}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved, rejection_reason: rejectionReason }),
  });
  if (!response.ok) throw new Error('Erreur');
}

async function createLeaveType(data: Partial<LeaveType>): Promise<LeaveType> {
  const response = await fetch(`${API_URL}/api/leaves/types`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function updateLeaveType(id: number, data: Partial<LeaveType>): Promise<LeaveType> {
  const response = await fetch(`${API_URL}/api/leaves/types/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function initializeAllBalances(year: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/balances/initialize-all?year=${year}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur');
}

async function submitLeaveRequest(data: {
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
}): Promise<void> {
  const { employee_id, ...body } = data;
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employee_id}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur création demande');
  }
}

async function getOkrImpact(employeeId: number, startDate: string, endDate: string): Promise<OkrImpact> {
  const response = await fetch(
    `${API_URL}/api/ai/leave-okr-impact?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Erreur impact OKR');
  return response.json();
}

async function fetchManagerSuggestion(leaveRequestId: number): Promise<ManagerSuggestion> {
  const response = await fetch(
    `${API_URL}/api/ai/leave-manager-suggestion/${leaveRequestId}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Erreur suggestion manager');
  return response.json();
}

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En attente' },
    approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approuvé' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Annulé' },
  };
  const config = configs[status] || configs.pending;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function StatCard({ icon: Icon, value, label, color }: { 
  icon: React.ElementType; 
  value: number | string; 
  label: string; 
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Calendar Component
function LeaveCalendar({ 
  year, 
  month, 
  leaves,
  onPrevMonth,
  onNextMonth
}: { 
  year: number; 
  month: number; 
  leaves: LeaveRequest[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = (firstDay.getDay() + 6) % 7; // Lundi = 0

  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getLeavesForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const current = new Date(dateStr);
      return current >= start && current <= end && leave.status === 'approved';
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-600" />
          Calendrier des absences
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={onPrevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-medium text-gray-900 min-w-[150px] text-center">
            {monthNames[month - 1]} {year}
          </span>
          <button onClick={onNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          const dayLeaves = day ? getLeavesForDay(day) : [];
          const isToday = day === new Date().getDate() && 
                          month === new Date().getMonth() + 1 && 
                          year === new Date().getFullYear();
          
          return (
            <div
              key={index}
              className={`min-h-[80px] p-1 border border-gray-100 rounded-lg ${
                day ? 'bg-white' : 'bg-gray-50'
              } ${isToday ? 'ring-2 ring-primary-500' : ''}`}
            >
              {day && (
                <>
                  <span className={`text-sm ${isToday ? 'font-bold text-primary-600' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayLeaves.slice(0, 2).map((leave, i) => (
                      <div
                        key={i}
                        className="text-xs px-1 py-0.5 bg-orange-100 text-orange-800 rounded truncate"
                        title={`${leave.employee_name} - ${leave.leave_type_name}`}
                      >
                        {leave.employee_name?.split(' ')[0]}
                      </div>
                    ))}
                    {dayLeaves.length > 2 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayLeaves.length - 2}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Leave Types Settings Modal
function LeaveTypesModal({ 
  isOpen, 
  onClose,
  leaveTypes,
  onRefresh
}: { 
  isOpen: boolean; 
  onClose: () => void;
  leaveTypes: LeaveType[];
  onRefresh: () => void;
}) {
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [newType, setNewType] = useState({ name: '', code: '', default_days: 0, is_annual: false, accrual_rate: 2.0, max_carryover: null as number | null });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveEdit = async () => {
    if (!editingType) return;
    setSaving(true);
    try {
      await updateLeaveType(editingType.id, editingType);
      onRefresh();
      setEditingType(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddType = async () => {
    if (!newType.name || !newType.code) return;
    setSaving(true);
    try {
      await createLeaveType({ ...newType, is_active: true });
      onRefresh();
      setNewType({ name: '', code: '', default_days: 0, is_annual: false, accrual_rate: 2.0, max_carryover: null });
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              Types de congés
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {leaveTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                {editingType?.id === type.id ? (
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editingType.name}
                      onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Nom"
                    />
                    <input
                      type="text"
                      value={editingType.code}
                      onChange={(e) => setEditingType({ ...editingType, code: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Code"
                    />
                    <label className="flex items-center gap-2 text-sm col-span-full">
                      <input
                        type="checkbox"
                        checked={!!editingType.is_annual}
                        onChange={(e) => setEditingType({ ...editingType, is_annual: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      Congé annuel (acquisition mensuelle)
                    </label>
                    {editingType.is_annual ? (
                      <>
                        <input
                          type="number"
                          step="0.5"
                          value={editingType.accrual_rate ?? 2}
                          onChange={(e) => setEditingType({ ...editingType, accrual_rate: parseFloat(e.target.value) || 0 })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Taux mensuel (j/mois)"
                        />
                        <input
                          type="number"
                          value={editingType.max_carryover ?? ''}
                          onChange={(e) => setEditingType({ ...editingType, max_carryover: e.target.value ? parseInt(e.target.value) : null })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Plafond report (vide = illimité)"
                        />
                      </>
                    ) : (
                      <input
                        type="number"
                        value={editingType.default_days}
                        onChange={(e) => setEditingType({ ...editingType, default_days: parseInt(e.target.value) || 0 })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Quota (jours)"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{type.name}</span>
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{type.code}</span>
                      {type.is_annual ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Annuel &mdash; {type.accrual_rate ?? 2}j/mois</span>
                      ) : (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Spécial &mdash; {type.default_days} j</span>
                      )}
                      {!type.is_active && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inactif</span>
                      )}
                    </div>
                    {type.is_annual && type.max_carryover != null && (
                      <p className="text-xs text-gray-500 mt-0.5">Plafond report : {type.max_carryover} j</p>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2 ml-4">
                  {editingType?.id === type.id ? (
                    <>
                      <button
                        onClick={() => setEditingType(null)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {saving ? '...' : 'Sauver'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingType(type)}
                      className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new type */}
          {showAddForm ? (
            <div className="mt-4 p-4 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={newType.name}
                  onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Nom du type"
                />
                <input
                  type="text"
                  value={newType.code}
                  onChange={(e) => setNewType({ ...newType, code: e.target.value.toUpperCase() })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Code (ex: CP)"
                />
                <label className="flex items-center gap-2 text-sm col-span-full">
                  <input
                    type="checkbox"
                    checked={newType.is_annual}
                    onChange={(e) => setNewType({ ...newType, is_annual: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Congé annuel (acquisition mensuelle)
                </label>
                {newType.is_annual ? (
                  <>
                    <input
                      type="number"
                      step="0.5"
                      value={newType.accrual_rate}
                      onChange={(e) => setNewType({ ...newType, accrual_rate: parseFloat(e.target.value) || 0 })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Taux mensuel (j/mois)"
                    />
                    <input
                      type="number"
                      value={newType.max_carryover ?? ''}
                      onChange={(e) => setNewType({ ...newType, max_carryover: e.target.value ? parseInt(e.target.value) : null })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Plafond report (vide = illimité)"
                    />
                  </>
                ) : (
                  <input
                    type="number"
                    value={newType.default_days || ''}
                    onChange={(e) => setNewType({ ...newType, default_days: parseInt(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Quota (jours)"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddType}
                  disabled={saving || !newType.name || !newType.code}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un type de congé
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Initialize Balances Modal
function InitializeBalancesModal({ 
  isOpen, 
  onClose,
  onSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInitialize = async () => {
    setLoading(true);
    setError('');
    try {
      await initializeAllBalances(year);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      setError('Erreur lors de l\'initialisation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Initialiser les soldes</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Année
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              Cette action va initialiser les soldes de congés pour tous les employés actifs pour l&apos;année {year}.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-amber-800">
              <strong>Attention :</strong> Les soldes existants pour cette année seront remplacés.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleInitialize}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Initialisation...' : 'Initialiser'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Request Action Modal
function RequestActionModal({
  request,
  onClose,
  onSuccess
}: {
  request: LeaveRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<ManagerSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAction = async (approved: boolean) => {
    if (!request) return;
    if (!approved && !rejectionReason.trim()) {
      toast.error('Veuillez indiquer un motif de refus');
      return;
    }
    
    setLoading(true);
    try {
      await approveLeaveRequest(request.id, approved, approved ? undefined : rejectionReason);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!request) return;
    setAiLoading(true);
    try {
      const suggestion = await fetchManagerSuggestion(request.id);
      setAiSuggestion(suggestion);
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de l\'analyse IA');
    } finally {
      setAiLoading(false);
    }
  };

  if (!request) return null;

  const suggestionBg: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    gray: 'bg-gray-50 border-gray-200',
  };
  const suggestionLabel: Record<string, string> = {
    approve: '✅ Recommandation : Approuver',
    caution: '⚠️ Recommandation : Approuver avec précautions',
    review: '🔍 Recommandation : Examiner avec attention',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {request.status === 'pending' ? 'Traiter la demande' : 'Détail de la demande'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">{request.employee_name}</p>
            <p className="text-sm text-primary-600">{request.leave_type_name}</p>
            <p className="text-sm text-gray-500 mt-2">
              {new Date(request.start_date).toLocaleDateString('fr-FR')} → {new Date(request.end_date).toLocaleDateString('fr-FR')}
              <span className="ml-2 font-medium">({request.days_requested} jour(s))</span>
            </p>
            {request.reason && (
              <p className="text-sm text-gray-500 mt-2 italic">&quot;{request.reason}&quot;</p>
            )}
            {request.status !== 'pending' && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <StatusBadge status={request.status} />
                {request.approved_by_name && (
                  <p className="text-xs text-gray-500 mt-1">Par {request.approved_by_name}</p>
                )}
                {request.rejection_reason && (
                  <p className="text-xs text-red-600 mt-1">Motif : {request.rejection_reason}</p>
                )}
              </div>
            )}
          </div>

          {/* AI Suggestion button + panel */}
          {request.status === 'pending' && (
            <div className="mb-4">
              {aiSuggestion ? (
                <div className={`rounded-lg border p-4 ${suggestionBg[aiSuggestion.color] || suggestionBg.gray}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">
                      {suggestionLabel[aiSuggestion.recommendation]}
                    </p>
                    <button
                      onClick={() => setAiSuggestion(null)}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-line">{aiSuggestion.ai_text}</p>
                  {aiSuggestion.has_okr_issues && (
                    <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                      <p className="text-xs font-medium mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> OKRs concernés :
                      </p>
                      <ul className="pl-4 list-disc space-y-0.5">
                        {aiSuggestion.okrs_at_risk.map((o) => (
                          <li key={o.id} className="text-xs">
                            {o.title} — {o.progress.toFixed(0)}%
                            {o.deadline_during_leave && <span className="text-red-600 font-medium"> ⚠ deadline {o.end_date}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleAiAnalysis}
                  disabled={aiLoading}
                  className="w-full px-4 py-2 border border-purple-300 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {aiLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      Analyse en cours…
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Analyse IA (OKRs + recommandation)
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {request.status === 'pending' ? (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif de refus (si refusé)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                  placeholder="Indiquez le motif du refus..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Refuser
                </button>
                <button
                  onClick={() => handleAction(true)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approuver
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// NEW LEAVE REQUEST MODAL (Employee + OKR alert)
// ============================================

function NewLeaveRequestModal({
  isOpen,
  onClose,
  leaveTypes,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  leaveTypes: LeaveType[];
  onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [okrImpact, setOkrImpact] = useState<OkrImpact | null>(null);
  const [okrLoading, setOkrLoading] = useState(false);

  // Fetch OKR impact whenever employee + both dates are set
  useEffect(() => {
    if (!employeeId || !startDate || !endDate) {
      setOkrImpact(null);
      return;
    }
    const id = Number.parseInt(employeeId);
    if (Number.isNaN(id) || endDate < startDate) {
      setOkrImpact(null);
      return;
    }
    let cancelled = false;
    setOkrLoading(true);
    getOkrImpact(id, startDate, endDate)
      .then((data) => { if (!cancelled) setOkrImpact(data); })
      .catch(() => { if (!cancelled) setOkrImpact(null); })
      .finally(() => { if (!cancelled) setOkrLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, startDate, endDate]);

  const handleSubmit = async () => {
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      await submitLeaveRequest({
        employee_id: Number.parseInt(employeeId),
        leave_type_id: Number.parseInt(leaveTypeId),
        start_date: startDate,
        end_date: endDate,
        reason: reason || undefined,
      });
      toast.success('Demande créée avec succès');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const warningColors = {
    none: '',
    low: 'bg-blue-50 border-blue-200 text-blue-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-red-50 border-red-200 text-red-800',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Nouvelle demande de congé
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Employee ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Employé <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="ex: 42"
              />
            </div>

            {/* Leave type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de congé <span className="text-red-500">*</span>
              </label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">-- Choisir --</option>
                {leaveTypes.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Début <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* OKR Impact */}
            {okrLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                Analyse de l&apos;impact OKR…
              </div>
            )}
            {!okrLoading && okrImpact && okrImpact.has_okrs && okrImpact.warning_level !== 'none' && (
              <div className={`rounded-lg border p-4 ${warningColors[okrImpact.warning_level]}`}>
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{okrImpact.message}</p>
                </div>
                <ul className="mt-2 space-y-1 pl-6 list-disc text-xs">
                  {okrImpact.okrs_at_risk.map((o) => (
                    <li key={o.id}>
                      <span className="font-medium">{o.title}</span>
                      {' '}— {o.progress.toFixed(0)}% complété
                      {o.deadline_during_leave && (
                        <span className="ml-1 font-semibold text-red-700">⚠ deadline le {o.end_date}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif (optionnel)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={2}
                placeholder="Motif de la demande…"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi…</>
              ) : (
                <>Envoyer la demande</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function LeavesManagementPage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'calendar' | 'settings'>('requests');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<LeaveStats | null>(null);
  const [calendarLeaves, setCalendarLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('leaves');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>();
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<number | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Calendar
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);

  // Modals
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showNewLeaveModal, setShowNewLeaveModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [typesData, deptData, statsData] = await Promise.all([
        getLeaveTypes(),
        getDepartments(),
        getLeaveStats()
      ]);
      setLeaveTypes(typesData);
      setDepartments(deptData);
      setStats(statsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    const data = await getLeaveRequests({
      status: statusFilter,
      department_id: departmentFilter,
      leave_type_id: leaveTypeFilter,
      page,
      page_size: 10
    });
    setRequests(data.items);
    setTotalRequests(data.total);
  }, [statusFilter, departmentFilter, leaveTypeFilter, page]);

  const loadCalendar = useCallback(async () => {
    const data = await getLeaveCalendar(calendarYear, calendarMonth);
    setCalendarLeaves(data);
  }, [calendarYear, calendarMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (activeTab === 'calendar') {
      loadCalendar();
    }
  }, [activeTab, loadCalendar]);

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const exportToCSV = () => {
    const rows = requests.map(r => [
      r.employee_name ?? '',
      r.department_name ?? '',
      r.leave_type_name ?? '',
      r.start_date ?? '',
      r.end_date ?? '',
      r.days_requested ?? '',
      r.status ?? '',
      r.reason ?? '',
    ]);
    const header = ['Employé', 'Département', 'Type', 'Début', 'Fin', 'Jours', 'Statut', 'Motif'];
    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conges_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRequests = requests.filter(r => {
    if (!searchTerm) return true;
    return r.employee_name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <>
        <Header title="Gestion des Congés" subtitle="Administration des congés et absences" />
        <div className="flex-1 flex items-center justify-center p-20">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Gestion des Congés" subtitle="Administration des congés et absences" />
      {showTips && (
        <PageTourTips
          tips={leavesTips}
          onDismiss={dismissTips}
          pageTitle="Gestion des Congés"
        />
      )}
      <div className="py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Actions */}
        <div className="flex justify-end gap-3 mb-6">
            <button
              onClick={() => setShowNewLeaveModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle demande
            </button>
            <button
              onClick={() => setShowInitModal(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Initialiser soldes
            </button>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          </div>

        {/* Stats */}
        {stats && (
          <div data-tour="leaves-stats" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <StatCard icon={BarChart3} value={stats.total_requests} label="Total demandes" color="bg-blue-500" />
            <StatCard icon={Clock} value={stats.pending} label="En attente" color="bg-yellow-500" />
            <StatCard icon={CheckCircle} value={stats.approved} label="Approuvées" color="bg-green-500" />
            <StatCard icon={XCircle} value={stats.rejected} label="Refusées" color="bg-red-500" />
            <StatCard icon={Users} value={stats.on_leave_today} label="En congés auj." color="bg-orange-500" />
            <StatCard icon={Calendar} value={`${stats.avg_days_per_request}j`} label="Moy. jours/dem." color="bg-purple-500" />
          </div>
        )}

        {/* Tabs */}
        <div data-tour="leaves-tabs" className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: 'requests', label: 'Demandes', icon: Clock },
            { key: 'calendar', label: 'Calendrier', icon: CalendarDays },
            { key: 'settings', label: 'Paramètres', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Filters */}
            <div data-tour="leaves-filters" className="p-4 border-b border-gray-200 flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Rechercher un employé..."
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvées</option>
                <option value="rejected">Refusées</option>
              </select>
              <select
                value={departmentFilter || ''}
                onChange={(e) => { setDepartmentFilter(e.target.value ? parseInt(e.target.value) : undefined); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              <select
                value={leaveTypeFilter || ''}
                onChange={(e) => { setLeaveTypeFilter(e.target.value ? parseInt(e.target.value) : undefined); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Tous les types</option>
                {leaveTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={loadRequests}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Actualiser"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{request.employee_name}</p>
                          <p className="text-sm text-gray-500">{request.department_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{request.leave_type_name}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(request.start_date).toLocaleDateString('fr-FR')}
                        {request.start_date !== request.end_date && (
                          <> → {new Date(request.end_date).toLocaleDateString('fr-FR')}</>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{request.days_requested}</td>
                      <td className="px-4 py-4"><StatusBadge status={request.status} /></td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {request.status === 'pending' ? 'Traiter' : 'Voir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRequests.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Aucune demande trouvée</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <Pagination page={page} total={totalRequests} pageSize={10} onPageChange={setPage} />
          </div>
        )}

        {activeTab === 'calendar' && (
          <LeaveCalendar
            year={calendarYear}
            month={calendarMonth}
            leaves={calendarLeaves}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                Types de congés
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Configurez les différents types de congés disponibles.
              </p>
              <button
                onClick={() => setShowTypesModal(true)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Gérer les types
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary-600" />
                Initialisation annuelle
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Initialisez les soldes de congés pour tous les employés.
              </p>
              <button
                onClick={() => setShowInitModal(true)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Initialiser les soldes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Modals */}
      <LeaveTypesModal
        isOpen={showTypesModal}
        onClose={() => setShowTypesModal(false)}
        leaveTypes={leaveTypes}
        onRefresh={loadData}
      />

      <InitializeBalancesModal
        isOpen={showInitModal}
        onClose={() => setShowInitModal(false)}
        onSuccess={() => { loadData(); loadRequests(); }}
      />

      <RequestActionModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onSuccess={() => { loadRequests(); loadData(); }}
      />

      <NewLeaveRequestModal
        isOpen={showNewLeaveModal}
        onClose={() => setShowNewLeaveModal(false)}
        leaveTypes={leaveTypes}
        onSuccess={() => { loadRequests(); loadData(); }}
      />
    </>
  );
}
