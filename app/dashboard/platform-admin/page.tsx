'use client';

import { useState, useEffect } from 'react';
import {
  Building2, Users, UserCheck, Activity, Shield, AlertCircle, CheckCircle2,
  Search
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getPlatformStats,
  getAllTenants,
  type PlatformStats,
  type TenantListItem
} from '@/lib/api';
import { usePageTour } from '@/hooks/usePageTour';
import PageTourTips from '@/components/PageTourTips';
import { platformAdminTips } from '@/config/pageTips';

export default function PlatformAdminDashboard() {
  const router = useRouter();
  const { showTips, dismissTips } = usePageTour('platformAdmin');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  
  // Helper pour les couleurs de plan
  const getPlanBadgeClass = (plan: string) => {
    if (plan === 'enterprise') return 'bg-purple-100 text-purple-800';
    if (plan === 'professional') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  // Vérifier si user est SUPER_ADMIN
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/');
      return;
    }
    
    const user = JSON.parse(userStr);
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    
    loadData();
  }, [router]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, tenantsData] = await Promise.all([
        getPlatformStats(),
        getAllTenants({ limit: 100 })
      ]);
      
      setStats(statsData);
      setTenants(tenantsData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredTenants = tenants.filter(tenant => {
    let match = true;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      match = match && (
        tenant.name.toLowerCase().includes(search) ||
        tenant.email?.toLowerCase().includes(search) ||
        tenant.slug.toLowerCase().includes(search)
      );
    }
    
    if (filterPlan) {
      match = match && tenant.plan === filterPlan;
    }
    
    if (filterActive !== undefined) {
      match = match && tenant.is_active === filterActive;
    }
    
    return match;
  });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Dashboard Plateforme
          </h1>
          <p className="text-gray-600 mt-1">Vue d&apos;ensemble de l&apos;activité TARGETYM AI</p>
        </div>
        <Link 
          href="/dashboard/platform-admin/users"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          Gérer les Users
        </Link>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tenants */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <Building2 className="w-8 h-8 text-blue-500" />
              <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                +{stats.new_tenants_this_month} ce mois
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total_tenants}</p>
            <p className="text-sm text-gray-600 mt-1">Entreprises</p>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {stats.active_tenants} actifs
              </span>
              <span className="text-yellow-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {stats.trial_tenants} trial
              </span>
            </div>
          </div>
          
          {/* Users */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-purple-500" />
              <span className="text-xs text-gray-500 bg-purple-50 px-2 py-1 rounded">
                +{stats.new_users_this_month} ce mois
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total_users}</p>
            <p className="text-sm text-gray-600 mt-1">Utilisateurs</p>
            <div className="mt-3 text-xs text-gray-600">
              <span className="text-green-600">{stats.active_users} actifs</span>
            </div>
          </div>
          
          {/* Employés */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total_employees}</p>
            <p className="text-sm text-gray-600 mt-1">Employés</p>
          </div>
          
          {/* Activité */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total_messages_today}</p>
            <p className="text-sm text-gray-600 mt-1">Messages IA aujourd&apos;hui</p>
            <div className="mt-3 text-xs text-gray-600">
              <span>{stats.total_leave_requests_pending} demandes de congé en attente</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Tenants List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Entreprises Clientes</h2>
          
          {/* Filtres */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email, slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les plans</option>
              <option value="trial">Trial</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
            
            <select
              value={filterActive === undefined ? '' : filterActive.toString()}
              onChange={(e) => setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
            </select>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employés</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucune entreprise trouvée
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{tenant.name}</p>
                        <p className="text-sm text-gray-500">{tenant.email}</p>
                        <p className="text-xs text-gray-400">/{tenant.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeClass(tenant.plan)}`}>
                        {tenant.plan}
                      </span>
                      {tenant.is_trial && (
                        <span className="ml-1 text-xs text-yellow-600">(trial)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {tenant.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{tenant.users_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {tenant.employees_count} / {tenant.max_employees}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showTips && (
        <PageTourTips
          tips={platformAdminTips}
          onDismiss={dismissTips}
          pageTitle="Dashboard Plateforme"
        />
      )}
    </div>
  );
}
