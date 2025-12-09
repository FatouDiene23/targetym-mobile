'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  Target, 
  Plus, 
  ChevronDown, 
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreVertical
} from 'lucide-react';

interface KeyResult {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
}

interface Objective {
  id: string;
  title: string;
  owner: string;
  ownerInitials: string;
  period: string;
  progress: number;
  status: 'on-track' | 'at-risk' | 'behind';
  keyResults: KeyResult[];
  expanded?: boolean;
}

const initialObjectives: Objective[] = [
  {
    id: '1',
    title: 'Augmenter la satisfaction client',
    owner: 'Marie Dupont',
    ownerInitials: 'MD',
    period: 'Q4 2024',
    progress: 75,
    status: 'on-track',
    keyResults: [
      { id: 'kr1', title: 'Score NPS', target: 50, current: 42, unit: 'points' },
      { id: 'kr2', title: 'Temps de réponse support', target: 2, current: 1.8, unit: 'heures' },
      { id: 'kr3', title: 'Taux de résolution au premier contact', target: 85, current: 78, unit: '%' },
    ],
    expanded: true
  },
  {
    id: '2',
    title: 'Développer les compétences de l\'équipe',
    owner: 'Jean Martin',
    ownerInitials: 'JM',
    period: 'Q4 2024',
    progress: 60,
    status: 'at-risk',
    keyResults: [
      { id: 'kr4', title: 'Formations complétées', target: 100, current: 65, unit: '%' },
      { id: 'kr5', title: 'Certifications obtenues', target: 15, current: 8, unit: '' },
      { id: 'kr6', title: 'Score évaluation compétences', target: 4.5, current: 4.1, unit: '/5' },
    ],
    expanded: false
  },
  {
    id: '3',
    title: 'Améliorer le processus de recrutement',
    owner: 'Sophie Bernard',
    ownerInitials: 'SB',
    period: 'Q4 2024',
    progress: 45,
    status: 'behind',
    keyResults: [
      { id: 'kr7', title: 'Délai moyen de recrutement', target: 30, current: 42, unit: 'jours' },
      { id: 'kr8', title: 'Taux d\'acceptation offres', target: 90, current: 75, unit: '%' },
      { id: 'kr9', title: 'Qualité des embauches (score 90j)', target: 4.0, current: 3.8, unit: '/5' },
    ],
    expanded: false
  },
  {
    id: '4',
    title: 'Renforcer l\'engagement des employés',
    owner: 'Pierre Leroy',
    ownerInitials: 'PL',
    period: 'Q4 2024',
    progress: 88,
    status: 'on-track',
    keyResults: [
      { id: 'kr10', title: 'Score engagement (enquête)', target: 8.5, current: 8.2, unit: '/10' },
      { id: 'kr11', title: 'Taux de participation événements', target: 80, current: 85, unit: '%' },
      { id: 'kr12', title: 'Turnover volontaire', target: 5, current: 4.2, unit: '%' },
    ],
    expanded: false
  },
];

const periods = ['Q4 2024', 'Q3 2024', 'Q2 2024', 'Q1 2024'];
const statuses = ['Tous', 'En bonne voie', 'À risque', 'En retard'];

export default function OKRPage() {
  const [objectives, setObjectives] = useState(initialObjectives);
  const [selectedPeriod, setSelectedPeriod] = useState('Q4 2024');
  const [selectedStatus, setSelectedStatus] = useState('Tous');

  const toggleExpand = (id: string) => {
    setObjectives(objectives.map(obj => 
      obj.id === id ? { ...obj, expanded: !obj.expanded } : obj
    ));
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'on-track': return 'bg-green-100 text-green-700';
      case 'at-risk': return 'bg-yellow-100 text-yellow-700';
      case 'behind': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'on-track': return 'En bonne voie';
      case 'at-risk': return 'À risque';
      case 'behind': return 'En retard';
      default: return status;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 70) return 'bg-green-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <>
      <Header title="OKR & Objectifs" subtitle="Gérez et suivez vos objectifs et résultats clés" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Objectifs</p>
                <p className="text-2xl font-bold text-gray-900">24</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">En bonne voie</p>
                <p className="text-2xl font-bold text-green-600">16</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">À risque</p>
                <p className="text-2xl font-bold text-yellow-600">5</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">En retard</p>
                <p className="text-2xl font-bold text-red-600">3</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              {periods.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <button 
            className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvel Objectif
          </button>
        </div>

        {/* Objectives List */}
        <div className="space-y-4">
          {objectives.map((objective) => (
            <div key={objective.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Objective Header */}
              <div 
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(objective.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start flex-1">
                    <button className="mt-1 mr-3 text-gray-400">
                      {objective.expanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{objective.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className="flex items-center">
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-xs font-medium text-primary-700">
                            {objective.ownerInitials}
                          </div>
                          <span className="ml-2 text-sm text-gray-600">{objective.owner}</span>
                        </div>
                        <span className="text-sm text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{objective.period}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(objective.status)}`}>
                          {getStatusLabel(objective.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-2xl font-bold text-gray-900">{objective.progress}%</span>
                      <div className="w-32 h-2 bg-gray-200 rounded-full mt-2">
                        <div 
                          className={`h-full rounded-full ${getProgressColor(objective.progress)}`}
                          style={{ width: `${objective.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <button 
                      className="p-2 text-gray-400 hover:text-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Key Results */}
              {objective.expanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Résultats Clés</h4>
                  <div className="space-y-4">
                    {objective.keyResults.map((kr) => (
                      <div key={kr.id} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">{kr.title}</span>
                          <span className="text-sm text-gray-600">
                            {kr.current} / {kr.target} {kr.unit}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full">
                          <div 
                            className={`h-full rounded-full ${getProgressColor((kr.current / kr.target) * 100)}`}
                            style={{ width: `${Math.min((kr.current / kr.target) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="mt-4 flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium">
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter un résultat clé
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
