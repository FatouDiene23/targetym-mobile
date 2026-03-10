'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface CategoryFormProps {
  category?: any;
  onClose: () => void;
  onSave: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

export default function CategoryFormModal({ category, onClose, onSave }: Readonly<CategoryFormProps>) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    icon: category?.icon || '',
    description: category?.description || '',
    display_order: category?.display_order || 1
  });

  const getToken = () => localStorage.getItem('access_token');

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = category
        ? `${API_URL}/api/help/admin/categories/${category.id}`
        : `${API_URL}/api/help/admin/categories`;

      const method = category ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success(category ? 'Catégorie modifiée avec succès' : 'Catégorie créée avec succès');
        onSave();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Une erreur est survenue');
      }
    } catch (err) {
      console.error('Erreur:', err);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {category ? 'Modifier la catégorie' : 'Nouvelle Catégorie'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="category-name" className="block text-sm font-medium text-gray-700 mb-2">
              Nom de la catégorie *
            </label>
            <input
              id="category-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label htmlFor="category-slug" className="block text-sm font-medium text-gray-700 mb-2">
              Slug (URL)
            </label>
            <input
              id="category-slug"
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="category-icon" className="block text-sm font-medium text-gray-700 mb-2">
              Icône (nom Lucide)
            </label>
            <input
              id="category-icon"
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Rocket, Users, Calendar, etc."
            />
            <p className="text-xs text-gray-500 mt-1">
              Voir les icônes disponibles sur <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">lucide.dev</a>
            </p>
          </div>

          <div>
            <label htmlFor="category-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="category-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Courte description de la catégorie"
            />
          </div>

          <div>
            <label htmlFor="category-order" className="block text-sm font-medium text-gray-700 mb-2">
              Ordre d'affichage
            </label>
            <input
              id="category-order"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              min="1"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {category ? 'Mettre à jour' : 'Créer la catégorie'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
