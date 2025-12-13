'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { updateEmployee, deleteEmployee, getDepartments, type Employee, type Department } from '@/lib/api';

interface EditEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditEmployeeModal({ employee, onClose, onSuccess }: EditEmployeeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [formData, setFormData] = useState({
    employee_id: employee.employee_id || '',
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    email: employee.email || '',
    phone: employee.phone || '',
    job_title: employee.position || '',
    department_id: employee.department_id?.toString() || '',
    hire_date: employee.hire_date?.split('T')[0] || '',
    date_of_birth: employee.birth_date?.split('T')[0] || '',
    gender: employee.gender || 'MALE',
    status: employee.status || 'ACTIVE',
    contract_type: employee.contract_type || 'CDI',
    site: employee.location || '',
    salary: employee.salary?.toString() || '',
    currency: employee.currency || 'XOF',
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  async function loadDepartments() {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await updateEmployee(employee.id, {
        ...formData,
        department_id: formData.department_id ? parseInt(formData.department_id) : undefined,
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erreur lors de la mise à jour');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      await deleteEmployee(employee.id);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erreur lors de la suppression');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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
          <h2 className="text-xl font-bold text-gray-900">Modifier l&apos;employé</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
              <input
                type="text"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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

            {/* Poste */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Département */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Sélectionner...</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Site */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site / Localisation</label>
              <input
                type="text"
                name="site"
                value={formData.site}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Date d'embauche */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;embauche</label>
              <input
                type="date"
                name="hire_date"
                value={formData.hire_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                <option value="TERMINATED">Terminé</option>
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
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 mb-3">
                Êtes-vous sûr de vouloir supprimer cet employé ? Cette action est irréversible.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                >
                  {isDeleting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Confirmer la suppression
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer
          </button>
          <div className="flex gap-3">
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
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
