'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Bell, Plus, X, Loader2, User, UserPlus, Briefcase, GraduationCap, Target, FileText, Check, CheckCheck, ExternalLink, Handshake, Calendar, FileCheck, Plane, ClipboardList } from 'lucide-react';
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

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  reference_type: string | null;
  reference_id: number | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ============================================
// API CONFIG
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

// ============================================
// NOTIFICATION HELPERS
// ============================================

const NOTIF_ICONS: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  onboarding_task: { icon: Handshake, color: 'text-blue-600', bg: 'bg-blue-100' },
  onboarding_complete: { icon: CheckCheck, color: 'text-green-600', bg: 'bg-green-100' },
  get_to_know_scheduled: { icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-100' },
  get_to_know_reminder: { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100' },
  document_uploaded: { icon: FileCheck, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  leave_approved: { icon: Check, color: 'text-green-600', bg: 'bg-green-100' },
  leave_rejected: { icon: X, color: 'text-red-600', bg: 'bg-red-100' },
  leave_request: { icon: Plane, color: 'text-blue-600', bg: 'bg-blue-100' },
  mission_assigned: { icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-100' },
  task_assigned: { icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100' },
  general: { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-100' },
  system: { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-100' },
};

function getNotifStyle(type: string) {
  return NOTIF_ICONS[type] || NOTIF_ICONS.general;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin}min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
  '/dashboard/recruitment': 'recruitment-add',
  '/dashboard/okr': 'okr-add',
  '/dashboard/performance': 'performance-add',
  '/dashboard/performance/campaigns': 'campaigns-add',
  '/dashboard/performance/evaluations': 'evaluations-add',
  '/dashboard/performance/objectives': 'objectives-add',
  '/dashboard/performance/one-on-one': 'one-on-one-add',
  '/dashboard/departures': 'departures-add',
};

// Labels personnalisés par route (sinon "Ajouter" par défaut)
const CONTEXTUAL_LABELS: Record<string, string> = {
  '/dashboard/performance': 'Nouveau Feedback',
  '/dashboard/performance/campaigns': 'Nouvelle Campagne',
  '/dashboard/performance/evaluations': 'Nouvelle Évaluation',
  '/dashboard/performance/objectives': 'Nouvel Objectif',
  '/dashboard/performance/one-on-one': 'Planifier un 1-1',
  '/dashboard/departures': 'Nouveau départ',
};

// Routes où le bouton "+Ajouter" est masqué
const HIDDEN_ADD_ROUTES = [
  '/dashboard/notifications',
  '/dashboard/my-space',
  '/dashboard/analytics',
  '/dashboard/settings',
  '/dashboard/learning',
  '/dashboard/talents',
  '/dashboard/certificates',
  '/dashboard/my-space/daily-checklist',
  '/dashboard/employees',
];

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

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Rôle utilisateur
  const [userRole, setUserRole] = useState('');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserRole((parsed.role || '').toLowerCase());
      }
    } catch {}
  }, []);

  const canAdd = ['admin', 'rh', 'manager', 'dg'].includes(userRole);

  // Charger le count non lu au mount + polling toutes les 60s (pause si onglet inactif)
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUnreadCount();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUnreadCount() {
    try {
      const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count ?? data.count ?? 0);
      }
    } catch (e) {
      // Silencieux si l'API n'est pas encore déployée
    }
  }

  async function fetchRecentNotifications() {
    setLoadingNotifs(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/recent?limit=5`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items || data || []);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoadingNotifs(false);
    }
  }

  async function markAsRead(id: number) {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  }

  function handleNotificationClick(notif: Notification) {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.action_url) {
      setShowNotifications(false);
      router.push(notif.action_url);
    }
  }

  function handleBellClick() {
    const newState = !showNotifications;
    setShowNotifications(newState);
    if (newState) fetchRecentNotifications();
  }

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

            {/* ========== NOTIFICATIONS ========== */}
            <div className="relative">
              <button
                onClick={handleBellClick}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                          title="Tout marquer comme lu"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Liste */}
                  <div className="max-h-96 overflow-y-auto">
                    {loadingNotifs ? (
                      <div className="py-8 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    ) : notifications.length > 0 ? (
                      <div>
                        {notifications.map((notif) => {
                          const style = getNotifStyle(notif.type);
                          const NotifIcon = style.icon;
                          return (
                            <button
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${
                                notif.is_read ? 'hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50/60'
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg}`}>
                                <NotifIcon className={`w-4 h-4 ${style.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-sm truncate ${notif.is_read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                                    {notif.title}
                                  </p>
                                  {!notif.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">Aucune notification</p>
                        <p className="text-xs text-gray-400 mt-1">Vous êtes à jour !</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setShowNotifications(false);
                          router.push('/dashboard/notifications');
                        }}
                        className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-1"
                      >
                        Voir toutes les notifications
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bouton Ajouter — masqué pour employés simples et certaines routes */}
            {canAdd && !HIDDEN_ADD_ROUTES.some(r => pathname.startsWith(r)) && (
              <button
                onClick={handleAddClick}
                className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                {CONTEXTUAL_LABELS[pathname] ?? 'Ajouter'}
              </button>
            )}
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
