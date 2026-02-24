'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronLeft, Building2, Users, Briefcase, Layers, Network, GitBranch } from 'lucide-react';
import { createDepartment, getDepartments, getEmployees, type Department, type Employee, type OrganizationalLevel } from '@/lib/api';

interface AddOrganizationalUnitModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// Définition des niveaux (ordre d'affichage uniquement, pas de contrainte parent)
const ORGANIZATIONAL_LEVELS = [
  { 
    value: 'president', 
    label: 'Présidence', 
    shortLabel: 'PCA',
    icon: Building2,
    color: 'bg-slate-700'
  },
  { 
    value: 'vice_president', 
    label: 'Vice-Présidence', 
    shortLabel: 'VP',
    icon: Building2,
    color: 'bg-slate-500'
  },
  { 
    value: 'dg', 
    label: 'Direction Générale', 
    shortLabel: 'DG',
    icon: Building2,
    color: 'bg-red-500'
  },
  { 
    value: 'dga', 
    label: 'Direction Générale Adjointe', 
    shortLabel: 'DGA',
    icon: Building2,
    color: 'bg-orange-500'
  },
  { 
    value: 'direction_centrale', 
    label: 'Direction Centrale', 
    shortLabel: 'DC',
    icon: Network,
    color: 'bg-amber-500'
  },
  { 
    value: 'direction', 
    label: 'Direction', 
    shortLabel: 'DIR',
    icon: GitBranch,
    color: 'bg-yellow-500'
  },
  { 
    value: 'departement', 
    label: 'Département', 
    shortLabel: 'DEPT',
    icon: Users,
    color: 'bg-green-500'
  },
  { 
    value: 'service', 
    label: 'Service', 
    shortLabel: 'SRV',
    icon: Layers,
    color: 'bg-blue-500'
  },
];

const COLORS = [
  { value: '#EF4444', label: 'Rouge', class: 'bg-red-500' },
  { value: '#F97316', label: 'Orange', class: 'bg-orange-500' },
  { value: '#F59E0B', label: 'Ambre', class: 'bg-amber-500' },
  { value: '#EAB308', label: 'Jaune', class: 'bg-yellow-500' },
  { value: '#22C55E', label: 'Vert', class: 'bg-green-500' },
  { value: '#3B82F6', label: 'Bleu', class: 'bg-blue-500' },
  { value: '#8B5CF6', label: 'Violet', class: 'bg-purple-500' },
  { value: '#EC4899', label: 'Rose', class: 'bg-pink-500' },
  { value: '#06B6D4', label: 'Cyan', class: 'bg-cyan-500' },
  { value: '#6366F1', label: 'Indigo', class: 'bg-indigo-500' },
];

// Helper pour obtenir le label d'un niveau
function getLevelLabel(level: string): string {
  return ORGANIZATIONAL_LEVELS.find(l => l.value === level)?.label || level;
}

export default function AddOrganizationalUnitModal({ onClose, onSuccess }: AddOrganizationalUnitModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    description: string;
    color: string;
    level: OrganizationalLevel | '';
    parent_id: string;
    head_id: string;
  }>({
    name: '',
    code: '',
    description: '',
    color: '#3B82F6',
    level: '',
    parent_id: '',
    head_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoadingData(true);
    try {
      const [deptData, empData] = await Promise.all([
        getDepartments(),
        getEmployees({ page_size: 200 })
      ]);
      setDepartments(deptData || []);
      setEmployees(empData.items || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.level) {
      setError('Veuillez sélectionner un type d\'unité');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await createDepartment({
        name: formData.name,
        code: formData.code || formData.name.substring(0, 4).toUpperCase(),
        description: formData.description || undefined,
        color: formData.color,
        level: formData.level as OrganizationalLevel,
        parent_id: formData.parent_id ? parseInt(formData.parent_id) : undefined,
        head_id: formData.head_id ? parseInt(formData.head_id) : undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Create organizational unit error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erreur lors de la création');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectedLevel = ORGANIZATIONAL_LEVELS.find(l => l.value === formData.level);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nouvelle Unité Organisationnelle</h2>
            <p className="text-sm text-gray-500">DG, DGA, Direction, Département, Service</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Type/Niveau */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type d&apos;unité *</label>
              <div className="grid grid-cols-2 gap-2">
                {ORGANIZATIONAL_LEVELS.map(level => {
                  const Icon = level.icon;
                  const isSelected = formData.level === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, level: level.value as OrganizationalLevel }))}
                      className={`flex items-center p-3 border-2 rounded-xl transition-all text-left ${
                        isSelected 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 ${level.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="ml-3 min-w-0">
                        <p className={`font-medium text-sm ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>
                          {level.shortLabel}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{level.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Parent (optionnel pour toutes les unités) */}
            {formData.level && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rattachement (optionnel)
                </label>
                <select
                  name="parent_id"
                  value={formData.parent_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  disabled={isLoadingData}
                >
                  <option value="">
                    {isLoadingData ? 'Chargement...' : 'Aucun (niveau racine)'}
                  </option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {getLevelLabel(dept.level || 'departement')} — {dept.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide pour créer une unité au niveau racine
                </p>
              </div>
            )}

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={selectedLevel ? `Ex: ${selectedLevel.label} des Ressources Humaines` : 'Nom de l\'unité'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code (optionnel)</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="Ex: DRH"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">Si vide, sera généré automatiquement</p>
            </div>

            {/* Responsable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable (optionnel)</label>
              <select
                name="head_id"
                value={formData.head_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                disabled={isLoadingData}
              >
                <option value="">Sélectionner un responsable</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} {emp.job_title ? `- ${emp.job_title}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Description de l'unité..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Couleur */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                    className={`w-8 h-8 rounded-full ${color.class} ${
                      formData.color === color.value 
                        ? 'ring-2 ring-offset-2 ring-gray-400' 
                        : 'hover:scale-110'
                    } transition-all`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !formData.name || !formData.level}
            className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}