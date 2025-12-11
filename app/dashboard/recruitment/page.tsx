'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  UserPlus, Briefcase, Users, Clock, Mail, Phone, MapPin, Filter, Plus, XCircle,
  FileText, Linkedin, GraduationCap, Building2, TrendingUp, Eye, Edit, MoreVertical,
  ArrowRight, MessageSquare, Video, Search, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

// Types
interface Candidate {
  id: number;
  name: string;
  position: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  portfolio?: string;
  aiScore: number;
  aiScoreDetails: { category: string; score: number }[];
  stage: string;
  applied: string;
  skills: string[];
  experience: string;
  education: string;
  currentCompany?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  source: string;
  timeline: { date: string; event: string; type: string }[];
}

interface Job {
  id: number;
  title: string;
  department: string;
  location: string;
  type: string;
  applicants: number;
  status: string;
  posted: string;
  salary?: string;
  description?: string;
  requirements?: string[];
  urgency: 'high' | 'medium' | 'low';
  hiringManager: string;
  deadline?: string;
}

// Data
const jobs: Job[] = [
  { id: 1, title: 'Développeur Full Stack Senior', department: 'Technologie', location: 'Dakar', type: 'CDI', applicants: 45, status: 'active', posted: '15 Nov 2024', salary: '1.5M - 2M XOF', urgency: 'high', hiringManager: 'Moussa Sow', deadline: '31 Dec 2024', requirements: ['5+ ans expérience', 'React/Node.js', 'PostgreSQL'] },
  { id: 2, title: 'Chef de Projet Digital', department: 'Marketing', location: 'Abidjan', type: 'CDI', applicants: 28, status: 'active', posted: '20 Nov 2024', salary: '1.2M - 1.5M XOF', urgency: 'medium', hiringManager: 'Awa Diop', deadline: '15 Jan 2025', requirements: ['3+ ans expérience', 'Agile/Scrum', 'Marketing Digital'] },
  { id: 3, title: 'Data Analyst', department: 'Technologie', location: 'Remote', type: 'CDI', applicants: 62, status: 'active', posted: '10 Nov 2024', salary: '1M - 1.3M XOF', urgency: 'high', hiringManager: 'Moussa Sow', deadline: '20 Dec 2024', requirements: ['Python/SQL', 'Tableau/Power BI', 'Machine Learning'] },
  { id: 4, title: 'Responsable Commercial', department: 'Commercial', location: 'Dakar', type: 'CDI', applicants: 18, status: 'active', posted: '25 Nov 2024', salary: '1.8M - 2.5M XOF', urgency: 'medium', hiringManager: 'Ibrahima Fall', requirements: ['5+ ans B2B', 'SaaS', 'Management équipe'] },
  { id: 5, title: 'UX/UI Designer', department: 'Produit', location: 'Remote', type: 'CDI', applicants: 35, status: 'draft', posted: '-', salary: '800K - 1.2M XOF', urgency: 'low', hiringManager: 'Fatou Ndiaye', requirements: ['Figma', 'Design System', 'User Research'] },
];

const candidates: Candidate[] = [
  { 
    id: 1, name: 'Amadou Diallo', position: 'Développeur Full Stack Senior', email: 'amadou.diallo@email.com', phone: '+221 77 123 45 67', location: 'Dakar, Sénégal', linkedin: 'linkedin.com/in/amadoudiallo',
    aiScore: 94, aiScoreDetails: [{ category: 'Compétences techniques', score: 96 }, { category: 'Expérience', score: 92 }, { category: 'Formation', score: 90 }, { category: 'Culture fit', score: 95 }],
    stage: 'Entretien technique', applied: '25 Nov 2024', skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'Docker'], experience: '6 ans', education: 'Master Informatique - ESP Dakar', currentCompany: 'Orange Digital Center', expectedSalary: '1.8M XOF', noticePeriod: '1 mois', source: 'LinkedIn',
    timeline: [{ date: '25 Nov', event: 'Candidature reçue', type: 'applied' }, { date: '26 Nov', event: 'CV présélectionné par IA', type: 'screened' }, { date: '28 Nov', event: 'Entretien RH - Fatou Ndiaye', type: 'interview' }, { date: '02 Dec', event: 'Entretien technique planifié', type: 'scheduled' }]
  },
  { 
    id: 2, name: 'Fatima Keita', position: 'Développeur Full Stack Senior', email: 'fatima.keita@email.com', phone: '+225 07 89 12 34 56', location: 'Abidjan, Côte d\'Ivoire',
    aiScore: 88, aiScoreDetails: [{ category: 'Compétences techniques', score: 90 }, { category: 'Expérience', score: 85 }, { category: 'Formation', score: 88 }, { category: 'Culture fit', score: 89 }],
    stage: 'Screening CV', applied: '28 Nov 2024', skills: ['Vue.js', 'Python', 'Django', 'MongoDB', 'GCP'], experience: '4 ans', education: 'Ingénieur - INP-HB', source: 'Site Carrière',
    timeline: [{ date: '28 Nov', event: 'Candidature reçue', type: 'applied' }, { date: '29 Nov', event: 'En cours d\'analyse IA', type: 'screening' }]
  },
  { 
    id: 3, name: 'Ousmane Ba', position: 'Data Analyst', email: 'ousmane.ba@email.com', phone: '+221 78 456 78 90', location: 'Remote',
    aiScore: 96, aiScoreDetails: [{ category: 'Compétences techniques', score: 98 }, { category: 'Expérience', score: 94 }, { category: 'Formation', score: 95 }, { category: 'Culture fit', score: 96 }],
    stage: 'Offre envoyée', applied: '18 Nov 2024', skills: ['Python', 'SQL', 'Tableau', 'Machine Learning', 'Power BI', 'Spark'], experience: '5 ans', education: 'Master Data Science - Paris Saclay', currentCompany: 'Jumia', expectedSalary: '1.3M XOF', noticePeriod: '2 semaines', source: 'Référence interne',
    timeline: [{ date: '18 Nov', event: 'Candidature reçue', type: 'applied' }, { date: '19 Nov', event: 'CV présélectionné par IA', type: 'screened' }, { date: '21 Nov', event: 'Entretien RH', type: 'interview' }, { date: '25 Nov', event: 'Test technique - 95%', type: 'test' }, { date: '28 Nov', event: 'Entretien final - DG', type: 'interview' }, { date: '01 Dec', event: 'Offre envoyée - 1.25M XOF', type: 'offer' }]
  },
  { 
    id: 4, name: 'Aissatou Sow', position: 'Chef de Projet Digital', email: 'aissatou.sow@email.com', phone: '+221 76 234 56 78', location: 'Dakar, Sénégal',
    aiScore: 82, aiScoreDetails: [{ category: 'Compétences techniques', score: 78 }, { category: 'Expérience', score: 85 }, { category: 'Formation', score: 80 }, { category: 'Culture fit', score: 88 }],
    stage: 'Entretien RH', applied: '22 Nov 2024', skills: ['Agile', 'Jira', 'Marketing Digital', 'SEO', 'Google Analytics'], experience: '4 ans', education: 'Master Marketing - ISM', source: 'Indeed',
    timeline: [{ date: '22 Nov', event: 'Candidature reçue', type: 'applied' }, { date: '24 Nov', event: 'CV présélectionné', type: 'screened' }, { date: '30 Nov', event: 'Entretien RH planifié', type: 'scheduled' }]
  },
  { 
    id: 5, name: 'Mamadou Diop', position: 'Développeur Full Stack Senior', email: 'mamadou.diop@email.com', phone: '+221 77 987 65 43', location: 'Thiès, Sénégal',
    aiScore: 75, aiScoreDetails: [{ category: 'Compétences techniques', score: 72 }, { category: 'Expérience', score: 70 }, { category: 'Formation', score: 80 }, { category: 'Culture fit', score: 78 }],
    stage: 'Candidatures', applied: '30 Nov 2024', skills: ['PHP', 'Laravel', 'MySQL', 'JavaScript'], experience: '3 ans', education: 'Licence Informatique - UCAD', source: 'LinkedIn',
    timeline: [{ date: '30 Nov', event: 'Candidature reçue', type: 'applied' }]
  },
];

const pipelineStages = [
  { id: 'candidatures', name: 'Candidatures', color: 'bg-gray-500' },
  { id: 'screening', name: 'Screening CV', color: 'bg-blue-500' },
  { id: 'entretien-rh', name: 'Entretien RH', color: 'bg-purple-500' },
  { id: 'entretien-tech', name: 'Entretien Technique', color: 'bg-orange-500' },
  { id: 'offre', name: 'Offre', color: 'bg-green-500' },
  { id: 'embauche', name: 'Embauché', color: 'bg-emerald-600' },
];

const stageMapping: Record<string, string> = {
  'Candidatures': 'candidatures',
  'Screening CV': 'screening',
  'Entretien RH': 'entretien-rh',
  'Entretien technique': 'entretien-tech',
  'Offre envoyée': 'offre',
  'Embauché': 'embauche',
};

const hiringTrend = [
  { month: 'Juil', candidatures: 45, embauches: 3 },
  { month: 'Août', candidatures: 52, embauches: 4 },
  { month: 'Sep', candidatures: 68, embauches: 5 },
  { month: 'Oct', candidatures: 85, embauches: 6 },
  { month: 'Nov', candidatures: 120, embauches: 5 },
  { month: 'Déc', candidatures: 153, embauches: 3 },
];

const sourceData = [
  { name: 'LinkedIn', value: 45, color: '#0A66C2' },
  { name: 'Site Carrière', value: 25, color: '#6366F1' },
  { name: 'Indeed', value: 15, color: '#F59E0B' },
  { name: 'Référence', value: 10, color: '#10B981' },
  { name: 'Autres', value: 5, color: '#6B7280' },
];

export default function RecruitmentPage() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'jobs' | 'analytics'>('kanban');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCandidateModal, setShowCandidateModal] = useState(false);

  const getCandidatesByStage = (stageId: string) => {
    return candidates.filter(c => stageMapping[c.stage] === stageId);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-blue-600 bg-blue-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getUrgencyColor = (urgency: string) => {
    if (urgency === 'high') return 'bg-red-100 text-red-700';
    if (urgency === 'medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <>
      <Header title="Recrutement" subtitle="Pipeline candidats, offres d'emploi et analytics recrutement" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Postes Ouverts</p><p className="text-2xl font-bold text-gray-900">{jobs.filter(j => j.status === 'active').length}</p></div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Briefcase className="w-5 h-5 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Total Candidats</p><p className="text-2xl font-bold text-purple-600">153</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">En Entretien</p><p className="text-2xl font-bold text-orange-600">23</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><MessageSquare className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Délai Moyen</p><p className="text-2xl font-bold text-gray-900">28j</p></div>
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-gray-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Embauches (Mois)</p><p className="text-2xl font-bold text-green-600">5</p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><UserPlus className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('kanban')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'kanban' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Users className="w-4 h-4 inline mr-2" />Pipeline Candidats
            </button>
            <button onClick={() => setActiveTab('jobs')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'jobs' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Briefcase className="w-4 h-4 inline mr-2" />Offres d&apos;Emploi
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <TrendingUp className="w-4 h-4 inline mr-2" />Analytics
            </button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Rechercher candidat, poste, compétence..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div className="flex gap-3">
            <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Filter className="w-4 h-4 mr-2" />Filtres</button>
            <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Nouvelle Offre</button>
          </div>
        </div>

        {/* TAB: Kanban Pipeline */}
        {activeTab === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pipelineStages.map((stage) => {
              const stageCandidates = getCandidatesByStage(stage.id);
              return (
                <div key={stage.id} className="flex-shrink-0 w-72">
                  <div className={`${stage.color} text-white px-4 py-3 rounded-t-xl flex items-center justify-between`}>
                    <span className="font-medium text-sm">{stage.name}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{stageCandidates.length}</span>
                  </div>
                  <div className="bg-gray-100 rounded-b-xl p-3 min-h-96 space-y-3">
                    {stageCandidates.map((candidate) => (
                      <div key={candidate.id} onClick={() => { setSelectedCandidate(candidate); setShowCandidateModal(true); }} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
                              {candidate.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="ml-3">
                              <h4 className="font-medium text-gray-900 text-sm">{candidate.name}</h4>
                              <p className="text-xs text-gray-500">{candidate.location}</p>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(candidate.aiScore)}`}>
                            {candidate.aiScore}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 truncate">{candidate.position}</p>
                        <div className="flex flex-wrap gap-1">
                          {candidate.skills.slice(0, 3).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{skill}</span>
                          ))}
                          {candidate.skills.length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">+{candidate.skills.length - 3}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400">{candidate.applied}</span>
                          <span className="text-xs text-gray-500">{candidate.source}</span>
                        </div>
                      </div>
                    ))}
                    {stageCandidates.length === 0 && <div className="text-center text-gray-400 text-sm py-8">Aucun candidat</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: Jobs */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><Briefcase className="w-6 h-6 text-blue-600" /></div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{job.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getUrgencyColor(job.urgency)}`}>
                          {job.urgency === 'high' ? 'Urgent' : job.urgency === 'medium' ? 'Modéré' : 'Normal'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center"><Building2 className="w-3.5 h-3.5 mr-1" />{job.department}</span>
                        <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" />{job.location}</span>
                        <span>{job.type}</span>
                        {job.salary && <span className="text-primary-600 font-medium">{job.salary}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>Publié: {job.posted}</span>
                        {job.deadline && <span>Deadline: {job.deadline}</span>}
                        <span>Manager: {job.hiringManager}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{job.applicants}</p>
                      <p className="text-xs text-gray-500">Candidats</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {job.status === 'active' ? 'Active' : 'Brouillon'}
                    </span>
                    <div className="flex gap-2">
                      <button className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                      <button className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
                {job.requirements && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {job.requirements.map((req, i) => (
                        <span key={i} className="px-3 py-1 bg-gray-50 text-gray-600 text-xs rounded-full">{req}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: Analytics */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Tendance Recrutement</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hiringTrend}>
                    <XAxis dataKey="month" /><YAxis /><Tooltip />
                    <Line type="monotone" dataKey="candidatures" stroke="#6366F1" strokeWidth={2} name="Candidatures" />
                    <Line type="monotone" dataKey="embauches" stroke="#10B981" strokeWidth={2} name="Embauches" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Sources de Candidatures</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                    {sourceData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Candidats par Département</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: 'Tech', count: 107 }, { name: 'Commercial', count: 18 }, { name: 'Marketing', count: 28 }]} layout="vertical">
                    <XAxis type="number" /><YAxis type="category" dataKey="name" width={80} /><Tooltip /><Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">🏆 Top Candidats (Score IA)</h3>
              <div className="space-y-3">
                {candidates.sort((a, b) => b.aiScore - a.aiScore).slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">{c.name}</p><p className="text-xs text-gray-500">{c.position}</p></div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(c.aiScore)}`}>{c.aiScore}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Candidate Modal */}
        {showCandidateModal && selectedCandidate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-start justify-between">
                <div className="flex items-center">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xl font-bold">
                    {selectedCandidate.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="ml-4">
                    <h2 className="text-xl font-bold text-gray-900">{selectedCandidate.name}</h2>
                    <p className="text-gray-500">{selectedCandidate.position}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(selectedCandidate.aiScore)}`}>Score IA: {selectedCandidate.aiScore}%</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{selectedCandidate.stage}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowCandidateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Informations</h3>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm"><Mail className="w-4 h-4 mr-3 text-gray-400" />{selectedCandidate.email}</div>
                    <div className="flex items-center text-sm"><Phone className="w-4 h-4 mr-3 text-gray-400" />{selectedCandidate.phone}</div>
                    <div className="flex items-center text-sm"><MapPin className="w-4 h-4 mr-3 text-gray-400" />{selectedCandidate.location}</div>
                    {selectedCandidate.linkedin && <div className="flex items-center text-sm"><Linkedin className="w-4 h-4 mr-3 text-gray-400" />{selectedCandidate.linkedin}</div>}
                    <div className="flex items-center text-sm"><GraduationCap className="w-4 h-4 mr-3 text-gray-400" />{selectedCandidate.education}</div>
                    <div className="flex items-center text-sm"><Briefcase className="w-4 h-4 mr-3 text-gray-400" />{selectedCandidate.experience} d&apos;expérience</div>
                    {selectedCandidate.currentCompany && <div className="flex items-center text-sm"><Building2 className="w-4 h-4 mr-3 text-gray-400" />{selectedCandidate.currentCompany}</div>}
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-6 mb-3">Compétences</h3>
                  <div className="flex flex-wrap gap-2">{selectedCandidate.skills.map((skill) => (<span key={skill} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{skill}</span>))}</div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Score IA Détaillé</h3>
                  <div className="space-y-3">
                    {selectedCandidate.aiScoreDetails.map((detail) => (
                      <div key={detail.category}>
                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{detail.category}</span><span className="font-medium">{detail.score}%</span></div>
                        <div className="h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${detail.score >= 90 ? 'bg-green-500' : detail.score >= 75 ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${detail.score}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-6 mb-3">Timeline</h3>
                  <div className="space-y-3">
                    {selectedCandidate.timeline.map((event, i) => (
                      <div key={i} className="flex items-start">
                        <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-3" />
                        <div><p className="text-sm font-medium text-gray-900">{event.event}</p><p className="text-xs text-gray-500">{event.date}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-between">
                <div className="flex gap-2">
                  <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><FileText className="w-4 h-4 mr-2" />CV</button>
                  <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Video className="w-4 h-4 mr-2" />Planifier Entretien</button>
                  <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Mail className="w-4 h-4 mr-2" />Envoyer Email</button>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"><XCircle className="w-4 h-4 mr-2" />Refuser</button>
                  <button className="flex items-center px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"><ArrowRight className="w-4 h-4 mr-2" />Étape Suivante</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
