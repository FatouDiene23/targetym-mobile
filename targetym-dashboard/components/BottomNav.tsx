'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserCircle,
  GraduationCap,
  TrendingUp,
  MoreHorizontal,
  LucideIcon,
  Calendar,
  Target,
  Users,
  Sparkles,
  BarChart3,
  UserPlus,
  Settings,
  Briefcase,
  X,
  HelpCircle,
  LogOut,
  Shield,
  Building2,
  Receipt,
  PenLine,
  PlayCircle,
  Handshake,
  Wallet,
  Network,
  LayoutList,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ============================================
// TYPES
// ============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg' | 'superadmin';

interface BottomNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

// ============================================
// NAV CONFIG
// ============================================

// 4 onglets fixes pour les rôles normaux
const mainTabs: BottomNavItem[] = [
  { name: 'Accueil', href: '/dashboard', icon: LayoutDashboard, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mon Espace', href: '/dashboard/my-space', icon: UserCircle, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Formation', href: '/dashboard/learning', icon: GraduationCap, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Performance', href: '/dashboard/performance', icon: TrendingUp, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
];

// Onglets principaux pour Super Admin
const superAdminMainTabs: BottomNavItem[] = [
  { name: 'Dashboard', href: '/dashboard/platform-admin', icon: Shield, roles: ['superadmin'] },
  { name: 'Utilisateurs', href: '/dashboard/platform-admin/users', icon: Users, roles: ['superadmin'] },
  { name: 'Entreprises', href: '/dashboard/platform-admin/companies', icon: Building2, roles: ['superadmin'] },
  { name: 'Facturation', href: '/dashboard/platform-admin/billing', icon: Receipt, roles: ['superadmin'] },
];

// Menu "Plus" pour Super Admin
const superAdminMoreTabs: BottomNavItem[] = [
  { name: 'Blog', href: '/dashboard/blog', icon: PenLine, roles: ['superadmin'] },
  { name: 'Ressources', href: '/dashboard/resources', icon: PlayCircle, roles: ['superadmin'] },
  { name: 'Centre d\'Aide', href: '/dashboard/help-admin', icon: HelpCircle, roles: ['superadmin'] },
];

// Items dans le menu "Plus" pour les rôles normaux
const moreTabs: BottomNavItem[] = [
  { name: 'OKR & Objectifs', href: '/dashboard/okr', icon: Target, roles: ['manager', 'rh', 'admin', 'dg'] },
  { name: 'Recrutement', href: '/dashboard/recruitment', icon: UserPlus, roles: ['rh', 'admin', 'dg'] },
  { name: 'Onboarding', href: '/dashboard/onboarding', icon: Handshake, roles: ['rh', 'admin', 'dg'] },
  { name: 'Talents & Carrière', href: '/dashboard/talents', icon: Sparkles, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'People Analytics', href: '/dashboard/analytics', icon: BarChart3, roles: ['rh', 'admin', 'dg'] },
  { name: 'Programmes RH', href: '/dashboard/programmes', icon: LayoutList, roles: ['rh', 'admin', 'dg'] },
  { name: 'Gestion du Personnel', href: '/dashboard/employees', icon: Users, roles: ['rh', 'admin', 'dg'] },
  { name: 'Gestion des Congés', href: '/dashboard/leaves', icon: Calendar, roles: ['rh', 'admin', 'dg', 'manager'] },
  { name: 'Gestion des Missions', href: '/dashboard/missions', icon: Briefcase, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Gestion des Contentieux', href: '/dashboard/contentieux', icon: Shield, roles: ['rh', 'admin', 'dg'] },
  { name: 'Enquêtes', href: '/dashboard/surveys', icon: HelpCircle, roles: ['rh', 'admin', 'dg'] },
  { name: 'Notes de Service', href: '/dashboard/notes-de-service', icon: PenLine, roles: ['rh', 'admin', 'dg'] },
  { name: 'Réservation de Salles', href: '/dashboard/reservations', icon: Calendar, roles: ['rh', 'admin', 'dg'] },
  { name: 'Budget RH', href: '/dashboard/budget-rh', icon: Wallet, roles: ['admin', 'dg', 'rh'] },
  { name: 'Certificats', href: '/dashboard/certificates', icon: Receipt, roles: ['admin', 'dg', 'rh'] },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings, roles: ['admin', 'dg', 'rh'] },
];

// ============================================
// HELPERS
// ============================================

function normalizeRole(role: string | undefined): UserRole {
  if (!role) return 'employee';
  const r = role.toLowerCase().replace(/[^a-z]/g, '');
  if (r === 'superadmin' || r === 'superadmintech' || r === 'platformadmin') return 'superadmin';
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'dg' || r === 'director' || r === 'directiongenerale') return 'dg';
  if (r === 'rh' || r === 'hr' || r === 'humanresources') return 'rh';
  if (r === 'manager') return 'manager';
  return 'employee';
}

function getUserRole(): UserRole {
  if (typeof window === 'undefined') return 'employee';
  try {
    const userData = localStorage.getItem('user');
    if (!userData) return 'employee';
    const user = JSON.parse(userData);
    return normalizeRole(user.role);
  } catch {
    return 'employee';
  }
}

// ============================================
// COMPONENT
// ============================================

export default function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('employee');

  useEffect(() => {
    setUserRole(getUserRole());
  }, []);

  // Choisir les onglets selon le rôle (super admin a un menu différent)
  const isSuperAdmin = userRole === 'superadmin';
  const visibleMainTabs = isSuperAdmin
    ? superAdminMainTabs
    : mainTabs.filter(tab => tab.roles.includes(userRole));
  const visibleMoreTabs = isSuperAdmin
    ? superAdminMoreTabs
    : moreTabs.filter(tab => tab.roles.includes(userRole));

  // Vérifier si une route est active
  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  // Vérifier si un item du menu "Plus" est actif
  const isMoreActive = visibleMoreTabs.some(tab => isActive(tab.href));

  return (
    <>
      {/* Overlay menu "Plus" */}
      {showMore && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 pb-2 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-semibold text-gray-900">Plus d&apos;options</span>
              <button
                onClick={() => setShowMore(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
              {visibleMoreTabs.map(tab => {
                const active = isActive(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-colors ${
                      active
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium text-center leading-tight">{tab.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Séparateur + Aide */}
            <div className="border-t border-gray-200 mt-3 pt-3 flex items-center justify-center">
              <Link
                href="/help"
                onClick={() => setShowMore(false)}
                className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <HelpCircle className="w-5 h-5" />
                <span className="text-[10px] font-medium">Aide & Support</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        className="lg:hidden"
      >
        <div className="flex items-stretch justify-around px-1">
          {visibleMainTabs.map(tab => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center flex-1 py-2 pt-2.5 transition-colors relative ${
                  active
                    ? 'text-primary-600'
                    : 'text-gray-500'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-full" />
                )}
                <tab.icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[10px] mt-0.5 ${active ? 'font-semibold' : 'font-medium'}`}>
                  {tab.name}
                </span>
              </Link>
            );
          })}

          {/* Bouton "Plus" */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center flex-1 py-2 pt-2.5 transition-colors relative ${
              showMore || isMoreActive
                ? 'text-primary-600'
                : 'text-gray-500'
            }`}
          >
            {isMoreActive && !showMore && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-full" />
            )}
            <MoreHorizontal className={`w-5 h-5 ${showMore || isMoreActive ? 'stroke-[2.5]' : ''}`} />
            <span className={`text-[10px] mt-0.5 ${showMore || isMoreActive ? 'font-semibold' : 'font-medium'}`}>
              Plus
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
