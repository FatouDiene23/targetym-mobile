'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Send, Loader2, Sparkles, ArrowUpRight, CheckCircle, FileText, Download,
  Paperclip, X, ThumbsUp, ThumbsDown, RefreshCw, Copy, Check, Square,
  Plus, AlignLeft, Zap, ArrowDown,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line,
  LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ChatMessageContent, { type EntityAction } from './ChatMessageContent';
import { PendingActionCard, PendingGroup } from './AgentActionPreview';
import { useI18n } from '@/lib/i18n/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { useCopilotAccess, isRoleAllowed } from '@/hooks/useCopilotAccess';
import type { useCopilot } from '@/hooks/useCopilot';
import type { CopilotArtifact, CopilotPendingAction, CopilotResponseBlock, CopilotUiIntent } from '@/lib/api';
import CopilotMicButton from '@/components/CopilotMicButton';
import { useCopilotVoice } from '@/hooks/useCopilotVoice';
import { downloadCopilotDocument, extractPdfText, sendCopilotFeedback, getCopilotBriefing, cancelCopilotTurn } from '@/lib/api';

interface Props {
  copilot: ReturnType<typeof useCopilot>;
  pagePath?: string;
  /** Rend la zone plus haute pour l'onglet plein écran. */
  variant?: 'drawer' | 'fullscreen';
}

function CopilotMark({ compact = false, thinking = false }: Readonly<{
  compact?: boolean;
  thinking?: boolean;
}>) {
  const size = compact ? 14 : 22;
  return (
    <span
      className={`copilot-mark ${thinking ? 'copilot-mark-thinking' : ''} ${compact ? 'h-4 w-4' : 'h-7 w-7'}`}
      aria-hidden="true"
    >
      <Image
        src="/picto-targetym.png"
        alt=""
        width={size}
        height={size}
        className="copilot-mark-image"
      />
    </span>
  );
}

function ThinkingGlyph({ compact = false }: Readonly<{ compact?: boolean }>) {
  return <CopilotMark compact={compact} thinking />;
}

/**
 * Indicateur de progression pendant tout le streaming du tour.
 * Le glyphe lumineux et le reflet du libellé donnent un mouvement continu,
 * proche du langage visuel de Gemini, sans masquer l'étape réellement exécutée.
 * `startedAt` reste l'horodatage précis du début du tour.
 */
function ThinkingIndicator({ label, startedAt }: Readonly<{ label?: string; startedAt: number }>) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <div className="mb-2 flex min-h-7 items-center gap-2.5 text-slate-400" role="status" aria-live="polite">
      <ThinkingGlyph />
      {label && <span className="copilot-thinking-label text-xs font-medium">{label}</span>}
      <span className="text-[11px] tabular-nums text-slate-400">· {seconds}s</span>
    </div>
  );
}

// BANDEAU D'ÉTAT SUPPRIMÉ (2026-08-11, demande de Christ). Il affichait, AVANT la
// réponse, un titre et un corps génériques dérivés du statut du tour — « Demande
// encore incomplète », « Il manque une information, une preuve ou une étape ».
//
// Il avait du sens quand la réponse elle-même était muette. Depuis que le serveur
// nomme le blocage, liste ce qui a abouti et affiche le plan coché, il ne faisait
// plus que donner un SECOND verdict, plus vague, lu en premier — au point de faire
// paraître floue une réponse qui ne l'était plus.
//
// Le composant `OutcomeNotice` et son type `OutcomeLabels` sont retirés plutôt que
// laissés morts : l'historique git suffit si l'on veut les réintroduire. Les clés
// i18n `outcome.*` restent en place, sans coût, et redeviendront utiles si l'on
// décide un jour d'afficher cet état ailleurs (une pastille, un filtre).

// Reconstruit un tableau à partir du texte APLATI produit par /extract-pdf pour
// les tableurs (CSV/Excel) : 1re ligne = en-têtes « h1 | h2 | … », puis lignes
// « Ligne N: clé=valeur | clé=valeur » (cellules vides omises -> mapping par clé).
// Renvoie null si le contenu n'est pas tabulaire (PDF/TXT/DOCX -> rendu texte).
function parsePreviewTable(text: string): { columns: string[]; rows: string[][] } | null {
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isRow = (l: string) => /^Ligne\s+\d+\s*:/.test(l);
  const dataLines = lines.filter(isRow);
  if (dataLines.length === 0) return null;
  const headerLine = lines.find((l) => !isRow(l) && l.includes(' | '));
  if (!headerLine) return null;
  const columns = headerLine.split(' | ').map((s) => s.trim()).filter(Boolean);
  if (columns.length === 0) return null;
  const rows = dataLines.map((l) => {
    const body = l.replace(/^Ligne\s+\d+\s*:\s*/, '');
    const cells: Record<string, string> = {};
    for (const part of body.split(' | ')) {
      const eq = part.indexOf('=');
      if (eq > 0) cells[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
    return columns.map((col) => cells[col] ?? '');
  });
  return { columns, rows };
}

function artifactRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function artifactText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

const CHART_COLORS = ['#0E7A6F', '#3FB39F', '#315F9B', '#C68A20', '#7A5CB8', '#B5544B'];

function displayValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return new Intl.NumberFormat('fr-FR').format(value);
  return artifactText(value) || '—';
}

function ArtifactDownload({ artifact }: Readonly<{ artifact: CopilotArtifact }>) {
  const urls = artifact.download_urls ?? {};
  const downloads = [
    urls.pdf || artifact.download_url
      ? { format: 'PDF', url: urls.pdf || artifact.download_url }
      : null,
    urls.xlsx
      ? { format: 'Excel', url: urls.xlsx }
      : null,
  ].filter((item): item is { format: string; url: string } => Boolean(item?.url));
  if (!downloads.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {downloads.map((download) => (
        <button
          key={download.format}
          type="button"
          onClick={() => void downloadCopilotDocument(download.url).catch(() => {})}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800"
        >
          <Download size={15} />
          {`Télécharger en ${download.format}`}
        </button>
      ))}
    </div>
  );
}

function StatArtifact({ artifact, content }: Readonly<{ artifact: CopilotArtifact; content: Record<string, unknown> }>) {
  const trend = artifactText(content.trend);
  return (
    <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-white to-primary-50/60 p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{artifactText(content.label) || artifact.title || 'Indicateur'}</div>
      <div className="mt-2 flex items-end gap-2">
        <strong className="text-2xl font-bold tracking-tight text-slate-900">{displayValue(content.value)}</strong>
        {artifactText(content.unit) && <span className="pb-0.5 text-sm text-slate-500">{artifactText(content.unit)}</span>}
      </div>
      {(content.trend_value != null || artifactText(content.description)) && (
        <div className="mt-2 text-xs text-slate-500">
          {content.trend_value != null && <span className={trend === 'down' ? 'text-rose-600' : trend === 'up' ? 'text-emerald-700' : ''}>{trend === 'up' ? '↗ ' : trend === 'down' ? '↘ ' : ''}{displayValue(content.trend_value)}</span>}
          {content.trend_value != null && artifactText(content.description) ? ' · ' : ''}{artifactText(content.description)}
        </div>
      )}
    </div>
  );
}

function TableArtifact({ artifact, content }: Readonly<{ artifact: CopilotArtifact; content: Record<string, unknown> }>) {
  const columns = (Array.isArray(content.columns) ? content.columns : []).map((column) => {
    const descriptor = artifactRecord(column);
    const key = descriptor ? artifactText(descriptor.key) : artifactText(column);
    return { key, label: descriptor ? artifactText(descriptor.label) : artifactText(column) };
  }).filter((column) => column.key && column.label);
  const rows = (Array.isArray(content.rows) ? content.rows : []).map((row) => {
    if (Array.isArray(row)) return row;
    const record = artifactRecord(row);
    return columns.map((column) => record?.[column.key]);
  });
  if (!columns.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {artifact.title && <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">{artifact.title}</h3>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">{column.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row, rowIndex) => <tr key={rowIndex} className="transition hover:bg-primary-50/40">{columns.map((column, columnIndex) => <td key={column.key} className="px-4 py-3 text-slate-700">{displayValue(row[columnIndex])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {artifactText(content.caption) && <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">{artifactText(content.caption)}</p>}
    </section>
  );
}

function ChartArtifact({ artifact, content }: Readonly<{ artifact: CopilotArtifact; content: Record<string, unknown> }>) {
  let chartType = artifactText(content.chart_type) || artifactText(content.kind) || artifactText(content.type);
  const legacyData = Array.isArray(content.data) ? content.data : [];
  let labels = Array.isArray(content.labels) ? content.labels.map(artifactText) : [];
  let rawSeries = Array.isArray(content.series) ? content.series : [];
  if (!labels.length && legacyData.length) {
    labels = legacyData.map((point) => artifactText(artifactRecord(point)?.label) || artifactText(artifactRecord(point)?.name));
    rawSeries = [{ name: artifact.title || 'Valeur', data: legacyData.map((point) => artifactRecord(point)?.value) }];
  }
  if (chartType === 'donut') chartType = 'doughnut';
  const series = rawSeries.map((raw, index) => {
    const item = artifactRecord(raw);
    return { name: artifactText(item?.name) || `Série ${index + 1}`, data: Array.isArray(item?.data) ? item.data : [], color: artifactText(item?.color) || CHART_COLORS[index % CHART_COLORS.length] };
  }).filter((item) => item.data.length === labels.length);
  if (!labels.length || !series.length) return null;
  const data = labels.map((label, index) => Object.fromEntries([['name', label], ...series.map((item) => [item.name, item.data[index] ?? null])]));
  const commonAxes = <><CartesianGrid strokeDasharray="3 3" stroke="#E8ECEB" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={42} /><Tooltip contentStyle={{ borderRadius: 12, borderColor: '#DDE7E4', boxShadow: '0 10px 30px rgba(22,48,44,.10)' }} />{series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}</>;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {artifact.title && <h3 className="mb-1 text-sm font-bold text-slate-900">{artifact.title}</h3>}
      {artifactText(content.caption) && <p className="mb-3 text-xs text-slate-500">{artifactText(content.caption)}</p>}
      <div className="h-72 w-full min-w-0" role="img" aria-label={artifact.title || 'Graphique du copilote'}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' || chartType === 'doughnut' ? (
            <PieChart><Pie data={data.map((point) => ({ name: point.name, value: point[series[0].name] }))} dataKey="value" nameKey="name" innerRadius={chartType === 'doughnut' ? 58 : 0} outerRadius={92} paddingAngle={2}>{data.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, borderColor: '#DDE7E4' }} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={data}>{commonAxes}{series.map((item) => <Line key={item.name} type="monotone" dataKey={item.name} stroke={item.color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}</LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data}>{commonAxes}{series.map((item) => <Area key={item.name} type="monotone" dataKey={item.name} stroke={item.color} fill={item.color} fillOpacity={0.16} strokeWidth={2.5} stackId={content.stacked ? 'stack' : undefined} />)}</AreaChart>
          ) : (
            <BarChart data={data}>{commonAxes}{series.map((item) => <Bar key={item.name} dataKey={item.name} fill={item.color} radius={[6, 6, 0, 0]} stackId={content.stacked ? 'stack' : undefined} />)}</BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CardArtifact({ artifact, content }: Readonly<{ artifact: CopilotArtifact; content: Record<string, unknown> }>) {
  const fields = Array.isArray(content.fields) ? content.fields : [];
  const body = artifactText(content.body) || artifactText(content.text);
  if (!body && !fields.length) return null;
  return (
    <section className="rounded-2xl border border-primary-100 bg-primary-50/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div>{artifact.title && <h3 className="text-sm font-bold text-slate-900">{artifact.title}</h3>}{artifactText(content.heading) && <p className="mt-0.5 text-sm font-semibold text-primary-800">{artifactText(content.heading)}</p>}</div>{(artifactText(content.badge) || artifactText(content.status)) && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary-800 shadow-sm">{artifactText(content.badge) || artifactText(content.status)}</span>}</div>
      {body && <div className="mt-2 text-sm leading-6 text-slate-700"><ChatMessageContent content={body} isUser={false} /></div>}
      {fields.length > 0 && <dl className="mt-3 grid gap-2 sm:grid-cols-2">{fields.map((raw, index) => { const field = artifactRecord(raw); return <div key={index} className="rounded-xl bg-white px-3 py-2"><dt className="text-xs text-slate-500">{artifactText(field?.label)}</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{displayValue(field?.value)}</dd></div>; })}</dl>}
    </section>
  );
}

function ReportArtifact({ artifact, content, onSuggestion, onAction }: Readonly<{ artifact: CopilotArtifact; content: Record<string, unknown>; onSuggestion: (prompt: string) => void; onAction: (action: EntityAction) => void }>) {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const metrics = Array.isArray(content.metrics) ? content.metrics : [];
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-primary-100 bg-gradient-to-r from-primary-50 to-white px-5 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-700">{artifact.type === 'document' ? 'Document' : 'Rapport'}</p><h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">{artifact.title || 'Synthèse Targetym'}</h3>{artifactText(content.summary) && <div className="mt-2 text-sm leading-6 text-slate-600"><ChatMessageContent content={artifactText(content.summary)} isUser={false} onSuggestion={onSuggestion} onAction={onAction} /></div>}</header>
      <div className="space-y-5 p-5">
        {metrics.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map((raw, index) => { const metric = artifactRecord(raw); return metric ? <StatArtifact key={index} artifact={{ ...artifact, title: '' }} content={metric} /> : null; })}</div>}
        {sections.map((raw, index) => { const section = artifactRecord(raw); if (!section) return null; const heading = artifactText(section.heading) || artifactText(section.title); const body = artifactText(section.content); const items = Array.isArray(section.items) ? section.items : []; return <section key={index} className="border-l-2 border-primary-200 pl-4">{heading && <h4 className="text-sm font-bold text-slate-900">{heading}</h4>}{body && <div className="mt-1.5 text-sm leading-6 text-slate-700"><ChatMessageContent content={body} isUser={false} onSuggestion={onSuggestion} onAction={onAction} /></div>}{items.length > 0 && <ul className="mt-2 space-y-1.5 text-sm text-slate-700">{items.map((item, itemIndex) => <li key={itemIndex} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary-500" />{artifactText(item)}</li>)}</ul>}</section>; })}
        <ArtifactDownload artifact={artifact} />
      </div>
    </article>
  );
}

function StructuredArtifactView({ artifact, onSuggestion, onAction }: Readonly<{ artifact: CopilotArtifact; onSuggestion: (prompt: string) => void; onAction: (action: EntityAction) => void }>) {
  const content = artifactRecord(artifact.content);
  if (!content) return null;
  if (artifact.type === 'stat') return <StatArtifact artifact={artifact} content={content} />;
  if (artifact.type === 'table') return <TableArtifact artifact={artifact} content={content} />;
  if (artifact.type === 'chart') return <ChartArtifact artifact={artifact} content={content} />;
  if (artifact.type === 'card') return <CardArtifact artifact={artifact} content={content} />;
  if (artifact.type === 'report' || artifact.type === 'document') return <ReportArtifact artifact={artifact} content={content} onSuggestion={onSuggestion} onAction={onAction} />;
  if (artifact.type === 'timeline') {
    const items = Array.isArray(content.items) ? content.items : [];
    return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{artifact.title && <h3 className="mb-4 text-sm font-bold text-slate-900">{artifact.title}</h3>}<ol className="relative ml-2 border-l border-primary-200">{items.map((raw, index) => { const item = artifactRecord(raw); return item ? <li key={index} className="mb-5 ml-5 last:mb-0"><span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary-600" /><time className="text-xs font-semibold text-primary-700">{artifactText(item.date)}</time><h4 className="text-sm font-bold text-slate-900">{artifactText(item.title)}</h4>{artifactText(item.description) && <p className="mt-1 text-sm text-slate-600">{artifactText(item.description)}</p>}</li> : null; })}</ol></section>;
  }
  if (artifact.type === 'suggestions') {
    const items = Array.isArray(content.items) ? content.items : [];
    return <div className="flex flex-wrap gap-2">{items.map((raw, index) => { const item = artifactRecord(raw); const prompt = artifactText(item?.prompt); return prompt ? <button key={index} type="button" onClick={() => onSuggestion(prompt)} className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 transition hover:bg-primary-100">{artifactText(item?.label) || prompt}</button> : null; })}</div>;
  }
  return null;
}

function StructuredArtifacts({
  artifacts,
  onSuggestion,
  onAction,
}: Readonly<{
  artifacts: CopilotArtifact[];
  onSuggestion: (prompt: string) => void;
  onAction: (action: EntityAction) => void;
}>) {
  const visible = artifacts.filter((artifact) => !['text', 'confirmation'].includes(artifact.type));
  if (!visible.length) return null;

  const stats = visible.filter((artifact) => artifact.type === 'stat');
  const remaining = visible.filter((artifact) => artifact.type !== 'stat');

  return (
    <div className="mt-3 space-y-3" data-testid="copilot-structured-artifacts">
      {stats.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{stats.map((artifact) => <StructuredArtifactView key={artifact.id} artifact={artifact} onSuggestion={onSuggestion} onAction={onAction} />)}</div>}
      {remaining.map((artifact) => <StructuredArtifactView key={artifact.id} artifact={artifact} onSuggestion={onSuggestion} onAction={onAction} />)}
    </div>
  );
}

/** Projette les blocs V2.1 vers le composant visuel existant. Les URLs de
 * téléchargement restent issues des artefacts persistés par le serveur : un
 * bloc `report` ne devient téléchargeable qu'après l'enregistrement du message. */
function structuredOutputArtifacts(
  blocks: CopilotResponseBlock[] | undefined,
  persistedArtifacts: CopilotArtifact[] | undefined,
): CopilotArtifact[] {
  if (!blocks?.length) return persistedArtifacts ?? [];
  const persisted = persistedArtifacts ?? [];
  return blocks.map((block, index) => {
    const id = `artifact-${index + 1}`;
    const downloadable = persisted.find((artifact) => artifact.id === id)
      ?? persisted.find((artifact) => (
        artifact.type === block.type && artifact.title === (block.title ?? '')
      ));
    return {
      id,
      type: block.type,
      title: block.title,
      encoding: 'json',
      source: 'final_response_v2',
      content: block.content,
      download_url: downloadable?.download_url,
      download_urls: downloadable?.download_urls,
      download_formats: downloadable?.download_formats,
    };
  });
}

/**
 * Un briefing a-t-il echoue tres recemment pour cette cle ?
 *
 * Le point du jour coute environ 25 secondes d'appel LLM. Sans ce garde-fou, une
 * erreur passagere le relance a CHAQUE affichage de l'accueil. Le marqueur expire
 * en 10 minutes : une panne courte ne prive donc pas l'utilisateur de son point
 * du jour, mais elle ne coute pas non plus un appel par navigation.
 */
const _DELAI_REESSAI_BRIEFING_MS = 10 * 60 * 1000;

function _briefingRecemmentEchoue(cle: string): boolean {
  try {
    const marque = localStorage.getItem(`${cle}:echec`);
    if (!marque) return false;
    return Date.now() - Number(marque) < _DELAI_REESSAI_BRIEFING_MS;
  } catch {
    return false;
  }
}

export default function CopilotConversation({ copilot, pagePath, variant = 'drawer' }: Props) {
  const { t } = useI18n();
  const c = t.components.copilot;
  const router = useRouter();
  const { role } = useCopilotAccess();
  const { user } = useAuth();
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pièce jointe : texte extrait d'un fichier (CSV/Excel/PDF/…) que l'agent lira.
  const [attachment, setAttachment] = useState<{ name: string; text: string; warning?: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Fichier dont on affiche l'aperçu (modale) ; null = fermée.
  const [preview, setPreview] = useState<{ name: string; text?: string } | null>(null);
  // Point du jour produit par le même moteur et le même contrat que le chat.
  // Les blocs et intentions sont conservés afin de ne pas aplatir le rendu en texte.
  const [briefing, setBriefing] = useState<{
    reply: string;
    responseBlocks?: CopilotResponseBlock[];
    artifacts?: CopilotArtifact[];
    uiIntents?: CopilotUiIntent[];
  } | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const briefingTried = useRef(false);

  // Clé de cache journalier du briefing : par UTILISATEUR + jour (local). Évite de
  // régénérer (et de rappeler le LLM) à chaque connexion — 1 fois par jour suffit.
  // NB : la clé dépend de l'utilisateur, donc changer de compte régénère une fois.
  // C'est voulu : le point du jour est personnel (rôle, équipe, files à traiter).
  const briefingCacheKey = useCallback(() => {
    const uk = user?.id ? String(user.id) : (user?.email || 'anon');
    const today = new Date().toISOString().slice(0, 10);
    return `tym_briefing:${uk}:${today}`;
  }, [user]);

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true);
    try {
      const livePagePath = typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : pagePath;
      const res = await getCopilotBriefing(livePagePath);
      const value = {
        reply: (res.reply || '').trim(),
        responseBlocks: res.response_blocks,
        artifacts: res.artifacts,
        uiIntents: res.ui_intents,
      };
      setBriefing(value.reply ? value : null);
      try {
        localStorage.setItem(
          briefingCacheKey(),
          value.reply ? JSON.stringify(value) : '',
        );
      } catch { /* ignore */ }
    } catch {
      setBriefing(null);
      // ÉCHEC : on pose un marqueur horodaté. Sans lui, un briefing en erreur
      // n'écrit RIEN en cache, donc chaque nouvel affichage relance un appel qui
      // coûte ~25 s de LLM. Le marqueur expire vite (voir `_briefingRecemmentEchoue`)
      // pour qu'une panne passagère ne prive pas l'utilisateur de son point du jour.
      try {
        localStorage.setItem(`${briefingCacheKey()}:echec`, String(Date.now()));
      } catch { /* ignore */ }
    } finally {
      setBriefingLoading(false);
    }
  }, [briefingCacheKey, pagePath]);

  const {
    activeId, messages, draft, setDraft, streaming, sendMessage,
    approveAction, rejectAction,
  } = copilot;

  // Mode vocal. Il ne rend rien de nouveau : les tours qu'il reçoit ont la
  // même forme qu'en texte et repassent par `copilot`, donc par les mêmes
  // blocs, artefacts et cartes de validation. La voix propose, l'écran valide.
  const voice = useCopilotVoice({
    onTurnResult: (result) => {
      // Le serveur possède le fil de conversation : on recharge celui qu'il
      // désigne plutôt que d'en ouvrir un second à côté du fil texte.
      // `selectConversation` relit aussi le fil déjà actif, ce qui fait
      // apparaître le tour vocal — blocs et cartes de validation compris.
      if (result.conversationId) {
        void copilot.selectConversation(result.conversationId);
      }
      void copilot.loadConversations();
    },
  });
  // Suivi de la réponse : actif à chaque nouvel envoi. Une remontée volontaire
  // le suspend et affiche un raccourci explicite pour revenir au texte courant.
  const followResponseRef = useRef(true);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const [showReturnToResponse, setShowReturnToResponse] = useState(false);

  useEffect(() => {
    const input = composerInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(input.scrollHeight, 160);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [draft]);

  // ARRET COOPERATIF. On ne coupe PAS la connexion : le serveur pose un marqueur
  // que la boucle lit a sa prochaine frontiere d'etape, puis termine le tour
  // proprement. Couper le flux donnerait une annulation brutale, ou tout serait
  // declare en echec meme si des actions avaient ete correctement preparees.
  const [arretDemande, setArretDemande] = useState(false);
  // Menu « + » de la barre de saisie, et forme de reponse demandee POUR LE
  // PROCHAIN MESSAGE uniquement. Volontairement non persistee : une consigne
  // ponctuelle ne doit pas s'appliquer silencieusement aux messages suivants.
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [styleReponse, setStyleReponse] = useState<'detaille' | 'bref' | null>(null);
  useEffect(() => { if (!streaming) setArretDemande(false); }, [streaming]);

  const demanderArret = useCallback(async () => {
    if (!activeId || arretDemande) return;
    setArretDemande(true);
    try {
      await cancelCopilotTurn(activeId);
    } catch {
      // Echec de la demande : on rend le bouton a nouveau actionnable plutot
      // que de laisser croire que l'arret est acquis.
      setArretDemande(false);
    }
  }, [activeId, arretDemande]);

  // À l'arrivée sur l'accueil (utilisateur autorisé, aucune conversation) : si le
  // briefing du JOUR est déjà en cache, on le réutilise (aucun appel) ; sinon on le
  // génère UNE fois (1re connexion du jour). Le bouton rafraîchir force une màj.
  useEffect(() => {
    if (briefingTried.current) return;
    if (!isRoleAllowed(role)) return;
    if (messages.length > 0) return;
    // On ATTEND que l'utilisateur soit connu. Sinon la clé de cache est calculée
    // pour « anon » : le briefing serait écrit sous une clé jamais relue, et
    // régénéré (≈25 s d'appel LLM) au montage suivant. On ne pose donc pas non
    // plus `briefingTried` ici, pour réessayer dès que l'identité est là.
    if (!user?.id && !user?.email) return;
    briefingTried.current = true;
    let cached: string | null = null;
    try { cached = localStorage.getItem(briefingCacheKey()); } catch { /* ignore */ }
    if (cached !== null) {
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as unknown;
          if (
            parsed
            && typeof parsed === 'object'
            && 'reply' in parsed
            && typeof parsed.reply === 'string'
            && parsed.reply
          ) {
            setBriefing(parsed as {
              reply: string;
              responseBlocks?: CopilotResponseBlock[];
              artifacts?: CopilotArtifact[];
              uiIntents?: CopilotUiIntent[];
            });
          } else {
            setBriefing({ reply: cached });
          }
        } catch {
          // Compatibilité avec le cache texte de l'ancien briefing.
          setBriefing({ reply: cached });
        }
      }
      return; // déjà généré aujourd'hui pour cet utilisateur : on AFFICHE, on ne recharge pas
    }
    if (_briefingRecemmentEchoue(briefingCacheKey())) return;
    void loadBriefing();
  }, [role, messages.length, loadBriefing, briefingCacheKey, user]);

  // Retour qualité 👍/👎 par réponse : état local (rating donné) + boîte de
  // commentaire optionnelle pour un 👎.
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const submitFeedback = (msgId: string, rating: 'up' | 'down', comment?: string) => {
    setFeedbackGiven((prev) => ({ ...prev, [msgId]: rating }));
    setCommentFor(null);
    setCommentText('');
    const messageId = /^\d+$/.test(msgId) ? Number(msgId) : undefined;
    void sendCopilotFeedback(rating, { conversationId: activeId, messageId, comment });
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setAttachError(null);
    // Taille max acceptée (garde front ; le serveur borne aussi à 20 Mo). Au-delà,
    // l'extraction serait lourde/inutile pour un import.
    const MAX_FILE_MB = 10;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setAttachError(c.attach.tooBig.replace('{mb}', String(MAX_FILE_MB)));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setAttaching(true);
    try {
      const res = await extractPdfText(file);
      const text = (res.text || '').trim();
      if (!text) {
        setAttachError(res.warning || c.attach.empty);
        setAttachment(null);
      } else {
        setAttachment({ name: res.filename || file.name, text, warning: res.warning });
      }
    } catch {
      setAttachError(c.attach.error);
      setAttachment(null);
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Chemin de page envoyé à l'agent : on lit l'URL LIVE (path + query) au moment
  // de l'envoi. Plus fiable que le prop `pagePath` (qui perd la query, donc
  // l'onglet courant) et toujours à jour même si l'utilisateur a changé d'onglet
  // sans changer de route. Repli sur `pagePath` côté SSR / hors navigateur.
  const resolvePagePath = () =>
    (typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : undefined) || pagePath;

  const prevLenRef = useRef(0);
  const scrollToLatest = useCallback(() => {
    followResponseRef.current = true;
    setShowReturnToResponse(false);
    endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, []);

  const handleConversationScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 72;
    if (nearBottom) {
      followResponseRef.current = true;
      setShowReturnToResponse(false);
    } else if (streaming && followResponseRef.current) {
      // Un écart significatif pendant le tour correspond à une remontée
      // volontaire : on laisse l'utilisateur relire sans le tirer vers le bas.
      followResponseRef.current = false;
      setShowReturnToResponse(true);
    }
  }, [streaming]);

  useEffect(() => {
    // Un NOUVEAU message vient d'être ajouté (envoi utilisateur, réponse qui
    // démarre, ou ouverture d'une conversation) : le nombre de messages augmente.
    const isNewMessage = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;
    if (isNewMessage) {
      followResponseRef.current = true;
      setShowReturnToResponse(false);
    }
    if (!isNewMessage && (!streaming || !followResponseRef.current)) return;

    // Un seul frame suffit et évite d'empiler des animations `smooth` à chaque
    // fragment. La mesure intervient après le rendu du nouveau contenu.
    const frame = requestAnimationFrame(() => {
      if (isNewMessage || followResponseRef.current) scrollToLatest();
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, streaming, scrollToLatest]);

  const handleSend = () => {
    if (!draft.trim() || streaming || attaching) return;
    void sendMessage(
      draft,
      resolvePagePath(),
      attachment ? { name: attachment.name, text: attachment.text } : undefined,
      styleReponse ?? undefined,
    );
    setDraft('');
    setAttachment(null);
    setAttachError(null);
    // La consigne de forme est PONCTUELLE : elle ne doit pas s'appliquer
    // silencieusement aux messages suivants.
    setStyleReponse(null);
  };

  // Handler STABLE pour les chips de suggestions rendues dans ChatMessageContent
  // (mémoïsé). Ne dépend PAS de `draft` -> la saisie ne casse pas la mémoïsation
  // des messages déjà rendus (cf. React.memo de ChatMessageContent).
  const handleSuggestion = useCallback(
    (prompt: string) => {
      if (streaming) return;
      const path =
        (typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined) || pagePath;
      void sendMessage(prompt, path);
    },
    [streaming, sendMessage, pagePath],
  );

  const handlePlanModification = useCallback(
    async (messageId: string, action: CopilotPendingAction) => {
      await rejectAction(messageId, action.pending_id);
      setDraft('Je souhaite modifier ce plan : ');
      requestAnimationFrame(() => {
        const input = composerInputRef.current;
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
      });
    },
    [rejectAction, setDraft],
  );

  // Action d'un résultat actionnable (bloc `entities`) : navigation, téléchargement
  // ou relance. Mêmes garde-fous que les intentions d'interface (client-side, au clic).
  const handleEntityAction = useCallback(
    (action: EntityAction) => {
      if (action.type === 'navigate') {
        if (typeof action.target === 'string' && action.target.startsWith('/dashboard') && isRoleAllowed(role)) {
          router.push(action.target);
        }
      } else if (action.type === 'download') {
        if (typeof action.url === 'string') {
          void downloadCopilotDocument(action.url, action.method || 'GET').catch(() => {});
        }
      } else if (action.type === 'prompt') {
        if (typeof action.prompt === 'string' && action.prompt.trim()) handleSuggestion(action.prompt);
      }
    },
    [router, role, handleSuggestion],
  );

  const w = c.welcome;
  const firstName = user?.first_name?.trim();

  // N'affiche « Ouvrir X » que pour une intention navigate vers une route autorisée.
  const navigableIntents = (intents: CopilotUiIntent[]) =>
    intents.filter(
      (i) =>
        i.type === 'navigate' &&
        typeof i.target === 'string' &&
        i.target.startsWith('/dashboard') &&
        isRoleAllowed(role),
    );

  // Documents téléchargeables proposés par l'agent (intention 'download').
  const downloadIntents = (intents: CopilotUiIntent[]) =>
    intents.filter((i) => i.type === 'download' && typeof i.url === 'string');

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white">
      <div
        ref={scrollRef}
        onScroll={handleConversationScroll}
        className={`flex-1 space-y-4 overflow-y-auto ${
          variant === 'fullscreen'
            ? 'bg-[#f8fafb] px-4 py-6 sm:px-7 lg:px-10'
            : 'bg-gray-50 p-4'
        }`}
      >
        {messages.length === 0 ? (
          /* Écran d'accueil : salutation + cartes de suggestion + chips.
             ALIGNÉ EN HAUT, pas centré. Le briefing arrive de façon asynchrone
             (~25 s d'appel LLM) : avec un centrage vertical, son apparition
             repoussait tout le contenu vers le bas sous les yeux de
             l'utilisateur, qui était peut-être en train de lire une carte.
             Aligné en haut, l'ajout se fait SOUS le point de lecture et rien
             ne bouge au-dessus. Aucun effet sur l'agent : c'est de la mise en
             page seule. Le contenu vient désormais du flux agent normal. */
          <div className="min-h-full flex flex-col justify-start py-4">
            <div className="w-full max-w-2xl mx-auto">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-100 bg-white shadow-sm">
                <Image src="/picto-targetym.png" alt="Targetym Copilote AI" width={38} height={38} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {w.greeting}{firstName ? ` ${firstName}` : ''}.
              </h2>
              <p className="text-sm text-gray-500 mt-1.5 mb-6">{w.subtitle}</p>

              {/* Briefing proactif du jour (adapté au rôle) : généré à l'ouverture. */}
              {(briefingLoading || briefing) && (
                <div className="mb-6 bg-white border border-primary-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-primary-50 px-4 py-2.5 flex items-center gap-2 border-b border-primary-100">
                    <Sparkles size={15} className="text-primary-600" />
                    <span className="text-sm font-semibold text-primary-800">{w.briefingTitle}</span>
                    {!briefingLoading && (
                      <button
                        onClick={() => void loadBriefing()}
                        className="ml-auto text-primary-500 hover:text-primary-700"
                        title={c.refresh}
                        aria-label={c.refresh}
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    {briefingLoading ? (
                      /* Hauteur réservée pendant l'attente, proche d'un point du
                         jour réel : combiné à l'alignement en haut, l'arrivée du
                         texte ne provoque plus qu'un ajustement discret vers le
                         bas au lieu de repousser toute la page. */
                      <div className="min-h-[5rem] flex items-start gap-2 text-gray-400 text-sm">
                        <Loader2 size={15} className="animate-spin mt-0.5" /> {w.briefingLoading}
                      </div>
                    ) : briefing ? (
                      <>
                        <ChatMessageContent
                          content={briefing.reply}
                          isUser={false}
                          onSuggestion={handleSuggestion}
                          onAction={handleEntityAction}
                        />
                        {((briefing.responseBlocks?.length ?? 0) > 0
                          || (briefing.artifacts?.length ?? 0) > 0) && (
                          <StructuredArtifacts
                            artifacts={structuredOutputArtifacts(
                              briefing.responseBlocks,
                              briefing.artifacts,
                            )}
                            onSuggestion={handleSuggestion}
                            onAction={handleEntityAction}
                          />
                        )}
                        {navigableIntents(briefing.uiIntents ?? []).map((intent, idx) => (
                          <button
                            key={`${intent.target}-${idx}`}
                            onClick={() => intent.target && router.push(intent.target)}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-100"
                          >
                            <ArrowUpRight size={15} />
                            {intent.label || c.openPage}
                          </button>
                        ))}
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ${
                variant === 'fullscreen' ? 'mx-auto w-full max-w-5xl' : ''
              }`}
            >
              {m.role === 'user' ? (
                <div className="max-w-[85%] bg-primary-600 text-white rounded-2xl px-4 py-2.5 break-words overflow-hidden">
                  {/* Pièce jointe matérialisée : carte cliquable -> aperçu du contenu */}
                  {m.attachment && (
                    <button
                      onClick={() => setPreview(m.attachment!)}
                      className="mb-2 w-full flex items-center gap-2 bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-2 text-left transition"
                      title={c.attach.preview}
                    >
                      <FileText size={18} className="flex-shrink-0" />
                      <span className="text-xs font-medium truncate">{m.attachment.name}</span>
                    </button>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 max-w-[90%] w-full">
                  {/* Avatar assistant */}
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-white shadow-sm" aria-label="Targetym Copilote AI">
                    <Image src="/picto-targetym.png" alt="" width={23} height={23} />
                  </div>
                  <div className="flex-1 min-w-0 bg-white text-gray-900 border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm break-words overflow-hidden">
                    {/* BANDEAU D'ÉTAT RETIRÉ (2026-08-11, demande de Christ).
                        Il répétait en amont ce que la réponse dit désormais mieux :
                        depuis que le serveur nomme le blocage, liste ce qui a
                        abouti et affiche le plan coché, le bandeau n'ajoutait
                        qu'un titre générique — « Demande encore incomplète », « Il
                        manque une information » — lu AVANT le détail réel, ce qui
                        donnait deux verdicts pour un seul tour et faisait paraître
                        vague une réponse qui ne l'était plus.

                        Le composant a finalement ete SUPPRIME plutot que laisse
                        mort : l'historique git suffit pour le reintroduire. Ses
                        cles i18n `outcome.*` restent en place, sans cout. */}
                    {/* Orchestration visible : plan VIVANT (étapes cochées au fur et
                        à mesure) pendant l'exécution d'un tour multi-étapes. */}
                    {m.streaming && m.steps && m.steps.length > 0 && (
                      <div className="mb-2 space-y-1.5">
                        {m.steps.map((s, i) => (
                          <div key={`${s.label}-${i}`} className="flex items-center gap-2 text-xs">
                            {s.done ? (
                              <CheckCircle size={13} className="text-emerald-600 flex-shrink-0" />
                            ) : (
                              <ThinkingGlyph compact />
                            )}
                            <span className={s.done ? 'text-gray-500' : 'text-gray-800 font-medium'}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.streaming && (() => {
                      const activeStep = m.steps?.find((step) => !step.done);
                      const label = m.narrativeStep
                        || activeStep?.label
                        || m.currentStep
                        || undefined;
                      return (
                        <ThinkingIndicator
                          key={`${m.id}-${label}`}
                          label={label}
                          startedAt={m.timestamp}
                        />
                      );
                    })()}
                    {m.content && (
                      <ChatMessageContent content={m.content} isUser={false} isStreaming={!!m.streaming} onSuggestion={handleSuggestion} onAction={handleEntityAction} />
                    )}
                    {!m.streaming && ((m.responseBlocks?.length ?? 0) > 0 || (m.artifacts?.length ?? 0) > 0) && (
                      <StructuredArtifacts
                        artifacts={structuredOutputArtifacts(m.responseBlocks, m.artifacts)}
                        onSuggestion={handleSuggestion}
                        onAction={handleEntityAction}
                      />
                    )}

                    {/* Une écriture n'est autorisée que par le bouton associé à
                        la proposition exacte. Le clic passe par le service qui
                        possède le plan, puis reprend automatiquement le tour
                        sans demander au modèle d'interpréter un simple « oui ». */}
                    {m.pendingActions
                      .filter((action) => action.approval_kind === 'mission_plan'
                        || action.payload?.approval_kind === 'mission_plan')
                      .map((action) => (
                        <PendingActionCard
                          key={action.pending_id}
                          action={action}
                          resolvedState={m.resolved[action.pending_id]}
                          feedback={m.actionFeedback[action.pending_id]}
                          onApprove={(pendingId) => approveAction(m.id, pendingId)}
                          onReject={(pendingId) => rejectAction(m.id, pendingId)}
                          onModify={(pending) => handlePlanModification(m.id, pending)}
                        />
                      ))}
                    {(() => {
                      const actions = m.pendingActions.filter(
                        (action) => action.approval_kind !== 'mission_plan'
                          && action.payload?.approval_kind !== 'mission_plan',
                      );
                      if (actions.length > 1) {
                        return (
                          <PendingGroup
                            actions={actions}
                            resolved={m.resolved}
                            actionFeedback={m.actionFeedback}
                            onApprove={(pendingId) => approveAction(m.id, pendingId)}
                            onReject={(pendingId) => rejectAction(m.id, pendingId)}
                          />
                        );
                      }
                      return actions.map((action) => (
                        <PendingActionCard
                          key={action.pending_id}
                          action={action}
                          resolvedState={m.resolved[action.pending_id]}
                          feedback={m.actionFeedback[action.pending_id]}
                          onApprove={(pendingId) => approveAction(m.id, pendingId)}
                          onReject={(pendingId) => rejectAction(m.id, pendingId)}
                        />
                      ));
                    })()}

                    {/* Intentions d'interface : consentement doux */}
                    {navigableIntents(m.uiIntents).map((intent, idx) => (
                      <button
                        key={`${intent.target}-${idx}`}
                        onClick={() => intent.target && router.push(intent.target)}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-100 transition"
                      >
                        <ArrowUpRight size={15} />
                        {intent.label || c.openPage}
                      </button>
                    ))}

                    {/* Documents téléchargeables (attestation, PDF signé, export…) */}
                    {downloadIntents(m.uiIntents).map((intent, idx) => (
                      <button
                        key={`dl-${intent.url}-${idx}`}
                        onClick={() => intent.url && void downloadCopilotDocument(intent.url, intent.method || 'GET').catch(() => {})}
                        className="mt-2 mr-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-100 transition"
                      >
                        <Download size={15} />
                        {intent.label || c.download}
                      </button>
                    ))}

                    {/* Barre de fin de réponse : copie + retour qualité.
                        Condition unique `m.content && !m.streaming` : rien ne
                        s'affiche tant que la réponse n'est pas terminée, donc le
                        bouton de copie n'existe que quand il y a réellement quelque
                        chose à copier. */}
                    {m.content && !m.streaming && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <CopyAnswerButton text={m.content} />
                          {feedbackGiven[m.id] ? (
                            <p className="text-[11px] text-gray-400">{c.feedback.thanks}</p>
                          ) : (
                            <>
                              <span className="text-[11px] text-gray-400 mx-0.5">{c.feedback.prompt}</span>
                              <button
                                onClick={() => submitFeedback(m.id, 'up')}
                                className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                                aria-label={c.feedback.up}
                                title={c.feedback.up}
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                onClick={() => { setCommentFor(m.id); setCommentText(''); }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                aria-label={c.feedback.down}
                                title={c.feedback.down}
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </>
                          )}
                        </div>
                        {commentFor === m.id && (
                          <div className="mt-2 flex items-end gap-2">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder={c.feedback.commentPlaceholder}
                              rows={2}
                              className="flex-1 resize-none border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                            <button
                              onClick={() => submitFeedback(m.id, 'down', commentText.trim() || undefined)}
                              className="text-xs font-medium bg-primary-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-primary-700 transition"
                            >
                              {c.feedback.send}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {streaming && showReturnToResponse && (
        <button
          type="button"
          onClick={scrollToLatest}
          className="absolute bottom-28 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          <ArrowDown size={15} />
          {c.returnToResponse}
        </button>
      )}

      <div
        className={
          variant === 'fullscreen'
            ? 'flex-shrink-0 border-t border-slate-100 bg-[#f8fafb] px-3 pb-4 pt-3 sm:px-6 sm:pb-5'
            : 'flex-shrink-0 bg-white p-3'
        }
      >
        <div className={variant === 'fullscreen' ? 'mx-auto w-full max-w-5xl' : 'mx-auto w-full max-w-3xl'}>
          {/* Pièce jointe : puce du fichier attaché + éventuel avertissement/erreur */}
          {attachment && (
            <div className="mb-2 flex max-w-full items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs text-primary-800">
              <FileText size={14} className="flex-shrink-0" />
              <span className="truncate">{attachment.name}</span>
              <button
                onClick={() => { setAttachment(null); setAttachError(null); }}
                className="ml-auto flex-shrink-0 text-primary-500 hover:text-primary-800"
                aria-label={c.attach.remove}
                title={c.attach.remove}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {attachError && <p className="mb-2 text-xs text-red-600">{attachError}</p>}

          {/* Le mode de réponse reste visible jusqu'à l'envoi et peut être retiré. */}
          {styleReponse && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 py-1 pl-2.5 pr-1.5 text-xs text-primary-800">
              <Sparkles size={12} className="flex-shrink-0" />
              <span>{styleReponse === 'detaille' ? c.plus.detailed : c.plus.brief}</span>
              <button
                onClick={() => setStyleReponse(null)}
                className="p-0.5 text-primary-500 hover:text-primary-800"
                aria-label={c.plus.remove}
                title={c.plus.remove}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div
            className={
              variant === 'fullscreen'
                ? 'relative flex items-end gap-1 rounded-[30px] border border-slate-200/90 bg-white p-2 pl-2.5 shadow-[0_18px_50px_-22px_rgba(15,23,42,0.32),0_3px_12px_rgba(15,23,42,0.06)] transition focus-within:border-primary-300 focus-within:shadow-[0_20px_55px_-22px_rgba(6,108,108,0.28),0_0_0_3px_rgba(6,108,108,0.08)]'
                : 'relative flex items-end gap-1 rounded-3xl border border-gray-300 bg-white px-1.5 py-1 shadow-sm transition focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary-500'
            }
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
            <MenuPlus
              ouvert={menuOuvert}
              setOuvert={setMenuOuvert}
              desactive={streaming || attaching}
              occupe={attaching}
              styleActif={styleReponse}
              setStyleActif={setStyleReponse}
              onJoindre={() => fileInputRef.current?.click()}
            />
            <textarea
              ref={composerInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={c.placeholder}
              rows={1}
              className={
                variant === 'fullscreen'
                  ? 'max-h-[160px] min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-base leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0'
                  : 'max-h-[160px] min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 placeholder:text-gray-400 focus:outline-none focus:ring-0'
              }
              style={{ maxHeight: '160px' }}
            />
          <CopilotMicButton
            phase={voice.phase}
            active={voice.active}
            busy={voice.busy}
            muted={voice.muted}
            fullscreen={variant === 'fullscreen'}
            onToggle={() => void voice.toggle()}
            onToggleMute={() => void voice.toggleMute()}
            labels={c.voice}
          />
          {streaming ? (
            <button
              onClick={() => void demanderArret()}
              disabled={!activeId || arretDemande}
              className={
                variant === 'fullscreen'
                  ? 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-white transition hover:bg-slate-800 disabled:cursor-default disabled:opacity-60'
                  : 'flex-shrink-0 rounded-full bg-gray-700 p-2.5 text-white transition-colors hover:bg-gray-800 disabled:cursor-default disabled:opacity-60'
              }
              aria-label={arretDemande ? c.stopping : c.stop}
              title={arretDemande ? c.stopping : c.stop}
            >
              {arretDemande
                ? <Loader2 size={20} className="animate-spin" />
                : <Square size={18} strokeWidth={2.5} />}
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!draft.trim() || attaching}
              className={
                variant === 'fullscreen'
                  ? 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-500 text-white shadow-[0_8px_18px_-8px_rgba(6,108,108,0.8)] transition hover:-translate-y-0.5 hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0'
                  : 'flex-shrink-0 rounded-full bg-primary-600 p-2.5 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40'
              }
              aria-label={c.send}
            >
              <Send size={20} />
            </button>
          )}
          </div>

          <p
            className={
              variant === 'fullscreen'
                ? 'mt-2.5 text-center text-[11px] leading-4 text-slate-400 sm:text-xs'
                : 'mt-2 text-center text-[11px] text-gray-400'
            }
          >
            {arretDemande ? c.stoppingHint : c.disclaimer}
          </p>
        </div>
      </div>

      {/* Aperçu du contenu d'un fichier joint (modale) */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
              <FileText size={18} className="text-primary-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-900 truncate">{preview.name}</span>
              <button
                onClick={() => setPreview(null)}
                className="ml-auto p-1 text-gray-400 hover:text-gray-700"
                aria-label={c.attach.remove}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {(() => {
                const table = parsePreviewTable(preview.text || '');
                if (table) {
                  const MAX = 200;
                  const shown = table.rows.slice(0, MAX);
                  return (
                    <>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-500 border-b border-gray-200 w-8">#</th>
                              {table.columns.map((col) => (
                                <th key={col} className="px-3 py-1.5 text-left font-semibold text-gray-900 border-b border-gray-200 whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {shown.map((row, ri) => (
                              <tr key={ri} className={ri % 2 ? 'bg-gray-50/50' : ''}>
                                <td className="px-2 py-1.5 text-gray-400 border-b border-gray-100">{ri + 1}</td>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-3 py-1.5 text-gray-700 border-b border-gray-100 whitespace-nowrap">{cell || '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {table.rows.length > MAX && (
                        <p className="text-[11px] text-gray-400 mt-2">
                          {table.rows.length - MAX} ligne(s) supplémentaire(s) non affichée(s).
                        </p>
                      )}
                    </>
                  );
                }
                return (
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                    {preview.text || '—'}
                  </pre>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Copie l'INTÉGRALITÉ d'une réponse de l'agent dans le presse-papiers.
 *
 * Le texte copié est le markdown brut du message, pas le DOM rendu : c'est ce qui
 * se recolle proprement dans un mail, un document ou un ticket. Retour visuel de
 * deux secondes, sans notification, pour ne pas empiler les toasts sur une
 * conversation longue.
 *
 * `navigator.clipboard` exige un contexte sécurisé (HTTPS, ou localhost). Quand il
 * est absent, le bouton ne s'affiche PAS : mieux vaut pas de bouton qu'un bouton
 * qui échoue en silence.
 */
function CopyAnswerButton({ text }: { text: string }) {
  const { t } = useI18n();
  const c = t.components.copilot;
  const [copie, setCopie] = useState(false);

  const disponible =
    typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
  if (!disponible || !text.trim()) return null;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* Refus du navigateur : on ne fait rien de visible, l'utilisateur peut
         toujours sélectionner le texte à la main. */
    }
  };

  return (
    <button
      onClick={() => void copier()}
      className={`p-1 rounded transition ${
        copie
          ? 'text-emerald-600'
          : 'text-gray-400 hover:text-primary-700 hover:bg-gray-100'
      }`}
      aria-label={copie ? c.copied : c.copyAnswer}
      title={copie ? c.copied : c.copyAnswer}
    >
      {copie ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}


/**
 * Menu « + » de la barre de saisie.
 *
 * Remplace le trombone : au lieu d'un bouton par capacite, une entree unique qui
 * ouvre la liste de ce qui peut ACCOMPAGNER la requete. Ce qui est choisi devient
 * une pastille visible dans la barre, donc rien ne part sans que l'utilisateur le
 * voie.
 *
 * REGLE QUE JE M'IMPOSE ICI : n'exposer que des elements que le runtime honore
 * reellement. Joindre un fichier existe deja ; les deux formes de reponse sont
 * transmises au serveur (`response_style`) et injectees dans le prompt comme
 * consigne encadree. Rien de decoratif — un mode affiche mais non cable serait
 * pire que pas de mode du tout.
 *
 * Les deux formes de reponse sont EXCLUSIVES : demander bref et detaille en meme
 * temps n'a pas de sens, donc choisir l'une remplace l'autre.
 */
function MenuPlus({
  ouvert,
  setOuvert,
  desactive,
  occupe,
  styleActif,
  setStyleActif,
  onJoindre,
}: {
  ouvert: boolean;
  setOuvert: (v: boolean) => void;
  desactive: boolean;
  occupe: boolean;
  styleActif: 'detaille' | 'bref' | null;
  setStyleActif: (v: 'detaille' | 'bref' | null) => void;
  onJoindre: () => void;
}) {
  const { t } = useI18n();
  const c = t.components.copilot;
  const zone = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur et à Échap : un menu qui ne se ferme que par son
  // propre bouton piège l'utilisateur.
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert, setOuvert]);

  const choisirStyle = (valeur: 'detaille' | 'bref') => {
    setStyleActif(styleActif === valeur ? null : valeur);
    setOuvert(false);
  };

  return (
    <div ref={zone} className="relative flex-shrink-0">
      <button
        onClick={() => setOuvert(!ouvert)}
        disabled={desactive}
        className={`p-2.5 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed ${
          ouvert ? 'bg-gray-100 text-primary-700' : 'text-gray-500 hover:text-primary-700 hover:bg-gray-100'
        }`}
        aria-label={c.plus.open}
        title={c.plus.open}
        aria-expanded={ouvert}
      >
        {occupe ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
      </button>

      {ouvert && (
        /* Le menu MONTE : la barre est en bas de l'écran, un menu descendant
           sortirait du cadre. */
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-60 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30"
        >
          <EntreeMenu
            icone={<Paperclip size={15} />}
            libelle={c.plus.attach}
            aide={c.plus.attachHint}
            onClick={() => { setOuvert(false); onJoindre(); }}
          />
          <div className="my-1 border-t border-gray-100" />
          <EntreeMenu
            icone={<AlignLeft size={15} />}
            libelle={c.plus.detailed}
            aide={c.plus.detailedHint}
            actif={styleActif === 'detaille'}
            onClick={() => choisirStyle('detaille')}
          />
          <EntreeMenu
            icone={<Zap size={15} />}
            libelle={c.plus.brief}
            aide={c.plus.briefHint}
            actif={styleActif === 'bref'}
            onClick={() => choisirStyle('bref')}
          />
        </div>
      )}
    </div>
  );
}

function EntreeMenu({
  icone,
  libelle,
  aide,
  actif = false,
  onClick,
}: {
  icone: React.ReactNode;
  libelle: string;
  aide: string;
  actif?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition ${
        actif ? 'bg-primary-50' : 'hover:bg-gray-50'
      }`}
    >
      <span className={`mt-0.5 flex-shrink-0 ${actif ? 'text-primary-700' : 'text-gray-400'}`}>
        {icone}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${actif ? 'font-medium text-primary-800' : 'text-gray-800'}`}>
          {libelle}
        </span>
        <span className="block text-[11px] text-gray-500 leading-snug">{aide}</span>
      </span>
      {actif && <Check size={14} className="ml-auto mt-0.5 flex-shrink-0 text-primary-700" />}
    </button>
  );
}
