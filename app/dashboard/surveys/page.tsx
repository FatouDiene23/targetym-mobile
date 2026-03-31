'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Loader2, X, ChevronLeft, ChevronRight,
  Calendar, Filter, Eye, Edit3, Play, Square, Archive,
  BarChart3, Users, CheckCircle, Clock, ChevronUp, ChevronDown,
  Trash2, MessageSquare, PieChart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth, API_URL, getDepartments, getEmployees, type Employee } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell,
} from 'recharts';

// ── Types ───────────────────────────────────────────────────────────────────

interface Survey {
  id: number;
  tenant_id: number;
  title: string;
  description?: string;
  survey_type: string;
  status: string;
  is_anonymous: boolean;
  frequency: string;
  start_date?: string;
  end_date?: string;
  created_by_id?: number;
  is_template: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SurveyDetail extends Survey {
  questions: SurveyQuestion[];
  total_responses: number;
  completed_responses: number;
  completion_rate: number;
}

interface SurveyQuestion {
  id: number;
  tenant_id: number;
  survey_id: number;
  question_text: string;
  question_type: string;
  options?: string[];
  is_required: boolean;
  order_index: number;
  created_at?: string;
}

interface SurveyTarget {
  id: number;
  tenant_id: number;
  survey_id: number;
  target_type: string;
  target_id?: number;
  created_at?: string;
}

interface QuestionResult {
  question_id: number;
  question_text: string;
  question_type: string;
  total_answers: number;
  average?: number;
  distribution?: Record<string, number>;
  yes_percent?: number;
  no_percent?: number;
  text_answers?: string[];
}

interface SurveyResults {
  survey_id: number;
  title: string;
  total_responses: number;
  completed_responses: number;
  completion_rate: number;
  questions: QuestionResult[];
}

interface SurveyEmployeeResponse {
  id: number;
  survey_id: number;
  employee_id?: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  employee_name?: string;
}

interface Department {
  id: number;
  name: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  cloturee: { label: 'Clôturée', color: 'bg-blue-100 text-blue-700' },
  archivee: { label: 'Archivée', color: 'bg-red-100 text-red-700' },
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  pulse: { label: 'Pulse', color: 'bg-purple-100 text-purple-700' },
  ad_hoc: { label: 'Ad hoc', color: 'bg-indigo-100 text-indigo-700' },
};

const FREQUENCY_LABELS: Record<string, string> = {
  hebdomadaire: 'Hebdomadaire',
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  ponctuel: 'Ponctuel',
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  likert_5: 'Likert 1-5',
  likert_10: 'Likert 1-10',
  oui_non: 'Oui / Non',
  choix_multiple: 'Choix multiple',
  texte_libre: 'Texte libre',
};

const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];
const BAR_COLOR = '#3B82F6';

// ── Component ───────────────────────────────────────────────────────────────

export default function SurveysPage() {
  // Auth
  const [userRole, setUserRole] = useState('');

  // List
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    survey_type: 'pulse' as string,
    is_anonymous: true,
    frequency: 'ponctuel' as string,
    start_date: '',
    end_date: '',
  });
  const [formQuestions, setFormQuestions] = useState<{
    question_text: string;
    question_type: string;
    options: string[];
    is_required: boolean;
  }[]>([]);
  const [targetMode, setTargetMode] = useState<'all' | 'department' | 'employee'>('all');
  const [selectedDepartments, setSelectedDepartments] = useState<number[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Detail view
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'questions' | 'results' | 'responses'>('questions');
  const [surveyResults, setSurveyResults] = useState<SurveyResults | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<SurveyEmployeeResponse[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── API helpers ─────────────────────────────────────────────────────────

  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetchWithAuth(`${API_URL}${path}`, options || {});
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Erreur ${res.status}` }));
      throw new Error(err.detail || `Erreur ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }, []);

  // ── Load surveys ────────────────────────────────────────────────────────

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', '20');
      if (filterType) params.set('survey_type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      const data = await apiFetch(`/api/surveys/?${params}`);
      setSurveys(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterStatus, apiFetch]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || 'employee');
    loadSurveys();
  }, [loadSurveys]);

  // ── Load departments & employees for targets ───────────────────────────

  const loadTargetData = useCallback(async () => {
    try {
      const [depts, emps] = await Promise.all([
        getDepartments(),
        getEmployees({ page_size: 500 }).then(r => r.items || r),
      ]);
      setDepartments(depts as Department[]);
      setEmployees(Array.isArray(emps) ? emps : []);
    } catch {
      // non-blocking
    }
  }, []);

  // ── Detail ──────────────────────────────────────────────────────────────

  const openDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    setDetailTab('questions');
    setSurveyResults(null);
    setSurveyResponses([]);
    try {
      const data = await apiFetch(`/api/surveys/${id}`);
      setSelectedSurvey(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }, [apiFetch]);

  const loadResults = useCallback(async (id: number) => {
    try {
      const data = await apiFetch(`/api/surveys/${id}/results`);
      setSurveyResults(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [apiFetch]);

  const loadResponses = useCallback(async (id: number) => {
    try {
      const data = await apiFetch(`/api/surveys/${id}/responses`);
      setSurveyResponses(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [apiFetch]);

  // ── Create ──────────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setFormData({ title: '', description: '', survey_type: 'pulse', is_anonymous: true, frequency: 'ponctuel', start_date: '', end_date: '' });
    setFormQuestions([]);
    setTargetMode('all');
    setSelectedDepartments([]);
    setSelectedEmployees([]);
    setCreateStep(1);
    setShowCreateModal(true);
    loadTargetData();
  };

  const addQuestion = () => {
    setFormQuestions([...formQuestions, { question_text: '', question_type: 'likert_5', options: [], is_required: true }]);
  };

  const removeQuestion = (idx: number) => {
    setFormQuestions(formQuestions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...formQuestions];
    (updated[idx] as any)[field] = value;
    setFormQuestions(updated);
  };

  const moveQuestion = (idx: number, dir: 'up' | 'down') => {
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === formQuestions.length - 1)) return;
    const updated = [...formQuestions];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setFormQuestions(updated);
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) { toast.error('Le titre est obligatoire'); return; }
    if (formQuestions.length === 0) { toast.error('Ajoutez au moins une question'); return; }
    if (formQuestions.some(q => !q.question_text.trim())) { toast.error('Toutes les questions doivent avoir un texte'); return; }

    setCreating(true);
    try {
      // 1. Créer l'enquête
      const survey = await apiFetch('/api/surveys/', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          survey_type: formData.survey_type,
          is_anonymous: formData.is_anonymous,
          frequency: formData.frequency,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }),
      });

      // 2. Ajouter les questions
      for (let i = 0; i < formQuestions.length; i++) {
        const q = formQuestions[i];
        await apiFetch(`/api/surveys/${survey.id}/questions`, {
          method: 'POST',
          body: JSON.stringify({
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.question_type === 'choix_multiple' ? q.options : null,
            is_required: q.is_required,
            order_index: i,
          }),
        });
      }

      // 3. Définir les cibles
      let targets: { target_type: string; target_id?: number }[] = [];
      if (targetMode === 'all') {
        targets = [{ target_type: 'all' }];
      } else if (targetMode === 'department') {
        targets = selectedDepartments.map(id => ({ target_type: 'department', target_id: id }));
      } else if (targetMode === 'employee') {
        targets = selectedEmployees.map(id => ({ target_type: 'employee', target_id: id }));
      }
      if (targets.length > 0) {
        await apiFetch(`/api/surveys/${survey.id}/targets`, {
          method: 'POST',
          body: JSON.stringify(targets),
        });
      }

      // 4. Activer si étape 4
      if (createStep === 4) {
        try {
          await apiFetch(`/api/surveys/${survey.id}/activate`, { method: 'POST' });
          toast.success('Enquête créée et activée');
        } catch {
          toast.success('Enquête créée en brouillon');
        }
      } else {
        toast.success('Enquête créée en brouillon');
      }

      setShowCreateModal(false);
      loadSurveys();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────

  const activateSurvey = async (id: number) => {
    try {
      await apiFetch(`/api/surveys/${id}/activate`, { method: 'POST' });
      toast.success('Enquête activée');
      loadSurveys();
      if (selectedSurvey?.id === id) openDetail(id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const closeSurvey = async (id: number) => {
    try {
      await apiFetch(`/api/surveys/${id}/close`, { method: 'POST' });
      toast.success('Enquête clôturée');
      loadSurveys();
      if (selectedSurvey?.id === id) openDetail(id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const archiveSurvey = async (id: number) => {
    try {
      await apiFetch(`/api/surveys/${id}`, { method: 'DELETE' });
      toast.success('Enquête archivée');
      if (selectedSurvey?.id === id) setSelectedSurvey(null);
      loadSurveys();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Filtered surveys ───────────────────────────────────────────────────

  const filteredSurveys = surveys.filter(s =>
    !searchText || s.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const isAdminOrRH = ['admin', 'rh', 'dg', 'dga', 'super_admin'].includes(userRole);

  // ── Render ──────────────────────────────────────────────────────────────

  // Detail view
  if (selectedSurvey) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Back button */}
        <button onClick={() => setSelectedSurvey(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ChevronLeft className="w-4 h-4" /> Retour aux enquêtes
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{selectedSurvey.title}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedSurvey.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_COLORS[selectedSurvey.status]?.label || selectedSurvey.status}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_LABELS[selectedSurvey.survey_type]?.color || 'bg-gray-100 text-gray-700'}`}>
                  {TYPE_LABELS[selectedSurvey.survey_type]?.label || selectedSurvey.survey_type}
                </span>
              </div>
              {selectedSurvey.description && <p className="mt-2 text-gray-600">{selectedSurvey.description}</p>}
              <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
                {selectedSurvey.start_date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Du {selectedSurvey.start_date}</span>}
                {selectedSurvey.end_date && <span>au {selectedSurvey.end_date}</span>}
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {selectedSurvey.completed_responses}/{selectedSurvey.total_responses} réponses</span>
                <span className="flex items-center gap-1"><BarChart3 className="w-4 h-4" /> {selectedSurvey.completion_rate}%</span>
                {selectedSurvey.is_anonymous && <span className="text-purple-600 font-medium">Anonyme</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {selectedSurvey.status === 'brouillon' && isAdminOrRH && (
                <button onClick={() => activateSurvey(selectedSurvey.id)} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center gap-1">
                  <Play className="w-4 h-4" /> Activer
                </button>
              )}
              {selectedSurvey.status === 'active' && isAdminOrRH && (
                <button onClick={() => closeSurvey(selectedSurvey.id)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm flex items-center gap-1">
                  <Square className="w-4 h-4" /> Clôturer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px space-x-8">
            {(['questions', 'results', 'responses'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setDetailTab(tab);
                  if (tab === 'results' && !surveyResults) loadResults(selectedSurvey.id);
                  if (tab === 'responses') loadResponses(selectedSurvey.id);
                }}
                className={`py-3 px-1 border-b-2 text-sm font-medium ${
                  detailTab === tab
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'questions' && 'Questions'}
                {tab === 'results' && 'Résultats'}
                {tab === 'responses' && 'Réponses'}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Questions tab */}
          {detailTab === 'questions' && (
            <div className="space-y-4">
              {selectedSurvey.questions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune question</p>
              ) : (
                selectedSurvey.questions.map((q, i) => (
                  <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs text-gray-400 font-medium">Q{i + 1}</span>
                        <p className="font-medium text-gray-900 mt-1">{q.question_text}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-0.5 rounded">{QUESTION_TYPE_LABELS[q.question_type] || q.question_type}</span>
                          {q.is_required && <span className="text-red-500">Obligatoire</span>}
                          {q.options && q.options.length > 0 && (
                            <span>{q.options.length} option(s)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Results tab */}
          {detailTab === 'results' && (
            <div className="space-y-8">
              {!surveyResults ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : surveyResults.questions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun résultat disponible</p>
              ) : (
                surveyResults.questions.map((qr) => (
                  <div key={qr.question_id} className="border border-gray-200 rounded-lg p-5">
                    <h3 className="font-medium text-gray-900 mb-1">{qr.question_text}</h3>
                    <p className="text-xs text-gray-400 mb-4">{QUESTION_TYPE_LABELS[qr.question_type] || qr.question_type} — {qr.total_answers} réponse(s)</p>

                    {/* Likert bar chart */}
                    {(qr.question_type === 'likert_5' || qr.question_type === 'likert_10') && qr.distribution && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Moyenne : <span className="font-bold text-primary-600">{qr.average ?? '—'}</span></p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={Object.entries(qr.distribution).map(([k, v]) => ({ name: k, count: v }))}>
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} label={{ value: 'Réponses', angle: -90, position: 'insideLeft' }} />
                            <Tooltip formatter={(value: number) => [`${value} réponses`, '']} />
                            <Bar dataKey="count" name="Réponses" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Oui/Non donut */}
                    {qr.question_type === 'oui_non' && qr.yes_percent != null && (
                      <div className="flex items-center gap-8">
                        <ResponsiveContainer width={180} height={180}>
                          <RPieChart>
                            <Pie
                              data={[
                                { name: 'Oui', value: qr.yes_percent },
                                { name: 'Non', value: qr.no_percent || 0 },
                              ]}
                              cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                              dataKey="value"
                            >
                              <Cell fill="#10B981" />
                              <Cell fill="#EF4444" />
                            </Pie>
                            <Tooltip formatter={(v: number) => `${v}%`} />
                          </RPieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 text-sm">
                          <p><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2" />Oui : {qr.yes_percent}%</p>
                          <p><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2" />Non : {qr.no_percent}%</p>
                        </div>
                      </div>
                    )}

                    {/* Choix multiple bar chart */}
                    {qr.question_type === 'choix_multiple' && qr.distribution && (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={Object.entries(qr.distribution).map(([k, v]) => ({ name: k, count: v }))} layout="vertical">
                          <XAxis type="number" allowDecimals={false} label={{ value: 'Réponses', position: 'insideBottom', offset: -5 }} />
                          <YAxis type="category" dataKey="name" width={150} />
                          <Tooltip formatter={(value: number) => [`${value} réponses`, '']} />
                          <Bar dataKey="count" name="Réponses" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {/* Text answers */}
                    {qr.question_type === 'texte_libre' && qr.text_answers && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {qr.text_answers.map((t, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                            <MessageSquare className="w-4 h-4 inline mr-2 text-gray-400" />{t}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Responses tab */}
          {detailTab === 'responses' && (
            <div>
              {selectedSurvey.is_anonymous ? (
                <p className="text-gray-500 text-center py-8">Enquête anonyme — les répondants ne sont pas identifiés</p>
              ) : surveyResponses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune réponse</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Employé</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Complété le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {surveyResponses.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{r.employee_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.status === 'completee' ? 'bg-green-100 text-green-700' :
                            r.status === 'en_attente' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {r.status === 'completee' ? 'Complétée' : r.status === 'en_attente' ? 'En attente' : 'Expirée'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.completed_at ? new Date(r.completed_at).toLocaleDateString('fr-FR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enquêtes Pulse</h1>
          <p className="text-gray-500 text-sm mt-1">Créez et gérez vos enquêtes de satisfaction et d&apos;engagement</p>
        </div>
        {isAdminOrRH && (
          <button onClick={openCreateModal} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nouvelle enquête
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une enquête..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
            <option value="">Tous les types</option>
            <option value="pulse">Pulse</option>
            <option value="ad_hoc">Ad hoc</option>
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="active">Active</option>
            <option value="cloturee">Clôturée</option>
            <option value="archivee">Archivée</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : filteredSurveys.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Aucune enquête</p>
            <p className="text-sm mt-1">Créez votre première enquête pour commencer</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Fréquence</th>
                <th className="px-4 py-3 font-medium">Date fin</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSurveys.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(s.id)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_LABELS[s.survey_type]?.color || 'bg-gray-100'}`}>
                      {TYPE_LABELS[s.survey_type]?.label || s.survey_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]?.color || 'bg-gray-100'}`}>
                      {STATUS_COLORS[s.status]?.label || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{FREQUENCY_LABELS[s.frequency] || s.frequency}</td>
                  <td className="px-4 py-3 text-gray-500">{s.end_date ? new Date(s.end_date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openDetail(s.id)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Voir">
                        <Eye className="w-4 h-4" />
                      </button>
                      {s.status === 'brouillon' && isAdminOrRH && (
                        <button onClick={() => activateSurvey(s.id)} className="p-1.5 text-green-500 hover:text-green-700 rounded-lg hover:bg-green-50" title="Activer">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {s.status === 'active' && isAdminOrRH && (
                        <button onClick={() => closeSurvey(s.id)} className="p-1.5 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50" title="Clôturer">
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      {isAdminOrRH && (
                        <button onClick={() => archiveSurvey(s.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Archiver">
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {filteredSurveys.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">{filteredSurveys.length} enquête(s)</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-100">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={filteredSurveys.length < 20} className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-100">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle enquête — Étape {createStep}/4</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center gap-2 px-6 pt-4">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= createStep ? 'bg-primary-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Step 1 — General */}
              {createStep === 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                    <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Ex: Satisfaction équipe Mars 2026" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <div className="flex gap-3">
                      {['pulse', 'ad_hoc'].map(t => (
                        <button key={t} onClick={() => setFormData({ ...formData, survey_type: t })} className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium ${formData.survey_type === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                          {TYPE_LABELS[t]?.label || t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Description de l'enquête..." />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Enquête anonyme</label>
                    <button onClick={() => setFormData({ ...formData, is_anonymous: !formData.is_anonymous })} className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${formData.is_anonymous ? 'bg-primary-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block w-4 h-4 bg-white rounded-full transform transition-transform mt-1 ${formData.is_anonymous ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
                    <select value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                      {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                      <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                      <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                </>
              )}

              {/* Step 2 — Questions */}
              {createStep === 2 && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Questions ({formQuestions.length})</h3>
                    <button onClick={addQuestion} className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  {formQuestions.length === 0 && (
                    <p className="text-gray-400 text-center py-6 text-sm">Ajoutez des questions à votre enquête</p>
                  )}
                  <div className="space-y-4">
                    {formQuestions.map((q, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-400">Question {idx + 1}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => moveQuestion(idx, 'down')} disabled={idx === formQuestions.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => removeQuestion(idx)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <input type="text" value={q.question_text} onChange={e => updateQuestion(idx, 'question_text', e.target.value)} placeholder="Texte de la question" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                        <div className="flex items-center gap-4">
                          <select value={q.question_type} onChange={e => updateQuestion(idx, 'question_type', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                            {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={q.is_required} onChange={e => updateQuestion(idx, 'is_required', e.target.checked)} className="rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                            Obligatoire
                          </label>
                        </div>
                        {q.question_type === 'choix_multiple' && (
                          <div className="space-y-2">
                            <label className="text-xs text-gray-500">Options (une par ligne)</label>
                            <textarea
                              value={q.options.join('\n')}
                              onChange={e => updateQuestion(idx, 'options', e.target.value.split('\n').filter(Boolean))}
                              rows={3}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Step 3 — Targets */}
              {createStep === 3 && (
                <>
                  <h3 className="font-medium text-gray-900">Cibles de l&apos;enquête</h3>
                  <div className="space-y-3">
                    {(['all', 'department', 'employee'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setTargetMode(mode)}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm ${
                          targetMode === mode ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {mode === 'all' && 'Tous les employés'}
                        {mode === 'department' && 'Par département'}
                        {mode === 'employee' && 'Employés spécifiques'}
                      </button>
                    ))}
                  </div>

                  {targetMode === 'department' && (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {departments.map(d => (
                        <label key={d.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedDepartments.includes(d.id)}
                            onChange={e => {
                              if (e.target.checked) setSelectedDepartments([...selectedDepartments, d.id]);
                              else setSelectedDepartments(selectedDepartments.filter(id => id !== d.id));
                            }}
                            className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                          />
                          {d.name}
                        </label>
                      ))}
                      {departments.length === 0 && <p className="text-gray-400 text-sm">Chargement...</p>}
                    </div>
                  )}

                  {targetMode === 'employee' && (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {employees.map(emp => (
                        <label key={emp.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(emp.id)}
                            onChange={e => {
                              if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                              else setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                            }}
                            className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                          />
                          {emp.first_name} {emp.last_name}
                        </label>
                      ))}
                      {employees.length === 0 && <p className="text-gray-400 text-sm">Chargement...</p>}
                    </div>
                  )}
                </>
              )}

              {/* Step 4 — Summary */}
              {createStep === 4 && (
                <>
                  <h3 className="font-medium text-gray-900">Résumé</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Titre</span>
                      <span className="font-medium text-gray-900">{formData.title}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Type</span>
                      <span className="font-medium">{TYPE_LABELS[formData.survey_type]?.label}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Anonyme</span>
                      <span className="font-medium">{formData.is_anonymous ? 'Oui' : 'Non'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Fréquence</span>
                      <span className="font-medium">{FREQUENCY_LABELS[formData.frequency]}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Questions</span>
                      <span className="font-medium">{formQuestions.length}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Cibles</span>
                      <span className="font-medium">
                        {targetMode === 'all' ? 'Tous les employés' :
                         targetMode === 'department' ? `${selectedDepartments.length} département(s)` :
                         `${selectedEmployees.length} employé(s)`}
                      </span>
                    </div>
                    {formData.start_date && (
                      <div className="flex justify-between border-b border-gray-100 pb-2">
                        <span className="text-gray-500">Période</span>
                        <span className="font-medium">{formData.start_date} → {formData.end_date || '...'}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                    En cliquant &quot;Créer &amp; Activer&quot;, l&apos;enquête sera envoyée aux employés ciblés.
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => { if (createStep > 1) setCreateStep(createStep - 1); else setShowCreateModal(false); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                {createStep === 1 ? 'Annuler' : 'Précédent'}
              </button>
              <div className="flex gap-2">
                {createStep < 4 ? (
                  <button
                    onClick={() => {
                      if (createStep === 1 && !formData.title.trim()) { toast.error('Le titre est obligatoire'); return; }
                      if (createStep === 2 && formQuestions.length === 0) { toast.error('Ajoutez au moins une question'); return; }
                      setCreateStep(createStep + 1);
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium"
                  >
                    Suivant
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setCreateStep(0); handleCreate(); }} disabled={creating} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50">
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer brouillon'}
                    </button>
                    <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium flex items-center gap-1 disabled:opacity-50">
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> Créer &amp; Activer</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
