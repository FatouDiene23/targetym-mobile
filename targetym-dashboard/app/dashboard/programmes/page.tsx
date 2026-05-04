'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LayoutList, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle,
  Circle, TrendingUp, DollarSign, Loader2, RefreshCw, Target, Users,
  Sparkles, BookOpen, Megaphone, Sprout, MessageSquare, Award, HeartHandshake,
  Flag, Building2, UserCheck, Link2, X, Unlink, Search,
  Lock, Download, Bell, LayoutGrid, Pencil, Trash2, Plus, Play, Eye,
  Upload, ImageIcon,
} from 'lucide-react';
import Header from '@/components/Header';
import CustomSelect from '@/components/CustomSelect';
import {
  HRProgram, HRProgramDetail, HRProgramAction, HRProgramsStats,
  HREmployeeItem, HROKRItem, HRProgramsAccess, HRActionInput,
  getHRPrograms, getHRProgram, updateHRAction, updateHRProgram, deleteHRProgram,
  seedHCTemplates, getHRProgramsStats, getHREmployeesList, getHROKRList,
  checkHRProgramsAccess, requestHRProgramsAddon, notifyOverdueActions, exportProgramCSV,
  createHRProgram, activateHRTemplate, uploadMediaImage, addHRAction, deleteHRAction,
} from '@/lib/api';

// ─── Constantes ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  T1: 'T1 — Diagnostic & Cadrage',
  T2: 'T2 — Déploiement initial',
  T3: 'T3 — Animation & Approfondissement',
  T4: 'T4 — Bilan & Pérennisation',
};
const PHASE_COLORS: Record<string, string> = {
  T1: 'bg-blue-100 text-blue-800 border-blue-200',
  T2: 'bg-green-100 text-green-800 border-green-200',
  T3: 'bg-orange-100 text-orange-800 border-orange-200',
  T4: 'bg-purple-100 text-purple-800 border-purple-200',
};
const PHASE_BAR: Record<string, string> = {
  T1: 'bg-blue-500', T2: 'bg-green-500', T3: 'bg-orange-500', T4: 'bg-purple-500',
};
const PHASE_HEADER_BG: Record<string, string> = {
  T1: 'bg-blue-50 hover:bg-blue-100', T2: 'bg-green-50 hover:bg-green-100',
  T3: 'bg-orange-50 hover:bg-orange-100', T4: 'bg-purple-50 hover:bg-purple-100',
};
const PHASE_TEXT: Record<string, string> = {
  T1: 'text-blue-700', T2: 'text-green-700', T3: 'text-orange-700', T4: 'text-purple-700',
};
const PHASE_BORDER_L: Record<string, string> = {
  T1: 'border-l-blue-400', T2: 'border-l-green-400', T3: 'border-l-orange-400', T4: 'border-l-purple-400',
};
const PHASE_ICON_BG: Record<string, string> = {
  T1: 'bg-blue-100', T2: 'bg-green-100', T3: 'bg-orange-100', T4: 'bg-purple-100',
};
const STATUS_CFG: Record<string, { label: string; badge: string }> = {
  todo:        { label: 'À faire',  badge: 'badge-ghost' },
  in_progress: { label: 'En cours', badge: 'badge-info' },
  done:        { label: 'Terminé',  badge: 'badge-success' },
  blocked:     { label: 'Bloqué',   badge: 'badge-error' },
};
const OKR_STATUS_LABELS: Record<string, string> = {
  on_track: 'En bonne voie', at_risk: 'À risque', behind: 'En retard',
  completed: 'Atteint', exceeded: 'Dépassé', active: 'Actif', draft: 'Brouillon',
};
const PROGRAM_ICONS: Record<string, React.ReactNode> = {
  'PRG-01': <HeartHandshake className="w-5 h-5" />,
  'PRG-02': <Users className="w-5 h-5" />,
  'PRG-03': <Megaphone className="w-5 h-5" />,
  'PRG-04': <Sprout className="w-5 h-5" />,
  'PRG-05': <MessageSquare className="w-5 h-5" />,
  'PRG-06': <Award className="w-5 h-5" />,
  'PRG-07': <TrendingUp className="w-5 h-5" />,
  'PRG-08': <Building2 className="w-5 h-5" />,
};

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

// ─── AddActionModal ───────────────────────────────────────────────────────────

function AddActionModal({ phase, phaseLabel, onAdd, onClose }: {
  phase: string;
  phaseLabel: string;
  onAdd: (phase: string, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    await onAdd(phase, label.trim());
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Ajouter une action — {phaseLabel}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Titre de l&apos;action <span className="text-red-500">*</span></label>
            <input
              autoFocus
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Ex : Organiser une session de sensibilisation…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={!label.trim() || saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ActionRow ────────────────────────────────────────────────────────────────

function ActionRow({ action, onUpdate, onDelete }: { action: HRProgramAction; onUpdate: (id: number, d: Partial<HRProgramAction>) => Promise<void>; onDelete: (id: number) => Promise<void> }) {
  const [status, setStatus] = useState(action.status);
  const [pct, setPct] = useState(action.progress_pct);
  const [comment, setComment] = useState(action.comment ?? '');
  const [budget, setBudget] = useState<string>(action.budget_amount != null ? String(action.budget_amount) : '');
  const [label, setLabel] = useState(action.action_label);
  const [labelDirty, setLabelDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async (partial: Partial<HRProgramAction>) => {
    setSaving(true);
    await onUpdate(action.id, partial);
    setSaving(false);
  };

  const cycleStatus = async () => {
    const order: HRProgramAction['status'][] = ['todo', 'in_progress', 'done', 'blocked'];
    const next = order[(order.indexOf(status) + 1) % order.length];
    setStatus(next);
    const newPct = next === 'done' ? 100 : next === 'todo' ? 0 : pct;
    setPct(newPct);
    await save({ status: next, progress_pct: newPct });
  };

  const cfg = STATUS_CFG[status] ?? STATUS_CFG.todo;

  return (
    <>
      {confirmDel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDel(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-900 mb-1">Supprimer cette action ?</p>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">&ldquo;{action.action_label}&rdquo; sera définitivement supprimée.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Annuler</button>
              <button onClick={async () => { setConfirmDel(false); await onDelete(action.id); }} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
      <div className={`border rounded-lg mb-2 transition-all ${status === 'done' ? 'opacity-60' : ''} ${status === 'blocked' ? 'border-red-200' : 'border-gray-200'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(!open)}>
          <button className={`badge ${cfg.badge} gap-1 shrink-0 cursor-pointer text-xs`} onClick={e => { e.stopPropagation(); cycleStatus(); }}>
            {status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" /> : status === 'in_progress' ? <Clock className="w-3.5 h-3.5" /> : status === 'blocked' ? <AlertCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            {cfg.label}
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-mono text-gray-400 mr-1.5">{action.action_code}</span>
            <span className="text-sm font-medium text-gray-800">{label}</span>
            {action.owner_name && <span className="ml-2 text-xs text-gray-400">· {action.owner_name}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />}
            <div className="w-14 bg-gray-100 rounded-full h-1.5 hidden sm:block">
              <div className="h-1.5 rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs w-8 text-right text-gray-400">{pct}%</span>
            <button className="text-gray-300 hover:text-red-400 transition-colors p-0.5" title="Supprimer" onClick={e => { e.stopPropagation(); setConfirmDel(true); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {open ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
          </div>
        </div>

        {/* Expanded panel */}
        {open && (
          <div className="border-t border-gray-100 px-4 pt-4 pb-4 space-y-4">
            {/* Titre éditable */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Titre de l&apos;action</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={label}
                  onChange={e => { setLabel(e.target.value); setLabelDirty(true); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                {labelDirty && (
                  <button
                    onClick={async () => { if (label.trim()) { await save({ action_label: label } as Partial<HRProgramAction>); setLabelDirty(false); } }}
                    className="px-3 py-2 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Sauvegarder
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {action.specific_objective && <div><p className="text-xs font-semibold text-gray-400 mb-1">Objectif spécifique</p><p className="text-xs text-gray-700">{action.specific_objective}</p></div>}
              {action.kpi_definition && <div><p className="text-xs font-semibold text-gray-400 mb-1">KPI / Critère de succès</p><p className="text-xs text-gray-700">{action.kpi_definition}</p></div>}
              {action.category && <div><p className="text-xs font-semibold text-gray-400 mb-1">Catégorie</p><p className="text-xs text-gray-700">{action.category}</p></div>}
              {action.owner_role && <div><p className="text-xs font-semibold text-gray-400 mb-1">Fonction responsable</p><p className="text-xs text-gray-700">{action.owner_role}</p></div>}
              {action.due_period && <div><p className="text-xs font-semibold text-gray-400 mb-1">Échéance</p><p className="text-xs text-gray-700">{action.due_period}</p></div>}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1">Budget (FCFA)</p>
                <input
                  type="number" min={0} step={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  onBlur={() => { const v = budget.trim() === '' ? null : Number(budget); if (v !== action.budget_amount) save({ budget_amount: v }); }}
                  placeholder="Ex : 500 000"
                />
              </div>
            </div>

            {/* Avancement */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">Avancement — {pct}%</p>
              <input type="range" min={0} max={100} step={5} value={pct}
                onChange={e => setPct(Number(e.target.value))}
                onMouseUp={() => save({ progress_pct: pct })}
                onTouchEnd={() => save({ progress_pct: pct })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary-500" />
            </div>

            {/* Statut */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1">Statut</p>
              <CustomSelect
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                value={status}
                onChange={v => { const s = v as HRProgramAction['status']; setStatus(s); save({ status: s }); }}
                options={Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))}
              />
            </div>

            {/* Commentaire */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1">Commentaire</p>
              <textarea rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                value={comment} onChange={e => setComment(e.target.value)}
                onBlur={() => comment !== (action.comment ?? '') && save({ comment })}
                placeholder="Mise à jour, note…" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── OKRChip ─────────────────────────────────────────────────────────────────

function OKRChip({ okr }: { okr: { title: string; progress: number; status: string | null } }) {
  const color = okr.status === 'on_track' || okr.status === 'completed' || okr.status === 'exceeded' ? 'text-secondary' :
                okr.status === 'at_risk' ? 'text-amber-600' :
                okr.status === 'behind' ? 'text-red-500' : 'text-primary-600';
  return (
    <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-100 rounded-lg px-2 py-1 text-xs max-w-xs">
      <Target className="w-3.5 h-3.5 text-primary-600 shrink-0" />
      <span className="truncate font-medium text-primary-800">{okr.title}</span>
      <span className={`ml-1 shrink-0 font-semibold ${color}`}>{Math.round(okr.progress)}%</span>
    </div>
  );
}

// ─── PlanGate ─────────────────────────────────────────────────────────────────

function PlanGate({ access, onRequest }: { access: HRProgramsAccess; onRequest: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [done, setDone] = useState(false);
  const canAddon = access.plan === 'premium' || access.plan === 'professional';

  const handleRequest = async () => {
    setRequesting(true);
    try { await onRequest(); setDone(true); }
    finally { setRequesting(false); }
  };

  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-10 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Programmes RH Structurants</h2>
        <p className="text-gray-500 mb-2">
          Cette fonctionnalité est réservée au plan <strong className="text-primary">Entreprise</strong>
          {canAddon && <> ou disponible via un <strong>add-on</strong> pour votre plan.</>}
        </p>
        <p className="text-xs text-gray-400 mb-8">Plan actuel : <span className="font-mono uppercase">{access.plan}</span></p>
        {done ? (
          <div className="alert alert-success">
            <CheckCircle2 className="w-5 h-5" />
            <span>Demande envoyée — notre équipe vous contactera sous 24h.</span>
          </div>
        ) : canAddon ? (
          <button className="btn btn-primary btn-lg gap-2" onClick={handleRequest} disabled={requesting}>
            {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Demander l'activation de l'add-on
          </button>
        ) : (
          <a href="mailto:contact@targetym.com?subject=Passage%20plan%20Entreprise" className="btn btn-primary btn-lg gap-2">
            <TrendingUp className="w-4 h-4" />
            Passer au plan Entreprise
          </a>
        )}
      </div>
    </div>
  );
}

// ─── ManagerTimeline ──────────────────────────────────────────────────────────

function ManagerTimeline({ programs, onSelect }: { programs: HRProgram[]; onSelect: (id: number) => void }) {
  const phases = ['T1', 'T2', 'T3', 'T4'] as const;
  const phaseLabels = ['Diagnostic', 'Déploiement', 'Animation', 'Bilan'];
  const phaseColors = {
    T1: { bar: 'bg-blue-500',   light: 'bg-blue-100',   text: 'text-blue-700' },
    T2: { bar: 'bg-green-500',  light: 'bg-green-100',  text: 'text-green-700' },
    T3: { bar: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700' },
    T4: { bar: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
  };

  // Progress within each 25% segment (T1=0-25, T2=25-50, T3=50-75, T4=75-100)
  function segPct(totalPct: number, phaseIdx: number): number {
    const segStart = phaseIdx * 25;
    const segEnd = (phaseIdx + 1) * 25;
    if (totalPct <= segStart) return 0;
    if (totalPct >= segEnd) return 100;
    return Math.round(((totalPct - segStart) / 25) * 100);
  }

  if (!programs.length) return (
    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
      <Flag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500">Aucun programme assigné</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      {/* Header */}
      <div className="grid gap-0 border-b border-gray-200 bg-gray-50 min-w-[700px]" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 56px' }}>
        <div className="p-3 text-xs font-semibold text-gray-500">Programme</div>
        {phases.map((p, i) => (
          <div key={p} className={`p-3 text-center text-xs font-bold ${phaseColors[p].text} border-l border-gray-100`}>
            <span className="block">{p}</span>
            <span className="font-normal opacity-70">{phaseLabels[i]}</span>
          </div>
        ))}
        <div className="p-3 text-center text-xs font-semibold text-gray-400 border-l border-gray-100">%</div>
      </div>
      {/* Rows */}
      {programs.map((prg) => (
        <div key={prg.id}
          className="grid gap-0 border-b border-gray-100 hover:bg-primary-50/50 cursor-pointer min-w-[700px] transition-colors"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 56px' }}
          onClick={() => onSelect(prg.id)}>
          <div className="p-3 flex items-center gap-2">
            <div className="p-1.5 bg-primary-50 text-primary-600 rounded shrink-0">
              {PROGRAM_ICONS[prg.program_code] ?? <BookOpen className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{prg.name}</p>
              <span className="text-[10px] text-gray-400 font-mono">{prg.program_code}</span>
              {prg.owner && <span className="text-[10px] text-gray-400 ml-1">· {prg.owner.name}</span>}
            </div>
          </div>
          {phases.map((p, i) => {
            const pct = segPct(prg.progress_pct, i);
            return (
              <div key={p} className="p-3 border-l border-gray-100 flex items-center">
                <div className={`w-full h-4 rounded ${phaseColors[p].light} overflow-hidden relative`}>
                  <div className={`h-full rounded ${phaseColors[p].bar} transition-all`} style={{ width: `${pct}%` }} />
                  {pct > 10 && pct < 95 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{pct}%</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="p-3 border-l border-gray-100 flex items-center justify-center">
            <span className={`text-sm font-bold ${prg.progress_pct >= 80 ? 'text-secondary' : prg.progress_pct >= 40 ? 'text-primary-500' : 'text-gray-400'}`}>
              {prg.progress_pct}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ProgramCard ──────────────────────────────────────────────────────────────

function ProgramCard({ program, onSelect }: { program: HRProgram; onSelect: (id: number) => void }) {
  const pc = program.progress_pct;
  const barBg = pc >= 80 ? 'bg-secondary' : pc >= 40 ? 'bg-primary-500' : pc > 0 ? 'bg-amber-400' : 'bg-gray-200';
  const headerGradient = pc >= 80
    ? 'from-teal-500 to-emerald-600'
    : pc >= 40
    ? 'from-primary-500 to-primary-700'
    : pc > 0
    ? 'from-amber-400 to-orange-500'
    : 'from-gray-400 to-gray-500';
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
      onClick={() => onSelect(program.id)}
    >
      {/* En-tête coloré */}
      <div className={`h-28 bg-gradient-to-br ${headerGradient} flex items-center justify-center relative overflow-hidden`}>
        {program.cover_image_url ? (
          <img src={program.cover_image_url} alt={program.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white [&_svg]:w-8 [&_svg]:h-8">
            {PROGRAM_ICONS[program.program_code] ?? <BookOpen className="w-8 h-8" />}
          </div>
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/90 ${
          program.status === 'active' ? 'text-green-700' :
          program.status === 'draft' ? 'text-amber-600' : 'text-gray-500'
        }`}>
          {program.status === 'active' ? 'Actif' : program.status === 'draft' ? 'Brouillon' : 'Archivé'}
        </span>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Eye className="w-10 h-10 text-white drop-shadow-lg" />
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{program.program_code}</span>
          {program.total_actions > 0 && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Target className="w-3 h-3" />{program.total_actions}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-sm text-gray-900 mb-2 line-clamp-2 leading-snug">{program.name}</h3>
        {program.owner && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <UserCheck className="w-3.5 h-3.5 text-primary-500 shrink-0" />
            <span className="truncate">{program.owner.name}</span>
          </div>
        )}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>{program.done_count}/{program.total_actions} terminées</span>
            <span className="font-semibold text-gray-600">{pc}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barBg}`} style={{ width: `${pc}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AssignPanel (RH/Admin only) ──────────────────────────────────────────────

function AssignPanel({ programId, currentOwner, currentOKR, onSaved }: {
  programId: number;
  currentOwner: HRProgram['owner'];
  currentOKR: HRProgram['linked_objective'];
  onSaved: () => void;
}) {
  const [employees, setEmployees] = useState<HREmployeeItem[]>([]);
  const [okrList, setOkrList] = useState<HROKRItem[]>([]);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [okrSearch, setOkrSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    Promise.all([getHREmployeesList(), getHROKRList()])
      .then(([emps, okrs]) => { setEmployees(emps); setOkrList(okrs); })
      .catch(() => setLoadErr(true));
  }, []);

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
    (e.job_title ?? '').toLowerCase().includes(ownerSearch.toLowerCase())
  );
  const filteredOkrs = okrList.filter(o =>
    o.title.toLowerCase().includes(okrSearch.toLowerCase())
  );

  const assignOwner = async (empId: number | null) => {
    setSaving(true);
    try { await updateHRProgram(programId, { owner_employee_id: empId }); onSaved(); }
    finally { setSaving(false); }
  };
  const assignOKR = async (okrId: number | null) => {
    setSaving(true);
    try { await updateHRProgram(programId, { linked_objective_id: okrId }); onSaved(); }
    finally { setSaving(false); }
  };

  if (loadErr) return <div className="text-xs text-error p-2">Erreur de chargement (droits insuffisants?)</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Owner */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm flex items-center gap-2 text-gray-700"><UserCheck className="w-4 h-4 text-primary-600" />Responsable programme</p>
          {currentOwner && (
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => assignOwner(null)} disabled={saving}>
              <Unlink className="w-3.5 h-3.5" />Retirer
            </button>
          )}
        </div>
        {currentOwner ? (
          <div className="flex items-center gap-2 bg-primary-100 rounded-lg p-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {currentOwner.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{currentOwner.name}</p>
              {currentOwner.job_title && <p className="text-xs text-gray-500">{currentOwner.job_title}</p>}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3 italic">Aucun responsable assigné</p>
        )}
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Rechercher un employé…"
            value={ownerSearch} onChange={e => setOwnerSearch(e.target.value)} />
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {filteredEmps.slice(0, 20).map(e => (
            <button key={e.id} className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex items-center justify-between ${currentOwner?.id === e.id ? 'bg-primary-50 font-semibold text-primary-800' : ''}`}
              onClick={() => assignOwner(e.id)} disabled={saving}>
              <span>{e.name} <span className="text-xs text-gray-400">{e.job_title}</span></span>
              {currentOwner?.id === e.id && <CheckCircle2 className="w-4 h-4 text-secondary" />}
            </button>
          ))}
          {filteredEmps.length === 0 && <p className="text-xs text-center py-2 text-gray-400">Aucun résultat</p>}
        </div>
      </div>

      {/* OKR Link */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm flex items-center gap-2 text-primary-800"><Link2 className="w-4 h-4 text-primary-600" />Objectif OKR lié</p>
          {currentOKR && (
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => assignOKR(null)} disabled={saving}>
              <Unlink className="w-3.5 h-3.5" />Délier
            </button>
          )}
        </div>
        {currentOKR ? (
          <div className="bg-primary-100 rounded-lg p-2 mb-3">
            <p className="text-sm font-semibold text-primary-800">{currentOKR.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-primary-200 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-primary-500 transition-all" style={{ width: `${currentOKR.progress}%` }} />
              </div>
              <span className="text-xs text-gray-500">{Math.round(currentOKR.progress)}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{currentOKR.period}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3 italic">Aucun objectif OKR lié</p>
        )}
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Rechercher un OKR…"
            value={okrSearch} onChange={e => setOkrSearch(e.target.value)} />
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {filteredOkrs.slice(0, 20).map(o => (
            <button key={o.id} className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex items-center justify-between ${currentOKR?.id === o.id ? 'bg-primary-50 font-semibold text-primary-800' : ''}`}
              onClick={() => assignOKR(o.id)} disabled={saving}>
              <span className="truncate">{o.title} <span className="text-xs text-gray-400">{o.period}</span></span>
              {currentOKR?.id === o.id && <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />}
            </button>
          ))}
          {okrList.length === 0 && !loadErr && <p className="text-xs text-center py-2 text-gray-400">Aucun OKR actif trouvé</p>}
          {filteredOkrs.length === 0 && okrList.length > 0 && <p className="text-xs text-center py-2 text-gray-400">Aucun résultat</p>}
        </div>
      </div>
    </div>
  );
}

// ─── ProgramDetail ────────────────────────────────────────────────────────────

// ─── EditProgramModal ─────────────────────────────────────────────────────────

function EditProgramModal({ detail, onSaved, onClose }: {
  detail: HRProgramDetail;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(detail.name);
  const [globalObjective, setGlobalObjective] = useState(detail.global_objective ?? '');
  const [scope, setScope] = useState(detail.scope ?? '');
  const [duration, setDuration] = useState(detail.duration ?? '');
  const [status, setStatus] = useState(detail.status);
  const [budgetAllocated, setBudgetAllocated] = useState<string>(
    detail.budget_allocated != null ? String(detail.budget_allocated) : ''
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(detail.cover_image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image trop lourde (max 5 Mo).'); return; }
    setUploading(true);
    try {
      const result = await uploadMediaImage(file);
      setCoverImageUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload image.');
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    setSaving(true);
    try {
      const budgetVal = budgetAllocated.trim() === '' ? null : Number(budgetAllocated);
      await updateHRProgram(detail.id, { name, global_objective: globalObjective, scope, duration, status, budget_allocated: budgetVal, cover_image_url: coverImageUrl });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-primary-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Modifier le programme</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du programme <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Ex: Programme Bien-être & Qualité de Vie"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <CustomSelect
              value={status}
              onChange={v => setStatus(v)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              options={[
                { value: 'active', label: 'Actif' },
                { value: 'draft', label: 'Brouillon' },
                { value: 'archived', label: 'Archivé' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
            <input
              type="text"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Ex: 12 mois (cycle annuel reconductible)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objectif global</label>
            <textarea
              rows={3}
              value={globalObjective}
              onChange={e => setGlobalObjective(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Décrire l'objectif stratégique de ce programme…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Périmètre / Population cible</label>
            <textarea
              rows={2}
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Ex: Tous les employés, Managers N+1…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image de couverture</label>
            {coverImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 h-32">
                <img src={coverImageUrl} alt="Couverture" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImageUrl(null)}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl h-28 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500">Cliquer pour uploader (JPEG, PNG, WebP — max 5 Mo)</span>
                  </>
                )}
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget alloué (FCFA)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={budgetAllocated}
              onChange={e => setBudgetAllocated(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Ex: 150 000 000"
            />
            <p className="text-xs text-gray-400 mt-1">Enveloppe prélevée sur le budget RH global</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-60 flex items-center gap-2 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProgramDetail ────────────────────────────────────────────────────────────

function ProgramDetail({ programId, isRH, onBack }: { programId: number; isRH: boolean; onBack: () => void }) {
  const [detail, setDetail] = useState<HRProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set(['T1', 'T2', 'T3', 'T4']));
  const [showAssign, setShowAssign] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addActionPhase, setAddActionPhase] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDetail(await getHRProgram(programId)); }
    finally { setLoading(false); }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateAction = useCallback(async (id: number, data: Partial<HRProgramAction>) => {
    await updateHRAction(id, data);
    setDetail(prev => {
      if (!prev) return prev;
      const phases = { ...prev.actions_by_phase };
      for (const p of ['T1', 'T2', 'T3', 'T4'] as const)
        phases[p] = phases[p].map(a => a.id === id ? { ...a, ...data } : a);
      return { ...prev, actions_by_phase: phases };
    });
  }, []);

  const handleDeleteAction = useCallback(async (id: number) => {
    await deleteHRAction(id);
    setDetail(prev => {
      if (!prev) return prev;
      const phases = { ...prev.actions_by_phase };
      for (const p of ['T1', 'T2', 'T3', 'T4'] as const)
        phases[p] = phases[p].filter(a => a.id !== id);
      return { ...prev, total_actions: prev.total_actions - 1 };
    });
    load();
  }, [load]);

  const handleAddAction = useCallback(async (phase: string, label: string) => {
    await addHRAction(programId, { action_label: label, phase });
    load();
  }, [programId, load]);

  const togglePhase = (p: string) => setOpenPhases(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteHRProgram(detail!.id);
      onBack();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="text-center py-20 text-error">Erreur de chargement</div>;

  return (
    <div>
      {showEdit && (
        <EditProgramModal detail={detail} onClose={() => setShowEdit(false)} onSaved={load} />
      )}
      {addActionPhase && (
        <AddActionModal
          phase={addActionPhase}
          phaseLabel={PHASE_LABELS[addActionPhase]}
          onAdd={handleAddAction}
          onClose={() => setAddActionPhase(null)}
        />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Supprimer le programme</h3>
              </div>
              <button onClick={() => setConfirmDelete(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 mb-1">Vous êtes sur le point de supprimer :</p>
              <p className="text-sm font-semibold text-gray-900 mb-4">&ldquo;{detail.name}&rdquo;</p>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                Toutes les actions associées seront supprimées définitivement. Cette action est irréversible.
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-60 flex items-center gap-2 transition-colors"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Hero */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
        {/* Bande couleur */}
        <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-secondary" />
        <div className="p-6">
          <div className="flex items-start gap-5">
            {/* Icône / image programme */}
            {detail.cover_image_url ? (
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-gray-100 shrink-0 shadow-sm">
                <img src={detail.cover_image_url} alt={detail.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 text-primary-600 flex items-center justify-center shrink-0 shadow-sm">
                {PROGRAM_ICONS[detail.program_code] ?? <BookOpen className="w-7 h-7" />}
              </div>
            )}

            {/* Infos principales */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{detail.program_code}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  detail.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' :
                  detail.status === 'draft'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                              'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                    detail.status === 'active' ? 'bg-green-500' : detail.status === 'draft' ? 'bg-amber-400' : 'bg-gray-400'
                  }`} />
                  {detail.status === 'active' ? 'Actif' : detail.status === 'draft' ? 'Brouillon' : 'Archivé'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-1">{detail.name}</h2>
              {detail.owner && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                  <UserCheck className="w-4 h-4 text-primary-500" />
                  <span className="font-medium text-gray-700">{detail.owner.name}</span>
                  {detail.owner.job_title && <span className="text-gray-400">&mdash; {detail.owner.job_title}</span>}
                </p>
              )}
            </div>

            {/* Progression circulaire */}
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none"
                    stroke={detail.progress_pct >= 80 ? '#0AAE8E' : detail.progress_pct >= 40 ? '#066C6C' : '#f59e0b'}
                    strokeWidth="3"
                    strokeDasharray={`${detail.progress_pct * 94.25 / 100} 94.25`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900 leading-none">{detail.progress_pct}%</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">{detail.done_count}/{detail.total_actions}<br/>actions</p>
            </div>
          </div>

          {/* Barre d'actions */}
          <div className="flex items-center gap-1 mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronDown className="w-4 h-4 rotate-90" />
              Retour
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button
              disabled={exporting}
              onClick={async () => { setExporting(true); try { await exportProgramCSV(detail.id, detail.program_code); } finally { setExporting(false); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exporter CSV
            </button>
            {isRH && (
              <>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />Modifier
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />Supprimer
                </button>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <button
                  onClick={() => setShowAssign(!showAssign)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    showAssign
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'text-primary-600 border border-primary-200 hover:bg-primary-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  {showAssign ? 'Masquer' : 'Assigner'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* OKR banner */}
      {detail.linked_objective && (
        <div className="mb-4 bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Target className="w-5 h-5 text-secondary" />
            <span className="font-semibold text-sm">OKR lié</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{detail.linked_objective.title}</p>
            <p className="text-xs text-gray-400">{detail.linked_objective.period} · {OKR_STATUS_LABELS[detail.linked_objective.status ?? ''] ?? detail.linked_objective.status}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-secondary" style={{ width: `${detail.linked_objective.progress}%` }} />
            </div>
            <span className="text-sm font-bold text-secondary">{Math.round(detail.linked_objective.progress)}%</span>
          </div>
        </div>
      )}

      {/* Owner banner — masqué si déjà visible dans le header */}

      {/* Stats mini */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gradient-to-br from-primary-50 to-indigo-50 border border-primary-100 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-1">Actions totales</p>
          <p className="text-2xl font-bold text-primary-700">{detail.total_actions}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Terminées</p>
          <p className="text-2xl font-bold text-green-700">{detail.done_count}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">En cours</p>
          <p className="text-2xl font-bold text-blue-700">
            {Object.values(detail.actions_by_phase).flat().filter(a => a.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Bloquées</p>
          <p className="text-2xl font-bold text-red-600">
            {Object.values(detail.actions_by_phase).flat().filter(a => a.status === 'blocked').length}
          </p>
        </div>
      </div>

      {/* Assign panel (RH only) */}
      {showAssign && isRH && (
        <div className="mb-6">
          <AssignPanel
            programId={detail.id}
            currentOwner={detail.owner}
            currentOKR={detail.linked_objective}
            onSaved={async () => { await load(); }}
          />
        </div>
      )}

      {/* Meta */}
      {(detail.global_objective || detail.scope || detail.duration) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {detail.global_objective && (
            <div className="bg-gradient-to-br from-primary-50 to-indigo-50 border-l-4 border-l-primary-400 border border-primary-100 rounded-xl p-4 flex gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Target className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-1">Objectif global</p>
                <p className="text-xs text-gray-600 leading-relaxed">{detail.global_objective}</p>
              </div>
            </div>
          )}
          {detail.scope && (
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border-l-4 border-l-violet-400 border border-violet-100 rounded-xl p-4 flex gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-violet-600 uppercase tracking-wide mb-1">Périmètre</p>
                <p className="text-xs text-gray-600 leading-relaxed">{detail.scope}</p>
              </div>
            </div>
          )}
          {detail.duration && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-l-4 border-l-amber-400 border border-amber-100 rounded-xl p-4 flex gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-600 uppercase tracking-wide mb-1">Durée</p>
                <p className="text-xs text-gray-600 leading-relaxed">{detail.duration}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {detail.strategic_kpis?.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 mb-2">KPIs stratégiques</p>
          <div className="flex flex-wrap gap-2">{detail.strategic_kpis.map((k, i) => <span key={i} className="badge badge-outline badge-sm">{k}</span>)}</div>
        </div>
      )}

      {/* Phases */}
      {(['T1', 'T2', 'T3', 'T4'] as const).map(phase => {
        const actions = detail.actions_by_phase[phase] ?? [];
        const doneN = actions.filter(a => a.status === 'done').length;
        const phasePct = actions.length ? Math.round((doneN / actions.length) * 100) : 0;
        const isOpen = openPhases.has(phase);
        return (
          <div key={phase} className={`mb-4 rounded-xl overflow-hidden border border-gray-200 border-l-4 ${PHASE_BORDER_L[phase]} shadow-sm`}>
            <button className={`w-full flex items-center justify-between px-5 py-3.5 ${PHASE_HEADER_BG[phase]} transition-colors`} onClick={() => togglePhase(phase)}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${PHASE_ICON_BG[phase]} rounded-lg flex items-center justify-center shrink-0`}>
                  <span className={`text-xs font-extrabold ${PHASE_TEXT[phase]}`}>{phase}</span>
                </div>
                <div>
                  <span className={`font-bold text-sm ${PHASE_TEXT[phase]}`}>{PHASE_LABELS[phase]}</span>
                  <span className="text-xs text-gray-400 ml-2">{doneN}/{actions.length} actions</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full ${PHASE_BAR[phase]} transition-all`} style={{ width: `${phasePct}%` }} />
                </div>
                <span className={`text-xs font-bold ${PHASE_TEXT[phase]} w-10 text-right`}>{phasePct}%</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>
            {isOpen && (
              <div className="p-4">
                {actions.map(a => <ActionRow key={a.id} action={a} onUpdate={handleUpdateAction} onDelete={handleDeleteAction} />)}
                <button
                  onClick={() => setAddActionPhase(phase)}
                  className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed text-xs font-medium transition-colors ${PHASE_TEXT[phase]} border-current opacity-60 hover:opacity-100`}
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une action {phase}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CreateProgramModal ───────────────────────────────────────────────────────

function CreateProgramModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  // ── Step 1 : info programme ─────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [objective, setObjective] = useState('');
  const [scope, setScope] = useState('');
  const [duration, setDuration] = useState('');
  const [budget, setBudget] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Step 2 : actions ─────────────────────────────────────────────────────
  const [actions, setActions] = useState<HRActionInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addAction = () => setActions(prev => [...prev, { action_label: '', phase: 'T1', budget_amount: null }]);
  const removeAction = (i: number) => setActions(prev => prev.filter((_, idx) => idx !== i));
  const updateAction = (i: number, field: keyof HRActionInput, value: string | number | null) =>
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const res = await uploadMediaImage(file);
      setCoverImageUrl(res.url);
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : 'Erreur upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Le nom est requis.'); return; }
    setErr(null);
    setStep(2);
  };

  const handleSubmit = async () => {
    // Valider les actions : chaque action doit avoir un label
    const badAction = actions.find(a => !a.action_label.trim());
    if (badAction) { setErr("Chaque action doit avoir un libellé."); return; }
    setSaving(true); setErr(null);
    try {
      await createHRProgram({
        name: name.trim(),
        program_code: code.trim() || undefined,
        global_objective: objective.trim() || undefined,
        scope: scope.trim() || undefined,
        duration: duration.trim() || undefined,
        budget_allocated: budget ? parseFloat(budget) : undefined,
        cover_image_url: coverImageUrl || undefined,
        actions: actions.length > 0 ? actions.map(a => ({
          ...a,
          action_label: a.action_label.trim(),
          budget_amount: a.budget_amount ?? null,
        })) : undefined,
      });
      onCreated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Nouveau programme RH</h2>
              <p className="text-xs text-gray-400">Étape {step}/2 — {step === 1 ? 'Informations' : 'Actions du programme'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-50 shrink-0">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? 'bg-primary-500 text-white' : step > s ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
              <span className={`text-xs ${step === s ? 'font-medium text-gray-700' : 'text-gray-400'}`}>{s === 1 ? 'Informations' : 'Actions'}</span>
              {s < 2 && <div className={`h-0.5 w-8 rounded ${step > s ? 'bg-secondary' : 'bg-gray-100'}`} />}
            </div>
          ))}
        </div>

        {err && <p className="mx-6 mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 shrink-0">{err}</p>}

        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleNext} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom du programme <span className="text-red-500">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                placeholder="Ex: Programme Marque Employeur 2025" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code programme <span className="text-xs text-gray-400">(optionnel, auto-généré si vide)</span></label>
              <input value={code} onChange={e => setCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 font-mono"
                placeholder="Ex: PRG-CUSTOM-01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Objectif global</label>
              <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-none"
                placeholder="Décrivez l'objectif de ce programme…" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Périmètre</label>
                <input value={scope} onChange={e => setScope(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                  placeholder="Ex: Tous collaborateurs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Durée</label>
                <input value={duration} onChange={e => setDuration(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                  placeholder="Ex: 12 mois" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Budget alloué (FCFA)</label>
              <input type="number" min="0" step="1000" value={budget} onChange={e => setBudget(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                placeholder="Ex: 50 000 000" />
            </div>
            {/* Image de couverture */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Image de couverture <span className="text-gray-400">(optionnelle)</span></label>
              {coverImageUrl ? (
                <div className="relative rounded-xl overflow-hidden h-28 bg-gray-100 mb-1">
                  <img src={coverImageUrl} alt="Couverture" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setCoverImageUrl(null)}
                    className="absolute top-2 right-2 w-6 h-6 bg-white/80 hover:bg-white rounded-full flex items-center justify-center transition-colors shadow-sm">
                    <X className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-gray-300 mb-1" />
                      <span className="text-xs text-gray-400">Cliquez pour uploader une image</span>
                      <span className="text-[10px] text-gray-300 mt-0.5">JPEG, PNG, WebP — 5 Mo max</span>
                    </>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
              <button type="submit" className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">
                Suivant →
              </button>
            </div>
          </form>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Ajoutez les actions à réaliser dans ce programme. Vous pourrez en ajouter d'autres plus tard.</p>
              <button type="button" onClick={addAction}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors shrink-0">
                <Plus className="w-3.5 h-3.5" /> Ajouter une action
              </button>
            </div>

            {actions.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                <Play className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune action ajoutée</p>
                <p className="text-xs text-gray-400">Optionnel — vous pouvez créer le programme sans actions</p>
                <button type="button" onClick={addAction} className="mt-3 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors mx-auto">
                  <Plus className="w-3.5 h-3.5" /> Ajouter la première action
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {actions.map((action, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-gray-400">Action {i + 1}</span>
                      <button type="button" onClick={() => removeAction(i)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Libellé <span className="text-red-500">*</span></label>
                      <input value={action.action_label} onChange={e => updateAction(i, 'action_label', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                        placeholder="Ex: Lancer une enquête de perception interne" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phase</label>
                        <CustomSelect value={action.phase || 'T1'} onChange={v => updateAction(i, 'phase', v)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 bg-white"
                          options={[
                            { value: 'T1', label: 'T1 — Diagnostic' },
                            { value: 'T2', label: 'T2 — Déploiement' },
                            { value: 'T3', label: 'T3 — Animation' },
                            { value: 'T4', label: 'T4 — Bilan' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Budget (FCFA)</label>
                        <input type="number" min="0" step="1000"
                          value={action.budget_amount ?? ''}
                          onChange={e => updateAction(i, 'budget_amount', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                          placeholder="Ex: 500 000" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Échéance</label>
                      <input value={action.due_period || ''} onChange={e => updateAction(i, 'due_period', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                        placeholder="Ex: T1 — Mois 2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2 shrink-0">
              <button type="button" onClick={() => { setStep(1); setErr(null); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">← Retour</button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
                <button type="button" onClick={handleSubmit} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer le programme
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ program, onActivate, activating }: { program: HRProgram; onActivate: (id: number) => void; activating: boolean }) {
  const icon = PROGRAM_ICONS[program.program_code] ?? <Flag className="w-5 h-5" />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:border-primary-200 hover:shadow-sm transition-all h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 shrink-0">
            {icon}
          </div>
          <div>
            <span className="text-[10px] font-mono text-gray-400 leading-none">{program.program_code}</span>
            <h3 className="text-sm font-semibold text-gray-900 leading-tight mt-0.5">{program.name}</h3>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Template</span>
      </div>
      {program.global_objective && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{program.global_objective}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        {program.total_actions > 0 && (
          <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {program.total_actions} actions</span>
        )}
        {program.total_budget > 0 && (
          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {fmt(program.total_budget)}</span>
        )}
      </div>
      <button
        onClick={() => onActivate(program.id)}
        disabled={activating}
        className="mt-auto flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
      >
        {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        Activer ce programme
      </button>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProgrammesPage() {
  const [programs, setPrograms] = useState<HRProgram[]>([]);
  const [templates, setTemplates] = useState<HRProgram[]>([]);
  const [stats, setStats] = useState<HRProgramsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'programmes'>('programmes');
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRH, setIsRH] = useState(false);
  const [access, setAccess] = useState<HRProgramsAccess | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [rhBudget, setRhBudget] = useState<number | null>(null);
  const [rhBudgetEdit, setRhBudgetEdit] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('rh_budget_total');
    if (stored && !isNaN(Number(stored)) && Number(stored) > 0) setRhBudget(Number(stored));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [progs, tmpls, st, acc] = await Promise.all([
        getHRPrograms(false),
        getHRPrograms(true),
        getHRProgramsStats(),
        checkHRProgramsAccess(),
      ]);
      setPrograms(progs);
      setTemplates(tmpls);
      setStats(st);
      setAccess(acc);
      getHREmployeesList().then(() => setIsRH(true)).catch(() => setIsRH(false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSeed = async () => {
    setSeeding(true); setSeedMsg(null);
    try {
      const r = await seedHCTemplates();
      setSeedMsg(`✓ ${r.created} programme(s) créé(s), ${r.skipped} déjà existant(s).`);
      await loadAll();
    } catch (e) {
      setSeedMsg('Erreur : ' + (e instanceof Error ? e.message : String(e)));
    } finally { setSeeding(false); }
  };

  const handleNotifyOverdue = async () => {
    setNotifying(true); setNotifyMsg(null);
    try {
      const r = await notifyOverdueActions();
      setNotifyMsg(`✓ ${r.notified} notification(s) envoyée(s) (${r.checked} action(s) vérifiée(s)).`);
    } catch (e) {
      setNotifyMsg('Erreur : ' + (e instanceof Error ? e.message : String(e)));
    } finally { setNotifying(false); }
  };

  const handleActivateTemplate = async (templateId: number) => {
    setActivatingId(templateId);
    try {
      await activateHRTemplate(templateId);
      setSeedMsg('✓ Programme activé avec succès.');
      setActiveTab('programmes');
      await loadAll();
    } catch (e) {
      setSeedMsg('Erreur : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setActivatingId(null);
    }
  };

  // Plan gate: si accès refusé, afficher le gate (pas le spinner — on attend d'avoir la réponse)
  if (!loading && access && !access.has_access) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Programmes RH" />
        <div className="max-w-3xl mx-auto p-6">
          <PlanGate access={access} onRequest={async () => { await requestHRProgramsAddon(); }} />
        </div>
      </div>
    );
  }

  if (selectedId !== null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Programmes RH" />
        <div className="max-w-5xl mx-auto p-6">
          <ProgramDetail programId={selectedId} isRH={isRH} onBack={() => { setSelectedId(null); loadAll(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Programmes RH" />
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Programmes actifs */}
            <div className="bg-gradient-to-br from-primary-50 to-indigo-50 border border-primary-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide">Programmes actifs</p>
                <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Flag className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-primary-700">{stats.active_programs}</p>
              <p className="text-xs text-primary-400 mt-1">sur {stats.total_programs} au total</p>
              <div className="mt-3 h-1.5 bg-primary-100 rounded-full">
                <div className="h-1.5 bg-primary-500 rounded-full transition-all" style={{ width: `${stats.total_programs ? Math.round(stats.active_programs / stats.total_programs * 100) : 0}%` }} />
              </div>
            </div>

            {/* Actions terminées */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Actions terminées</p>
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-green-700">{stats.done_actions}</p>
              <p className="text-xs text-green-500 mt-1">sur {stats.total_actions} actions totales</p>
              <div className="mt-3 h-1.5 bg-green-100 rounded-full">
                <div className="h-1.5 bg-green-500 rounded-full transition-all" style={{ width: `${stats.total_actions ? Math.round(stats.done_actions / stats.total_actions * 100) : 0}%` }} />
              </div>
            </div>

            {/* Avancement global — donut SVG */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-xl p-5 flex items-center gap-4">
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                  <circle cx="18" cy="18" r="14" fill="none"
                    stroke={stats.global_progress_pct >= 70 ? '#10b981' : stats.global_progress_pct >= 40 ? '#f59e0b' : '#f87171'}
                    strokeWidth="4"
                    strokeDasharray={`${stats.global_progress_pct * 87.96 / 100} 87.96`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-violet-700">{stats.global_progress_pct}%</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-2">Avancement global</p>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  <span className="text-xs text-violet-600">{stats.in_progress_actions} en cours</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <span className="text-xs text-violet-600">{stats.blocked_actions} bloquées</span>
                </div>
              </div>
            </div>

            {/* Budget RH */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Budget RH</p>
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              {rhBudgetEdit ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    autoFocus
                    className="flex-1 px-2 py-1 border border-amber-200 bg-white/90 rounded-lg text-sm font-mono focus:ring-2 focus:ring-white focus:border-white outline-none"
                    value={rhBudget ?? ''}
                    onChange={e => setRhBudget(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="Ex: 500 000 000"
                    onKeyDown={e => { if (e.key === 'Enter') { setRhBudgetEdit(false); localStorage.setItem('rh_budget_total', String(rhBudget ?? '')); } }}
                  />
                  <button
                    onClick={() => { setRhBudgetEdit(false); localStorage.setItem('rh_budget_total', String(rhBudget ?? '')); }}
                    className="px-2.5 py-1 text-xs bg-white text-orange-600 rounded-lg hover:bg-amber-50 transition-colors font-medium"
                  >OK</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2 group cursor-pointer" onClick={() => setRhBudgetEdit(true)}>
                  <p className="text-lg font-bold font-mono text-orange-700 leading-tight truncate flex-1">
                    {rhBudget != null ? fmt(rhBudget) : <span className="text-amber-400 text-sm italic font-normal">Définir l&apos;enveloppe…</span>}
                  </p>
                  <Pencil className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600 transition-colors shrink-0" />
                </div>
              )}
              {rhBudget != null && rhBudget > 0 && (() => {
                const allocated = programs.reduce((sum, p) => sum + (p.budget_allocated ?? 0), 0);
                const consumed = stats.total_budget;
                const pctAlloc = Math.min(100, Math.round(allocated / rhBudget * 100));
                const pctConsumed = Math.min(100, Math.round(consumed / rhBudget * 100));
                const restant = rhBudget - consumed;
                return (
                  <div className="space-y-2 mt-2 border-t border-white/20 pt-2">
                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-amber-600">Alloué</span>
                        <span className="font-mono font-bold text-orange-700">{fmt(allocated)} <span className="text-amber-400">({pctAlloc}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-amber-100 rounded-full"><div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${pctAlloc}%` }} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-amber-600">Consommé</span>
                        <span className="font-mono font-bold text-orange-700">{fmt(consumed)} <span className="text-amber-400">({pctConsumed}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-amber-100 rounded-full"><div className="h-1.5 bg-orange-400 rounded-full" style={{ width: `${pctConsumed}%` }} /></div>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-amber-100">
                      <span className="text-amber-600">Restant</span>
                      <span className={`font-mono font-bold ${restant < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt(restant)}</span>
                    </div>
                  </div>
                );
              })()}
              {(rhBudget == null || rhBudget === 0) && (
                <p className="text-xs text-amber-500 mt-1">Cliquez pour définir l&apos;enveloppe globale</p>
              )}
            </div>

          </div>
        )}

        {/* Toolbar — tabs + actions */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('programmes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                activeTab === 'programmes' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Flag className="w-4 h-4" />
              Programmes actifs
              {programs.length > 0 && (
                <span className="ml-1 text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">{programs.length}</span>
              )}
            </button>
            {isRH && (
              <button
                onClick={() => setActiveTab('templates')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                  activeTab === 'templates' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Templates
                {templates.length > 0 && (
                  <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{templates.length}</span>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {activeTab === 'programmes' && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setViewMode('grid')} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
                  <LayoutGrid className="w-4 h-4" /> Grille
                </button>
                <button onClick={() => setViewMode('timeline')} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === 'timeline' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
                  <LayoutList className="w-4 h-4" /> Timeline
                </button>
              </div>
            )}
            <button onClick={loadAll} disabled={loading} className="flex items-center justify-center w-9 h-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors" title="Actualiser">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {isRH && (
              <>
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <button onClick={handleNotifyOverdue} disabled={notifying} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                  {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Notifier retards
                </button>
                {templates.length === 0 && (
                  <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                    {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Charger templates
                  </button>
                )}
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">
                  <Plus className="w-4 h-4" />
                  Créer un programme
                </button>
              </>
            )}
          </div>
        </div>

        {notifyMsg && <div className={`text-sm px-4 py-2 rounded-lg ${notifyMsg.startsWith('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{notifyMsg}</div>}
        {seedMsg && <div className={`text-sm px-4 py-2 rounded-lg ${seedMsg.startsWith('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{seedMsg}</div>}
        {error && <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-red-50 text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
        ) : activeTab === 'templates' ? (
          templates.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
              <Sparkles className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="font-semibold text-gray-500">Aucun template chargé</p>
              <p className="text-sm text-gray-400 mt-1">Cliquez sur &quot;Charger templates&quot; pour initialiser les 8 programmes standards.</p>
              <button onClick={handleSeed} disabled={seeding} className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 mx-auto">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Charger les 8 templates
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map(t => (
                <TemplateCard
                  key={t.id}
                  program={t}
                  onActivate={handleActivateTemplate}
                  activating={activatingId === t.id}
                />
              ))}
            </div>
          )
        ) : programs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
            <Flag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-500">
              {isRH ? 'Aucun programme actif' : 'Aucun programme assigné'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {isRH
                ? 'Activez un template ou créez un programme personnalisé.'
                : 'Contactez votre équipe RH pour être assigné à un programme.'}
            </p>
            {isRH && (
              <div className="mt-4 flex items-center gap-2 justify-center">
                <button onClick={() => setActiveTab('templates')} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <Sparkles className="w-4 h-4" /> Voir les templates
                </button>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">
                  <Plus className="w-4 h-4" /> Créer un programme
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'timeline' ? (
          <ManagerTimeline programs={programs} onSelect={setSelectedId} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {programs.map(p => <ProgramCard key={p.id} program={p} onSelect={setSelectedId} />)}
          </div>
        )}

        {showCreate && (
          <CreateProgramModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); setSeedMsg('✓ Programme créé avec succès.'); setActiveTab('programmes'); loadAll(); }}
          />
        )}
      </div>
    </div>
  );
}
