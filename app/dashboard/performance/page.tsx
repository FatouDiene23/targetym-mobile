'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  TrendingUp, Star, Users, Calendar, ChevronRight, Plus, MessageSquare, Award, Target, CheckCircle,
  Send, ThumbsUp, Eye, Edit, User, X
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Cell } from 'recharts';

// Types
interface FeedbackItem {
  id: number;
  from: string;
  fromInitials: string;
  to: string;
  toInitials: string;
  type: 'recognition' | 'improvement' | 'general';
  message: string;
  date: string;
  isPublic: boolean;
  likes: number;
}

interface Evaluation {
  id: number;
  employee: string;
  initials: string;
  department: string;
  role: string;
  status: 'pending' | 'in-progress' | 'completed';
  type: 'annual' | '360' | 'mid-year' | 'probation';
  dueDate: string;
  progress: number;
  scores?: { category: string; score: number }[];
  overallScore?: number;
}

interface Objective {
  id: number;
  title: string;
  employee: string;
  progress: number;
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
  dueDate: string;
  weight: number;
}

interface OneOnOne {
  id: number;
  employee: string;
  initials: string;
  manager: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  actionItems?: string[];
}

// Data
const feedbacks: FeedbackItem[] = [
  { id: 1, from: 'Fatou Ndiaye', fromInitials: 'FN', to: 'Aissatou Ba', toInitials: 'AB', type: 'recognition', message: 'Excellent travail sur le module Analytics ! Ta rigueur et ta créativité ont vraiment fait la différence. L\'équipe est impressionnée par la qualité du livrable.', date: 'Il y a 2h', isPublic: true, likes: 8 },
  { id: 2, from: 'Amadou Diallo', fromInitials: 'AD', to: 'Moussa Sow', toInitials: 'MS', type: 'recognition', message: 'Merci pour ton leadership sur le projet TARGETYM. Ta capacité à coordonner l\'équipe sous pression est remarquable.', date: 'Il y a 5h', isPublic: true, likes: 12 },
  { id: 3, from: 'Ibrahima Fall', fromInitials: 'IF', to: 'Ousmane Sy', toInitials: 'OS', type: 'improvement', message: 'Je suggère de travailler sur la présentation des rapports commerciaux. N\'hésite pas à me solliciter pour un coaching.', date: 'Hier', isPublic: false, likes: 0 },
  { id: 4, from: 'Aissatou Ba', fromInitials: 'AB', to: 'Mamadou Mbaye', toInitials: 'MM', type: 'recognition', message: 'Bravo pour ta montée en compétences sur React ! En 6 mois, tu as fait des progrès impressionnants.', date: 'Hier', isPublic: true, likes: 5 },
  { id: 5, from: 'Khady Faye', fromInitials: 'KF', to: 'Amadou Diallo', toInitials: 'AD', type: 'general', message: 'Merci pour le temps accordé lors du code review. Tes conseils sur l\'architecture sont très précieux.', date: 'Il y a 2j', isPublic: true, likes: 3 },
];

const evaluations: Evaluation[] = [
  { id: 1, employee: 'Aissatou Ba', initials: 'AB', department: 'Technologie', role: 'Lead Developer', status: 'completed', type: 'annual', dueDate: '15 Dec 2024', progress: 100, overallScore: 4.6, scores: [{ category: 'Compétences techniques', score: 95 }, { category: 'Leadership', score: 85 }, { category: 'Communication', score: 90 }, { category: 'Innovation', score: 92 }, { category: 'Collaboration', score: 88 }] },
  { id: 2, employee: 'Moussa Sow', initials: 'MS', department: 'Technologie', role: 'Chef de Projet', status: 'in-progress', type: 'annual', dueDate: '20 Dec 2024', progress: 60, scores: [{ category: 'Gestion projet', score: 88 }, { category: 'Leadership', score: 82 }, { category: 'Communication', score: 90 }] },
  { id: 3, employee: 'Ousmane Sy', initials: 'OS', department: 'Commercial', role: 'Commercial Senior', status: 'pending', type: '360', dueDate: '22 Dec 2024', progress: 0 },
  { id: 4, employee: 'Mamadou Mbaye', initials: 'MM', department: 'Technologie', role: 'Développeur Junior', status: 'in-progress', type: 'probation', dueDate: '31 Dec 2024', progress: 75, scores: [{ category: 'Compétences techniques', score: 78 }, { category: 'Apprentissage', score: 95 }, { category: 'Collaboration', score: 85 }] },
  { id: 5, employee: 'Mariama Diop', initials: 'MD', department: 'Marketing', role: 'Responsable Marketing', status: 'pending', type: 'annual', dueDate: '28 Dec 2024', progress: 0 },
];

const objectives: Objective[] = [
  { id: 1, title: 'Livrer le module People Analytics', employee: 'Aissatou Ba', progress: 95, status: 'on-track', dueDate: '31 Dec 2024', weight: 30 },
  { id: 2, title: 'Atteindre 50 nouveaux clients', employee: 'Ousmane Sy', progress: 72, status: 'on-track', dueDate: '31 Dec 2024', weight: 40 },
  { id: 3, title: 'Réduire le temps de recrutement à 25j', employee: 'Fatou Ndiaye', progress: 60, status: 'at-risk', dueDate: '31 Dec 2024', weight: 25 },
  { id: 4, title: 'Certifier 10 développeurs AWS', employee: 'Amadou Diallo', progress: 40, status: 'behind', dueDate: '31 Dec 2024', weight: 20 },
  { id: 5, title: 'Lancer campagne brand awareness', employee: 'Mariama Diop', progress: 100, status: 'completed', dueDate: '30 Nov 2024', weight: 35 },
];

const oneOnOnes: OneOnOne[] = [
  { id: 1, employee: 'Aissatou Ba', initials: 'AB', manager: 'Amadou Diallo', date: '12 Dec 2024 - 14h00', status: 'scheduled', actionItems: ['Discuter promotion', 'Plan formation Q1'] },
  { id: 2, employee: 'Mamadou Mbaye', initials: 'MM', manager: 'Aissatou Ba', date: '11 Dec 2024 - 10h00', status: 'completed', notes: 'Progrès excellents sur React. Prêt pour plus de responsabilités.', actionItems: ['Assigner feature auth', 'Mentorat pair programming'] },
  { id: 3, employee: 'Ousmane Sy', initials: 'OS', manager: 'Ibrahima Fall', date: '13 Dec 2024 - 11h00', status: 'scheduled', actionItems: ['Review pipeline Q4', 'Objectifs 2025'] },
];

const evaluationCampaigns = [
  { id: 1, name: 'Évaluation Annuelle 2024', status: 'active', progress: 68, deadline: '31 Dec 2024', participants: 48, completed: 33, type: 'annual' },
  { id: 2, name: 'Feedback 360° - Direction', status: 'active', progress: 45, deadline: '20 Dec 2024', participants: 12, completed: 5, type: '360' },
  { id: 3, name: 'Évaluation Mi-Année 2024', status: 'completed', progress: 100, deadline: '30 Jun 2024', participants: 45, completed: 45, type: 'mid-year' },
];

const performanceDistribution = [
  { rating: 'Exceptionnel', count: 8, color: '#10B981' },
  { rating: 'Dépasse attentes', count: 15, color: '#3B82F6' },
  { rating: 'Atteint attentes', count: 18, color: '#8B5CF6' },
  { rating: 'À améliorer', count: 5, color: '#F59E0B' },
  { rating: 'Insuffisant', count: 2, color: '#EF4444' },
];

const competencyData = [
  { subject: 'Technique', score: 85 },
  { subject: 'Leadership', score: 72 },
  { subject: 'Communication', score: 88 },
  { subject: 'Innovation', score: 75 },
  { subject: 'Collaboration', score: 90 },
  { subject: 'Résolution', score: 82 },
];

const trendData = [
  { month: 'Jan', score: 3.8 },
  { month: 'Fév', score: 3.9 },
  { month: 'Mar', score: 4.0 },
  { month: 'Avr', score: 3.9 },
  { month: 'Mai', score: 4.1 },
  { month: 'Jun', score: 4.2 },
];

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<'feedback' | 'evaluations' | 'objectives' | 'analytics'>('feedback');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'on-track': 'bg-green-100 text-green-700',
      'at-risk': 'bg-yellow-100 text-yellow-700',
      'behind': 'bg-red-100 text-red-700',
      'completed': 'bg-blue-100 text-blue-700',
      'pending': 'bg-gray-100 text-gray-700',
      'in-progress': 'bg-purple-100 text-purple-700',
      'scheduled': 'bg-blue-100 text-blue-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'on-track': 'En bonne voie',
      'at-risk': 'À risque',
      'behind': 'En retard',
      'completed': 'Terminé',
      'pending': 'En attente',
      'in-progress': 'En cours',
      'scheduled': 'Planifié',
    };
    return labels[status] || status;
  };

  const getFeedbackTypeColor = (type: string) => {
    if (type === 'recognition') return 'bg-green-100 text-green-700 border-green-200';
    if (type === 'improvement') return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  const getFeedbackTypeLabel = (type: string) => {
    if (type === 'recognition') return '🎉 Reconnaissance';
    if (type === 'improvement') return '💡 Suggestion';
    return '💬 Général';
  };

  return (
    <>
      <Header title="Performance & Feedback" subtitle="Évaluations, feedback continu, objectifs et entretiens" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Score Moyen</p><p className="text-2xl font-bold text-gray-900">4.2<span className="text-sm text-gray-400">/5</span></p></div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><Star className="w-5 h-5 text-yellow-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Évaluations</p><p className="text-2xl font-bold text-green-600">33<span className="text-sm text-gray-400">/48</span></p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Feedbacks (Mois)</p><p className="text-2xl font-bold text-purple-600">127</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><MessageSquare className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Objectifs Atteints</p><p className="text-2xl font-bold text-blue-600">78%</p></div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Target className="w-5 h-5 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">1-on-1 (Semaine)</p><p className="text-2xl font-bold text-orange-600">12</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('feedback')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'feedback' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <MessageSquare className="w-4 h-4 inline mr-2" />Feedback Continu
            </button>
            <button onClick={() => setActiveTab('evaluations')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'evaluations' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Star className="w-4 h-4 inline mr-2" />Évaluations
            </button>
            <button onClick={() => setActiveTab('objectives')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'objectives' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Target className="w-4 h-4 inline mr-2" />Objectifs
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <TrendingUp className="w-4 h-4 inline mr-2" />Analytics
            </button>
          </div>
        </div>

        {/* TAB: Feedback Continu */}
        {activeTab === 'feedback' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Fil de Feedback</h3>
                <button onClick={() => setShowFeedbackModal(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />Donner un Feedback
                </button>
              </div>
              
              {feedbacks.map((fb) => (
                <div key={fb.id} className={`bg-white rounded-xl p-5 shadow-sm border ${getFeedbackTypeColor(fb.type)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{fb.fromInitials}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{fb.from}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{fb.to}</span>
                        </div>
                        <span className="text-xs text-gray-500">{fb.date} {fb.isPublic ? '• Public' : '• Privé'}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getFeedbackTypeColor(fb.type)}`}>{getFeedbackTypeLabel(fb.type)}</span>
                  </div>
                  <p className="text-gray-700 text-sm mb-3">{fb.message}</p>
                  {fb.isPublic && (
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                      <button className="flex items-center text-sm text-gray-500 hover:text-primary-600"><ThumbsUp className="w-4 h-4 mr-1" />{fb.likes}</button>
                      <button className="text-sm text-gray-500 hover:text-primary-600">Commenter</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sidebar: 1-on-1 & Quick Stats */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary-500" />Prochains 1-on-1</h4>
                <div className="space-y-3">
                  {oneOnOnes.filter(o => o.status === 'scheduled').map((meeting) => (
                    <div key={meeting.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs">{meeting.initials}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{meeting.employee}</p>
                          <p className="text-xs text-gray-500">{meeting.date}</p>
                        </div>
                      </div>
                      {meeting.actionItems && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {meeting.actionItems.map((item, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{item}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center">
                  <Plus className="w-4 h-4 mr-1" />Planifier un 1-on-1
                </button>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-yellow-500" />Top Contributeurs</h4>
                <div className="space-y-3">
                  {[{ name: 'Fatou Ndiaye', count: 24 }, { name: 'Amadou Diallo', count: 18 }, { name: 'Aissatou Ba', count: 15 }].map((person, i) => (
                    <div key={person.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-700">{i + 1}</span>
                        <span className="text-sm text-gray-900">{person.name}</span>
                      </div>
                      <span className="text-sm font-medium text-primary-600">{person.count} feedbacks</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Évaluations */}
        {activeTab === 'evaluations' && (
          <div className="space-y-6">
            {/* Campaigns */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Campagnes d&apos;Évaluation</h3>
                <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />Nouvelle Campagne
                </button>
              </div>
              <div className="space-y-3">
                {evaluationCampaigns.map((camp) => (
                  <div key={camp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${camp.status === 'active' ? 'bg-green-100' : 'bg-gray-200'}`}>
                        <Star className={`w-5 h-5 ${camp.status === 'active' ? 'text-green-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{camp.name}</p>
                        <p className="text-xs text-gray-500">{camp.completed}/{camp.participants} complétées • Deadline: {camp.deadline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{camp.progress}%</p>
                        <div className="w-24 h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${camp.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${camp.progress}%` }} /></div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(camp.status === 'active' ? 'in-progress' : camp.status === 'completed' ? 'completed' : 'pending')}`}>
                        {camp.status === 'active' ? 'En cours' : camp.status === 'completed' ? 'Terminée' : 'À venir'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Individual Evaluations */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Évaluations Individuelles</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {evaluations.map((ev) => (
                      <div key={ev.id} onClick={() => setSelectedEvaluation(ev)} className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedEvaluation?.id === ev.id ? 'bg-primary-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{ev.initials}</div>
                            <div>
                              <p className="font-medium text-gray-900">{ev.employee}</p>
                              <p className="text-xs text-gray-500">{ev.role} • {ev.department}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ev.status)}`}>{getStatusLabel(ev.status)}</span>
                            {ev.overallScore && <span className="text-lg font-bold text-primary-600">{ev.overallScore}/5</span>}
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-xs text-gray-500">Type: {ev.type === 'annual' ? 'Annuelle' : ev.type === '360' ? '360°' : ev.type === 'probation' ? 'Période essai' : 'Mi-année'}</span>
                          <span className="text-xs text-gray-500">Deadline: {ev.dueDate}</span>
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full max-w-32"><div className={`h-full rounded-full ${ev.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${ev.progress}%` }} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selected Evaluation Detail */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-fit sticky top-6">
                {selectedEvaluation ? (
                  <>
                    <div className="text-center mb-4">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xl font-bold mx-auto mb-2">{selectedEvaluation.initials}</div>
                      <h3 className="font-bold text-gray-900">{selectedEvaluation.employee}</h3>
                      <p className="text-sm text-gray-500">{selectedEvaluation.role}</p>
                    </div>
                    {selectedEvaluation.scores && (
                      <div className="space-y-3 mb-4">
                        {selectedEvaluation.scores.map((s) => (
                          <div key={s.category}>
                            <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{s.category}</span><span className="font-medium">{s.score}%</span></div>
                            <div className="h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${s.score >= 90 ? 'bg-green-500' : s.score >= 75 ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${s.score}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button className="flex-1 flex items-center justify-center px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"><Eye className="w-4 h-4 mr-1" />Voir</button>
                      <button className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Edit className="w-4 h-4 mr-1" />Éditer</button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-8"><User className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p className="text-sm">Sélectionnez une évaluation</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Objectifs */}
        {activeTab === 'objectives' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Objectifs Individuels</h3>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Nouvel Objectif</button>
            </div>
            {objectives.map((obj) => (
              <div key={obj.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-900">{obj.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(obj.status)}`}>{getStatusLabel(obj.status)}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Assigné à: {obj.employee} • Poids: {obj.weight}% • Deadline: {obj.dueDate}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{obj.progress}%</p>
                      <div className="w-32 h-2 bg-gray-200 rounded-full mt-1"><div className={`h-full rounded-full ${obj.status === 'completed' ? 'bg-green-500' : obj.status === 'on-track' ? 'bg-blue-500' : obj.status === 'at-risk' ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${obj.progress}%` }} /></div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600"><Edit className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Analytics */}
        {activeTab === 'analytics' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Distribution des Notes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceDistribution} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="rating" width={100} /><Tooltip /><Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {performanceDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Bar></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Évolution Score Moyen</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}><XAxis dataKey="month" /><YAxis domain={[3, 5]} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2} dot={{ fill: '#6366F1' }} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Compétences Moyennes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={competencyData}><PolarGrid /><PolarAngleAxis dataKey="subject" /><PolarRadiusAxis domain={[0, 100]} /><Radar dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} /></RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Taux de Complétion par Type</h3>
              <div className="space-y-4">
                {[{ type: 'Annuelle', completed: 33, total: 48 }, { type: '360°', completed: 5, total: 12 }, { type: 'Mi-année', completed: 45, total: 45 }, { type: 'Période essai', completed: 3, total: 5 }].map((item) => (
                  <div key={item.type}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{item.type}</span><span className="font-medium">{item.completed}/{item.total} ({Math.round(item.completed / item.total * 100)}%)</span></div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${item.completed / item.total * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feedback Modal */}
        {showFeedbackModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Donner un Feedback</h2>
                <button onClick={() => setShowFeedbackModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">À qui ?</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option>Sélectionner un collaborateur...</option>
                    {['Aissatou Ba', 'Moussa Sow', 'Ousmane Sy', 'Mamadou Mbaye'].map(name => <option key={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de feedback</label>
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 border-2 border-green-500 bg-green-50 text-green-700 text-sm rounded-lg">🎉 Reconnaissance</button>
                    <button className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">💡 Suggestion</button>
                    <button className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">💬 Général</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Écrivez votre feedback..."></textarea>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="public" className="rounded" defaultChecked />
                  <label htmlFor="public" className="text-sm text-gray-600">Feedback public (visible par tous)</label>
                </div>
              </div>
              <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
                <button onClick={() => setShowFeedbackModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Annuler</button>
                <button className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 flex items-center"><Send className="w-4 h-4 mr-2" />Envoyer</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
