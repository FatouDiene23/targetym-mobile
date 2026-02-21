'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Bell, Plus, X, Loader2, User, UserPlus, Briefcase, GraduationCap, Target, FileText } from 'lucide-react';
import AddModal from './AddModal';

// ============================================
// TYPES
// ============================================

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface SearchResult {
  id: string;
  type: 'employee' | 'candidate' | 'job' | 'training' | 'okr';
  title: string;
  subtitle?: string;
  url: string;
}

// ============================================
// API CONFIG
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

// ============================================
// SEARCH FUNCTION
// ============================================

async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];
  
  const results: SearchResult[] = [];
  
  try {
    const empRes = await fetch(`${API_URL}/api/employees/?search=${encodeURIComponent(query)}&page_size=5`, {
      headers: getAuthHeaders()
    });
    if (empRes.ok) {
      const empData = await empRes.json();
      (empData.items || []).forEach((emp: { id: number; employee_id: string; first_name: string; last_name: string; job_title?: string; department_name?: string }) => {
        results.push({
          id: `emp-${emp.id}`,
          type: 'employee',
          title: `${emp.first_name} ${emp.last_name}`,
          subtitle: `${emp.employee_id} • ${emp.job_title || 'Employé'} • ${emp.department_name || ''}`,
          url: `/dashboard/employees/${emp.id}`
        });
      });
    }
  } catch (e) {
    console.error('Search error:', e);
  }
  
  try {
    const candRes = await fetch(`${API_URL}/api/recruitment/applications?page_size=20`, {
      headers: getAuthHeaders()
    });
    if (candRes.ok) {
      const candData = await candRes.json();
      (candData.items || [])
        .filter((app: { candidate_name: string }) => app.candidate_name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .forEach((app: { id: number; candidate_name: string; job_title?: string }) => {
          results.push({
            id: `cand-${app.id}`,
            type: 'candidate',
            title: app.candidate_name,
            subtitle: `Candidat • ${app.job_title || 'Poste non spécifié'}`,
            url: `/dashboard/recruitment`
          });
        });
    }
  } catch (e) {
    console.error('Search error:', e);
  }
  
  try {
    const jobRes = await fetch(`${API_URL}/api/recruitment/jobs?page_size=20`, {
      headers: getAuthHeaders()
    });
    if (jobRes.ok) {
      const jobData = await jobRes.json();
      (jobData.items || [])
        .filter((job: { title: string }) => job.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .forEach((job: { id: number; title: string; department_name?: string; status: string }) => {
          results.push({
            id: `job-${job.id}`,
            type: 'job',
            title: job.title,
            subtitle: `Offre d'emploi • ${job.department_name || ''} • ${job.status}`,
            url: `/dashboard/recruitment`
          });
        });
    }
  } catch (e) {
    console.error('Search error:', e);
  }
  
  return results;
}

// ============================================
// ROUTES AVEC ACTIONS CONTEXTUELLES
// ============================================

const CONTEXTUAL_ROUTES: Record<string, string> = {
  '/dashboard/onboarding': 'onboarding-add',
};

// ============================================
// COMPONENT
// ============================================

export default function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await globalSearch(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(result.url);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'employee': return User;
      case 'candidate': return UserPlus;
      case 'job': return Briefcase;
      case 'training': return GraduationCap;
      case 'okr': return Target;
      default: return FileText;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'employee': return 'bg-blue-100 text-blue-600';
      case 'candidate': return 'bg-green-100 text-green-600';
      case 'job': return 'bg-purple-100 text-purple-600';
      case 'training': return 'bg-orange-100 text-orange-600';
      case 'okr': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    window.location.reload();
  };

  // Bouton Ajouter : contextuel selon la route
  const handleAddClick = () => {
    const contextualEvent = CONTEXTUAL_ROUTES[pathname];
    if (contextualEvent) {
      window.dispatchEvent(new Event(contextualEvent));
    } else {
      setShowAddModal(true);
    }
  };

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowAddModal(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Raccourci Ctrl+K pour recherche
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Titre */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Recherche globale */}
            <div className="relative">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Recherche globale (Ctrl+K)"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Dropdown recherche */}
              {showSearch && (
                <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Rechercher employés, candidats, offres..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 text-sm outline-none bg-transparent"
                        autoFocus
                      />
                      {searching && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                      {searchQuery && !searching && (
                        <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-gray-200 rounded">
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      <div className="py-2">
                        {searchResults.map((result) => {
                          const Icon = getTypeIcon(result.type);
                          return (
                            <button
                              key={result.id}
                              onClick={() => handleResultClick(result)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeColor(result.type)}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                                {result.subtitle && (
                                  <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : searchQuery.length >= 2 && !searching ? (
                      <div className="py-8 text-center text-gray-500">
                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Aucun résultat pour &quot;{searchQuery}&quot;</p>
                      </div>
                    ) : (
                      <div className="py-6 px-4 text-center text-gray-500">
                        <p className="text-sm">Tapez au moins 2 caractères</p>
                        <p className="text-xs text-gray-400 mt-1">Recherchez par nom, matricule, poste...</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">↵</kbd> pour sélectionner
                      <span className="mx-2">•</span>
                      <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Esc</kbd> pour fermer
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
              </button>

              {/* Dropdown notifications */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="p-6 text-center text-gray-500">
                    <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Aucune notification</p>
                    <p className="text-xs text-gray-400 mt-1">Vous êtes à jour !</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton Ajouter — contextuel selon la route */}
            <button
              onClick={handleAddClick}
              className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </button>
          </div>
        </div>
      </header>

      {/* Modal Ajouter (global — sauf routes contextuelles) */}
      {showAddModal && (
        <AddModal 
          onClose={() => setShowAddModal(false)} 
          onSuccess={handleAddSuccess} 
        />
      )}

      {/* Overlay pour fermer les dropdowns */}
      {(showSearch || showNotifications) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowSearch(false);
            setShowNotifications(false);
          }}
        />
      )}
    </>
  );
}