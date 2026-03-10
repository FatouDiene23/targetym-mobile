'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { 
  updateEmployee, deleteEmployee, getDepartments, getEmployees, 
  type Employee, type EmployeeCreate, type Department, type GenderType, type ContractType, type StatusType, type EmployeeRole 
} from '@/lib/api';
import NationalitySelect from '@/components/NationalitySelect';

interface EditEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS: { value: EmployeeRole; label: string; description: string }[] = [
  { value: 'employee', label: 'Employé', description: 'Collaborateur standard' },
  { value: 'manager', label: 'Manager', description: 'Gère une équipe' },
  { value: 'rh', label: 'RH', description: 'Équipe Ressources Humaines' },
  { value: 'admin', label: 'Administrateur', description: 'DAF, Directeur...' },
  { value: 'dg', label: 'Direction Générale', description: 'DG, CODIR' },
];

const CONTRACT_TYPES_WITH_END_DATE = ['cdd', 'stage', 'alternance', 'interim'];

// Helper pour convertir les valeurs existantes en minuscule
const normalizeGender = (value?: string): GenderType => {
  if (!value) return 'male';
  const lower = value.toLowerCase();
  if (lower === 'female' || lower === 'f') return 'female';
  if (lower === 'other') return 'other';
  return 'male';
};

const normalizeStatus = (value?: string): StatusType => {
  if (!value) return 'active';
  const lower = value.toLowerCase();
  if (lower === 'on_leave' || lower === 'onleave') return 'on_leave';
  if (lower === 'suspended') return 'suspended';
  if (lower === 'terminated') return 'terminated';
  if (lower === 'probation') return 'probation';
  return 'active';
};

const normalizeContractType = (value?: string): ContractType => {
  if (!value) return 'cdi';
  const lower = value.toLowerCase();
  if (lower === 'cdd') return 'cdd';
  if (lower === 'stage' || lower === 'intern') return 'stage';
  if (lower === 'alternance') return 'alternance';
  if (lower === 'consultant' || lower === 'freelance') return 'consultant';
  if (lower === 'interim' || lower === 'part_time') return 'interim';
  return 'cdi';
};

const normalizeRole = (value?: string): EmployeeRole => {
  if (!value) return 'employee';
  const lower = value.toLowerCase();
  if (lower === 'manager') return 'manager';
  if (lower === 'rh') return 'rh';
  if (lower === 'admin') return 'admin';
  if (lower === 'dg') return 'dg';
  return 'employee';
};

export default function EditEmployeeModal({ employee, onClose, onSuccess }: EditEmployeeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [formData, setFormData] = useState({
    employee_id: employee.employee_id || '',
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    email: employee.email || '',
    phone: employee.phone || '',
    job_title: employee.position || employee.job_title || '',
    department_id: employee.department_id?.toString() || '',
    manager_id: employee.manager_id?.toString() || '',
    is_manager: employee.is_manager || false,
    role: normalizeRole(employee.role),
    hire_date: employee.hire_date?.split('T')[0] || '',
    date_of_birth: employee.birth_date?.split('T')[0] || employee.date_of_birth?.split('T')[0] || '',
    gender: normalizeGender(employee.gender),
    status: normalizeStatus(employee.status),
    contract_type: normalizeContractType(employee.contract_type),
    site: employee.location || employee.site || '',
    salary: employee.salary != null && employee.salary > 0 ? employee.salary.toString() : '',
    net_salary: employee.net_salary != null && employee.net_salary > 0 ? employee.net_salary.toString() : '',
    currency: employee.currency || 'XOF',
    classification: employee.classification || '',
    coefficient: employee.coefficient || '',
    nationality: employee.nationality || '',
    probation_end_date: (employee as any).probation_end_date?.split('T')[0] || '',
    contract_end_date: (employee as any).contract_end_date?.split('T')[0] || '',
  });

  useEffect(() => {
    loadData();
  }, []);

  // Auto-cocher is_manager si le rôle est manager ou supérieur
  useEffect(() => {
    if (['manager', 'rh', 'admin', 'dg'].includes(formData.role)) {
      setFormData(prev => ({ ...prev, is_manager: true }));
    }
  }, [formData.role]);

  // Reset probation_end_date quand statut change
  useEffect(() => {
    if (formData.status !== 'probation') {
      setFormData(prev => ({ ...prev, probation_end_date: '' }));
    }
  }, [formData.status]);

  // Reset contract_end_date quand type de contrat change vers CDI/consultant
  useEffect(() => {
    if (!CONTRACT_TYPES_WITH_END_DATE.includes(formData.contract_type)) {
      setFormData(prev => ({ ...prev, contract_end_date: '' }));
    }
  }, [formData.contract_type]);

  async function loadData() {
    setIsLoadingData(true);
    try {
      // Charger départements
      const depts = await getDepartments();
      setDepartments(depts || []);
      
      // Charger les managers (employés avec is_manager = true, sauf l'employé actuel)
      const empResponse = await getEmployees({ page_size: 500, status: 'active' });
      const allManagers = (empResponse.items || []).filter(e => e.is_manager && e.id !== employee.id);
      setManagers(allManagers);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await updateEmployee(employee.id, {
        employee_id: formData.employee_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || undefined,
        job_title: formData.job_title || undefined,
        department_id: formData.department_id ? parseInt(formData.department_id) : undefined,
        manager_id: formData.manager_id ? parseInt(formData.manager_id) : null,
        is_manager: formData.is_manager,
        role: formData.role,
        hire_date: formData.hire_date || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender,
        status: formData.status,
        contract_type: formData.contract_type,
        site: formData.site || undefined,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        net_salary: formData.net_salary ? parseFloat(formData.net_salary) : null,
        currency: formData.currency,
        classification: formData.classification || null,
        coefficient: formData.coefficient || null,
        nationality: formData.nationality || null,
        probation_end_date: formData.probation_end_date || null,
        contract_end_date: formData.contract_end_date || null,
      } as Partial<EmployeeCreate>);
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
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
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
              <NationalitySelect
                value={formData.nationality}
                onChange={(val) => setFormData(prev => ({ ...prev, nationality: val }))}
                placeholder="Sélectionner une nationalité..."
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
                disabled={isLoadingData}
              >
                <option value="">
                  {isLoadingData ? 'Chargement...' : 'Sélectionner...'}
                </option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.parent_id ? `  ↳ ${dept.name}` : dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Manager (N+1) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager (N+1)</label>
              <select
                name="manager_id"
                value={formData.manager_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                disabled={isLoadingData}
              >
                <option value="">
                  {isLoadingData ? 'Chargement...' : 'Aucun (poste de direction)'}
                </option>
                {managers.map(mgr => (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.first_name} {mgr.last_name} - {mgr.job_title || mgr.position || ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Rôle système */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                {ROLE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {ROLE_OPTIONS.find(r => r.value === formData.role)?.description}
              </p>
            </div>

            {/* Est manager */}
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_manager"
                  checked={formData.is_manager}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Est un manager</span>
              </label>
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
                <option value="cdi">CDI</option>
                <option value="cdd">CDD</option>
                <option value="stage">Stage</option>
                <option value="alternance">Alternance</option>
                <option value="consultant">Consultant</option>
                <option value="interim">Intérim</option>
              </select>
            </div>

            {/* Date de fin de contrat — conditionnel CDD/Stage/Alternance/Intérim */}
            {CONTRACT_TYPES_WITH_END_DATE.includes(formData.contract_type) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin de contrat *
                </label>
                <input
                  type="date"
                  name="contract_end_date"
                  value={formData.contract_end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.contract_type === 'cdd' && "Date d'échéance du CDD"}
                  {formData.contract_type === 'stage' && 'Date de fin du stage'}
                  {formData.contract_type === 'alternance' && "Date de fin de l'alternance"}
                  {formData.contract_type === 'interim' && 'Date de fin de mission'}
                </p>
              </div>
            )}

            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="active">Actif</option>
                <option value="probation">Période d&apos;essai</option>
                <option value="on_leave">En congés</option>
                <option value="suspended">Suspendu</option>
                <option value="terminated">Terminé</option>
              </select>
            </div>

            {/* Fin de période d'essai — conditionnel */}
            {formData.status === 'probation' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fin de période d&apos;essai *
                </label>
                <input
                  type="date"
                  name="probation_end_date"
                  value={formData.probation_end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Date à laquelle la période d&apos;essai se termine
                </p>
              </div>
            )}

            {/* Classification */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <select
                name="classification"
                value={formData.classification}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Non définie</option>
                <option value="Cadre dirigeant">Cadre dirigeant</option>
                <option value="Cadre supérieur">Cadre supérieur</option>
                <option value="Cadre">Cadre</option>
                <option value="Agent de maîtrise">Agent de maîtrise</option>
                <option value="Employé">Employé</option>
                <option value="Non-cadre">Non-cadre</option>
                <option value="Ouvrier">Ouvrier</option>
              </select>
            </div>

            {/* Coefficient */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coefficient</label>
              <input
                type="text"
                name="coefficient"
                value={formData.coefficient}
                onChange={handleChange}
                placeholder="Ex: 350"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Niveau dans la grille de la convention collective</p>
            </div>

            {/* Salaire brut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salaire brut mensuel</label>
              <div className="flex">
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleChange}
                  placeholder="Ex: 500000"
                  step="1000"
                  min="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-gray-50"
                >
                  <option value="XAF">XAF</option>
                  <option value="XOF">XOF</option>
                  <option value="GHS">GHS</option>
                  <option value="NGN">NGN</option>
                  <option value="CDF">CDF</option>
                  <option value="GNF">GNF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            {/* Salaire net */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salaire net mensuel</label>
              <input
                type="number"
                name="net_salary"
                value={formData.net_salary}
                onChange={handleChange}
                placeholder="Ex: 400000"
                step="1000"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
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
