'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  AlertTriangle, Calendar, Loader2, Shield, FileText, Users, User,
  Download, FileCheck
} from 'lucide-react';
import { fetchWithAuth, API_URL } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nContext';

async function apiFetch(path: string) {
  const res = await fetchWithAuth(`${API_URL}${path}`, {});
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function getUser(): { role: string; employee_id?: number } | null {
  try {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function isManagerRole(role: string): boolean {
  return ['admin', 'rh', 'manager', 'dg', 'dga', 'drh'].includes(role.toLowerCase());
}

interface SanctionItem {
  id: number;
  employee_id?: number;
  employee_name?: string | null;
  type: string;
  date: string;
  reason: string;
  notes: string | null;
  status: string;
  issued_by: string | null;
  created_at: string | null;
}

interface PolicyInfo {
  exists: boolean;
  file_name?: string;
  file_size?: number;
  uploaded_at?: string;
}

const SANCTION_TYPES: Record<string, { icon: string; color: string }> = {
  'Avertissement':    { icon: '\u26a0\ufe0f', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'Bl\u00e2me':              { icon: '\ud83d\udccb', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'Mise \u00e0 pied':       { icon: '\ud83d\udeab', color: 'bg-red-100 text-red-800 border-red-200' },
  'R\u00e9trogradation':    { icon: '\u2b07\ufe0f', color: 'bg-red-100 text-red-800 border-red-200' },
  'Licenciement':     { icon: '\u274c', color: 'bg-red-200 text-red-900 border-red-300' },
  'Rappel \u00e0 l\'ordre': { icon: '\ud83d\udcdd', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Autre':            { icon: '\ud83d\udcc4', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

// ============================================
// Sanction Card Component
// ============================================
function SanctionCard({ s, showEmployee }: { s: SanctionItem; showEmployee?: boolean }) {
  const { t } = useI18n();
  const ts = t.mySpace.sanctions;
  const typeInfo = SANCTION_TYPES[s.type] || SANCTION_TYPES['Autre'];
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${typeInfo.color}`}>
              <span>{typeInfo.icon}</span>
              {s.type}
            </span>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          {showEmployee && s.employee_name && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-3 h-3 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-gray-700">{s.employee_name}</span>
            </div>
          )}
          <p className="text-sm text-gray-800 font-medium">{s.reason}</p>
          {s.notes && (
            <p className="text-xs text-gray-500 mt-2 italic">{s.notes}</p>
          )}
        </div>
      </div>
      {s.issued_by && (
        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          {ts.issuedBy} : {s.issued_by}
        </p>
      )}
    </div>
  );
}

// ============================================
// Policy Banner Component
// ============================================
function PolicyBanner({ policyInfo, onDownload, isDownloading }: {
  policyInfo: PolicyInfo | null;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  const { t } = useI18n();
  const ts = t.mySpace.sanctions;
  if (!policyInfo?.exists) return null;
  return (
    <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <FileCheck className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-indigo-900">{ts.sanctionsPolicy}</p>
          <p className="text-xs text-indigo-600 mt-0.5">{policyInfo.file_name}</p>
        </div>
      </div>
      <button
        onClick={onDownload}
        disabled={isDownloading}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {ts.download}
      </button>
    </div>
  );
}

// ============================================
// Main Component
// ============================================
export default function MySanctionsPage() {
  const { t } = useI18n();
  const ts = t.mySpace.sanctions;
  const [activeTab, setActiveTab] = useState<'mine' | 'team'>('mine');
  const [sanctions, setSanctions] = useState<SanctionItem[]>([]);
  const [teamSanctions, setTeamSanctions] = useState<SanctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [, setUserRole] = useState('');
  const [showTeamTab, setShowTeamTab] = useState(false);
  const [policyInfo, setPolicyInfo] = useState<PolicyInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Get user info
  useEffect(() => {
    const u = getUser();
    if (u) {
      const role = u.role?.toLowerCase() || 'employee';
      setUserRole(role);
      setShowTeamTab(isManagerRole(role));
    }
  }, []);

  // Load own sanctions
  const loadSanctions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/sanctions/?mine=true');
      setSanctions(data.items || []);
    } catch {
      setSanctions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load team sanctions (for managers)
  const loadTeamSanctions = useCallback(async () => {
    setIsLoadingTeam(true);
    try {
      const data = await apiFetch('/api/sanctions/?limit=200&team_only=true');
      setTeamSanctions(data.items || []);
    } catch {
      setTeamSanctions([]);
    } finally {
      setIsLoadingTeam(false);
    }
  }, []);

  // Load policy info
  const loadPolicyInfo = useCallback(async () => {
    try {
      const data = await apiFetch('/api/sanctions/policy/info');
      setPolicyInfo(data);
    } catch {
      setPolicyInfo(null);
    }
  }, []);

  useEffect(() => { loadSanctions(); loadPolicyInfo(); }, [loadSanctions, loadPolicyInfo]);

  // Load team sanctions when tab is selected
  useEffect(() => {
    if (activeTab === 'team' && showTeamTab && teamSanctions.length === 0) {
      loadTeamSanctions();
    }
  }, [activeTab, showTeamTab, teamSanctions.length, loadTeamSanctions]);

  // Download policy PDF
  const handleDownloadPolicy = async () => {
    setIsDownloading(true);
    try {
      const data = await apiFetch('/api/sanctions/policy/download');
      const byteChars = atob(data.file_data);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mime_type || 'application/pdf' });
      const { downloadFile } = await import('@/lib/capacitor-plugins');
      await downloadFile(blob, data.file_name || 'politique-sanctions.pdf', data.mime_type || 'application/pdf');
    } catch {
      // silent fail
    } finally {
      setIsDownloading(false);
    }
  };

  const currentList = activeTab === 'mine' ? sanctions : teamSanctions;
  const currentLoading = activeTab === 'mine' ? isLoading : isLoadingTeam;

  return (
    <>
      <Header title={ts.title} />
      <main className="p-6 max-w-4xl mx-auto">
        {/* Info banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-3">
          <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{ts.disciplinaryRecord}</p>
            <p className="mt-1 text-blue-600">
              {ts.disciplinaryDescription}
            </p>
          </div>
        </div>

        {/* Policy download banner */}
        <PolicyBanner
          policyInfo={policyInfo}
          onDownload={handleDownloadPolicy}
          isDownloading={isDownloading}
        />

        {/* Tabs (only if manager) */}
        {showTeamTab && (
          <div className="mb-6 flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('mine')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'mine'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              {ts.mySanctions}
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'team'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              {ts.myTeam}
            </button>
          </div>
        )}

        {/* Content */}
        {currentLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700">
              {activeTab === 'mine' ? ts.noSanction : ts.noTeamSanction}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'mine' ? ts.cleanRecord : ts.noTeamRecord}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <span className="text-2xl font-bold text-gray-900">{currentList.length}</span>
                <span className="text-sm text-gray-500 ml-2">
                  {currentList.length > 1 ? ts.sanctionCountPlural : ts.sanctionCount} {currentList.length > 1 ? ts.registeredPlural : ts.registered}
                </span>
              </div>
            </div>

            {/* List */}
            {currentList.map((s) => (
              <SanctionCard key={s.id} s={s} showEmployee={activeTab === 'team'} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
