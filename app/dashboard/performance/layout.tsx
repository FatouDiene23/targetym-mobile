'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, MessageSquare, Target, Star, TrendingUp, Users, ChevronLeft 
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard/performance', label: 'Feedback Continu', icon: MessageSquare },
  { href: '/dashboard/performance/campaigns', label: 'Campagnes', icon: Target },
  { href: '/dashboard/performance/evaluations', label: 'Évaluations', icon: Star },
  { href: '/dashboard/performance/objectives', label: 'Objectifs', icon: TrendingUp },
  { href: '/dashboard/performance/one-on-one', label: '1-on-1', icon: Users },
];

export default function PerformanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Secondary Sidebar - Dark Style */}
      <div className="w-56 bg-[#1e2a3b] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-white" />
            <span className="font-semibold text-white">Performance</span>
          </div>
        </div>
        
        {/* Menu Items */}
        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard/performance' && pathname.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* Retour au menu */}
        <div className="p-4 border-t border-white/10">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Retour au menu</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50">
        {children}
      </div>
    </div>
  );
}
