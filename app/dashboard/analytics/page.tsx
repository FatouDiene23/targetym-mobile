'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  TrendingUp, TrendingDown, Users, UserPlus, UserMinus, AlertTriangle, FileSpreadsheet, FileText,
  Building2, Clock, Filter, Target, Star, GraduationCap, Heart, Briefcase, Brain, ChevronRight,
  AlertCircle, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Shield, UserCheck,
  Award, BookOpen, ThumbsUp, DollarSign, Activity, Gauge
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// ==================== DATA ====================

// Effectif & Structure
const effectifsEvolution = [
  { month: 'Jul', total: 235, entrees: 8, sorties: 5 },
  { month: 'Aoû', total: 238, entrees: 6, sorties: 3 },
  { month: 'Sep', total: 244, entrees: 12, sorties: 6 },
  { month: 'Oct', total: 248, entrees: 9, sorties: 5 },
  { month: 'Nov', total: 252, entrees: 8, sorties: 4 },
  { month: 'Déc', total: 256, entrees: 7, sorties: 3 },
];

const headcountByDept = [
  { name: 'Technologie', value: 85, color: '#3B82F6' },
  { name: 'Commercial', value: 62, color: '#10B981' },
  { name: 'Marketing', value: 38, color: '#8B5CF6' },
  { name: 'RH', value: 28, color: '#F59E0B' },
  { name: 'Finance', value: 43, color: '#EF4444' },
];

const pyramideAges = [
  { tranche: '18-25', hommes: 18, femmes: 22 },
  { tranche: '26-35', hommes: 45, femmes: 48 },
  { tranche: '36-45', hommes: 38, femmes: 35 },
  { tranche: '46-55', hommes: 22, femmes: 18 },
  { tranche: '55+', hommes: 5, femmes: 5 },
];

const turnoverByDept = [
  { dept: 'Technologie', taux: 8.5 },
  { dept: 'Commercial', taux: 15.2 },
  { dept: 'Marketing', taux: 10.8 },
  { dept: 'RH', taux: 5.2 },
  { dept: 'Finance', taux: 7.1 },
];

// Performance
const performanceByTeam = [
  { team: 'Dev Frontend', score: 4.2, objectifs: 85 },
  { team: 'Dev Backend', score: 4.5, objectifs: 92 },
  { team: 'Commercial B2B', score: 3.8, objectifs: 78 },
  { team: 'Commercial B2C', score: 4.1, objectifs: 88 },
  { team: 'Marketing Digital', score: 4.3, objectifs: 90 },
  { team: 'RH & Admin', score: 4.0, objectifs: 82 },
];

const performanceDistribution = [
  { rating: 'Exceptionnel', count: 28, pct: 11 },
  { rating: 'Dépasse', count: 67, pct: 26 },
  { rating: 'Atteint', count: 112, pct: 44 },
  { rating: 'À améliorer', count: 38, pct: 15 },
  { rating: 'Insuffisant', count: 11, pct: 4 },
];

const performanceByManager = [
  { manager: 'Amadou Diallo', team: 12, avgScore: 4.5, trend: '+0.3' },
  { manager: 'Fatou Ndiaye', team: 8, avgScore: 4.3, trend: '+0.2' },
  { manager: 'Ibrahima Fall', team: 15, avgScore: 4.1, trend: '-0.1' },
  { manager: 'Aissatou Ba', team: 10, avgScore: 4.4, trend: '+0.4' },
  { manager: 'Moussa Sow', team: 6, avgScore: 3.8, trend: '+0.1' },
];

// Talents
const talentDistribution = [
  { category: 'Stars', count: 18, pct: 7, color: '#10B981' },
  { category: 'Futurs Leaders', count: 32, pct: 12.5, color: '#3B82F6' },
  { category: 'Piliers', count: 45, pct: 17.5, color: '#8B5CF6' },
  { category: 'À Développer', count: 98, pct: 38, color: '#F59E0B' },
  { category: 'Risque', count: 63, pct: 25, color: '#EF4444' },
];

const successionCoverage = [
  { poste: 'DG', couvert: true, successeurs: 2 },
  { poste: 'CTO', couvert: true, successeurs: 1 },
  { poste: 'DRH', couvert: true, successeurs: 2 },
  { poste: 'DAF', couvert: false, successeurs: 0 },
  { poste: 'Dir. Commercial', couvert: true, successeurs: 1 },
];

const talentRisks = [
  { name: 'Amadou Diallo', role: 'CTO', risk: 'high', reason: 'Approché par concurrent' },
  { name: 'Aissatou Ba', role: 'Lead Dev', risk: 'medium', reason: 'Stagnation carrière' },
  { name: 'Ousmane Sy', role: 'Dir. Commercial', risk: 'low', reason: 'Récemment promu' },
];

// Formation
const formationExecution = [
  { month: 'Jul', prevu: 45, realise: 38 },
  { month: 'Aoû', prevu: 30, realise: 28 },
  { month: 'Sep', prevu: 55, realise: 52 },
  { month: 'Oct', prevu: 60, realise: 48 },
  { month: 'Nov', prevu: 50, realise: 45 },
  { month: 'Déc', prevu: 40, realise: 35 },
];

const competencesCoverage = [
  { skill: 'Leadership', cible: 100, actuel: 72 },
  { skill: 'Tech/Digital', cible: 100, actuel: 85 },
  { skill: 'Commercial', cible: 100, actuel: 68 },
  { skill: 'Communication', cible: 100, actuel: 78 },
  { skill: 'Gestion Projet', cible: 100, actuel: 82 },
];

const budgetFormation = { total: 150000000, consomme: 112500000, reste: 37500000 };

// Engagement
const engagementTrend = [
  { month: 'Jul', score: 72 },
  { month: 'Aoû', score: 70 },
  { month: 'Sep', score: 74 },
  { month: 'Oct', score: 76 },
  { month: 'Nov', score: 75 },
  { month: 'Déc', score: 78 },
];

const absenteeismByDept = [
  { dept: 'Technologie', taux: 2.8 },
  { dept: 'Commercial', taux: 4.5 },
  { dept: 'Marketing', taux: 3.2 },
  { dept: 'RH', taux: 2.1 },
  { dept: 'Finance', taux: 3.8 },
];

const satisfactionFactors = [
  { factor: 'Management', score: 78 },
  { factor: 'Rémunération', score: 65 },
  { factor: 'Équilibre vie', score: 72 },
  { factor: 'Évolution', score: 68 },
  { factor: 'Ambiance', score: 82 },
  { factor: 'Outils', score: 75 },
];

// Recrutement
const recrutementMetrics = [
  { month: 'Jul', candidatures: 145, entretiens: 42, embauches: 8 },
  { month: 'Aoû', candidatures: 98, entretiens: 28, embauches: 6 },
  { month: 'Sep', candidatures: 210, entretiens: 65, embauches: 12 },
  { month: 'Oct', candidatures: 178, entretiens: 52, embauches: 9 },
  { month: 'Nov', candidatures: 165, entretiens: 48, embauches: 8 },
  { month: 'Déc', candidatures: 120, entretiens: 35, embauches: 7 },
];

const sourcesRecrutement = [
  { source: 'LinkedIn', candidatures: 312, embauches: 18, quality: 85 },
  { source: 'Site Carrière', candidatures: 245, embauches: 12, quality: 78 },
  { source: 'Cooptation', candidatures: 68, embauches: 14, quality: 92 },
  { source: 'Cabinets', candidatures: 45, embauches: 8, quality: 88 },
  { source: 'Indeed', candidatures: 186, embauches: 5, quality: 62 },
];

// Alertes IA
const alertesIA = [
  { type: 'critical', icon: AlertTriangle, message: '3 talents critiques à risque de départ', domain: 'Talents', action: 'Voir détails' },
  { type: 'warning', icon: AlertCircle, message: 'Taux d\'absentéisme en hausse (+1.2%) dans Commercial', domain: 'Engagement', action: 'Analyser' },
  { type: 'warning', icon: Clock, message: 'Délai moyen de recrutement Tech: 45j (+12j)', domain: 'Recrutement', action: 'Optimiser' },
  { type: 'info', icon: TrendingUp, message: 'Performance Q4 en hausse de 8% vs Q3', domain: 'Performance', action: 'Voir rapport' },
  { type: 'info', icon: GraduationCap, message: 'Budget formation consommé à 75%', domain: 'Formation', action: 'Planifier' },
];

// ==================== COMPONENT ====================

export default function PeopleAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'effectif' | 'performance' | 'talents' | 'formation' | 'engagement' | 'recrutement'>('overview');
  const [selectedDept, setSelectedDept] = useState('Tous');
  const [selectedPeriod, setSelectedPeriod] = useState('6M');

  const departments = ['Tous', 'Technologie', 'Commercial', 'Marketing', 'RH', 'Finance'];
  const periods = ['1M', '3M', '6M', '1A'];

  const getAlertColor = (type: string) => {
    if (type === 'critical') return 'bg-red-50 border-red-200 text-red-800';
    if (type === 'warning') return 'bg-orange-50 border-orange-200 text-orange-800';
    return 'bg-blue-50 border-blue-200 text-blue-800';
  };

  const getAlertIconColor = (type: string) => {
    if (type === 'critical') return 'text-red-600';
    if (type === 'warning') return 'text-orange-600';
    return 'text-blue-600';
  };

  const formatXOF = (value: number) => {
    return new Intl.NumberFormat('fr-FR').format(value) + ' XOF';
  };

  return (
    <>
      <Header title="People Analytics" subtitle="Tableaux de bord RH stratégiques - Intelligence d'affaires" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Filtres globaux */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-1 bg-white border border-gray-300 rounded-lg p-1">
            {periods.map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)} className={`px-3 py-1 text-sm rounded ${selectedPeriod === p ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
            ))}
          </div>
          <div className="flex-1" />
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileSpreadsheet className="w-4 h-4 mr-2" />Excel
          </button>
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileText className="w-4 h-4 mr-2" />PDF
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button onClick={() => setActiveTab('overview')} className={`flex-shrink-0 px-5 py-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'overview' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Gauge className="w-4 h-4" />Vue d&apos;ensemble
            </button>
            <button onClick={() => setActiveTab('effectif')} className={`flex-shrink-0 px-5 py-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'effectif' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Users className="w-4 h-4" />Effectif
            </button>
            <button onClick={() => setActiveTab('performance')} className={`flex-shrink-0 px-5 py-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'performance' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Target className="w-4 h-4" />Performance
            </button>
            <button onClick={() => setActiveTab('talents')} className={`flex-shrink-0 px-5 py-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'talents' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Star className="w-4 h-4" />Talents
            </button>
            <button onClick={() => setActiveTab('formation')} className={`flex-shrink-0 px-5 py-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'formation' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <GraduationCap className="w-4 h-4" />Formation
            </button>
            <button onClick={() => setActiveTab('engagement')} className={`flex-shrink-0 px-5 py-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'engagement' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Heart className="w-4 h-4" />Engagement
            </button>
            <button onClick={() => setActiveTab('recrutement')} className={`flex-shrink-0 px-5 py-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'recrutement' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Briefcase className="w-4 h-4" />Recrutement
            </button>
          </div>
        </div>

        {/* ==================== VUE D'ENSEMBLE ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Alertes IA */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Alertes & Insights IA</h3>
              </div>
              <div className="space-y-3">
                {alertesIA.map((alerte, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${getAlertColor(alerte.type)}`}>
                    <div className="flex items-center gap-3">
                      <alerte.icon className={`w-5 h-5 ${getAlertIconColor(alerte.type)}`} />
                      <div>
                        <p className="text-sm font-medium">{alerte.message}</p>
                        <p className="text-xs opacity-75">{alerte.domain}</p>
                      </div>
                    </div>
                    <button className="text-sm font-medium hover:underline">{alerte.action}</button>
                  </div>
                ))}
              </div>
            </div>

            {/* KPIs Summary - 6 domaines */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md" onClick={() => setActiveTab('effectif')}>
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-xs text-green-600 flex items-center"><ArrowUpRight className="w-3 h-3" />+3.2%</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">256</p>
                <p className="text-xs text-gray-500">Effectif Total</p>
                <p className="text-xs text-blue-600 mt-1 flex items-center">Voir détails <ChevronRight className="w-3 h-3" /></p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md" onClick={() => setActiveTab('performance')}>
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-green-600 flex items-center"><ArrowUpRight className="w-3 h-3" />+8%</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">85%</p>
                <p className="text-xs text-gray-500">Objectifs Atteints</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">Voir détails <ChevronRight className="w-3 h-3" /></p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md" onClick={() => setActiveTab('talents')}>
                <div className="flex items-center justify-between mb-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-xs text-orange-600 flex items-center"><AlertCircle className="w-3 h-3" />3 risques</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">50</p>
                <p className="text-xs text-gray-500">Hauts Potentiels</p>
                <p className="text-xs text-yellow-600 mt-1 flex items-center">Voir détails <ChevronRight className="w-3 h-3" /></p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md" onClick={() => setActiveTab('formation')}>
                <div className="flex items-center justify-between mb-2">
                  <GraduationCap className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">75%</p>
                <p className="text-xs text-gray-500">Plan Formation</p>
                <p className="text-xs text-purple-600 mt-1 flex items-center">Voir détails <ChevronRight className="w-3 h-3" /></p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md" onClick={() => setActiveTab('engagement')}>
                <div className="flex items-center justify-between mb-2">
                  <Heart className="w-5 h-5 text-pink-500" />
                  <span className="text-xs text-green-600 flex items-center"><ArrowUpRight className="w-3 h-3" />+4pts</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">78%</p>
                <p className="text-xs text-gray-500">Engagement</p>
                <p className="text-xs text-pink-600 mt-1 flex items-center">Voir détails <ChevronRight className="w-3 h-3" /></p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md" onClick={() => setActiveTab('recrutement')}>
                <div className="flex items-center justify-between mb-2">
                  <Briefcase className="w-5 h-5 text-teal-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">32j</p>
                <p className="text-xs text-gray-500">Délai Recrutement</p>
                <p className="text-xs text-teal-600 mt-1 flex items-center">Voir détails <ChevronRight className="w-3 h-3" /></p>
              </div>
            </div>

            {/* Graphiques résumés */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Évolution Effectifs</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={effectifsEvolution}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Area type="monotone" dataKey="total" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} /></AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Performance par Équipe</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceByTeam} layout="vertical"><XAxis type="number" domain={[0, 100]} fontSize={12} /><YAxis dataKey="team" type="category" width={100} fontSize={11} /><Tooltip /><Bar dataKey="objectifs" fill="#10B981" radius={[0, 4, 4, 0]} /></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Indicateurs clés en bas */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                <p className="text-blue-100 text-sm">Turnover</p>
                <p className="text-3xl font-bold mt-1">9.8%</p>
                <p className="text-blue-100 text-sm mt-1 flex items-center"><ArrowDownRight className="w-4 h-4 mr-1" />-2.1% vs N-1</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
                <p className="text-green-100 text-sm">Taux de Rétention</p>
                <p className="text-3xl font-bold mt-1">90.2%</p>
                <p className="text-green-100 text-sm mt-1 flex items-center"><ArrowUpRight className="w-4 h-4 mr-1" />+2.1% vs N-1</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
                <p className="text-purple-100 text-sm">Parité H/F</p>
                <p className="text-3xl font-bold mt-1">48/52</p>
                <p className="text-purple-100 text-sm mt-1">Quasi équilibre</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
                <p className="text-orange-100 text-sm">Absentéisme</p>
                <p className="text-3xl font-bold mt-1">3.4%</p>
                <p className="text-orange-100 text-sm mt-1 flex items-center"><ArrowUpRight className="w-4 h-4 mr-1" />+0.3% ce mois</p>
              </div>
            </div>
          </div>
        )}

        {/* ==================== EFFECTIF & STRUCTURE ==================== */}
        {activeTab === 'effectif' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Users className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-gray-900">256</p>
                <p className="text-xs text-gray-500">Effectif Total</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <UserPlus className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">50</p>
                <p className="text-xs text-gray-500">Entrées (6 mois)</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <UserMinus className="w-5 h-5 text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-600">26</p>
                <p className="text-xs text-gray-500">Sorties (6 mois)</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <TrendingDown className="w-5 h-5 text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-orange-600">9.8%</p>
                <p className="text-xs text-gray-500">Turnover</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Clock className="w-5 h-5 text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-purple-600">4.2 ans</p>
                <p className="text-xs text-gray-500">Ancienneté Moy.</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Building2 className="w-5 h-5 text-teal-500 mb-2" />
                <p className="text-2xl font-bold text-teal-600">8</p>
                <p className="text-xs text-gray-500">Postes Vacants</p>
              </div>
            </div>

            {/* Graphiques */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Évolution des Effectifs</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={effectifsEvolution}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Area type="monotone" dataKey="total" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} name="Total" /></AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Répartition par Département</h4>
                <div className="h-64 flex items-center">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart><Pie data={headcountByDept} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">{headcountByDept.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                  <div className="w-1/2 space-y-2">
                    {headcountByDept.map((d, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-sm text-gray-600">{d.name}</span></div>
                        <span className="text-sm font-medium">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Pyramide des Âges</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pyramideAges} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" fontSize={12} /><YAxis dataKey="tranche" type="category" width={50} fontSize={12} /><Tooltip /><Bar dataKey="hommes" fill="#3B82F6" name="Hommes" stackId="a" /><Bar dataKey="femmes" fill="#EC4899" name="Femmes" stackId="a" /></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Turnover par Département</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={turnoverByDept}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="dept" fontSize={11} /><YAxis fontSize={12} unit="%" /><Tooltip /><Bar dataKey="taux" fill="#EF4444" radius={[4, 4, 0, 0]} name="Turnover" /></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PERFORMANCE ==================== */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Target className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">85%</p>
                <p className="text-xs text-gray-500">Objectifs Atteints</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Star className="w-5 h-5 text-yellow-500 mb-2" />
                <p className="text-2xl font-bold text-gray-900">4.1<span className="text-lg text-gray-400">/5</span></p>
                <p className="text-xs text-gray-500">Score Moyen</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <TrendingUp className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-blue-600">+8%</p>
                <p className="text-xs text-gray-500">vs Trimestre Préc.</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Award className="w-5 h-5 text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-purple-600">95</p>
                <p className="text-xs text-gray-500">Top Performers</p>
              </div>
            </div>

            {/* Graphiques */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Performance par Équipe (% objectifs)</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceByTeam} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" domain={[0, 100]} fontSize={12} /><YAxis dataKey="team" type="category" width={110} fontSize={11} /><Tooltip /><Bar dataKey="objectifs" fill="#10B981" radius={[0, 4, 4, 0]} name="% Objectifs" /></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Distribution des Notes</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceDistribution}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="rating" fontSize={10} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]} name="Collaborateurs">
                      {performanceDistribution.map((_, i) => <Cell key={i} fill={['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'][i]} />)}
                    </Bar></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Performance par Manager */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-4">Performance par Manager</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Manager</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Équipe</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Score Moyen</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Tendance</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Progression</th>
                  </tr></thead>
                  <tbody>
                    {performanceByManager.map((m, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{m.manager}</td>
                        <td className="py-3 px-4 text-center text-gray-600">{m.team} pers.</td>
                        <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">{m.avgScore}/5</span></td>
                        <td className="py-3 px-4 text-center"><span className={`flex items-center justify-center ${m.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>{m.trend.startsWith('+') ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}{m.trend}</span></td>
                        <td className="py-3 px-4"><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${m.avgScore * 20}%` }} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TALENTS ==================== */}
        {activeTab === 'talents' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Star className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">18</p>
                <p className="text-xs text-gray-500">Stars (7%)</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <TrendingUp className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-blue-600">32</p>
                <p className="text-xs text-gray-500">Futurs Leaders</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Shield className="w-5 h-5 text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-purple-600">45</p>
                <p className="text-xs text-gray-500">Piliers</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <UserCheck className="w-5 h-5 text-teal-500 mb-2" />
                <p className="text-2xl font-bold text-teal-600">80%</p>
                <p className="text-xs text-gray-500">Postes Clés Couverts</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-600">3</p>
                <p className="text-xs text-gray-500">Talents à Risque</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Distribution 9-Box */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Répartition des Talents (9-Box)</h4>
                <div className="h-64 flex items-center">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart><Pie data={talentDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count">{talentDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                  <div className="w-1/2 space-y-2">
                    {talentDistribution.map((t, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} /><span className="text-sm text-gray-600">{t.category}</span></div>
                        <span className="text-sm font-medium">{t.count} ({t.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Couverture Succession */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Profondeur de Banc - Postes Clés</h4>
                <div className="space-y-3">
                  {successionCoverage.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {s.couvert ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                        <span className="font-medium text-gray-900">{s.poste}</span>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${s.couvert ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.successeurs} successeur{s.successeurs > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Talents à risque */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" />Talents Critiques à Risque de Départ</h4>
              <div className="space-y-3">
                {talentRisks.map((t, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${t.risk === 'high' ? 'bg-red-50 border-red-200' : t.risk === 'medium' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-medium text-gray-700">{t.name.split(' ').map(n => n[0]).join('')}</div>
                      <div>
                        <p className="font-medium text-gray-900">{t.name}</p>
                        <p className="text-sm text-gray-500">{t.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${t.risk === 'high' ? 'bg-red-100 text-red-700' : t.risk === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        Risque {t.risk === 'high' ? 'Élevé' : t.risk === 'medium' ? 'Moyen' : 'Faible'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{t.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== FORMATION ==================== */}
        {activeTab === 'formation' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <GraduationCap className="w-5 h-5 text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-purple-600">75%</p>
                <p className="text-xs text-gray-500">Plan Exécuté</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <BookOpen className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-blue-600">246</p>
                <p className="text-xs text-gray-500">Formations Réalisées</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Clock className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">1,248h</p>
                <p className="text-xs text-gray-500">Heures de Formation</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <DollarSign className="w-5 h-5 text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-orange-600">75%</p>
                <p className="text-xs text-gray-500">Budget Consommé</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Exécution Plan */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Exécution du Plan de Formation</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formationExecution}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="prevu" fill="#E5E7EB" name="Prévu" /><Bar dataKey="realise" fill="#8B5CF6" name="Réalisé" /></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Couverture Compétences */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Couverture des Compétences Critiques</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={competencesCoverage}><PolarGrid /><PolarAngleAxis dataKey="skill" fontSize={11} /><PolarRadiusAxis domain={[0, 100]} /><Radar dataKey="actuel" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} name="Actuel" /></RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Budget */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-4">Budget Formation</h4>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Budget Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatXOF(budgetFormation.total)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Consommé</p>
                  <p className="text-2xl font-bold text-purple-600">{formatXOF(budgetFormation.consomme)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Restant</p>
                  <p className="text-2xl font-bold text-green-600">{formatXOF(budgetFormation.reste)}</p>
                </div>
              </div>
              <div className="mt-4 h-4 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(budgetFormation.consomme / budgetFormation.total) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ==================== ENGAGEMENT ==================== */}
        {activeTab === 'engagement' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Heart className="w-5 h-5 text-pink-500 mb-2" />
                <p className="text-2xl font-bold text-pink-600">78%</p>
                <p className="text-xs text-gray-500">Indice Engagement</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <ThumbsUp className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">82%</p>
                <p className="text-xs text-gray-500">Satisfaction</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <AlertCircle className="w-5 h-5 text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-600">3.4%</p>
                <p className="text-xs text-gray-500">Absentéisme</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Activity className="w-5 h-5 text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-orange-600">12</p>
                <p className="text-xs text-gray-500">Alertes RPS</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Évolution Engagement */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Évolution de l&apos;Engagement</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={engagementTrend}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="month" fontSize={12} /><YAxis domain={[60, 90]} fontSize={12} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#EC4899" strokeWidth={3} dot={{ fill: '#EC4899' }} name="Score" /></LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Facteurs Satisfaction */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Facteurs de Satisfaction</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={satisfactionFactors}><PolarGrid /><PolarAngleAxis dataKey="factor" fontSize={11} /><PolarRadiusAxis domain={[0, 100]} /><Radar dataKey="score" stroke="#EC4899" fill="#EC4899" fillOpacity={0.3} name="Score" /></RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Absentéisme par Département */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-4">Taux d&apos;Absentéisme par Département</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={absenteeismByDept}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="dept" fontSize={11} /><YAxis fontSize={12} unit="%" /><Tooltip /><Bar dataKey="taux" fill="#EF4444" radius={[4, 4, 0, 0]} name="Absentéisme" /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ==================== RECRUTEMENT ==================== */}
        {activeTab === 'recrutement' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Briefcase className="w-5 h-5 text-teal-500 mb-2" />
                <p className="text-2xl font-bold text-teal-600">8</p>
                <p className="text-xs text-gray-500">Postes Ouverts</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Users className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-blue-600">916</p>
                <p className="text-xs text-gray-500">Candidatures (6M)</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <UserCheck className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">50</p>
                <p className="text-xs text-gray-500">Embauches (6M)</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Clock className="w-5 h-5 text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-orange-600">32j</p>
                <p className="text-xs text-gray-500">Délai Moyen</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <DollarSign className="w-5 h-5 text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-purple-600">850K</p>
                <p className="text-xs text-gray-500">Coût/Recrutement</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Funnel Recrutement */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Pipeline de Recrutement</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={recrutementMetrics}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Area type="monotone" dataKey="candidatures" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Candidatures" /><Area type="monotone" dataKey="entretiens" stackId="2" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} name="Entretiens" /><Area type="monotone" dataKey="embauches" stackId="3" stroke="#10B981" fill="#10B981" fillOpacity={0.5} name="Embauches" /></AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sources */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Qualité des Sources</h4>
                <div className="space-y-3">
                  {sourcesRecrutement.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{s.source}</p>
                        <p className="text-xs text-gray-500">{s.candidatures} candidatures • {s.embauches} embauches</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${s.quality >= 85 ? 'bg-green-100 text-green-700' : s.quality >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          Qualité: {s.quality}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
