'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  UserPlus, 
  Briefcase, 
  Users, 
  Clock,
  Star,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Filter,
  Plus,
  CheckCircle,
  XCircle
} from 'lucide-react';

const jobs = [
  { id: 1, title: 'Développeur Full Stack Senior', department: 'Tech', location: 'Paris', type: 'CDI', applicants: 45, status: 'active', posted: '15 Nov 2024' },
  { id: 2, title: 'Chef de Projet Digital', department: 'Marketing', location: 'Lyon', type: 'CDI', applicants: 28, status: 'active', posted: '20 Nov 2024' },
  { id: 3, title: 'Data Analyst', department: 'Tech', location: 'Remote', type: 'CDI', applicants: 62, status: 'active', posted: '10 Nov 2024' },
  { id: 4, title: 'Responsable RH', department: 'RH', location: 'Paris', type: 'CDI', applicants: 18, status: 'draft', posted: '-' },
];

const candidates = [
  { 
    id: 1, 
    name: 'Alice Martin', 
    position: 'Développeur Full Stack Senior',
    email: 'alice.martin@email.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris',
    aiScore: 92,
    stage: 'Entretien technique',
    applied: '25 Nov 2024',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL']
  },
  { 
    id: 2, 
    name: 'Thomas Bernard', 
    position: 'Développeur Full Stack Senior',
    email: 'thomas.bernard@email.com',
    phone: '+33 6 98 76 54 32',
    location: 'Lyon',
    aiScore: 87,
    stage: 'Screening CV',
    applied: '28 Nov 2024',
    skills: ['Vue.js', 'Python', 'Django', 'MongoDB']
  },
  { 
    id: 3, 
    name: 'Sophie Dubois', 
    position: 'Data Analyst',
    email: 'sophie.dubois@email.com',
    phone: '+33 6 11 22 33 44',
    location: 'Remote',
    aiScore: 95,
    stage: 'Offre envoyée',
    applied: '18 Nov 2024',
    skills: ['Python', 'SQL', 'Tableau', 'Machine Learning']
  },
  { 
    id: 4, 
    name: 'Lucas Leroy', 
    position: 'Chef de Projet Digital',
    email: 'lucas.leroy@email.com',
    phone: '+33 6 55 66 77 88',
    location: 'Lyon',
    aiScore: 78,
    stage: 'Entretien RH',
    applied: '22 Nov 2024',
    skills: ['Agile', 'Jira', 'Marketing Digital', 'SEO']
  },
];

const pipelineStages = [
  { name: 'Candidatures', count: 153, color: 'bg-gray-500' },
  { name: 'Screening CV', count: 45, color: 'bg-blue-500' },
  { name: 'Entretien RH', count: 28, color: 'bg-purple-500' },
  { name: 'Entretien technique', count: 15, color: 'bg-orange-500' },
  { name: 'Offre envoyée', count: 8, color: 'bg-green-500' },
  { name: 'Embauché', count: 3, color: 'bg-emerald-600' },
];

export default function RecruitmentPage() {
  const [selectedTab, setSelectedTab] = useState('pipeline');
  const [selectedCandidate, setSelectedCandidate] = useState<typeof candidates[0] | null>(null);

  return (
    <>
      <Header title="Recrutement" subtitle="Gestion des offres, candidats et pipeline de recrutement" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Postes Ouverts</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Candidats</p>
                <p className="text-2xl font-bold text-purple-600">153</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Délai Moyen</p>
                <p className="text-2xl font-bold text-orange-600">32j</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Embauches ce Mois</p>
                <p className="text-2xl font-bold text-green-600">5</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Visual */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline de Recrutement</h3>
          <div className="flex items-center justify-between">
            {pipelineStages.map((stage, index) => (
              <div key={stage.name} className="flex-1 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className={`w-12 h-12 ${stage.color} rounded-full flex items-center justify-center text-white font-bold`}>
                    {stage.count}
                  </div>
                  {index < pipelineStages.length - 1 && (
                    <div className="w-full h-1 bg-gray-200 mx-2"></div>
                  )}
                </div>
                <p className="text-xs text-gray-600">{stage.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setSelectedTab('pipeline')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'pipeline' 
                ? 'border-primary-500 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Candidats
          </button>
          <button
            onClick={() => setSelectedTab('jobs')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'jobs' 
                ? 'border-primary-500 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Offres d&apos;Emploi
          </button>
        </div>

        {/* Tab Content */}
        {selectedTab === 'pipeline' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Candidates List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Candidats Récents</h3>
                <div className="flex gap-2">
                  <button className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtrer
                  </button>
                </div>
              </div>

              {candidates.map((candidate) => (
                <div 
                  key={candidate.id} 
                  className={`bg-white rounded-xl p-5 shadow-sm border cursor-pointer transition-all ${
                    selectedCandidate?.id === candidate.id 
                      ? 'border-primary-500 ring-2 ring-primary-100' 
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="ml-4">
                        <h4 className="font-semibold text-gray-900">{candidate.name}</h4>
                        <p className="text-sm text-gray-500">{candidate.position}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {candidate.stage}
                          </span>
                          <span className="text-xs text-gray-400">
                            Candidature: {candidate.applied}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-500 mr-1" />
                        <span className="text-lg font-bold text-gray-900">{candidate.aiScore}</span>
                        <span className="text-sm text-gray-400">/100</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Score IA</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Candidate Detail */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit sticky top-6">
              {selectedCandidate ? (
                <>
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">
                      {selectedCandidate.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedCandidate.name}</h3>
                    <p className="text-sm text-gray-500">{selectedCandidate.position}</p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-3 text-gray-400" />
                      {selectedCandidate.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-3 text-gray-400" />
                      {selectedCandidate.phone}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                      {selectedCandidate.location}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Compétences</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.skills.map((skill) => (
                        <span key={skill} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Score IA</h4>
                    <div className="flex items-center">
                      <div className="flex-1 h-3 bg-gray-200 rounded-full">
                        <div 
                          className={`h-full rounded-full ${
                            selectedCandidate.aiScore >= 90 ? 'bg-green-500' :
                            selectedCandidate.aiScore >= 70 ? 'bg-blue-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${selectedCandidate.aiScore}%` }}
                        ></div>
                      </div>
                      <span className="ml-3 font-bold text-gray-900">{selectedCandidate.aiScore}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accepter
                    </button>
                    <button className="flex-1 flex items-center justify-center px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600">
                      <XCircle className="w-4 h-4 mr-2" />
                      Refuser
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Sélectionnez un candidat pour voir les détails</p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Offres d&apos;Emploi</h3>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Offre
              </button>
            </div>

            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h4 className="font-semibold text-gray-900">{job.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{job.department}</span>
                        <span>•</span>
                        <span>{job.location}</span>
                        <span>•</span>
                        <span>{job.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{job.applicants}</p>
                      <p className="text-xs text-gray-500">Candidats</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {job.status === 'active' ? 'Active' : 'Brouillon'}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
