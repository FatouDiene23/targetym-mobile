'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, ChevronLeft } from 'lucide-react';
import { createDepartment, getDepartments, type Department } from '@/lib/api';

interface AddServiceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const COLORS = [
  { value: '#3B82F6', label: 'Bleu', class: 'bg-blue-500' },
  { value: '#10B981', label: 'Vert', class: 'bg-green-500' },
  { value: '#8B5CF6', label: 'Violet', class: 'bg-purple-500' },
  { value: '#F59E0B', label: 'Orange', class: 'bg-amber-500' },
  { value: '#EF4444', label: 'Rouge', class: 'bg-red-500' },
  { value: '#EC4899', label: 'Rose', class: 'bg-pink-500' },
  { value: '#06B6D4', label: 'Cyan', class: 'bg-cyan-500' },
  { value: '#6366F1', label: 'Indigo', class: 'bg-indigo-500' },
];

export default function AddServiceModal({ onClose, onSuccess }: AddServiceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDepts, setIsLoadingDepts] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    color: '#10B981',
    parent_id: '',
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  async function loadDepartments() {
    setIsLoadingDepts(true);
    try {
      const data = await getDepartments();
      // Filtrer pour n'avoir que les départements principaux (sans parent)
      const mainDepts = (data || []).filter(d => !d.parent_id);
      setDepartments(mainDepts);
    } catch (err) {
      console.error('Error loading departments:', err);
    } finally {
      setIsLoadingDepts(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.parent_id) {
      setError('Veuillez sélectionner un département parent');
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
        parent_id: parseInt(formData.parent_id),
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Create service error:', err);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-900">Nouveau Service</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Département parent */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département parent *</label>
              <select
                name="parent_id"
                value={formData.parent_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
                disabled={isLoadingDepts}
              >
                <option value="">
                  {isLoadingDepts ? 'Chargement...' : 'Sélectionner un département'}
                </option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {!isLoadingDepts && departments.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Aucun département disponible. Créez d&apos;abord un département.
                </p>
              )}
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du service *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Recrutement"
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
                placeholder="Ex: RECR"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">Si vide, sera généré automatiquement</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Description du service..."
                rows={3}
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
            disabled={isLoading || !formData.name || !formData.parent_id}
            className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer le service
          </button>
        </div>
      </div>
    </div>
  );
}
