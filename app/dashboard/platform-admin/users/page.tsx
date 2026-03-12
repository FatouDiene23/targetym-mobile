'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Users, Search, Plus, Edit2, Trash2, Eye, EyeOff,
  CheckCircle2, XCircle, Building2, Shield, Mail, LogIn, ArrowLeft
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePageTour } from '@/hooks/usePageTour';
import PageTourTips from '@/components/PageTourTips';
import { platformAdminUsersTips } from '@/config/pageTips';
import {
  getAllUsers,
  getAllTenants,
  createPlatformUser,
  updatePlatformUser,
  deletePlatformUser,
  impersonateUser,
  type UserListItem,
  type TenantListItem,
  type UserCreateData,
  type UserUpdateData
} from '@/lib/api';

export default function PlatformUsersManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showTips, dismissTips } = usePageTour('platformAdminUsers');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterTenant, setFilterTenant] = useState<number | ''>('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  
  // Helper pour les couleurs de rôle
  const getRoleBadgeClass = (role: string) => {
    if (role === 'SUPER_ADMIN' || role === 'super_admin') return 'bg-purple-100 text-purple-800';
    if (role === 'admin') return 'bg-blue-100 text-blue-800';
    if (role === 'rh') return 'bg-green-100 text-green-800';
    if (role === 'manager') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [formData, setFormData] = useState<UserCreateData & { id?: number }>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee',
    is_active: true
  });
  const [showPassword, setShowPassword] = useState(false);
  
  // Auth guard + apply URL params
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

    // Lire tenant_id depuis l'URL (ex: depuis le modal tenant detail)
    const tenantIdParam = searchParams.get('tenant_id');
    if (tenantIdParam) {
      setFilterTenant(parseInt(tenantIdParam, 10));
    }

    loadData();
  }, [router, searchParams]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, tenantsData] = await Promise.all([
        getAllUsers({ limit: 500 }),
        getAllTenants({ limit: 500 })
      ]);
      
      setUsers(usersData);
      setTenants(tenantsData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };
  
  const handleImpersonate = (user: UserListItem) => {
    setConfirmDialog({
      isOpen: true,
      title: `Impersonner ${user.email} ?`,
      message: `Cette action sera loggée dans l'audit trail. Vous serez connecté en tant que cet utilisateur.`,
      danger: true,
      onConfirm: async () => {
        try {
          setImpersonating(user.id);
          const result = await impersonateUser(user.id);
          const currentToken = localStorage.getItem('access_token');
          const currentUser = localStorage.getItem('user');
          const currentUserObj = currentUser ? JSON.parse(currentUser) : null;
          localStorage.setItem('access_token_backup', currentToken || '');
          localStorage.setItem('user_backup', currentUser || '');
          localStorage.setItem('access_token', result.access_token);
          localStorage.setItem('user', JSON.stringify({
            id: result.impersonated_user_id,
            email: result.impersonated_user_email,
            first_name: result.first_name || '',
            last_name: result.last_name || '',
            role: result.employee_role || 'employee',
            is_manager: result.is_manager || false,
            tenant_id: result.impersonated_tenant_id,
          }));
          localStorage.setItem('is_impersonating', 'true');
          localStorage.setItem('impersonated_user_email', result.impersonated_user_email);
          localStorage.setItem('impersonated_by_email', currentUserObj?.email || 'admin');
          if (result.tenant_slug) localStorage.setItem('impersonated_tenant_slug', result.tenant_slug);
          toast.success(`Impersonation OK — token 30min. Redirection vers dashboard...`, { duration: 3000 });
          setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Erreur impersonation';
          toast.error(msg);
        } finally {
          setImpersonating(null);
        }
      },
    });
  };

  const handleOpenCreate = () => {    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'employee',
      is_active: true
    });
    setShowModal(true);
    setShowPassword(false);
  };
  
  const handleOpenEdit = (user: UserListItem) => {
    setEditingUser(user);
    setFormData({
      id: user.id,
      email: user.email,
      password: '', // Ne pas préremplir le mot de passe
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role,
      tenant_id: user.tenant_id,
      is_active: user.is_active
    });
    setShowModal(true);
    setShowPassword(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update
        const updateData: UserUpdateData = {
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          tenant_id: formData.tenant_id,
          is_active: formData.is_active
        };
        
        // Ajouter le mot de passe seulement s'il est fourni
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        await updatePlatformUser(editingUser.id, updateData);
        toast.success('Utilisateur mis à jour avec succès');
      } else {
        // Create
        if (!formData.password) {
          toast.error('Le mot de passe est obligatoire pour la création');
          return;
        }
        
        await createPlatformUser(formData as UserCreateData);
        toast.success('Utilisateur créé avec succès');
      }
      
      setShowModal(false);
      loadData();
    } catch (error: unknown) {
      console.error('Erreur:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'opération';
      toast.error(errorMessage);
    }
  };
  
  const handleDelete = async (user: UserListItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer l\'utilisateur',
      message: `Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.email} ?`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deletePlatformUser(user.id);
          toast.success('Utilisateur supprimé avec succès');
          loadData();
        } catch (error: unknown) {
          console.error('Erreur:', error);
          const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression';
          toast.error(errorMessage);
        }
      },
    });
  };
  
  const filteredUsers = users.filter(user => {
    let match = true;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const emailMatch = user.email.toLowerCase().includes(search);
      const firstNameMatch = user.first_name?.toLowerCase().includes(search) || false;
      const lastNameMatch = user.last_name?.toLowerCase().includes(search) || false;
      const tenantMatch = user.tenant_name?.toLowerCase().includes(search) || false;
      
      match = match && (emailMatch || firstNameMatch || lastNameMatch || tenantMatch);
    }
    
    if (filterRole) {
      match = match && user.role === filterRole;
    }
    
    if (filterTenant !== '') {
      match = match && user.tenant_id === filterTenant;
    }
    
    if (filterActive !== undefined) {
      const isActiveMatch = user.is_active === filterActive;
      match = match && isActiveMatch;
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
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/platform-admin" className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back-Office
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-gray-600 mt-1">Administration cross-tenant de tous les users</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          data-tour="platform-users-create"
        >
          <Plus className="w-4 h-4" />
          Créer un User
        </button>
      </div>
      
      {/* Filtres */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100" data-tour="platform-users-search">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, email, entreprise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les rôles</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="super_admin">super_admin</option>
            <option value="admin">Admin</option>
            <option value="rh">RH</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
          
          <select
            value={filterTenant}
            onChange={(e) => setFilterTenant(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
          >
            <option value="">Toutes les entreprises</option>
            <option value="0">Sans entreprise</option>
            {tenants.map(tenant => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
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
      
      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Actifs</p>
          <p className="text-2xl font-bold text-green-600">{users.filter(u => u.is_active).length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">Inactifs</p>
          <p className="text-2xl font-bold text-red-600">{users.filter(u => !u.is_active).length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600">SUPER_ADMIN</p>
          <p className="text-2xl font-bold text-purple-600">
            {users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'super_admin').length}
          </p>
        </div>
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" data-tour="platform-users-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière connexion</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                        {user.role === 'SUPER_ADMIN' || user.role === 'super_admin' ? (
                          <><Shield className="w-3 h-3 mr-1" />{user.role}</>
                        ) : user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.tenant_name ? (
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {user.tenant_name}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.last_login ? new Date(user.last_login).toLocaleString('fr-FR') : 'Jamais'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(user.role !== 'SUPER_ADMIN' && user.role !== 'super_admin') && (
                          <button
                            onClick={() => handleImpersonate(user)}
                            disabled={impersonating === user.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Impersonner (token 30min, loggué)"
                          >
                            {impersonating === user.id
                              ? <span className="text-xs">...</span>
                              : <LogIn className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingUser ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Mot de passe */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe {editingUser ? '(laisser vide pour ne pas changer)' : '*'}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {/* Prénom / Nom */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    id="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    id="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Rôle */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle *
                </label>
                <select
                  id="role"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="rh">RH</option>
                  <option value="admin">Admin</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
              
              {/* Tenant */}
              <div>
                <label htmlFor="tenant_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Entreprise
                </label>
                <select
                  id="tenant_id"
                  value={formData.tenant_id || ''}
                  onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value ? Number.parseInt(e.target.value, 10) : undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucune (cross-tenant)</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Actif */}
              <div className="flex items-center gap-2">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Compte actif
                </label>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingUser ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
        />
      )}

      {showTips && (
        <PageTourTips
          tips={platformAdminUsersTips}
          onDismiss={dismissTips}
          pageTitle="Gestion des Utilisateurs"
        />
      )}
    </div>
  );
}
