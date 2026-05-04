'use client';

import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomSelect from '@/components/CustomSelect';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface ArticleFormProps {
  article?: any;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

export default function ArticleFormModal({ article, categories, onClose, onSave }: Readonly<ArticleFormProps>) {
  const [formData, setFormData] = useState({
    category_id: article?.category_id || (categories[0]?.id || 1),
    title: article?.title || '',
    slug: article?.slug || '',
    excerpt: article?.excerpt || '',
    content: article?.content || '',
    cover_image_url: article?.cover_image_url || '',
    video_url: article?.video_url || '',
    is_published: article?.is_published || false,
    display_order: article?.display_order || 1
  });

  const [uploading, setUploading] = useState(false);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  const getToken = () => localStorage.getItem('access_token');

  // Auto-générer le slug depuis le titre
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '') // Retirer les accents
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title)
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    setUploading(true);
    const uploadToast = toast.loading('Upload en cours...');
    try {
      const res = await fetch(`${API_URL}/api/help/admin/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formDataUpload
      });

      const data = await res.json();
      if (res.ok) {
        setFormData({ ...formData, cover_image_url: data.url });
        toast.success('Image uploadée avec succès', { id: uploadToast });
      } else {
        toast.error(data.detail || 'Erreur lors de l\'upload', { id: uploadToast });
      }
    } catch (err) {
      console.error('Erreur upload:', err);
      toast.error('Erreur lors de l\'upload', { id: uploadToast });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = article
        ? `${API_URL}/api/help/admin/articles/${article.id}`
        : `${API_URL}/api/help/admin/articles`;

      const method = article ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success(article ? 'Article modifié avec succès' : 'Article créé avec succès');
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
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {article ? 'Modifier l\'article' : 'Nouvel Article'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setPreviewTab('edit')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                previewTab === 'edit'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Édition
            </button>
            <button
              onClick={() => setPreviewTab('preview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                previewTab === 'preview'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Aperçu
            </button>
          </nav>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {previewTab === 'edit' ? (
              <>
                {/* Catégorie */}
                <div>
                  <label htmlFor="article-category" className="block text-sm font-medium text-gray-700 mb-2">
                    Catégorie *
                  </label>
                  <CustomSelect
                    value={String(formData.category_id || '')}
                    onChange={(v) => setFormData({ ...formData, category_id: Number(v) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    options={categories.map(cat => ({ value: String(cat.id), label: cat.name }))}
                  />
                </div>

                {/* Titre */}
                <div>
                  <label htmlFor="article-title" className="block text-sm font-medium text-gray-700 mb-2">
                    Titre *
                  </label>
                  <input
                    id="article-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                {/* Slug */}
                <div>
                  <label htmlFor="article-slug" className="block text-sm font-medium text-gray-700 mb-2">
                    Slug (URL)
                  </label>
                  <input
                    id="article-slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL: /help/{formData.slug}
                  </p>
                </div>

                {/* Extrait */}
                <div>
                  <label htmlFor="article-excerpt" className="block text-sm font-medium text-gray-700 mb-2">
                    Extrait (court résumé)
                  </label>
                  <textarea
                    id="article-excerpt"
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Courte description affichée dans la liste des articles"
                  />
                </div>

                {/* Image de couverture */}
                <div>
                  <label htmlFor="article-cover-image" className="block text-sm font-medium text-gray-700 mb-2">
                    Image de couverture
                  </label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <input
                        id="article-cover-image"
                        type="text"
                        value={formData.cover_image_url}
                        onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="URL de l'image ou uploadez un fichier"
                      />
                    </div>
                    <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Upload...' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  {formData.cover_image_url && (
                    <img
                      src={formData.cover_image_url}
                      alt="Preview"
                      className="mt-2 h-32 object-cover rounded-lg"
                    />
                  )}
                </div>

                {/* URL Vidéo */}
                <div>
                  <label htmlFor="article-video-url" className="block text-sm font-medium text-gray-700 mb-2">
                    URL Vidéo (YouTube, Vimeo, etc.)
                  </label>
                  <input
                    id="article-video-url"
                    type="url"
                    value={formData.video_url}
                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>

                {/* Contenu Markdown */}
                <div>
                  <label htmlFor="article-content" className="block text-sm font-medium text-gray-700 mb-2">
                    Contenu (Markdown) *
                  </label>
                  <textarea
                    id="article-content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={16}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                    placeholder="# Titre principal

## Sous-titre

Votre contenu en **Markdown**...

- Liste à puces
- Item 2

```code
exemple de code
```"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supporte Markdown : gras (**texte**), italique (*texte*), listes, liens, code, etc.
                  </p>
                </div>

                {/* Options */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Publier immédiatement</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <label htmlFor="article-order" className="text-sm text-gray-700">Ordre d'affichage:</label>
                    <input
                      id="article-order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                      min="1"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="prose max-w-none">
                <h1>{formData.title || 'Titre de l\'article'}</h1>
                {formData.excerpt && (
                  <p className="lead text-gray-600">{formData.excerpt}</p>
                )}
                {formData.cover_image_url && (
                  <img src={formData.cover_image_url} alt="Cover" className="rounded-lg" />
                )}
                <div className="whitespace-pre-wrap">
                  {formData.content || 'Le contenu apparaîtra ici...'}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
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
              {article ? 'Mettre à jour' : 'Créer l\'article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
