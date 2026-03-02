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
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Calendar,
  CalendarDays,
  UserCircle,
  UsersRound,
  ClipboardList,
  LucideIcon,
  MessageSquare,
  Star,
  UserCheck,
  Lock,
  Briefcase,
  FileText,
  Plane,
  Handshake,
  BookOpen,
  Award,
  MessageSquarePlus,
  ClipboardCheck,
  Crown,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ============================================
// TYPES
// ============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: NavItem[];
  disabled?: boolean;
  disabledReason?: string;
  dataTour?: string;
}



interface UserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  employee_id?: number;
  is_manager?: boolean;
}

// ============================================
// NAVIGATION CONFIG
// ============================================

const navigation: NavItem[] = [
  { 
    name: 'Tableau de Bord', 
    href: '/dashboard', 
    icon: LayoutDashboard,
    roles: ['employee', 'manager', 'rh', 'admin', 'dg'],
    dataTour: 'sidebar-dashboard'
  },
  { 
    name: 'OKR & Objectifs', 
    href: '/dashboard/okr', 
    icon: Target,
    roles: ['manager', 'rh', 'admin', 'dg'],
    dataTour: 'sidebar-okr'
  },
  { 
    name: 'Recrutement', 
    href: '/dashboard/recruitment', 
    icon: UserPlus,
    roles: ['rh', 'admin', 'dg'],
    dataTour: 'sidebar-recruitment'
  },
  { 
    name: 'Onboarding', 
    href: '/dashboard/onboarding', 
    icon: Handshake,
    roles: ['rh', 'admin', 'dg'],
    dataTour: 'sidebar-onboarding'
  },
  {
    name: 'Talents & Carrière',
    href: '/dashboard/talents',
    icon: Sparkles,
    roles: ['employee', 'manager', 'rh', 'admin', 'dg'],
    dataTour: 'sidebar-career'
  },
  { 
    name: 'Formation & Développement', 
    href: '/dashboard/learning', 
    icon: GraduationCap,
    roles: ['employee', 'manager', 'rh', 'admin', 'dg'],
    dataTour: 'sidebar-learning'
  },
  { 
    name: 'Performance & Feedback', 
    href: '/dashboard/performance', 
    icon: TrendingUp,
    roles: ['employee', 'manager', 'rh', 'admin', 'dg'],
    dataTour: 'sidebar-performance'
  },
  { 
    name: 'People Analytics', 
    href: '/dashboard/analytics', 
    icon: BarChart3,
    roles: ['manager', 'rh', 'admin', 'dg'],
    dataTour: 'sidebar-analytics'
  },
  { 
    name: 'Gestion du Personnel', 
    href: '/dashboard/employees', 
    icon: Users,
    roles: ['rh', 'admin', 'dg'],
    dataTour: 'sidebar-employees'
  },
  { 
    name: 'Gestion des Congés', 
    href: '/dashboard/leaves', 
    icon: Calendar,
    roles: ['rh', 'admin', 'dg'],
    dataTour: 'sidebar-leaves'
  },
  {
    name: 'Gestion des Missions', 
    href: '/dashboard/missions', 
    icon: Plane,
    roles: ['employee', 'manager', 'rh', 'admin', 'dg']
  },
  {
    name: 'Certificats',
    href: '/dashboard/certificates',
    icon: FileText,
    roles: ['admin', 'dg', 'rh']
  },
  { 
    name: 'Paramètres', 
    href: '/dashboard/settings', 
    icon: Settings,
    roles: ['admin', 'dg'],
    dataTour: 'sidebar-settings'
  },
];

// Sous-menu Mon Espace
const mySpaceNavigation: NavItem[] = [
  { name: 'Mon Profil', href: '/dashboard/my-space', icon: UserCircle, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mon Calendrier', href: '/dashboard/my-space/calendar', icon: CalendarDays, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mon Parcours', href: '/dashboard/my-space/career', icon: TrendingUp, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mes Congés', href: '/dashboard/my-space/leaves', icon: Calendar, roles: ['employee', 'manager', 'rh', 'admin', 'dg'], dataTour: 'sidebar-my-leaves' },
  { name: 'Mes Objectifs', href: '/dashboard/my-space/objectives', icon: Target, roles: ['employee', 'manager', 'rh', 'admin', 'dg'], dataTour: 'sidebar-my-objectives' },
  { name: 'Mon Équipe', href: '/dashboard/my-space/team', icon: UsersRound, roles: ['manager', 'rh', 'admin', 'dg'], dataTour: 'sidebar-team' },
  { name: 'Mes Tâches', href: '/dashboard/my-space/tasks', icon: ClipboardList, roles: ['employee', 'manager', 'rh', 'admin', 'dg'], dataTour: 'sidebar-tasks' },
  { name: 'Offres Internes', href: '/dashboard/my-space/internal-jobs', icon: Briefcase, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mes Documents', href: '/dashboard/my-space/documents', icon: FileText, roles: ['employee', 'manager', 'rh', 'admin', 'dg'], dataTour: 'sidebar-documents' },
];

// Sous-menu Performance
const performanceNavigation: NavItem[] = [
  { name: 'Feedback Continu', href: '/dashboard/performance', icon: MessageSquare, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Campagnes', href: '/dashboard/performance/campaigns', icon: Target, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Évaluations', href: '/dashboard/performance/evaluations', icon: Star, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Objectifs', href: '/dashboard/performance/objectives', icon: TrendingUp, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: '1-on-1', href: '/dashboard/performance/one-on-one', icon: UserCheck, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
];

// Sous-menu Formation & Développement
const learningNavigation: NavItem[] = [
  { name: 'Catalogue', href: '/dashboard/learning', icon: BookOpen, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mes Formations', href: '/dashboard/learning/my-learning', icon: User, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mon Équipe', href: '/dashboard/learning/team', icon: UsersRound, roles: ['manager'] },
  { name: 'Parcours', href: '/dashboard/learning/paths', icon: Target, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Certifications', href: '/dashboard/learning/certifications', icon: Award, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Plans Développement', href: '/dashboard/learning/development', icon: GraduationCap, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Demandes', href: '/dashboard/learning/requests', icon: MessageSquarePlus, roles: ['rh', 'admin', 'dg'] },
  { name: 'Éval. Post-Formation', href: '/dashboard/learning/post-eval', icon: ClipboardCheck, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Analytics', href: '/dashboard/learning/analytics', icon: BarChart3, roles: ['rh', 'admin', 'dg'] },
];

// Sous-menu Talents & Carrière
const talentsNavigation: NavItem[] = [
  { name: 'Ma Carrière',      href: '/dashboard/talents/my-career',       icon: TrendingUp,   roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mes Promotions',   href: '/dashboard/talents/my-promotions',   icon: ArrowUpRight, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
  { name: 'Mon Équipe',       href: '/dashboard/talents/team',            icon: UsersRound,   roles: ['manager', 'rh', 'admin', 'dg'] },
  { name: 'Collaborateurs',   href: '/dashboard/talents/employees',  icon: Users,        roles: ['rh', 'admin', 'dg'] },
  { name: 'Dashboard',        href: '/dashboard/talents',            icon: BarChart3,    roles: ['rh', 'admin', 'dg'] },
  { name: 'Matrice 9-Box',    href: '/dashboard/talents/ninebox',   icon: Target,       roles: ['rh', 'admin', 'dg', 'manager'] },
  { name: 'Succession',       href: '/dashboard/talents/succession', icon: Crown,        roles: ['rh', 'admin', 'dg'] },
  { name: 'Parcours',         href: '/dashboard/talents/paths',      icon: Layers,       roles: ['rh', 'admin', 'dg'] },
  { name: 'Promotions',       href: '/dashboard/talents/promotions', icon: ArrowUpRight, roles: ['rh', 'admin', 'dg', 'manager'] },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeRole(role: string | undefined): UserRole {
  if (!role) return 'employee';
  const r = role.toLowerCase().replace('_', '');
  if (r === 'admin' || r === 'administrator' || r === 'superadmin') return 'admin';
  if (r === 'dg' || r === 'director' || r === 'directeur') return 'dg';
  if (r === 'rh' || r === 'hr') return 'rh';
  if (r === 'manager') return 'manager';
  return 'employee';
}

function hasAccess(item: { roles: UserRole[] }, userRole: UserRole, isManager?: boolean): boolean {
  if (item.roles.includes('manager') && isManager) return true;
  return item.roles.includes(userRole);
}

// ============================================
// SIDEBAR INNER (needs useSearchParams inside Suspense)
// ============================================

function SidebarInner() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [inMySpace, setInMySpace] = useState(false);
  const [inPerformance, setInPerformance] = useState(false);
  const [inLearning, setInLearning] = useState(false);
  const [inTalents, setInTalents] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    setInMySpace(pathname.startsWith('/dashboard/my-space'));
    setInPerformance(pathname.startsWith('/dashboard/performance'));
    setInLearning(pathname.startsWith('/dashboard/learning'));
    setInTalents(pathname.startsWith('/dashboard/talents'));
  }, [pathname]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setIsManager(userData.role?.toLowerCase() === 'manager' || userData.is_manager === true);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, []);

  const userRole = normalizeRole(user?.role);
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || '?' : '?';
  const displayName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Utilisateur' : 'Utilisateur';

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = 'https://targetym-website.vercel.app/login';
  };

  const filteredNavigation = navigation.filter(item => hasAccess(item, userRole, isManager));
  const filteredMySpaceNav = mySpaceNavigation.filter(item => hasAccess(item, userRole, isManager));
  const filteredPerformanceNav = performanceNavigation.filter(item => hasAccess(item, userRole, isManager));
  const filteredLearningNav = learningNavigation.filter(item => hasAccess(item, userRole, isManager));
  const filteredTalentsNav = talentsNavigation.filter(item => hasAccess(item, userRole, isManager));

  const NavItemComponent = ({ item, isCollapsed, showTooltip = false }: { item: NavItem; isCollapsed: boolean; showTooltip?: boolean }) => {
    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
    
    if (item.disabled) {
      return (
        <div 
          className={`flex items-center ${isCollapsed ? 'justify-center p-3' : 'px-3 py-2.5'} rounded-lg cursor-not-allowed opacity-50 group relative`} 
          title={item.disabledReason || 'Non disponible'}
        >
          <item.icon className={`w-5 h-5 text-gray-500 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && (
            <>
              <span className="text-sm font-medium text-gray-500 flex-1">{item.name}</span>
              <Lock className="w-3.5 h-3.5 text-gray-600" />
            </>
          )}
          {showTooltip && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs text-gray-400 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              {item.name} - {item.disabledReason}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <Link 
        href={item.href} 
        className={`flex items-center ${isCollapsed ? 'justify-center p-3' : 'px-3 py-2.5'} rounded-lg transition-colors group relative ${isActive ? 'bg-primary-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} 
        title={isCollapsed ? item.name : undefined}
        data-tour={item.dataTour}
      >
        <item.icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
        {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
        {showTooltip && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            {item.name}
          </div>
        )}
      </Link>
    );
  };

  // ============================================
  // ICON SIDEBAR (shared by sub-menu modes)
  // ============================================
  const IconSidebar = ({ activeModule }: { activeModule: 'my-space' | 'performance' | 'learning' | 'talents' }) => (
    <aside className="w-20 bg-dark h-screen flex flex-col border-r border-gray-700 overflow-hidden">
      <div className="h-16 flex items-center justify-center border-b border-gray-700 flex-shrink-0">
        <Link href="/dashboard">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 py-6 px-2 space-y-2 overflow-y-auto overflow-x-hidden sidebar-scroll">
        {filteredNavigation.map((item) => {
          if (item.disabled) {
            return (
              <div 
                key={item.name} 
                className="flex items-center justify-center p-3 rounded-lg cursor-not-allowed opacity-50 group relative" 
                title={item.disabledReason || 'Non disponible'}
              >
                <item.icon className="w-5 h-5 text-gray-500" />
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs text-gray-400 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  {item.name} - {item.disabledReason}
                </div>
              </div>
            );
          }
          // Determine active module href path
          const modulePath = activeModule === 'my-space' ? '/dashboard/my-space' : activeModule === 'performance' ? '/dashboard/performance' : activeModule === 'talents' ? '/dashboard/talents' : '/dashboard/learning';
          const isModuleItem = item.href === modulePath;
          const isActive = isModuleItem 
            ? true 
            : (pathname === item.href || (item.href !== '/dashboard' && item.href !== modulePath && !pathname.startsWith(modulePath) && pathname.startsWith(item.href)));
          return (
            <Link 
              key={item.name} 
              href={item.href} 
              className={`flex items-center justify-center p-3 rounded-lg transition-colors group relative ${
                isActive ? 'bg-primary-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`} 
              title={item.name}
            >
              <item.icon className="w-5 h-5" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                {item.name}
              </div>
            </Link>
          );
        })}
        <div className="border-t border-gray-700 my-4" />
        {activeModule !== 'my-space' ? (
          <Link 
            href="/dashboard/my-space" 
            className="flex items-center justify-center p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors group relative" 
            title="Mon Espace"
          >
            <User className="w-5 h-5" />
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              Mon Espace
            </div>
          </Link>
        ) : (
          <div className="flex items-center justify-center p-3 rounded-lg bg-primary-500 text-white relative group" title="Mon Espace">
            <User className="w-5 h-5" />
          </div>
        )}
      </nav>
      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium mx-auto">
          {initials}
        </div>
        <button 
          onClick={handleLogout} 
          className="mt-4 w-full flex items-center justify-center p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" 
          title="Déconnexion"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );

  // ============================================
  // MODE MON ESPACE
  // ============================================
  if (inMySpace) {
    return (
      <div className="flex h-screen sticky top-0">
        <IconSidebar activeModule="my-space" />
        <aside className="w-56 bg-gray-900 h-screen flex flex-col overflow-hidden">
          <div className="h-16 flex items-center px-4 border-b border-gray-700 flex-shrink-0">
            <User className="w-5 h-5 text-primary-400 mr-3" />
            <span className="font-semibold text-white">Mon Espace</span>
          </div>
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
            {filteredMySpaceNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  {...(item.dataTour ? { 'data-tour': item.dataTour } : {})}
                  className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary-500/20 text-primary-400 border-l-2 border-primary-500' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <Link 
              href="/dashboard" 
              className="flex items-center justify-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Retour au menu
            </Link>
          </div>
        </aside>
      </div>
    );
  }

  // ============================================
  // MODE PERFORMANCE
  // ============================================
  if (inPerformance) {
    return (
      <div className="flex h-screen sticky top-0">
        <IconSidebar activeModule="performance" />
        <aside className="w-56 bg-gray-900 h-screen flex flex-col overflow-hidden">
          <div className="h-16 flex items-center px-4 border-b border-gray-700 flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-primary-400 mr-3" />
            <span className="font-semibold text-white">Performance</span>
          </div>
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
            {filteredPerformanceNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary-500/20 text-primary-400 border-l-2 border-primary-500' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <Link 
              href="/dashboard" 
              className="flex items-center justify-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Retour au menu
            </Link>
          </div>
        </aside>
      </div>
    );
  }

  // ============================================
  // MODE FORMATION & DÉVELOPPEMENT
  // ============================================
  if (inLearning) {
    return (
      <div className="flex h-screen sticky top-0">
        <IconSidebar activeModule="learning" />
        <aside className="w-56 bg-gray-900 h-screen flex flex-col overflow-hidden">
          <div className="h-16 flex items-center px-4 border-b border-gray-700 flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-primary-400 mr-3" />
            <span className="font-semibold text-white">Formation</span>
          </div>
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
            {filteredLearningNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary-500/20 text-primary-400 border-l-2 border-primary-500' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <Link 
              href="/dashboard" 
              className="flex items-center justify-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Retour au menu
            </Link>
          </div>
        </aside>
      </div>
    );
  }

  // ============================================
  // MODE TALENTS & CARRIÈRE
  // ============================================
  if (inTalents) {
    return (
      <div className="flex h-screen sticky top-0">
        <IconSidebar activeModule="talents" />
        <aside className="w-56 bg-gray-900 h-screen flex flex-col overflow-hidden">
          <div className="h-16 flex items-center px-4 border-b border-gray-700 flex-shrink-0">
            <Star className="w-5 h-5 text-primary-400 mr-3" />
            <span className="font-semibold text-white">Talents & Carrière</span>
          </div>
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
            {filteredTalentsNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-500/20 text-primary-400 border-l-2 border-primary-500'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <Link
              href="/dashboard"
              className="flex items-center justify-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Retour au menu
            </Link>
          </div>
        </aside>
      </div>
    );
  }

  // ============================================
  // MODE NORMAL
  // ============================================
  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-dark h-screen flex flex-col transition-all duration-300 sticky top-0 overflow-hidden`}>
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700 flex-shrink-0">
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
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
        {filteredNavigation.map((item) => (
          <NavItemComponent key={item.name} item={item} isCollapsed={collapsed} showTooltip={collapsed} />
        ))}
        <div className="border-t border-gray-700 my-4" />
        <Link 
          href="/dashboard/my-space" 
          className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
            pathname.startsWith('/dashboard/my-space') 
              ? 'bg-primary-500 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`} 
          title={collapsed ? 'Mon Espace' : undefined}
        >
          <User className={`w-5 h-5 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
          {!collapsed && <span className="text-sm font-medium">Mon Espace</span>}
        </Link>
      </nav>

      {/* Footer User */}
      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`} data-tour="user-menu">
          <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium">
            {initials}
          </div>
          {!collapsed && (
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              <div className="text-xs text-gray-400 capitalize">{userRole}</div>
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
        {collapsed && (
          <button 
            onClick={handleLogout} 
            className="mt-4 w-full flex items-center justify-center p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" 
            title="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </aside>
  );
}

// ============================================
// SIDEBAR COMPONENT
// ============================================
export default function Sidebar() {
  return <SidebarInner />;
}