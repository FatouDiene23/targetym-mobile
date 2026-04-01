// ============================================
// People Analytics - Dashboard Hybride
// Fichier: app/(dashboard)/people-analytics/page.tsx
// ============================================

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import * as XLSX from 'xlsx';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { analyticsTips } from '@/config/pageTips';
import { useGroupContext } from '@/hooks/useGroupContext';
import { fetchWithAuth } from '@/lib/api';

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
  if (value == null || isNaN(value)) return '0';
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}Mrd`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toLocaleString("fr-FR");
}

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');
  const url = new URL(`${baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.append(k, v);
    });
  }
  const res = await fetchWithAuth(url.toString());
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
  return res.json();
}


// ============================================
// COMPOSANT PRINCIPAL
// ============================================

// Mapping section URL → index onglet
const SECTION_TO_TAB: Record<string, number> = {
  'overview': 0,
  'effectif': 1,
  'performance': 2,
  'talents': 3,
  'formation': 4,
  'engagement': 5,
  'recrutement': 6,
  'masse-salariale': 7,
  'impact-formation': 8,
};
const TAB_TO_SECTION = Object.entries(SECTION_TO_TAB).reduce<Record<number, string>>(
  (acc, [k, v]) => { acc[v] = k; return acc; }, {}
);

const SECTION_HEADERS: Record<string, { title: string; subtitle: string }> = {
  'overview':         { title: "People Analytics",   subtitle: "Tableaux de bord et indicateurs RH" },
  'effectif':         { title: "Effectif & Structure", subtitle: "Analyse des effectifs et de l'organisation" },
  'performance':      { title: "Performance",        subtitle: "Indicateurs de performance et évaluations" },
  'talents':          { title: "Talents",            subtitle: "Gestion et identification des talents" },
  'formation':        { title: "Formation",          subtitle: "Suivi des formations et développement des compétences" },
  'engagement':       { title: "Engagement",         subtitle: "Mesure de l'engagement et satisfaction des équipes" },
  'recrutement':      { title: "Recrutement",        subtitle: "Analyse du pipeline et performance du recrutement" },
  'masse-salariale':  { title: "Masse Salariale",    subtitle: "Analyse et évolution de la masse salariale" },
  'impact-formation': { title: "Impact Formation",   subtitle: "ROI des formations et impact sur la performance" },
};

export default function PeopleAnalyticsPage() {
  // --- Navigation par query param ?section= ---
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentSection = searchParams.get('section') ?? 'overview';
  const activeTab = SECTION_TO_TAB[currentSection] ?? 0;
  const setActiveTab = useCallback((idx: number) => {
    const section = TAB_TO_SECTION[idx] ?? 'overview';
    router.push(`/dashboard/analytics?section=${section}`);
  }, [router]);

  // --- State ---
  const [period, setPeriod] = useState("1A");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('analytics');

  // Contexte groupe : sélecteur de filiale
  const { selectedTenantId, selectedSubsidiary } = useGroupContext();

  // Données réelles depuis l'API
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [effectifsEvolution, setEffectifsEvolution] = useState<any[]>([]);
  const [headcountByDept, setHeadcountByDept] = useState<any[]>([]);
  const [pyramideAges, setPyramideAges] = useState<any[]>([]);
  const [turnoverByDept, setTurnoverByDept] = useState<any[]>([]);
  const [, setAbsenteismeByDept] = useState<any[]>([]);
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

  // Engagement (Enquêtes Pulse)
  const [engagementData, setEngagementData] = useState<{
    index: number | null;
    surveys: { id: number; title: string; date: string; score: number; total: number; completed: number; questions: { question_id: number; question_text: string; average: number | null; question_type: string }[] }[];
    loading: boolean;
  }>({ index: null, surveys: [], loading: true });

  // Impact Formation (plans de formation)
  const [trainingPlans, setTrainingPlans] = useState<any[]>([]);
  const [trainingPlanAnalytics, setTrainingPlanAnalytics] = useState<any>(null);
  const [subsidiariesList, setSubsidiariesList] = useState<any[]>([]);

  // --- Fetch données réelles ---
  const fetchRealData = useCallback(async () => {
    setLoading(true);
    try {
      const scopedParams: Record<string, string> = selectedTenantId
        ? { subsidiary_tenant_id: selectedTenantId.toString() }
        : {};
      const params: Record<string, string> = { period, ...scopedParams };
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
        trainingPlansRes,
        trainingPlanAnalyticsRes,
        subsidiariesRes,
      ] = await Promise.allSettled([
        fetchAPI("/api/analytics/overview", params),
        fetchAPI("/api/analytics/effectifs/evolution", params),
        fetchAPI("/api/analytics/effectifs/by-department", scopedParams),
        fetchAPI("/api/analytics/effectifs/pyramide-ages", department ? { department, ...scopedParams } : scopedParams),
        fetchAPI("/api/analytics/effectifs/turnover-by-department", { period, ...scopedParams }),
        fetchAPI("/api/analytics/absenteisme/by-department", { period, ...scopedParams }),
        fetchAPI("/api/analytics/missions/stats", params),
        fetchAPI("/api/analytics/departments", scopedParams),
        fetchAPI("/api/analytics/salaires/overview", params),
        fetchAPI("/api/analytics/salaires/evolution", params),
        fetchAPI("/api/analytics/salaires/by-department", scopedParams),
        fetchAPI("/api/analytics/salaires/distribution", scopedParams),
        fetchAPI("/api/analytics/salaires/by-contract", scopedParams),
        fetchAPI("/api/analytics/performance/overview", params),
        fetchAPI("/api/analytics/performance/by-manager", { period, ...scopedParams }),
        fetchAPI("/api/analytics/formation/overview", params),
        fetchAPI("/api/analytics/formation/by-category", { period, ...scopedParams }),
        fetchAPI("/api/analytics/formation/evolution", { period, ...scopedParams }),
        fetchAPI("/api/analytics/talents/ninebox", scopedParams),
        fetchAPI("/api/analytics/talents/succession", scopedParams),
        fetchAPI("/api/recruitment/analytics", scopedParams),
        fetchAPI("/api/training-plans/", scopedParams),
        fetchAPI("/api/training-plans/analytics", params),
        fetchAPI("/api/platform/groups/subsidiaries", {}),
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
      if (salaireDeptRes.status === "fulfilled") {
        const deptColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
        setSalaireByDept(salaireDeptRes.value.map((d: any, i: number) => ({ ...d, name: d.department, color: deptColors[i % deptColors.length] })));
      }
      if (salaireDistRes.status === "fulfilled") {
        const distColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
        setSalaireDistribution(salaireDistRes.value.map((d: any, i: number) => ({ ...d, color: distColors[i % distColors.length] })));
      }
      if (salaireContractRes.status === "fulfilled") {
        const contractColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
        setSalaireByContract(salaireContractRes.value.map((d: any, i: number) => ({ ...d, name: d.contract_type, color: contractColors[i % contractColors.length] })));
      }
      if (perfOvRes.status === "fulfilled") setPerfOverview(perfOvRes.value);
      if (perfManagerRes.status === "fulfilled") setPerfByManager(perfManagerRes.value);
      if (formOvRes.status === "fulfilled") setFormationOverview(formOvRes.value);
      if (formCatRes.status === "fulfilled") setFormationByCategory(formCatRes.value);
      if (formEvolRes.status === "fulfilled") setFormationEvolution(formEvolRes.value);
      if (nineboxRes.status === "fulfilled") setNineboxData(nineboxRes.value);
      if (successionRes.status === "fulfilled") setSuccessionData(successionRes.value);
      if (recrutRes.status === "fulfilled") setRecrutementData(recrutRes.value);
      if (trainingPlansRes.status === "fulfilled") {
        const plans = Array.isArray(trainingPlansRes.value) ? trainingPlansRes.value : (trainingPlansRes.value?.items ?? []);
        setTrainingPlans(plans);
      }
      if (trainingPlanAnalyticsRes.status === "fulfilled") setTrainingPlanAnalytics(trainingPlanAnalyticsRes.value);
      if (subsidiariesRes.status === "fulfilled") {
        const subs = Array.isArray(subsidiariesRes.value) ? subsidiariesRes.value : (subsidiariesRes.value?.subsidiaries ?? []);
        setSubsidiariesList(subs);
      }
    } catch (err) {
      console.error("Erreur fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period, department, selectedTenantId]);

  useEffect(() => {
    fetchRealData();
  }, [fetchRealData]);

  // --- Fetch Engagement (Enquêtes Pulse) ---
  const fetchEngagementData = useCallback(async () => {
    setEngagementData(prev => ({ ...prev, loading: true }));
    try {
      // Fetch all pulse surveys (active + closed) in a single call
      const pulseRes = await fetchAPI("/api/surveys/", { survey_type: "pulse", page_size: "100" });
      console.log("[Engagement] GET /api/surveys?survey_type=pulse →", pulseRes, "| count:", Array.isArray(pulseRes) ? pulseRes.length : "not array");
      const allPulse = (Array.isArray(pulseRes) ? pulseRes : (pulseRes?.items ?? []))
        .filter((s: any) => s.status === "active" || s.status === "cloturee");

      // Build department filter params for results endpoint
      const deptParams: Record<string, string> = {};
      if (department) deptParams.department = department;

      // Fetch results for each survey
      const resultsPromises = allPulse.map(async (s: any) => {
        try {
          const results = await fetchAPI(`/api/surveys/${s.id}/results`, deptParams);
          const likertQuestions = (results.questions ?? []).filter(
            (q: any) => (q.question_type === "likert_5" || q.question_type === "likert_10") && q.average != null
          );
          const normalizedScores = likertQuestions.map((q: any) =>
            q.question_type === "likert_5" ? (q.average / 5) * 10 : q.average
          );
          const avgScore = normalizedScores.length > 0
            ? normalizedScores.reduce((a: number, b: number) => a + b, 0) / normalizedScores.length
            : null;
          return {
            id: s.id,
            title: s.title,
            date: s.end_date || s.start_date || s.created_at,
            score: avgScore != null ? Math.round(avgScore * 100) / 100 : 0,
            total: results.total_responses ?? 0,
            completed: results.completed_responses ?? 0,
            questions: (results.questions ?? [])
              .filter((q: any) => (q.question_type === "likert_5" || q.question_type === "likert_10") && q.average != null)
              .map((q: any) => ({
                question_id: q.question_id,
                question_text: q.question_text,
                average: q.question_type === "likert_5" ? Math.round((q.average / 5) * 10 * 100) / 100 : Math.round(q.average * 100) / 100,
                question_type: q.question_type,
              })),
          };
        } catch { return null; }
      });
      const results = await Promise.all(resultsPromises);
      const validSurveys = results.filter(Boolean) as any[];

      // Global engagement index: average of all survey scores
      const scoredSurveys = validSurveys.filter(s => s.score > 0);
      const globalIndex = scoredSurveys.length > 0
        ? Math.round((scoredSurveys.reduce((a: any, s: any) => a + s.score, 0) / scoredSurveys.length) * 100) / 100
        : null;

      setEngagementData({ index: globalIndex, surveys: validSurveys, loading: false });
    } catch (err) {
      console.error("Erreur fetch engagement:", err);
      setEngagementData({ index: null, surveys: [], loading: false });
    }
  }, [department]);

  useEffect(() => {
    fetchEngagementData();
  }, [fetchEngagementData]);


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
                      </div>
          {hasEvol ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={formationEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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

  const renderEngagement = () => {
    const { index: engagementIndex, surveys: pulseSurveys, loading: engLoading } = engagementData;

    // État vide : aucune enquête pulse
    if (!engLoading && pulseSurveys.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Heart size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-semibold text-gray-600">Aucune Enquête Flash pour le moment</p>
            <p className="text-sm text-gray-400 mt-2 mb-6 text-center max-w-md">
              Les Enquêtes Flash permettent de mesurer l&apos;engagement et la satisfaction de vos équipes en continu.
            </p>
            <button
              onClick={() => router.push("/dashboard/surveys")}
              className="px-5 py-2.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium text-sm"
            >
              Créer une Enquête Flash
            </button>
          </div>
        </div>
      );
    }

    if (engLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">Chargement des données d&apos;engagement…</span>
        </div>
      );
    }

    // Couleur de la jauge engagement
    const getEngagementColor = (score: number) => {
      if (score < 4) return { bg: "bg-red-500", text: "text-red-600", label: "Critique" };
      if (score < 6) return { bg: "bg-orange-500", text: "text-orange-600", label: "À surveiller" };
      if (score < 8) return { bg: "bg-lime-500", text: "text-lime-600", label: "Bon" };
      return { bg: "bg-green-600", text: "text-green-700", label: "Excellent" };
    };

    // Taux de participation global
    const totalInvited = pulseSurveys.reduce((a, s) => a + s.total, 0);
    const totalCompleted = pulseSurveys.reduce((a, s) => a + s.completed, 0);
    const participationRate = totalInvited > 0 ? Math.round((totalCompleted / totalInvited) * 100) : 0;

    // Alertes RPS
    const rpsAlerts = pulseSurveys.filter(s => s.score > 0 && s.score < 5);

    // Tendance : données pour le line chart
    const trendData = pulseSurveys
      .filter(s => s.score > 0 && s.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(s => ({
        name: new Date(s.date).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        score: s.score,
        enquete: s.title,
      }));

    // Facteurs de satisfaction : agréger par question text
    const questionMap = new Map<string, { total: number; count: number }>();
    pulseSurveys.forEach(s => {
      s.questions.forEach(q => {
        const existing = questionMap.get(q.question_text) || { total: 0, count: 0 };
        existing.total += q.average ?? 0;
        existing.count += 1;
        questionMap.set(q.question_text, existing);
      });
    });
    const satisfactionFactors = Array.from(questionMap.entries())
      .map(([text, { total, count }]) => ({ question: text, score: Math.round((total / count) * 100) / 100 }))
      .sort((a, b) => b.score - a.score);

    // Participation par enquête (bar chart)
    const participationData = pulseSurveys
      .filter(s => s.total > 0)
      .map(s => ({
        name: s.title.length > 25 ? s.title.slice(0, 22) + "…" : s.title,
        taux: Math.round((s.completed / s.total) * 100),
        completed: s.completed,
        total: s.total,
      }));

    const engColor = engagementIndex != null ? getEngagementColor(engagementIndex) : null;

    return (
    <div className="space-y-6">

      {/* Alertes RPS */}
      {rpsAlerts.length > 0 ? (
        <div className="space-y-2">
          {rpsAlerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">
                <span className="font-semibold">Attention :</span> score d&apos;engagement bas détecté sur l&apos;enquête <span className="font-semibold">{alert.title}</span> — score : <span className="font-bold">{alert.score}/10</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <Shield size={20} className="text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">Tous les indicateurs d&apos;engagement sont dans la norme</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
        {renderKPICard(
          "Index engagement",
          engagementIndex != null ? `${engagementIndex}/10` : "—",
          <Heart size={20} className="text-pink-600" />,
          "bg-pink-50",
          engColor?.label
        )}
        {renderKPICard(
          "Taux de participation",
          `${participationRate}%`,
          <Users size={20} className="text-blue-600" />,
          "bg-blue-50",
          `${totalCompleted}/${totalInvited} réponses`
        )}
        {renderKPICard(
          "Enquêtes Flash",
          pulseSurveys.length,
          <Activity size={20} className="text-purple-600" />,
          "bg-purple-50",
          `${pulseSurveys.filter(s => s.score > 0).length} avec résultats`
        )}
        {renderKPICard(
          "Alertes RPS",
          rpsAlerts.length,
          <AlertTriangle size={20} className={rpsAlerts.length > 0 ? "text-red-600" : "text-green-600"} />,
          rpsAlerts.length > 0 ? "bg-red-50" : "bg-green-50",
          rpsAlerts.length > 0 ? "Score < 5/10" : "Aucune alerte"
        )}
      </div>

      {/* Jauge engagement */}
      {engagementIndex != null && engColor && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Index d&apos;engagement global</h3>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${engColor.bg}`}
                  style={{ width: `${(engagementIndex / 10) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span>
              </div>
            </div>
            <div className="text-center min-w-[80px]">
              <p className={`text-3xl font-bold ${engColor.text}`}>{engagementIndex}</p>
              <p className={`text-xs font-medium ${engColor.text}`}>{engColor.label}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendance engagement */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tendance engagement</h3>
          </div>
          {trendData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 10]} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border rounded-lg shadow p-3 text-xs">
                      <p className="font-semibold text-gray-900 mb-1">{d.enquete}</p>
                      <p>Score : <span className="font-bold">{d.score}/10</span></p>
                    </div>
                  );
                }} />
                <Line type="monotone" dataKey="score" stroke="#ec4899" strokeWidth={2} dot={{ r: 5, fill: "#ec4899" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <TrendingUp size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Pas assez de données</p>
              <p className="text-xs mt-1">Au moins 2 enquêtes clôturées sont nécessaires</p>
            </div>
          )}
        </div>

        {/* Taux de participation par enquête */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Taux de participation par enquête</h3>
          </div>
          {participationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={participationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border rounded-lg shadow p-3 text-xs">
                      <p className="font-semibold text-gray-900 mb-1">{d.name}</p>
                      <p>Taux : <span className="font-bold">{d.taux}%</span></p>
                      <p>Réponses : <span className="font-medium">{d.completed}/{d.total}</span></p>
                    </div>
                  );
                }} />
                <Bar dataKey="taux" name="Participation" radius={[0, 4, 4, 0]}>
                  {participationData.map((entry, i) => (
                    <Cell key={i} fill={entry.taux >= 80 ? "#10b981" : entry.taux >= 50 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucune donnée de participation</p>
            </div>
          )}
        </div>
      </div>

      {/* Facteurs de satisfaction */}
      {satisfactionFactors.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Facteurs de satisfaction</h3>
            <span className="text-xs text-gray-400">Score moyen par question sur 10</span>
          </div>
          <div className="space-y-3">
            {satisfactionFactors.map((factor, i) => {
              const color = factor.score >= 8 ? "bg-green-500" : factor.score >= 6 ? "bg-lime-500" : factor.score >= 4 ? "bg-orange-500" : "bg-red-500";
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{factor.question}</p>
                    <div className="mt-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${(factor.score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-700 min-w-[45px] text-right">{factor.score}/10</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    );
  };


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
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => formatXOF(v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatXOF(v)} />
              <Tooltip formatter={(v: number, name: string) => [`${formatXOF(v)} XOF`, name]} />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="masse_salariale"
                name="Masse salariale"
                stroke="#3b82f6"
                fill="#3b82f620"
                strokeWidth={2}
              />
              <Area
                yAxisId="right"
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
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                      <p className="font-medium text-gray-900 mb-1">{label}</p>
                      <p className="text-gray-600">Effectif : {data?.nb_employes} employés</p>
                      <p className="text-gray-600">Salaire moyen : {formatXOF(data?.salaire_moyen)} XOF</p>
                    </div>
                  );
                }}
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
  // TAB 8 - IMPACT FORMATION
  // ============================================

  const renderImpactFormation = () => {
    // Calculs depuis les plans de formation
    const activePlans = trainingPlans.filter((p: any) => p.status === 'active' || p.status === 'en_cours');
    const allPlans = trainingPlans;

    // KPIs calculés
    const nbPlansActifs = activePlans.length;
    const tauxRealisationMoyen = allPlans.length > 0
      ? Math.round(allPlans.reduce((sum: number, p: any) => sum + (p.completion_rate ?? p.progress_pct ?? 0), 0) / allPlans.length)
      : 0;

    // Employés formés (depuis analytics ou somme des actions)
    const tpa = trainingPlanAnalytics;
    const nbEmployesFormes = tpa?.total_employees_trained ?? tpa?.employees_trained ?? 0;
    const budgetTotal = tpa?.total_budget ?? allPlans.reduce((s: number, p: any) => s + (p.budget_total ?? p.budget ?? 0), 0);
    const budgetConsomme = tpa?.budget_consumed ?? allPlans.reduce((s: number, p: any) => s + (p.budget_consumed ?? p.budget_used ?? 0), 0);
    const satisfactionScore = tpa?.avg_satisfaction ?? 0;

    // Formations par département
    const formationsByDept: Record<string, number> = {};
    allPlans.forEach((p: any) => {
      const dept = p.department ?? p.department_name ?? 'Non assigné';
      formationsByDept[dept] = (formationsByDept[dept] || 0) + (p.nb_employees ?? p.participants ?? 1);
    });
    const deptChartData = Object.entries(formationsByDept).map(([name, value]) => ({ name, employes: value }));
    const deptColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

    // Impact OKR
    const okrImpacts: any[] = tpa?.okr_impacts ?? [];
    // Si pas d'analytics dédié, construire depuis les plans avec okr_id
    const plansWithOkr = okrImpacts.length === 0
      ? allPlans.filter((p: any) => p.okr_id || p.objective_id).map((p: any) => ({
          title: p.okr_title ?? p.objective_title ?? `OKR #${p.okr_id ?? p.objective_id}`,
          progress_before: p.progress_before ?? 0,
          progress_current: p.progress_pct ?? p.completion_rate ?? 0,
          delta: (p.progress_pct ?? p.completion_rate ?? 0) - (p.progress_before ?? 0),
        }))
      : okrImpacts;

    // Top formations par impact
    const topFormations: any[] = tpa?.top_formations ?? allPlans
      .sort((a: any, b: any) => (b.completion_rate ?? b.progress_pct ?? 0) - (a.completion_rate ?? a.progress_pct ?? 0))
      .slice(0, 10)
      .map((p: any) => ({
        name: p.title ?? p.name ?? 'Sans titre',
        participants: p.nb_employees ?? p.participants ?? 0,
        satisfaction: p.satisfaction ?? 0,
        okr_impact: p.okr_impact ?? '—',
        delta_competences: p.delta_competences ?? '—',
      }));

    // Vue groupe — comparaison filiales
    const hasSubsidiaries = subsidiariesList.length > 0;

    return (
      <div className="space-y-6">
        
        {/* KPIs globaux */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-3">
          {renderKPICard(
            "Plans actifs",
            nbPlansActifs || "—",
            <BookOpen size={20} className="text-blue-600" />,
            "bg-blue-50",
            `${allPlans.length} plans au total`
          )}
          {renderKPICard(
            "Taux de réalisation",
            allPlans.length > 0 ? `${tauxRealisationMoyen}%` : "—",
            <Target size={20} className="text-green-600" />,
            "bg-green-50",
            "Moyenne toutes formations"
          )}
          {renderKPICard(
            "Employés formés",
            nbEmployesFormes || "—",
            <Users size={20} className="text-purple-600" />,
            "bg-purple-50",
            "Cette année"
          )}
          {renderKPICard(
            "Budget formation",
            budgetTotal > 0 ? `${formatXOF(budgetConsomme)} / ${formatXOF(budgetTotal)}` : "—",
            <Banknote size={20} className="text-amber-600" />,
            "bg-amber-50",
            budgetTotal > 0 ? `${Math.round((budgetConsomme / budgetTotal) * 100)}% consommé` : undefined
          )}
          {renderKPICard(
            "Satisfaction",
            satisfactionScore > 0 ? `${satisfactionScore} / 5` : "—",
            <Star size={20} className="text-pink-600" />,
            "bg-pink-50",
            "Score moyen des formations"
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique — Formations par département */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Employés formés par département</h3>
                          </div>
            {deptChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [v, "Employés formés"]} />
                  <Bar dataKey="employes" name="Employés formés" radius={[4, 4, 0, 0]}>
                    {deptChartData.map((_: any, i: number) => (
                      <Cell key={i} fill={deptColors[i % deptColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <Building2 size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucune donnée par département</p>
                <p className="text-xs mt-1">Créez des plans de formation pour voir la répartition</p>
              </div>
            )}
          </div>

          {/* Impact sur les OKR */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Impact sur les OKR</h3>
                          </div>
            {plansWithOkr.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {plansWithOkr.map((okr: any, i: number) => {
                  const delta = okr.delta ?? ((okr.progress_current ?? 0) - (okr.progress_before ?? 0));
                  const isPositive = delta >= 0;
                  return (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 truncate flex-1">{okr.title}</p>
                        <span className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}>
                          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {isPositive ? "+" : ""}{delta}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Avant : {okr.progress_before ?? 0}%</span>
                        <span>Actuel : {okr.progress_current ?? 0}%</span>
                      </div>
                      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(okr.progress_current ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <Target size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun OKR lié aux formations</p>
                <p className="text-xs mt-1">Associez des OKR à vos plans de formation</p>
              </div>
            )}
          </div>
        </div>

        {/* Tableau — Top formations par impact */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top formations par impact</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Formation</th>
                  <th className="pb-3 font-medium text-center">Nb participants</th>
                  <th className="pb-3 font-medium text-center">Satisfaction</th>
                  <th className="pb-3 font-medium text-center">Impact OKR</th>
                  <th className="pb-3 font-medium text-center">Δ Compétences</th>
                </tr>
              </thead>
              <tbody>
                {topFormations.length > 0 ? topFormations.map((f: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{f.name}</td>
                    <td className="py-3 text-center">{f.participants}</td>
                    <td className="py-3 text-center">
                      {f.satisfaction > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Star size={12} className="text-amber-500" />
                          {f.satisfaction}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 text-center">{f.okr_impact}</td>
                    <td className="py-3 text-center">{f.delta_competences}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      Aucune formation disponible
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vue groupe — Comparaison filiales */}
        {hasSubsidiaries && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={20} className="text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Comparaison filiales</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">Filiale</th>
                    <th className="pb-3 font-medium text-center">Plans actifs</th>
                    <th className="pb-3 font-medium text-center">Employés formés</th>
                    <th className="pb-3 font-medium text-center">Taux réalisation</th>
                    <th className="pb-3 font-medium text-right">Budget consommé</th>
                  </tr>
                </thead>
                <tbody>
                  {subsidiariesList.map((sub: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-medium text-gray-900">{sub.name ?? sub.company_name ?? `Filiale #${sub.id}`}</td>
                      <td className="py-3 text-center">{sub.active_plans ?? "—"}</td>
                      <td className="py-3 text-center">{sub.employees_trained ?? "—"}</td>
                      <td className="py-3 text-center">
                        {sub.completion_rate != null ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${Math.min(sub.completion_rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{sub.completion_rate}%</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="py-3 text-right">{sub.budget_consumed != null ? `${formatXOF(sub.budget_consumed)} XOF` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {subsidiariesList.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">Aucune filiale disponible</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };


  // ============================================
  // EXPORT EXCEL & PDF
  // ============================================

  const TAB_NAMES = ['overview', 'effectif', 'performance', 'talents', 'formation', 'engagement', 'recrutement', 'masse-salariale', 'impact-formation'];

  function getExportData(): { headers: string[]; rows: (string | number)[][] } {
    const tab = TAB_NAMES[activeTab] ?? 'overview';
    switch (tab) {
      case 'effectif':
        if (headcountByDept.length) {
          return {
            headers: Object.keys(headcountByDept[0]),
            rows: headcountByDept.map((r: any) => Object.values(r)),
          };
        }
        if (effectifsEvolution.length) {
          return {
            headers: Object.keys(effectifsEvolution[0]),
            rows: effectifsEvolution.map((r: any) => Object.values(r)),
          };
        }
        break;
      case 'performance':
        if (perfByManager.length) {
          return {
            headers: Object.keys(perfByManager[0]),
            rows: perfByManager.map((r: any) => Object.values(r)),
          };
        }
        return {
          headers: ['name', 'score', 'objectifs'],
          rows: performanceByTeam.map((r) => [r.name, r.score, r.objectifs]),
        };
      case 'talents':
        if (nineboxData.length) {
          return {
            headers: Object.keys(nineboxData[0]),
            rows: nineboxData.map((r: any) => Object.values(r)),
          };
        }
        return {
          headers: ['nom', 'poste', 'risque', 'raison', 'departement'],
          rows: talentRisks.map((r) => [r.nom, r.poste, r.risque, r.raison, r.departement]),
        };
      case 'formation':
        if (formationByCategory.length) {
          return {
            headers: Object.keys(formationByCategory[0]),
            rows: formationByCategory.map((r: any) => Object.values(r)),
          };
        }
        return {
          headers: ['name', 'prevu', 'realise'],
          rows: formationExecution.map((r) => [r.name, r.prevu, r.realise]),
        };
      case 'recrutement':
        if (recrutementData?.pipeline?.length) {
          return {
            headers: Object.keys(recrutementData.pipeline[0]),
            rows: recrutementData.pipeline.map((r: any) => Object.values(r)),
          };
        }
        return {
          headers: ['name', 'candidatures', 'entretiens', 'embauches'],
          rows: recrutementMetrics.map((r) => [r.name, r.candidatures, r.entretiens, r.embauches]),
        };
      case 'masse-salariale':
        if (salaireByDept.length) {
          return {
            headers: Object.keys(salaireByDept[0]),
            rows: salaireByDept.map((r: any) => Object.values(r)),
          };
        }
        if (salaireEvolution.length) {
          return {
            headers: Object.keys(salaireEvolution[0]),
            rows: salaireEvolution.map((r: any) => Object.values(r)),
          };
        }
        break;
      case 'impact-formation':
        if (trainingPlans.length) {
          return {
            headers: Object.keys(trainingPlans[0]),
            rows: trainingPlans.map((r: any) => Object.values(r)),
          };
        }
        break;
      default:
        // overview
        if (overview) {
          return {
            headers: Object.keys(overview),
            rows: [Object.values(overview)],
          };
        }
        break;
    }
    return { headers: [], rows: [] };
  }

  function handleExportExcel() {
    const tabName = TAB_NAMES[activeTab] ?? 'overview';
    const date = new Date().toISOString().slice(0, 10);

    // Special multi-sheet export for engagement tab
    if (tabName === 'engagement') {
      const { surveys, index: engIndex } = engagementData;
      if (!surveys.length) return;

      const wb = XLSX.utils.book_new();

      // Sheet 1: Index Engagement
      const indexRows: (string | number)[][] = [
        ["Index engagement global", engIndex ?? "—"],
        ["Nombre d'Enquêtes Flash", surveys.length],
        ["Enquêtes avec résultats", surveys.filter(s => s.score > 0).length],
        [],
        ["Enquête", "Score /10", "Date", "Réponses complétées", "Total invités", "Taux participation (%)"],
        ...surveys.map(s => [
          s.title,
          s.score,
          s.date ? new Date(s.date).toLocaleDateString("fr-FR") : "—",
          s.completed,
          s.total,
          s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(indexRows), "Index Engagement");

      // Sheet 2: Participation
      const partRows: (string | number)[][] = [
        ["Enquête", "Réponses complétées", "Total invités", "Taux participation (%)"],
        ...surveys.filter(s => s.total > 0).map(s => [
          s.title,
          s.completed,
          s.total,
          Math.round((s.completed / s.total) * 100),
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(partRows), "Participation");

      // Sheet 3: Facteurs de satisfaction
      const questionMap = new Map<string, { total: number; count: number }>();
      surveys.forEach(s => {
        s.questions.forEach((q: any) => {
          const existing = questionMap.get(q.question_text) || { total: 0, count: 0 };
          existing.total += q.average ?? 0;
          existing.count += 1;
          questionMap.set(q.question_text, existing);
        });
      });
      const factors = Array.from(questionMap.entries())
        .map(([text, { total, count }]) => [text, Math.round((total / count) * 100) / 100] as [string, number])
        .sort((a, b) => b[1] - a[1]);
      const factorRows: (string | number)[][] = [
        ["Question", "Score moyen /10"],
        ...factors,
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(factorRows), "Facteurs");

      XLSX.writeFile(wb, `engagement-${date}.xlsx`);
      return;
    }

    const filename = `people-analytics-${tabName}-${date}.xlsx`;

    const { headers, rows } = getExportData();
    if (!headers.length) return;

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tabName);
    XLSX.writeFile(wb, filename);
  }

  function handleExportPDF() {
    window.print();
  }

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
    renderImpactFormation,
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Print CSS */}
      <style>{`
        @media print {
          nav, aside, .sidebar, .no-print, [data-tour] > div { display: none !important; }
          .print-content { width: 100% !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {showTips && (
        <PageTourTips
          tips={analyticsTips}
          onDismiss={dismissTips}
          pageTitle="People Analytics"
        />
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{(SECTION_HEADERS[currentSection] ?? SECTION_HEADERS['overview']).title}</h1>
          <p className="text-gray-500 text-sm mt-1">{(SECTION_HEADERS[currentSection] ?? SECTION_HEADERS['overview']).subtitle}</p>
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
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <FileSpreadsheet size={14} />
              Excel
            </button>
            <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <FileText size={14} />
              PDF
            </button>
          </div>
        </div>
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
