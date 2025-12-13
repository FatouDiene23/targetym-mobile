'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { createEmployee, getDepartments, createDepartment, type Department } from '@/lib/api';

interface AddEmployeeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEmployeeModal({ onClose, onSuccess }: AddEmployeeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(true);
  const [showNewDeptForm, setShowNewDeptForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  
  const [formData, setFormData] = useState({
    employee_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    department_id: '',
    hire_date: '',
    date_of_birth: '',
    gender: 'MALE',
    status: 'ACTIVE',
    contract_type: 'CDI',
    site: '',
    salary: '',
    currency: 'XOF',
    nationality: '',
    address: '',
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  async function loadDepartments() {
    setIsLoadingDepts(true);
    try {
      const data = await getDepartments();
      console.log('Departments loaded:', data);
      setDepartments(data || []);
    } catch (err) {
      console.error('Error loading departments:', err);
      setDepartments([]);
    } finally {
      setIsLoadingDepts(false);
    }
  }

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    
    setIsCreatingDept(true);
    try {
      const newDept = await createDepartment({
        name: newDeptName.trim(),
        code: newDeptCode.trim() || newDeptName.trim().substring(0, 4).toUpperCase(),
      });
      setDepartments([...departments, newDept]);
      setFormData({ ...formData, department_id: newDept.id.toString() });
      setShowNewDeptForm(false);
      setNewDeptName('');
      setNewDeptCode('');
    } catch (err) {
      if (err instanceof Error) {
        setError(`Erreur création département: ${err.message}`);
      }
    } finally {
      setIsCreatingDept(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const dataToSend = {
        ...formData,
        department_id: formData.department_id ? parseInt(formData.department_id) : undefined,
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
      };
      
      console.log('Creating employee with data:', dataToSend);
      await createEmployee(dataToSend);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Create employee error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erreur lors de la création');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Nouvel Employé</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Matricule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matricule *</label>
              <input
                type="text"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                placeholder="EMP001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="prenom.nom@entreprise.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Prénom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Prénom"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Nom"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+225 07 00 00 00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Genre *</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              >
                <option value="MALE">Homme</option>
                <option value="FEMALE">Femme</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>

            {/* Date de naissance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Nationalité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
              <input
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                placeholder="Ivoirienne"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Poste */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poste *</label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleChange}
                placeholder="Développeur Full Stack"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Département */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
              {isLoadingDepts ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                  Chargement...
                </div>
              ) : showNewDeptForm ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Nom du département"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  />
                  <input
                    type="text"
                    value={newDeptCode}
                    onChange={(e) => setNewDeptCode(e.target.value)}
                    placeholder="Code (ex: TECH)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateDepartment}
                      disabled={isCreatingDept || !newDeptName.trim()}
                      className="flex-1 px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50"
                    >
                      {isCreatingDept ? 'Création...' : 'Créer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewDeptForm(false)}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="">Sélectionner...</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewDeptForm(true)}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title="Créer un département"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Site */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site / Localisation</label>
              <input
                type="text"
                name="site"
                value={formData.site}
                onChange={handleChange}
                placeholder="Abidjan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Date d'embauche */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;embauche *</label>
              <input
                type="date"
                name="hire_date"
                value={formData.hire_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Type de contrat */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat</label>
              <select
                name="contract_type"
                value={formData.contract_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="INTERN">Stage</option>
                <option value="FREELANCE">Freelance</option>
                <option value="PART_TIME">Temps partiel</option>
              </select>
            </div>

            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
                <option value="ON_LEAVE">En congés</option>
              </select>
            </div>

            {/* Salaire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salaire brut mensuel</label>
              <div className="flex">
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleChange}
                  placeholder="500000"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-gray-50"
                >
                  <option value="XOF">XOF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            {/* Adresse */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Adresse complète"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer l&apos;employé
          </button>
        </div>
      </div>
    </div>
  );
}
