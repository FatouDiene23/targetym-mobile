'use client';

import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Key } from 'lucide-react';
import { 
  createEmployee, getDepartments, getEmployees, activateEmployeeAccess,
  type Department, type Employee, type GenderType, type ContractType, type StatusType, type EmployeeRole 
} from '@/lib/api';
import NationalitySelect from '@/components/NationalitySelect';

interface AddEmployeeModalProps {
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

export default function AddEmployeeModal({ onClose, onSuccess }: AddEmployeeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [createdEmployee, setCreatedEmployee] = useState<{ id: number; email: string } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    employee_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    department_id: '',
    manager_id: '',
    is_manager: false,
    role: 'employee' as EmployeeRole,
    hire_date: '',
    date_of_birth: '',
    gender: 'male' as GenderType,
    status: 'active' as StatusType,
    contract_type: 'cdi' as ContractType,
    site: '',
    salary: '',
    currency: 'XOF',
    classification: '',
    coefficient: '',
    nationality: '',
    address: '',
    create_access: false,
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

  async function loadData() {
    setIsLoadingData(true);
    try {
      const depts = await getDepartments();
      setDepartments(depts || []);
      
      const empResponse = await getEmployees({ page_size: 500 });
      const allManagers = (empResponse.items || []).filter(e => e.is_manager);
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
      const newEmployee = await createEmployee({
        employee_id: formData.employee_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || undefined,
        job_title: formData.job_title,
        department_id: formData.department_id ? parseInt(formData.department_id) : undefined,
        manager_id: formData.manager_id ? parseInt(formData.manager_id) : undefined,
        is_manager: formData.is_manager,
        role: formData.role,
        hire_date: formData.hire_date || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender,
        status: formData.status,
        contract_type: formData.contract_type,
        site: formData.site || undefined,
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
        currency: formData.currency,
        classification: formData.classification || undefined,
        coefficient: formData.coefficient || undefined,
        nationality: formData.nationality || undefined,
        address: formData.address || undefined,
      });
      
      // Si on doit créer un compte d'accès
      if (formData.create_access && newEmployee.id) {
        try {
          const accessResult = await activateEmployeeAccess(newEmployee.id, false);
          setCreatedEmployee({ id: newEmployee.id, email: newEmployee.email });
          setTempPassword(accessResult.temp_password);
          // Ne pas fermer le modal, afficher le mot de passe
          return;
        } catch (accessErr) {
          console.error('Error creating access:', accessErr);
          // L'employé est créé mais pas le compte - on continue
        }
      }
      
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
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCloseAfterAccess = () => {
    onSuccess();
    onClose();
  };

  // Afficher le mot de passe temporaire si compte créé
  if (tempPassword && createdEmployee) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Compte créé avec succès !</h2>
            <p className="text-gray-600 mb-6">
              Un compte a été créé pour <strong>{createdEmployee.email}</strong>
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 mb-2">Mot de passe temporaire :</p>
              <p className="font-mono text-lg font-bold text-yellow-900 select-all">
                {tempPassword}
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                ⚠️ Notez ce mot de passe, il ne sera plus affiché.
                L&apos;employé devra le changer à sa première connexion.
              </p>
            </div>
            
            <button
              onClick={handleCloseAfterAccess}
              className="w-full px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-900">Nouvel Employé</h2>
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

            {/* Nationalité — SELECT SEARCHABLE */}
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

            {/* Manager */}
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
                placeholder="Conakry"
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
                <option value="cdi">CDI</option>
                <option value="cdd">CDD</option>
                <option value="stage">Stage</option>
                <option value="alternance">Alternance</option>
                <option value="consultant">Consultant</option>
                <option value="interim">Intérim</option>
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
                <option value="active">Actif</option>
                <option value="probation">Période d&apos;essai</option>
                <option value="on_leave">En congés</option>
                <option value="suspended">Suspendu</option>
                <option value="terminated">Terminé</option>
              </select>
            </div>

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
            </div>

            {/* Salaire */}
            <div className="col-span-2">
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
                  <option value="GNF">GNF - Franc guinéen</option>
                  <option value="XOF">XOF - Franc CFA (UEMOA)</option>
                  <option value="XAF">XAF - Franc CFA (CEMAC)</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="USD">USD - Dollar US</option>
                  <option value="NGN">NGN - Naira nigérian</option>
                  <option value="GHS">GHS - Cédi ghanéen</option>
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

            {/* Créer un compte d'accès */}
            <div className="col-span-2 mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  name="create_access"
                  checked={formData.create_access}
                  onChange={handleChange}
                  className="w-4 h-4 mt-0.5 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-900 flex items-center">
                    <Key className="w-4 h-4 mr-1" />
                    Créer un compte d&apos;accès
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Un compte sera créé avec un mot de passe temporaire que vous devrez communiquer à l&apos;employé.
                  </p>
                </div>
              </label>
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
            {formData.create_access ? 'Créer avec compte' : 'Créer l\'employé'}
          </button>
        </div>
      </div>
    </div>
  );
}