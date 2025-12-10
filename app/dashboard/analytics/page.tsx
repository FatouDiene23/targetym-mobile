'use client';

import Header from '@/components/Header';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  UserPlus,
  UserMinus,
  Palmtree,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Calendar,
  Building2,
  Clock,
  Filter
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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

// Données évolution des effectifs sur 12 mois
const effectifsEvolution = [
  { month: 'Jan', total: 220, entrees: 8, sorties: 3 },
  { month: 'Fév', total: 225, entrees: 12, sorties: 7 },
  { month: 'Mar', total: 228, entrees: 6, sorties: 3 },
  { month: 'Avr', total: 232, entrees: 10, sorties: 6 },
  { month: 'Mai', total: 238, entrees: 11, sorties: 5 },
  { month: 'Jun', total: 240, entrees: 9, sorties: 7 },
  { month: 'Jul', total: 237, entrees: 4, sorties: 7 },
  { month: 'Aoû', total: 235, entrees: 3, sorties: 5 },
  { month: 'Sep', total: 241, entrees: 12, sorties: 6 },
  { month: 'Oct', total: 244, entrees: 8, sorties: 5 },
  { month: 'Nov', total: 247, entrees: 7, sorties: 4 },
  { month: 'Déc', total: 248, entrees: 5, sorties: 4 },
];

// Répartition par département
const headcountByDept = [
  { name: 'Tech', value: 85, color: '#3B82F6' },
  { name: 'Sales', value: 62, color: '#10B981' },
  { name: 'Marketing', value: 38, color: '#8B5CF6' },
  { name: 'RH', value: 28, color: '#F59E0B' },
  { name: 'Finance', value: 35, color: '#EF4444' },
];

// Taux d'absentéisme par mois
const absenteeismData = [
  { month: 'Jan', taux: 4.2 },
  { month: 'Fév', taux: 3.8 },
  { month: 'Mar', taux: 4.5 },
  { month: 'Avr', taux: 3.2 },
  { month: 'Mai', taux: 2.9 },
  { month: 'Jun', taux: 3.1 },
  { month: 'Jul', taux: 2.5 },
  { month: 'Aoû', taux: 2.2 },
  { month: 'Sep', taux: 3.4 },
  { month: 'Oct', taux: 3.6 },
  { month: 'Nov', taux: 3.8 },
  { month: 'Déc', taux: 3.2 },
];

// Congés par département
const congesByDept = [
  { dept: 'Tech', enConges: 8, totalJours: 156 },
  { dept: 'Sales', enConges: 5, totalJours: 98 },
  { dept: 'Marketing', enConges: 3, totalJours: 67 },
  { dept: 'RH', enConges: 2, totalJours: 45 },
  { dept: 'Finance', enConges: 4, totalJours: 78 },
];

// Répartition par genre
const genderData = [
  { name: 'Hommes', value: 125, color: '#3B82F6' },
  { name: 'Femmes', value: 123, color: '#EC4899' },
];

// Répartition par type de contrat
const contractData = [
  { name: 'CDI', value: 210, color: '#10B981' },
  { name: 'CDD', value: 25, color: '#F59E0B' },
  { name: 'Stage', value: 8, color: '#8B5CF6' },
  { name: 'Alternance', value: 5, color: '#06B6D4' },
];

// Ancienneté
const ancienneteData = [
  { tranche: '< 1 an', count: 42 },
  { tranche: '1-2 ans', count: 58 },
  { tranche: '3-5 ans', count: 72 },
  { tranche: '6-10 ans', count: 48 },
  { tranche: '> 10 ans', count: 28 },
];

export default function AnalyticsPage() {
  return (
    <>
      <Header title="People Analytics" subtitle="Tableaux de bord RH et indicateurs clés - Phase 1" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* KPIs principaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />+5%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">248</p>
            <p className="text-xs text-gray-500">Effectif Total</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <UserPlus className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">87</p>
            <p className="text-xs text-gray-500">Entrées (année)</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <UserMinus className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">59</p>
            <p className="text-xs text-gray-500">Sorties (année)</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="w-5 h-5 text-orange-500" />
              <span className="text-xs text-green-600 flex items-center">
                <TrendingDown className="w-3 h-3 mr-0.5" />-0.8%
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-600">12.4%</p>
            <p className="text-xs text-gray-500">Turnover</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">3.2%</p>
            <p className="text-xs text-gray-500">Absentéisme</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Palmtree className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">22</p>
            <p className="text-xs text-gray-500">En congés</p>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex justify-end gap-3 mb-6">
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
          </button>
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </button>
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>

        {/* Graphiques Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Évolution des effectifs */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution des Effectifs (12 mois)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={effectifsEvolution}>
                  <defs>
                    <linearGradient id="effectifGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} domain={[200, 260]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    fill="url(#effectifGradient)"
                    name="Effectif total"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Entrées vs Sorties */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Entrées vs Sorties (12 mois)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={effectifsEvolution}>
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
                  <Legend />
                  <Bar dataKey="entrees" name="Entrées" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sorties" name="Sorties" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Graphiques Row 2 */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Répartition par département */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Effectifs par Département</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={headcountByDept}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
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
            <div className="grid grid-cols-2 gap-2 mt-4">
              {headcountByDept.map((dept, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: dept.color }}></div>
                  <span className="text-sm text-gray-600">{dept.name} ({dept.value})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition par genre */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Répartition par Genre</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {genderData.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-gray-600">{item.name}: {item.value} ({Math.round(item.value/248*100)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition par type de contrat */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Types de Contrat</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contractData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {contractData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {contractData.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-gray-600">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Graphiques Row 3 */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Taux d'absentéisme */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution du Taux d&apos;Absentéisme (%)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={absenteeismData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 6]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Taux']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="taux" 
                    stroke="#EF4444" 
                    strokeWidth={3}
                    dot={{ fill: '#EF4444', strokeWidth: 2 }}
                    name="Taux d'absentéisme"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ancienneté */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Répartition par Ancienneté</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ancienneteData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                  <YAxis dataKey="tranche" type="category" stroke="#9CA3AF" fontSize={12} width={70} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Employés" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Congés par département */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Congés par Département</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Département</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Effectif</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">En congés</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">% en congés</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Jours pris (mois)</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Taux d&apos;utilisation</th>
                </tr>
              </thead>
              <tbody>
                {congesByDept.map((dept, index) => {
                  const effectif = headcountByDept.find(h => h.name === dept.dept)?.value || 0;
                  const percentage = ((dept.enConges / effectif) * 100).toFixed(1);
                  const utilizationRate = Math.min(100, Math.round((dept.totalJours / (effectif * 2.5)) * 100));
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="font-medium text-gray-900">{dept.dept}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{effectif}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {dept.enConges}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{percentage}%</td>
                      <td className="py-3 px-4 text-center text-gray-600">{dept.totalJours}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${utilizationRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600 w-10">{utilizationRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Indicateurs clés */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Ancienneté Moyenne</p>
                <p className="text-3xl font-bold mt-1">4.2 ans</p>
                <p className="text-blue-100 text-sm mt-1">+0.3 vs année dernière</p>
              </div>
              <Clock className="w-10 h-10 text-blue-200" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Taux de Rétention</p>
                <p className="text-3xl font-bold mt-1">87.6%</p>
                <p className="text-green-100 text-sm mt-1">+2.1% vs année dernière</p>
              </div>
              <Users className="w-10 h-10 text-green-200" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-sm">Parité H/F</p>
                <p className="text-3xl font-bold mt-1">50/50</p>
                <p className="text-pink-100 text-sm mt-1">Équilibre atteint</p>
              </div>
              <Users className="w-10 h-10 text-pink-200" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Âge Moyen</p>
                <p className="text-3xl font-bold mt-1">34 ans</p>
                <p className="text-orange-100 text-sm mt-1">28% Gen Z</p>
              </div>
              <Calendar className="w-10 h-10 text-orange-200" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
