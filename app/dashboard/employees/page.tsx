'use client';

import Header from '@/components/Header';
import { useState } from 'react';
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
  Eye
} from 'lucide-react';

const employees = [
  { 
    id: 1, 
    name: 'Marie Dupont', 
    email: 'marie.dupont@company.com',
    phone: '+33 6 12 34 56 78',
    department: 'Tech',
    position: 'Lead Developer',
    location: 'Paris',
    startDate: '15 Mar 2021',
    status: 'active',
    manager: 'Jean Martin'
  },
  { 
    id: 2, 
    name: 'Jean Martin', 
    email: 'jean.martin@company.com',
    phone: '+33 6 98 76 54 32',
    department: 'Tech',
    position: 'CTO',
    location: 'Paris',
    startDate: '01 Jan 2019',
    status: 'active',
    manager: '-'
  },
  { 
    id: 3, 
    name: 'Sophie Bernard', 
    email: 'sophie.bernard@company.com',
    phone: '+33 6 11 22 33 44',
    department: 'Marketing',
    position: 'Marketing Manager',
    location: 'Lyon',
    startDate: '20 Sep 2022',
    status: 'active',
    manager: 'Pierre Leroy'
  },
  { 
    id: 4, 
    name: 'Pierre Leroy', 
    email: 'pierre.leroy@company.com',
    phone: '+33 6 55 66 77 88',
    department: 'Marketing',
    position: 'CMO',
    location: 'Paris',
    startDate: '05 Jun 2020',
    status: 'active',
    manager: '-'
  },
  { 
    id: 5, 
    name: 'Emma Richard', 
    email: 'emma.richard@company.com',
    phone: '+33 6 99 88 77 66',
    department: 'RH',
    position: 'HR Business Partner',
    location: 'Paris',
    startDate: '12 Feb 2023',
    status: 'active',
    manager: 'Anne Moreau'
  },
  { 
    id: 6, 
    name: 'Lucas Petit', 
    email: 'lucas.petit@company.com',
    phone: '+33 6 44 55 66 77',
    department: 'Sales',
    position: 'Account Executive',
    location: 'Marseille',
    startDate: '08 Nov 2021',
    status: 'active',
    manager: 'Thomas Blanc'
  },
  { 
    id: 7, 
    name: 'Julie Moreau', 
    email: 'julie.moreau@company.com',
    phone: '+33 6 33 22 11 00',
    department: 'Finance',
    position: 'Financial Controller',
    location: 'Paris',
    startDate: '25 Jul 2020',
    status: 'inactive',
    manager: 'Marc Dubois'
  },
  { 
    id: 8, 
    name: 'Thomas Blanc', 
    email: 'thomas.blanc@company.com',
    phone: '+33 6 77 88 99 00',
    department: 'Sales',
    position: 'Sales Director',
    location: 'Paris',
    startDate: '18 Apr 2019',
    status: 'active',
    manager: '-'
  },
];

const departments = ['Tous', 'Tech', 'Marketing', 'Sales', 'RH', 'Finance'];
const locations = ['Tous', 'Paris', 'Lyon', 'Marseille', 'Remote'];

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');
  const [selectedLocation, setSelectedLocation] = useState('Tous');
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDepartment === 'Tous' || emp.department === selectedDepartment;
    const matchesLocation = selectedLocation === 'Tous' || emp.location === selectedLocation;
    return matchesSearch && matchesDept && matchesLocation;
  });

  return (
    <>
      <Header title="Gestion des Employés" subtitle="Annuaire et fiches collaborateurs" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Total Employés</p>
            <p className="text-2xl font-bold text-gray-900">248</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Actifs</p>
            <p className="text-2xl font-bold text-green-600">245</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Nouveaux ce Mois</p>
            <p className="text-2xl font-bold text-blue-600">12</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Départements</p>
            <p className="text-2xl font-bold text-purple-600">8</p>
          </div>
        </div>

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
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                            {employee.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">{employee.name}</p>
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
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          employee.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {employee.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
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
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold mx-auto mb-3">
                    {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedEmployee.name}</h3>
                  <p className="text-sm text-gray-500">{selectedEmployee.position}</p>
                  <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full ${
                    selectedEmployee.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {selectedEmployee.status === 'active' ? 'Actif' : 'Inactif'}
                  </span>
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

                <div className="flex gap-2 mt-6">
                  <button className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
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
      </main>
    </>
  );
}
