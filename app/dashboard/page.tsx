'use client';

import Header from '@/components/Header';
import { 
  Users, 
  Target, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const kpis = [
  { 
    title: 'Total Employés', 
    value: '248', 
    change: '+12', 
    changeType: 'positive',
    icon: Users,
    color: 'bg-blue-500'
  },
  { 
    title: 'OKRs Complétés', 
    value: '67%', 
    change: '+8%', 
    changeType: 'positive',
    icon: Target,
    color: 'bg-green-500'
  },
  { 
    title: 'Score Engagement', 
    value: '8.4', 
    change: '+0.3', 
    changeType: 'positive',
    icon: TrendingUp,
    color: 'bg-purple-500'
  },
  { 
    title: 'Turnover', 
    value: '4.2%', 
    change: '-1.2%', 
    changeType: 'positive',
    icon: TrendingDown,
    color: 'bg-orange-500'
  },
];

const performanceData = [
  { month: 'Jan', score: 72 },
  { month: 'Fév', score: 75 },
  { month: 'Mar', score: 78 },
  { month: 'Avr', score: 74 },
  { month: 'Mai', score: 82 },
  { month: 'Juin', score: 85 },
  { month: 'Juil', score: 83 },
  { month: 'Août', score: 86 },
  { month: 'Sep', score: 88 },
  { month: 'Oct', score: 85 },
  { month: 'Nov', score: 89 },
  { month: 'Déc', score: 92 },
];

const departmentData = [
  { name: 'Tech', employees: 85, color: '#3B82F6' },
  { name: 'Sales', employees: 62, color: '#10B981' },
  { name: 'Marketing', employees: 38, color: '#8B5CF6' },
  { name: 'RH', employees: 28, color: '#F59E0B' },
  { name: 'Finance', employees: 35, color: '#EF4444' },
];

const okrProgress = [
  { name: 'Q1', completed: 85, target: 100 },
  { name: 'Q2', completed: 78, target: 100 },
  { name: 'Q3', completed: 92, target: 100 },
  { name: 'Q4', completed: 45, target: 100 },
];

const alerts = [
  { type: 'warning', message: '5 évaluations de performance en attente', time: '2h' },
  { type: 'info', message: 'Nouveau candidat pour le poste Dev Senior', time: '4h' },
  { type: 'success', message: 'Objectif Q3 atteint par l\'équipe Marketing', time: '1j' },
];

const recentActivities = [
  { user: 'Sophie Martin', action: 'a complété son évaluation 360°', time: '10 min' },
  { user: 'Jean Dupont', action: 'a mis à jour ses OKRs Q4', time: '25 min' },
  { user: 'Marie Leroy', action: 'a rejoint l\'équipe Tech', time: '1h' },
  { user: 'Pierre Durant', action: 'a terminé la formation Leadership', time: '2h' },
];

export default function DashboardPage() {
  return (
    <>
      <Header title="Tableau de Bord" subtitle="Vue d'ensemble de vos métriques RH" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpis.map((kpi, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${kpi.color} rounded-lg flex items-center justify-center`}>
                  <kpi.icon className="w-6 h-6 text-white" />
                </div>
                <div className={`flex items-center text-sm font-medium ${
                  kpi.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpi.changeType === 'positive' ? (
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 mr-1" />
                  )}
                  {kpi.change}
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-500">{kpi.title}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Performance Trend */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution Performance</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* OKR Progress */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Progression OKRs par Trimestre</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={okrProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="completed" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Department Distribution */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Répartition par Département</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="employees"
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              {departmentData.map((dept, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: dept.color }}></div>
                  <span className="text-sm text-gray-600">{dept.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Alertes & Notifications</h3>
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.type === 'warning' ? 'bg-yellow-100' :
                    alert.type === 'success' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    {alert.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-600" />}
                    {alert.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {alert.type === 'info' && <Clock className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-gray-700">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">Il y a {alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Activité Récente</h3>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium text-gray-600">
                    {activity.user.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Il y a {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
