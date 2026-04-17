'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users, UserPlus, Building2, TrendingUp, Briefcase, ArrowLeftRight,
  ChevronRight, RefreshCw, AlertCircle, UserCheck, BarChart3,
  CheckCircle2, Clock, X,
} from 'lucide-react';
import {
  getGroupViewRecruitment, getGroupViewPersonnel, getGroupViewMobility,
  type GroupRecruitmentView, type GroupPersonnelView, type GroupMobilityView,
  type GroupKeyEmployee,
} from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TAB IDs
// ============================================
type TabId = 'recruitment' | 'personnel' | 'mobility';

// TABS are built inside the component to access translations

// ============================================
// KPI CARD
// ============================================
function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ============================================
// BADGE
// ============================================
const BADGE_COLORS: Record<string, string> = {
  CODIR: 'bg-purple-100 text-purple-700 border-purple-200',
  Direction: 'bg-amber-100 text-amber-700 border-amber-200',
  'Chef dpt': 'bg-teal-100 text-teal-700 border-teal-200',
};

function Badge({ label }: { label: string }) {
  const cls = BADGE_COLORS[label] || 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ============================================
// AVATAR
// ============================================
function Avatar({ name, photoUrl, size = 10 }: { name: string; photoUrl?: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 font-semibold text-sm`}>
      {initials}
    </div>
  );
}

// ============================================
// SUBSIDIARY TABLE ROW
// ============================================
function SubRow({ cells }: { cells: (string | number)[] }) {
  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
      {cells.map((c, i) => (
        <td key={i} className={`px-4 py-3 text-sm ${i === 0 ? 'font-medium text-gray-800' : 'text-gray-600 text-right'}`}>
          {c}
        </td>
      ))}
    </tr>
  );
}

// ============================================
// KEY EMPLOYEE CARD
// ============================================
function KeyEmployeeCard({ emp }: { emp: GroupKeyEmployee }) {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <Avatar name={`${emp.first_name} ${emp.last_name}`} photoUrl={emp.photo_url} size={12} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{emp.first_name} {emp.last_name}</p>
          {emp.title && <p className="text-xs text-gray-500 truncate">{emp.title}</p>}
          <p className="text-xs text-teal-600 font-medium truncate mt-0.5">{emp.subsidiary_name}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {emp.badges.map(b => <Badge key={b} label={b} />)}
      </div>
      {(emp.salary_category || emp.salaire_brut != null) && (
        <div className="text-xs text-gray-500 border-t border-gray-50 pt-2">
          {emp.salaire_brut != null
            ? <><span className="font-medium text-gray-700">{t.groups.salary} : </span>{emp.salaire_brut.toLocaleString('fr-FR')} XOF</>
            : emp.salary_category && <><span className="font-medium text-gray-700">{t.groups.category} : </span>{emp.salary_category}</>
          }
        </div>
      )}
    </div>
  );
}

// ============================================
// TRANSFER STATUS BADGE
// ============================================
function TransferStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> {t.groups.completed}
    </span>
  );
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> {t.groups.pending}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
      {status}
    </span>
  );
}

// ============================================
// RECRUITMENT TAB
// ============================================
function RecruitmentTab({ data }: { data: GroupRecruitmentView }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label={t.groups.openPositions} value={data.total_open_jobs} icon={Briefcase} color="bg-indigo-100 text-indigo-600" />
        <KpiCard label={t.groups.applications} value={data.total_applications} icon={UserPlus} color="bg-teal-100 text-teal-600" />
        <KpiCard label={t.groups.hiredFinalized} value={data.total_hired} icon={UserCheck} color="bg-green-100 text-green-600" />
        <KpiCard label={t.groups.conversionRate} value={`${data.overall_conversion_rate}%`} icon={BarChart3} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Table par filiale */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{t.groups.detailBySubsidiary}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {[t.groups.subsidiary, t.groups.openPositions, t.groups.applications, t.groups.inProgress, t.groups.hired, t.groups.conversion].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.subsidiaries.map(s => (
                <SubRow
                  key={s.subsidiary_id}
                  cells={[
                    s.subsidiary_name,
                    s.open_jobs,
                    s.total_applications,
                    s.in_progress_applications,
                    s.hired,
                    `${s.conversion_rate}%`,
                  ]}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EMPLOYEE DETAIL DRAWER
// ============================================
function EmployeeDetailDrawer({ emp, onClose }: { emp: GroupKeyEmployee; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{t.groups.employeeProfile}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-4">
          <Avatar name={`${emp.first_name} ${emp.last_name}`} photoUrl={emp.photo_url} size={20} />
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900">{emp.first_name} {emp.last_name}</h3>
            {emp.title && <p className="text-sm text-gray-500 mt-1">{emp.title}</p>}
            <p className="text-sm text-teal-600 font-medium mt-1">{emp.subsidiary_name}</p>
          </div>
          {emp.badges.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {emp.badges.map(b => <Badge key={b} label={b} />)}
            </div>
          )}
          {(emp.salary_category || emp.salaire_brut != null) && (
            <div className="w-full bg-gray-50 rounded-xl p-4 text-sm">
              <p className="font-medium text-gray-700 mb-1">{t.groups.remuneration}</p>
              {emp.salaire_brut != null
                ? <p className="text-gray-600">{emp.salaire_brut.toLocaleString('fr-FR')} XOF {t.groups.perMonth}</p>
                : <p className="text-gray-600">{t.groups.category} : {emp.salary_category}</p>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// PERSONNEL TAB
// ============================================
function PersonnelTab({ data, onSelectEmployee }: { data: GroupPersonnelView; onSelectEmployee: (emp: GroupKeyEmployee) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label={t.groups.activeEmployees} value={data.total_active_employees} sub={t.groups.ofTotal.replace('{n}', String(data.total_employees))} icon={Users} color="bg-teal-100 text-teal-600" />
        <KpiCard label={t.groups.totalEmployees} value={data.total_employees} icon={Building2} color="bg-indigo-100 text-indigo-600" />
        <KpiCard label={t.groups.pendingLeaves} value={data.total_pending_leaves} icon={Clock} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Collaborateurs clés */}
      {data.key_employees.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">
            {t.groups.keyEmployees}
            <span className="ml-2 text-xs font-normal text-gray-400">({data.key_employees.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.key_employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => onSelectEmployee(emp)}
                className="text-left w-full focus:outline-none focus:ring-2 focus:ring-teal-400 rounded-2xl hover:scale-[1.02] transition-transform"
              >
                <KeyEmployeeCard emp={emp} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table par filiale */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{t.groups.staffBySubsidiary}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {[t.groups.subsidiary, t.groups.active, t.common.total, t.groups.pendingLeaves, t.groups.departments].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.subsidiaries.map(s => (
                <SubRow
                  key={s.subsidiary_id}
                  cells={[s.subsidiary_name, s.active_employees, s.total_employees, s.pending_leaves, s.departments_count]}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MOBILITY TAB
// ============================================
function MobilityTab({ data }: { data: GroupMobilityView; onInitiateTransfer: () => void }) {
  const { t, locale } = useI18n();
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'fr-FR';
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label={t.groups.pendingTransfers} value={data.pending_transfers} icon={Clock} color="bg-amber-100 text-amber-600" />
        <KpiCard label={t.groups.completedTransfers} value={data.completed_transfers} icon={CheckCircle2} color="bg-green-100 text-green-600" />
        <KpiCard label={t.groups.totalTransfers} value={data.total_transfers} icon={ArrowLeftRight} color="bg-indigo-100 text-indigo-600" />
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{t.groups.transferHistory}</h3>
        </div>
        {data.transfers.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {t.groups.noTransfer}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {[t.groups.employee, t.groups.from, t.groups.to, t.groups.date, t.groups.reason, t.groups.statusLabel].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 0 ? 'text-left' : i === 5 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transfers.map(tr => (
                  <tr key={tr.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={tr.employee_name} photoUrl={tr.photo_url} size={8} />
                        <span className="text-sm font-medium text-gray-800">{tr.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tr.from_subsidiary}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      {tr.to_subsidiary}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {tr.transfer_date ? new Date(tr.transfer_date).toLocaleDateString(dateLocale) : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">{tr.reason || '\u2014'}</td>
                    <td className="px-4 py-3 text-center"><TransferStatusBadge status={tr.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================
export default function GroupViewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const activeTab: TabId = (searchParams.get('tab') as TabId | null) ?? 'recruitment';
  const setActiveTab = (tab: TabId) => router.push(`/dashboard/groups/view?tab=${tab}`);

  const TABS: { id: TabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'recruitment', label: t.groups.recruitment, icon: UserPlus },
    { id: 'personnel', label: t.groups.personnel, icon: Users },
    { id: 'mobility', label: t.groups.mobility, icon: ArrowLeftRight },
  ];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recruitmentData, setRecruitmentData] = useState<GroupRecruitmentView | null>(null);
  const [personnelData, setPersonnelData] = useState<GroupPersonnelView | null>(null);
  const [mobilityData, setMobilityData] = useState<GroupMobilityView | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<GroupKeyEmployee | null>(null);

  const loadTab = useCallback(async (tab: TabId) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'recruitment' && !recruitmentData) {
        setRecruitmentData(await getGroupViewRecruitment());
      } else if (tab === 'personnel' && !personnelData) {
        setPersonnelData(await getGroupViewPersonnel());
      } else if (tab === 'mobility') {
        setMobilityData(await getGroupViewMobility());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.groups.loadingError);
    } finally {
      setLoading(false);
    }
  }, [recruitmentData, personnelData, mobilityData]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'recruitment') setRecruitmentData(await getGroupViewRecruitment());
      else if (activeTab === 'personnel') setPersonnelData(await getGroupViewPersonnel());
      else if (activeTab === 'mobility') setMobilityData(await getGroupViewMobility());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.groups.error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  const groupName = recruitmentData?.group_name || personnelData?.group_name || mobilityData?.group_name || t.groups.group;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.groups.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{groupName} — {t.groups.consolidatedData}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t.groups.refresh}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-28 animate-pulse bg-gradient-to-r from-gray-100 to-gray-50" />
          ))}
        </div>
      )}

      {/* Tab content */}
      {!loading && (
        <>
          {activeTab === 'recruitment' && recruitmentData && (
            <RecruitmentTab data={recruitmentData} />
          )}
          {activeTab === 'personnel' && personnelData && (
            <PersonnelTab data={personnelData} onSelectEmployee={setSelectedEmployee} />
          )}
          {activeTab === 'mobility' && mobilityData && (
            <MobilityTab data={mobilityData} onInitiateTransfer={() => {}} />
          )}
        </>
      )}

      {/* Employee detail drawer */}
      {selectedEmployee && (
        <EmployeeDetailDrawer emp={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
    </div>
  );
}
