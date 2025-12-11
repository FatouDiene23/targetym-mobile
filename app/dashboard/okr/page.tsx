'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  Plus, ChevronDown, ChevronRight, MoreVertical,
  Building2, Users, User, Download, Link2, BarChart3, GitBranch, Layers
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface KeyResult { id: string; title: string; target: number; current: number; unit: string; weight: number; }
interface Initiative { id: string; title: string; source: string; progress: number; dueDate: string; status: string; }
interface Objective { id: string; title: string; level: string; owner: string; ownerInitials: string; department?: string; period: string; progress: number; status: string; keyResults: KeyResult[]; initiatives?: Initiative[]; parentId?: string; expanded?: boolean; }

const okrData: Objective[] = [
  { id: 'ent-1', title: 'Devenir le leader du marché RH en Afrique francophone', level: 'enterprise', owner: 'Amadou Diallo', ownerInitials: 'AD', period: '2024', progress: 72, status: 'on-track',
    keyResults: [{ id: 'kr1', title: 'Atteindre 500 clients actifs', target: 500, current: 360, unit: 'clients', weight: 40 }, { id: 'kr2', title: 'Chiffre d\'affaires', target: 2000, current: 1440, unit: 'M XOF', weight: 35 }, { id: 'kr3', title: 'NPS clients', target: 50, current: 42, unit: 'points', weight: 25 }],
    initiatives: [{ id: 'init1', title: 'Campagne marketing digital', source: 'Asana', progress: 85, dueDate: '15 Dec 2024', status: 'on-track' }, { id: 'init2', title: 'Expansion Côte d\'Ivoire', source: 'Notion', progress: 60, dueDate: '31 Dec 2024', status: 'at-risk' }], expanded: true },
  { id: 'ent-2', title: 'Développer une culture d\'excellence et d\'innovation', level: 'enterprise', owner: 'Amadou Diallo', ownerInitials: 'AD', period: '2024', progress: 65, status: 'at-risk',
    keyResults: [{ id: 'kr4', title: 'Score engagement employés', target: 85, current: 72, unit: '%', weight: 35 }, { id: 'kr5', title: 'Nouvelles fonctionnalités livrées', target: 24, current: 18, unit: '', weight: 40 }, { id: 'kr6', title: 'Taux de rétention talents clés', target: 95, current: 88, unit: '%', weight: 25 }], expanded: false },
  { id: 'dept-1', title: 'Acquérir 200 nouveaux clients', level: 'department', owner: 'Ibrahima Fall', ownerInitials: 'IF', department: 'Commercial', period: 'Q4 2024', progress: 68, status: 'on-track', parentId: 'ent-1',
    keyResults: [{ id: 'kr7', title: 'Nouveaux clients signés', target: 200, current: 136, unit: '', weight: 50 }, { id: 'kr8', title: 'Pipeline commercial', target: 500, current: 420, unit: 'leads', weight: 30 }, { id: 'kr9', title: 'Taux de conversion', target: 25, current: 22, unit: '%', weight: 20 }], expanded: false },
  { id: 'dept-2', title: 'Livrer la V2 de la plateforme', level: 'department', owner: 'Moussa Sow', ownerInitials: 'MS', department: 'Technologie', period: 'Q4 2024', progress: 78, status: 'on-track', parentId: 'ent-1',
    keyResults: [{ id: 'kr10', title: 'Modules livrés', target: 8, current: 6, unit: '', weight: 40 }, { id: 'kr11', title: 'Bugs critiques résolus', target: 100, current: 95, unit: '%', weight: 30 }, { id: 'kr12', title: 'Temps de chargement', target: 2, current: 2.3, unit: 'sec', weight: 30 }], expanded: false },
  { id: 'dept-3', title: 'Renforcer la marque employeur', level: 'department', owner: 'Fatou Ndiaye', ownerInitials: 'FN', department: 'Ressources Humaines', period: 'Q4 2024', progress: 82, status: 'on-track', parentId: 'ent-1',
    keyResults: [{ id: 'kr13', title: 'Candidatures spontanées', target: 500, current: 410, unit: '', weight: 30 }, { id: 'kr14', title: 'Score Glassdoor', target: 4.5, current: 4.2, unit: '/5', weight: 35 }, { id: 'kr15', title: 'Délai de recrutement', target: 25, current: 28, unit: 'jours', weight: 35 }], expanded: false },
  { id: 'dept-4', title: 'Améliorer l\'engagement des équipes', level: 'department', owner: 'Fatou Ndiaye', ownerInitials: 'FN', department: 'Ressources Humaines', period: 'Q4 2024', progress: 58, status: 'at-risk', parentId: 'ent-2',
    keyResults: [{ id: 'kr16', title: 'Participation aux événements', target: 90, current: 65, unit: '%', weight: 40 }, { id: 'kr17', title: 'Formation managers', target: 100, current: 70, unit: '%', weight: 30 }, { id: 'kr18', title: 'Score eNPS', target: 40, current: 28, unit: 'points', weight: 30 }], expanded: false },
  { id: 'ind-1', title: 'Signer 50 nouveaux clients PME', level: 'individual', owner: 'Mamadou Diop', ownerInitials: 'MD', department: 'Commercial', period: 'Q4 2024', progress: 72, status: 'on-track', parentId: 'dept-1',
    keyResults: [{ id: 'kr22', title: 'Clients PME signés', target: 50, current: 36, unit: '', weight: 60 }, { id: 'kr23', title: 'Démos réalisées', target: 100, current: 85, unit: '', weight: 40 }], expanded: false },
  { id: 'ind-2', title: 'Développer le segment Grands Comptes', level: 'individual', owner: 'Awa Sarr', ownerInitials: 'AS', department: 'Commercial', period: 'Q4 2024', progress: 45, status: 'behind', parentId: 'dept-1',
    keyResults: [{ id: 'kr24', title: 'Grands comptes signés', target: 10, current: 3, unit: '', weight: 50 }, { id: 'kr25', title: 'RDV C-Level', target: 30, current: 18, unit: '', weight: 50 }], expanded: false },
  { id: 'ind-3', title: 'Développer le module Analytics', level: 'individual', owner: 'Aissatou Ba', ownerInitials: 'AB', department: 'Technologie', period: 'Q4 2024', progress: 85, status: 'on-track', parentId: 'dept-2',
    keyResults: [{ id: 'kr26', title: 'Dashboards livrés', target: 12, current: 10, unit: '', weight: 50 }, { id: 'kr27', title: 'Performance API', target: 200, current: 180, unit: 'ms', weight: 50 }], expanded: false },
  { id: 'ind-4', title: 'Optimiser l\'infrastructure cloud', level: 'individual', owner: 'Oumar Sy', ownerInitials: 'OS', department: 'Technologie', period: 'Q4 2024', progress: 92, status: 'exceeded', parentId: 'dept-2',
    keyResults: [{ id: 'kr28', title: 'Uptime', target: 99.9, current: 99.95, unit: '%', weight: 50 }, { id: 'kr29', title: 'Coûts cloud réduits', target: 20, current: 25, unit: '%', weight: 50 }], expanded: false },
];

const statusDistribution = [{ name: 'En bonne voie', value: 14, color: '#10B981' }, { name: 'À risque', value: 5, color: '#F59E0B' }, { name: 'En retard', value: 3, color: '#EF4444' }, { name: 'Dépassé', value: 2, color: '#6366F1' }];
const departmentProgress = [{ name: 'Commercial', progress: 68 }, { name: 'Tech', progress: 78 }, { name: 'RH', progress: 70 }, { name: 'Finance', progress: 82 }, { name: 'Marketing', progress: 55 }];

export default function OKRPage() {
  const [objectives, setObjectives] = useState(okrData);
  const [selectedPeriod, setSelectedPeriod] = useState('2024');
  const [selectedLevel, setSelectedLevel] = useState('Tous');
  const [activeTab, setActiveTab] = useState<'list' | 'cascade' | 'dashboard'>('list');

  const toggleExpand = (id: string) => setObjectives(objectives.map(obj => obj.id === id ? { ...obj, expanded: !obj.expanded } : obj));

  const getStatusColor = (s: string) => { const m: Record<string,string> = { 'on-track': 'bg-green-100 text-green-700', 'at-risk': 'bg-yellow-100 text-yellow-700', 'behind': 'bg-red-100 text-red-700', 'exceeded': 'bg-indigo-100 text-indigo-700' }; return m[s] || 'bg-gray-100 text-gray-700'; };
  const getStatusLabel = (s: string) => { const m: Record<string,string> = { 'on-track': 'En bonne voie', 'at-risk': 'À risque', 'behind': 'En retard', 'exceeded': 'Dépassé' }; return m[s] || s; };
  const getProgressColor = (p: number) => p >= 90 ? 'bg-indigo-500' : p >= 70 ? 'bg-green-500' : p >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const getLevelIcon = (l: string) => l === 'enterprise' ? <Building2 className="w-4 h-4" /> : l === 'department' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />;
  const getLevelLabel = (l: string) => { const m: Record<string,string> = { enterprise: 'Entreprise', department: 'Département', individual: 'Individuel' }; return m[l] || l; };
  const getLevelColor = (l: string) => { const m: Record<string,string> = { enterprise: 'bg-purple-100 text-purple-700', department: 'bg-blue-100 text-blue-700', individual: 'bg-teal-100 text-teal-700' }; return m[l] || 'bg-gray-100'; };

  const enterpriseOKRs = objectives.filter(o => o.level === 'enterprise');
  const departmentOKRs = objectives.filter(o => o.level === 'department');
  const individualOKRs = objectives.filter(o => o.level === 'individual');
  const avgProgress = Math.round(objectives.reduce((sum, o) => sum + o.progress, 0) / objectives.length);

  return (
    <>
      <Header title="OKR & Objectifs" subtitle="Pilotage stratégique - Alignement Entreprise → Département → Individuel" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500">Total OKRs</p><p className="text-2xl font-bold">{objectives.length}</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500">Progression Moy.</p><p className="text-2xl font-bold">{avgProgress}%</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500">En bonne voie</p><p className="text-2xl font-bold text-green-600">{objectives.filter(o => o.status === 'on-track').length}</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500">À risque</p><p className="text-2xl font-bold text-yellow-600">{objectives.filter(o => o.status === 'at-risk').length}</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500">En retard</p><p className="text-2xl font-bold text-red-600">{objectives.filter(o => o.status === 'behind').length}</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500">Dépassés</p><p className="text-2xl font-bold text-indigo-600">{objectives.filter(o => o.status === 'exceeded').length}</p></div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('list')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'list' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}><Layers className="w-4 h-4 inline mr-2" />Liste des OKRs</button>
            <button onClick={() => setActiveTab('cascade')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'cascade' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}><GitBranch className="w-4 h-4 inline mr-2" />Cascade Stratégique</button>
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'dashboard' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}><BarChart3 className="w-4 h-4 inline mr-2" />Tableau de Bord</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <div className="flex gap-3">
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="px-4 py-2 border rounded-lg text-sm bg-white">
              <option>2024</option><option>Q4 2024</option><option>Q3 2024</option>
            </select>
            <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="px-4 py-2 border rounded-lg text-sm bg-white">
              <option>Tous</option><option>Entreprise</option><option>Département</option><option>Individuel</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Download className="w-4 h-4 mr-2" />Exporter</button>
            <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Nouvel OKR</button>
          </div>
        </div>

        {/* Tab Content: List */}
        {activeTab === 'list' && (
          <div className="space-y-6">
            {[{ title: 'OKRs Entreprise', data: enterpriseOKRs, icon: Building2, color: 'purple' }, { title: 'OKRs Département', data: departmentOKRs, icon: Users, color: 'blue' }, { title: 'OKRs Individuels', data: individualOKRs, icon: User, color: 'teal' }].map(section => section.data.length > 0 && (
              <div key={section.title}>
                <div className="flex items-center gap-2 mb-4">
                  <section.icon className={`w-5 h-5 text-${section.color}-600`} />
                  <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  <span className={`px-2 py-0.5 bg-${section.color}-100 text-${section.color}-700 text-xs font-medium rounded-full`}>{section.data.length}</span>
                </div>
                <div className="space-y-3">
                  {section.data.map((obj) => (
                    <div key={obj.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(obj.id)}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start flex-1">
                            <button className="mt-1 mr-3 text-gray-400">{obj.expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(obj.level)}`}>{getLevelIcon(obj.level)}{getLevelLabel(obj.level)}</span>
                                {obj.department && <span className="text-xs text-gray-500">• {obj.department}</span>}
                              </div>
                              <h3 className="text-base font-semibold text-gray-900">{obj.title}</h3>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center"><div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs font-medium text-primary-700">{obj.ownerInitials}</div><span className="ml-2 text-sm text-gray-600">{obj.owner}</span></div>
                                <span className="text-sm text-gray-400">•</span><span className="text-sm text-gray-500">{obj.period}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(obj.status)}`}>{getStatusLabel(obj.status)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-2xl font-bold text-gray-900">{obj.progress}%</span>
                              <div className="w-28 h-2 bg-gray-200 rounded-full mt-1"><div className={`h-full rounded-full ${getProgressColor(obj.progress)}`} style={{ width: `${obj.progress}%` }} /></div>
                            </div>
                            <button className="p-2 text-gray-400 hover:text-gray-600" onClick={(e) => e.stopPropagation()}><MoreVertical className="w-5 h-5" /></button>
                          </div>
                        </div>
                      </div>
                      {obj.expanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Résultats Clés ({obj.keyResults.length})</h4>
                          <div className="space-y-3">
                            {obj.keyResults.map((kr) => (
                              <div key={kr.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-900">{kr.title}</span>
                                  <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Poids: {kr.weight}%</span><span className="text-sm font-medium text-gray-700">{kr.current} / {kr.target} {kr.unit}</span></div>
                                </div>
                                <div className="w-full h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${getProgressColor((kr.current / kr.target) * 100)}`} style={{ width: `${Math.min((kr.current / kr.target) * 100, 100)}%` }} /></div>
                              </div>
                            ))}
                          </div>
                          {obj.initiatives && obj.initiatives.length > 0 && (
                            <>
                              <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-3">Initiatives & Projets liés</h4>
                              <div className="space-y-2">
                                {obj.initiatives.map((init) => (
                                  <div key={init.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center"><Link2 className="w-4 h-4 text-indigo-600" /></div>
                                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">{init.title}</p><p className="text-xs text-gray-500">{init.source} • {init.dueDate}</p></div>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(init.status)}`}>{init.progress}%</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                          <div className="flex gap-2 mt-4">
                            <button className="flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"><Plus className="w-4 h-4 mr-1" />Ajouter un KR</button>
                            <button className="flex items-center text-sm text-gray-500 hover:text-gray-700 font-medium ml-4"><Link2 className="w-4 h-4 mr-1" />Lier un projet</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: Cascade */}
        {activeTab === 'cascade' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Vue Cascade : Alignement Stratégique</h2>
            <div className="space-y-8">
              {enterpriseOKRs.map((entOKR) => (
                <div key={entOKR.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-purple-50 p-4 border-b border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><span className="text-xs font-medium text-purple-600 uppercase">Entreprise</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(entOKR.status)}`}>{getStatusLabel(entOKR.status)}</span></div>
                        <h3 className="font-semibold text-gray-900">{entOKR.title}</h3>
                      </div>
                      <div className="text-right"><span className="text-2xl font-bold text-purple-600">{entOKR.progress}%</span><div className="w-32 h-2 bg-purple-200 rounded-full mt-1"><div className="h-full bg-purple-600 rounded-full" style={{ width: `${entOKR.progress}%` }} /></div></div>
                    </div>
                  </div>
                  <div className="bg-white p-4">
                    <div className="pl-8 border-l-2 border-purple-300 ml-4 space-y-4">
                      {departmentOKRs.filter(d => d.parentId === entOKR.id).map((deptOKR) => (
                        <div key={deptOKR.id}>
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2"><span className="text-xs font-medium text-blue-600">{deptOKR.department}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deptOKR.status)}`}>{getStatusLabel(deptOKR.status)}</span></div>
                                <h4 className="font-medium text-gray-900 text-sm">{deptOKR.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">Responsable: {deptOKR.owner}</p>
                              </div>
                              <div className="text-right"><span className="text-xl font-bold text-blue-600">{deptOKR.progress}%</span><div className="w-24 h-1.5 bg-blue-200 rounded-full mt-1"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${deptOKR.progress}%` }} /></div></div>
                            </div>
                          </div>
                          <div className="pl-8 border-l-2 border-blue-300 ml-4 mt-3 space-y-2">
                            {individualOKRs.filter(i => i.parentId === deptOKR.id).map((indOKR) => (
                              <div key={indOKR.id} className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-teal-600 rounded flex items-center justify-center text-xs font-medium text-white">{indOKR.ownerInitials}</div>
                                  <div className="flex-1"><p className="text-sm font-medium text-gray-900">{indOKR.title}</p><p className="text-xs text-gray-500">{indOKR.owner}</p></div>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(indOKR.status)}`}>{indOKR.progress}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Répartition par Statut</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">{statusDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">{statusDistribution.map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm text-gray-600">{item.name}</span></div>))}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Progression par Département</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentProgress} layout="vertical"><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="name" width={80} /><Tooltip formatter={(value) => `${value}%`} /><Bar dataKey="progress" fill="#6366F1" radius={[0, 4, 4, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">🚨 OKRs Critiques</h3>
              <div className="space-y-3">
                {objectives.filter(o => o.status === 'at-risk' || o.status === 'behind').slice(0, 5).map((okr) => (
                  <div key={okr.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${okr.status === 'behind' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{okr.title}</p><p className="text-xs text-gray-500">{okr.owner} • {okr.department || 'Entreprise'}</p></div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(okr.status)}`}>{okr.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">📋 Initiatives Stratégiques</h3>
              <div className="space-y-3">
                {objectives.flatMap(o => o.initiatives || []).slice(0, 5).map((init) => (
                  <div key={init.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center"><Link2 className="w-4 h-4 text-indigo-600" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{init.title}</p><p className="text-xs text-gray-500">{init.source} • {init.dueDate}</p></div>
                    <div className="text-right"><span className="text-sm font-medium">{init.progress}%</span><div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1"><div className={`h-full rounded-full ${getProgressColor(init.progress)}`} style={{ width: `${init.progress}%` }} /></div></div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4 flex items-center gap-1"><Link2 className="w-3 h-3" />Données synchronisées depuis Asana, Notion, Trello</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
