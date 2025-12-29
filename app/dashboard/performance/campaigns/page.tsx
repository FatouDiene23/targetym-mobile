'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, X, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight
} from 'lucide-react';

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
}

interface CurrentUser {
  id: number;
  role: string;
}

// =============================================
// API
// =============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';
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

async function fetchCampaigns(): Promise<EvaluationCampaign[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/campaigns?page_size=100`, { headers: getAuthHeaders() });
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

async function createCampaign(data: {
  name: string; description?: string; type: string; start_date: string; end_date: string; employee_ids?: number[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/campaigns`, {
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
    case 'active': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed': return 'Terminé';
    case 'active': return 'Actif';
    case 'draft': return 'Brouillon';
    case 'cancelled': return 'Annulé';
    default: return status;
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'annual': return 'Annuelle';
    case 'mid_year': return 'Mi-année';
    case '360': return '360°';
    case 'probation': return 'Période d\'essai';
    default: return type;
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

function CreateCampaignModal({ isOpen, onClose, employees, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [campaignType, setCampaignType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name || !startDate || !endDate) { setError('Veuillez remplir tous les champs obligatoires'); return; }
    setError(''); setSaving(true);
    const result = await createCampaign({ name, description: description || undefined, type: campaignType, start_date: startDate, end_date: endDate, employee_ids: selectedEmployees.length > 0 ? selectedEmployees : undefined });
    setSaving(false);
    if (result.success) { setName(''); setDescription(''); setCampaignType('annual'); setStartDate(''); setEndDate(''); setSelectedEmployees([]); onSuccess(); onClose(); }
    else setError(result.error || 'Erreur lors de la création');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Nouvelle Campagne</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la campagne *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Évaluation Annuelle 2025" className="w-full px-3 py-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description optionnelle..." className="w-full px-3 py-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
              <option value="annual">Évaluation Annuelle</option>
              <option value="mid_year">Évaluation Mi-Année</option>
              <option value="360">Feedback 360°</option>
              <option value="probation">Fin de Période d&apos;Essai</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de début *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employés concernés</label>
            <p className="text-xs text-gray-500 mb-2">Laissez vide pour inclure tous les employés actifs</p>
            <select multiple value={selectedEmployees.map(String)} onChange={(e) => setSelectedEmployees(Array.from(e.target.selectedOptions, o => parseInt(o.value)))} className="w-full px-3 py-2.5 border rounded-lg text-sm h-32">
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Créer
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
  const [campaigns, setCampaigns] = useState<EvaluationCampaign[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRole, setUserRole] = useState('employee');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const user = await fetchCurrentUser();
    if (user) setUserRole(user.role?.toLowerCase() || 'employee');
    const [campaignsData, employeesData] = await Promise.all([fetchCampaigns(), fetchEmployees()]);
    setCampaigns(campaignsData);
    setEmployees(employeesData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const canManageCampaigns = ['admin', 'super_admin', 'rh', 'dg'].includes(userRole);

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterStatus === 'all' || c.status === filterStatus)
  );
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campagnes d&apos;Évaluation</h1>
          <p className="text-gray-500 mt-1">Gérez les campagnes d&apos;évaluation</p>
        </div>
        {canManageCampaigns && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
            <Plus className="w-4 h-4" />Nouvelle Campagne
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
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
          </select>
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          {paginatedCampaigns.length > 0 ? paginatedCampaigns.map(campaign => (
            <div key={campaign.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                  <p className="text-sm text-gray-500">{getTypeLabel(campaign.type)} • {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>{getStatusLabel(campaign.status)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${campaign.progress_percentage}%` }} />
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
    </div>
  );
}
