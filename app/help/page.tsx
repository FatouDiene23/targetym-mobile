'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, BookOpen, HelpCircle, ArrowLeft, ChevronRight } from 'lucide-react';
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
  const [dashboardUrl, setDashboardUrl] = useState('/dashboard');

  // Déterminer le bon dashboard URL selon le rôle
  const getDashboardUrl = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return '/dashboard';
      
      const userData = JSON.parse(userStr);
      const role = userData.role?.toLowerCase().replace('_', '') || '';
      
      // Admin et DG vont sur platform-admin
      if (role === 'admin' || role === 'administrator' || role === 'superadmin' || 
          role === 'dg' || role === 'director' || role === 'directeur') {
        return '/dashboard/platform-admin';
      }
      
      // Autres rôles (RH, Manager, Employee) vont sur le dashboard principal
      return '/dashboard';
    } catch {
      return '/dashboard';
    }
  };

  // Vérifier si l'utilisateur est connecté et déterminer son dashboard
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
    if (token) {
      setDashboardUrl(getDashboardUrl());
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <HelpCircle className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-extrabold mb-1 text-white">Centre d'Aide</h1>
                <p className="text-primary-100 text-lg">Trouvez des réponses à vos questions rapidement</p>
              </div>
            </div>
            <Link
              href={isLoggedIn ? dashboardUrl : "https://targetym-website.vercel.app/login"}
              className="flex items-center px-6 py-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-lg transition-all shadow-md border border-white/20 font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isLoggedIn ? "Retour au tableau de bord" : "Connexion"}
            </Link>
          </div>

          {/* Barre de recherche */}
          <form onSubmit={handleSearch} className="relative max-w-3xl">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans les articles..."
              className="w-full pl-14 pr-6 py-4 bg-white text-gray-900 placeholder-gray-500 rounded-xl focus:ring-4 focus:ring-white/30 focus:outline-none shadow-xl text-lg font-medium"
            />
          </form>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Si aucune catégorie sélectionnée et pas de recherche, afficher grille de catégories */}
        {!selectedCategory && searchQuery === '' ? (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Explorez par catégorie</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className="group text-left bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all p-6"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                      {renderIcon(cat.icon)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                        {cat.name}
                      </h3>
                      {cat.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{cat.description}</p>
                      )}
                      <div className="text-sm text-primary-600 font-semibold">
                        {cat.article_count} {cat.article_count > 1 ? 'articles' : 'article'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Catégories */}
          <div className="lg:col-span-1">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center text-sm font-semibold text-primary-600 hover:text-primary-700 mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Retour aux catégories
              </button>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Catégories</h2>
              <div className="space-y-2">
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedCategoryData.name}</h2>
                {selectedCategoryData.description && (
                  <p className="text-gray-600 text-lg">{selectedCategoryData.description}</p>
                )}
              </div>
            )}

            {articles.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <BookOpen className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun article trouvé</h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery
                    ? 'Essayez avec d\'autres mots-clés'
                    : 'Cette catégorie ne contient pas encore d\'articles'}
                </p>
              </div>
            ) : (
              <div className="grid gap-5">
                {articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/help/${article.slug}`}
                    className="group bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-primary-500 hover:shadow-md transition-all p-6"
                  >
                    <div className="flex items-start space-x-5">
                      {article.cover_image_url && (
                        <div className="flex-shrink-0">
                          <img
                            src={article.cover_image_url}
                            alt={article.title}
                            className="w-28 h-28 object-cover rounded-lg shadow-sm"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary-600 mb-2 transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-gray-600 mb-3 line-clamp-2 leading-relaxed">{article.excerpt}</p>
                        )}
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <span>{article.views_count} vues</span>
                          <span className="text-gray-400">•</span>
                          <span>{new Date(article.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <ChevronRight className="flex-shrink-0 w-6 h-6 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
