'use client';

import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Key, Camera, Brain, ChevronRight } from 'lucide-react';
import { 
  createEmployee, getDepartments, getEmployees, activateEmployeeAccess, uploadEmployeePhoto, fetchWithAuth, API_URL,
  type Department, type Employee, type GenderType, type ContractType, type StatusType, type EmployeeRole
} from '@/lib/api';
import NationalitySelect from '@/components/NationalitySelect';
import { COUNTRIES } from '@/data/countries';
import { useI18n } from '@/lib/i18n/I18nContext';

interface TenantSkill {
  id: number;
  name: string;
  category: string;
  skill_type: string;
  hierarchy_level: string | null;
  is_global: boolean;
}

interface AddEmployeeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CONTRACT_TYPES_WITH_END_DATE = ['cdd', 'stage', 'alternance', 'interim'];

export default function AddEmployeeModal({ onClose, onSuccess }: AddEmployeeModalProps) {
  const { t } = useI18n();

  const ROLE_OPTIONS: { value: EmployeeRole; label: string; description: string }[] = [
    { value: 'employee', label: t.components.addEmployee.roles.employee, description: t.components.addEmployee.roles.employeeDesc },
    { value: 'manager', label: t.components.addEmployee.roles.manager, description: t.components.addEmployee.roles.managerDesc },
    { value: 'rh', label: t.components.addEmployee.roles.rh, description: t.components.addEmployee.roles.rhDesc },
    { value: 'admin', label: t.components.addEmployee.roles.admin, description: t.components.addEmployee.roles.adminDesc },
    { value: 'dg', label: t.components.addEmployee.roles.dg, description: t.components.addEmployee.roles.dgDesc },
  ];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [createdEmployee, setCreatedEmployee] = useState<{ id: number; email: string } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [availableSkills, setAvailableSkills] = useState<TenantSkill[]>([]);
  const [showSkillsStep, setShowSkillsStep] = useState(false);
  const [skillLevels, setSkillLevels] = useState<Record<number, number>>({});
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  const [pendingAccessCreate, setPendingAccessCreate] = useState(false);
  
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
    net_salary: '',
    salaire_brut: '',
    part_variable: '',
    currency: 'XOF',
    classification: '',
    coefficient: '',
    nationality: '',
    address: '',
    create_access: false,
    photo_url: '',
    probation_end_date: '',
    // photo file handled separately
    contract_end_date: '',
    // Famille
    marital_status: '',
    spouse_name: '',
    spouse_birth_date: '',
    nb_enfants: 0,
    // Adresse pro
    work_email: '',
    work_phone: '',
    // Médical
    has_disability: false,
    disability_description: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    // Organisation
    comex_member: '',
    hrbp: '',
    salary_category: '',
    // Juridique
    is_juriste: false,
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
      const depts = await getDepartments();
      setDepartments(depts || []);
      
      const empResponse = await getEmployees({ page_size: 500, status: 'active' });
      const allManagers = (empResponse.items || []).filter(e => e.is_manager);
      setManagers(allManagers);

      try {
        const skillsRes = await fetchWithAuth(`${API_URL}/api/learning/skills/`);
        if (skillsRes.ok) {
          const json = await skillsRes.json();
          setAvailableSkills(Array.isArray(json) ? json : []);
        }
      } catch {
        // Pas de compétences configurées, skip
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }

  async function handleSaveSkills(employeeId: number) {
    setIsSavingSkills(true);
    const entries = Object.entries(skillLevels).filter(([, level]) => level > 0);
    await Promise.allSettled(
      entries.map(([skillId, level]) =>
        fetchWithAuth(`${API_URL}/api/learning/employee-skills/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: employeeId, skill_id: parseInt(skillId), current_level: level }),
        })
      )
    );
    setIsSavingSkills(false);
  }

  async function proceedAfterSkills() {
    if (!createdEmployee) return;
    await handleSaveSkills(createdEmployee.id);
    if (pendingAccessCreate) {
      try {
        const accessResult = await activateEmployeeAccess(createdEmployee.id, false);
        setTempPassword(accessResult.temp_password);
        setShowSkillsStep(false);
        return;
      } catch { /* non-bloquant */ }
    }
    onSuccess();
    onClose();
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
        is_juriste: formData.is_juriste,
        role: formData.role,
        hire_date: formData.hire_date || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender,
        status: formData.status,
        contract_type: formData.contract_type,
        site: formData.site || undefined,
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
        net_salary: formData.net_salary ? parseFloat(formData.net_salary) : undefined,
        salaire_brut: formData.salaire_brut ? parseFloat(formData.salaire_brut) : undefined,
        part_variable: formData.part_variable ? parseFloat(formData.part_variable) : undefined,
        currency: formData.currency,
        classification: formData.classification || undefined,
        coefficient: formData.coefficient || undefined,
        nationality: formData.nationality || undefined,
        address: formData.address || undefined,
        probation_end_date: formData.probation_end_date || undefined,
        contract_end_date: formData.contract_end_date || undefined,
        photo_url: formData.photo_url || undefined,
        marital_status: formData.marital_status || undefined,
        spouse_name: formData.spouse_name || undefined,
        spouse_birth_date: formData.spouse_birth_date || undefined,
        nb_enfants: formData.nb_enfants || undefined,
        work_email: formData.work_email || undefined,
        work_phone: formData.work_phone || undefined,
        has_disability: formData.has_disability || undefined,
        disability_description: formData.disability_description || undefined,
        emergency_contact_name: formData.emergency_contact_name || undefined,
        emergency_contact_phone: formData.emergency_contact_phone || undefined,
        comex_member: formData.comex_member || undefined,
        hrbp: formData.hrbp || undefined,
        salary_category: formData.salary_category || undefined,
      });
      
      // Upload photo si sélectionnée
      if (photoFile && newEmployee.id) {
        try {
          await uploadEmployeePhoto(newEmployee.id, photoFile);
        } catch (photoErr) {
          console.error('Error uploading photo:', photoErr);
        }
      }

      // Initialiser automatiquement les soldes de congés (non-bloquant)
      if (newEmployee.id) {
        try {
          await fetchWithAuth(`${API_URL}/api/leaves/balances/initialize/${newEmployee.id}`, { method: 'POST' });
        } catch {
          // Non-bloquant : l'initialisation peut être faite manuellement
        }
      }

      // Stocker l'employé créé pour l'étape compétences
      setCreatedEmployee({ id: newEmployee.id, email: newEmployee.email });
      setPendingAccessCreate(formData.create_access);

      // Si des compétences sont disponibles, afficher l'étape compétences
      if (availableSkills.length > 0) {
        setShowSkillsStep(true);
        return;
      }

      // Sinon, continuer le flux normal
      if (formData.create_access && newEmployee.id) {
        try {
          const accessResult = await activateEmployeeAccess(newEmployee.id, false);
          setTempPassword(accessResult.temp_password);
          return;
        } catch (accessErr) {
          console.error('Error creating access:', accessErr);
        }
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Create employee error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t.components.addEmployee.errorCreating);
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCloseAfterAccess = () => {
    onSuccess();
    onClose();
  };

  // ── Étape compétences initiales ──────────────────────────────────────────
  if (showSkillsStep && createdEmployee) {
    const skillsByType: Record<string, TenantSkill[]> = {};
    for (const s of availableSkills) {
      const group = s.skill_type === 'technical' ? t.components.addEmployee.skills.technical
        : s.skill_type === 'soft_skill' ? t.components.addEmployee.skills.softSkills
        : t.components.addEmployee.skills.management;
      skillsByType[group] = [...(skillsByType[group] || []), s];
    }
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t.components.addEmployee.skills.title}</h2>
              <p className="text-xs text-gray-500">{t.components.addEmployee.skills.subtitle}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {Object.entries(skillsByType).map(([group, skills]) => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{group}</h3>
                <div className="space-y-3">
                  {skills.map(skill => (
                    <div key={skill.id} className="flex items-center gap-4">
                      <span className="flex-1 text-sm text-gray-800">{skill.name}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={skillLevels[skill.id] ?? 0}
                          onChange={e => setSkillLevels(prev => ({ ...prev, [skill.id]: parseInt(e.target.value) }))}
                          className="w-32 accent-purple-500"
                        />
                        <span className="w-10 text-center text-sm font-medium text-gray-700">
                          {skillLevels[skill.id] ?? 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => { setShowSkillsStep(false); proceedAfterSkills(); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t.components.addEmployee.skills.skipStep}
            </button>
            <button
              onClick={proceedAfterSkills}
              disabled={isSavingSkills}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isSavingSkills ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {t.components.addEmployee.skills.saveAndContinue}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Afficher le mot de passe temporaire si compte créé
  if (tempPassword && createdEmployee) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t.components.addEmployee.accessCreated}</h2>
            <p className="text-gray-600 mb-6">
              {t.components.addEmployee.accessCreatedFor} <strong>{createdEmployee.email}</strong>
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 mb-2">{t.components.addEmployee.tempPassword}</p>
              <p className="font-mono text-lg font-bold text-yellow-900 select-all">
                {tempPassword}
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                {t.components.addEmployee.tempPasswordWarning}
              </p>
            </div>
            
            <button
              onClick={handleCloseAfterAccess}
              className="w-full px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"
            >
              {t.common.close}
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
          <h2 className="text-xl font-bold text-gray-900">{t.components.addEmployee.title}</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{`${t.components.addEmployee.fields.employeeId} *`}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{`${t.components.addEmployee.fields.email} *`}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.firstName} *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder={t.components.addEmployee.fields.firstName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.lastName} *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder={t.components.addEmployee.fields.lastName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.phone}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.gender}</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="male">{t.components.addEmployee.fields.male}</option>
                <option value="female">{t.components.addEmployee.fields.female}</option>
                <option value="other">{t.components.addEmployee.fields.other}</option>
              </select>
            </div>

            {/* Date de naissance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.dateOfBirth}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.nationality}</label>
              <NationalitySelect
                value={formData.nationality}
                onChange={(val) => setFormData(prev => ({ ...prev, nationality: val }))}
                placeholder={t.components.addEmployee.fields.selectCountry}
                options={COUNTRIES}
              />
            </div>

            {/* Poste */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.jobTitle} *</label>
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

            {/* Unité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.unit}</label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                disabled={isLoadingData}
              >
                <option value="">
                  {isLoadingData ? t.common.loading : t.components.addEmployee.fields.selectOption}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.managerN1}</label>
              <select
                name="manager_id"
                value={formData.manager_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                disabled={isLoadingData}
              >
                <option value="">
                  {isLoadingData ? t.common.loading : t.components.addEmployee.fields.noManager}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.role}</label>
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
                <span className="ml-2 text-sm text-gray-700">{t.components.addEmployee.fields.isManager}</span>
              </label>
            </div>

            {/* Est juriste */}
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_juriste"
                  checked={formData.is_juriste}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">{t.components.addEmployee.fields.isJuriste}</span>
              </label>
            </div>

            {/* Site */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.site}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.hireDate} *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.contractType}</label>
              <select
                name="contract_type"
                value={formData.contract_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="cdi">{t.components.addEmployee.fields.cdi}</option>
                <option value="cdd">{t.components.addEmployee.fields.cdd}</option>
                <option value="stage">{t.components.addEmployee.fields.stage}</option>
                <option value="alternance">{t.components.addEmployee.fields.alternance}</option>
                <option value="consultant">{t.components.addEmployee.fields.consultant}</option>
                <option value="interim">{t.components.addEmployee.fields.interim}</option>
              </select>
            </div>

            {/* Date de fin de contrat — conditionnel CDD/Stage/Alternance/Intérim */}
            {CONTRACT_TYPES_WITH_END_DATE.includes(formData.contract_type) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.components.addEmployee.fields.contractEndDate} *
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
                  {formData.contract_type === 'cdd' && t.components.addEmployee.fields.cddEndHint}
                  {formData.contract_type === 'stage' && t.components.addEmployee.fields.stageEndHint}
                  {formData.contract_type === 'alternance' && t.components.addEmployee.fields.alternanceEndHint}
                  {formData.contract_type === 'interim' && t.components.addEmployee.fields.interimEndHint}
                </p>
              </div>
            )}

            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.status}</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="active">{t.components.addEmployee.fields.active}</option>
                <option value="probation">{t.components.addEmployee.fields.probation}</option>
                <option value="on_leave">{t.components.addEmployee.fields.onLeave}</option>
                <option value="suspended">{t.components.addEmployee.fields.suspended}</option>
                <option value="terminated">{t.components.addEmployee.fields.terminated}</option>
              </select>
            </div>

            {/* Fin de période d'essai — conditionnel */}
            {formData.status === 'probation' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.components.addEmployee.fields.probationEnd} *
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
                  {t.components.addEmployee.fields.probationEndHint}
                </p>
              </div>
            )}

            {/* Classification */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.classification}</label>
              <select
                name="classification"
                value={formData.classification}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">{t.components.addEmployee.fields.notDefined}</option>
                <option value="Cadre dirigeant">{t.components.addEmployee.fields.cadreDir}</option>
                <option value="Cadre supérieur">{t.components.addEmployee.fields.cadreSup}</option>
                <option value="Cadre">{t.components.addEmployee.fields.cadre}</option>
                <option value="Agent de maîtrise">{t.components.addEmployee.fields.agentMaitrise}</option>
                <option value="Employé">{t.components.addEmployee.fields.employeeClass}</option>
                <option value="Non-cadre">{t.components.addEmployee.fields.nonCadre}</option>
                <option value="Ouvrier">{t.components.addEmployee.fields.ouvrier}</option>
              </select>
            </div>

            {/* Coefficient */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.coefficient}</label>
              <input
                type="text"
                name="coefficient"
                value={formData.coefficient}
                onChange={handleChange}
                placeholder="Ex: 350"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">{t.components.addEmployee.fields.coefficientHint}</p>
            </div>

            {/* Salaire brut mensuel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.grossSalary}</label>
              <div className="flex">
                <input
                  type="number"
                  name="salaire_brut"
                  value={formData.salaire_brut}
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

            {/* Part variable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.fields.variablePay}</label>
              <input
                type="number"
                name="part_variable"
                value={formData.part_variable}
                onChange={handleChange}
                placeholder="Ex: 100000"
                step="1000"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">{t.components.addEmployee.fields.variablePayHint}</p>
            </div>

            {/* === INFO FAMILIALE === */}
            <div className="col-span-2 mt-4 mb-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">{t.components.addEmployee.sections.familyInfo}</h3>
            </div>

            {/* Situation matrimoniale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.maritalStatus}</label>
              <select
                name="marital_status"
                value={formData.marital_status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">{t.components.addEmployee.sections.notSpecified}</option>
                <option value="celibataire">{t.components.addEmployee.sections.single}</option>
                <option value="marie">{t.components.addEmployee.sections.married}</option>
                <option value="concubinage">{t.components.addEmployee.sections.cohabitation}</option>
                <option value="divorce">{t.components.addEmployee.sections.divorced}</option>
                <option value="veuvage">{t.components.addEmployee.sections.widowed}</option>
                <option value="autre">{t.components.addEmployee.fields.other}</option>
              </select>
            </div>

            {/* Âge (calculé depuis date de naissance) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.age}</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm">
                {formData.date_of_birth
                  ? `${Math.floor((new Date().getTime() - new Date(formData.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))} ${t.components.addEmployee.sections.yearsOld}`
                  : t.components.addEmployee.sections.enterDob}
              </div>
            </div>

            {/* Nombre d'enfants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.childrenCount}</label>
              <input
                type="number"
                name="nb_enfants"
                value={formData.nb_enfants}
                onChange={handleChange}
                min={0}
                max={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">{t.components.addEmployee.sections.childrenHint}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.spouseName}</label>
              <input
                type="text"
                name="spouse_name"
                value={formData.spouse_name}
                onChange={handleChange}
                placeholder={t.components.addEmployee.sections.spouseNamePlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Conjoint(e) - Date de naissance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.spouseDob}</label>
              <input
                type="date"
                name="spouse_birth_date"
                value={formData.spouse_birth_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* === ADRESSE PROFESSIONNELLE === */}
            <div className="col-span-2 mt-4 mb-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">{t.components.addEmployee.sections.workAddress}</h3>
            </div>

            {/* Email professionnel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.workEmail}</label>
              <input
                type="email"
                name="work_email"
                value={formData.work_email}
                onChange={handleChange}
                placeholder="prenom.nom@entreprise.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Téléphone professionnel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.workPhone}</label>
              <input
                type="tel"
                name="work_phone"
                value={formData.work_phone}
                onChange={handleChange}
                placeholder="+225 07 00 00 00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* === INFORMATION MÉDICALE === */}
            <div className="col-span-2 mt-4 mb-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">{t.components.addEmployee.sections.medicalInfo}</h3>
            </div>

            {/* Handicap */}
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="has_disability"
                  checked={formData.has_disability}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">{t.components.addEmployee.sections.disability}</span>
              </label>
            </div>

            {/* Nature du handicap (conditionnel) */}
            {formData.has_disability && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.disabilityNature}</label>
                <input
                  type="text"
                  name="disability_description"
                  value={formData.disability_description}
                  onChange={handleChange}
                  placeholder={t.components.addEmployee.sections.disabilityPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            )}

            {/* Contact urgence - Nom & Prénom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.emergencyName}</label>
              <input
                type="text"
                name="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={handleChange}
                placeholder={t.components.addEmployee.sections.emergencyName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Contact urgence - Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.emergencyPhone}</label>
              <input
                type="tel"
                name="emergency_contact_phone"
                value={formData.emergency_contact_phone}
                onChange={handleChange}
                placeholder="+225 07 00 00 00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* === ORGANISATION === */}
            <div className="col-span-2 mt-4 mb-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">{t.components.addEmployee.sections.organization}</h3>
            </div>

            {/* Membre COMEX */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.comexMember}</label>
              <input
                type="text"
                name="comex_member"
                value={formData.comex_member}
                onChange={handleChange}
                placeholder="Nom et prénom du membre COMEX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* HRBP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.hrbp}</label>
              <input
                type="text"
                name="hrbp"
                value={formData.hrbp}
                onChange={handleChange}
                placeholder="Nom et prénom du HRBP"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Catégorie salariale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.salaryCategory}</label>
              <input
                type="text"
                name="salary_category"
                value={formData.salary_category}
                onChange={handleChange}
                placeholder="Ex: Cadre A, Employé B..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* === ADRESSE PERSONNELLE === */}
            <div className="col-span-2 mt-4 mb-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">{t.components.addEmployee.sections.personalAddress}</h3>
            </div>

            {/* Adresse */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.components.addEmployee.sections.address}</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder={t.components.addEmployee.sections.addressPlaceholder}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Photo de profil */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.components.addEmployee.sections.profilePhoto}</label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <img src={photoPreview} alt={t.components.addEmployee.sections.preview} className="w-16 h-16 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 flex-shrink-0">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePhotoChange}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t.components.addEmployee.sections.photoHint}</p>
                </div>
              </div>
            </div>
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
                    {t.components.addEmployee.sections.createAccess}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {t.components.addEmployee.sections.createAccessHint}
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
            {t.common.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {formData.create_access ? t.components.addEmployee.createWithAccess : t.components.addEmployee.createEmployee}
          </button>
        </div>
      </div>
    </div>
  );
}
