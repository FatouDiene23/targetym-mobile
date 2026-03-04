// ============================================
// People Analytics - Dashboard Hybride
// Fichier: app/(dashboard)/people-analytics/page.tsx
// ============================================

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from "recharts";
import {
  Users, TrendingUp, TrendingDown, UserPlus, UserMinus, Clock,
  Target, Award, BookOpen, Heart, Briefcase, AlertTriangle,
  AlertCircle, Info, ChevronRight, Download, Filter, Calendar,
  BarChart3, PieChart as PieChartIcon, Activity, Shield, Star,
  Zap, GraduationCap, Building2, ArrowUpRight, ArrowDownRight,
  RefreshCw, FileText, FileSpreadsheet, Brain, Eye, Banknote
} from "lucide-react";
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { analyticsTips } from '@/config/pageTips';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-production-06c3.up.railway.app";

// ============================================
// TYPES
// ============================================

interface OverviewData {
  total_employees: number;
  entries: number;
  exits: number;
  turnover: number;
  retention: number;
  avg_tenure: number;
  pct_hommes: number;
  pct_femmes: number;
  absenteeism: number;
  missions_en_cours: number;
  missions_budget: number;
}

// ============================================
// DONNÉES HARDCODÉES (modules non connectés)
// ============================================

const performanceByTeam = [
  { name: "Tech & Dev", score: 4.3, objectifs: 92 },
  { name: "Commercial", score: 4.1, objectifs: 88 },
  { name: "Marketing", score: 3.9, objectifs: 85 },
  { name: "Finance", score: 4.0, objectifs: 90 },
  { name: "RH", score: 4.2, objectifs: 87 },
  { name: "Opérations", score: 3.7, objectifs: 78 },
  { name: "Juridique", score: 4.1, objectifs: 91 },
];

const performanceDistribution = [
  { note: "Exceptionnel (5)", count: 28, color: "#10b981" },
  { note: "Très bien (4)", count: 95, color: "#3b82f6" },
  { note: "Bien (3)", count: 89, color: "#f59e0b" },
  { note: "À améliorer (2)", count: 32, color: "#f97316" },
  { note: "Insuffisant (1)", count: 12, color: "#ef4444" },
];

const performanceByManager = [
  { manager: "Amadou Diallo", equipe: "Tech & Dev", taille: 15, score: 4.5, trend: "+0.3" },
  { manager: "Fatou Sow", equipe: "Commercial", taille: 12, score: 4.2, trend: "+0.1" },
  { manager: "Moussa Ndiaye", equipe: "Finance", taille: 8, score: 4.0, trend: "-0.2" },
  { manager: "Aïssatou Ba", equipe: "Marketing", taille: 10, score: 3.9, trend: "+0.4" },
  { manager: "Omar Sy", equipe: "RH", taille: 6, score: 4.3, trend: "+0.2" },
  { manager: "Mariama Fall", equipe: "Opérations", taille: 14, score: 3.7, trend: "-0.1" },
];

const talentRisks = [
  { nom: "Cheikh Mbaye", poste: "Lead Developer", risque: "Élevé", raison: "Offre concurrente", departement: "Tech" },
  { nom: "Ndeye Diagne", poste: "Chef de projet", risque: "Moyen", raison: "Insatisfaction salariale", departement: "Opérations" },
  { nom: "Papa Gueye", poste: "Data Analyst", risque: "Élevé", raison: "Manque d'évolution", departement: "Tech" },
];

const formationExecution = [
  { name: "Leadership", prevu: 30, realise: 28 },
  { name: "Technique", prevu: 45, realise: 38 },
  { name: "Soft Skills", prevu: 25, realise: 22 },
  { name: "Compliance", prevu: 20, realise: 20 },
  { name: "Digital", prevu: 35, realise: 25 },
  { name: "Métier", prevu: 40, realise: 32 },
];

const competencesCoverage = [
  { subject: "Leadership", A: 85, fullMark: 100 },
  { subject: "Technique", A: 72, fullMark: 100 },
  { subject: "Communication", A: 88, fullMark: 100 },
  { subject: "Gestion projet", A: 78, fullMark: 100 },
  { subject: "Innovation", A: 65, fullMark: 100 },
  { subject: "Data/IA", A: 55, fullMark: 100 },
];

const budgetFormation = {
  total: 150000000,
  consomme: 112500000,
  restant: 37500000,
  pct: 75,
};

const engagementTrend = [
  { name: "Jan", engagement: 75, satisfaction: 78 },
  { name: "Fév", engagement: 76, satisfaction: 79 },
  { name: "Mar", engagement: 74, satisfaction: 77 },
  { name: "Avr", engagement: 78, satisfaction: 80 },
  { name: "Mai", engagement: 79, satisfaction: 82 },
  { name: "Jun", engagement: 77, satisfaction: 81 },
  { name: "Jul", engagement: 80, satisfaction: 83 },
  { name: "Aoû", engagement: 78, satisfaction: 80 },
  { name: "Sep", engagement: 81, satisfaction: 84 },
  { name: "Oct", engagement: 79, satisfaction: 82 },
  { name: "Nov", engagement: 82, satisfaction: 85 },
  { name: "Déc", engagement: 78, satisfaction: 82 },
];

const satisfactionFactors = [
  { subject: "Rémunération", A: 72, fullMark: 100 },
  { subject: "Ambiance", A: 88, fullMark: 100 },
  { subject: "Management", A: 80, fullMark: 100 },
  { subject: "Évolution", A: 65, fullMark: 100 },
  { subject: "Équilibre vie", A: 75, fullMark: 100 },
  { subject: "Conditions", A: 82, fullMark: 100 },
];

const recrutementMetrics = [
  { name: "Jan", candidatures: 120, entretiens: 35, embauches: 8 },
  { name: "Fév", candidatures: 150, entretiens: 42, embauches: 10 },
  { name: "Mar", candidatures: 180, entretiens: 50, embauches: 12 },
  { name: "Avr", candidatures: 140, entretiens: 38, embauches: 7 },
  { name: "Mai", candidatures: 160, entretiens: 45, embauches: 9 },
  { name: "Jun", candidatures: 166, entretiens: 48, embauches: 4 },
];

const sourcesRecrutement = [
  { source: "LinkedIn", candidatures: 320, embauches: 18, qualite: 82, cout: "450K" },
  { source: "Site carrière", candidatures: 280, embauches: 15, qualite: 78, cout: "120K" },
  { source: "Cooptation", candidatures: 85, embauches: 12, qualite: 92, cout: "200K" },
  { source: "Cabinets", candidatures: 45, embauches: 8, qualite: 88, cout: "1.2M" },
  { source: "Indeed", candidatures: 186, embauches: 5, qualite: 65, cout: "180K" },
];

// alertesIA est désormais calculé dynamiquement dans renderOverview()


// ============================================
// HELPERS
// ============================================

function formatXOF(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}Mrd`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toLocaleString("fr-FR");
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const token = getToken();
  if (!token) throw new Error("Non authentifié");
  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.append(k, v);
    });
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
  return res.json();
}


// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function PeopleAnalyticsPage() {
  // --- State ---
  const [activeTab, setActiveTab] = useState(0);
  const [period, setPeriod] = useState("1A");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('analytics');

  // Données réelles depuis l'API
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [effectifsEvolution, setEffectifsEvolution] = useState<any[]>([]);
  const [headcountByDept, setHeadcountByDept] = useState<any[]>([]);
  const [pyramideAges, setPyramideAges] = useState<any[]>([]);
  const [turnoverByDept, setTurnoverByDept] = useState<any[]>([]);
  const [absenteismeByDept, setAbsenteismeByDept] = useState<any[]>([]);
  const [missionsStats, setMissionsStats] = useState<any>(null);

  // Masse salariale
  const [salaireOverview, setSalaireOverview] = useState<any>(null);
  const [salaireEvolution, setSalaireEvolution] = useState<any[]>([]);
  const [salaireByDept, setSalaireByDept] = useState<any[]>([]);
  const [salaireDistribution, setSalaireDistribution] = useState<any[]>([]);
  const [salaireByContract, setSalaireByContract] = useState<any[]>([]);

  // Performance
  const [perfOverview, setPerfOverview] = useState<any>(null);
  const [perfByManager, setPerfByManager] = useState<any[]>([]);

  // Formation
  const [formationOverview, setFormationOverview] = useState<any>(null);
  const [formationByCategory, setFormationByCategory] = useState<any[]>([]);
  const [formationEvolution, setFormationEvolution] = useState<any[]>([]);

  // Talents
  const [nineboxData, setNineboxData] = useState<any[]>([]);
  const [successionData, setSuccessionData] = useState<any>(null);

  // Recrutement
  const [recrutementData, setRecrutementData] = useState<any>(null);

  // --- Fetch données réelles ---
  const fetchRealData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { period };
      if (department) params.department = department;

      const [
        overviewRes,
        evolutionRes,
        deptRes,
        pyramideRes,
        turnoverRes,
        absRes,
        missionsRes,
        deptsRes,
        salaireOvRes,
        salaireEvolRes,
        salaireDeptRes,
        salaireDistRes,
        salaireContractRes,
        perfOvRes,
        perfManagerRes,
        formOvRes,
        formCatRes,
        formEvolRes,
        nineboxRes,
        successionRes,
        recrutRes,
      ] = await Promise.allSettled([
        fetchAPI("/api/analytics/overview", params),
        fetchAPI("/api/analytics/effectifs/evolution", params),
        fetchAPI("/api/analytics/effectifs/by-department"),
        fetchAPI("/api/analytics/effectifs/pyramide-ages", department ? { department } : {}),
        fetchAPI("/api/analytics/effectifs/turnover-by-department", { period }),
        fetchAPI("/api/analytics/absenteisme/by-department", { period }),
        fetchAPI("/api/analytics/missions/stats", params),
        fetchAPI("/api/analytics/departments"),
        fetchAPI("/api/analytics/salaires/overview", params),
        fetchAPI("/api/analytics/salaires/evolution", params),
        fetchAPI("/api/analytics/salaires/by-department"),
        fetchAPI("/api/analytics/salaires/distribution"),
        fetchAPI("/api/analytics/salaires/by-contract"),
        fetchAPI("/api/analytics/performance/overview", params),
        fetchAPI("/api/analytics/performance/by-manager", { period }),
        fetchAPI("/api/analytics/formation/overview", params),
        fetchAPI("/api/analytics/formation/by-category", { period }),
        fetchAPI("/api/analytics/formation/evolution", { period }),
        fetchAPI("/api/analytics/talents/ninebox"),
        fetchAPI("/api/analytics/talents/succession"),
        fetchAPI("/api/recruitment/analytics"),
      ]);

      if (overviewRes.status === "fulfilled") setOverview(overviewRes.value);
      if (evolutionRes.status === "fulfilled") setEffectifsEvolution(evolutionRes.value);
      if (deptRes.status === "fulfilled") setHeadcountByDept(deptRes.value);
      if (pyramideRes.status === "fulfilled") setPyramideAges(pyramideRes.value);
      if (turnoverRes.status === "fulfilled") setTurnoverByDept(turnoverRes.value);
      if (absRes.status === "fulfilled") setAbsenteismeByDept(absRes.value);
      if (missionsRes.status === "fulfilled") setMissionsStats(missionsRes.value);
      if (deptsRes.status === "fulfilled") setDepartments(deptsRes.value);
      if (salaireOvRes.status === "fulfilled") setSalaireOverview(salaireOvRes.value);
      if (salaireEvolRes.status === "fulfilled") setSalaireEvolution(salaireEvolRes.value);
      if (salaireDeptRes.status === "fulfilled") setSalaireByDept(salaireDeptRes.value);
      if (salaireDistRes.status === "fulfilled") setSalaireDistribution(salaireDistRes.value);
      if (salaireContractRes.status === "fulfilled") setSalaireByContract(salaireContractRes.value);
      if (perfOvRes.status === "fulfilled") setPerfOverview(perfOvRes.value);
      if (perfManagerRes.status === "fulfilled") setPerfByManager(perfManagerRes.value);
      if (formOvRes.status === "fulfilled") setFormationOverview(formOvRes.value);
      if (formCatRes.status === "fulfilled") setFormationByCategory(formCatRes.value);
      if (formEvolRes.status === "fulfilled") setFormationEvolution(formEvolRes.value);
      if (nineboxRes.status === "fulfilled") setNineboxData(nineboxRes.value);
      if (successionRes.status === "fulfilled") setSuccessionData(successionRes.value);
      if (recrutRes.status === "fulfilled") setRecrutementData(recrutRes.value);
    } catch (err) {
      console.error("Erreur fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period, department]);

  useEffect(() => {
    fetchRealData();
  }, [fetchRealData]);


  // --- Tabs ---
  const tabs = [
    { label: "Vue d'ensemble", icon: <Eye size={16} /> },
    { label: "Effectif & Structure", icon: <Users size={16} /> },
    { label: "Performance", icon: <Target size={16} /> },
    { label: "Talents", icon: <Star size={16} /> },
    { label: "Formation", icon: <GraduationCap size={16} /> },
    { label: "Engagement", icon: <Heart size={16} /> },
    { label: "Recrutement", icon: <Briefcase size={16} /> },
    { label: "Masse Salariale", icon: <Banknote size={16} /> },
  ];


  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderKPICard = (
    label: string,
    value: string | number,
    icon: React.ReactNode,
    color: string,
    subtitle?: string,
    onClick?: () => void
  ) => (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-5 ${onClick ? "cursor-pointer hover:shadow-md hover:border-blue-200 transition-all" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );

  const renderBadge = (type: string) => {
    const styles: Record<string, string> = {
      real: "bg-green-50 text-green-700 border-green-200",
      hardcoded: "bg-amber-50 text-amber-700 border-amber-200",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[type] || ""}`}>
        {type === "real" ? "📊 Données réelles" : "📋 Données simulées"}
      </span>
    );
  };

  const AlertIcon = ({ type }: { type: string }) => {
    if (type === "AlertTriangle") return <AlertTriangle size={16} />;
    if (type === "TrendingDown") return <TrendingDown size={16} />;
    if (type === "Clock") return <Clock size={16} />;
    if (type === "Award") return <Award size={16} />;
    if (type === "TrendingUp") return <TrendingUp size={16} />;
    return <Info size={16} />;
  };


  // ============================================
  // TAB 0 - VUE D'ENSEMBLE
  // ============================================

  const renderOverview = () => {
    // Performance réelle
    const perfScore = perfOverview?.avg_score;
    const okrAvg = perfOverview?.okr?.avg_progress;
    const perfSubtitle = perfScore
      ? (okrAvg ? `${okrAvg}% avancement OKR` : `${perfOverview.total_evals} évaluations`)
      : "Aucune évaluation";

    // Talents réels depuis 9-box
    const totalTalents = nineboxData.reduce((s: number, q: any) => s + q.value, 0);
    const stars = nineboxData.find((q: any) => q.quadrant === 9)?.value ?? 0;
    const highPot = (nineboxData.find((q: any) => q.quadrant === 8)?.value ?? 0)
                  + (nineboxData.find((q: any) => q.quadrant === 7)?.value ?? 0);
    const talentsSubtitle = totalTalents > 0
      ? `${stars} stars • ${highPot} hauts potentiels`
      : "Aucun placement 9-Box";

    // Graphique performance par département
    const byDept = perfOverview?.by_department ?? [];
    const perfChartData = byDept.length > 0 ? byDept : performanceByTeam;

    // Alertes dynamiques basées sur les données réelles
    type AlertItem = { type: string; icon: string; title: string; message: string; action: string; tab: number };
    const alertesIA: AlertItem[] = [];
    const nbAtRisk = (nineboxData.find((q: any) => q.quadrant === 1)?.value ?? 0)
                   + (nineboxData.find((q: any) => q.quadrant === 2)?.value ?? 0);
    if (nbAtRisk > 0) {
      alertesIA.push({ type: "critical", icon: "AlertTriangle", title: "Collaborateurs à risque", message: `${nbAtRisk} collaborateur(s) identifié(s) à risque dans la matrice 9-Box`, action: "Voir talents", tab: 3 });
    }
    if (overview && overview.turnover >= 10) {
      alertesIA.push({ type: "warning", icon: "TrendingDown", title: "Turnover élevé", message: `Taux de turnover à ${overview.turnover}% sur la période sélectionnée`, action: "Analyser", tab: 1 });
    }
    if (overview && overview.absenteeism > 5) {
      alertesIA.push({ type: "warning", icon: "Clock", title: "Absentéisme élevé", message: `Taux d'absentéisme de ${overview.absenteeism}% sur la période`, action: "Voir détails", tab: 1 });
    }
    if (perfOverview?.okr?.at_risk > 0) {
      alertesIA.push({ type: "warning", icon: "AlertTriangle", title: "OKR à risque", message: `${perfOverview.okr.at_risk} objectif(s) à risque ou en retard`, action: "Voir OKR", tab: 2 });
    }
    if (perfOverview?.top_performers > 0) {
      alertesIA.push({ type: "info", icon: "Award", title: "Excellence détectée", message: `${perfOverview.top_performers} collaborateur(s) avec un score d'évaluation ≥ 4/5`, action: "Détails", tab: 2 });
    }
    if (perfOverview?.okr?.on_track > 0) {
      alertesIA.push({ type: "info", icon: "TrendingUp", title: "OKR en bonne progression", message: `${perfOverview.okr.on_track} objectif(s) on track sur ${perfOverview.okr.total} actifs`, action: "Voir OKR", tab: 2 });
    }

    return (
    <div className="space-y-6">
      {/* KPIs cliquables */}
      <div data-tour="analytics-kpis" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {renderKPICard(
          "Effectif total",
          overview?.total_employees ?? "—",
          <Users size={20} className="text-blue-600" />,
          "bg-blue-50",
          `${overview?.entries ?? 0} entrées / ${overview?.exits ?? 0} sorties`,
          () => setActiveTab(1)
        )}
        {renderKPICard(
          "Turnover",
          `${overview?.turnover ?? "—"}%`,
          <TrendingDown size={20} className="text-red-600" />,
          "bg-red-50",
          `Rétention: ${overview?.retention ?? "—"}%`,
          () => setActiveTab(1)
        )}
        {renderKPICard(
          "Performance moy.",
          perfScore ? `${perfScore} / 5` : "—",
          <Target size={20} className="text-green-600" />,
          "bg-green-50",
          perfSubtitle,
          () => setActiveTab(2)
        )}
        {renderKPICard(
          "Talents identifiés",
          totalTalents > 0 ? totalTalents : "—",
          <Star size={20} className="text-purple-600" />,
          "bg-purple-50",
          talentsSubtitle,
          () => setActiveTab(3)
        )}
        {renderKPICard(
          "Absentéisme",
          `${overview?.absenteeism ?? "—"}%`,
          <Clock size={20} className="text-orange-600" />,
          "bg-orange-50",
          "Sur la période sélectionnée",
          () => setActiveTab(5)
        )}
        {renderKPICard(
          "Masse salariale",
          salaireOverview ? `${formatXOF(salaireOverview.masse_mensuelle)} XOF` : "—",
          <Banknote size={20} className="text-emerald-600" />,
          "bg-emerald-50",
          "Par mois",
          () => setActiveTab(7)
        )}
      </div>

      {/* Alertes IA */}
      <div data-tour="analytics-charts" className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={20} className="text-purple-600" />
          <h3 className="font-semibold text-gray-900">Alertes & Recommandations</h3>
          {renderBadge("real")}
        </div>
        {alertesIA.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune alerte — tous les indicateurs sont dans la norme.</p>
        ) : (
          <div className="space-y-3">
            {alertesIA.map((alerte, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${
                  alerte.type === "critical" ? "bg-red-50 border-red-200" :
                  alerte.type === "warning" ? "bg-amber-50 border-amber-200" :
                  "bg-blue-50 border-blue-200"
                }`}
                onClick={() => setActiveTab(alerte.tab)}
              >
                <div className={`mt-0.5 ${
                  alerte.type === "critical" ? "text-red-600" :
                  alerte.type === "warning" ? "text-amber-600" : "text-blue-600"
                }`}>
                  <AlertIcon type={alerte.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{alerte.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{alerte.message}</p>
                </div>
                <span className="text-xs text-blue-600 font-medium whitespace-nowrap flex items-center gap-1">
                  {alerte.action} <ChevronRight size={12} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Graphiques résumés */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution effectifs */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Évolution des effectifs</h3>
            {renderBadge("real")}
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={effectifsEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="effectif" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
              <Area type="monotone" dataKey="entrees" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
              <Area type="monotone" dataKey="sorties" stroke="#ef4444" fill="#ef444420" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Performance par département */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Performance par équipe</h3>
            {renderBadge(byDept.length > 0 ? "real" : "real")}
          </div>
          {byDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byDept} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => [`${v} / 5`, "Score"]} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {byDept.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.score >= 4 ? "#10b981" : entry.score >= 3 ? "#3b82f6" : "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
              <Target size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Aucune évaluation soumise sur la période</p>
            </div>
          )}
        </div>
      </div>

      {/* Métriques gradient */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Turnover", value: `${overview?.turnover ?? "—"}%`, gradient: "from-red-500 to-orange-500", icon: <TrendingDown size={24} /> },
          { label: "Rétention", value: `${overview?.retention ?? "—"}%`, gradient: "from-green-500 to-emerald-500", icon: <Shield size={24} /> },
          { label: "Parité H/F", value: `${overview?.pct_hommes ?? "—"}/${overview?.pct_femmes ?? "—"}`, gradient: "from-blue-500 to-indigo-500", icon: <Users size={24} /> },
          { label: "Absentéisme", value: `${overview?.absenteeism ?? "—"}%`, gradient: "from-amber-500 to-yellow-500", icon: <Clock size={24} /> },
        ].map((m, i) => (
          <div key={i} className={`bg-gradient-to-br ${m.gradient} rounded-xl p-5 text-white`}>
            <div className="flex items-center justify-between mb-2 opacity-80">{m.icon}</div>
            <p className="text-3xl font-bold">{m.value}</p>
            <p className="text-sm opacity-80 mt-1">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
    );
  };


  // ============================================
  // TAB 1 - EFFECTIF & STRUCTURE
  // ============================================

  const renderEffectif = () => (
    <div className="space-y-6">
      {renderBadge("real")}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-3">
        {renderKPICard("Effectif total", overview?.total_employees ?? "—", <Users size={20} className="text-blue-600" />, "bg-blue-50")}
        {renderKPICard("Entrées", overview?.entries ?? "—", <UserPlus size={20} className="text-green-600" />, "bg-green-50", "Sur la période")}
        {renderKPICard("Sorties", overview?.exits ?? "—", <UserMinus size={20} className="text-red-600" />, "bg-red-50", "Sur la période")}
        {renderKPICard("Turnover", `${overview?.turnover ?? "—"}%`, <TrendingDown size={20} className="text-orange-600" />, "bg-orange-50")}
        {renderKPICard("Ancienneté moy.", `${overview?.avg_tenure ?? "—"} ans`, <Clock size={20} className="text-purple-600" />, "bg-purple-50")}
        {renderKPICard("Parité H/F", `${overview?.pct_hommes ?? "—"}% / ${overview?.pct_femmes ?? "—"}%`, <Users size={20} className="text-indigo-600" />, "bg-indigo-50")}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution effectifs */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Évolution des effectifs</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={effectifsEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="effectif" name="Effectif" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
              <Area type="monotone" dataKey="entrees" name="Entrées" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
              <Area type="monotone" dataKey="sorties" name="Sorties" stroke="#ef4444" fill="#ef444420" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition par département */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Répartition par département</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={headcountByDept}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {headcountByDept.map((entry, i) => (
                  <Cell key={i} fill={entry.color || "#3b82f6"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Pyramide des âges */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Pyramide des âges</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pyramideAges}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="tranche" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="hommes" name="Hommes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="femmes" name="Femmes" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Turnover par département */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Turnover par département</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={turnoverByDept}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="taux" name="Turnover" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                {turnoverByDept.map((entry, i) => (
                  <Cell key={i} fill={entry.taux > 10 ? "#ef4444" : entry.taux > 5 ? "#f59e0b" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );


  // ============================================
  // TAB 2 - PERFORMANCE
  // ============================================

  const renderPerformance = () => {
    const okr = perfOverview?.okr;
    const dist = perfOverview?.score_distribution ?? [];
    const byDept = perfOverview?.by_department ?? [];
    const hasEvals = perfOverview?.total_evals > 0;
    const hasOkr = okr?.total > 0;

    return (
    <div className="space-y-6">
      {renderBadge("real")}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
        {renderKPICard(
          "OKR — Avancement moyen",
          okr ? `${okr.avg_progress}%` : "—",
          <Target size={20} className="text-green-600" />,
          "bg-green-50",
          okr ? `${okr.on_track} on track • ${okr.at_risk} à risque` : undefined
        )}
        {renderKPICard(
          "Score moyen (évals)",
          hasEvals ? `${perfOverview.avg_score} / 5` : "—",
          <Award size={20} className="text-blue-600" />,
          "bg-blue-50",
          hasEvals ? `${perfOverview.total_evals} évaluations` : "Aucune évaluation"
        )}
        {renderKPICard(
          "OKR complétés",
          okr ? okr.completed : "—",
          <TrendingUp size={20} className="text-emerald-600" />,
          "bg-emerald-50",
          okr ? `sur ${okr.total} objectifs` : undefined
        )}
        {renderKPICard(
          "Top Performers",
          hasEvals ? perfOverview.top_performers : "—",
          <Star size={20} className="text-purple-600" />,
          "bg-purple-50",
          "Score ≥ 4 / 5"
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score moyen par département */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Score moyen par département</h3>
            {renderBadge("real")}
          </div>
          {byDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byDept} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(v: number) => [`${v} / 5`, "Score"]} />
                <Bar dataKey="score" name="Score" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {byDept.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.score >= 4 ? "#10b981" : entry.score >= 3 ? "#3b82f6" : "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <Target size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Aucune évaluation soumise sur la période</p>
            </div>
          )}
        </div>

        {/* Distribution des notes */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Distribution des évaluations</h3>
            {renderBadge("real")}
          </div>
          {dist.some((d: any) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="note" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Employés" radius={[4, 4, 0, 0]}>
                  {dist.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <Award size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Aucune évaluation soumise sur la période</p>
            </div>
          )}
        </div>
      </div>

      {/* OKR — répartition par statut */}
      {hasOkr && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Statut des OKR</h3>
            {renderBadge("real")}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "On Track", value: okr.on_track, color: "text-green-600 bg-green-50", border: "border-green-200" },
              { label: "Complétés", value: okr.completed, color: "text-blue-600 bg-blue-50", border: "border-blue-200" },
              { label: "À risque", value: okr.at_risk, color: "text-amber-600 bg-amber-50", border: "border-amber-200" },
              { label: "Total actifs", value: okr.total, color: "text-gray-600 bg-gray-50", border: "border-gray-200" },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-4 text-center ${item.color} ${item.border}`}>
                <p className="text-3xl font-bold">{item.value}</p>
                <p className="text-sm mt-1 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau managers */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Performance par manager</h3>
          {renderBadge("real")}
        </div>
        {perfByManager.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Manager</th>
                  <th className="pb-3 font-medium">Équipe</th>
                  <th className="pb-3 font-medium text-center">Taille</th>
                  <th className="pb-3 font-medium text-center">Score moy.</th>
                </tr>
              </thead>
              <tbody>
                {perfByManager.map((m: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{m.manager}</td>
                    <td className="py-3 text-gray-600">{m.equipe}</td>
                    <td className="py-3 text-center">{m.taille}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        m.score >= 4 ? "bg-green-100 text-green-700" :
                        m.score >= 3 ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {m.score} / 5
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-8">Aucune évaluation manager soumise sur la période</p>
        )}
      </div>
    </div>
    );
  };


  // ============================================
  // TAB 3 - TALENTS
  // ============================================

  const renderTalents = () => {
    const hasNinebox = nineboxData.some((q: any) => q.value > 0);
    const totalNinebox = nineboxData.reduce((s: number, q: any) => s + q.value, 0);
    const stars = nineboxData.find((q: any) => q.quadrant === 9)?.value ?? 0;
    const highPotential = (nineboxData.find((q: any) => q.quadrant === 8)?.value ?? 0) + (nineboxData.find((q: any) => q.quadrant === 7)?.value ?? 0);
    const piliers = (nineboxData.find((q: any) => q.quadrant === 6)?.value ?? 0) + (nineboxData.find((q: any) => q.quadrant === 5)?.value ?? 0);
    const atRisk = (nineboxData.find((q: any) => q.quadrant === 1)?.value ?? 0) + (nineboxData.find((q: any) => q.quadrant === 2)?.value ?? 0);
    const plans = successionData?.plans ?? [];
    const coveredPct = successionData?.covered_pct ?? 0;

    return (
    <div className="space-y-6">
      {renderBadge("real")}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-3">
        {renderKPICard(
          "Stars",
          hasNinebox ? `${stars} (${totalNinebox > 0 ? Math.round(stars / totalNinebox * 100) : 0}%)` : "—",
          <Star size={20} className="text-green-600" />, "bg-green-50"
        )}
        {renderKPICard(
          "Hauts potentiels",
          hasNinebox ? highPotential : "—",
          <Zap size={20} className="text-blue-600" />, "bg-blue-50"
        )}
        {renderKPICard(
          "Piliers",
          hasNinebox ? piliers : "—",
          <Shield size={20} className="text-purple-600" />, "bg-purple-50"
        )}
        {renderKPICard(
          "Postes clés couverts",
          successionData ? `${coveredPct}%` : "—",
          <Target size={20} className="text-emerald-600" />, "bg-emerald-50",
          successionData ? `${successionData.total_plans} plans` : undefined
        )}
        {renderKPICard(
          "À risque (9-box)",
          hasNinebox ? atRisk : "—",
          <AlertTriangle size={20} className="text-red-600" />, "bg-red-50"
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 9-Box */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Distribution 9-Box</h3>
            {renderBadge("real")}
          </div>
          {hasNinebox ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={nineboxData.filter((q: any) => q.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }: any) => totalNinebox > 0 ? `${name}: ${Math.round(value / totalNinebox * 100)}%` : `${name}`}
                >
                  {nineboxData.filter((q: any) => q.value > 0).map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v} employés`, name]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <Star size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun placement 9-Box</p>
              <p className="text-xs mt-1">Évaluez vos collaborateurs dans Talents & Carrière</p>
            </div>
          )}
        </div>

        {/* Couverture succession */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Couverture de succession</h3>
            {renderBadge("real")}
          </div>
          <div className="space-y-4 overflow-y-auto max-h-72">
            {plans.length > 0 ? plans.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{s.poste}</p>
                  <p className="text-xs text-gray-500">{s.titulaire}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{s.successeurs}</p>
                  <p className="text-[10px] text-gray-400">successeurs</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{s.pret}</p>
                  <p className="text-[10px] text-gray-400">prêts</p>
                </div>
                <div className="w-24">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.couverture >= 100 ? "bg-green-500" :
                          s.couverture >= 50 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(s.couverture, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{s.couverture}%</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Shield size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun plan de succession</p>
                <p className="text-xs mt-1">Configurez vos plans dans Talents & Carrière</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };


  // ============================================
  // TAB 4 - FORMATION
  // ============================================

  const renderFormation = () => {
    const fo = formationOverview;
    const hasCat = formationByCategory.length > 0;
    const hasEvol = formationEvolution.length > 0;

    return (
    <div className="space-y-6">
      {renderBadge("real")}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
        {renderKPICard(
          "Taux de complétion",
          fo ? `${fo.completion_rate}%` : "—",
          <Target size={20} className="text-blue-600" />,
          "bg-blue-50",
          fo ? `${fo.completed} / ${fo.total_assignments} formations` : undefined
        )}
        {renderKPICard(
          "Formations complétées",
          fo?.completed ?? "—",
          <GraduationCap size={20} className="text-green-600" />,
          "bg-green-50",
          fo ? `${fo.in_progress} en cours` : undefined
        )}
        {renderKPICard(
          "Cours disponibles",
          fo?.total_courses ?? "—",
          <Clock size={20} className="text-purple-600" />,
          "bg-purple-50",
          "Catalogue de formation"
        )}
        {renderKPICard(
          "Total assignées",
          fo?.total_assignments ?? "—",
          <Users size={20} className="text-amber-600" />,
          "bg-amber-50",
          fo ? `${fo.in_progress} en cours` : undefined
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exécution par catégorie */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Formations par catégorie</h3>
            {renderBadge("real")}
          </div>
          {hasCat ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={formationByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="nb_assignments" name="Assignées" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="nb_completed" name="Complétées" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <GraduationCap size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucune formation par catégorie</p>
              <p className="text-xs mt-1">Assignez des formations pour voir la répartition</p>
            </div>
          )}
        </div>

        {/* Évolution mensuelle */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Évolution mensuelle</h3>
            {renderBadge("real")}
          </div>
          {hasEvol ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={formationEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="assignees" name="Assignées" stroke="#93c5fd" fill="#93c5fd20" strokeWidth={2} />
                <Area type="monotone" dataKey="completes" name="Complétées" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <TrendingUp size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucune évolution à afficher</p>
              <p className="text-xs mt-1">Les données apparaîtront au fil des mois</p>
            </div>
          )}
        </div>
      </div>

      {/* Statut global */}
      {fo && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Répartition par statut</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Complétées", value: fo.completed, color: "bg-green-500", pct: fo.total_assignments > 0 ? Math.round(fo.completed / fo.total_assignments * 100) : 0 },
              { label: "En cours", value: fo.in_progress, color: "bg-blue-500", pct: fo.total_assignments > 0 ? Math.round(fo.in_progress / fo.total_assignments * 100) : 0 },
              { label: "Cours disponibles", value: fo.total_courses, color: "bg-purple-500", pct: 100 },
              { label: "Total assignées", value: fo.total_assignments, color: "bg-gray-400", pct: 100 },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl border">
                <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                <p className="text-sm text-gray-500 mt-1">{item.label}</p>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{item.pct}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    );
  };


  // ============================================
  // TAB 5 - ENGAGEMENT
  // ============================================

  const renderEngagement = () => (
    <div className="space-y-6">
      <div className="flex gap-2">
        {renderBadge("hardcoded")}
        <span className="text-xs text-gray-400">Absentéisme: données réelles</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
        {renderKPICard("Index engagement", "78%", <Heart size={20} className="text-pink-600" />, "bg-pink-50", "+3pts")}
        {renderKPICard("Satisfaction", "82%", <Star size={20} className="text-green-600" />, "bg-green-50")}
        {renderKPICard("Absentéisme", `${overview?.absenteeism ?? "3.4"}%`, <Clock size={20} className="text-amber-600" />, "bg-amber-50")}
        {renderKPICard("Alertes RPS", "12", <AlertTriangle size={20} className="text-red-600" />, "bg-red-50")}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendance engagement */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tendance engagement & satisfaction</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={engagementTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="engagement" name="Engagement" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="satisfaction" name="Satisfaction" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Radar satisfaction */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Facteurs de satisfaction</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={satisfactionFactors}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Score" dataKey="A" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Absentéisme par département - DONNÉES RÉELLES */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Absentéisme par département</h3>
          {renderBadge("real")}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={absenteismeByDept}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="department" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="taux" name="Taux d'absentéisme" radius={[4, 4, 0, 0]}>
              {absenteismeByDept.map((entry, i) => (
                <Cell key={i} fill={entry.taux > 5 ? "#ef4444" : entry.taux > 3 ? "#f59e0b" : "#10b981"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );


  // ============================================
  // TAB 6 - RECRUTEMENT
  // ============================================

  const renderRecrutement = () => {
    const rd = recrutementData;
    const stats = rd?.stats;
    const pipeline = rd?.pipeline ?? [];
    const sources = rd?.sources ?? [];
    const trend = (rd?.hiring_trend ?? []).map((t: any) => ({
      name: t.month,
      candidatures: t.applications,
      embauches: t.hires,
    }));
    const hasReal = !!rd;

    return (
    <div className="space-y-6">
      {renderBadge(hasReal ? "real" : "hardcoded")}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-3">
        {renderKPICard(
          "Postes ouverts",
          stats?.open_positions ?? "8",
          <Briefcase size={20} className="text-blue-600" />, "bg-blue-50"
        )}
        {renderKPICard(
          "Candidats actifs",
          stats?.total_candidates ?? "916",
          <FileText size={20} className="text-purple-600" />, "bg-purple-50",
          stats ? `${stats.in_interview} en entretien` : undefined
        )}
        {renderKPICard(
          "Embauches (année)",
          stats?.hires_this_year ?? "50",
          <UserPlus size={20} className="text-green-600" />, "bg-green-50",
          stats ? `${stats.hires_this_month} ce mois` : undefined
        )}
        {renderKPICard(
          "Délai moyen d'embauche",
          stats?.avg_time_to_hire != null ? `${stats.avg_time_to_hire} jours` : "32 jours",
          <Clock size={20} className="text-amber-600" />, "bg-amber-50"
        )}
        {renderKPICard(
          "En entretien",
          stats?.in_interview ?? "—",
          <Activity size={20} className="text-red-600" />, "bg-red-50"
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline funnel */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Funnel de recrutement</h3>
          {pipeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipeline} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="stage_label" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" name="Candidats" radius={[0, 4, 4, 0]}>
                  {pipeline.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color || "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={recrutementMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="candidatures" name="Candidatures" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} />
                <Area type="monotone" dataKey="entretiens" name="Entretiens" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                <Area type="monotone" dataKey="embauches" name="Embauches" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tendance mensuelle */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tendance mensuelle</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend.length > 0 ? trend : recrutementMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="candidatures" name="Candidatures" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} />
              <Area type="monotone" dataKey="embauches" name="Embauches" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sources */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Sources de recrutement</h3>
          {renderBadge(sources.length > 0 ? "real" : "hardcoded")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">Source</th>
                <th className="pb-3 font-medium text-center">Candidatures</th>
                <th className="pb-3 font-medium text-center">% du total</th>
              </tr>
            </thead>
            <tbody>
              {(sources.length > 0 ? sources : sourcesRecrutement.map((s) => ({ source: s.source, count: s.candidatures, percentage: s.qualite }))).map((s: any, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color || "#3b82f6" }} />
                    {s.source}
                  </td>
                  <td className="py-3 text-center">{s.count ?? s.candidatures}</td>
                  <td className="py-3 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(s.percentage ?? s.qualite, 100)}%` }} />
                      </div>
                      <span className="text-xs">{s.percentage ?? s.qualite}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };


  // ============================================
  // TAB 7 - MASSE SALARIALE
  // ============================================

  const renderMasseSalariale = () => (
    <div className="space-y-6">
      {renderBadge("real")}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-3">
        {renderKPICard(
          "Masse annuelle",
          salaireOverview ? `${formatXOF(salaireOverview.masse_annuelle)} XOF` : "—",
          <Banknote size={20} className="text-blue-600" />,
          "bg-blue-50",
          salaireOverview ? `${formatXOF(salaireOverview.masse_mensuelle)} XOF / mois` : undefined
        )}
        {renderKPICard(
          "Salaire moyen",
          salaireOverview ? `${formatXOF(salaireOverview.salaire_moyen)} XOF` : "—",
          <TrendingUp size={20} className="text-green-600" />,
          "bg-green-50"
        )}
        {renderKPICard(
          "Salaire médian",
          salaireOverview ? `${formatXOF(salaireOverview.salaire_median)} XOF` : "—",
          <Activity size={20} className="text-purple-600" />,
          "bg-purple-50"
        )}
        {renderKPICard(
          "Écart salarial H/F",
          salaireOverview ? `${salaireOverview.ecart_salarial_hf}%` : "—",
          <Users size={20} className="text-pink-600" />,
          "bg-pink-50",
          salaireOverview ? `H: ${formatXOF(salaireOverview.salaire_moy_hommes)} / F: ${formatXOF(salaireOverview.salaire_moy_femmes)}` : undefined
        )}
        {renderKPICard(
          "Augmentations",
          salaireOverview?.nb_augmentations ?? "—",
          <ArrowUpRight size={20} className="text-emerald-600" />,
          "bg-emerald-50",
          salaireOverview ? `Moy: +${salaireOverview.pct_augmentation_moy}%` : undefined
        )}
        {renderKPICard(
          "Employés rémunérés",
          salaireOverview?.nb_avec_salaire ?? "—",
          <Award size={20} className="text-amber-600" />,
          "bg-amber-50"
        )}
      </div>

      {/* Évolution masse salariale + répartition par département */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Évolution de la masse salariale</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salaireEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatXOF(v)} />
              <Tooltip formatter={(v: number) => [`${formatXOF(v)} XOF`, ""]} />
              <Legend />
              <Area
                type="monotone"
                dataKey="masse_salariale"
                name="Masse salariale"
                stroke="#3b82f6"
                fill="#3b82f620"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="salaire_moyen"
                name="Salaire moyen"
                stroke="#10b981"
                fill="#10b98120"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Répartition par département</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={salaireByDept}
                dataKey="masse_salariale"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, payload }: any) => `${name}: ${payload?.pct_total ?? 0}%`}
              >
                {salaireByDept.map((entry, i) => (
                  <Cell key={i} fill={entry.color || "#3b82f6"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${formatXOF(v)} XOF`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution par tranches + par contrat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Distribution par tranches salariales</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salaireDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="tranche" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  name === "nb_employes" ? `${v} employés` : `${formatXOF(v)} XOF`,
                  name === "nb_employes" ? "Effectif" : "Salaire moyen",
                ]}
              />
              <Bar dataKey="nb_employes" name="Effectif" radius={[4, 4, 0, 0]}>
                {salaireDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Masse salariale par type de contrat</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salaireByContract} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatXOF(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number) => `${formatXOF(v)} XOF`} />
              <Bar dataKey="masse_salariale" name="Masse salariale" radius={[0, 4, 4, 0]}>
                {salaireByContract.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tableau détaillé par département */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Détail par département</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">Département</th>
                <th className="pb-3 font-medium text-center">Effectif</th>
                <th className="pb-3 font-medium text-right">Masse salariale / mois</th>
                <th className="pb-3 font-medium text-right">Salaire moyen</th>
                <th className="pb-3 font-medium text-center">% du total</th>
              </tr>
            </thead>
            <tbody>
              {salaireByDept.map((d, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />
                    {d.name}
                  </td>
                  <td className="py-3 text-center">{d.effectif}</td>
                  <td className="py-3 text-right">{formatXOF(d.masse_salariale)} XOF</td>
                  <td className="py-3 text-right">{formatXOF(d.salaire_moyen)} XOF</td>
                  <td className="py-3 text-center">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(d.pct_total, 100)}%`, background: d.color }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{d.pct_total}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {salaireByDept.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">Aucune donnée salariale disponible</p>
          )}
        </div>
      </div>
    </div>
  );


  // ============================================
  // RENDER PRINCIPAL
  // ============================================

  const tabRenderers = [
    renderOverview,
    renderEffectif,
    renderPerformance,
    renderTalents,
    renderFormation,
    renderEngagement,
    renderRecrutement,
    renderMasseSalariale,
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {showTips && (
        <PageTourTips
          tips={analyticsTips}
          onDismiss={dismissTips}
          pageTitle="People Analytics"
        />
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">People Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Tableaux de bord et indicateurs RH</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtre département */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="pl-8 pr-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="">Tous les départements</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Filtre période */}
          <div className="flex items-center bg-white border rounded-lg overflow-hidden">
            {["1M", "3M", "6M", "1A"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchRealData}
            className="p-2 border rounded-lg hover:bg-gray-50 transition-colors"
            title="Actualiser"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : "text-gray-600"} />
          </button>

          {/* Export buttons */}
          <div data-tour="analytics-export" className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <FileSpreadsheet size={14} />
              Excel
            </button>
            <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <FileText size={14} />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b mb-6 overflow-x-auto pb-px">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === i
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-blue-600" />
          <span className="ml-3 text-gray-500">Chargement des données...</span>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div>{tabRenderers[activeTab]()}</div>
      )}
    </div>
  );
}