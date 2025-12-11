'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  BookOpen, Award, Clock, Users, CheckCircle, Star, Plus, Play, Search,
  TrendingUp, Target, ChevronRight, AlertTriangle,
  GraduationCap, Bookmark, BarChart3, X, User, ArrowRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

// Types
interface Course {
  id: number;
  title: string;
  description: string;
  category: string;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  enrolled: number;
  completed: number;
  rating: number;
  instructor: string;
  image: string;
  tags: string[];
  modules: number;
  isMandatory?: boolean;
  deadline?: string;
}

interface LearningPath {
  id: number;
  title: string;
  description: string;
  courses: number;
  duration: string;
  progress: number;
  assignedTo: number;
  category: string;
}

interface Certification {
  id: number;
  name: string;
  provider: string;
  holders: { name: string; initials: string; expiryDate: string; status: 'valid' | 'expiring' | 'expired' }[];
  totalHolders: number;
  expiringSoon: number;
}

interface DevelopmentPlan {
  id: number;
  employee: string;
  initials: string;
  role: string;
  targetRole: string;
  progress: number;
  skills: { name: string; current: number; target: number }[];
  courses: { title: string; status: 'completed' | 'in-progress' | 'planned' }[];
}

// Data
const courses: Course[] = [
  { id: 1, title: 'Leadership & Management', description: 'Développez vos compétences de leader et apprenez à manager efficacement une équipe.', category: 'Soft Skills', duration: '8h', level: 'intermediate', enrolled: 45, completed: 28, rating: 4.8, instructor: 'Fatou Ndiaye', image: '👔', tags: ['Leadership', 'Management', 'Communication'], modules: 12 },
  { id: 2, title: 'Communication Professionnelle', description: 'Maîtrisez les techniques de communication écrite et orale en entreprise.', category: 'Soft Skills', duration: '4h', level: 'beginner', enrolled: 62, completed: 55, rating: 4.6, instructor: 'Amadou Diallo', image: '💬', tags: ['Communication', 'Présentation', 'Email'], modules: 8, isMandatory: true, deadline: '31 Dec 2024' },
  { id: 3, title: 'Excel Avancé & Power BI', description: 'Analysez vos données comme un pro avec Excel avancé et Power BI.', category: 'Technique', duration: '12h', level: 'advanced', enrolled: 38, completed: 20, rating: 4.9, instructor: 'Aissatou Ba', image: '📊', tags: ['Excel', 'Power BI', 'Data Analysis'], modules: 15 },
  { id: 4, title: 'Gestion de Projet Agile', description: 'Apprenez Scrum, Kanban et les méthodes agiles pour gérer vos projets.', category: 'Management', duration: '10h', level: 'intermediate', enrolled: 52, completed: 35, rating: 4.7, instructor: 'Moussa Sow', image: '🎯', tags: ['Agile', 'Scrum', 'Kanban'], modules: 10 },
  { id: 5, title: 'Cybersécurité Fondamentaux', description: 'Protégez vos données et apprenez les bonnes pratiques de sécurité.', category: 'Technique', duration: '6h', level: 'beginner', enrolled: 85, completed: 72, rating: 4.5, instructor: 'Ibrahima Fall', image: '🔒', tags: ['Sécurité', 'RGPD', 'Phishing'], modules: 8, isMandatory: true, deadline: '15 Dec 2024' },
  { id: 6, title: 'Intelligence Artificielle pour Managers', description: 'Comprendre l\'IA et ses applications dans votre métier.', category: 'Innovation', duration: '5h', level: 'beginner', enrolled: 28, completed: 12, rating: 4.8, instructor: 'Amadou Diallo', image: '🤖', tags: ['IA', 'Machine Learning', 'ChatGPT'], modules: 6 },
  { id: 7, title: 'Négociation Commerciale', description: 'Techniques avancées de négociation pour closer plus de deals.', category: 'Commercial', duration: '6h', level: 'intermediate', enrolled: 32, completed: 18, rating: 4.6, instructor: 'Ousmane Sy', image: '🤝', tags: ['Vente', 'Négociation', 'Closing'], modules: 8 },
  { id: 8, title: 'Droit du Travail Sénégalais', description: 'Maîtrisez les fondamentaux du droit du travail au Sénégal.', category: 'Juridique', duration: '4h', level: 'intermediate', enrolled: 25, completed: 22, rating: 4.4, instructor: 'Awa Sarr', image: '⚖️', tags: ['Droit', 'RH', 'Conformité'], modules: 6 },
];

const learningPaths: LearningPath[] = [
  { id: 1, title: 'Parcours Manager', description: 'Devenez un manager efficace en 3 mois', courses: 5, duration: '30h', progress: 65, assignedTo: 12, category: 'Leadership' },
  { id: 2, title: 'Parcours Data Analyst', description: 'Maîtrisez l\'analyse de données', courses: 4, duration: '25h', progress: 40, assignedTo: 8, category: 'Technique' },
  { id: 3, title: 'Parcours Commercial B2B', description: 'Excellence commerciale en environnement B2B', courses: 6, duration: '20h', progress: 80, assignedTo: 15, category: 'Commercial' },
  { id: 4, title: 'Onboarding Nouveaux Employés', description: 'Intégration et culture d\'entreprise', courses: 3, duration: '8h', progress: 100, assignedTo: 5, category: 'Onboarding' },
];

const certifications: Certification[] = [
  { id: 1, name: 'AWS Solutions Architect', provider: 'Amazon', totalHolders: 8, expiringSoon: 2, holders: [
    { name: 'Amadou Diallo', initials: 'AD', expiryDate: '15 Mar 2025', status: 'valid' },
    { name: 'Aissatou Ba', initials: 'AB', expiryDate: '20 Jan 2025', status: 'expiring' },
    { name: 'Khady Faye', initials: 'KF', expiryDate: '10 Dec 2024', status: 'expiring' },
  ]},
  { id: 2, name: 'Scrum Master (PSM I)', provider: 'Scrum.org', totalHolders: 15, expiringSoon: 0, holders: [
    { name: 'Moussa Sow', initials: 'MS', expiryDate: 'Permanent', status: 'valid' },
    { name: 'Mamadou Mbaye', initials: 'MM', expiryDate: 'Permanent', status: 'valid' },
  ]},
  { id: 3, name: 'PMP - Project Management', provider: 'PMI', totalHolders: 6, expiringSoon: 1, holders: [
    { name: 'Fatou Ndiaye', initials: 'FN', expiryDate: '30 Jun 2025', status: 'valid' },
    { name: 'Ibrahima Fall', initials: 'IF', expiryDate: '15 Feb 2025', status: 'expiring' },
  ]},
  { id: 4, name: 'Google Analytics', provider: 'Google', totalHolders: 12, expiringSoon: 3, holders: [
    { name: 'Mariama Diop', initials: 'MD', expiryDate: '01 Apr 2025', status: 'valid' },
  ]},
];

const developmentPlans: DevelopmentPlan[] = [
  { id: 1, employee: 'Mamadou Mbaye', initials: 'MM', role: 'Développeur Junior', targetRole: 'Développeur Senior', progress: 65, 
    skills: [{ name: 'React', current: 70, target: 90 }, { name: 'Node.js', current: 60, target: 85 }, { name: 'Architecture', current: 40, target: 75 }],
    courses: [{ title: 'React Avancé', status: 'completed' }, { title: 'Node.js Master', status: 'in-progress' }, { title: 'Design Patterns', status: 'planned' }]
  },
  { id: 2, employee: 'Ousmane Sy', initials: 'OS', role: 'Commercial Senior', targetRole: 'Manager Commercial', progress: 45,
    skills: [{ name: 'Leadership', current: 55, target: 85 }, { name: 'Négociation', current: 80, target: 90 }, { name: 'Management', current: 40, target: 80 }],
    courses: [{ title: 'Leadership & Management', status: 'in-progress' }, { title: 'Coaching Équipe', status: 'planned' }]
  },
];

const learningProgress = [
  { month: 'Jul', completions: 45, hours: 120 },
  { month: 'Aoû', completions: 38, hours: 95 },
  { month: 'Sep', completions: 62, hours: 180 },
  { month: 'Oct', completions: 58, hours: 165 },
  { month: 'Nov', completions: 75, hours: 210 },
  { month: 'Déc', completions: 68, hours: 185 },
];

const categoryDistribution = [
  { name: 'Soft Skills', value: 35, color: '#8B5CF6' },
  { name: 'Technique', value: 28, color: '#3B82F6' },
  { name: 'Management', value: 20, color: '#10B981' },
  { name: 'Commercial', value: 12, color: '#F59E0B' },
  { name: 'Autres', value: 5, color: '#6B7280' },
];

export default function LearningPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'paths' | 'certifications' | 'development' | 'analytics'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const categories = ['Tous', 'Soft Skills', 'Technique', 'Management', 'Commercial', 'Innovation'];

  const getLevelColor = (level: string) => {
    if (level === 'beginner') return 'bg-green-100 text-green-700';
    if (level === 'intermediate') return 'bg-blue-100 text-blue-700';
    return 'bg-purple-100 text-purple-700';
  };

  const getLevelLabel = (level: string) => {
    if (level === 'beginner') return 'Débutant';
    if (level === 'intermediate') return 'Intermédiaire';
    return 'Avancé';
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'in-progress') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getCertStatusColor = (status: string) => {
    if (status === 'valid') return 'text-green-600';
    if (status === 'expiring') return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredCourses = courses.filter(c => 
    (selectedCategory === 'Tous' || c.category === selectedCategory) &&
    (searchQuery === '' || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <>
      <Header title="Formation & Développement" subtitle="Catalogue, parcours, certifications et plans de développement" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Formations</p><p className="text-2xl font-bold text-gray-900">{courses.length}</p></div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Complétées (Mois)</p><p className="text-2xl font-bold text-green-600">68</p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Heures (Mois)</p><p className="text-2xl font-bold text-purple-600">185h</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Certifications</p><p className="text-2xl font-bold text-orange-600">41</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Award className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Taux Complétion</p><p className="text-2xl font-bold text-teal-600">78%</p></div>
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-teal-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button onClick={() => setActiveTab('catalog')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'catalog' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <BookOpen className="w-4 h-4 inline mr-2" />Catalogue
            </button>
            <button onClick={() => setActiveTab('paths')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'paths' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Target className="w-4 h-4 inline mr-2" />Parcours
            </button>
            <button onClick={() => setActiveTab('certifications')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'certifications' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Award className="w-4 h-4 inline mr-2" />Certifications
            </button>
            <button onClick={() => setActiveTab('development')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'development' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <GraduationCap className="w-4 h-4 inline mr-2" />Plans Développement
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <BarChart3 className="w-4 h-4 inline mr-2" />Analytics
            </button>
          </div>
        </div>

        {/* TAB: Catalogue */}
        {activeTab === 'catalog' && (
          <div>
            {/* Search & Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Rechercher une formation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${selectedCategory === cat ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{cat}</button>
                ))}
              </div>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Ajouter</button>
            </div>

            {/* Mandatory Alert */}
            {courses.filter(c => c.isMandatory).length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800">Formations obligatoires en cours</p>
                  <p className="text-xs text-orange-600">{courses.filter(c => c.isMandatory).length} formations à compléter avant leur deadline</p>
                </div>
                <button className="text-sm text-orange-700 font-medium hover:underline">Voir</button>
              </div>
            )}

            {/* Course Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCourses.map((course) => (
                <div key={course.id} onClick={() => setSelectedCourse(course)} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                  <div className="h-32 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-5xl relative">
                    {course.image}
                    {course.isMandatory && <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded">Obligatoire</span>}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Play className="w-12 h-12 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(course.level)}`}>{getLevelLabel(course.level)}</span>
                      <span className="text-xs text-gray-500">{course.duration}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">{course.title}</h4>
                    <p className="text-xs text-gray-500 mb-3">{course.instructor} • {course.modules} modules</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm">
                        <Star className="w-4 h-4 text-yellow-500 mr-1" /><span className="font-medium">{course.rating}</span>
                        <span className="text-gray-400 ml-2">({course.enrolled})</span>
                      </div>
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(course.completed / course.enrolled) * 100}%` }} /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Parcours */}
        {activeTab === 'paths' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Parcours de Formation</h3>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Créer un Parcours</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {learningPaths.map((path) => (
                <div key={path.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><Target className="w-6 h-6 text-primary-600" /></div>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">{path.category}</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">{path.title}</h4>
                  <p className="text-sm text-gray-500 mb-4">{path.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center"><BookOpen className="w-4 h-4 mr-1" />{path.courses} cours</span>
                    <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{path.duration}</span>
                    <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{path.assignedTo} assignés</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Progression moyenne</span><span className="font-medium">{path.progress}%</span></div>
                      <div className="h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${path.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${path.progress}%` }} /></div>
                    </div>
                    <button className="text-primary-600 hover:text-primary-700"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Certifications */}
        {activeTab === 'certifications' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Gestion des Certifications</h3>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Ajouter Certification</button>
            </div>

            {/* Alert expiring */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800">6 certifications expirent dans les 3 prochains mois</p>
                <p className="text-xs text-orange-600">Planifiez les renouvellements pour maintenir la conformité</p>
              </div>
              <button className="text-sm text-orange-700 font-medium hover:underline">Voir détails</button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {certifications.map((cert) => (
                <div key={cert.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center"><Award className="w-6 h-6 text-purple-600" /></div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                          <p className="text-sm text-gray-500">{cert.provider}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{cert.totalHolders}</p>
                        <p className="text-xs text-gray-500">titulaires</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 mb-2">Titulaires récents</p>
                    <div className="space-y-2">
                      {cert.holders.map((holder) => (
                        <div key={holder.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs">{holder.initials}</div>
                            <span className="text-sm text-gray-900">{holder.name}</span>
                          </div>
                          <span className={`text-xs font-medium ${getCertStatusColor(holder.status)}`}>
                            {holder.status === 'expiring' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {holder.expiryDate}
                          </span>
                        </div>
                      ))}
                    </div>
                    {cert.expiringSoon > 0 && (
                      <p className="text-xs text-orange-600 mt-3 flex items-center"><AlertTriangle className="w-3 h-3 mr-1" />{cert.expiringSoon} expiration(s) proche(s)</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Plans Développement */}
        {activeTab === 'development' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Plans de Développement Individuels</h3>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"><Plus className="w-4 h-4 mr-2" />Créer un Plan</button>
            </div>
            
            {developmentPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">{plan.initials}</div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{plan.employee}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{plan.role}</span>
                          <ArrowRight className="w-4 h-4" />
                          <span className="text-primary-600 font-medium">{plan.targetRole}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary-600">{plan.progress}%</p>
                      <p className="text-xs text-gray-500">progression</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Compétences à développer</h5>
                    <div className="space-y-3">
                      {plan.skills.map((skill) => (
                        <div key={skill.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">{skill.name}</span>
                            <span className="font-medium">{skill.current}% → {skill.target}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full relative">
                            <div className="absolute h-full bg-gray-400 rounded-full" style={{ width: `${skill.target}%` }} />
                            <div className="absolute h-full bg-primary-500 rounded-full" style={{ width: `${skill.current}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Formations assignées</h5>
                    <div className="space-y-2">
                      {plan.courses.map((course) => (
                        <div key={course.title} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-900">{course.title}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(course.status)}`}>
                            {course.status === 'completed' ? 'Terminé' : course.status === 'in-progress' ? 'En cours' : 'Planifié'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Analytics */}
        {activeTab === 'analytics' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Formations Complétées par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={learningProgress}><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="completions" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Répartition par Catégorie</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                    {categoryDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Heures de Formation par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={learningProgress}><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="hours" fill="#3B82F6" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">🏆 Top Apprenants</h3>
              <div className="space-y-3">
                {[{ name: 'Mamadou Mbaye', hours: 42, courses: 8 }, { name: 'Aissatou Ba', hours: 38, courses: 6 }, { name: 'Khady Faye', hours: 35, courses: 7 }, { name: 'Ousmane Sy', hours: 28, courses: 5 }].map((learner, i) => (
                  <div key={learner.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-700">{i + 1}</span>
                      <span className="font-medium text-gray-900">{learner.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary-600">{learner.hours}h</p>
                      <p className="text-xs text-gray-500">{learner.courses} cours</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Course Modal */}
        {selectedCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="relative h-48 bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <span className="text-7xl">{selectedCourse.image}</span>
                <button onClick={() => setSelectedCourse(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
                {selectedCourse.isMandatory && <span className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-lg">Obligatoire</span>}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(selectedCourse.level)}`}>{getLevelLabel(selectedCourse.level)}</span>
                  <span className="text-sm text-gray-500">{selectedCourse.category}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCourse.title}</h2>
                <p className="text-gray-600 mb-4">{selectedCourse.description}</p>
                <div className="flex items-center gap-6 mb-6 text-sm text-gray-500">
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{selectedCourse.duration}</span>
                  <span className="flex items-center"><BookOpen className="w-4 h-4 mr-1" />{selectedCourse.modules} modules</span>
                  <span className="flex items-center"><User className="w-4 h-4 mr-1" />{selectedCourse.instructor}</span>
                  <span className="flex items-center"><Star className="w-4 h-4 mr-1 text-yellow-500" />{selectedCourse.rating}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedCourse.tags.map(tag => <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{tag}</span>)}
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center px-4 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"><Play className="w-5 h-5 mr-2" />Commencer</button>
                  <button className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"><Bookmark className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
