'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Award,
  Bell,
  Brain,
  Check,
  ChevronDown,
  Clock,
  Cog,
  Compass,
  Edit3,
  Eye,
  FileText,
  Globe,
  Handshake,
  Heart,
  HeartPulse,
  Hourglass,
  LibraryBig,
  Lightbulb,
  Loader2,
  MessageCircle,
  Plus,
  RotateCcw,
  Rocket,
  Search,
  Shield,
  Smile,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Header from '@/components/Header';
import PageLoading from '@/components/PageLoading';
import { useAuth } from '@/context/AuthContext';
import { fetchWithAuth } from '@/lib/api';
import { resolveApiUrl } from '@/lib/apiUrl';
import { useI18n } from '@/lib/i18n/I18nContext';

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

interface AttitudeIconOption {
  value: string;
  icon: LucideIcon;
  labels: Record<'fr' | 'en' | 'pt', string>;
}

interface AttitudeCategoryOption {
  key: string;
  labels: Record<'fr' | 'en' | 'pt', string>;
}

const ATTITUDE_CATEGORY_OPTIONS: AttitudeCategoryOption[] = [
  { key: 'behaviour', labels: { fr: 'Savoir-être', en: 'Behaviour', pt: 'Saber ser' } },
  { key: 'professional-skills', labels: { fr: 'Savoir-faire', en: 'Professional skills', pt: 'Saber fazer' } },
  { key: 'leadership', labels: { fr: 'Leadership', en: 'Leadership', pt: 'Liderança' } },
  { key: 'collaboration', labels: { fr: 'Collaboration', en: 'Collaboration', pt: 'Colaboração' } },
  { key: 'communication', labels: { fr: 'Communication', en: 'Communication', pt: 'Comunicação' } },
  { key: 'reliability', labels: { fr: 'Fiabilité', en: 'Reliability', pt: 'Fiabilidade' } },
];

function normalizedLocale(locale: string): 'fr' | 'en' | 'pt' {
  return locale === 'en' || locale === 'pt' ? locale : 'fr';
}

function attitudeCategoryOption(value: string): AttitudeCategoryOption | undefined {
  const normalizedValue = value.trim().toLocaleLowerCase();
  return ATTITUDE_CATEGORY_OPTIONS.find((option) =>
    Object.values(option.labels).some((label) => label.toLocaleLowerCase() === normalizedValue),
  );
}

function categoryDisplayLabel(value: string, locale: string): string {
  return attitudeCategoryOption(value)?.labels[normalizedLocale(locale)] ?? value;
}

const ATTITUDE_ICON_OPTIONS: AttitudeIconOption[] = [
  { value: 'Star', icon: Star, labels: { fr: 'Étoile', en: 'Star', pt: 'Estrela' } },
  { value: 'Award', icon: Award, labels: { fr: 'Récompense', en: 'Award', pt: 'Prémio' } },
  { value: 'Handshake', icon: Handshake, labels: { fr: 'Collaboration', en: 'Collaboration', pt: 'Colaboração' } },
  { value: 'Users', icon: Users, labels: { fr: 'Équipe', en: 'Team', pt: 'Equipa' } },
  { value: 'Heart', icon: Heart, labels: { fr: 'Bienveillance', en: 'Care', pt: 'Cuidado' } },
  { value: 'HeartPulse', icon: HeartPulse, labels: { fr: 'Soutien', en: 'Support', pt: 'Apoio' } },
  { value: 'Smile', icon: Smile, labels: { fr: 'Attitude positive', en: 'Positive attitude', pt: 'Atitude positiva' } },
  { value: 'MessageCircle', icon: MessageCircle, labels: { fr: 'Communication', en: 'Communication', pt: 'Comunicação' } },
  { value: 'Brain', icon: Brain, labels: { fr: 'Intelligence émotionnelle', en: 'Emotional intelligence', pt: 'Inteligência emocional' } },
  { value: 'Lightbulb', icon: Lightbulb, labels: { fr: 'Idée', en: 'Idea', pt: 'Ideia' } },
  { value: 'Eye', icon: Eye, labels: { fr: 'Anticipation', en: 'Anticipation', pt: 'Antecipação' } },
  { value: 'Target', icon: Target, labels: { fr: 'Objectif', en: 'Target', pt: 'Objetivo' } },
  { value: 'TrendingUp', icon: TrendingUp, labels: { fr: 'Progression', en: 'Growth', pt: 'Progressão' } },
  { value: 'Rocket', icon: Rocket, labels: { fr: 'Initiative', en: 'Initiative', pt: 'Iniciativa' } },
  { value: 'Zap', icon: Zap, labels: { fr: 'Réactivité', en: 'Responsiveness', pt: 'Reatividade' } },
  { value: 'Clock', icon: Clock, labels: { fr: 'Ponctualité', en: 'Punctuality', pt: 'Pontualidade' } },
  { value: 'Hourglass', icon: Hourglass, labels: { fr: 'Patience', en: 'Patience', pt: 'Paciência' } },
  { value: 'Shield', icon: Shield, labels: { fr: 'Fiabilité', en: 'Reliability', pt: 'Fiabilidade' } },
  { value: 'Compass', icon: Compass, labels: { fr: 'Orientation', en: 'Direction', pt: 'Orientação' } },
  { value: 'Globe', icon: Globe, labels: { fr: 'Ouverture', en: 'Open-mindedness', pt: 'Abertura' } },
  { value: 'Wrench', icon: Wrench, labels: { fr: 'Appui technique', en: 'Technical assistance', pt: 'Apoio técnico' } },
  { value: 'Cog', icon: Cog, labels: { fr: 'Savoir-faire', en: 'Professional skill', pt: 'Saber fazer' } },
  { value: 'FileText', icon: FileText, labels: { fr: 'Discipline', en: 'Discipline', pt: 'Disciplina' } },
  { value: 'Bell', icon: Bell, labels: { fr: 'Disponibilité', en: 'Availability', pt: 'Disponibilidade' } },
  { value: 'ThumbsUp', icon: ThumbsUp, labels: { fr: 'Reconnaissance', en: 'Recognition', pt: 'Reconhecimento' } },
];

function attitudeIconOption(value: string): AttitudeIconOption {
  return ATTITUDE_ICON_OPTIONS.find((option) => option.value === value) ?? ATTITUDE_ICON_OPTIONS[0];
}

interface Attitude {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

interface TemplateAttitude {
  code: string;
  name: string;
  category: string;
  icon: string;
  display_order: number;
  already_added: boolean;
}

interface AttitudeDraft {
  name: string;
  description: string;
  category: string;
  icon: string;
  display_order: number;
}

const emptyDraft: AttitudeDraft = {
  name: '',
  description: '',
  category: 'Savoir-être',
  icon: 'Star',
  display_order: 0,
};

async function apiError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.detail || fallback;
}

export default function AttitudeReferentialPage() {
  const { t, locale } = useI18n();
  const copy = t.attitudeReferential;
  const { user } = useAuth();
  const role = user?.role?.toLowerCase() || '';
  const canManage = ['rh', 'admin', 'super_admin'].includes(role);

  const [attitudes, setAttitudes] = useState<Attitude[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Attitude | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<AttitudeDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const [showTemplate, setShowTemplate] = useState(false);
  const [template, setTemplate] = useState<TemplateAttitude[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, AttitudeDraft>>({});
  const [importing, setImporting] = useState(false);

  const loadAttitudes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/attitudes?active_only=false`);
      if (!response.ok) throw new Error(await apiError(response, copy.loadError));
      setAttitudes(await response.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    void loadAttitudes();
  }, [loadAttitudes]);

  const visibleAttitudes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return attitudes.filter((attitude) => {
      if (attitude.is_active === showArchived) return false;
      if (!normalizedSearch) return true;
      return [attitude.name, attitude.description, attitude.category, attitude.code]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [attitudes, search, showArchived]);

  const activeCount = attitudes.filter((item) => item.is_active).length;
  const archivedCount = attitudes.length - activeCount;

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft, category: copy.defaultCategory, display_order: activeCount + 1 });
    setShowEditor(true);
  };

  const openEdit = (attitude: Attitude) => {
    setEditing(attitude);
    setDraft({
      name: attitude.name,
      description: attitude.description || '',
      category: attitude.category,
      icon: attitude.icon,
      display_order: attitude.display_order,
    });
    setShowEditor(true);
  };

  const saveAttitude = async () => {
    if (!draft.name.trim() || !draft.category.trim()) {
      toast.error(copy.requiredFields);
      return;
    }
    setSaving(true);
    try {
      const response = await fetchWithAuth(
        editing ? `${API_URL}/api/attitudes/${editing.id}` : `${API_URL}/api/attitudes`,
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            category: draft.category.trim(),
            icon: draft.icon.trim() || 'Star',
            display_order: Number(draft.display_order) || 0,
          }),
        },
      );
      if (!response.ok) throw new Error(await apiError(response, copy.saveError));
      toast.success(editing ? copy.updatedSuccess : copy.createdSuccess);
      setShowEditor(false);
      await loadAttitudes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (attitude: Attitude, isActive: boolean) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/attitudes/${attitude.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!response.ok) throw new Error(await apiError(response, copy.saveError));
      toast.success(isActive ? copy.reactivatedSuccess : copy.archivedSuccess);
      await loadAttitudes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    }
  };

  const openTemplate = async () => {
    setShowTemplate(true);
    setTemplateLoading(true);
    setSelectedCodes(new Set());
    try {
      const response = await fetchWithAuth(`${API_URL}/api/attitudes/template?locale=${locale}`);
      if (!response.ok) throw new Error(await apiError(response, copy.loadError));
      const items: TemplateAttitude[] = await response.json();
      setTemplate(items);
      setTemplateDrafts(Object.fromEntries(items.map((item) => [item.code, {
        name: item.name,
        description: '',
        category: item.category,
        icon: item.icon,
        display_order: item.display_order,
      }])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.loadError);
      setShowTemplate(false);
    } finally {
      setTemplateLoading(false);
    }
  };

  const selectableTemplate = template.filter((item) => !item.already_added);

  const toggleTemplate = (code: string) => {
    setSelectedCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const updateTemplateDraft = (code: string, field: keyof AttitudeDraft, value: string | number) => {
    setTemplateDrafts((current) => ({
      ...current,
      [code]: { ...current[code], [field]: value },
    }));
  };

  const importTemplate = async () => {
    if (selectedCodes.size === 0) return;
    setImporting(true);
    try {
      const payload = Array.from(selectedCodes).map((code) => {
        const item = templateDrafts[code];
        return {
          code,
          name: item.name.trim(),
          description: item.description.trim() || null,
          category: item.category.trim(),
          icon: item.icon,
        };
      });
      if (payload.some((item) => !item.name || !item.category)) {
        toast.error(copy.requiredFields);
        return;
      }
      const response = await fetchWithAuth(`${API_URL}/api/attitudes/template/import`, {
        method: 'POST',
        body: JSON.stringify({ attitudes: payload }),
      });
      if (!response.ok) throw new Error(await apiError(response, copy.importError));
      toast.success(copy.importedSuccess);
      setShowTemplate(false);
      await loadAttitudes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.importError);
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <>
      <Header title={copy.title} subtitle={copy.subtitle} hideAddButton />
      <div className="space-y-6 p-6 lg:p-8">
        {!canManage && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {copy.readOnly}
          </div>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowArchived(false)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${!showArchived ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {copy.active} · {activeCount}
              </button>
              <button
                type="button"
                onClick={() => setShowArchived(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${showArchived ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {copy.archived} · {archivedCount}
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>
              {canManage && (
                <>
                  <button type="button" onClick={() => void openTemplate()} className="flex items-center justify-center gap-2 rounded-lg border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50">
                    <Sparkles className="h-4 w-4" /> {copy.useTemplate}
                  </button>
                  <button type="button" onClick={openCreate} className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
                    <Plus className="h-4 w-4" /> {copy.addCustom}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {visibleAttitudes.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <LibraryBig className="mx-auto h-12 w-12 text-gray-300" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">{search ? copy.noResults : copy.emptyTitle}</h2>
            {!search && <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">{copy.emptyDescription}</p>}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleAttitudes.map((attitude) => (
              <article key={attitude.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-lg font-bold text-primary-700">
                      <AttitudeIcon name={attitude.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-gray-900">{attitude.name}</h2>
                      <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{categoryDisplayLabel(attitude.category, locale)}</span>
                    </div>
                  </div>
                  <span className="rounded-md bg-gray-50 px-2 py-1 font-mono text-[10px] text-gray-400">{attitude.code}</span>
                </div>
                <p className="mt-4 min-h-10 text-sm leading-5 text-gray-500">{attitude.description || '—'}</p>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-xs text-gray-400">{copy.order}: {attitude.display_order}</span>
                  {canManage && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(attitude)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title={copy.edit}>
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void setActive(attitude, !attitude.is_active)}
                        className={`rounded-lg p-2 ${attitude.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        title={attitude.is_active ? copy.archive : copy.reactivate}
                      >
                        {attitude.is_active ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setShowEditor(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? copy.editTitle : copy.customTitle}</h2>
              <button type="button" onClick={() => setShowEditor(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <Field label={copy.name} value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <CategorySelect
                  label={copy.category}
                  value={draft.category}
                  locale={locale}
                  otherLabel={copy.otherCategory}
                  customPlaceholder={copy.customCategoryPlaceholder}
                  onChange={(value) => setDraft((current) => ({ ...current, category: value }))}
                />
                <IconSelect label={copy.icon} value={draft.icon} locale={locale} onChange={(value) => setDraft((current) => ({ ...current, icon: value }))} />
              </div>
              <label className="block text-sm font-medium text-gray-700">
                {copy.description}
                <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={4} className="mt-1.5 w-full rounded-lg border border-gray-200 p-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                {copy.order}
                <input type="number" min={0} value={draft.display_order} onChange={(event) => setDraft((current) => ({ ...current, display_order: Number(event.target.value) }))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </label>
              {editing?.is_active && <p className="text-xs text-gray-500">{copy.archiveHint}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 p-5">
              <button type="button" onClick={() => setShowEditor(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600">{copy.cancel}</button>
              <button type="button" disabled={saving} onClick={() => void saveAttitude()} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {saving ? copy.saving : copy.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setShowTemplate(false)}>
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{copy.templateTitle}</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">{copy.templateSubtitle}</p>
              </div>
              <button type="button" onClick={() => setShowTemplate(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            {templateLoading ? (
              <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
                  <span className="text-sm font-medium text-gray-600">{selectedCodes.size} {copy.selectedCount}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedCodes(new Set(selectableTemplate.map((item) => item.code)))} className="text-sm font-medium text-primary-700">{copy.selectAll}</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSelectedCodes(new Set())} className="text-sm font-medium text-gray-500">{copy.clearSelection}</button>
                  </div>
                </div>
                <div className="space-y-3 overflow-y-auto p-5">
                  {template.map((item) => {
                    const selected = selectedCodes.has(item.code);
                    const itemDraft = templateDrafts[item.code];
                    return (
                      <div key={item.code} className={`rounded-xl border p-4 ${item.already_added ? 'border-gray-100 bg-gray-50 opacity-70' : selected ? 'border-primary-300 bg-primary-50/40' : 'border-gray-200'}`}>
                        <button type="button" disabled={item.already_added} onClick={() => toggleTemplate(item.code)} className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed">
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white'}`}>
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                              <AttitudeIcon name={item.icon} className="h-4 w-4 text-primary-600" />
                              {item.name}
                            </span>
                            <span className="ml-2 text-xs text-gray-400">{categoryDisplayLabel(item.category, locale)}</span>
                          </span>
                          {item.already_added && <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-600">{copy.alreadyAdded}</span>}
                        </button>
                        {selected && itemDraft && (
                          <div className="mt-4 grid gap-3 border-t border-primary-100 pt-4 sm:grid-cols-2">
                            <Field label={copy.name} value={itemDraft.name} onChange={(value) => updateTemplateDraft(item.code, 'name', value)} />
                            <CategorySelect
                              label={copy.category}
                              value={itemDraft.category}
                              locale={locale}
                              otherLabel={copy.otherCategory}
                              customPlaceholder={copy.customCategoryPlaceholder}
                              onChange={(value) => updateTemplateDraft(item.code, 'category', value)}
                            />
                            <IconSelect label={copy.icon} value={itemDraft.icon} locale={locale} onChange={(value) => updateTemplateDraft(item.code, 'icon', value)} />
                            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
                              {copy.description}
                              <textarea value={itemDraft.description} onChange={(event) => updateTemplateDraft(item.code, 'description', event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-primary-500" />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 p-5">
                  <button type="button" onClick={() => setShowTemplate(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600">{copy.cancel}</button>
                  <button type="button" disabled={importing || selectedCodes.size === 0} onClick={() => void importTemplate()} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {importing && <Loader2 className="h-4 w-4 animate-spin" />} {importing ? copy.importing : copy.importSelection}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange }: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
    </label>
  );
}

function IconSelect({
  label,
  value,
  locale,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  locale: string;
  onChange: (value: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLocale = normalizedLocale(locale);
  const selected = attitudeIconOption(value);
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative block text-sm font-medium text-gray-700">
      <span>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="mt-1.5 flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      >
        <SelectedIcon className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-normal text-gray-900">{selected.labels[currentLocale]}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
        >
          {ATTITUDE_ICON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selected.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-normal transition-colors ${
                option.value === selected.value
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <option.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{option.labels[currentLocale]}</span>
              {option.value === selected.value && <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySelect({
  label,
  value,
  locale,
  otherLabel,
  customPlaceholder,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  locale: string;
  otherLabel: string;
  customPlaceholder: string;
  onChange: (value: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLocale = normalizedLocale(locale);
  const selected = attitudeCategoryOption(value);
  const isCustom = !selected;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative block text-sm font-medium text-gray-700">
      <span>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="mt-1.5 flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      >
        <span className="min-w-0 flex-1 truncate font-normal text-gray-900">
          {selected?.labels[currentLocale] ?? otherLabel}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div role="listbox" aria-label={label} className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          {ATTITUDE_CATEGORY_OPTIONS.map((option) => {
            const optionSelected = selected?.key === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={optionSelected}
                onClick={() => {
                  onChange(option.labels[currentLocale]);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-normal transition-colors ${
                  optionSelected ? 'bg-primary-50 text-primary-800' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.labels[currentLocale]}</span>
                {optionSelected && <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />}
              </button>
            );
          })}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            role="option"
            aria-selected={isCustom}
            onClick={() => {
              if (!isCustom) onChange('');
              setOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-normal transition-colors ${
              isCustom ? 'bg-primary-50 text-primary-800' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{otherLabel}</span>
            {isCustom && <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />}
          </button>
        </div>
      )}
      {isCustom && (
        <input
          autoFocus={!value}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={customPlaceholder}
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      )}
    </div>
  );
}

function AttitudeIcon({ name, className }: Readonly<{ name: string; className?: string }>) {
  const Icon = attitudeIconOption(name).icon;
  return <Icon className={className} aria-hidden="true" />;
}
