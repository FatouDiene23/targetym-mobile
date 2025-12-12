'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Target, 
  TrendingUp, 
  UserPlus, 
  BarChart3, 
  Users, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Lock
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Tableau de Bord', href: '/dashboard', icon: LayoutDashboard, phase: 1, enabled: true },
  { name: 'OKR & Objectifs', href: '/dashboard/okr', icon: Target, phase: 1, enabled: true },
  { name: 'Recrutement', href: '/dashboard/recruitment', icon: UserPlus, phase: 1, enabled: true },
  { name: 'Talents & Carrière', href: '/dashboard/talents', icon: Sparkles, phase: 1, enabled: true },
  { name: 'Formation & Développement', href: '/dashboard/learning', icon: GraduationCap, phase: 1, enabled: true },
  { name: 'Performance & Feedback', href: '/dashboard/performance', icon: TrendingUp, phase: 1, enabled: true },
  { name: 'People Analytics', href: '/dashboard/analytics', icon: BarChart3, phase: 1, enabled: true },
  { name: 'Gestion du Personnel', href: '/dashboard/employees', icon: Users, phase: 1, enabled: true },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings, phase: 1, enabled: true },
];

interface UserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    // Accéder à localStorage seulement côté client
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, []);

  const initials = user 
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
    : '?';
  
  const displayName = user 
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Utilisateur'
    : 'Utilisateur';
  
  const role = user?.role || 'employee';

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = 'https://targetym-website.vercel.app/login';
  };

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-dark min-h-screen flex flex-col transition-all duration-300`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-bold text-white">Targetym AI</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">T</span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white p-1"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          if (!item.enabled) {
            return (
              <div
                key={item.name}
                className="flex items-center px-3 py-2.5 rounded-lg text-gray-600 cursor-not-allowed relative group"
                title={collapsed ? `${item.name} (Phase ${item.phase})` : undefined}
              >
                <item.icon className={`w-5 h-5 ${collapsed ? 'mx-auto' : 'mr-3'} opacity-50`} />
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium opacity-50 flex-1">{item.name}</span>
                    <Lock className="w-3.5 h-3.5 opacity-50" />
                  </>
                )}
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  Phase {item.phase} - Bientôt disponible
                </div>
              </div>
            );
          }
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-primary-500 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={`w-5 h-5 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-700">
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium">
            {initials}
          </div>
          {!collapsed && (
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-white">{displayName}</div>
              <div className="text-xs text-gray-400 capitalize">{role.replace('_', ' ')}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button 
            onClick={handleLogout}
            className="mt-4 w-full flex items-center justify-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </button>
        )}
      </div>
    </aside>
  );
}
