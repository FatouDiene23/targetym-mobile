'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Target, AlertCircle, CheckCircle, Clock, TrendingUp,
  ChevronDown, ChevronUp, Calendar
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  employee_id?: number;
}

interface KeyResult {
  id: number;
  title: string;
  target_value: number;
  current_value: number;
  unit?: string;
  progress: number;
  due_date?: string;
}

interface Objective {
  id: number;
  title: string;
  description?: string;
  type: 'company' | 'department' | 'team' | 'individual';
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  progress: number;
  start_date?: string;
  end_date?: string;
  key_results: KeyResult[];
  owner_name?: string;
  created_at: string;
}

// ============================================
// API
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getMyObjectives(employeeId: number): Promise<Objective[]> {
  // Essayer de récupérer les objectifs de l'employé
  try {
    const response = await fetch(`${API_URL}/api/okr/objectives?employee_id=${employeeId}`, { 
      headers: getAuthHeaders() 
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || data || [];
  } catch {
    return [];
  }
}

// ============================================
// COMPONENTS
// ============================================

function ProgressBar({ progress, size = 'md' }: { progress: number; size?: 'sm' | 'md' }) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const color = progress >= 100 ? 'bg-green-500' : progress >= 70 ? 'bg-blue-500' : progress >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className={`w-full bg-gray-200 rounded-full ${height}`}>
      <div 
        className={`${color} ${height} rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Brouillon' },
    active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En cours' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Terminé' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Annulé' },
  };
  
  const config = configs[status] || configs.draft;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    company: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Entreprise' },
    department: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Département' },
    team: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Équipe' },
    individual: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Individuel' },
  };
  
  const config = configs[type] || configs.individual;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ObjectiveCard({ objective }: { objective: Objective }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div 
        className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TypeBadge type={objective.type} />
              <StatusBadge status={objective.status} />
            </div>
            <h3 className="font-semibold text-gray-900">{objective.title}</h3>
            {objective.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{objective.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 ml-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">{objective.progress}%</p>
              <p className="text-xs text-gray-500">Progression</p>
            </div>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        <ProgressBar progress={objective.progress} />

        {/* Dates */}
        {(objective.start_date || objective.end_date) && (
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {objective.start_date && (
                <span>Début: {new Date(objective.start_date).toLocaleDateString('fr-FR')}</span>
              )}
              {objective.end_date && (
                <span className="ml-2">Fin: {new Date(objective.end_date).toLocaleDateString('fr-FR')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Key Results (expanded) */}
      {expanded && objective.key_results && objective.key_results.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-5">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Résultats clés</h4>
          <div className="space-y-4">
            {objective.key_results.map((kr) => (
              <div key={kr.id} className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{kr.title}</p>
                  <span className="text-sm font-bold text-primary-600">{kr.progress}%</span>
                </div>
                <ProgressBar progress={kr.progress} size="sm" />
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>
                    {kr.current_value} / {kr.target_value} {kr.unit || ''}
                  </span>
                  {kr.due_date && (
                    <span>Échéance: {new Date(kr.due_date).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No key results message */}
      {expanded && (!objective.key_results || objective.key_results.length === 0) && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 text-center text-sm text-gray-500">
          Aucun résultat clé défini pour cet objectif
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MyObjectivesPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const user = await getCurrentUser();
      if (!user.employee_id) {
        setError('Compte non lié à un profil employé');
        return;
      }

      const data = await getMyObjectives(user.employee_id);
      setObjectives(data);
    } catch (err) {
      console.error(err);
      setError('Erreur de chargement des objectifs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredObjectives = objectives.filter(obj => {
    if (filter === 'all') return true;
    if (filter === 'active') return obj.status === 'active';
    if (filter === 'completed') return obj.status === 'completed';
    return true;
  });

  // Stats
  const stats = {
    total: objectives.length,
    active: objectives.filter(o => o.status === 'active').length,
    completed: objectives.filter(o => o.status === 'completed').length,
    avgProgress: objectives.length > 0 
      ? Math.round(objectives.reduce((acc, o) => acc + o.progress, 0) / objectives.length)
      : 0
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mes Objectifs</h1>
          <p className="text-gray-500 mt-1">Suivez votre progression sur vos objectifs assignés</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                <p className="text-xs text-gray-500">En cours</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                <p className="text-xs text-gray-500">Terminés</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.avgProgress}%</p>
                <p className="text-xs text-gray-500">Progression moy.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'active', label: 'En cours' },
            { key: 'completed', label: 'Terminés' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Objectives List */}
        {filteredObjectives.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun objectif</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "Vous n'avez pas encore d'objectifs assignés."
                : `Aucun objectif ${filter === 'active' ? 'en cours' : 'terminé'}.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredObjectives.map((objective) => (
              <ObjectiveCard key={objective.id} objective={objective} />
            ))}
          </div>
        )}

        {/* Info notice */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note :</strong> Les objectifs sont définis par votre manager. 
            Pour toute question ou mise à jour, contactez-le directement.
          </p>
        </div>
      </div>
    </div>
  );
}
