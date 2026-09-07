'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, ShieldOff, Save, ArrowLeft, ChevronDown, ChevronRight,
  Sparkles, Users, CheckCircle2, AlertCircle, GraduationCap, BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import Header from '@/components/Header';
import AgentSkillsPanel from '@/components/AgentSkillsPanel';
import MyPlaybooksPanel from '@/components/MyPlaybooksPanel';
import { useCopilotAccess } from '@/hooks/useCopilotAccess';
import { useI18n } from '@/lib/i18n/I18nContext';
import {
  getAiPolicyCatalog,
  getAiTenantPolicy,
  updateAiTenantPolicy,
  getAiUserPolicy,
  updateAiUserPolicy,
  getTeamMembers,
  CopilotForbiddenError,
  type AiPolicyCatalog,
  type AiTenantPolicy,
  type AiUserPolicy,
  type AiPolicyDomainSetting,
  type TeamMember,
} from '@/lib/api';

// Plafonds proposés dans l'UI. N3 (plafond légal humain) est volontairement exclu.
const CAP_OPTIONS = ['N0', 'N1', 'N2'] as const;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Paramètres du copilote, organisés en sections (modèle des pages de réglages
 * de Claude / ChatGPT) :
 *
 *  - « Savoir-faire »  : procédures livrées, lecture seule, visibles par TOUS ;
 *  - « Mes procédures » : ce que l'utilisateur ou son entreprise a écrit ;
 *  - « Permissions »    : politique tenant/utilisateur, réservée à l'encadrement.
 *
 * La page est donc accessible à tout utilisateur du copilote ; seule la section
 * Permissions est fermée, et elle ne charge la politique que si le profil y a
 * droit (aucun appel voué à un 403).
 */
type SectionKey = 'skills' | 'procedures' | 'permissions';

/**
 * Section « Permissions » MASQUÉE (2026-08-04).
 *
 * Motif : sur les trois contrôles qu'elle propose, un seul est réellement
 * appliqué au runtime. `tool_overrides` est bien consommé (`_tool_disabled` dans
 * `tools/control.py`, utilisé par `effective_tools` et `decide_execution`), mais
 * la POSTURE et le tableau des DOMAINES ne sont lus par aucun point de contrôle.
 * Afficher un réglage qui ne change rien est pire que ne pas l'afficher.
 *
 * Réactivation : passer cette constante à `true` quand la posture et les
 * domaines seront réellement appliqués. Le code de la section est conservé tel
 * quel, rien n'a été supprimé.
 */
const SECTION_PERMISSIONS_VISIBLE = false;

export default function CopilotConfigPage() {
  const { t } = useI18n();
  const cfg = t.components.copilot.config;
  const nav = t.components.copilot.settingsNav;
  const { canUseCopilot, canConfigureCopilot } = useCopilotAccess();

  const [section, setSection] = useState<SectionKey>('skills');
  const [catalog, setCatalog] = useState<AiPolicyCatalog | null>(null);
  const [tenant, setTenant] = useState<AiTenantPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [cat, pol] = await Promise.all([getAiPolicyCatalog(), getAiTenantPolicy()]);
      setCatalog(cat);
      setTenant(pol);
    } catch (err) {
      if (err instanceof CopilotForbiddenError) setForbidden(true);
      else setLoadError(cfg.loadError);
    } finally {
      setLoading(false);
    }
  }, [cfg.loadError]);

  // La politique n'est chargée QUE si l'utilisateur ouvre la section Permissions
  // et qu'il y a droit : rien d'inutile au premier affichage.
  useEffect(() => {
    if (section === 'permissions' && canConfigureCopilot && catalog === null) void load();
  }, [section, canConfigureCopilot, catalog, load]);

  if (!canUseCopilot) {
    return (
      <div>
        <Header title={cfg.title} />
        <ForbiddenBlock label={cfg.forbidden} />
      </div>
    );
  }

  const sections: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
    { key: 'skills', label: nav.skills, icon: <GraduationCap size={15} /> },
    { key: 'procedures', label: nav.procedures, icon: <BookOpen size={15} /> },
    ...(SECTION_PERMISSIONS_VISIBLE && canConfigureCopilot
      ? [{ key: 'permissions' as SectionKey, label: nav.permissions, icon: <SlidersHorizontal size={15} /> }]
      : []),
  ];

  return (
    <div>
      <Header title={cfg.title} />
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{cfg.subtitle}</p>
          <Link
            href="/dashboard/copilot"
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
          >
            <ArrowLeft size={15} /> {cfg.backToCopilot}
          </Link>
        </div>

        {/* Navigation de sections — discrète, une seule ligne. */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-5 -mx-1 px-1 overflow-x-auto">
          {sections.map((s) => {
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition ${
                  active
                    ? 'border-primary-600 text-primary-700 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {s.icon} {s.label}
              </button>
            );
          })}
        </div>

        {section === 'skills' && <AgentSkillsPanel embedded />}
        {section === 'procedures' && <MyPlaybooksPanel embedded />}
        {section === 'permissions' && (
          forbidden ? (
            <ForbiddenBlock label={cfg.forbidden} />
          ) : loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-gray-400" size={28} />
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertCircle size={18} /> {loadError}
            </div>
          ) : catalog && tenant ? (
            <div className="space-y-6">
              <TenantSection catalog={catalog} tenant={tenant} setTenant={setTenant} />
              <UserSection catalog={catalog} />
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

/* ─── Section tenant ──────────────────────────────────────────────────────── */

function TenantSection({
  catalog,
  tenant,
  setTenant,
}: {
  catalog: AiPolicyCatalog;
  tenant: AiTenantPolicy;
  setTenant: (p: AiTenantPolicy) => void;
}) {
  const { t } = useI18n();
  const cfg = t.components.copilot.config;
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const save = async () => {
    setSaveState('saving');
    try {
      const updated = await updateAiTenantPolicy(tenant);
      setTenant(updated);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-6">
      {/* Interrupteur maître */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Sparkles size={18} className="text-primary-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{cfg.master.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{cfg.master.description}</p>
          </div>
        </div>
        <Toggle
          checked={tenant.agent_enabled}
          onChange={(v) => setTenant({ ...tenant, agent_enabled: v })}
          label={tenant.agent_enabled ? cfg.master.enabled : cfg.master.disabled}
        />
      </div>

      {/* Posture */}
      <PostureSelector
        postures={catalog.postures}
        value={tenant.posture}
        onChange={(p) => setTenant({ ...tenant, posture: p })}
      />

      {/* Domaines */}
      <DomainsTable
        catalog={catalog}
        domains={tenant.domains}
        onChange={(domains) => setTenant({ ...tenant, domains })}
      />

      <SaveBar saveState={saveState} onSave={save} />
    </div>
  );
}

/* ─── Section utilisateur (optionnelle) ───────────────────────────────────── */

function UserSection({ catalog }: { catalog: AiPolicyCatalog }) {
  const { t } = useI18n();
  const cfg = t.components.copilot.config;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selected, setSelected] = useState<number | ''>('');
  const [policy, setPolicy] = useState<AiUserPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    void getTeamMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  const selectUser = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setPolicy(null);
    try {
      setPolicy(await getAiUserPolicy(id));
    } catch {
      setError(cfg.user.loadError);
    } finally {
      setLoading(false);
    }
  }, [cfg.user.loadError]);

  const save = async () => {
    if (selected === '' || !policy) return;
    setSaveState('saving');
    try {
      const { inherited: _inherited, ...body } = policy;
      const updated = await updateAiUserPolicy(selected, body);
      setPolicy(updated);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex items-start gap-2">
        <Users size={18} className="text-primary-600 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{cfg.user.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cfg.user.description}</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{cfg.user.select}</label>
        {members.length === 0 ? (
          <p className="text-xs text-gray-400">{cfg.user.none}</p>
        ) : (
          <select
            value={selected}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : '';
              setSelected(id);
              setSaveState('idle');
              if (id !== '') void selectUser(id);
              else setPolicy(null);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{cfg.user.placeholder}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={22} />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      ) : policy ? (
        <div className="space-y-5">
          {policy.inherited && (
            <span className="inline-block text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              {cfg.user.inherited}
            </span>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">{cfg.master.title}</p>
            <Toggle
              checked={policy.agent_enabled}
              onChange={(v) => setPolicy({ ...policy, agent_enabled: v })}
              label={policy.agent_enabled ? cfg.master.enabled : cfg.master.disabled}
            />
          </div>
          <PostureSelector
            postures={catalog.postures}
            value={policy.posture}
            onChange={(p) => setPolicy({ ...policy, posture: p })}
          />
          <DomainsTable
            catalog={catalog}
            domains={policy.domains}
            onChange={(domains) => setPolicy({ ...policy, domains })}
          />
          <SaveBar saveState={saveState} onSave={save} />
        </div>
      ) : null}
    </div>
  );
}

/* ─── Sous-composants ─────────────────────────────────────────────────────── */

function PostureSelector({
  postures,
  value,
  onChange,
}: {
  postures: string[];
  value: string;
  onChange: (p: string) => void;
}) {
  const { t } = useI18n();
  const cfg = t.components.copilot.config;
  const labels = cfg.postures as Record<string, { label: string; description: string }>;

  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{cfg.posture.title}</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">{cfg.posture.description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {postures.map((p) => {
          const info = labels[p];
          const active = value === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`text-left border rounded-xl p-3 transition ${
                active
                  ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{info?.label ?? p}</p>
              {info?.description && (
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">{info.description}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DomainsTable({
  catalog,
  domains,
  onChange,
}: {
  catalog: AiPolicyCatalog;
  domains: Record<string, AiPolicyDomainSetting>;
  onChange: (domains: Record<string, AiPolicyDomainSetting>) => void;
}) {
  const { t } = useI18n();
  const cfg = t.components.copilot.config;
  const capLabels = cfg.caps as Record<string, { label: string; description: string }>;
  const [expanded, setExpanded] = useState<string | null>(null);

  const setDomain = (domain: string, patch: Partial<AiPolicyDomainSetting>) => {
    const current = domains[domain] ?? { enabled: false, cap: 'N0' };
    onChange({ ...domains, [domain]: { ...current, ...patch } });
  };

  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{cfg.domains.title}</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-1">{cfg.domains.description}</p>
      <p className="text-[11px] text-gray-400 mb-3">{cfg.globalCeiling}</p>

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {catalog.domains.map((domain) => {
          const setting = domains[domain] ?? { enabled: false, cap: 'N0' };
          const tools = catalog.tools.filter((tool) => tool.domain === domain);
          const isOpen = expanded === domain;
          return (
            <div key={domain} className="bg-white">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Toggle
                  checked={setting.enabled}
                  onChange={(v) => setDomain(domain, { enabled: v })}
                />
                <span className="flex-1 text-sm font-medium text-gray-800 capitalize truncate">
                  {domain}
                </span>
                <select
                  value={setting.cap}
                  disabled={!setting.enabled}
                  onChange={(e) => setDomain(domain, { cap: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
                  aria-label={cfg.domains.cap}
                >
                  {CAP_OPTIONS.map((cap) => (
                    <option key={cap} value={cap}>{capLabels[cap]?.label ?? cap}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : domain)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label={isOpen ? cfg.domains.hideTools : cfg.domains.showTools}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              </div>
              {isOpen && (
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
                  {tools.length === 0 ? (
                    <p className="text-[11px] text-gray-400 py-1">{cfg.domains.noTools}</p>
                  ) : (
                    <ul className="space-y-1.5 py-1">
                      {tools.map((tool) => (
                        <li key={tool.name} className="flex items-start gap-2 text-xs">
                          <RiskBadge risk={tool.risk} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-700">{tool.name}</p>
                            {tool.description && (
                              <p className="text-gray-500 leading-snug">{tool.description}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const { t } = useI18n();
  const label = t.components.copilot.config.domains.risk;
  const color =
    risk.toLowerCase().includes('high') || risk.toLowerCase().includes('elev')
      ? 'bg-red-100 text-red-700'
      : risk.toLowerCase().includes('med') || risk.toLowerCase().includes('moy')
        ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-600';
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}
      title={label}
    >
      {risk}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition ${
          checked ? 'bg-primary-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
      {label && <span className="text-xs font-medium text-gray-600">{label}</span>}
    </label>
  );
}

function SaveBar({ saveState, onSave }: { saveState: SaveState; onSave: () => void }) {
  const { t } = useI18n();
  const cfg = t.components.copilot.config;
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
      <button
        type="button"
        onClick={onSave}
        disabled={saveState === 'saving'}
        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-60"
      >
        {saveState === 'saving' ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Save size={15} />
        )}
        {saveState === 'saving' ? cfg.saving : cfg.save}
      </button>
      {saveState === 'saved' && (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 size={14} /> {cfg.saved}
        </span>
      )}
      {saveState === 'error' && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={14} /> {cfg.saveError}
        </span>
      )}
    </div>
  );
}

function ForbiddenBlock({ label }: { label: string }) {
  return (
    <div className="p-6">
      <div className="max-w-md mx-auto mt-16 text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="bg-gray-200 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
          <ShieldOff size={26} className="text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
      </div>
    </div>
  );
}
