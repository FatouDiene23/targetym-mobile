'use client';

import { useLearning } from '../LearningContext';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function AnalyticsPage() {
  const { stats, monthlyStats, categoryStats, topLearners } = useLearning();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 mb-2">
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
            <p className="text-lg font-bold text-primary-600">{stats?.completed_this_month ?? 0}</p>
            <p className="text-xs text-gray-500">Ce mois</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
            <p className="text-lg font-bold text-blue-600">{stats?.hours_this_month ?? 0}h</p>
            <p className="text-xs text-gray-500">Heures</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
            <p className="text-lg font-bold text-green-600">{stats?.completion_rate ?? 0}%</p>
            <p className="text-xs text-gray-500">Taux global</p>
          </div>
      </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Formations Complétées par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyStats}><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="completions" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Répartition par Catégorie</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={categoryStats} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>{categoryStats.map((entry, i) => (<Cell key={i} fill={entry.color} />))}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Heures de Formation par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStats}><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="hours" fill="#3B82F6" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">🏆 Top Apprenants</h3>
              <div className="space-y-3">
                {topLearners.length === 0 ? (<p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>) : (
                  topLearners.map((learner, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3"><span className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-700">{i + 1}</span><span className="font-medium text-gray-900">{learner.name}</span></div>
                      <div className="text-right"><p className="text-sm font-bold text-primary-600">{learner.hours}h</p><p className="text-xs text-gray-500">{learner.courses} cours</p></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
    </div>

  );
}
