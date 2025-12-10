'use client';

import { 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Briefcase,
  User,
  FileText,
  GraduationCap,
  Award,
  Clock,
  Palmtree,
  TrendingUp,
  Edit2,
  Download
} from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  location: string;
  startDate: string;
  status: string;
  manager: string;
  gender: string;
  birthYear: number;
  isManager: boolean;
  isTopManager: boolean;
  onLeave: boolean;
}

interface EmployeeModalProps {
  employee: Employee;
  onClose: () => void;
}

export default function EmployeeModal({ employee, onClose }: EmployeeModalProps) {
  const age = new Date().getFullYear() - employee.birthYear;
  
  // Données fictives pour le dossier complet
  const contractInfo = {
    type: 'CDI',
    startDate: employee.startDate,
    trialEndDate: '15 Jun 2021',
    salary: '45 000 €',
    classification: 'Cadre',
    coefficient: '350'
  };

  const leaveBalance = {
    annual: 18,
    rtt: 5,
    seniority: 2,
    taken: 12,
    pending: 3
  };

  const documents = [
    { name: 'Contrat de travail', date: '15 Mar 2021', type: 'PDF' },
    { name: 'Avenant salaire 2023', date: '01 Jan 2023', type: 'PDF' },
    { name: 'Attestation employeur', date: '15 Nov 2024', type: 'PDF' },
    { name: 'Fiche de paie Nov 2024', date: '30 Nov 2024', type: 'PDF' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-bold mr-4">
              {employee.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{employee.name}</h2>
              <p className="text-primary-100">{employee.position}</p>
              <div className="flex items-center gap-2 mt-1">
                {employee.onLeave ? (
                  <span className="px-2 py-0.5 bg-green-400/30 text-white text-xs rounded-full">En congés</span>
                ) : (
                  <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">
                    {employee.status === 'active' ? 'Actif' : 'Inactif'}
                  </span>
                )}
                {employee.isTopManager && (
                  <span className="px-2 py-0.5 bg-yellow-400/30 text-white text-xs rounded-full">Top Manager</span>
                )}
                {employee.isManager && !employee.isTopManager && (
                  <span className="px-2 py-0.5 bg-purple-400/30 text-white text-xs rounded-full">Manager</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
              <Edit2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Colonne 1 - Informations personnelles */}
            <div className="space-y-6">
              {/* Contact */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-4 h-4 mr-2 text-primary-500" />
                  Informations Personnelles
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Mail className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="text-gray-600">{employee.email}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="text-gray-600">{employee.phone}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="text-gray-600">{employee.location}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="text-gray-600">{age} ans ({employee.birthYear})</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 mr-3 text-gray-400 text-center">{employee.gender === 'F' ? '♀' : '♂'}</span>
                    <span className="text-gray-600">{employee.gender === 'F' ? 'Femme' : 'Homme'}</span>
                  </div>
                </div>
              </div>

              {/* Poste */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-primary-500" />
                  Poste & Organisation
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Poste</p>
                    <p className="text-sm font-medium text-gray-900">{employee.position}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Département</p>
                    <p className="text-sm font-medium text-gray-900">{employee.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Manager</p>
                    <p className="text-sm font-medium text-gray-900">{employee.manager}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Site</p>
                    <p className="text-sm font-medium text-gray-900">{employee.location}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne 2 - Contrat & Congés */}
            <div className="space-y-6">
              {/* Contrat */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary-500" />
                  Contrat
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Type</span>
                    <span className="text-sm font-medium text-gray-900">{contractInfo.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Date d&apos;entrée</span>
                    <span className="text-sm font-medium text-gray-900">{contractInfo.startDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Classification</span>
                    <span className="text-sm font-medium text-gray-900">{contractInfo.classification}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Coefficient</span>
                    <span className="text-sm font-medium text-gray-900">{contractInfo.coefficient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Salaire brut annuel</span>
                    <span className="text-sm font-medium text-gray-900">{contractInfo.salary}</span>
                  </div>
                </div>
              </div>

              {/* Solde congés */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Palmtree className="w-4 h-4 mr-2 text-green-500" />
                  Solde de Congés
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Congés annuels</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                      {leaveBalance.annual} jours
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">RTT</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
                      {leaveBalance.rtt} jours
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Ancienneté</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-lg">
                      {leaveBalance.seniority} jours
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Pris cette année</span>
                      <span className="text-sm font-medium text-gray-900">{leaveBalance.taken} jours</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-500">En attente</span>
                      <span className="text-sm font-medium text-yellow-600">{leaveBalance.pending} jours</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ancienneté */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-primary-600">Ancienneté</p>
                    <p className="text-2xl font-bold text-primary-700">3 ans 9 mois</p>
                  </div>
                  <Clock className="w-10 h-10 text-primary-300" />
                </div>
              </div>
            </div>

            {/* Colonne 3 - Documents */}
            <div className="space-y-6">
              {/* Documents RH */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary-500" />
                  Documents RH
                </h3>
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-gray-100 cursor-pointer">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center mr-3">
                          <FileText className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">{doc.date}</p>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 px-4 py-2 text-sm text-primary-600 font-medium border border-primary-200 rounded-lg hover:bg-primary-50">
                  Voir tous les documents
                </button>
              </div>

              {/* Infos supplémentaires Phase 1 */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-primary-500" />
                  Modules à venir
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center p-2 bg-gray-200/50 rounded-lg">
                    <GraduationCap className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-500">Formations (Phase 3)</span>
                  </div>
                  <div className="flex items-center p-2 bg-gray-200/50 rounded-lg">
                    <Award className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-500">Performance (Phase 2)</span>
                  </div>
                  <div className="flex items-center p-2 bg-gray-200/50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-500">Carrière (Phase 3)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
          >
            Fermer
          </button>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-100">
              Exporter PDF
            </button>
            <button className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600">
              Modifier le dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
