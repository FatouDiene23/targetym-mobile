'use client';

import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  X, User, Building2, Briefcase, UserPlus, 
  GraduationCap, Target, Calendar, FileText,
  ClipboardList, TrendingUp, MessageSquare, Loader2,
  Plane
} from 'lucide-react';
import AddOrganizationalUnitModal from '@/components/AddOrganizationalUnitModal';
import AddEmployeeModal from '@/components/AddEmployeeModal';
import { useI18n } from '@/lib/i18n/I18nContext';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomSelect from '@/components/CustomSelect';
import type { Translations } from '@/lib/i18n';

// ============================================
// TYPES
// ============================================

interface AddModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface QuickOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface PageConfig {
  title: string;
  options: QuickOption[];
}

// ============================================
// API CONFIG
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

// ============================================
// CONFIGURATION PAR PAGE (built with translations)
// ============================================

function getPageConfigs(t: Translations): { defaultConfig: PageConfig; pageConfigs: Record<string, PageConfig> } {
  const a = t.components.addModal;
  const defaultConfig: PageConfig = {
    title: a.whatToAdd,
    options: [
      { id: 'employee', label: a.employee, description: a.addEmployee, icon: User, color: 'bg-primary-100 text-primary-600' },
      { id: 'department', label: a.orgUnit, description: a.orgUnitDesc, icon: Building2, color: 'bg-purple-100 text-purple-600' },
    ]
  };

  const pageConfigs: Record<string, PageConfig> = {
    '/dashboard': defaultConfig,
    '/dashboard/employees': defaultConfig,
    '/dashboard/recruitment': {
      title: a.whatToAdd,
      options: [
        { id: 'candidate', label: a.candidate, description: a.addCandidate, icon: UserPlus, color: 'bg-green-100 text-green-600' },
        { id: 'job', label: a.jobPosting, description: a.createJobPosting, icon: Briefcase, color: 'bg-purple-100 text-purple-600' },
      ]
    },
    '/dashboard/training': {
      title: a.whatToAdd,
      options: [
        { id: 'training', label: a.training, description: a.createTraining, icon: GraduationCap, color: 'bg-orange-100 text-orange-600' },
        { id: 'dev-plan', label: a.devPlan, description: a.createDevPlan, icon: ClipboardList, color: 'bg-primary-100 text-primary-600' },
      ]
    },
    '/dashboard/okr': {
      title: a.whatToAdd,
      options: [
        { id: 'objective', label: a.objective, description: a.createObjective, icon: Target, color: 'bg-yellow-100 text-yellow-600' },
        { id: 'key-result', label: a.keyResult, description: a.addKeyResult, icon: TrendingUp, color: 'bg-green-100 text-green-600' },
      ]
    },
    '/dashboard/conges': {
      title: a.newRequest,
      options: [
        { id: 'leave', label: a.leaveRequest, description: a.createLeave, icon: Calendar, color: 'bg-primary-100 text-primary-600' },
      ]
    },
    '/dashboard/performance': {
      title: a.whatToAdd,
      options: [
        { id: 'evaluation', label: a.evaluation, description: a.createEvaluation, icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
        { id: 'feedback', label: a.feedback, description: a.giveFeedback, icon: MessageSquare, color: 'bg-green-100 text-green-600' },
      ]
    },
    '/dashboard/certificates': {
      title: a.certificates,
      options: [
        { id: 'certificate', label: a.workCertificate, description: a.generateCertificate, icon: FileText, color: 'bg-primary-100 text-primary-600' },
      ]
    },
    '/dashboard/missions': {
      title: a.whatToAdd,
      options: [
        { id: 'mission', label: a.missionRequest, description: a.createMission, icon: Plane, color: 'bg-primary-100 text-primary-600' },
      ]
    },
  };
  return { defaultConfig, pageConfigs };
}

// ============================================
// INTERFACES POUR LES FORMULAIRES
// ============================================

interface Department { id: number; name: string; }
interface Employee { id: number; first_name: string; last_name: string; employee_id?: string; }
interface Job { id: number; title: string; status: string; }

// ============================================
// MAIN COMPONENT
// ============================================

export default function AddModal({ onClose, onSuccess }: AddModalProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Obtenir la config pour la page actuelle
  const { defaultConfig, pageConfigs } = getPageConfigs(t);
  const config = pageConfigs[pathname] || defaultConfig;

  // Charger les données nécessaires
  useEffect(() => {
    const loadData = async () => {
      try {
        const deptRes = await fetch(`${API_URL}/api/departments/`, { headers: getAuthHeaders() });
        if (deptRes.ok) setDepartments(await deptRes.json());

        const empRes = await fetch(`${API_URL}/api/employees/?page_size=200`, { headers: getAuthHeaders() });
        if (empRes.ok) {
          const data = await empRes.json();
          setEmployees(data.items || []);
        }

        const jobRes = await fetch(`${API_URL}/api/recruitment/jobs?status=active&page_size=50`, { headers: getAuthHeaders() });
        if (jobRes.ok) {
          const data = await jobRes.json();
          setJobs(data.items || []);
        }
      } catch (e) {
        console.error('Error loading data:', e);
      }
    };
    loadData();
  }, []);

  const handleOptionClick = (optionId: string) => {
    setSelectedOption(optionId);
  };

  const handleBack = () => {
    setSelectedOption(null);
  };

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      window.location.reload();
    }
    onClose();
  };

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // ========================================
  // Si "department" est sélectionné, ouvrir directement
  // le modal AddOrganizationalUnitModal (le bon modal)
  // ========================================
  if (selectedOption === 'department') {
    return (
      <AddOrganizationalUnitModal
        onClose={onClose}
        onSuccess={handleSuccess}
      />
    );
  }

  // ========================================
  // Si "employee" est sélectionné, ouvrir directement
  // le modal AddEmployeeModal (le bon modal complet)
  // ========================================
  if (selectedOption === 'employee') {
    return (
      <AddEmployeeModal
        onClose={onClose}
        onSuccess={handleSuccess}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedOption ? t.components.addModal.back : config.title}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!selectedOption ? (
            // Liste des options
            <div className="space-y-3">
              {config.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all text-left group"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${option.color} group-hover:scale-110 transition-transform`}>
                    <option.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Formulaire spécifique
            <div>
              <button
                onClick={handleBack}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                {t.components.addModal.backToOptions}
              </button>
              
              {selectedOption === 'candidate' && (
                <CandidateForm jobs={jobs} onSuccess={handleSuccess} onCancel={handleBack} />
              )}
              {selectedOption === 'job' && (
                <JobForm departments={departments} employees={employees} onSuccess={handleSuccess} onCancel={handleBack} />
              )}
              {selectedOption === 'training' && (
                <TrainingForm onSuccess={handleSuccess} onCancel={handleBack} />
              )}
              {selectedOption === 'objective' && (
                <ObjectiveForm onSuccess={handleSuccess} onCancel={handleBack} />
              )}
              {selectedOption === 'leave' && (
                <LeaveForm onSuccess={handleSuccess} onCancel={handleBack} />
              )}
              {selectedOption === 'certificate' && (
                <CertificateRedirect onClose={onClose} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!selectedOption && (
          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              {t.components.addModal.cancel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// FORMULAIRE: CANDIDAT
// ============================================

function CandidateForm({ jobs, onSuccess, onCancel }: { jobs: Job[]; onSuccess: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const a = t.components.addModal;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', location: '', linkedin_url: '',
    skills: '', experience_years: '', source: 'Autre', job_posting_id: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/recruitment/candidates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || undefined,
          location: formData.location || undefined,
          linkedin_url: formData.linkedin_url || undefined,
          skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(s => s) : undefined,
          experience_years: formData.experience_years ? parseInt(formData.experience_years) : undefined,
          source: formData.source,
          job_posting_id: formData.job_posting_id ? parseInt(formData.job_posting_id) : undefined,
        })
      });
      if (res.ok) onSuccess();
      else toast.error(a.creationError);
    } catch { toast.error(a.connectionError); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.firstName} *</label>
          <input type="text" required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.lastName} *</label>
          <input type="text" required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.email} *</label>
        <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.phone}</label>
          <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.location}</label>
          <input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Dakar" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.targetPosition}</label>
        <CustomSelect value={formData.job_posting_id} onChange={(v) => setFormData({...formData, job_posting_id: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '', label: a.selectPosition }, ...jobs.map(j => ({ value: String(j.id), label: j.title }))]} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.skills}</label>
        <input type="text" value={formData.skills} onChange={(e) => setFormData({...formData, skills: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={a.skillsPlaceholder} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.experienceYears}</label>
          <input type="number" min="0" value={formData.experience_years} onChange={(e) => setFormData({...formData, experience_years: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.source}</label>
          <CustomSelect value={formData.source} onChange={(v) => setFormData({...formData, source: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[
            { value: 'LinkedIn', label: 'LinkedIn' },
            { value: 'Indeed', label: 'Indeed' },
            { value: 'Site Carrière', label: a.careerSite },
            { value: 'Référence interne', label: a.internalRef },
            { value: 'Autre', label: a.other },
          ]} />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{a.cancel}</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">
          {saving ? a.creating : a.create}
        </button>
      </div>
    </form>
  );
}

// ============================================
// FORMULAIRE: OFFRE D'EMPLOI
// ============================================

function JobForm({ departments, employees, onSuccess, onCancel }: { departments: Department[]; employees: Employee[]; onSuccess: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const a = t.components.addModal;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '', department_id: '', location: '', contract_type: 'CDI', remote_policy: 'onsite',
    urgency: 'medium', description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/recruitment/jobs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: formData.title,
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
          location: formData.location,
          contract_type: formData.contract_type,
          remote_policy: formData.remote_policy,
          urgency: formData.urgency,
          description: formData.description || null,
        })
      });
      if (res.ok) onSuccess();
      else toast.error(a.creationError);
    } catch { toast.error(a.connectionError); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.jobTitle} *</label>
        <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={a.jobTitlePlaceholder} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.department}</label>
          <CustomSelect value={formData.department_id} onChange={(v) => setFormData({...formData, department_id: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '', label: a.select }, ...departments.map(d => ({ value: String(d.id), label: d.name }))]} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.locationRequired} *</label>
          <input type="text" required value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Dakar" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.contract}</label>
          <CustomSelect value={formData.contract_type} onChange={(v) => setFormData({...formData, contract_type: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[
            { value: 'CDI', label: 'CDI' },
            { value: 'CDD', label: 'CDD' },
            { value: 'Stage', label: 'Stage' },
            { value: 'Freelance', label: 'Freelance' },
          ]} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.remote}</label>
          <CustomSelect value={formData.remote_policy} onChange={(v) => setFormData({...formData, remote_policy: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[
            { value: 'onsite', label: a.onsite },
            { value: 'hybrid', label: a.hybrid },
            { value: 'remote', label: a.fullRemote },
          ]} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.urgency}</label>
          <CustomSelect value={formData.urgency} onChange={(v) => setFormData({...formData, urgency: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[
            { value: 'low', label: a.normalUrgency },
            { value: 'medium', label: a.moderateUrgency },
            { value: 'high', label: a.urgentUrgency },
          ]} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.description}</label>
        <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={a.descriptionPlaceholder} />
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{a.cancel}</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">
          {saving ? a.creating : a.create}
        </button>
      </div>
    </form>
  );
}

// ============================================
// FORMULAIRE: FORMATION (SIMPLIFIÉ)
// ============================================

function TrainingForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const a = t.components.addModal;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ title: '', category: 'technical', duration_hours: '8', description: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/training/catalog`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          duration_hours: parseInt(formData.duration_hours),
          description: formData.description || null,
        })
      });
      if (res.ok) onSuccess();
      else toast.error(a.creationError);
    } catch { toast.error(a.connectionError); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.title} *</label>
        <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.category}</label>
          <CustomSelect value={formData.category} onChange={(v) => setFormData({...formData, category: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[
            { value: 'technical', label: a.technical },
            { value: 'soft_skills', label: a.softSkills },
            { value: 'management', label: a.management },
            { value: 'compliance', label: a.compliance },
            { value: 'other', label: a.other },
          ]} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.durationHours}</label>
          <input type="number" min="1" value={formData.duration_hours} onChange={(e) => setFormData({...formData, duration_hours: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.description}</label>
        <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{a.cancel}</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">
          {saving ? a.creating : a.create}
        </button>
      </div>
    </form>
  );
}

// ============================================
// FORMULAIRE: OBJECTIF OKR
// ============================================

function ObjectiveForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const a = t.components.addModal;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', period: 'Q1 2025' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/okr/objectives`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          period: formData.period,
        })
      });
      if (res.ok) onSuccess();
      else toast.error(a.creationError);
    } catch { toast.error(a.connectionError); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.title} *</label>
        <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={a.objectivePlaceholder} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.period}</label>
        <CustomSelect value={formData.period} onChange={(v) => setFormData({...formData, period: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[
          { value: 'Q1 2025', label: 'Q1 2025' },
          { value: 'Q2 2025', label: 'Q2 2025' },
          { value: 'Q3 2025', label: 'Q3 2025' },
          { value: 'Q4 2025', label: 'Q4 2025' },
          { value: '2025', label: `${a.year} 2025` },
        ]} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.description}</label>
        <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{a.cancel}</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">
          {saving ? a.creating : a.create}
        </button>
      </div>
    </form>
  );
}

// ============================================
// FORMULAIRE: CONGÉ
// ============================================

function LeaveForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const a = t.components.addModal;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/leaves/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          leave_type: formData.leave_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason || null,
        })
      });
      if (res.ok) onSuccess();
      else toast.error(a.creationError);
    } catch { toast.error(a.connectionError); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.leaveType} *</label>
        <CustomSelect value={formData.leave_type} onChange={(v) => setFormData({...formData, leave_type: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[
          { value: 'annual', label: a.annualLeave },
          { value: 'sick', label: a.sick },
          { value: 'maternity', label: a.maternity },
          { value: 'paternity', label: a.paternity },
          { value: 'unpaid', label: a.unpaid },
          { value: 'other', label: a.other },
        ]} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.startDate} *</label>
          <CustomDatePicker value={formData.start_date} onChange={(v) => setFormData({...formData, start_date: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{a.endDate} *</label>
          <CustomDatePicker value={formData.end_date} onChange={(v) => setFormData({...formData, end_date: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{a.reason}</label>
        <textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={a.optionalPlaceholder} />
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{a.cancel}</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">
          {saving ? a.sending : a.submit}
        </button>
      </div>
    </form>
  );
}

// ============================================
// REDIRECTION: CERTIFICAT
// ============================================

function CertificateRedirect({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const a = t.components.addModal;
  const router = useRouter();
  
  useEffect(() => {
    router.push('/dashboard/certificates');
    onClose();
  }, [router, onClose]);

  return (
    <div className="text-center py-8">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-3" />
      <p className="text-gray-500">{a.redirecting}</p>
    </div>
  );
}
