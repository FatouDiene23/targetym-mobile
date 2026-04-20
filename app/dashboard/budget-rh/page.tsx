"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Target, AlertTriangle,
  Users, Download, Upload, Settings, ChevronDown, ChevronRight,
  Calendar, Filter, RefreshCw, PieChart as PieChartIcon,
  BarChart3, ArrowUpRight, ArrowDownRight, Minus, Lock,
  FileSpreadsheet, Eye, Layers,
} from "lucide-react";
import { fetchWithAuth, API_URL } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nContext";
import PageTourTips from "@/components/PageTourTips";
import { usePageTour } from "@/hooks/usePageTour";
import { useBudgetYear } from "@/hooks/useBudgetYear";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface KPIs {
  total_budget: number;
  total_actual: number;
  total_prev_year: number;
  budget_consumed_pct: number;
  vs_prev_year_pct: number;
}

interface MonthlyPoint {
  month: number;
  budget: number;
  actual: number;
  actual_prev_year: number;
}

interface CategoryLine {
  month: number;
  category_code: string;
  category_label: string;
  level: number;
  parent_code: string | null;
  order_index: number;
  amount_budget: number;
}

interface SummaryData {
  year: number;
  has_payroll: boolean;
  kpis: KPIs;
  monthly: MonthlyPoint[];
  categories: CategoryLine[];
}

interface BudgetLineData {
  month: number;
  category_code: string;
  category_label: string;
  level: number;
  parent_code: string | null;
  order_index: number;
  amount_budget: number;
  amount_actual: number | null;
  source: string;
}

interface TreeNode {
  code: string;
  label: string;
  level: number;
  parent_code: string | null;
  order_index: number;
  children: TreeNode[];
  months: Record<number, { budget: number; actual: number }>;
  totals: { budget: number; actual: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const CATEGORY_COLORS: Record<number, string> = {
  0: "#066C6C",
  1: "#0AAE8E",
  2: "#10B981",
  3: "#F59E0B",
  4: "#EF4444",
  5: "#06B6D4",
};

const PIE_COLORS = ["#066C6C", "#0AAE8E", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#F97316", "#84CC16"];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtCurrency(val: number, currency = "XOF", compact = false): string {
  if (compact) {
    if (Math.abs(val) >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + " Md";
    if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + " M";
    if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(0) + " K";
    return val.toFixed(0);
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(val);
}

function buildTree(lines: BudgetLineData[]): TreeNode[] {
  const nodeMap: Record<string, TreeNode> = {};

  // Create nodes
  const codesFromLines = [...new Set(lines.map((l) => l.category_code))];
  codesFromLines.forEach((code) => {
    const sample = lines.find((l) => l.category_code === code)!;
    nodeMap[code] = {
      code,
      label: sample.category_label || code,
      level: sample.level || 3,
      parent_code: sample.parent_code,
      order_index: sample.order_index || 0,
      children: [],
      months: {},
      totals: { budget: 0, actual: 0 },
    };
  });

  // Fill month data
  lines.forEach((line) => {
    const node = nodeMap[line.category_code];
    if (!node) return;
    node.months[line.month] = {
      budget: line.amount_budget || 0,
      actual: line.amount_actual || 0,
    };
    node.totals.budget += line.amount_budget || 0;
    node.totals.actual += line.amount_actual || 0;
  });

  // Build tree — assign children
  const roots: TreeNode[] = [];
  Object.values(nodeMap).forEach((node) => {
    if (node.parent_code && nodeMap[node.parent_code]) {
      nodeMap[node.parent_code].children.push(node);
    } else if (!node.parent_code) {
      roots.push(node);
    } else {
      // parent not in nodeMap — treat as root
      roots.push(node);
    }
  });

  // Sort
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index || a.code.localeCompare(b.code));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

function flattenTree(nodes: TreeNode[], expanded: Set<string>, depth = 0): Array<TreeNode & { depth: number }> {
  const result: Array<TreeNode & { depth: number }> = [];
  nodes.forEach((node) => {
    result.push({ ...node, depth });
    if (expanded.has(node.code) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expanded, depth + 1));
    }
  });
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, currency = "XOF" }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-[200px]">
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600">{entry.name}</span>
          </span>
          <span className="font-semibold text-gray-900">{fmtCurrency(entry.value, currency, true)}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, trend, trendLabel, icon: Icon, color = "blue", loading = false,
}: {
  title: string;
  value: string;
  sub?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ElementType;
  color?: "blue" | "green" | "amber" | "red" | "purple";
  loading?: boolean;
}) {
  const colors = {
    blue:   { bg: "bg-primary-50",   icon: "text-primary-600",   badge: "bg-primary-100" },
    green:  { bg: "bg-emerald-50", icon: "text-emerald-600", badge: "bg-emerald-100" },
    amber:  { bg: "bg-amber-50",  icon: "text-amber-600",  badge: "bg-amber-100" },
    red:    { bg: "bg-red-50",    icon: "text-red-600",    badge: "bg-red-100" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", badge: "bg-purple-100" },
  };
  const c = colors[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend > 0 ? "bg-emerald-50 text-emerald-700" : trend < 0 ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"
          }`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className={`h-7 ${loading ? "bg-gray-100 rounded animate-pulse w-2/3" : ""}`}>
        {!loading && <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>}
      </div>
      <p className="text-xs text-gray-500 mt-1">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {trendLabel && trend !== undefined && (
        <p className="text-xs text-gray-400 mt-1">{trendLabel}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetRHPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { showTips, dismissTips } = usePageTour("budgetRh");

  const { year, setYear, currentYear } = useBudgetYear();
  const [currency, setCurrency] = useState("XOF");
  const [activeSection, setActiveSection] = useState<"overview" | "categories" | "table">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [lines, setLines] = useState<BudgetLineData[]>([]);

  // Drill-down table state
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, linesRes, configRes] = await Promise.allSettled([
        fetchWithAuth(`${API_URL}/api/budget-rh/summary?year=${year}`),
        fetchWithAuth(`${API_URL}/api/budget-rh/lines?year=${year}`),
        fetchWithAuth(`${API_URL}/api/budget-rh/config?year=${year}`),
      ]);

      if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
        setSummary(await summaryRes.value.json());
      } else if (summaryRes.status === "rejected" || (summaryRes.status === "fulfilled" && summaryRes.value.status === 403)) {
        setHasAccess(false);
        return;
      }
      setHasAccess(true);

      if (linesRes.status === "fulfilled" && linesRes.value.ok) {
        setLines(await linesRes.value.json());
      }
      if (configRes.status === "fulfilled" && configRes.value.ok) {
        const cfg = await configRes.value.json();
        setCurrency(cfg.currency || "XOF");
      }
    } catch {
      setError("Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  // ── Toggle expand ──
  const toggleNode = (code: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const expandAll = () => {
    const allCodes = lines.map((l) => l.category_code);
    setExpandedNodes(new Set(allCodes));
  };

  // ── Derived data ──
  const tree = useMemo(() => buildTree(lines), [lines]);
  const flatRows = useMemo(() => flattenTree(tree, expandedNodes), [tree, expandedNodes]);

  // Monthly chart data
  const chartData = useMemo(() => {
    if (!summary) return [];
    return summary.monthly.map((m) => ({
      name: MONTHS_SHORT[m.month - 1],
      Budget: m.budget,
      Réel: m.actual,
      "N-1": m.actual_prev_year,
    }));
  }, [summary]);

  // Pie data — top-level categories
  const pieData = useMemo(() => {
    const tops = tree.filter((n) => n.level === 1 || !n.parent_code);
    return tops.map((n, i) => ({ name: n.label, value: n.totals.budget, color: PIE_COLORS[i % PIE_COLORS.length] }));
  }, [tree]);

  // Cumulative data for area chart
  const cumulData = useMemo(() => {
    if (!summary) return [];
    let cumBudget = 0, cumActual = 0;
    return summary.monthly.map((m) => {
      cumBudget += m.budget;
      cumActual += m.actual;
      return { name: MONTHS_SHORT[m.month - 1], "Budget cumulé": cumBudget, "Réel cumulé": cumActual };
    });
  }, [summary]);

  const kpis = summary?.kpis;

  // ─────────────────────────────────────────────
  // ACCESS DENIED
  // ─────────────────────────────────────────────
  if (hasAccess === false) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-4 p-8">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Accès restreint</h2>
        <p className="text-gray-500 text-center max-w-sm">
          Le module Budget RH est réservé aux rôles RH, Admin et DG.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PieChartIcon className="w-7 h-7 text-primary-600" />
            Budget RH
            {summary?.has_payroll && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium ml-2">
                Données paie
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Pilotage de la masse salariale et des charges du personnel</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Year selector */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              className="text-sm font-medium text-gray-700 bg-transparent outline-none"
            >
              {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => router.push("/dashboard/budget-rh/settings")}
            className="flex items-center gap-2 text-sm bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <Settings className="w-4 h-4" />
            Saisir le budget
          </button>
          <button
            onClick={() => window.open(`${API_URL}/api/budget-rh/export?year=${year}`, "_blank")}
            className="flex items-center gap-2 text-sm bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
          <button onClick={load} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Page tips ── */}
      {showTips && (
        <PageTourTips pageId="budgetRh" onDismiss={dismissTips} pageTitle="Budget RH" />
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex gap-2 items-center">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI Cards ── always visible ── */}
      <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Masse salariale totale"
              value={kpis ? fmtCurrency(kpis.total_budget, currency, true) : "—"}
              sub="Budget annuel"
              icon={DollarSign}
              color="blue"
              loading={loading}
            />
            <KpiCard
              title="Réalisé YTD"
              value={kpis ? fmtCurrency(kpis.total_actual, currency, true) : "—"}
              sub={kpis ? `${kpis.budget_consumed_pct}% du budget` : undefined}
              trend={kpis?.vs_prev_year_pct}
              trendLabel="vs N-1"
              icon={TrendingUp}
              color={kpis && kpis.total_actual > kpis.total_budget ? "red" : "green"}
              loading={loading}
            />
            <KpiCard
              title="Écart Budget / Réel"
              value={
                kpis
                  ? fmtCurrency(Math.abs(kpis.total_budget - kpis.total_actual), currency, true)
                  : "—"
              }
              sub={kpis && kpis.total_actual > kpis.total_budget ? "Dépassement" : "Économie"}
              icon={kpis && kpis.total_actual > kpis.total_budget ? AlertTriangle : Target}
              color={kpis && kpis.total_actual > kpis.total_budget ? "red" : "green"}
              loading={loading}
            />
            <KpiCard
              title="Comparaison N-1"
              value={
                kpis && kpis.total_prev_year
                  ? fmtCurrency(kpis.total_prev_year, currency, true)
                  : "—"
              }
              sub="Réalisé année précédente"
              trend={kpis?.vs_prev_year_pct}
              icon={BarChart3}
              color="purple"
              loading={loading}
            />
          </div>

          {/* ── Empty state — shown below KPI cards when no data ── */}
          {!loading && lines.length === 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-2xl p-8 text-center">
              <BarChart3 className="w-12 h-12 text-primary-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-primary-900 mb-2">Aucun budget saisi pour {year}</h3>
              <p className="text-primary-600 text-sm mb-4">
                Commencez par saisir vos montants budgétaires ou importez un fichier Excel.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => router.push("/dashboard/budget-rh/settings")}
                  className="bg-primary-500 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
                >
                  Saisir le budget
                </button>
                <button
                  onClick={() => router.push("/dashboard/budget-rh/settings?tab=import")}
                  className="bg-white border border-primary-200 text-primary-700 px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary-50 transition-colors"
                >
                  Importer un Excel
                </button>
              </div>
            </div>
          )}

          {/* ── Section tabs — only when data exists ── */}
          {lines.length > 0 && (<>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { id: "overview", label: "Vue d'ensemble", icon: BarChart3 },
              { id: "categories", label: "Par catégories", icon: PieChartIcon },
              { id: "table", label: "Tableau détaillé", icon: Layers },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === id
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════
              SECTION: OVERVIEW
          ═══════════════════════════════════ */}
          {activeSection === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Budget vs Réel mensuel — Composed Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Budget vs Réalisé par mois</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#066C6C" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#066C6C" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => fmtCurrency(v, currency, true)} />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Budget" fill="url(#colorBudget)" stroke="#066C6C"
                      strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Bar dataKey="Réel" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.85} />
                    <Line type="monotone" dataKey="N-1" stroke="#F59E0B" strokeWidth={1.5}
                      dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Cumul annuel — Area Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Cumul annuel — Budget vs Réalisé</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={cumulData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cumBudget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cumActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => fmtCurrency(v, currency, true)} />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Budget cumulé" stroke="#6366F1" fill="url(#cumBudget)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Réel cumulé" stroke="#10B981" fill="url(#cumActual)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Comparaison N vs N-1 — Bar Chart grouped */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Comparaison N vs N-1</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtCurrency(v, currency, true)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Réel" fill="#066C6C" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="N-1" fill="#E5E7EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Progress Bar — consommation budget */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Consommation du budget annuel</h3>
                {loading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded-lg" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Overall */}
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-700">Total masse salariale</span>
                        <span className="font-bold text-gray-900">{kpis?.budget_consumed_pct ?? 0}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            (kpis?.budget_consumed_pct ?? 0) > 100 ? "bg-red-500" : "bg-primary-500"
                          }`}
                          style={{ width: `${Math.min(kpis?.budget_consumed_pct ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>
                    {/* Per top-level category */}
                    {tree.slice(0, 5).map((node, i) => {
                      const pct = node.totals.budget > 0
                        ? Math.round((node.totals.actual / node.totals.budget) * 100)
                        : 0;
                      return (
                        <div key={node.code}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 truncate max-w-[200px]">{node.label}</span>
                            <span className="font-medium text-gray-800">{pct}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════
              SECTION: CATEGORIES
          ═══════════════════════════════════ */}
          {activeSection === "categories" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut Pie */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition par type de charge</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={130}
                      paddingAngle={3}
                      dataKey="value"
                      label={(props: any) => `${((props.percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => fmtCurrency(val, currency, true)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Stacked Bar by category */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition mensuelle par catégorie</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtCurrency(v, currency, true)} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Bar dataKey="Budget" fill="#066C6C" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category table with sparkline */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Résumé par catégorie principale</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Catégorie</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Réalisé</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Écart</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tree.map((node, i) => {
                        const ecart = node.totals.actual - node.totals.budget;
                        const pct = node.totals.budget > 0 ? (node.totals.actual / node.totals.budget) * 100 : 0;
                        return (
                          <tr key={node.code} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="font-medium text-gray-800">{node.label}</span>
                              </div>
                            </td>
                            <td className="text-right py-3 px-3 text-gray-700">{fmtCurrency(node.totals.budget, currency, true)}</td>
                            <td className="text-right py-3 px-3 text-gray-700">{node.totals.actual > 0 ? fmtCurrency(node.totals.actual, currency, true) : "—"}</td>
                            <td className={`text-right py-3 px-3 font-medium ${ecart > 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {ecart !== 0 ? (ecart > 0 ? "+" : "") + fmtCurrency(ecart, currency, true) : "—"}
                            </td>
                            <td className="text-right py-3 px-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                pct > 105 ? "bg-red-100 text-red-700" : pct > 95 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════
              SECTION: TABLE DRILL-DOWN
          ═══════════════════════════════════ */}
          {activeSection === "table" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Tableau détaillé — {year}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Tout développer
                  </button>
                  <button
                    onClick={() => setExpandedNodes(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 ml-3"
                  >
                    Réduire
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-500 uppercase tracking-wide w-64 sticky left-0 bg-gray-50 z-10">
                        Catégorie
                      </th>
                      {MONTHS_SHORT.map((m) => (
                        <th key={m} className="text-right py-3 px-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {m}
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatRows.map((row) => {
                      const isSection = row.level === 1;
                      const isGroup = row.level === 2;
                      const hasChildren = row.children.length > 0;
                      const isExpanded = expandedNodes.has(row.code);

                      return (
                        <tr
                          key={row.code}
                          className={`border-b transition-colors ${
                            isSection
                              ? "bg-primary-50 hover:bg-primary-100"
                              : isGroup
                              ? "bg-gray-50 hover:bg-gray-100"
                              : "bg-white hover:bg-gray-50"
                          }`}
                        >
                          <td
                            className={`py-2.5 px-4 sticky left-0 z-10 ${
                              isSection ? "bg-primary-50" : isGroup ? "bg-gray-50" : "bg-white"
                            }`}
                            style={{ paddingLeft: `${row.depth * 16 + 16}px` }}
                          >
                            <button
                              onClick={() => hasChildren && toggleNode(row.code)}
                              className="flex items-center gap-1.5 w-full text-left group"
                            >
                              {hasChildren ? (
                                isExpanded
                                  ? <ChevronDown className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-500 shrink-0" />
                              ) : (
                                <span className="w-3.5" />
                              )}
                              <span className={`truncate max-w-[160px] ${isSection ? "font-bold text-primary-800" : isGroup ? "font-semibold text-gray-700" : "text-gray-600"}`}>
                                {row.label}
                              </span>
                            </button>
                          </td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                            const bud = row.months[m]?.budget ?? 0;
                            return (
                              <td key={m} className={`text-right py-2.5 px-2 tabular-nums ${
                                isSection ? "font-bold text-primary-800" : isGroup ? "font-semibold text-gray-700" : "text-gray-600"
                              }`}>
                                {bud > 0 ? fmtCurrency(bud, currency, true) : <span className="text-gray-300">—</span>}
                              </td>
                            );
                          })}
                          <td className={`text-right py-2.5 px-4 tabular-nums font-bold ${
                            isSection ? "text-primary-900" : "text-gray-800"
                          }`}>
                            {row.totals.budget > 0 ? fmtCurrency(row.totals.budget, currency, true) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </>)}
      </>
    </div>
  );
}
