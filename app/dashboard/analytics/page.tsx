'use client';

import Header from '@/components/Header';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle,
  Brain,
  Lightbulb,
  Target,
  Award
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const engagementTrend = [
  { month: 'Jan', score: 7.2 },
  { month: 'Fév', score: 7.4 },
  { month: 'Mar', score: 7.1 },
  { month: 'Avr', score: 7.6 },
  { month: 'Mai', score: 7.8 },
  { month: 'Jun', score: 8.0 },
  { month: 'Jul', score: 7.9 },
  { month: 'Aoû', score: 8.1 },
  { month: 'Sep', score: 8.3 },
  { month: 'Oct', score: 8.2 },
  { month: 'Nov', score: 8.4 },
  { month: 'Déc', score: 8.5 },
];

const turnoverData = [
  { month: 'Jan', voluntary: 2.1, involuntary: 0.8 },
  { month: 'Fév', voluntary: 1.8, involuntary: 0.5 },
  { month: 'Mar', voluntary: 2.3, involuntary: 0.7 },
  { month: 'Avr', voluntary: 1.5, involuntary: 0.4 },
  { month: 'Mai', voluntary: 1.9, involuntary: 0.6 },
  { month: 'Jun', voluntary: 1.2, involuntary: 0.3 },
];

const headcountByDept = [
  { name: 'Tech', value: 85, color: '#3B82F6' },
  { name: 'Sales', value: 62, color: '#10B981' },
  { name: 'Marketing', value: 38, color: '#8B5CF6' },
  { name: 'RH', value: 28, color: '#F59E0B' },
  { name: 'Finance', value: 35, color: '#EF4444' },
];

const performanceByDept = [
  { dept: 'Tech', avg: 4.2 },
  { dept: 'Sales', avg: 3.9 },
  { dept: 'Marketing', avg: 4.1 },
  { dept: 'RH', avg: 4.4 },
  { dept: 'Finance', avg: 4.0 },
];

const aiInsights = [
  {
    type: 'risk',
    icon: AlertTriangle,
    title: 'Risque de Départ Élevé',
    description: '8 employés du département Tech présentent un risque de départ élevé basé sur les patterns d\'engagement.',
    action: 'Voir les détails',
    color: 'text-red-600 bg-red-50'
  },
  {
    type: 'opportunity',
    icon: Lightbulb,
    title: 'Opportunité de Promotion',
    description: '12 employés ont atteint les critères pour une promotion potentielle ce trimestre.',
    action: 'Voir les candidats',
    color: 'text-blue-600 bg-blue-50'
  },
  {
    type: 'trend',
    icon: TrendingUp,
    title: 'Amélioration Engagement',
    description: 'Le score d\'engagement a augmenté de 15% sur les 6 derniers mois.',
    action: 'Voir l\'analyse',
    color: 'text-green-600 bg-green-50'
  },
  {
    type: 'recommendation',
    icon: Brain,
    title: 'Recommandation Formation',
    description: 'Basé sur les gaps de compétences, 23 employés bénéficieraient de la formation "Leadership".',
    action: 'Planifier',
    color: 'text-purple-600 bg-purple-50'
  },
];

const talentMatrix = [
  { name: 'Stars', count: 28, description: 'Haute performance, haut potentiel', color: 'bg-green-500' },
  { name: 'Futurs Leaders', count: 35, description: 'Performance moyenne, haut potentiel', color: 'bg-blue-500' },
  { name: 'Piliers', count: 95, description: 'Haute performance, potentiel stable', color: 'bg-purple-500' },
  { name: 'À Développer', count: 62, description: 'Performance moyenne, potentiel moyen', color: 'bg-yellow-500' },
  { name: 'Risque', count: 28, description: 'Performance ou potentiel faible', color: 'bg-red-500' },
];

export default function AnalyticsPage() {
  return (
    <>
      <Header title="People Analytics" subtitle="Insights IA et analyses prédictives RH" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* AI Insights */}
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <Brain className="w-5 h-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Insights IA</h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {aiInsights.map((insight, index) => (
              <div key={index} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${insight.color}`}>
                  <insight.icon className="w-5 h-5" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">{insight.title}</h4>
                <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                <button className="text-sm text-primary-600 font-medium hover:text-primary-700">
                  {insight.action} →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Engagement Trend */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution du Score d&apos;Engagement</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={engagementTrend}>
                  <defs>
                    <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis domain={[6, 10]} stroke="#9CA3AF" fontSize={12} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    fill="url(#engagementGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Turnover Analysis */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Analyse du Turnover (%)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={turnoverData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="voluntary" name="Volontaire" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="involuntary" name="Involontaire" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Headcount by Department */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Effectifs par Département</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={headcountByDept}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {headcountByDept.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {headcountByDept.map((dept, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: dept.color }}></div>
                  <span className="text-sm text-gray-600">{dept.name} ({dept.value})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance by Department */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Moyenne par Dept.</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceByDept} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" domain={[0, 5]} stroke="#9CA3AF" fontSize={12} />
                  <YAxis dataKey="dept" type="category" stroke="#9CA3AF" fontSize={12} width={80} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Talent Matrix Summary */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Matrice 9-Box des Talents</h3>
            <div className="space-y-3">
              {talentMatrix.map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${category.color} mr-3`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-500">{category.description}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{category.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Engagement Score</p>
                <p className="text-3xl font-bold mt-1">8.4</p>
                <p className="text-blue-100 text-sm mt-1">+0.3 vs mois dernier</p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-200" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Rétention</p>
                <p className="text-3xl font-bold mt-1">95.8%</p>
                <p className="text-green-100 text-sm mt-1">+1.2% vs trimestre</p>
              </div>
              <Users className="w-10 h-10 text-green-200" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Complétion OKR</p>
                <p className="text-3xl font-bold mt-1">78%</p>
                <p className="text-purple-100 text-sm mt-1">Q4 en cours</p>
              </div>
              <Target className="w-10 h-10 text-purple-200" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Formations/Employé</p>
                <p className="text-3xl font-bold mt-1">3.2</p>
                <p className="text-orange-100 text-sm mt-1">Moyenne annuelle</p>
              </div>
              <Award className="w-10 h-10 text-orange-200" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
