'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  TrendingUp, 
  Star, 
  Users, 
  Calendar,
  ChevronRight,
  Plus,
  MessageSquare,
  Award
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const evaluationCampaigns = [
  { 
    id: 1, 
    name: 'Évaluation Annuelle 2024', 
    status: 'active', 
    progress: 68, 
    deadline: '31 Dec 2024',
    participants: 248,
    completed: 169
  },
  { 
    id: 2, 
    name: 'Feedback 360° - Q4', 
    status: 'upcoming', 
    progress: 0, 
    deadline: '15 Jan 2025',
    participants: 85,
    completed: 0
  },
  { 
    id: 3, 
    name: 'Évaluation Mi-Année 2024', 
    status: 'completed', 
    progress: 100, 
    deadline: '30 Jun 2024',
    participants: 235,
    completed: 235
  },
];

const performanceDistribution = [
  { rating: 'Exceptionnel', count: 28, color: '#10B981' },
  { rating: 'Dépasse attentes', count: 67, color: '#3B82F6' },
  { rating: 'Atteint attentes', count: 112, color: '#8B5CF6' },
  { rating: 'Amélioration', count: 32, color: '#F59E0B' },
  { rating: 'Insuffisant', count: 9, color: '#EF4444' },
];

const competencyData = [
  { subject: 'Communication', A: 85, fullMark: 100 },
  { subject: 'Leadership', A: 72, fullMark: 100 },
  { subject: 'Technique', A: 90, fullMark: 100 },
  { subject: 'Collaboration', A: 88, fullMark: 100 },
  { subject: 'Innovation', A: 75, fullMark: 100 },
  { subject: 'Résolution problèmes', A: 82, fullMark: 100 },
];

const pendingReviews = [
  { id: 1, employee: 'Thomas Martin', department: 'Tech', type: 'Auto-évaluation', dueIn: '3 jours' },
  { id: 2, employee: 'Claire Dubois', department: 'Marketing', type: 'Manager', dueIn: '5 jours' },
  { id: 3, employee: 'Lucas Bernard', department: 'Sales', type: '360° Peer', dueIn: '7 jours' },
  { id: 4, employee: 'Emma Leroy', department: 'RH', type: 'Auto-évaluation', dueIn: '10 jours' },
];

const topPerformers = [
  { id: 1, name: 'Sophie Martin', department: 'Tech', score: 4.9, trend: '+0.3' },
  { id: 2, name: 'Jean Dupont', department: 'Sales', score: 4.8, trend: '+0.2' },
  { id: 3, name: 'Marie Leroy', department: 'Marketing', score: 4.7, trend: '+0.4' },
  { id: 4, name: 'Pierre Durant', department: 'Finance', score: 4.6, trend: '+0.1' },
  { id: 5, name: 'Anne Richard', department: 'Tech', score: 4.6, trend: '+0.2' },
];

export default function PerformancePage() {
  const [selectedTab, setSelectedTab] = useState('campaigns');

  return (
    <>
      <Header title="Gestion de Performance" subtitle="Évaluations, feedback 360° et suivi des performances" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Score Moyen</p>
                <p className="text-2xl font-bold text-gray-900">4.2<span className="text-lg text-gray-400">/5</span></p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Évaluations Complétées</p>
                <p className="text-2xl font-bold text-green-600">169<span className="text-lg text-gray-400">/248</span></p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Feedback Reçus</p>
                <p className="text-2xl font-bold text-purple-600">523</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Campagnes Actives</p>
                <p className="text-2xl font-bold text-orange-600">2</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setSelectedTab('campaigns')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'campaigns' 
                ? 'border-primary-500 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Campagnes d&apos;Évaluation
          </button>
          <button
            onClick={() => setSelectedTab('reviews')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'reviews' 
                ? 'border-primary-500 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Évaluations en Attente
          </button>
          <button
            onClick={() => setSelectedTab('analytics')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'analytics' 
                ? 'border-primary-500 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Tab Content */}
        {selectedTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Campagnes d&apos;Évaluation</h3>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Campagne
              </button>
            </div>

            <div className="space-y-4">
              {evaluationCampaigns.map((campaign) => (
                <div key={campaign.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">{campaign.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                          campaign.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {campaign.status === 'active' ? 'En cours' :
                           campaign.status === 'upcoming' ? 'À venir' : 'Terminée'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {campaign.completed}/{campaign.participants} participants
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Échéance: {campaign.deadline}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-2xl font-bold text-gray-900">{campaign.progress}%</span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full mt-2">
                          <div 
                            className={`h-full rounded-full ${
                              campaign.progress === 100 ? 'bg-green-500' : 'bg-primary-500'
                            }`}
                            style={{ width: `${campaign.progress}%` }}
                          ></div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTab === 'reviews' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Évaluations à Compléter</h3>
              <div className="space-y-4">
                {pendingReviews.map((review) => (
                  <div key={review.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-sm font-medium text-primary-700">
                        {review.employee.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{review.employee}</p>
                        <p className="text-xs text-gray-500">{review.department} • {review.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-orange-600 font-medium">Dans {review.dueIn}</span>
                      <button className="block mt-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                        Compléter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
              <div className="space-y-4">
                {topPerformers.map((performer, index) => (
                  <div key={performer.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="w-6 text-sm font-bold text-gray-400">#{index + 1}</span>
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center ml-2">
                        <Award className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{performer.name}</p>
                        <p className="text-xs text-gray-500">{performer.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">{performer.score}</span>
                      <span className="text-sm text-green-600 ml-2">({performer.trend})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'analytics' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribution des Notes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                    <YAxis dataKey="rating" type="category" stroke="#9CA3AF" fontSize={12} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {performanceDistribution.map((entry, index) => (
                        <Bar key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Profil Compétences (Moyenne)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={competencyData}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="subject" stroke="#9CA3AF" fontSize={12} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#9CA3AF" fontSize={10} />
                    <Radar name="Score" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
