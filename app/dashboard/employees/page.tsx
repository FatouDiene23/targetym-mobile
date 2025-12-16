'use client';

import Header from '@/components/Header';
import EmployeeModal from '@/components/EmployeeModal';
import LeaveRequestModal from '@/components/LeaveRequestModal';
import { useState } from 'react';
import { Employee } from '@/lib/api';
import { 
  Search, 
  Plus, 
  Mail, 
  Phone,
  MapPin,
  Calendar,
  Building2,
  Download,
  MoreVertical,
  Edit2,
  Eye,
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Palmtree,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  ChevronDown,
  Briefcase,
  User
} from 'lucide-react';

// Type étendu pour l'affichage local (avec champs supplémentaires)
interface LocalEmployee extends Employee {
  name: string; // Nom complet pour affichage
  department: string;
  startDate: string;
  manager: string;
  birthYear: number;
  isManager: boolean;
  isTopManager: boolean;
  onLeave: boolean;
}

// Données enrichies des employés (format compatible backend + champs d'affichage)
const employees: LocalEmployee[] = [
  { 
    id: 1, 
    employee_id: 'EMP001',
    first_name: 'Marie',
    last_name: 'Dupont',
    name: 'Marie Dupont', 
    email: 'marie.dupont@company.com',
    phone: '+33 6 12 34 56 78',
    department: 'Tech',
    department_id: 1,
    department_name: 'Tech',
    position: 'Lead Developer',
    location: 'Paris',
    startDate: '15 Mar 2021',
    hire_date: '2021-03-15',
    status: 'ACTIVE',
    manager: 'Jean Martin',
    manager_id: 2,
    gender: 'FEMALE',
    birthYear: 1995,
    birth_date: '1995-06-15',
    isManager: false,
    is_manager: false,
    isTopManager: false,
    onLeave: false,
    created_at: '2021-03-15T00:00:00Z'
  },
  { 
    id: 2, 
    employee_id: 'EMP002',
    first_name: 'Jean',
    last_name: 'Martin',
    name: 'Jean Martin', 
    email: 'jean.martin@company.com',
    phone: '+33 6 98 76 54 32',
    department: 'Tech',
    department_id: 1,
    department_name: 'Tech',
    position: 'CTO',
    location: 'Paris',
    startDate: '01 Jan 2019',
    hire_date: '2019-01-01',
    status: 'ACTIVE',
    manager: '-',
    gender: 'MALE',
    birthYear: 1980,
    birth_date: '1980-03-22',
    isManager: true,
    is_manager: true,
    isTopManager: true,
    onLeave: false,
    created_at: '2019-01-01T00:00:00Z'
  },
  { 
    id: 3, 
    employee_id: 'EMP003',
    first_name: 'Sophie',
    last_name: 'Bernard',
    name: 'Sophie Bernard', 
    email: 'sophie.bernard@company.com',
    phone: '+33 6 11 22 33 44',
    department: 'Marketing',
    department_id: 2,
    department_name: 'Marketing',
    position: 'Marketing Manager',
    location: 'Lyon',
    startDate: '20 Sep 2022',
    hire_date: '2022-09-20',
    status: 'ON_LEAVE',
    manager: 'Pierre Leroy',
    manager_id: 4,
    gender: 'FEMALE',
    birthYear: 1990,
    birth_date: '1990-08-10',
    isManager: true,
    is_manager: true,
    isTopManager: false,
    onLeave: true,
    created_at: '2022-09-20T00:00:00Z'
  },
  { 
    id: 4, 
    employee_id: 'EMP004',
    first_name: 'Pierre',
    last_name: 'Leroy',
    name: 'Pierre Leroy', 
    email: 'pierre.leroy@company.com',
    phone: '+33 6 55 66 77 88',
    department: 'Marketing',
    department_id: 2,
    department_name: 'Marketing',
    position: 'CMO',
    location: 'Paris',
    startDate: '05 Jun 2020',
    hire_date: '2020-06-05',
    status: 'ACTIVE',
    manager: '-',
    gender: 'MALE',
    birthYear: 1975,
    birth_date: '1975-12-01',
    isManager: true,
    is_manager: true,
    isTopManager: true,
    onLeave: false,
    created_at: '2020-06-05T00:00:00Z'
  },
  { 
    id: 5, 
    employee_id: 'EMP005',
    first_name: 'Emma',
    last_name: 'Richard',
    name: 'Emma Richard', 
    email: 'emma.richard@company.com',
    phone: '+33 6 99 88 77 66',
    department: 'RH',
    department_id: 3,
    department_name: 'RH',
    position: 'HR Business Partner',
    location: 'Paris',
    startDate: '12 Feb 2023',
    hire_date: '2023-02-12',
    status: 'ACTIVE',
    manager: 'Anne Moreau',
    manager_id: 9,
    gender: 'FEMALE',
    birthYear: 1998,
    birth_date: '1998-04-25',
    isManager: false,
    is_manager: false,
    isTopManager: false,
    onLeave: false,
    created_at: '2023-02-12T00:00:00Z'
  },
  { 
    id: 6, 
    employee_id: 'EMP006',
    first_name: 'Lucas',
    last_name: 'Petit',
    name: 'Lucas Petit', 
    email: 'lucas.petit@company.com',
    phone: '+33 6 44 55 66 77',
    department: 'Sales',
    department_id: 4,
    department_name: 'Sales',
    position: 'Account Executive',
    location: 'Marseille',
    startDate: '08 Nov 2021',
    hire_date: '2021-11-08',
    status: 'ACTIVE',
    manager: 'Thomas Blanc',
    manager_id: 8,
    gender: 'MALE',
    birthYear: 2000,
    birth_date: '2000-07-14',
    isManager: false,
    is_manager: false,
    isTopManager: false,
    onLeave: false,
    created_at: '2021-11-08T00:00:00Z'
  },
  { 
    id: 7, 
    employee_id: 'EMP007',
    first_name: 'Julie',
    last_name: 'Moreau',
    name: 'Julie Moreau', 
    email: 'julie.moreau@company.com',
    phone: '+33 6 33 22 11 00',
    department: 'Finance',
    department_id: 5,
    department_name: 'Finance',
    position: 'Financial Controller',
    location: 'Paris',
    startDate: '25 Jul 2020',
    hire_date: '2020-07-25',
    status: 'INACTIVE',
    manager: 'Marc Dubois',
    manager_id: 10,
    gender: 'FEMALE',
    birthYear: 1988,
    birth_date: '1988-11-30',
    isManager: false,
    is_manager: false,
    isTopManager: false,
    onLeave: false,
    created_at: '2020-07-25T00:00:00Z'
  },
  { 
    id: 8, 
    employee_id: 'EMP008',
    first_name: 'Thomas',
    last_name: 'Blanc',
    name: 'Thomas Blanc', 
    email: 'thomas.blanc@company.com',
    phone: '+33 6 77 88 99 00',
    department: 'Sales',
    department_id: 4,
    department_name: 'Sales',
    position: 'Sales Director',
    location: 'Paris',
    startDate: '18 Apr 2019',
    hire_date: '2019-04-18',
    status: 'ON_LEAVE',
    manager: '-',
    gender: 'MALE',
    birthYear: 1982,
    birth_date: '1982-02-28',
    isManager: true,
    is_manager: true,
    isTopManager: true,
    onLeave: true,
    created_at: '2019-04-18T00:00:00Z'
  },
];

// Type pour les demandes de congés
interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  type: string;
  typeCode?: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason?: string;
  department?: string;
  position?: string;
  manager?: string;
  leaveBalance?: number;
  createdAt?: string;
}

// Demandes de congés enrichies
const leaveRequests: LeaveRequest[] = [
  { 
    id: 1, 
    employeeId: 3,
    employeeName: 'Sophie Bernard', 
    type: 'Congés annuels',
    typeCode: 'CA',
    startDate: '2024-12-15', 
    endDate: '2024-12-22', 
    days: 5, 
    status: 'approved',
    reason: 'Vacances de Noël en famille',
    department: 'Marketing',
    position: 'Marketing Manager',
    manager: 'Pierre Leroy',
    leaveBalance: 15,
    createdAt: '2024-11-28'
  },
  { 
    id: 2, 
    employeeId: 8,
    employeeName: 'Thomas Blanc', 
    type: 'Congés annuels',
    typeCode: 'CA',
    startDate: '2024-12-23', 
    endDate: '2025-01-02', 
    days: 8, 
    status: 'approved',
    reason: 'Fêtes de fin d\'année',
    department: 'Sales',
    position: 'Sales Director',
    manager: '-',
    leaveBalance: 12,
    createdAt: '2024-11-20'
  },
  { 
    id: 3, 
    employeeId: 1,
    employeeName: 'Marie Dupont', 
    type: 'RTT',
    typeCode: 'RTT',
    startDate: '2024-12-20', 
    endDate: '2024-12-20', 
    days: 1, 
    status: 'pending',
    reason: 'Journée personnelle pour rendez-vous administratifs',
    department: 'Tech',
    position: 'Lead Developer',
    manager: 'Jean Martin',
    leaveBalance: 5,
    createdAt: '2024-12-10'
  },
  { 
    id: 4, 
    employeeId: 6,
    employeeName: 'Lucas Petit', 
    type: 'Congés maladie',
    typeCode: 'MAL',
    startDate: '2024-12-10', 
    endDate: '2024-12-12', 
    days: 3, 
    status: 'pending',
    reason: 'Grippe - Certificat médical fourni',
    department: 'Sales',
    position: 'Account Executive',
    manager: 'Thomas Blanc',
    leaveBalance: 0,
    createdAt: '2024-12-10'
  },
  { 
    id: 5, 
    employeeId: 5,
    employeeName: 'Emma Richard', 
    type: 'Congés annuels',
    typeCode: 'CA',
    startDate: '2024-12-27', 
    endDate: '2024-12-31', 
    days: 4, 
    status: 'pending',
    reason: 'Fin d\'année',
    department: 'RH',
    position: 'HR Business Partner',
    manager: 'Anne Moreau',
    leaveBalance: 20,
    createdAt: '2024-12-05'
  },
];

const departments = ['Tous', 'Tech', 'Marketing', 'Sales', 'RH', 'Finance'];
const locations = ['Tous', 'Paris', 'Lyon', 'Marseille', 'Remote'];

// Calcul des statistiques
const stats = {
  total: 248,
  active: 245,
  newThisMonth: 12,
  departures: 3,
  departments: 8,
  managers: 32,
  topManagers: 8,
  genZRate: 28,
  womenRate: 47,
  onLeave: 15,
  pendingLeaves: leaveRequests.filter(l => l.status === 'pending').length,
  absenteeismRate: 3.2,
};

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');
  const [selectedLocation, setSelectedLocation] = useState('Tous');
  const [selectedEmployee, setSelectedEmployee] = useState<LocalEmployee | null>(null);
  const [activeTab, setActiveTab] = useState<'employees' | 'leaves'>('employees');
  const [showModal, setShowModal] = useState(false);
  
  // États pour le modal de demande de congé
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveRequestsData, setLeaveRequestsData] = useState(leaveRequests);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDepartment === 'Tous' || emp.department === selectedDepartment;
    const matchesLocation = selectedLocation === 'Tous' || emp.location === selectedLocation;
    return matchesSearch && matchesDept && matchesLocation;
  });

  // Fonction pour approuver une demande
  const handleApproveLeave = async (id: number) => {
    // TODO: Appeler l'API backend
    // await fetch(`/api/leaves/requests/${id}/approve`, { method: 'POST' })
    
    setLeaveRequestsData(prev => 
      prev.map(req => req.id === id ? { ...req, status: 'approved' } : req)
    );
    console.log('Demande approuvée:', id);
  };

  // Fonction pour refuser une demande
  const handleRejectLeave = async (id: number, reason: string) => {
    // TODO: Appeler l'API backend
    // await fetch(`/api/leaves/requests/${id}/approve`, { 
    //   method: 'POST',
    //   body: JSON.stringify({ approved: false, rejection_reason: reason })
    // })
    
    setLeaveRequestsData(prev => 
      prev.map(req => req.id === id ? { ...req, status: 'rejected' } : req)
    );
    console.log('Demande refusée:', id, 'Raison:', reason);
  };

  // Formatage des dates pour l'affichage
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <Header title="Gestion du Personnel" subtitle="Administration RH, effectifs et congés" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Stats Row 1 - Effectifs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Employés</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <UserCheck className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-gray-500">Actifs</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />+8%
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.newThisMonth}</p>
            <p className="text-xs text-gray-500">Nouveaux</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.departures}</p>
            <p className="text-xs text-gray-500">Départs</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.managers}</p>
            <p className="text-xs text-gray-500">Managers</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <User className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-indigo-600">{stats.topManagers}</p>
            <p className="text-xs text-gray-500">Top Managers</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-orange-500">Gen Z</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.genZRate}%</p>
            <p className="text-xs text-gray-500">Taux Gen Z</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-pink-500">♀</span>
            </div>
            <p className="text-2xl font-bold text-pink-600">{stats.womenRate}%</p>
            <p className="text-xs text-gray-500">Taux Femmes</p>
          </div>
        </div>

        {/* Stats Row 2 - Congés & Absences */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium mb-1">En congés actuellement</p>
                <p className="text-2xl font-bold text-green-700">{stats.onLeave}</p>
              </div>
              <Palmtree className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-600 font-medium mb-1">Demandes en attente</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {leaveRequestsData.filter(l => l.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium mb-1">Taux d&apos;absentéisme</p>
                <p className="text-2xl font-bold text-red-700">{stats.absenteeismRate}%</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium mb-1">Départements</p>
                <p className="text-2xl font-bold text-blue-700">{stats.departments}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'employees'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Annuaire
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'leaves'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Palmtree className="w-4 h-4 inline mr-2" />
            Congés
            {leaveRequestsData.filter(l => l.status === 'pending').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                {leaveRequestsData.filter(l => l.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'employees' ? (
          <>
            {/* Search and Filters */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email ou poste..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <select 
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept === 'Tous' ? 'Tous les départements' : dept}</option>
                    ))}
                  </select>
                  <select 
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc === 'Tous' ? 'Toutes les localisations' : loc}</option>
                    ))}
                  </select>
                  <button className="flex items-center px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </button>
                  <button className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </button>
                </div>
              </div>
            </div>

            {/* Employees Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Employee List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Employé</th>
                        <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Département</th>
                        <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Localisation</th>
                        <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">Statut</th>
                        <th className="text-right px-5 py-3 text-sm font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr 
                          key={employee.id} 
                          className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                            selectedEmployee?.id === employee.id ? 'bg-primary-50' : ''
                          }`}
                          onClick={() => setSelectedEmployee(employee)}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center">
                              <div className="relative">
                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                                  {employee.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                {employee.status === 'ON_LEAVE' && (
                                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                    <Palmtree className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="ml-3">
                                <div className="flex items-center">
                                  <p className="font-medium text-gray-900">{employee.name}</p>
                                  {employee.isTopManager && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">Top</span>
                                  )}
                                  {employee.isManager && !employee.isTopManager && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Mgr</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{employee.position}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                              {employee.department}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">{employee.location}</td>
                          <td className="px-5 py-4">
                            {employee.status === 'ON_LEAVE' ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                En congés
                              </span>
                            ) : (
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                employee.status === 'ACTIVE' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {employee.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Employee Detail */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit sticky top-6">
                {selectedEmployee ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="relative inline-block">
                        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">
                          {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        {selectedEmployee.status === 'ON_LEAVE' && (
                          <div className="absolute bottom-2 right-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <Palmtree className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedEmployee.name}</h3>
                      <p className="text-sm text-gray-500">{selectedEmployee.position}</p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        {selectedEmployee.status === 'ON_LEAVE' ? (
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            En congés
                          </span>
                        ) : (
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            selectedEmployee.status === 'ACTIVE' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {selectedEmployee.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                          </span>
                        )}
                        {selectedEmployee.isTopManager && (
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                            Top Manager
                          </span>
                        )}
                        {selectedEmployee.isManager && !selectedEmployee.isTopManager && (
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                            Manager
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-3 text-gray-400" />
                        {selectedEmployee.email}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-3 text-gray-400" />
                        {selectedEmployee.phone}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                        {selectedEmployee.location}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-3 text-gray-400" />
                        {selectedEmployee.department}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                        Depuis le {selectedEmployee.startDate}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500 mb-2">Manager</p>
                      <p className="font-medium text-gray-900">{selectedEmployee.manager}</p>
                    </div>

                    <div className="pt-4 border-t border-gray-100 mt-4">
                      <p className="text-sm text-gray-500 mb-2">Solde de congés</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Congés annuels</span>
                        <span className="font-medium text-gray-900">18 jours</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600">RTT</span>
                        <span className="font-medium text-gray-900">5 jours</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <button 
                        onClick={() => setShowModal(true)}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Voir profil
                      </button>
                      <button className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Sélectionnez un employé pour voir les détails</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Leave Management Tab */
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Leave Requests List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Demandes de congés</h3>
                  <button className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtrer
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {leaveRequestsData.map((leave) => (
                    <div 
                      key={leave.id} 
                      className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedLeaveRequest(leave);
                        setShowLeaveModal(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                            {leave.employeeName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">{leave.employeeName}</p>
                            <p className="text-sm text-gray-500">{leave.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{leave.days} jour{leave.days > 1 ? 's' : ''}</p>
                          <p className="text-xs text-gray-500">{formatDateDisplay(leave.startDate)} → {formatDateDisplay(leave.endDate)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          leave.status === 'approved' 
                            ? 'bg-green-100 text-green-700' 
                            : leave.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {leave.status === 'approved' ? 'Approuvé' : leave.status === 'pending' ? 'En attente' : 'Refusé'}
                        </span>
                        {leave.status === 'pending' && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveLeave(leave.id);
                              }}
                              className="flex items-center px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Approuver
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLeaveRequest(leave);
                                setShowLeaveModal(true);
                              }}
                              className="flex items-center px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Leave Summary */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Résumé des congés</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">En congés aujourd&apos;hui</span>
                    <span className="font-semibold text-green-600">{stats.onLeave}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Demandes en attente</span>
                    <span className="font-semibold text-yellow-600">
                      {leaveRequestsData.filter(l => l.status === 'pending').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Approuvées ce mois</span>
                    <span className="font-semibold text-blue-600">
                      {leaveRequestsData.filter(l => l.status === 'approved').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Refusées ce mois</span>
                    <span className="font-semibold text-red-600">
                      {leaveRequestsData.filter(l => l.status === 'rejected').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Planning des congés</h3>
                <p className="text-sm text-gray-500 mb-4">Décembre 2024</p>
                <div className="space-y-2">
                  {employees.filter(e => e.status === 'ON_LEAVE').map(emp => (
                    <div key={emp.id} className="flex items-center p-2 bg-green-50 rounded-lg">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-medium">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="ml-2">
                        <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.department}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 px-4 py-2 text-sm text-primary-600 font-medium border border-primary-200 rounded-lg hover:bg-primary-50">
                  Voir le calendrier complet
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Dossier Collaborateur */}
      {showModal && selectedEmployee && (
        <EmployeeModal 
          employee={selectedEmployee}
          onClose={() => setShowModal(false)} 
        />
      )}

      {/* Modal Demande de Congé */}
      {showLeaveModal && selectedLeaveRequest && (
        <LeaveRequestModal
          request={{
            id: selectedLeaveRequest.id,
            employee_id: selectedLeaveRequest.employeeId,
            employee_name: selectedLeaveRequest.employeeName,
            leave_type_id: 0,
            leave_type_name: selectedLeaveRequest.type,
            leave_type_code: selectedLeaveRequest.typeCode,
            start_date: selectedLeaveRequest.startDate,
            end_date: selectedLeaveRequest.endDate,
            days_requested: selectedLeaveRequest.days,
            status: selectedLeaveRequest.status,
            reason: selectedLeaveRequest.reason,
            department: selectedLeaveRequest.department,
            job_title: selectedLeaveRequest.position,
            manager_name: selectedLeaveRequest.manager,
            leave_balance: selectedLeaveRequest.leaveBalance,
            created_at: selectedLeaveRequest.createdAt || new Date().toISOString(),
          }}
          onClose={() => {
            setShowLeaveModal(false);
            setSelectedLeaveRequest(null);
          }}
          onApprove={handleApproveLeave}
          onReject={handleRejectLeave}
        />
      )}
    </>
  );
}
