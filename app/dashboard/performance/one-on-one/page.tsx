'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, MapPin, X, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, Video
} from 'lucide-react';
import PerformanceStats from '../components/PerformanceStats';
import Header from '@/components/Header';

// =============================================
// TYPES
// =============================================

interface OneOnOne {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_initials?: string;
  manager_id: number;
  manager_name?: string;
  scheduled_date: string;
  duration_minutes: number;
  location?: string;
  status: string;
  notes?: string;
  action_items?: string[];
  topics?: string[];
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
}

interface CurrentUser {
  id: number;
  role: string;
  employee_id?: number;
}

// =============================================
// API
// =============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://targetym-alb-380014716.eu-west-1.elb.amazonaws.com';
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

async function fetchOneOnOnes(): Promise<OneOnOne[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchEmployees(managerId?: number): Promise<Employee[]> {
  try {
    let url = `${API_URL}/api/employees/?page_size=200&status=active`;
    if (managerId) url += `&manager_id=${managerId}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function createOneOnOne(data: {
  employee_id: number; scheduled_date: string; duration_minutes: number; location?: string; topics?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la création' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
  }
}

// =============================================
// HELPERS
// =============================================

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'scheduled': return 'bg-blue-100 text-blue-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed': return 'Terminé';
    case 'scheduled': return 'Planifié';
    case 'cancelled': return 'Annulé';
    default: return status;
  }
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string | undefined): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// =============================================
// COMPONENTS
// =============================================

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= Math.min(5, totalPages); i++) {
      let pageNum: number;
      if (totalPages <= 5) pageNum = i;
      else if (currentPage <= 3) pageNum = i;
      else if (currentPage >= totalPages - 2) pageNum = totalPages - 5 + i;
      else pageNum = currentPage - 3 + i;
      pages.push(pageNum);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1">
        {getPageNumbers().map(pageNum => (
          <button key={pageNum} onClick={() => onPageChange(pageNum)} className={`w-8 h-8 rounded-lg text-sm font-medium ${currentPage === pageNum ? 'bg-primary-500 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
            {pageNum}
          </button>
        ))}
      </div>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-500 ml-2">Page {currentPage}/{totalPages}</span>
    </div>
  );
}

function CreateOneOnOneModal({ isOpen, onClose, employees, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [topics, setTopics] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!employeeId || !scheduledDate) { setError('Veuillez sélectionner un employé et une date'); return; }
    setError(''); setSaving(true);
    const dateTime = `${scheduledDate}T${scheduledTime}:00`;
    const topicsList = topics.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const result = await createOneOnOne({ 
      employee_id: parseInt(employeeId), 
      scheduled_date: dateTime, 
      duration_minutes: duration, 
      location: location || undefined, 
      topics: topicsList.length > 0 ? topicsList : undefined 
    });
    setSaving(false);
    if (result.success) { 
      setEmployeeId(''); setScheduledDate(''); setScheduledTime('09:00'); 
      setDuration(30); setLocation(''); setTopics(''); 
      onSuccess(); onClose(); 
    }
    else setError(result.error || 'Erreur lors de la création');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Planifier un 1-on-1</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collaborateur *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
              <option value="">Sélectionner un collaborateur</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Heure</label>
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Durée</label>
              <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full px-3 py-2.5 border rounded-lg text-sm">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 heure</option>
                <option value={90}>1h30</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lieu</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bureau, Visio..." className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sujets à aborder</label>
            <textarea value={topics} onChange={(e) => setTopics(e.target.value)} rows={3} placeholder="Un sujet par ligne..." className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" />
          </div>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}Planifier
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE
// =============================================

export default function OneOnOnePage() {
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRole, setUserRole] = useState('employee');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const user = await fetchCurrentUser();
    if (user) setUserRole(user.role?.toLowerCase() || 'employee');
    const role = user?.role?.toLowerCase() || 'employee';
    // Managers: ne charger que leurs N-1
    const managerId = role === 'manager' ? user?.employee_id : undefined;
    const [oneOnOnesData, employeesData] = await Promise.all([fetchOneOnOnes(), fetchEmployees(managerId)]);
    setOneOnOnes(oneOnOnesData);
    setEmployees(employeesData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('one-on-one-add', handler);
    return () => window.removeEventListener('one-on-one-add', handler);
  }, []);

  const canScheduleOneOnOne = ['admin', 'super_admin', 'rh', 'dg', 'manager'].includes(userRole);

  const filteredOneOnOnes = oneOnOnes.filter(o => 
    o.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.manager_name?.toLowerCase().includes(search.toLowerCase())
  );
  const paginatedOneOnOnes = filteredOneOnOnes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredOneOnOnes.length / ITEMS_PER_PAGE);

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
      <Header title="Entretiens 1-1" subtitle="Planifiez et gérez vos entretiens individuels" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
      {/* Stats KPIs */}
      <PerformanceStats />

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Rechercher un entretien..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            />
          </div>
        </div>

        {/* One on Ones List */}
        <div className="space-y-3">
          {paginatedOneOnOnes.length > 0 ? paginatedOneOnOnes.map(meeting => (
            <div key={meeting.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                  {meeting.employee_initials || getInitials(meeting.employee_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">{meeting.employee_name}</h3>
                  <p className="text-sm text-gray-500">avec {meeting.manager_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(meeting.scheduled_date)}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meeting.duration_minutes} min</span>
                    {meeting.location && !meeting.location.startsWith('http') && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meeting.location}</span>}
                  </div>
                </div>
                {meeting.location && meeting.location.startsWith('http') && meeting.status === 'scheduled' && (
                  <a
                    href={meeting.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6264A7] text-white text-xs font-medium rounded-lg hover:bg-[#525399] transition-colors shrink-0"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Rejoindre
                  </a>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>{getStatusLabel(meeting.status)}</span>
              </div>
              {meeting.topics && meeting.topics.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Sujets:</p>
                  <div className="flex flex-wrap gap-1">
                    {meeting.topics.map((topic, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )) : (
            <p className="text-gray-500 text-center py-8">Aucun 1-on-1 trouvé</p>
          )}
        </div>

        {/* Pagination */}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Modal */}
      <CreateOneOnOneModal isOpen={showModal} onClose={() => setShowModal(false)} employees={employees} onSuccess={loadData} />
      </main>
    </>
  );
}
