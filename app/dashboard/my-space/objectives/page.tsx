'use client';

import { useState, useEffect, useCallback } from 'react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { objectivesTips } from '@/config/pageTips';
import { 
  Target, ChevronDown, ChevronRight, Edit2, Check, X, 
  TrendingUp, AlertCircle, Clock, CheckCircle, Loader2,
  Building2, Users, User
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface KeyResult {
  id: number;
  objective_id: number;
  title: string;
  description?: string;
  target: number;
  current: number;
  unit: string;
  weight: number;
  progress: number;
}

interface Objective {
  id: number;
  title: string;
  description?: string;
  level: 'enterprise' | 'department' | 'individual';
  owner_id?: number;
  owner_name?: string;
  department_name?: string;
  period: string;
  progress: number;
  status: string;
  key_results: KeyResult[];
  parent_id?: number;
}

// ============================================
// API
// ============================================

const API_URL = 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getMyObjectives(employeeId: number): Promise<Objective[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/okr/objectives?owner_id=${employeeId}&page_size=100`, 
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function updateKeyResult(krId: number, current: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/okr/key-results/${krId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================
// HELPERS
// ============================================

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'on_track': 'bg-green-100 text-green-700 border-green-200',
    'at_risk': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'behind': 'bg-red-100 text-red-700 border-red-200',
    'exceeded': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'completed': 'bg-green-100 text-green-700 border-green-200',
    'draft': 'bg-gray-100 text-gray-600 border-gray-200',
    'active': 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-600 border-gray-200';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'on_track': 'En bonne voie',
    'at_risk': 'À risque',
    'behind': 'En retard',
    'exceeded': 'Dépassé',
    'completed': 'Terminé',
    'draft': 'Brouillon',
    'active': 'Actif',
  };
  return labels[status] || status;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'on_track':
    case 'completed':
    case 'exceeded':
      return <CheckCircle className="w-4 h-4" />;
    case 'at_risk':
      return <AlertCircle className="w-4 h-4" />;
    case 'behind':
      return <Clock className="w-4 h-4" />;
    default:
      return <Target className="w-4 h-4" />;
  }
};

const getProgressColor = (progress: number) => {
  if (progress >= 100) return 'bg-indigo-500';
  if (progress >= 70) return 'bg-green-500';
  if (progress >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'enterprise':
      return <Building2 className="w-4 h-4" />;
    case 'department':
      return <Users className="w-4 h-4" />;
    default:
      return <User className="w-4 h-4" />;
  }
};

const getLevelLabel = (level: string) => {
  const labels: Record<string, string> = {
    'enterprise': 'Entreprise',
    'department': 'Département',
    'individual': 'Individuel',
  };
  return labels[level] || level;
};

const getLevelColor = (level: string) => {
  const colors: Record<string, string> = {
    'enterprise': 'bg-purple-100 text-purple-700',
    'department': 'bg-blue-100 text-blue-700',
    'individual': 'bg-teal-100 text-teal-700',
  };
  return colors[level] || 'bg-gray-100 text-gray-700';
};

// ============================================
// COMPONENTS
// ============================================

// Composant pour éditer un Key Result
function KeyResultEditor({ 
  kr, 
  onSave, 
  onCancel 
}: { 
  kr: KeyResult; 
  onSave: (value: number) => void; 
  onCancel: () => void;
}) {
  const [value, setValue] = useState(kr.current.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      alert('Veuillez entrer une valeur valide');
      return;
    }
    setSaving(true);
    await onSave(numValue);
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 px-2 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        min="0"
        step="0.01"
        autoFocus
      />
      <span className="text-sm text-gray-500">/ {kr.target} {kr.unit}</span>
      <button
        onClick={handleSave}
        disabled={saving}
        className="p-1 text-green-600 hover:bg-green-50 rounded"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
      <button
        onClick={onCancel}
        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Composant Key Result
function KeyResultItem({ 
  kr, 
  onUpdate 
}: { 
  kr: KeyResult; 
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const handleSave = async (newValue: number) => {
    const success = await updateKeyResult(kr.id, newValue);
    if (success) {
      setEditing(false);
      onUpdate();
    } else {
      alert('Erreur lors de la mise à jour');
    }
  };

  const progress = kr.target > 0 ? Math.min((kr.current / kr.target) * 100, 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{kr.title}</h4>
          {kr.description && (
            <p className="text-xs text-gray-500 mt-1">{kr.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 ml-2">Poids: {kr.weight}%</span>
      </div>

      <div className="space-y-2">
        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Valeurs */}
        <div className="flex items-center justify-between">
          {editing ? (
            <KeyResultEditor 
              kr={kr} 
              onSave={handleSave} 
              onCancel={() => setEditing(false)} 
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {kr.current} / {kr.target} {kr.unit}
                </span>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                  title="Mettre à jour"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <span className={`text-sm font-bold ${
                progress >= 100 ? 'text-indigo-600' :
                progress >= 70 ? 'text-green-600' :
                progress >= 40 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.round(progress)}%
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Composant Objectif
function ObjectiveCard({ 
  objective, 
  onUpdate 
}: { 
  objective: Objective; 
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <button className="mt-1 text-gray-400">
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getLevelColor(objective.level)}`}>
                  {getLevelIcon(objective.level)}
                  {getLevelLabel(objective.level)}
                </span>
                {objective.department_name && (
                  <span className="text-xs text-gray-500">• {objective.department_name}</span>
                )}
                <span className="text-xs text-gray-500">• {objective.period}</span>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{objective.title}</h3>
              
              {objective.description && (
                <p className="text-sm text-gray-500">{objective.description}</p>
              )}
              
              <div className="flex items-center gap-3 mt-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(objective.status)}`}>
                  {getStatusIcon(objective.status)}
                  {getStatusLabel(objective.status)}
                </span>
                <span className="text-xs text-gray-500">
                  {objective.key_results.length} Key Result{objective.key_results.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Progression */}
          <div className="text-right ml-4">
            <div className="text-3xl font-bold text-gray-900">{Math.round(objective.progress)}%</div>
            <div className="w-32 h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(objective.progress)}`}
                style={{ width: `${Math.min(objective.progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Key Results */}
      {expanded && objective.key_results.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-600" />
            Résultats Clés
          </h4>
          <div className="space-y-3" data-tour="key-results">
            {objective.key_results.map((kr) => (
              <KeyResultItem key={kr.id} kr={kr} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}

      {expanded && objective.key_results.length === 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 text-center">
          <p className="text-sm text-gray-500">Aucun Key Result défini pour cet objectif</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MyObjectivesPage() {
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('objectives');

  const loadObjectives = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const data = await getMyObjectives(employeeId);
      setObjectives(data);
    } catch (error) {
      console.error('Error loading objectives:', error);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    // Récupérer l'ID employé depuis le localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setEmployeeId(userData.employee_id);
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (employeeId) {
      loadObjectives();
    }
  }, [employeeId, loadObjectives]);

  // Calculer les stats
  const totalObjectives = objectives.length;
  const avgProgress = totalObjectives > 0 
    ? Math.round(objectives.reduce((acc, o) => acc + o.progress, 0) / totalObjectives) 
    : 0;
  const onTrack = objectives.filter(o => o.status === 'on_track' || o.status === 'exceeded').length;
  const atRisk = objectives.filter(o => o.status === 'at_risk').length;
  const behind = objectives.filter(o => o.status === 'behind').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
          <p className="text-gray-500">Chargement de vos objectifs...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips tips={objectivesTips} onDismiss={dismissTips} pageTitle="Mes Objectifs" />
      )}
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Mes Objectifs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Suivez et mettez à jour la progression de vos objectifs
        </p>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalObjectives}</p>
                <p className="text-xs text-gray-500">Objectifs</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{avgProgress}%</p>
                <p className="text-xs text-gray-500">Progression</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{onTrack}</p>
                <p className="text-xs text-gray-500">En bonne voie</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{atRisk}</p>
                <p className="text-xs text-gray-500">À risque</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{behind}</p>
                <p className="text-xs text-gray-500">En retard</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Edit2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Comment mettre à jour vos objectifs ?</h3>
              <p className="text-sm text-blue-700 mt-1">
                Cliquez sur l&apos;icône <Edit2 className="w-3 h-3 inline" /> à côté de chaque Key Result pour 
                mettre à jour votre progression. La progression de l&apos;objectif sera recalculée automatiquement.
              </p>
            </div>
          </div>
        </div>

        {/* Objectives List */}
        {objectives.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun objectif assigné</h3>
            <p className="text-gray-500">
              Vous n&apos;avez pas encore d&apos;objectifs assignés. 
              Contactez votre manager pour définir vos OKRs.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-tour="objectives-list">
            {objectives.map((objective) => (
              <ObjectiveCard 
                key={objective.id} 
                objective={objective} 
                onUpdate={loadObjectives}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}