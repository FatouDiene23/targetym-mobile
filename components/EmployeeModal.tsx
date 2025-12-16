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
  Download,
  FileDown,
  Loader2
} from 'lucide-react';
import { Employee } from '@/lib/api';
import { useState } from 'react';
import generateEmployeePDF from '@/lib/generateEmployeePDF';
import CertificateModal from './CertificateModal';

interface EmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onEdit?: () => void;
}

export default function EmployeeModal({ employee, onClose, onEdit }: EmployeeModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Fonction d'export PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      generateEmployeePDF(employee);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Calculer l'âge
  const calculateAge = () => {
    if (!employee.date_of_birth && !employee.birth_date) return null;
    const birthDate = employee.date_of_birth || employee.birth_date;
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge();
  const birthYear = employee.date_of_birth || employee.birth_date 
    ? new Date(employee.date_of_birth || employee.birth_date || '').getFullYear() 
    : null;

  // Calculer l'ancienneté
  const calculateSeniority = () => {
    if (!employee.hire_date) return null;
    const hire = new Date(employee.hire_date);
    const today = new Date();
    const years = today.getFullYear() - hire.getFullYear();
    const months = today.getMonth() - hire.getMonth();
    
    let totalMonths = years * 12 + months;
    if (today.getDate() < hire.getDate()) {
      totalMonths--;
    }
    
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    
    if (y > 0 && m > 0) return `${y} an${y > 1 ? 's' : ''} ${m} mois`;
    if (y > 0) return `${y} an${y > 1 ? 's' : ''}`;
    if (m > 0) return `${m} mois`;
    return 'Moins d\'un mois';
  };

  const seniority = calculateSeniority();

  // Formater la date
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Formater le salaire
  const formatSalary = (salary: number | undefined, currency: string | undefined) => {
    if (!salary) return '-';
    const curr = currency || 'XOF';
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(salary);
  };

  // Formater le type de contrat
  const formatContractType = (type: string | undefined) => {
    if (!type) return '-';
    const types: Record<string, string> = {
      'cdi': 'CDI',
      'cdd': 'CDD',
      'stage': 'Stage',
      'alternance': 'Alternance',
      'consultant': 'Consultant',
      'interim': 'Intérim'
    };
    return types[type.toLowerCase()] || type.toUpperCase();
  };

  // Formater le genre
  const formatGender = (gender: string | undefined) => {
    if (!gender) return '-';
    const g = gender.toLowerCase();
    if (g === 'female' || g === 'f') return 'Femme';
    if (g === 'male' || g === 'm') return 'Homme';
    return 'Autre';
  };

  const getGenderSymbol = (gender: string | undefined) => {
    if (!gender) return '?';
    const g = gender.toLowerCase();
    if (g === 'female' || g === 'f') return '♀';
    if (g === 'male' || g === 'm') return '♂';
    return '⚥';
  };

  // Formater le statut
  const formatStatus = (status: string | undefined) => {
    if (!status) return 'Actif';
    const statuses: Record<string, string> = {
      'active': 'Actif',
      'on_leave': 'En congés',
      'suspended': 'Suspendu',
      'terminated': 'Terminé',
      'probation': 'Période d\'essai'
    };
    return statuses[status.toLowerCase()] || status;
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-green-400/30';
    const s = status.toLowerCase();
    if (s === 'active') return 'bg-white/20';
    if (s === 'on_leave') return 'bg-green-400/30';
    if (s === 'suspended' || s === 'terminated') return 'bg-red-400/30';
    if (s === 'probation') return 'bg-yellow-400/30';
    return 'bg-white/20';
  };

  // Initiales
  const getInitials = () => {
    const first = employee.first_name?.[0] || '';
    const last = employee.last_name?.[0] || '';
    return (first + last).toUpperCase();
  };

  // Données de congés (à remplacer par API quand disponible)
  const leaveBalance = {
    annual: 18,
    rtt: 5,
    seniority: 2,
    taken: 12,
    pending: 3
  };

  // Documents (à remplacer par API quand disponible)
  const documents = [
    { name: 'Contrat de travail', date: formatDate(employee.hire_date), type: 'PDF' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-bold mr-4">
              {getInitials()}
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{employee.first_name} {employee.last_name}</h2>
              <p className="text-primary-100">{employee.job_title || employee.position || '-'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 ${getStatusColor(employee.status)} text-white text-xs rounded-full`}>
                  {formatStatus(employee.status)}
                </span>
                {employee.is_manager && (
                  <span className="px-2 py-0.5 bg-purple-400/30 text-white text-xs rounded-full">Manager</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button 
                onClick={onEdit}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                title="Modifier"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={handleExportPDF}
              disabled={isExporting}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg disabled:opacity-50"
              title="Télécharger le dossier PDF"
            >
              {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
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
                    <span className="text-gray-600">{employee.email || '-'}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="text-gray-600">{employee.phone || '-'}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="text-gray-600">{employee.site || employee.location || '-'}</span>
                  </div>
                  {age && (
                    <div className="flex items-center text-sm">
                      <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                      <span className="text-gray-600">{age} ans ({birthYear})</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 mr-3 text-gray-400 text-center">{getGenderSymbol(employee.gender)}</span>
                    <span className="text-gray-600">{formatGender(employee.gender)}</span>
                  </div>
                  {employee.nationality && (
                    <div className="flex items-center text-sm">
                      <span className="w-4 h-4 mr-3 text-gray-400 text-center">🌍</span>
                      <span className="text-gray-600">{employee.nationality}</span>
                    </div>
                  )}
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
                    <p className="text-sm font-medium text-gray-900">{employee.job_title || employee.position || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Département</p>
                    <p className="text-sm font-medium text-gray-900">{employee.department_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Manager</p>
                    <p className="text-sm font-medium text-gray-900">{employee.manager_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Site</p>
                    <p className="text-sm font-medium text-gray-900">{employee.site || employee.location || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Matricule</p>
                    <p className="text-sm font-medium text-gray-900">{employee.employee_id || '-'}</p>
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
                    <span className="text-sm font-medium text-gray-900">{formatContractType(employee.contract_type)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Date d&apos;entrée</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(employee.hire_date)}</span>
                  </div>
                  {employee.salary && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Salaire brut annuel</span>
                      <span className="text-sm font-medium text-gray-900">{formatSalary(employee.salary, employee.currency)}</span>
                    </div>
                  )}
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
              {seniority && (
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-primary-600">Ancienneté</p>
                      <p className="text-2xl font-bold text-primary-700">{seniority}</p>
                    </div>
                    <Clock className="w-10 h-10 text-primary-300" />
                  </div>
                </div>
              )}
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

              {/* Infos supplémentaires */}
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
            <button 
              onClick={() => setShowCertificateModal(true)}
              className="flex items-center px-4 py-2 text-sm text-emerald-700 font-medium border border-emerald-300 rounded-lg hover:bg-emerald-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Certificat de travail
            </button>
            <button 
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center px-4 py-2 text-sm text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              Exporter PDF
            </button>
            {onEdit && (
              <button 
                onClick={onEdit}
                className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600"
              >
                Modifier le dossier
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Certificat de travail */}
      {showCertificateModal && (
        <CertificateModal 
          employee={employee} 
          onClose={() => setShowCertificateModal(false)} 
        />
      )}
    </div>
  );
}
