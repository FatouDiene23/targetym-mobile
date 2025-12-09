'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Target, 
  TrendingUp, 
  UserPlus, 
  BookOpen, 
  BarChart3, 
  Users, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Tableau de Bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'OKR & Objectifs', href: '/dashboard/okr', icon: Target },
  { name: 'Performance', href: '/dashboard/performance', icon: TrendingUp },
  { name: 'Recrutement', href: '/dashboard/recruitment', icon: UserPlus },
  { name: 'Formation', href: '/dashboard/learning', icon: BookOpen },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Employés', href: '/dashboard/employees', icon: Users },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
            MR
          </div>
          {!collapsed && (
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-white">Marie Reine</div>
              <div className="text-xs text-gray-400">Admin</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button className="mt-4 w-full flex items-center justify-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </button>
        )}
      </div>
    </aside>
  );
}
