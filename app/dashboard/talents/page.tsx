'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  Users, TrendingUp, Award, Star, Filter, Plus, Eye, Edit,
  Target, GraduationCap, ArrowUpRight, ArrowRight, User,
  AlertTriangle, Crown, Trophy
} from 'lucide-react';

// Types
interface Employee {
  id: number;
  name: string;
  initials: string;
  position: string;
  department: string;
  performance: number; // 1-5
  potential: number; // 1-5
  tenure: string;
  photo?: string;
  skills: string[];
  certifications: string[];
  nextRole?: string;
  readiness: 'ready' | '1-2 years' | '3+ years';
  riskOfLeaving: 'low' | 'medium' | 'high';
  lastPromotion?: string;
  careerPath?: string[];
}

interface SuccessionPlan {
  id: number;
  position: string;
  department: string;
  currentHolder: string;
  criticality: 'critical' | 'high' | 'medium';
  successors: { name: string; readiness: string; score: number }[];
  vacancyRisk: 'low' | 'medium' | 'high';
}

// Data
const employees: Employee[] = [
  { id: 1, name: 'Amadou Diallo', initials: 'AD', position: 'Directeur Technique', department: 'Technologie', performance: 5, potential: 5, tenure: '4 ans', skills: ['Leadership', 'Architecture', 'Strategy'], certifications: ['AWS Solutions Architect', 'Scrum Master'], nextRole: 'CTO', readiness: 'ready', riskOfLeaving: 'low', lastPromotion: 'Mars 2023', careerPath: ['Dev Junior', 'Dev Senior', 'Tech Lead', 'Directeur Technique'] },
  { id: 2, name: 'Fatou Ndiaye', initials: 'FN', position: 'DRH', department: 'Ressources Humaines', performance: 5, potential: 4, tenure: '5 ans', skills: ['People Management', 'Stratégie RH', 'Transformation'], certifications: ['SHRM-SCP', 'Coach Certifié'], nextRole: 'DRH Groupe', readiness: '1-2 years', riskOfLeaving: 'low', lastPromotion: 'Jan 2022' },
  { id: 3, name: 'Ibrahima Fall', initials: 'IF', position: 'Directeur Commercial', department: 'Commercial', performance: 4, potential: 5, tenure: '3 ans', skills: ['Négociation', 'Business Dev', 'Leadership'], certifications: ['Sales Management'], nextRole: 'DG Adjoint', readiness: '1-2 years', riskOfLeaving: 'medium', lastPromotion: 'Sep 2023' },
  { id: 4, name: 'Aissatou Ba', initials: 'AB', position: 'Lead Developer', department: 'Technologie', performance: 5, potential: 5, tenure: '2 ans', skills: ['React', 'Node.js', 'Architecture', 'Mentoring'], certifications: ['AWS Developer'], nextRole: 'Directeur Technique', readiness: '1-2 years', riskOfLeaving: 'medium', lastPromotion: 'Juin 2024' },
  { id: 5, name: 'Moussa Sow', initials: 'MS', position: 'Chef de Projet', department: 'Technologie', performance: 4, potential: 4, tenure: '2 ans', skills: ['Agile', 'Gestion équipe', 'Communication'], certifications: ['PMP', 'Scrum Master'], nextRole: 'Directeur Projet', readiness: '1-2 years', riskOfLeaving: 'low' },
  { id: 6, name: 'Mariama Diop', initials: 'MD', position: 'Responsable Marketing', department: 'Marketing', performance: 4, potential: 3, tenure: '3 ans', skills: ['Marketing Digital', 'Brand', 'Analytics'], certifications: ['Google Analytics'], nextRole: 'Directrice Marketing', readiness: '3+ years', riskOfLeaving: 'low' },
  { id: 7, name: 'Ousmane Sy', initials: 'OS', position: 'Commercial Senior', department: 'Commercial', performance: 3, potential: 4, tenure: '1 an', skills: ['Vente B2B', 'Prospection', 'CRM'], certifications: [], nextRole: 'Manager Commercial', readiness: '1-2 years', riskOfLeaving: 'high' },
  { id: 8, name: 'Khady Faye', initials: 'KF', position: 'Développeur Senior', department: 'Technologie', performance: 4, potential: 3, tenure: '2 ans', skills: ['Python', 'Data', 'Backend'], certifications: ['Azure Fundamentals'], nextRole: 'Lead Developer', readiness: '1-2 years', riskOfLeaving: 'low' },
  { id: 9, name: 'Mamadou Mbaye', initials: 'MM', position: 'Développeur Junior', department: 'Technologie', performance: 3, potential: 5, tenure: '8 mois', skills: ['JavaScript', 'React', 'Learning'], certifications: [], nextRole: 'Développeur Senior', readiness: '1-2 years', riskOfLeaving: 'medium' },
  { id: 10, name: 'Awa Sarr', initials: 'AS', position: 'Chargée RH', department: 'Ressources Humaines', performance: 3, potential: 3, tenure: '1 an', skills: ['Recrutement', 'Admin RH', 'Paie'], certifications: [], nextRole: 'Responsable RH', readiness: '3+ years', riskOfLeaving: 'low' },
  { id: 11, name: 'Cheikh Diagne', initials: 'CD', position: 'Comptable', department: 'Finance', performance: 4, potential: 2, tenure: '4 ans', skills: ['Comptabilité', 'Fiscalité', 'Reporting'], certifications: ['DESCF'], nextRole: 'RAF', readiness: '3+ years', riskOfLeaving: 'low' },
  { id: 12, name: 'Ndèye Gueye', initials: 'NG', position: 'Assistante Direction', department: 'Direction', performance: 3, potential: 2, tenure: '2 ans', skills: ['Organisation', 'Communication', 'Office'], certifications: [], readiness: '3+ years', riskOfLeaving: 'low' },
];

const successionPlans: SuccessionPlan[] = [
  { id: 1, position: 'Directeur Général', department: 'Direction', currentHolder: 'Papa Seck', criticality: 'critical', vacancyRisk: 'low', successors: [{ name: 'Amadou Diallo', readiness: 'Prêt dans 2 ans', score: 92 }, { name: 'Ibrahima Fall', readiness: 'Prêt dans 2-3 ans', score: 85 }] },
  { id: 2, position: 'Directeur Technique', department: 'Technologie', currentHolder: 'Amadou Diallo', criticality: 'critical', vacancyRisk: 'medium', successors: [{ name: 'Aissatou Ba', readiness: 'Prêt dans 1-2 ans', score: 88 }, { name: 'Moussa Sow', readiness: 'Prêt dans 2-3 ans', score: 75 }] },
  { id: 3, position: 'DRH', department: 'Ressources Humaines', currentHolder: 'Fatou Ndiaye', criticality: 'high', vacancyRisk: 'low', successors: [{ name: 'Awa Sarr', readiness: 'Prêt dans 3+ ans', score: 65 }] },
  { id: 4, position: 'Directeur Commercial', department: 'Commercial', currentHolder: 'Ibrahima Fall', criticality: 'high', vacancyRisk: 'medium', successors: [{ name: 'Ousmane Sy', readiness: 'Prêt dans 2 ans', score: 72 }] },
];

// 9-Box Grid Labels
const performanceLabels = ['', 'Insuffisant', 'À développer', 'Conforme', 'Supérieur', 'Exceptionnel'];
const potentialLabels = ['', 'Limité', 'Stable', 'Prometteur', 'Élevé', 'Star'];

const boxColors: Record<string, string> = {
  '5-5': 'bg-green-500', '5-4': 'bg-green-400', '4-5': 'bg-green-400',
  '4-4': 'bg-blue-500', '3-5': 'bg-blue-400', '5-3': 'bg-blue-400',
  '3-4': 'bg-yellow-400', '4-3': 'bg-yellow-400', '3-3': 'bg-yellow-500',
  '2-5': 'bg-orange-400', '5-2': 'bg-orange-400', '2-4': 'bg-orange-400', '4-2': 'bg-orange-400',
  '1-5': 'bg-orange-500', '5-1': 'bg-orange-500', '2-3': 'bg-orange-500', '3-2': 'bg-orange-500',
  '1-4': 'bg-red-400', '4-1': 'bg-red-400', '1-3': 'bg-red-400', '3-1': 'bg-red-400',
  '2-2': 'bg-red-500', '1-2': 'bg-red-500', '2-1': 'bg-red-500', '1-1': 'bg-red-600',
};

const boxLabels: Record<string, { title: string; action: string }> = {
  '5-5': { title: 'Stars', action: 'Promouvoir / Responsabiliser' },
  '5-4': { title: 'Hauts Potentiels', action: 'Développer rapidement' },
  '4-5': { title: 'Futurs Leaders', action: 'Accélérer développement' },
  '4-4': { title: 'Performants Clés', action: 'Fidéliser / Développer' },
  '3-5': { title: 'Diamants Bruts', action: 'Coaching intensif' },
  '5-3': { title: 'Experts Fiables', action: 'Valoriser expertise' },
  '3-4': { title: 'Potentiel Émergent', action: 'Plan de développement' },
  '4-3': { title: 'Contributeurs Solides', action: 'Maintenir motivation' },
  '3-3': { title: 'Contributeurs Moyens', action: 'Clarifier attentes' },
  '2-4': { title: 'Inconsistants', action: 'Feedback régulier' },
  '4-2': { title: 'Spécialistes', action: 'Rôle adapté' },
  '2-3': { title: 'Sous-performants', action: 'Plan amélioration' },
  '3-2': { title: 'Efficaces limités', action: 'Accepter ou réorienter' },
  '2-2': { title: 'En difficulté', action: 'Action urgente' },
  '1-1': { title: 'Inadaptés', action: 'Décision rapide' },
};

export default function TalentsPage() {
  const [activeTab, setActiveTab] = useState<'ninebox' | 'succession' | 'development'>('ninebox');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [filterDepartment, setFilterDepartment] = useState('Tous');

  const getEmployeesByBox = (perf: number, pot: number) => {
    return employees.filter(e => e.performance === perf && e.potential === pot);
  };

  const departments = ['Tous', ...Array.from(new Set(employees.map(e => e.department)))];

  const getRiskColor = (risk: string) => {
    if (risk === 'high') return 'text-red-600 bg-red-100';
    if (risk === 'medium') return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getReadinessColor = (readiness: string) => {
    if (readiness === 'ready') return 'text-green-600 bg-green-100';
    if (readiness === '1-2 years') return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getCriticalityColor = (crit: string) => {
    if (crit === 'critical') return 'text-red-600 bg-red-100';
    if (crit === 'high') return 'text-orange-600 bg-orange-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  // Stats
  const highPotentials = employees.filter(e => e.potential >= 4 && e.performance >= 4).length;
  const atRisk = employees.filter(e => e.riskOfLeaving === 'high').length;
  const readyNow = employees.filter(e => e.readiness === 'ready').length;

  return (
    <>
      <Header title="Talents & Carrière" subtitle="9-Box, plans de succession et développement des talents" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Effectif Total</p><p className="text-2xl font-bold text-gray-900">{employees.length}</p></div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Hauts Potentiels</p><p className="text-2xl font-bold text-green-600">{highPotentials}</p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><Star className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Prêts à Promouvoir</p><p className="text-2xl font-bold text-purple-600">{readyNow}</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Risque de Départ</p><p className="text-2xl font-bold text-red-600">{atRisk}</p></div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Plans Succession</p><p className="text-2xl font-bold text-orange-600">{successionPlans.length}</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Crown className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('ninebox')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'ninebox' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Target className="w-4 h-4 inline mr-2" />Matrice 9-Box
            </button>
            <button onClick={() => setActiveTab('succession')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'succession' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Crown className="w-4 h-4 inline mr-2" />Plans de Succession
            </button>
            <button onClick={() => setActiveTab('development')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'development' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <TrendingUp className="w-4 h-4 inline mr-2" />Développement
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <div className="flex gap-3">
            <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Filter className="w-4 h-4 mr-2" />Filtres</button>
            <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Évaluer Talent</button>
          </div>
        </div>

        {/* TAB: 9-Box Matrix */}
        {activeTab === 'ninebox' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Matrice 9-Box : Performance × Potentiel</h3>
                
                {/* 9-Box Grid */}
                <div className="relative">
                  {/* Y-axis label */}
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium text-gray-500 whitespace-nowrap">
                    POTENTIEL →
                  </div>
                  
                  <div className="ml-4">
                    {/* Grid */}
                    <div className="grid grid-cols-5 gap-1">
                      {/* Header row - Performance labels */}
                      <div className="h-8"></div>
                      {[5, 4, 3, 2, 1].map(p => (
                        <div key={p} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                          {performanceLabels[p]}
                        </div>
                      ))}
                      
                      {/* Data rows */}
                      {[5, 4, 3, 2, 1].map(pot => (
                        <>
                          {/* Potential label */}
                          <div key={`label-${pot}`} className="h-24 flex items-center justify-end pr-2 text-xs font-medium text-gray-500">
                            {potentialLabels[pot]}
                          </div>
                          
                          {/* Boxes */}
                          {[5, 4, 3, 2, 1].map(perf => {
                            const boxEmployees = getEmployeesByBox(perf, pot);
                            const boxKey = `${perf}-${pot}`;
                            const boxInfo = boxLabels[boxKey] || { title: '', action: '' };
                            const bgColor = boxColors[boxKey] || 'bg-gray-200';
                            
                            return (
                              <div 
                                key={boxKey}
                                className={`h-24 ${bgColor} rounded-lg p-2 flex flex-col justify-between cursor-pointer hover:opacity-90 transition-opacity`}
                                title={`${boxInfo.title}: ${boxInfo.action}`}
                              >
                                <div className="text-white text-xs font-medium truncate">{boxInfo.title}</div>
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {boxEmployees.slice(0, 4).map(emp => (
                                    <div 
                                      key={emp.id}
                                      onClick={() => setSelectedEmployee(emp)}
                                      className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-xs font-medium text-gray-700 shadow-sm hover:ring-2 hover:ring-white cursor-pointer"
                                      title={emp.name}
                                    >
                                      {emp.initials}
                                    </div>
                                  ))}
                                  {boxEmployees.length > 4 && (
                                    <div className="w-7 h-7 bg-white/50 rounded-full flex items-center justify-center text-xs font-medium text-white">
                                      +{boxEmployees.length - 4}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                    
                    {/* X-axis label */}
                    <div className="text-center mt-2 text-sm font-medium text-gray-500">
                      ← PERFORMANCE
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded"></div><span>Stars / Hauts Potentiels</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div><span>Performants Clés</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-500 rounded"></div><span>À Développer</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded"></div><span>Attention Requise</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div><span>Action Urgente</span></div>
                </div>
              </div>
            </div>

            {/* Selected Employee Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit sticky top-6">
              {selectedEmployee ? (
                <>
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">
                      {selectedEmployee.initials}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedEmployee.name}</h3>
                    <p className="text-sm text-gray-500">{selectedEmployee.position}</p>
                    <p className="text-xs text-gray-400">{selectedEmployee.department} • {selectedEmployee.tenure}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-primary-600">{selectedEmployee.performance}/5</p>
                      <p className="text-xs text-gray-500">Performance</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{selectedEmployee.potential}/5</p>
                      <p className="text-xs text-gray-500">Potentiel</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedEmployee.nextRole && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Prochain Rôle Visé</p>
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="w-4 h-4 text-primary-500" />
                          <span className="font-medium text-gray-900">{selectedEmployee.nextRole}</span>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Prêt pour Promotion</p>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getReadinessColor(selectedEmployee.readiness)}`}>
                        {selectedEmployee.readiness === 'ready' ? 'Prêt maintenant' : selectedEmployee.readiness === '1-2 years' ? 'Dans 1-2 ans' : 'Dans 3+ ans'}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Risque de Départ</p>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(selectedEmployee.riskOfLeaving)}`}>
                        {selectedEmployee.riskOfLeaving === 'high' ? 'Élevé' : selectedEmployee.riskOfLeaving === 'medium' ? 'Moyen' : 'Faible'}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-2">Compétences Clés</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedEmployee.skills.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">{skill}</span>
                        ))}
                      </div>
                    </div>

                    {selectedEmployee.certifications.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Certifications</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedEmployee.certifications.map(cert => (
                            <span key={cert} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded flex items-center gap-1">
                              <Award className="w-3 h-3" />{cert}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEmployee.careerPath && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Parcours Carrière</p>
                        <div className="flex items-center gap-1 text-xs text-gray-600 flex-wrap">
                          {selectedEmployee.careerPath.map((role, i) => (
                            <span key={role} className="flex items-center">
                              {role}
                              {i < selectedEmployee.careerPath!.length - 1 && <ArrowRight className="w-3 h-3 mx-1 text-gray-400" />}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button className="flex-1 flex items-center justify-center px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
                      <Eye className="w-4 h-4 mr-2" />Profil Complet
                    </button>
                    <button className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                      <Edit className="w-4 h-4 mr-2" />Évaluer
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Cliquez sur un collaborateur dans la matrice pour voir son profil</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Succession Plans */}
        {activeTab === 'succession' && (
          <div className="space-y-6">
            {successionPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Crown className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{plan.position}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCriticalityColor(plan.criticality)}`}>
                            {plan.criticality === 'critical' ? 'Critique' : plan.criticality === 'high' ? 'Élevé' : 'Moyen'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{plan.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Titulaire actuel</p>
                      <p className="font-medium text-gray-900">{plan.currentHolder}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700">Successeurs Identifiés ({plan.successors.length})</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(plan.vacancyRisk)}`}>
                      Risque vacance: {plan.vacancyRisk === 'high' ? 'Élevé' : plan.vacancyRisk === 'medium' ? 'Moyen' : 'Faible'}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {plan.successors.map((successor, i) => (
                      <div key={successor.name} className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                            {i + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{successor.name}</p>
                            <p className="text-xs text-gray-500">{successor.readiness}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary-600">{successor.score}%</p>
                            <p className="text-xs text-gray-500">Score préparation</p>
                          </div>
                          <div className="w-24 h-2 bg-gray-200 rounded-full">
                            <div className={`h-full rounded-full ${successor.score >= 80 ? 'bg-green-500' : successor.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${successor.score}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button className="mt-4 flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium">
                    <Plus className="w-4 h-4 mr-1" />Ajouter un successeur
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Development */}
        {activeTab === 'development' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* High Potentials */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-gray-900">Hauts Potentiels</h3>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">{highPotentials}</span>
              </div>
              <div className="space-y-3">
                {employees.filter(e => e.potential >= 4 && e.performance >= 4).map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{emp.initials}</div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.position}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Perf / Pot</p>
                        <p className="font-medium text-gray-900">{emp.performance}/{emp.potential}</p>
                      </div>
                      <Star className="w-5 h-5 text-yellow-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* At Risk of Leaving */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-900">Risque de Départ</h3>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{atRisk}</span>
              </div>
              <div className="space-y-3">
                {employees.filter(e => e.riskOfLeaving === 'high' || e.riskOfLeaving === 'medium').map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{emp.initials}</div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.position}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(emp.riskOfLeaving)}`}>
                      {emp.riskOfLeaving === 'high' ? 'Élevé' : 'Moyen'}
                    </span>
                  </div>
                ))}
                {employees.filter(e => e.riskOfLeaving === 'high' || e.riskOfLeaving === 'medium').length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">Aucun collaborateur à risque élevé</p>
                )}
              </div>
            </div>

            {/* Ready for Promotion */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-gray-900">Prêts pour Promotion</h3>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{employees.filter(e => e.readiness === 'ready' || e.readiness === '1-2 years').length}</span>
              </div>
              <div className="space-y-3">
                {employees.filter(e => e.readiness === 'ready' || e.readiness === '1-2 years').map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{emp.initials}</div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.position} → {emp.nextRole}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getReadinessColor(emp.readiness)}`}>
                      {emp.readiness === 'ready' ? 'Prêt' : '1-2 ans'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Development Needs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Besoins en Développement</h3>
              </div>
              <div className="space-y-3">
                {employees.filter(e => e.performance <= 3 && e.potential >= 4).map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{emp.initials}</div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.position}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Potentiel élevé</p>
                      <p className="text-xs text-orange-600">Performance à développer</p>
                    </div>
                  </div>
                ))}
                {employees.filter(e => e.performance <= 3 && e.potential >= 4).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">Aucun besoin critique identifié</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
