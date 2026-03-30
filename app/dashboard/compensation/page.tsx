'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  DollarSign, Scale, Shield, TrendingUp, Calculator, FileText, Building2,
  Plus, RefreshCw, ChevronRight, AlertTriangle, CheckCircle, XCircle,
  Eye, Send, ThumbsUp, ThumbsDown, Download, Search, Filter,
  Briefcase, BarChart3, Layers, Star, ArrowRight, Mail,
  X, ChevronDown, Upload, FileDown, Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

// ── Types ───────────────────────────────────────────────────

interface TenantConfig {
  id: number;
  tenant_id: number;
  default_currency: string;
  default_country: string | null;
  active_agreement_ids: number[] | null;
  reminder_days_before_cc_update: number;
  workflow_approver_id: number | null;
}

interface IpeCriteria {
  id: number;
  tenant_id: number | null;
  criterion: string;
  label: string;
  levels: { level: number; label: string; points: number }[];
  weight: number;
  is_active: boolean;
}

interface JobEvaluation {
  id: number;
  tenant_id: number;
  job_id: number | null;
  job_title: string | null;
  job_family: string | null;
  country: string | null;
  scores: Record<string, number>;
  total_score: number;
  mercer_band: string | null;
  market_p25: number | null;
  market_p50: number | null;
  market_p75: number | null;
  currency: string | null;
  conformity_status: string;
  evaluated_by_id: number | null;
  evaluated_at: string | null;
  salary_grid?: SalaryGrid | null;
}

interface CollectiveAgreement {
  id: number;
  tenant_id: number | null;
  country: string;
  sector: string | null;
  name: string;
  version: string | null;
  effective_date: string;
  is_active: boolean;
  source_url: string | null;
}

interface CcCategory {
  id: number;
  agreement_id: number;
  category_code: string;
  category_label: string;
  min_salary: number;
  currency: string;
  mercer_band_min: string | null;
  mercer_band_max: string | null;
}

interface SalaryGrid {
  id: number;
  tenant_id: number;
  evaluation_id: number;
  cc_category_id: number | null;
  country: string;
  currency: string;
  min_salary: number;
  mid_salary: number;
  max_salary: number;
  cc_minimum: number | null;
  conformity_status: string;
  reconciliation_notes: string | null;
  generated_at: string | null;
}

interface Simulation {
  id: number;
  tenant_id: number;
  title: string;
  budget_type: string;
  budget_value: number;
  currency: string;
  policy: string;
  scope_type: string;
  scope_id: number | null;
  status: string;
  year: number;
  created_by_id: number;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  lines?: SimulationLine[];
  lines_count?: number;
}

interface SimulationLine {
  id: number;
  simulation_id: number;
  employee_id: number;
  current_salary: number;
  proposed_increase_pct: number;
  proposed_salary: number;
  cc_minimum: number | null;
  conformity_status: string;
  employee_name?: string;
  employee_job_title?: string;
}

interface Department {
  id: number;
  name: string;
}

// ── Helpers ─────────────────────────────────────────────────

const conformityBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    conforme:    { bg: 'bg-green-100', text: 'text-green-700', label: 'Conforme' },
    a_reviser:   { bg: 'bg-orange-100', text: 'text-orange-700', label: 'A réviser' },
    bloquant:    { bg: 'bg-red-100', text: 'text-red-700', label: 'Bloquant' },
    non_evalue:  { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Non évalué' },
  };
  const s = map[status] || map.non_evalue;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
};

const simStatusBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    brouillon: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Brouillon' },
    soumis:    { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Soumis' },
    approuve:  { bg: 'bg-green-100', text: 'text-green-700', label: 'Approuvé' },
    rejete:    { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejeté' },
  };
  const s = map[status] || map.brouillon;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
};

const fmt = (n: number | null | undefined, currency = 'XOF') => {
  if (n == null) return '-';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
};

type TabId = 'dashboard' | 'evaluations' | 'agreements' | 'grids' | 'simulations';

// ═════════════════════════════════════════════════════════════
// TEASING PAGE
// ═════════════════════════════════════════════════════════════

function TeasingPage() {
  const pillars = [
    {
      icon: Scale,
      title: 'Pesée IPE (Mercer)',
      desc: 'Évaluez chaque poste selon 4 critères universels : Impact, Communication, Innovation, Knowledge.',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Shield,
      title: 'Convention Collective',
      desc: 'Conformité légale automatique par pays. Import des CC et vérification des minima salariaux.',
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: RefreshCw,
      title: 'Moteur de réconciliation',
      desc: 'Croisement IPE × CC en temps réel. Détection automatique des écarts et ajustements.',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: Calculator,
      title: 'Simulateur',
      desc: 'Testez vos scénarios de révision salariale : uniforme, ancienneté ou par catégorie.',
      color: 'from-amber-500 to-amber-600',
    },
  ];

  return (
    <div>
      <Header title="Compensation & Benefits" subtitle="Pilotez vos rémunérations avec précision et conformité légale" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Badge Premium */}
        <div className="flex justify-end mb-4">
          <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> Add-on Premium
          </span>
        </div>

        {/* Hero */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mx-auto mb-5">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Compensation & Benefits</h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-6">
            Pilotez vos grilles salariales, assurez la conformité avec les conventions collectives,
            et simulez vos campagnes de révision en quelques clics.
          </p>
        </div>

        {/* 4 Piliers */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {pillars.map((p) => (
            <div key={p.title} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-4`}>
                <p.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{p.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href="mailto:contact@agiltym.com?subject=Demande de démo — Module C%26B&body=Bonjour, je souhaite une démonstration du module Compensation %26 Benefits."
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium shadow-sm"
          >
            <Mail className="w-5 h-5" />
            Demander une démo
          </a>
          <p className="text-xs text-gray-400 mt-3">Notre équipe vous contacte sous 24 h.</p>
        </div>
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════

export default function CompensationPage() {
  // Auth & role
  const [userRole, setUserRole] = useState('');
  const [hasCbModule, setHasCbModule] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Data
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [evaluations, setEvaluations] = useState<JobEvaluation[]>([]);
  const [evalTotal, setEvalTotal] = useState(0);
  const [agreements, setAgreements] = useState<CollectiveAgreement[]>([]);
  const [grids, setGrids] = useState<SalaryGrid[]>([]);
  const [gridsTotal, setGridsTotal] = useState(0);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [simTotal, setSimTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters
  const [evalPage, setEvalPage] = useState(1);
  const [evalCountry, setEvalCountry] = useState('');
  const [evalConformity, setEvalConformity] = useState('');
  const [gridPage, setGridPage] = useState(1);
  const [gridCountry, setGridCountry] = useState('');
  const [gridConformity, setGridConformity] = useState('');
  const [simPage, setSimPage] = useState(1);
  const [searchEval, setSearchEval] = useState('');
  const [evalManualTitle, setEvalManualTitle] = useState(false);

  // Modals
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [showSimDetail, setShowSimDetail] = useState<Simulation | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<CollectiveAgreement | null>(null);
  const [categories, setCategories] = useState<CcCategory[]>([]);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; errors: { line: number; message: string }[]; done: boolean } | null>(null);
  const [evalImportProgress, setEvalImportProgress] = useState<{ current: number; total: number; errors: { line: number; message: string }[]; done: boolean } | null>(null);

  // Eval form
  const [evalForm, setEvalForm] = useState({
    job_title: '', job_family: '', country: '', currency: 'XOF',
    scores: { impact: 3, communication: 3, innovation: 3, knowledge: 3 } as Record<string, number>,
    market_p25: '', market_p50: '', market_p75: '',
  });

  // Agreement form
  const [agreeForm, setAgreeForm] = useState({
    country: '', sector: '', name: '', version: '', effective_date: '', source_url: '',
  });

  // Category form
  const [catForm, setCatForm] = useState({
    category_code: '', category_label: '', min_salary: '', currency: 'XOF',
    mercer_band_min: '', mercer_band_max: '',
  });

  // Sim form
  const [simForm, setSimForm] = useState({
    title: '', year: new Date().getFullYear(), budget_type: 'percentage',
    budget_value: '', currency: 'XOF', policy: 'uniforme',
    scope_type: 'all', scope_id: null as number | null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
      try {
        const parsed = JSON.parse(u);
        setUserRole((parsed.role || '').toLowerCase());
      } catch { /* ignore */ }
    }
    checkModule();
  }, []);

  const checkModule = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cb/config`, { headers: getAuthHeaders() });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body.detail?.includes('non activé')) {
          setHasCbModule(false);
          setLoading(false);
          return;
        }
      }
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setHasCbModule(true);
      } else {
        setHasCbModule(false);
      }
    } catch {
      setHasCbModule(false);
    }
    setLoading(false);
  };

  // ── Data loaders ──────────────────────────────────────────

  const loadEvaluations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(evalPage), page_size: '20' });
      if (evalCountry) params.set('country', evalCountry);
      if (evalConformity) params.set('conformity_status', evalConformity);
      const res = await fetch(`${API_URL}/api/cb/evaluations?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEvaluations(data.items);
        setEvalTotal(data.total);
      }
    } catch { /* ignore */ }
  }, [evalPage, evalCountry, evalConformity]);

  const loadAgreements = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/cb/agreements`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        console.log('[C&B] Agreements chargées:', data.length);
        setAgreements(data);
      } else {
        console.warn('[C&B] Erreur chargement agreements:', res.status);
      }
    } catch (err) { console.error('[C&B] loadAgreements error:', err); }
  }, []);

  const loadGrids = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(gridPage), page_size: '20' });
      if (gridCountry) params.set('country', gridCountry);
      if (gridConformity) params.set('conformity_status', gridConformity);
      const res = await fetch(`${API_URL}/api/cb/salary-grids?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setGrids(data.items);
        setGridsTotal(data.total);
      }
    } catch { /* ignore */ }
  }, [gridPage, gridCountry, gridConformity]);

  const loadSimulations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(simPage), page_size: '20' });
      const res = await fetch(`${API_URL}/api/cb/simulations?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSimulations(data.items);
        setSimTotal(data.total);
      }
    } catch { /* ignore */ }
  }, [simPage]);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/departments`, { headers: getAuthHeaders() });
      if (res.ok) setDepartments(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadCategories = useCallback(async (agreementId: number) => {
    try {
      console.log('[C&B] Chargement catégories pour agreement:', agreementId);
      const res = await fetch(`${API_URL}/api/cb/agreements/${agreementId}/categories`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        console.log('[C&B] Catégories chargées:', data.length);
        setCategories(data);
      } else {
        console.warn('[C&B] Erreur chargement catégories:', res.status);
      }
    } catch (err) { console.error('[C&B] loadCategories error:', err); }
  }, []);

  useEffect(() => {
    if (!hasCbModule) return;
    loadEvaluations();
    loadAgreements();
    loadGrids();
    loadSimulations();
    loadDepartments();
  }, [hasCbModule, loadEvaluations, loadAgreements, loadGrids, loadSimulations, loadDepartments]);

  // ── Actions ───────────────────────────────────────────────

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const createEvaluation = async () => {
    setSubmitting(true);
    try {
      const body = {
        job_title: evalForm.job_title,
        job_family: evalForm.job_family,
        country: evalForm.country,
        currency: evalForm.currency,
        scores: evalForm.scores,
        market_p25: evalForm.market_p25 ? parseFloat(evalForm.market_p25) : null,
        market_p50: evalForm.market_p50 ? parseFloat(evalForm.market_p50) : null,
        market_p75: evalForm.market_p75 ? parseFloat(evalForm.market_p75) : null,
      };
      const res = await fetch(`${API_URL}/api/cb/evaluations`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast('Pesée créée avec succès');
        setShowEvalModal(false);
        setEvalManualTitle(false);
        setEvalForm({ job_title: '', job_family: '', country: '', currency: 'XOF', scores: { impact: 3, communication: 3, innovation: 3, knowledge: 3 }, market_p25: '', market_p50: '', market_p75: '' });
        loadEvaluations();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Erreur lors de la création');
      }
    } catch { showToast('Erreur réseau'); }
    setSubmitting(false);
  };

  const reconcileEvaluation = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/cb/evaluations/${id}/reconcile`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Réconciliation : ${data.conformity_status === 'conforme' ? 'Conforme' : 'A réviser'}`);
        loadEvaluations();
        loadGrids();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Erreur de réconciliation');
      }
    } catch { showToast('Erreur réseau'); }
  };

  // ── Download eval import template ──
  const downloadEvalTemplate = () => {
    const header = 'job_title,job_family,country,impact,communication,innovation,knowledge,market_p25,market_p50,market_p75,currency';
    const examples = [
      'Directeur Commercial,Commercial,SN,4,3,3,4,2500000,3000000,3500000,XOF',
      'Responsable RH,RH,CI,3,4,2,4,1800000,2200000,2800000,XOF',
      'Comptable Senior,Finance,CM,2,2,2,4,1200000,1500000,1800000,XOF',
    ];
    const csv = [header, ...examples].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_pesees_ipe.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import evaluations from CSV/Excel ──
  const handleEvalFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    let rows: Record<string, string>[] = [];

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
      } else {
        const text = await file.text();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { showToast('Fichier vide ou sans données'); return; }
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((h, j) => { row[h] = vals[j] || ''; });
          rows.push(row);
        }
      }
    } catch {
      showToast('Erreur de lecture du fichier');
      return;
    }

    if (!rows.length) { showToast('Aucune ligne trouvée dans le fichier'); return; }

    const VALID_COUNTRY_RE = /^[A-Z]{2}$/;
    const progress = { current: 0, total: rows.length, errors: [] as { line: number; message: string }[], done: false };
    setEvalImportProgress({ ...progress });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;
      progress.current = i + 1;
      setEvalImportProgress({ ...progress });

      // Parse fields
      const job_title = (row['job_title'] || '').trim();
      const job_family = (row['job_family'] || '').trim();
      const country = (row['country'] || '').trim().toUpperCase();
      const currency = (row['currency'] || 'XOF').trim().toUpperCase();
      const impact = parseInt(row['impact'] || '');
      const communication = parseInt(row['communication'] || '');
      const innovation = parseInt(row['innovation'] || '');
      const knowledge = parseInt(row['knowledge'] || '');
      const p25 = parseFloat(row['market_p25'] || '');
      const p50 = parseFloat(row['market_p50'] || '');
      const p75 = parseFloat(row['market_p75'] || '');

      // Validate
      if (!job_title) { progress.errors.push({ line: lineNum, message: 'job_title obligatoire' }); continue; }
      if (country && !VALID_COUNTRY_RE.test(country)) { progress.errors.push({ line: lineNum, message: `country invalide : "${country}" (code ISO 2 lettres attendu)` }); continue; }
      for (const [name, val] of [['impact', impact], ['communication', communication], ['innovation', innovation], ['knowledge', knowledge]] as [string, number][]) {
        if (isNaN(val) || val < 1 || val > 5) { progress.errors.push({ line: lineNum, message: `${name} doit être un entier entre 1 et 5 (reçu : "${row[name]}")` }); break; }
      }
      if (progress.errors.length > 0 && progress.errors[progress.errors.length - 1].line === lineNum) continue;
      if (!VALID_CURRENCIES.includes(currency)) { progress.errors.push({ line: lineNum, message: `currency invalide : "${currency}" (attendu : ${VALID_CURRENCIES.join(', ')})` }); continue; }
      if (!isNaN(p25) || !isNaN(p50) || !isNaN(p75)) {
        if (isNaN(p25) || p25 <= 0 || isNaN(p50) || p50 <= 0 || isNaN(p75) || p75 <= 0) {
          progress.errors.push({ line: lineNum, message: 'market_p25, p50, p75 doivent être des nombres > 0' }); continue;
        }
        if (!(p25 < p50 && p50 < p75)) {
          progress.errors.push({ line: lineNum, message: `p25 < p50 < p75 requis (reçu : ${p25}, ${p50}, ${p75})` }); continue;
        }
      }

      try {
        const body: Record<string, unknown> = {
          job_title,
          job_family: job_family || null,
          country: country || null,
          currency,
          scores: { impact, communication, innovation, knowledge },
          market_p25: !isNaN(p25) ? p25 : null,
          market_p50: !isNaN(p50) ? p50 : null,
          market_p75: !isNaN(p75) ? p75 : null,
        };
        const res = await fetch(`${API_URL}/api/cb/evaluations`, {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          progress.errors.push({ line: lineNum, message: err.detail || `Erreur ${res.status}` });
        }
      } catch {
        progress.errors.push({ line: lineNum, message: 'Erreur réseau' });
      }
    }

    progress.done = true;
    setEvalImportProgress({ ...progress });
    loadEvaluations();
  };

  const createAgreement = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/cb/agreements`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(agreeForm),
      });
      if (res.ok) {
        showToast('Convention collective créée');
        setShowAgreementModal(false);
        setAgreeForm({ country: '', sector: '', name: '', version: '', effective_date: '', source_url: '' });
        loadAgreements();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Erreur');
      }
    } catch { showToast('Erreur réseau'); }
    setSubmitting(false);
  };

  const createCategory = async () => {
    if (!selectedAgreement) return;
    setSubmitting(true);
    try {
      const body = {
        ...catForm,
        min_salary: parseFloat(catForm.min_salary) || 0,
        mercer_band_min: catForm.mercer_band_min || null,
        mercer_band_max: catForm.mercer_band_max || null,
      };
      const res = await fetch(`${API_URL}/api/cb/agreements/${selectedAgreement.id}/categories`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast('Catégorie ajoutée');
        setShowCategoryModal(false);
        setCatForm({ category_code: '', category_label: '', min_salary: '', currency: 'XOF', mercer_band_min: '', mercer_band_max: '' });
        loadCategories(selectedAgreement.id);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Erreur');
      }
    } catch { showToast('Erreur réseau'); }
    setSubmitting(false);
  };

  const downloadCategoryTemplate = () => {
    const header = 'category_code,category_label,min_salary,currency,mercer_band_min,mercer_band_max\n';
    const examples =
      'I,Manœuvre ordinaire,45000,XOF,Band 1,Band 2\n' +
      'II,Ouvrier spécialisé,55000,XOF,Band 2,Band 3\n' +
      'III-A,Agent de maîtrise,75000,XOF,Band 3,Band 4\n';
    const blob = new Blob([header + examples], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'template_categories_cc.csv';
    a.click();
  };

  const VALID_CURRENCIES = ['XOF', 'XAF', 'GNF', 'EUR', 'USD'];

  const handleCategoryFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgreement) return;
    e.target.value = '';

    let rows: Record<string, string>[] = [];

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
      } else {
        const text = await file.text();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { showToast('Fichier vide ou sans données'); return; }
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((h, j) => { row[h] = vals[j] || ''; });
          rows.push(row);
        }
      }
    } catch {
      showToast('Erreur de lecture du fichier');
      return;
    }

    if (!rows.length) { showToast('Aucune ligne trouvée dans le fichier'); return; }

    const progress = { current: 0, total: rows.length, errors: [] as { line: number; message: string }[], done: false };
    setImportProgress({ ...progress });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;
      progress.current = i + 1;
      setImportProgress({ ...progress });

      const code = (row['category_code'] || '').trim();
      const label = (row['category_label'] || '').trim();
      const salaryStr = (row['min_salary'] || '').trim();
      const currency = (row['currency'] || '').trim().toUpperCase();
      const bandMin = (row['mercer_band_min'] || '').trim() || null;
      const bandMax = (row['mercer_band_max'] || '').trim() || null;
      const salary = parseFloat(salaryStr);

      if (!code) { progress.errors.push({ line: lineNum, message: 'category_code obligatoire' }); continue; }
      if (isNaN(salary) || salary <= 0) { progress.errors.push({ line: lineNum, message: `min_salary invalide : "${salaryStr}"` }); continue; }
      if (!currency || !VALID_CURRENCIES.includes(currency)) { progress.errors.push({ line: lineNum, message: `currency invalide : "${currency}" (attendu : ${VALID_CURRENCIES.join(', ')})` }); continue; }

      try {
        const res = await fetch(`${API_URL}/api/cb/agreements/${selectedAgreement.id}/categories`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ category_code: code, category_label: label || code, min_salary: salary, currency, mercer_band_min: bandMin, mercer_band_max: bandMax }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          progress.errors.push({ line: lineNum, message: err.detail || `Erreur ${res.status}` });
        }
      } catch {
        progress.errors.push({ line: lineNum, message: 'Erreur réseau' });
      }
    }

    progress.done = true;
    setImportProgress({ ...progress });
    loadCategories(selectedAgreement.id);
  };

  const createSimulation = async () => {
    setSubmitting(true);
    try {
      const body = {
        ...simForm,
        budget_value: parseFloat(simForm.budget_value) || 0,
        scope_id: simForm.scope_id,
      };
      const res = await fetch(`${API_URL}/api/cb/simulations`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) {
        const sim = await res.json();
        showToast(`Simulation créée — ${sim.lines_count || 0} ligne(s) générée(s)`);
        setShowSimModal(false);
        setSimForm({ title: '', year: new Date().getFullYear(), budget_type: 'percentage', budget_value: '', currency: 'XOF', policy: 'uniforme', scope_type: 'all', scope_id: null });
        loadSimulations();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Erreur');
      }
    } catch { showToast('Erreur réseau'); }
    setSubmitting(false);
  };

  const viewSimulation = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/cb/simulations/${id}`, { headers: getAuthHeaders() });
      if (res.ok) setShowSimDetail(await res.json());
    } catch { /* ignore */ }
  };

  const simAction = async (id: number, action: 'submit' | 'approve' | 'reject', reason?: string) => {
    try {
      const url = `${API_URL}/api/cb/simulations/${id}/${action}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`;
      const res = await fetch(url, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) {
        showToast(action === 'submit' ? 'Simulation soumise' : action === 'approve' ? 'Simulation approuvée' : 'Simulation rejetée');
        loadSimulations();
        if (showSimDetail?.id === id) viewSimulation(id);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Erreur');
      }
    } catch { showToast('Erreur réseau'); }
  };

  const exportGridsCSV = () => {
    if (!grids.length) return;
    const header = 'ID,Pays,Devise,P25,P50,P75,Minimum CC,Conformite\n';
    const rows = grids.map(g =>
      `${g.id},${g.country},${g.currency},${g.min_salary},${g.mid_salary},${g.max_salary},${g.cc_minimum || ''},${g.conformity_status}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'grilles_salariales.csv';
    a.click();
  };

  // ── Loading / Teasing ─────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (hasCbModule === false) return <TeasingPage />;

  // ── KPIs ──────────────────────────────────────────────────

  const nbEvalues = evalTotal;
  const nbConformes = evaluations.filter(e => e.conformity_status === 'conforme').length;
  const pctConformes = nbEvalues > 0 ? Math.round((nbConformes / evaluations.length) * 100) : 0;
  const nbSims = simTotal;
  const nbCcActives = agreements.filter(a => a.is_active).length;
  const nbNonConformes = evaluations.filter(e => e.conformity_status === 'a_reviser' || e.conformity_status === 'bloquant').length;

  // ── Tabs config ───────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: typeof DollarSign }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'evaluations', label: 'Pesées IPE', icon: Scale },
    { id: 'agreements', label: 'Conventions Collectives', icon: Building2 },
    { id: 'grids', label: 'Grilles Salariales', icon: Layers },
    { id: 'simulations', label: 'Simulateur', icon: Calculator },
  ];

  const totalScore = Object.values(evalForm.scores).reduce((a, b) => a + b, 0);
  const bandFromScore = (s: number) => {
    if (s <= 4) return 'Band 1';
    if (s <= 8) return 'Band 2';
    if (s <= 12) return 'Band 3';
    if (s <= 16) return 'Band 4';
    return 'Band 5';
  };

  const filteredEvals = searchEval
    ? evaluations.filter(e => (e.job_title || '') === searchEval)
    : evaluations;

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <div>
      <Header title="Compensation & Benefits" subtitle="Pesées IPE, conventions collectives et simulations salariales" />

      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Bouton + Ajouter (visible uniquement si module activé) */}
        {hasCbModule && (
          <div className="flex justify-end mb-4 relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Ajouter
              <ChevronDown className={`w-4 h-4 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
            </button>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 w-56">
                  <button
                    onClick={() => { setShowAddMenu(false); setShowEvalModal(true); }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2.5 text-gray-700"
                  >
                    <Scale className="w-4 h-4 text-blue-500" />
                    Nouvelle pesée IPE
                  </button>
                  <button
                    onClick={() => { setShowAddMenu(false); setShowSimModal(true); }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2.5 text-gray-700"
                  >
                    <Calculator className="w-4 h-4 text-amber-500" />
                    Nouvelle simulation
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-green-400" /> {toast}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-5 pt-3 mb-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === t.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-100 p-6 mb-6">

          {/* ── TAB: Tableau de bord ──────────────────────── */}
          {activeTab === 'dashboard' && (
            <div>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-2xl font-bold text-primary-600">{nbEvalues}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Postes évalués</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-2xl font-bold text-green-600">{pctConformes}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">Taux conformité</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-2xl font-bold text-blue-600">{nbSims}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Simulations</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-2xl font-bold text-purple-600">{nbCcActives}</p>
                  <p className="text-xs text-gray-500 mt-0.5">CC actives</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-2xl font-bold text-red-600">{gridsTotal}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Grilles générées</p>
                </div>
              </div>

              {/* Alertes */}
              {nbNonConformes > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">{nbNonConformes} poste(s) non conforme(s)</p>
                    <p className="text-xs text-orange-600 mt-0.5">Ces postes nécessitent une réconciliation avec la convention collective.</p>
                  </div>
                </div>
              )}

              {/* Liste postes */}
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Dernières pesées</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4">Poste</th>
                      <th className="pb-2 pr-4">Band</th>
                      <th className="pb-2 pr-4">Score</th>
                      <th className="pb-2">Conformité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.slice(0, 10).map((ev) => (
                      <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{ev.job_title || `Poste #${ev.id}`}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{ev.mercer_band || '-'}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{ev.total_score}</td>
                        <td className="py-2.5">{conformityBadge(ev.conformity_status)}</td>
                      </tr>
                    ))}
                    {evaluations.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-gray-400">Aucune pesée enregistrée</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: Pesées IPE ──────────────────────────── */}
          {activeTab === 'evaluations' && (
            <div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <select
                  value={searchEval}
                  onChange={(e) => { setSearchEval(e.target.value); setEvalPage(1); }}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Tous les postes</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                <select value={evalConformity} onChange={(e) => { setEvalConformity(e.target.value); setEvalPage(1); }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  <option value="">Toute conformité</option>
                  <option value="conforme">Conforme</option>
                  <option value="a_reviser">A réviser</option>
                  <option value="bloquant">Bloquant</option>
                  <option value="non_evalue">Non évalué</option>
                </select>
                <button
                  onClick={downloadEvalTemplate}
                  className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-1.5"
                >
                  <FileDown className="w-4 h-4" /> Template
                </button>
                <label className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4" /> Importer CSV
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleEvalFileImport}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => setShowEvalModal(true)}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Nouvelle pesée
                </button>
              </div>

              {/* Eval import progress */}
              {evalImportProgress && (
                <div className="mb-4 bg-gray-50 rounded-xl border border-gray-100 p-4">
                  {!evalImportProgress.done ? (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                      Traitement pesée {evalImportProgress.current}/{evalImportProgress.total}...
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-900">
                          {evalImportProgress.total - evalImportProgress.errors.length} pesée(s) importée(s)
                          {evalImportProgress.errors.length > 0 && (
                            <span className="text-red-600 ml-1">, {evalImportProgress.errors.length} erreur(s)</span>
                          )}
                        </span>
                      </div>
                      {evalImportProgress.errors.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                          {evalImportProgress.errors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600">
                              Ligne {err.line} : {err.message}
                            </p>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setEvalImportProgress(null)} className="text-xs text-primary-500 hover:text-primary-600 mt-2">
                        Fermer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-3">Poste</th>
                      <th className="pb-2 pr-3">Famille</th>
                      <th className="pb-2 pr-3">Pays</th>
                      <th className="pb-2 pr-3">Score</th>
                      <th className="pb-2 pr-3">Band</th>
                      <th className="pb-2 pr-3">P25</th>
                      <th className="pb-2 pr-3">P50</th>
                      <th className="pb-2 pr-3">P75</th>
                      <th className="pb-2 pr-3">Conformité</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvals.map((ev) => (
                      <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-3 font-medium text-gray-900">{ev.job_title || '-'}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{ev.job_family || '-'}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{ev.country || '-'}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{ev.total_score}</td>
                        <td className="py-2.5 pr-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{ev.mercer_band || '-'}</span></td>
                        <td className="py-2.5 pr-3 text-gray-600 text-xs">{fmt(ev.market_p25, ev.currency || 'XOF')}</td>
                        <td className="py-2.5 pr-3 text-gray-600 text-xs">{fmt(ev.market_p50, ev.currency || 'XOF')}</td>
                        <td className="py-2.5 pr-3 text-gray-600 text-xs">{fmt(ev.market_p75, ev.currency || 'XOF')}</td>
                        <td className="py-2.5 pr-3">{conformityBadge(ev.conformity_status)}</td>
                        <td className="py-2.5">
                          <button
                            onClick={() => reconcileEvaluation(ev.id)}
                            className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium hover:bg-purple-100 transition-colors flex items-center gap-1"
                            title="Réconcilier avec la CC"
                          >
                            <RefreshCw className="w-3 h-3" /> Réconcilier
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredEvals.length === 0 && (
                      <tr><td colSpan={10} className="py-8 text-center text-gray-400">Aucune pesée</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {evalTotal > 20 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>{evalTotal} résultat(s)</span>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.ceil(evalTotal / 20) }, (_, i) => (
                      <button key={i} onClick={() => setEvalPage(i + 1)}
                        className={`px-3 py-1 rounded ${evalPage === i + 1 ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'}`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Conventions Collectives ──────────────── */}
          {activeTab === 'agreements' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-gray-700">Conventions collectives</h3>
                <button
                  onClick={() => setShowAgreementModal(true)}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Ajouter une CC
                </button>
              </div>

              {selectedAgreement ? (
                // ── Détail CC ──
                <div>
                  <button onClick={() => { setSelectedAgreement(null); setCategories([]); }}
                    className="text-sm text-primary-500 hover:text-primary-600 mb-4 flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Retour à la liste
                  </button>
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                    <h4 className="font-medium text-gray-900">{selectedAgreement.name}</h4>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>Pays : {selectedAgreement.country}</span>
                      <span>Secteur : {selectedAgreement.sector || '-'}</span>
                      <span>Version : {selectedAgreement.version || '-'}</span>
                      <span>Effective : {selectedAgreement.effective_date}</span>
                      <span className={selectedAgreement.is_active ? 'text-green-600' : 'text-red-500'}>
                        {selectedAgreement.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="text-sm font-semibold text-gray-700">Catégories</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={downloadCategoryTemplate}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-xs font-medium text-gray-600 flex items-center gap-1"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Template CSV
                      </button>
                      <label className="px-2.5 py-1.5 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 text-xs font-medium text-blue-700 flex items-center gap-1 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> Importer CSV
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleCategoryFileImport}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={() => setShowCategoryModal(true)}
                        className="px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-xs font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter
                      </button>
                    </div>
                  </div>

                  {/* Import progress */}
                  {importProgress && (
                    <div className="mb-4 bg-gray-50 rounded-xl border border-gray-100 p-4">
                      {!importProgress.done ? (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                          Traitement ligne {importProgress.current}/{importProgress.total}...
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium mb-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-gray-900">
                              {importProgress.total - importProgress.errors.length} catégorie(s) importée(s)
                              {importProgress.errors.length > 0 && (
                                <span className="text-red-600 ml-1">, {importProgress.errors.length} erreur(s)</span>
                              )}
                            </span>
                          </div>
                          {importProgress.errors.length > 0 && (
                            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                              {importProgress.errors.map((err, i) => (
                                <p key={i} className="text-xs text-red-600">
                                  Ligne {err.line} : {err.message}
                                </p>
                              ))}
                            </div>
                          )}
                          <button onClick={() => setImportProgress(null)} className="text-xs text-primary-500 hover:text-primary-600 mt-2">
                            Fermer
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-3">Code</th>
                        <th className="pb-2 pr-3">Libellé</th>
                        <th className="pb-2 pr-3">Salaire minimum</th>
                        <th className="pb-2 pr-3">Band min</th>
                        <th className="pb-2">Band max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.id} className="border-b border-gray-50">
                          <td className="py-2 pr-3 font-medium text-gray-900">{cat.category_code}</td>
                          <td className="py-2 pr-3 text-gray-600">{cat.category_label}</td>
                          <td className="py-2 pr-3 text-gray-600">{fmt(cat.min_salary, cat.currency)}</td>
                          <td className="py-2 pr-3 text-gray-600">{cat.mercer_band_min || '-'}</td>
                          <td className="py-2 text-gray-600">{cat.mercer_band_max || '-'}</td>
                        </tr>
                      ))}
                      {categories.length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-gray-400">Aucune catégorie</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                // ── Liste CC ──
                <div className="grid gap-3">
                  {agreements.map((ag) => (
                    <div
                      key={ag.id}
                      onClick={() => { console.log('[C&B] CC sélectionnée:', ag.id, ag.name); setSelectedAgreement(ag); setImportProgress(null); loadCategories(ag.id); }}
                      className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-primary-200 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{ag.name}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          <span>Pays : {ag.country}</span>
                          <span>Secteur : {ag.sector || '-'}</span>
                          <span>Version : {ag.version || '-'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ag.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {ag.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {ag.tenant_id === null && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">Global</span>}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                  {agreements.length === 0 && (
                    <div className="py-8 text-center text-gray-400">Aucune convention collective enregistrée</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Grilles Salariales ───────────────────── */}
          {activeTab === 'grids' && (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <select value={gridConformity} onChange={(e) => { setGridConformity(e.target.value); setGridPage(1); }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  <option value="">Toute conformité</option>
                  <option value="conforme">Conforme</option>
                  <option value="a_reviser">A réviser</option>
                  <option value="bloquant">Bloquant</option>
                </select>
                <div className="flex-1" />
                <button onClick={exportGridsCSV}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5 text-gray-700">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-3">ID</th>
                      <th className="pb-2 pr-3">Pays</th>
                      <th className="pb-2 pr-3">P25 (min)</th>
                      <th className="pb-2 pr-3">P50 (mid)</th>
                      <th className="pb-2 pr-3">P75 (max)</th>
                      <th className="pb-2 pr-3">Minimum CC</th>
                      <th className="pb-2">Conformité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grids.map((g) => (
                      <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-3 text-gray-600">#{g.id}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{g.country}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{fmt(g.min_salary, g.currency)}</td>
                        <td className="py-2.5 pr-3 font-medium text-gray-900">{fmt(g.mid_salary, g.currency)}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{fmt(g.max_salary, g.currency)}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{fmt(g.cc_minimum, g.currency)}</td>
                        <td className="py-2.5">{conformityBadge(g.conformity_status)}</td>
                      </tr>
                    ))}
                    {grids.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-400">Aucune grille générée. Lancez une réconciliation depuis l&apos;onglet Pesées.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {gridsTotal > 20 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>{gridsTotal} grille(s)</span>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.ceil(gridsTotal / 20) }, (_, i) => (
                      <button key={i} onClick={() => setGridPage(i + 1)}
                        className={`px-3 py-1 rounded ${gridPage === i + 1 ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'}`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Simulateur ───────────────────────────── */}
          {activeTab === 'simulations' && (
            <div>
              {showSimDetail ? (
                // ── Détail simulation ──
                <div>
                  <button onClick={() => setShowSimDetail(null)}
                    className="text-sm text-primary-500 hover:text-primary-600 mb-4 flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Retour
                  </button>
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{showSimDetail.title}</h4>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          <span>Année : {showSimDetail.year}</span>
                          <span>Budget : {showSimDetail.budget_value}{showSimDetail.budget_type === 'percentage' ? '%' : ` ${showSimDetail.currency}`}</span>
                          <span>Politique : {showSimDetail.policy}</span>
                          <span>Périmètre : {showSimDetail.scope_type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {simStatusBadge(showSimDetail.status)}
                        {showSimDetail.status === 'brouillon' && (
                          <button onClick={() => simAction(showSimDetail.id, 'submit')}
                            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 flex items-center gap-1">
                            <Send className="w-3.5 h-3.5" /> Soumettre
                          </button>
                        )}
                        {showSimDetail.status === 'soumis' && ['dg', 'super_admin'].includes(userRole) && (
                          <>
                            <button onClick={() => simAction(showSimDetail.id, 'approve')}
                              className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 flex items-center gap-1">
                              <ThumbsUp className="w-3.5 h-3.5" /> Approuver
                            </button>
                            <button onClick={() => {
                              const r = prompt('Motif de rejet :');
                              if (r !== null) simAction(showSimDetail.id, 'reject', r);
                            }}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 flex items-center gap-1">
                              <ThumbsDown className="w-3.5 h-3.5" /> Rejeter
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {showSimDetail.notes && (
                      <p className="text-xs text-gray-500 mt-2 bg-white p-2 rounded border border-gray-100">{showSimDetail.notes}</p>
                    )}
                  </div>

                  {/* Lignes */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-2 pr-3">Employé</th>
                          <th className="pb-2 pr-3">Poste</th>
                          <th className="pb-2 pr-3">Salaire actuel</th>
                          <th className="pb-2 pr-3">Augm. %</th>
                          <th className="pb-2 pr-3">Salaire proposé</th>
                          <th className="pb-2 pr-3">Min. CC</th>
                          <th className="pb-2">Conformité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showSimDetail.lines || []).map((l) => (
                          <tr key={l.id} className="border-b border-gray-50">
                            <td className="py-2 pr-3 font-medium text-gray-900">{l.employee_name || `#${l.employee_id}`}</td>
                            <td className="py-2 pr-3 text-gray-600 text-xs">{l.employee_job_title || '-'}</td>
                            <td className="py-2 pr-3 text-gray-600">{fmt(l.current_salary, showSimDetail.currency)}</td>
                            <td className="py-2 pr-3 text-gray-600">+{l.proposed_increase_pct}%</td>
                            <td className="py-2 pr-3 font-medium text-green-700">{fmt(l.proposed_salary, showSimDetail.currency)}</td>
                            <td className="py-2 pr-3 text-gray-500 text-xs">{fmt(l.cc_minimum, showSimDetail.currency)}</td>
                            <td className="py-2">{conformityBadge(l.conformity_status)}</td>
                          </tr>
                        ))}
                        {(!showSimDetail.lines || showSimDetail.lines.length === 0) && (
                          <tr><td colSpan={7} className="py-6 text-center text-gray-400">Aucune ligne</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                // ── Liste simulations ──
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-gray-700">Simulations de révision salariale</h3>
                    <button
                      onClick={() => setShowSimModal(true)}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Nouvelle simulation
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {simulations.map((sim) => (
                      <div
                        key={sim.id}
                        onClick={() => viewSimulation(sim.id)}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-primary-200 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{sim.title}</p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500">
                            <span>{sim.year}</span>
                            <span>{sim.budget_value}{sim.budget_type === 'percentage' ? '%' : ` ${sim.currency}`}</span>
                            <span>{sim.policy}</span>
                            <span>{sim.lines_count || 0} ligne(s)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {simStatusBadge(sim.status)}
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                    {simulations.length === 0 && (
                      <div className="py-8 text-center text-gray-400">Aucune simulation créée</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* MODALS                                             */}
        {/* ═══════════════════════════════════════════════════ */}

        {/* ── Modal Nouvelle Pesée IPE ────────────────────── */}
        {showEvalModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEvalModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Nouvelle pesée IPE</h3>
                <button onClick={() => setShowEvalModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Poste : select ou saisie manuelle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-500">Intitulé du poste *</label>
                    <button
                      type="button"
                      onClick={() => { setEvalManualTitle(!evalManualTitle); setEvalForm(f => ({ ...f, job_title: '' })); }}
                      className="text-[11px] text-primary-500 hover:text-primary-600 font-medium"
                    >
                      {evalManualTitle ? 'Choisir depuis la liste' : 'Saisir manuellement'}
                    </button>
                  </div>
                  {evalManualTitle ? (
                    <input
                      value={evalForm.job_title}
                      onChange={(e) => setEvalForm(f => ({ ...f, job_title: e.target.value }))}
                      placeholder="Ex : Directeur Commercial"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  ) : (
                    <select
                      value={evalForm.job_title}
                      onChange={(e) => setEvalForm(f => ({ ...f, job_title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">Sélectionner un poste...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Famille de poste</label>
                  <input value={evalForm.job_family} onChange={(e) => setEvalForm(f => ({ ...f, job_family: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Pays (code ISO)</label>
                    <input value={evalForm.country} onChange={(e) => setEvalForm(f => ({ ...f, country: e.target.value }))} placeholder="SN"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Devise</label>
                    <input value={evalForm.currency} onChange={(e) => setEvalForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>

                {/* 4 critères IPE */}
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Critères IPE (niveau 1 à 5)</label>
                  <div className="space-y-3">
                    {(['impact', 'communication', 'innovation', 'knowledge'] as const).map((criterion) => (
                      <div key={criterion} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 capitalize w-32">{criterion}</span>
                        <input
                          type="range"
                          min={1} max={5}
                          value={evalForm.scores[criterion]}
                          onChange={(e) => setEvalForm(f => ({ ...f, scores: { ...f.scores, [criterion]: parseInt(e.target.value) } }))}
                          className="flex-1 accent-primary-500"
                        />
                        <span className="text-sm font-semibold text-primary-600 w-6 text-center">{evalForm.scores[criterion]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 bg-primary-50 rounded-lg px-4 py-2">
                    <span className="text-sm text-primary-700 font-medium">Score total : {totalScore}</span>
                    <span className="text-sm font-semibold text-primary-700">{bandFromScore(totalScore)}</span>
                  </div>
                </div>

                {/* Données marché */}
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Données marché (optionnel)</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">P25</label>
                      <input type="number" value={evalForm.market_p25} onChange={(e) => setEvalForm(f => ({ ...f, market_p25: e.target.value }))} placeholder="0"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">P50</label>
                      <input type="number" value={evalForm.market_p50} onChange={(e) => setEvalForm(f => ({ ...f, market_p50: e.target.value }))} placeholder="0"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">P75</label>
                      <input type="number" value={evalForm.market_p75} onChange={(e) => setEvalForm(f => ({ ...f, market_p75: e.target.value }))} placeholder="0"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                <button onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={createEvaluation} disabled={submitting || !evalForm.job_title}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                  {submitting ? 'Création...' : 'Créer la pesée'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Nouvelle CC ───────────────────────────── */}
        {showAgreementModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAgreementModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Ajouter une convention collective</h3>
                <button onClick={() => setShowAgreementModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                  <input value={agreeForm.name} onChange={(e) => setAgreeForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Pays (code ISO) *</label>
                    <input value={agreeForm.country} onChange={(e) => setAgreeForm(f => ({ ...f, country: e.target.value }))} placeholder="SN"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Secteur</label>
                    <input value={agreeForm.sector} onChange={(e) => setAgreeForm(f => ({ ...f, sector: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Version</label>
                    <input value={agreeForm.version} onChange={(e) => setAgreeForm(f => ({ ...f, version: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date d&apos;effet *</label>
                    <input type="date" value={agreeForm.effective_date} onChange={(e) => setAgreeForm(f => ({ ...f, effective_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">URL source</label>
                  <input value={agreeForm.source_url} onChange={(e) => setAgreeForm(f => ({ ...f, source_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                <button onClick={() => setShowAgreementModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={createAgreement} disabled={submitting || !agreeForm.name || !agreeForm.country || !agreeForm.effective_date}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                  {submitting ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Nouvelle Catégorie CC ─────────────────── */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCategoryModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Ajouter une catégorie</h3>
                <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Code *</label>
                    <input value={catForm.category_code} onChange={(e) => setCatForm(f => ({ ...f, category_code: e.target.value }))} placeholder="III-A"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Devise</label>
                    <input value={catForm.currency} onChange={(e) => setCatForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Libellé *</label>
                  <input value={catForm.category_label} onChange={(e) => setCatForm(f => ({ ...f, category_label: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Salaire minimum *</label>
                  <input type="number" value={catForm.min_salary} onChange={(e) => setCatForm(f => ({ ...f, min_salary: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Band Mercer min</label>
                    <input value={catForm.mercer_band_min} onChange={(e) => setCatForm(f => ({ ...f, mercer_band_min: e.target.value }))} placeholder="Band 1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Band Mercer max</label>
                    <input value={catForm.mercer_band_max} onChange={(e) => setCatForm(f => ({ ...f, mercer_band_max: e.target.value }))} placeholder="Band 3"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                <button onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={createCategory} disabled={submitting || !catForm.category_code || !catForm.category_label || !catForm.min_salary}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                  {submitting ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Nouvelle Simulation ───────────────────── */}
        {showSimModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSimModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Nouvelle simulation</h3>
                <button onClick={() => setShowSimModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Titre *</label>
                  <input value={simForm.title} onChange={(e) => setSimForm(f => ({ ...f, title: e.target.value }))} placeholder="Révision salariale 2026"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Année</label>
                    <input type="number" value={simForm.year} onChange={(e) => setSimForm(f => ({ ...f, year: parseInt(e.target.value) || 2026 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Devise</label>
                    <input value={simForm.currency} onChange={(e) => setSimForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Type de budget</label>
                    <select value={simForm.budget_type} onChange={(e) => setSimForm(f => ({ ...f, budget_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="percentage">Pourcentage (%)</option>
                      <option value="amount">Montant fixe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Valeur du budget *</label>
                    <input type="number" value={simForm.budget_value} onChange={(e) => setSimForm(f => ({ ...f, budget_value: e.target.value }))}
                      placeholder={simForm.budget_type === 'percentage' ? '5' : '1000000'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Politique d&apos;augmentation</label>
                  <select value={simForm.policy} onChange={(e) => setSimForm(f => ({ ...f, policy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="uniforme">Uniforme (meme % pour tous)</option>
                    <option value="anciennete">Par ancienneté</option>
                    <option value="categorie">Par catégorie</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Périmètre</label>
                    <select value={simForm.scope_type} onChange={(e) => setSimForm(f => ({ ...f, scope_type: e.target.value, scope_id: null }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="all">Tous les employés</option>
                      <option value="department">Par département</option>
                    </select>
                  </div>
                  {simForm.scope_type === 'department' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Département</label>
                      <select value={simForm.scope_id || ''} onChange={(e) => setSimForm(f => ({ ...f, scope_id: parseInt(e.target.value) || null }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                        <option value="">Sélectionner</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                <button onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={createSimulation} disabled={submitting || !simForm.title || !simForm.budget_value}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                  {submitting ? 'Génération...' : 'Créer et générer les lignes'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
