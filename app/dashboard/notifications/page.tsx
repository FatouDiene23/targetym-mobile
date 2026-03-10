'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  Bell, CheckCheck, Check, X, Loader2, Trash2,
  Handshake, Calendar, FileCheck, Plane, Briefcase, ClipboardList, ChevronLeft, ChevronRight
} from 'lucide-react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { notificationsTips } from '@/config/pageTips';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://targetym-alb-380014716.eu-west-1.elb.amazonaws.com';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
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

const NOTIF_STYLES: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  onboarding_task: { icon: Handshake, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Onboarding' },
  onboarding_complete: { icon: CheckCheck, color: 'text-green-600', bg: 'bg-green-100', label: 'Onboarding terminé' },
  get_to_know_scheduled: { icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Get to Know' },
  get_to_know_reminder: { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Rappel' },
  get_to_know_confirmed: { icon: Calendar, color: 'text-green-600', bg: 'bg-green-100', label: 'Get to Know' },
  document_uploaded: { icon: FileCheck, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Document' },
  document_shared: { icon: FileCheck, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Document' },
  leave_approved: { icon: Check, color: 'text-green-600', bg: 'bg-green-100', label: 'Congé approuvé' },
  leave_rejected: { icon: X, color: 'text-red-600', bg: 'bg-red-100', label: 'Congé refusé' },
  leave_request: { icon: Plane, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Demande congé' },
  mission_assigned: { icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Mission' },
  mission_approved: { icon: Check, color: 'text-green-600', bg: 'bg-green-100', label: 'Mission' },
  mission_rejected: { icon: X, color: 'text-red-600', bg: 'bg-red-100', label: 'Mission' },
  task_assigned: { icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Tâche' },
  evaluation_scheduled: { icon: Calendar, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Évaluation' },
  general: { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Général' },
  system: { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Système' },
};

function getStyle(type: string) {
  return NOTIF_STYLES[type] || NOTIF_STYLES.general;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 2) return 'Hier';
  if (diffD < 7) return `Il y a ${diffD} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getPriorityBadge(priority: string) {
  if (priority === 'urgent') return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">Urgent</span>;
  if (priority === 'high') return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">Haute</span>;
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const pageSize = 15;

  // Tour tips
  const { showTips, dismissTips, resetTips } = usePageTour('notifications');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/notifications/?page=${page}&page_size=${pageSize}`;
      if (filter === 'unread') url += '&is_read=false';
      if (filter === 'read') url += '&is_read=true';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await fetch(`${API_URL}/api/notifications/${notif.id}/read`, { method: 'PUT', headers: getAuthHeaders() });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch { /* ignore */ }
    }
    if (notif.action_url) router.push(notif.action_url);
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, { method: 'PUT', headers: getAuthHeaders() });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await fetch(`${API_URL}/api/notifications/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(prev => prev - 1);
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const unreadInView = notifications.filter(n => !n.is_read).length;

  // Grouper par jour
  const groupedByDay = notifications.reduce((acc, notif) => {
    const date = new Date(notif.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    let label: string;
    if (date.toDateString() === today.toDateString()) label = "Aujourd'hui";
    else if (date.toDateString() === yesterday.toDateString()) label = 'Hier';
    else {
      label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (!acc[label]) acc[label] = [];
    acc[label].push(notif);
    return acc;
  }, {} as Record<string, Notification[]>);

  return (
    <>
      {showTips && (
        <PageTourTips
          tips={notificationsTips}
          onDismiss={dismissTips}
          pageTitle="Notifications"
        />
      )}
      
      <Header title="Notifications" subtitle={`${total} notification${total > 1 ? 's' : ''}`} />
      <div className="p-6 max-w-4xl mx-auto">

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" data-tour="notifications-filters">
              {(['all', 'unread', 'read'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f === 'all' ? 'Toutes' : f === 'unread' ? 'Non lues' : 'Lues'}
                </button>
              ))}
            </div>
            {unreadInView > 0 && (
              <button
                data-tour="notifications-actions"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium"
              >
                <CheckCheck className="w-4 h-4" />
                Tout marquer comme lu
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-tour="notifications-list">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Chargement...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">
                {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
              </p>
              <p className="text-sm text-gray-400 mt-1">Vous êtes à jour !</p>
            </div>
          ) : (
            <>
              {Object.entries(groupedByDay).map(([dayLabel, dayNotifs]) => (
                <div key={dayLabel}>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{dayLabel}</p>
                  </div>
                  {dayNotifs.map((notif) => {
                    const style = getStyle(notif.type);
                    const Icon = style.icon;
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleClick(notif)}
                        className={`w-full flex items-start gap-4 px-4 py-4 text-left transition-colors border-b border-gray-50 last:border-0 group ${
                          notif.is_read ? 'hover:bg-gray-50' : 'bg-blue-50/30 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                          <Icon className={`w-5 h-5 ${style.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm ${notif.is_read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                                {notif.title}
                              </p>
                              {getPriorityBadge(notif.priority)}
                              {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs text-gray-400">{formatDate(notif.created_at)}</span>
                              <button
                                onClick={(e) => handleDelete(e, notif.id)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
                                title="Supprimer"
                              >
                                {actionLoading === notif.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>{style.label}</span>
                            {notif.action_url && <span className="text-[10px] text-primary-500">Cliquer pour voir →</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}

              {totalPages > 1 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500">Page {page} sur {totalPages} ({total} résultats)</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
