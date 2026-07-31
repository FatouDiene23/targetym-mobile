'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Link2, Unlink, Users as UsersIcon, X, Check, Loader2, UserPlus, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import Header from '@/components/Header';
import SearchableSelect from '@/components/SearchableSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useI18n } from '@/lib/i18n/I18nContext';
import { useAuth } from '@/context/AuthContext';
import {
  getTenantUsers,
  updateTenantUserRole,
  linkEmployeeToUser,
  unlinkEmployeeFromUser,
  getEmployees,
  createEmployee,
  getDepartments,
  type TenantUser,
  type Employee,
  type Department,
  type EmployeeCreate,
} from '@/lib/api';
import CustomSelect from '@/components/CustomSelect';

const PAGE_SIZE = 10;

const ROLE_OPTIONS = [
  'admin',
  'rh',
  'dg',
  'manager',
  'employee',
  'recruiter',
  'viewer',
  'cabinet',
];

const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  rh: 'bg-purple-100 text-purple-700',
  dg: 'bg-indigo-100 text-indigo-700',
  manager: 'bg-blue-100 text-blue-700',
  employee: 'bg-gray-100 text-gray-700',
  recruiter: 'bg-amber-100 text-amber-700',
  viewer: 'bg-slate-100 text-slate-600',
  cabinet: 'bg-emerald-100 text-emerald-700',
  super_admin: 'bg-pink-100 text-pink-700',
};

function getInitials(first?: string, last?: string, email?: string): string {
  const f = first?.trim()?.[0] || '';
  const l = last?.trim()?.[0] || '';
  if (f || l) return `${f}${l}`.toUpperCase();
  return (email?.[0] || '?').toUpperCase();
}

export default function SettingsUsersPage() {
  const { t } = useI18n();
  const { user: authUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const userRole = authUser?.role?.toLowerCase();
  const isAuthorized = userRole === 'admin' || userRole === 'rh' || userRole === 'dg' || userRole === 'super_admin';

  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Smart-link panel state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [employeesAvailable, setEmployeesAvailable] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  // Mode d'opération dans le panneau : 'existing' (SearchableSelect) ou 'create' (mini-formulaire)
  const [linkMode, setLinkMode] = useState<'existing' | 'create'>('existing');
  // Si un employé existe déjà avec le même email que le user → pré-suggéré
  const [emailMatch, setEmailMatch] = useState<Employee | null>(null);
  // Form de création de fiche minimale
  const [newEmpFirstName, setNewEmpFirstName] = useState('');
  const [newEmpLastName, setNewEmpLastName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpDepartmentId, setNewEmpDepartmentId] = useState<string>('');
  const [newEmpJobTitle, setNewEmpJobTitle] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);

  // Confirm dialog délier
  const [unlinkTarget, setUnlinkTarget] = useState<TenantUser | null>(null);

  // Garde-fou : redirection si non autorisé
  useEffect(() => {
    if (authUser && !isAuthorized) {
      router.replace('/dashboard');
    }
  }, [authUser, isAuthorized, router]);

  useEffect(() => {
    const initialSearch = searchParams.get('search');
    if (initialSearch) setSearch(initialSearch);
  }, [searchParams]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, roleFilter]);

  // Charger les users
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantUsers({
        search: search || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Debounce recherche
  useEffect(() => {
    if (!isAuthorized) return;
    const timer = setTimeout(() => { loadUsers(); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, isAuthorized]);

  // Charger les employés sans user lié quand on ouvre le formulaire
  const loadAvailableEmployees = async () => {
    setEmployeesLoading(true);
    try {
      // On charge tous les employés actifs du tenant puis on filtre côté client
      // ceux déjà liés à un user (présents dans `users`).
      const linkedEmpIds = new Set(users.map(u => u.employee_id).filter((id): id is number => !!id));
      const response = await getEmployees({ page: 1, page_size: 500 });
      const available = (response.items || []).filter(e => !linkedEmpIds.has(e.id));
      setEmployeesAvailable(available);
    } catch (err) {
      console.error(err);
      setEmployeesAvailable([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const openLinkForm = async (user: TenantUser) => {
    setEditingUserId(user.id);
    setSelectedEmployeeId('');
    setLinkMode('existing');
    // Pré-remplir le mini-formulaire de création avec les infos du user
    setNewEmpFirstName(user.first_name || '');
    setNewEmpLastName(user.last_name || '');
    setNewEmpEmail(user.email);
    setNewEmpDepartmentId('');
    setNewEmpJobTitle('');
    await loadAvailableEmployees();
    // Détecter un employé déjà présent avec le MÊME email (non lié)
    const linkedEmpIds = new Set(users.map(u => u.employee_id).filter((id): id is number => !!id));
    try {
      const response = await getEmployees({ page: 1, page_size: 500 });
      const match = (response.items || []).find(
        e => e.email?.toLowerCase() === user.email.toLowerCase() && !linkedEmpIds.has(e.id),
      );
      setEmailMatch(match || null);
    } catch {
      setEmailMatch(null);
    }
    // Charger les départements (1 seule fois si vide)
    if (departments.length === 0) {
      try {
        const depts = await getDepartments();
        setDepartments(depts || []);
      } catch {
        setDepartments([]);
      }
    }
  };

  const closeLinkForm = () => {
    setEditingUserId(null);
    setSelectedEmployeeId('');
    setEmailMatch(null);
    setLinkMode('existing');
  };

  const handleLink = async () => {
    if (!editingUserId || !selectedEmployeeId) return;
    setSubmitting(true);
    try {
      await linkEmployeeToUser(editingUserId, Number(selectedEmployeeId));
      toast.success(t.settings.usersAdmin.linkSuccess);
      closeLinkForm();
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  // Lier directement le match par email (suggestion automatique)
  const handleLinkEmailMatch = async () => {
    if (!editingUserId || !emailMatch) return;
    setSubmitting(true);
    try {
      await linkEmployeeToUser(editingUserId, emailMatch.id);
      toast.success(t.settings.usersAdmin.linkSuccess);
      closeLinkForm();
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  // Créer une fiche minimale puis la lier au user
  const handleCreateAndLink = async () => {
    if (!editingUserId) return;
    if (!newEmpFirstName.trim() || !newEmpLastName.trim()) {
      toast.error(t.settings.usersAdmin.firstName + ' / ' + t.settings.usersAdmin.lastName);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        first_name: newEmpFirstName.trim(),
        last_name: newEmpLastName.trim(),
        email: newEmpEmail.trim(),
        department_id: newEmpDepartmentId ? Number(newEmpDepartmentId) : undefined,
        job_title: newEmpJobTitle.trim() || undefined,
        role: 'employee',
        status: 'active',
      } as unknown as EmployeeCreate;
      const newEmp = await createEmployee(payload);
      await linkEmployeeToUser(editingUserId, newEmp.id);
      toast.success(t.settings.usersAdmin.linkSuccess);
      closeLinkForm();
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkConfirm = async () => {
    if (!unlinkTarget) return;
    setSubmitting(true);
    try {
      await unlinkEmployeeFromUser(unlinkTarget.id);
      toast.success(t.settings.usersAdmin.unlinkSuccess);
      setUnlinkTarget(null);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: number, role: string) => {
    setSubmitting(true);
    try {
      await updateTenantUserRole(userId, role);
      toast.success(t.settings.usersAdmin.roleUpdated ?? 'Rôle mis à jour');
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  // Pagination client-side (l'endpoint retourne tous les users du tenant)
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paginatedUsers = useMemo(
    () => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [users, page]
  );

  if (!isAuthorized) {
    return (
      <>
        <Header title={t.settings.usersAdmin.title} subtitle={t.settings.usersAdmin.subtitle} />
        <main className="flex-1 p-6" />
      </>
    );
  }

  return (
    <>
      <Header title={t.settings.usersAdmin.title} subtitle={t.settings.usersAdmin.subtitle} />
      <main className="flex-1 p-6 overflow-auto">
        <button
          type="button"
          onClick={() => router.push('/dashboard/settings')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t.common.back}
        </button>
        {/* Barre de filtres */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.settings.usersAdmin.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <CustomSelect
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: '', label: t.settings.usersAdmin.allRoles },
                ...ROLE_OPTIONS.map(r => ({ value: r, label: r.toUpperCase() })),
              ]}
              className="w-full sm:w-48"
            />
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-600">{error}</div>
          ) : paginatedUsers.length === 0 ? (
            <div className="p-12 text-center">
              <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">{t.settings.usersAdmin.noUsers}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">{t.settings.usersAdmin.columnUser}</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">{t.settings.usersAdmin.columnRole}</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600">{t.settings.usersAdmin.columnEmployee}</th>
                    <th className="text-right px-5 py-3 text-sm font-semibold text-gray-600">{t.settings.usersAdmin.columnActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                            {getInitials(u.first_name, u.last_name, u.email)}
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">
                              {(u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                            </p>
                            <p className="text-sm text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-2">
                          <span className={`w-fit px-2 py-1 text-xs font-medium rounded-full ${ROLE_BADGE_CLASSES[u.role?.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                            {u.role?.toUpperCase()}
                          </span>
                          <CustomSelect
                            value={u.role?.toLowerCase() ?? 'employee'}
                            onChange={(v) => handleRoleChange(u.id, v)}
                            disabled={submitting || u.role?.toLowerCase() === 'super_admin'}
                            options={ROLE_OPTIONS.map((role) => ({ value: role, label: role.toUpperCase() }))}
                            className="w-40"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {u.employee_id && u.employee_name ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            {t.settings.usersAdmin.linkedTo.replace('{name}', u.employee_name)}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {t.settings.usersAdmin.noEmployee}
                          </span>
                        )}
                        {/* Smart-link panel */}
                        {editingUserId === u.id && (
                          <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                            {/* Suggestion automatique si email match */}
                            {emailMatch && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800">
                                  {t.settings.usersAdmin.employeeFoundSameEmail.replace(
                                    '{name}',
                                    `${emailMatch.first_name} ${emailMatch.last_name}`.trim(),
                                  )}
                                </p>
                                <p className="text-xs text-amber-700 mt-1">{t.settings.usersAdmin.linkAutoConfirm}</p>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    onClick={handleLinkEmailMatch}
                                    disabled={submitting}
                                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                                  >
                                    {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                                    {t.settings.usersAdmin.linkAuto}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Onglets : existant vs nouvelle fiche */}
                            <div className="flex gap-2 border-b border-gray-200">
                              <button
                                onClick={() => setLinkMode('existing')}
                                className={`px-3 py-1.5 -mb-px text-xs font-medium border-b-2 transition-colors ${linkMode === 'existing' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                              >
                                {t.settings.usersAdmin.linkExisting}
                              </button>
                              <button
                                onClick={() => setLinkMode('create')}
                                className={`px-3 py-1.5 -mb-px text-xs font-medium border-b-2 transition-colors ${linkMode === 'create' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                              >
                                {t.settings.usersAdmin.createAndLink}
                              </button>
                            </div>

                            {/* Mode existant : SearchableSelect */}
                            {linkMode === 'existing' && (
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-[260px]">
                                  <SearchableSelect
                                    value={selectedEmployeeId}
                                    onChange={(v) => setSelectedEmployeeId(v)}
                                    placeholder={t.settings.usersAdmin.employeeSelectPlaceholder}
                                    options={employeesAvailable.map(emp => ({
                                      value: String(emp.id),
                                      label: `${emp.first_name} ${emp.last_name}`,
                                      subtitle: [emp.job_title, emp.department_name].filter(Boolean).join(' • ') || undefined,
                                    }))}
                                  />
                                  {!employeesLoading && employeesAvailable.length === 0 && (
                                    <p className="text-xs text-gray-400 mt-1">{t.settings.usersAdmin.noEmployeeAvailable}</p>
                                  )}
                                </div>
                                <button
                                  onClick={handleLink}
                                  disabled={!selectedEmployeeId || submitting}
                                  className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                                  title={t.settings.usersAdmin.confirm}
                                >
                                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={closeLinkForm}
                                  disabled={submitting}
                                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                  title={t.settings.usersAdmin.cancel}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {/* Mode création : mini-formulaire */}
                            {linkMode === 'create' && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-600">{t.settings.usersAdmin.createMinimalProfile}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={newEmpFirstName}
                                    onChange={(e) => setNewEmpFirstName(e.target.value)}
                                    placeholder={t.settings.usersAdmin.firstName}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={newEmpLastName}
                                    onChange={(e) => setNewEmpLastName(e.target.value)}
                                    placeholder={t.settings.usersAdmin.lastName}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                  />
                                  <input
                                    type="email"
                                    value={newEmpEmail}
                                    readOnly
                                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500 md:col-span-2"
                                  />
                                  <SearchableSelect
                                    value={newEmpDepartmentId}
                                    onChange={(v) => setNewEmpDepartmentId(v)}
                                    placeholder={t.settings.usersAdmin.selectDepartment}
                                    options={departments.map(d => ({
                                      value: String(d.id),
                                      label: d.parent_id ? `  ↳ ${d.name}` : d.name,
                                    }))}
                                  />
                                  <input
                                    type="text"
                                    value={newEmpJobTitle}
                                    onChange={(e) => setNewEmpJobTitle(e.target.value)}
                                    placeholder={t.settings.usersAdmin.jobTitle}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={handleCreateAndLink}
                                    disabled={!newEmpFirstName.trim() || !newEmpLastName.trim() || submitting}
                                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                                  >
                                    {submitting
                                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t.settings.usersAdmin.creating}</>
                                      : <><UserPlus className="w-3.5 h-3.5 mr-1.5" />{t.settings.usersAdmin.createAndLink}</>
                                    }
                                  </button>
                                  <button
                                    onClick={closeLinkForm}
                                    disabled={submitting}
                                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
                                  >
                                    {t.settings.usersAdmin.cancel}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {u.employee_id ? (
                          <button
                            onClick={() => setUnlinkTarget(u)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50"
                          >
                            <Unlink className="w-4 h-4 mr-1.5" />
                            {t.settings.usersAdmin.unlink}
                          </button>
                        ) : editingUserId !== u.id ? (
                          <button
                            onClick={() => openLinkForm(u)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100"
                          >
                            <Link2 className="w-4 h-4 mr-1.5" />
                            {t.settings.usersAdmin.linkEmployee}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {t.settings.usersAdmin.page} {page}/{totalPages} • {users.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  {t.settings.usersAdmin.previous}
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  {t.settings.usersAdmin.next}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        isOpen={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={handleUnlinkConfirm}
        title={t.settings.usersAdmin.unlinkConfirmTitle}
        message={t.settings.usersAdmin.unlinkConfirm}
        confirmText={t.settings.usersAdmin.confirm}
        cancelText={t.settings.usersAdmin.cancel}
        danger
      />
    </>
  );
}
