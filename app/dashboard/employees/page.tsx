'use client';

import Header from '@/components/Header';
import EmployeeModal from '@/components/EmployeeModal';
import AddEmployeeModal from '@/components/AddEmployeeModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';
import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Mail, 
  Phone,
  MapPin,
  Calendar,
  Building2,
  Download,
  Edit2,
  Eye,
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Palmtree,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  Briefcase,
  User,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { 
  getEmployees, 
  getEmployeeStats, 
  getDepartments, 
  exportEmployeesToCSV,
  type Employee, 
  type EmployeeStats, 
  type Department 
} from '@/lib/api';

// Données de congés (mockées pour l'instant)
const leaveRequests = [
  { id: 1, employeeName: 'Sophie Bernard', type: 'Congés annuels', startDate: '15 Déc 2024', endDate: '22 Déc 2024', days: 5, status: 'approved' },
  { id: 2, employeeName: 'Thomas Blanc', type: 'Congés annuels', startDate: '23 Déc 2024', endDate: '02 Jan 2025', days: 8, status: 'approved' },
  { id: 3, employeeName: 'Marie Dupont', type: 'RTT', startDate: '20 Déc 2024', endDate: '20 Déc 2024', days: 1, status: 'pending' },
];

const locations = ['Tous', 'Abidjan', 'Dakar', 'Bamako', 'Ouagadougou', 'Conakry', 'Remote'];

export default function EmployeesPage() {
  // State pour les données API
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State pour les filtres et UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');
  const [selectedLocation, setSelectedLocation] = useState('Tous');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'employees' | 'leaves'>('employees');
  
  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Ref pour éviter les doubles appels
  const isInitialized = useRef(false);
  const departmentsRef = useRef<Department[]>([]);

  // Fonction pour charger les employés
  const fetchEmployees = async (depts: Department[]) => {
    try {
      const deptId = selectedDepartment !== 'Tous' 
        ? depts.find(d => d.name === selectedDepartment)?.id 
        : undefined;

      const response = await getEmployees({
        page: currentPage,
        page_size: 50,
        search: searchTerm || undefined,
        department_id: deptId,
      });

      setEmployees(response.items || []);
      setAllEmployees(response.items || []);
      setTotalPages(response.total_pages || 1);
    } catch (err) {
      console.error('Error loading employees:', err);
      setEmployees([]);
    }
  };

  // Fonction pour charger les stats
  const fetchStats = async () => {
    try {
      const data = await getEmployeeStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
      setStats({
        total: 0,
        active: 0,
        inactive: 0,
        on_leave: 0,
        by_department: {},
        by_gender: {},
        by_contract_type: {},
      });
    }
  };

  // Fonction pour charger les départements
  const fetchDepartments = async (): Promise<Department[]> => {
    try {
      const data = await getDepartments();
      setDepartments(data);
      departmentsRef.current = data;
      return data;
    } catch (err) {
      console.error('Error loading departments:', err);
      setDepartments([]);
      return [];
    }
  };

  // Fonction principale de chargement
  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const depts = await fetchDepartments();
      await fetchStats();
      await fetchEmployees(depts);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  // Chargement initial - une seule fois
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recharger les employés quand les filtres changent
  useEffect(() => {
    if (isInitialized.current && !isLoading && departmentsRef.current.length > 0) {
      const timer = setTimeout(() => {
        fetchEmployees(departmentsRef.current);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedDepartment, currentPage]);

  // Filtrer côté client pour la localisation
  const filteredEmployees = employees.filter(emp => {
    const matchesLocation = selectedLocation === 'Tous' || 
      emp.location === selectedLocation || 
      emp.site === selectedLocation;
    return matchesLocation;
  });

  // Calculer les stats femmes
  const femaleCount = stats?.by_gender?.FEMALE || 
    allEmployees.filter(e => e.gender === 'FEMALE').length;

  // Helper pour obtenir les initiales
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  // Helper pour formater la date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Helper pour le statut
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Actif</span>;
      case 'INACTIVE':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Inactif</span>;
      case 'ON_LEAVE':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">En congés</span>;
      case 'TERMINATED':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Terminé</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  // Export CSV
  const handleExport = () => {
    exportEmployeesToCSV(filteredEmployees);
  };

  // Refresh after add/edit
  const handleSuccess = () => {
    loadAllData();
    setSelectedEmployee(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <Header title="Gestion du Personnel" subtitle="Administration RH, effectifs et congés" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-gray-500">Chargement des données...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Gestion du Personnel" subtitle="Administration RH, effectifs et congés" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <button onClick={loadAllData} className="flex items-center text-red-600 hover:text-red-800">
              <RefreshCw className="w-4 h-4 mr-1" />
              Réessayer
            </button>
          </div>
        )}

        {/* Stats Row 1 - Effectifs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
            <p className="text-xs text-gray-500">Total Employés</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <UserCheck className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{stats?.active || 0}</p>
            <p className="text-xs text-gray-500">Actifs</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />+8%
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-600">0</p>
            <p className="text-xs text-gray-500">Nouveaux</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{stats?.inactive || 0}</p>
            <p className="text-xs text-gray-500">Inactifs</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{departments.length}</p>
            <p className="text-xs text-gray-500">Départements</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-indigo-600">
              {allEmployees.filter(e => e.is_manager).length}
            </p>
            <p className="text-xs text-gray-500">Managers</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Palmtree className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{stats?.on_leave || 0}</p>
            <p className="text-xs text-gray-500">En congés</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-pink-500">♀</span>
            </div>
            <p className="text-2xl font-bold text-pink-600">{femaleCount}</p>
            <p className="text-xs text-gray-500">Femmes</p>
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
                <div className="flex gap-3 flex-wrap">
                  <select 
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="Tous">Tous les départements</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
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
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </button>
                  <button 
                    onClick={handleExport}
                    className="flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
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
                  {filteredEmployees.length === 0 ? (
                    <div className="p-12 text-center">
                      <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500 mb-4">Aucun employé trouvé</p>
                      <button 
                        onClick={loadAllData}
                        className="flex items-center mx-auto px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Actualiser
                      </button>
                    </div>
                  ) : (
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
                                    {getInitials(employee.first_name, employee.last_name)}
                                  </div>
                                  {employee.status === 'ON_LEAVE' && (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                      <Palmtree className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  )}
                                </div>
                                <div className="ml-3">
                                  <div className="flex items-center">
                                    <p className="font-medium text-gray-900">
                                      {employee.first_name} {employee.last_name}
                                    </p>
                                    {employee.is_manager && (
                                      <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Mgr</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500">{employee.position || employee.job_title || '-'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                                {employee.department_name || '-'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-600">{employee.location || employee.site || '-'}</td>
                            <td className="px-5 py-4">
                              {getStatusBadge(employee.status)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEmployee(employee);
                                    setShowEditModal(true);
                                  }}
                                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEmployee(employee);
                                    setShowViewModal(true);
                                  }}
                                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                  title="Voir détails"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        Page {currentPage} sur {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                        >
                          Précédent
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                        >
                          Suivant
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Employee Detail */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit sticky top-6">
                {selectedEmployee ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="relative inline-block">
                        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">
                          {getInitials(selectedEmployee.first_name, selectedEmployee.last_name)}
                        </div>
                        {selectedEmployee.status === 'ON_LEAVE' && (
                          <div className="absolute bottom-2 right-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <Palmtree className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {selectedEmployee.first_name} {selectedEmployee.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">{selectedEmployee.position || selectedEmployee.job_title || '-'}</p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        {getStatusBadge(selectedEmployee.status)}
                        {selectedEmployee.is_manager && (
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
                      {selectedEmployee.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-3 text-gray-400" />
                          {selectedEmployee.phone}
                        </div>
                      )}
                      {(selectedEmployee.location || selectedEmployee.site) && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                          {selectedEmployee.location || selectedEmployee.site}
                        </div>
                      )}
                      {selectedEmployee.department_name && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Building2 className="w-4 h-4 mr-3 text-gray-400" />
                          {selectedEmployee.department_name}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                        Depuis le {formatDate(selectedEmployee.hire_date)}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500 mb-2">Type de contrat</p>
                      <p className="font-medium text-gray-900">{selectedEmployee.contract_type || '-'}</p>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <button 
                        onClick={() => setShowViewModal(true)}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Voir profil
                      </button>
                      <button 
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Sélectionnez un employé pour voir les détails</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Leave Management Tab */
          <div className="grid lg:grid-cols-3 gap-6">
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
                  {leaveRequests.map((leave) => (
                    <div key={leave.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
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
                          <p className="text-xs text-gray-500">{leave.startDate} → {leave.endDate}</p>
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
                          <div className="flex gap-2">
                            <button className="flex items-center px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Approuver
                            </button>
                            <button className="flex items-center px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600">
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

            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Résumé des congés</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">En congés aujourd&apos;hui</span>
                    <span className="font-semibold text-green-600">{stats?.on_leave || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Demandes en attente</span>
                    <span className="font-semibold text-yellow-600">
                      {leaveRequests.filter(l => l.status === 'pending').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showViewModal && selectedEmployee && (
        <EmployeeModal 
          employee={{
            id: selectedEmployee.id,
            name: `${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
            email: selectedEmployee.email,
            phone: selectedEmployee.phone || '',
            department: selectedEmployee.department_name || '',
            position: selectedEmployee.position || selectedEmployee.job_title || '',
            location: selectedEmployee.location || selectedEmployee.site || '',
            startDate: formatDate(selectedEmployee.hire_date),
            status: selectedEmployee.status === 'ACTIVE' ? 'active' : 'inactive',
            manager: '-',
            gender: selectedEmployee.gender === 'FEMALE' ? 'F' : 'M',
            birthYear: selectedEmployee.birth_date ? new Date(selectedEmployee.birth_date).getFullYear() : 1990,
            isManager: selectedEmployee.is_manager || false,
            isTopManager: false,
            onLeave: selectedEmployee.status === 'ON_LEAVE',
          }} 
          onClose={() => setShowViewModal(false)} 
        />
      )}

      {showAddModal && (
        <AddEmployeeModal 
          onClose={() => setShowAddModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showEditModal && selectedEmployee && (
        <EditEmployeeModal 
          employee={selectedEmployee}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}