'use client';

import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Key, Camera, Brain, ChevronRight } from 'lucide-react';
import { 
  createEmployee, getDepartments, getEmployees, activateEmployeeAccess, uploadEmployeePhoto, fetchWithAuth, API_URL,
  type Department, type Employee, type GenderType, type ContractType, type StatusType, type EmployeeRole
} from '@/lib/api';
import NationalitySelect from '@/components/NationalitySelect';
import CustomSelect from '@/components/CustomSelect';
import { COUNTRIES } from '@/data/countries';

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

const ROLE_OPTIONS: { value: EmployeeRole; label: string; description: string }[] = [
  { value: 'employee', label: 'Employé', description: 'Collaborateur standard' },
  { value: 'manager', label: 'Manager', description: 'Gère une équipe' },
  { value: 'rh', label: 'RH', description: 'Équipe Ressources Humaines' },
  { value: 'admin', label: 'Administrateur', description: 'DAF, Directeur...' },
  { value: 'dg', label: 'Direction Générale', description: 'DG, CODIR' },
];

const CONTRACT_TYPES_WITH_END_DATE = ['cdd', 'stage', 'alternance', 'interim'];

export default function AddEmployeeModal({ onClose, onSuccess }: AddEmployeeModalProps) {
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
      const group = s.skill_type === 'technical' ? 'Compétences techniques'
        : s.skill_type === 'soft_skill' ? 'Soft skills'
        : 'Management';
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
              <h2 className="text-lg font-bold text-gray-900">Compétences initiales</h2>
              <p className="text-xs text-gray-500">Définissez les niveaux de départ pour ce collaborateur (0 = non évalué)</p>
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
              Passer cette étape
            </button>
            <button
              onClick={proceedAfterSkills}
              disabled={isSavingSkills}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isSavingSkills ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Enregistrer et continuer
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
              <CustomSelect
                value={formData.gender}
                onChange={(v) => setFormData(prev => ({ ...prev, gender: v as GenderType }))}
                placeholder="Genre"
                options={[
                  { value: 'male', label: 'Homme' },
                  { value: 'female', label: 'Femme' },
                  { value: 'other', label: 'Autre' },
                ]}
              />
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
                placeholder="Sélectionner un pays..."
                options={COUNTRIES}
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

            {/* Unité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
              <CustomSelect
                value={String(formData.department_id)}
                onChange={(v) => setFormData(prev => ({ ...prev, department_id: v }))}
                placeholder={isLoadingData ? 'Chargement...' : 'Sélectionner...'}
                disabled={isLoadingData}
                options={[
                  { value: '', label: 'Sélectionner...' },
                  ...departments.map(d => ({ value: String(d.id), label: d.parent_id ? `↳ ${d.name}` : d.name })),
                ]}
              />
            </div>

            {/* Manager */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager (N+1)</label>
              <CustomSelect
                value={String(formData.manager_id)}
                onChange={(v) => setFormData(prev => ({ ...prev, manager_id: v }))}
                placeholder={isLoadingData ? 'Chargement...' : 'Aucun (poste de direction)'}
                disabled={isLoadingData}
                options={[
                  { value: '', label: 'Aucun (poste de direction)' },
                  ...managers.map(m => ({ value: String(m.id), label: `${m.first_name} ${m.last_name}${m.job_title ? ` — ${m.job_title}` : ''}` })),
                ]}
              />
            </div>

            {/* Rôle système */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <CustomSelect
                value={formData.role}
                onChange={(v) => setFormData(prev => ({ ...prev, role: v as EmployeeRole }))}
                placeholder="Rôle"
                options={ROLE_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
              />
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
                <span className="ml-2 text-sm text-gray-700">Juriste (accès module Contentieux)</span>
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
              <CustomSelect
                value={formData.contract_type}
                onChange={(v) => setFormData(prev => ({ ...prev, contract_type: v as ContractType }))}
                placeholder="Type de contrat"
                options={[
                  { value: 'cdi', label: 'CDI' },
                  { value: 'cdd', label: 'CDD' },
                  { value: 'stage', label: 'Stage' },
                  { value: 'alternance', label: 'Alternance' },
                  { value: 'consultant', label: 'Consultant' },
                  { value: 'interim', label: 'Intérim' },
                ]}
              />
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
              <CustomSelect
                value={formData.status}
                onChange={(v) => setFormData(prev => ({ ...prev, status: v as StatusType }))}
                placeholder="Statut"
                options={[
                  { value: 'active', label: 'Actif' },
                  { value: 'probation', label: "Période d'essai" },
                  { value: 'on_leave', label: 'En congés' },
                  { value: 'suspended', label: 'Suspendu' },
                  { value: 'terminated', label: 'Terminé' },
                ]}
              />
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
              <CustomSelect
                value={formData.classification}
                onChange={(v) => setFormData(prev => ({ ...prev, classification: v }))}
                placeholder="Non définie"
                options={[
                  { value: '', label: 'Non définie' },
                  { value: 'Cadre dirigeant', label: 'Cadre dirigeant' },
                  { value: 'Cadre supérieur', label: 'Cadre supérieur' },
                  { value: 'Cadre', label: 'Cadre' },
                  { value: 'Agent de maîtrise', label: 'Agent de maîtrise' },
                  { value: 'Employé', label: 'Employé' },
                  { value: 'Non-cadre', label: 'Non-cadre' },
                  { value: 'Ouvrier', label: 'Ouvrier' },
                ]}
              />
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

            {/* Salaire brut mensuel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salaire brut mensuel</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Part variable</label>
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
              <p className="text-xs text-gray-500 mt-1">Prime ou commission variable mensuelle</p>
            </div>

            {/* === INFO FAMILIALE === */}
            <div className="col-span-2 mt-4 mb-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">Informations Familiales</h3>
            </div>

            {/* Situation matrimoniale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Situation matrimoniale</label>
              <CustomSelect
                value={formData.marital_status}
                onChange={(v) => setFormData(prev => ({ ...prev, marital_status: v }))}
                placeholder="Non renseigné"
                options={[
                  { value: '', label: 'Non renseigné' },
                  { value: 'celibataire', label: 'Célibataire' },
                  { value: 'marie', label: 'Marié(e)' },
                  { value: 'concubinage', label: 'Concubinage' },
                  { value: 'divorce', label: 'Divorcé(e)' },
                  { value: 'veuvage', label: 'Veuvage' },
                  { value: 'autre', label: 'Autre' },
                ]}
              />
            </div>

            {/* Âge (calculé depuis date de naissance) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Âge</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm">
                {formData.date_of_birth
                  ? `${Math.floor((new Date().getTime() - new Date(formData.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))} ans`
                  : 'Renseigner la date de naissance'}
              </div>
            </div>

            {/* Nombre d'enfants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d&apos;enfants à charge</label>
              <input
                type="number"
                name="nb_enfants"
                value={formData.nb_enfants}
                onChange={handleChange}
                min={0}
                max={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Utilisé pour le calcul des parts fiscales (paie)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conjoint(e) — Nom & Prénom</label>
              <input
                type="text"
                name="spouse_name"
                value={formData.spouse_name}
                onChange={handleChange}
                placeholder="Nom et prénom du conjoint"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Conjoint(e) - Date de naissance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conjoint(e) — Date de naissance</label>
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">Adresse Professionnelle</h3>
            </div>

            {/* Email professionnel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email professionnel</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone professionnel</label>
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">Information Médicale</h3>
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
                <span className="ml-2 text-sm text-gray-700">Situation de handicap</span>
              </label>
            </div>

            {/* Nature du handicap (conditionnel) */}
            {formData.has_disability && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nature du handicap</label>
                <input
                  type="text"
                  name="disability_description"
                  value={formData.disability_description}
                  onChange={handleChange}
                  placeholder="Décrire la nature du handicap"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            )}

            {/* Contact urgence - Nom & Prénom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personne à contacter — Nom & Prénom</label>
              <input
                type="text"
                name="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={handleChange}
                placeholder="Nom et prénom"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Contact urgence - Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personne à contacter — Téléphone</label>
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">Organisation</h3>
            </div>

            {/* Membre COMEX */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Membre COMEX</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">HRBP</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie salariale</label>
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 pt-4">Adresse Personnelle</h3>
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

            {/* Photo de profil */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo de profil</label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <img src={photoPreview} alt="Prévisualisation" className="w-16 h-16 rounded-full object-cover border border-gray-200 flex-shrink-0" />
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
                  <p className="text-xs text-gray-400 mt-1">PNG, JPEG, WebP — max 5 Mo</p>
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
