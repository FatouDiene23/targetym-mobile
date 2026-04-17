'use client';

import { useState, useEffect } from 'react';
import { Users, Shield, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/I18nContext';
import { activateLicense, suspendLicense, type LicenseStatus } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';

interface LicensesTabProps {
  data: LicenseStatus;
  onRefresh: () => void;
}

function LicenseProgressBar({ active, limit, t }: { active: number; limit: number; t: any }) {
  const pct = limit > 0 ? (active / limit) * 100 : 0;
  const color = pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
  const textColor = pct > 100 ? 'text-red-700' : pct >= 80 ? 'text-amber-700' : 'text-green-700';

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{t.licenses.progressLabel}</span>
        <span className={`text-sm font-bold ${textColor}`}>
          {active} / {limit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {pct > 100 && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {active - limit} {t.licenses.surplus.toLowerCase()}
        </p>
      )}
    </div>
  );
}

export default function LicensesTab({ data, onRefresh }: LicensesTabProps) {
  const { t } = useI18n();
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<{ id: number; name: string } | null>(null);
  const [activePage, setActivePage] = useState(1);
  const ACTIVE_PAGE_SIZE = 10;

  const suspendedEmployees = data.suspended_employees ?? [];
  const activeEmployees = data.active_employees ?? [];

  const totalActivePages = Math.ceil(activeEmployees.length / ACTIVE_PAGE_SIZE);
  const paginatedActiveEmployees = activeEmployees.slice(
    (activePage - 1) * ACTIVE_PAGE_SIZE,
    activePage * ACTIVE_PAGE_SIZE
  );

  useEffect(() => { setActivePage(1); }, [activeEmployees]);

  const handleActivate = async (employeeId: number) => {
    setLoadingAction(employeeId);
    try {
      await activateLicense(employeeId);
      toast.success(t.licenses.activated);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.licenses.limitReached);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSuspend = async (employeeId: number) => {
    setLoadingAction(employeeId);
    try {
      await suspendLicense(employeeId);
      toast.success(t.licenses.suspended);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoadingAction(null);
      setConfirmSuspend(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.licenses.plan}</p>
          <p className="text-lg font-bold text-gray-900 mt-1 capitalize">{data.plan}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.licenses.limit}</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{data.limit} {t.licenses.activeEmployees.toLowerCase()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.licenses.activeEmployees}</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{data.active_count}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.licenses.surplus}</p>
          <p className={`text-lg font-bold mt-1 ${data.surplus > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {data.surplus}
            {data.surplus > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {t.licenses.surplus}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Grace period info */}
      {data.grace_period_ends_at && !data.surplus_blocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {t.licenses.gracePeriodEnds}: <strong>{formatDate(data.grace_period_ends_at)}</strong>
          </p>
        </div>
      )}

      {/* Progress bar */}
      <LicenseProgressBar active={data.active_count} limit={data.limit} t={t} />

      {/* Suspended employees */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          <h3 className="text-base font-semibold text-gray-900">{t.licenses.suspendedEmployees}</h3>
          <span className="ml-auto bg-red-100 text-red-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {suspendedEmployees.length}
          </span>
        </div>
        {suspendedEmployees.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">{t.licenses.noSuspendedEmployees}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">{t.licenses.name}</th>
                  <th className="px-6 py-3">{t.licenses.email}</th>
                  <th className="px-6 py-3">{t.licenses.suspensionDate}</th>
                  <th className="px-6 py-3">{t.licenses.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suspendedEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{emp.email}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{formatDate(emp.suspended_at)}</td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleActivate(emp.id)}
                        disabled={loadingAction === emp.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        {loadingAction === emp.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {t.licenses.activate}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active employees */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" />
          <h3 className="text-base font-semibold text-gray-900">{t.licenses.activeList}</h3>
          <span className="ml-auto bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {activeEmployees.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">{t.licenses.name}</th>
                <th className="px-6 py-3">{t.licenses.email}</th>
                <th className="px-6 py-3">{t.licenses.position}</th>
                <th className="px-6 py-3">{t.licenses.addDate}</th>
                <th className="px-6 py-3">{t.licenses.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedActiveEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {emp.first_name} {emp.last_name}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{emp.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{emp.position || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{formatDate(emp.created_at)}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => setConfirmSuspend({ id: emp.id, name: `${emp.first_name} ${emp.last_name}` })}
                      disabled={loadingAction === emp.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {loadingAction === emp.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                      {t.licenses.suspend}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalActivePages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {(activePage - 1) * ACTIVE_PAGE_SIZE + 1}–{Math.min(activePage * ACTIVE_PAGE_SIZE, activeEmployees.length)} sur {activeEmployees.length} employés
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setActivePage(p => Math.max(1, p - 1))}
                disabled={activePage === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setActivePage(p => Math.min(totalActivePages, p + 1))}
                disabled={activePage === totalActivePages}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm suspend dialog */}
      {confirmSuspend && (
        <ConfirmDialog
          isOpen={true}
          title={t.licenses.suspend}
          message={t.licenses.suspendConfirm.replace('{name}', confirmSuspend.name)}
          confirmText={t.licenses.suspend}
          cancelText={t.common?.cancel || 'Annuler'}
          danger={true}
          onConfirm={() => handleSuspend(confirmSuspend.id)}
          onClose={() => setConfirmSuspend(null)}
        />
      )}
    </div>
  );
}
