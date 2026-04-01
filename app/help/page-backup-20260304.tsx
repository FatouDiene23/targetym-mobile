'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, BookOpen, HelpCircle, ArrowLeft, ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  article_count: number;
}

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  views_count: number;
  created_at: string;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

export default function HelpCenterPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Vérifier si l'utilisateur est connecté
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  // Charger les catégories
  useEffect(() => {
    fetch(`${API_URL}/api/help/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erreur chargement catégories:', err);
        setLoading(false);
      });
  }, []);

  // Charger les articles selon la catégorie sélectionnée
  useEffect(() => {
    const url = selectedCategory
      ? `${API_URL}/api/help/articles?category_slug=${selectedCategory}`
      : `${API_URL}/api/help/articles`;

    fetch(url)
      .then(res => res.json())
      .then(data => setArticles(data))
      .catch(err => console.error('Erreur chargement articles:', err));
  }, [selectedCategory]);

  // Recherche
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;

    try {
      const res = await fetch(`${API_URL}/api/help/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setArticles(data);
      setSelectedCategory(null);
    } catch (err) {
      console.error('Erreur recherche:', err);
    }
  };

  // Rendre l'icône depuis le nom
  const renderIcon = (iconName: string | null) => {
    if (!iconName) return <BookOpen className="w-5 h-5" />;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const selectedCategoryData = categories.find(c => c.slug === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center">
                <HelpCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Centre d'Aide</h1>
                <p className="text-gray-600">Trouvez des réponses à vos questions</p>
              </div>
            </div>
            <Link
              href={isLoggedIn ? "/dashboard" : "https://targetym-website.vercel.app/login"}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isLoggedIn ? "Retour au tableau de bord" : "Connexion"}
            </Link>
          </div>

          {/* Barre de recherche */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans les articles..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </form>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Catégories */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Catégories</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-left ${
                    !selectedCategory
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <BookOpen className="w-5 h-5 mr-3" />
                  <span className="flex-1">Tous les articles</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-left ${
                      selectedCategory === cat.slug
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {renderIcon(cat.icon)}
                    <span className="flex-1 ml-3">{cat.name}</span>
                    <span className="text-sm text-gray-500">{cat.article_count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Articles */}
          <div className="lg:col-span-3">
            {selectedCategoryData && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedCategoryData.name}</h2>
                {selectedCategoryData.description && (
                  <p className="text-gray-600 mt-1">{selectedCategoryData.description}</p>
                )}
              </div>
            )}

            {articles.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun article trouvé</h3>
                <p className="text-gray-600">
                  {searchQuery
                    ? 'Essayez avec d\'autres mots-clés'
                    : 'Cette catégorie ne contient pas encore d\'articles'}
                </p>
              </div>
            ) : (
              <div className="grid gap-6">
                {articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/help/${article.slug}`}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start space-x-4">
                      {article.cover_image_url && (
                        <img
                          src={article.cover_image_url}
                          alt={article.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 hover:text-primary-600 mb-2">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-gray-600 mb-3 line-clamp-2">{article.excerpt}</p>
                        )}
                        <div className="flex items-center text-sm text-gray-500">
                          <span>{article.views_count} vues</span>
                          <span className="mx-2">•</span>
                          <span>{new Date(article.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
