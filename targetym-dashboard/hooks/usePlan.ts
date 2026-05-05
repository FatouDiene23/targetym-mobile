'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

// ============================================
// PLAN CONSTANTS (mirror of backend plan_features.py)
// ============================================

export const FEATURE_RECRUITMENT = 'recruitment';
export const FEATURE_ONBOARDING = 'onboarding';
export const FEATURE_PERSONNEL = 'personnel';
export const FEATURE_LEAVES = 'leaves';
export const FEATURE_MISSIONS = 'missions';
export const FEATURE_SANCTIONS = 'sanctions';
export const FEATURE_CHATBOT_CONVERSATIONAL = 'chatbot_conversational';

export const FEATURE_LEARNING = 'learning';
export const FEATURE_CAREERS = 'careers';
export const FEATURE_OKR = 'okr';
export const FEATURE_PERFORMANCE = 'performance';
export const FEATURE_ANALYTICS = 'analytics';
export const FEATURE_DOCUMENTS = 'documents';
export const FEATURE_TASKS = 'tasks';
export const FEATURE_CERTIFICATES = 'certificates';
export const FEATURE_DEPARTURES = 'departures';
export const FEATURE_CHATBOT_AGENT = 'chatbot_agent';

export const FEATURE_SUPPORT_H24 = 'support_h24';
export const FEATURE_ATS = 'ats';
export const FEATURE_PAYROLL_ADDON = 'payroll_addon';
export const FEATURE_CHATBOT_ADVANCED = 'chatbot_advanced';
export const FEATURE_CERTIFICATIONS_RH = 'certifications_rh';
export const FEATURE_DATA_INSIGHTS = 'data_insights';
export const FEATURE_GROUP_MODE = 'group_mode';
export const FEATURE_AI_CV_SCORING = 'ai_cv_scoring';  // Scoring IA CVs — Entreprise ou add-on

// Plan level hierarchy
export const PLAN_LEVEL: Record<string, number> = {
  trial: 3, basique: 1, starter: 1,  // trial = accès Entreprise complet
  premium: 2, professional: 2,
  entreprise: 3, enterprise: 3,
};

export const PLAN_LABELS: Record<string, string> = {
  trial: 'Essai', basique: 'Basique', starter: 'Basique',
  premium: 'Premium', professional: 'Professionnel',
  entreprise: 'Entreprise', enterprise: 'Entreprise',
};

// Basique features
const BASIQUE_FEATURES = new Set([
  FEATURE_RECRUITMENT, FEATURE_ONBOARDING, FEATURE_PERSONNEL,
  FEATURE_LEAVES, FEATURE_MISSIONS, FEATURE_SANCTIONS,
  FEATURE_CHATBOT_CONVERSATIONAL,
]);

// Premium features (basique + ...)
const PREMIUM_FEATURES = new Set([
  ...BASIQUE_FEATURES,
  FEATURE_LEARNING, FEATURE_CAREERS, FEATURE_OKR, FEATURE_PERFORMANCE,
  FEATURE_ANALYTICS, FEATURE_DOCUMENTS, FEATURE_TASKS,
  FEATURE_CERTIFICATES, FEATURE_DEPARTURES, FEATURE_CHATBOT_AGENT,
]);

// Entreprise features (premium + ...)
const ENTREPRISE_FEATURES = new Set([
  ...PREMIUM_FEATURES,
  FEATURE_SUPPORT_H24, FEATURE_ATS, FEATURE_PAYROLL_ADDON,
  FEATURE_CHATBOT_ADVANCED, FEATURE_CERTIFICATIONS_RH,
  FEATURE_DATA_INSIGHTS, FEATURE_GROUP_MODE, FEATURE_AI_CV_SCORING,
]);

const PLAN_FEATURES: Record<string, Set<string>> = {
  trial: ENTREPRISE_FEATURES, basique: BASIQUE_FEATURES, starter: BASIQUE_FEATURES,  // trial = accès Entreprise
  premium: PREMIUM_FEATURES, professional: PREMIUM_FEATURES,
  entreprise: ENTREPRISE_FEATURES, enterprise: ENTREPRISE_FEATURES,
};

// Feature → minimum plan label
const FEATURE_MIN_PLAN: Record<string, string> = {};
BASIQUE_FEATURES.forEach(f => { FEATURE_MIN_PLAN[f] = 'basique'; });
PREMIUM_FEATURES.forEach(f => { if (!FEATURE_MIN_PLAN[f]) FEATURE_MIN_PLAN[f] = 'premium'; });
ENTREPRISE_FEATURES.forEach(f => { if (!FEATURE_MIN_PLAN[f]) FEATURE_MIN_PLAN[f] = 'entreprise'; });

// Employee limits per plan
const PLAN_EMPLOYEE_LIMITS: Record<string, number> = {
  trial: 100, basique: 25, starter: 25,  // trial = 100 employés
  premium: 50, professional: 50,
  entreprise: 100, enterprise: 100,
};

// Plan pricing (FCFA / month)
export const PLAN_PRICING: Record<string, { price: number; label: string; employees: string }> = {
  basique: { price: 297_000, label: '297 000 FCFA/mois', employees: 'Jusqu\'à 25 employés inclus' },
  premium: { price: 597_000, label: '597 000 FCFA/mois', employees: 'Jusqu\'à 50 employés inclus' },
  entreprise: { price: 1_000_000, label: '12 000 000 FCFA/an', employees: 'Jusqu\'à 100 employés inclus' },
};

// ============================================
// HELPERS (usable without hook)
// ============================================

export function normalizePlan(plan?: string | null): string {
  if (!plan) return 'trial';
  const p = plan.toLowerCase().trim();
  return p in PLAN_LEVEL ? p : 'trial';
}

export function hasFeatureStatic(plan: string, feature: string): boolean {
  const p = normalizePlan(plan);
  return PLAN_FEATURES[p]?.has(feature) ?? false;
}

export function getRequiredPlanLabel(feature: string): string {
  const canon = FEATURE_MIN_PLAN[feature] || 'basique';
  return PLAN_LABELS[canon] || 'Basique';
}

// ============================================
// TENANT SETTINGS TYPE
// ============================================

export interface TenantPlanInfo {
  plan: string;
  plan_normalized: string;
  plan_label: string;
  plan_level: number;
  plan_features: string[];
  is_trial: boolean;
  trial_ends_at: string | null;
  max_employees: number;
  employee_limit_default: number;
}

// ============================================
// HOOK
// ============================================

export interface UsePlanReturn {
  /** Raw plan string from tenant */
  plan: string;
  /** Normalized plan name */
  planNormalized: string;
  /** User-facing label */
  planLabel: string;
  /** Numeric level (1=basique, 2=premium, 3=entreprise) */
  planLevel: number;
  /** Set of feature keys available */
  features: Set<string>;
  /** Is the tenant on trial? */
  isTrial: boolean;
  /** Max employees allowed */
  employeeLimit: number;
  /** Loading state */
  loading: boolean;

  /** Check if current plan has a feature */
  hasFeature: (feature: string) => boolean;
  /** Get the required plan label for a feature */
  getRequiredPlanLabel: (feature: string) => string;
  /** Check if employee can be added */
  canAddEmployee: (currentCount: number) => boolean;
}

export function usePlan(): UsePlanReturn {
  const [tenantInfo, setTenantInfo] = useState<TenantPlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchTenantSettings() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (!token) { setLoading(false); return; }

        const res = await fetch(`${API_URL}/api/auth/tenant-settings`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok && !cancelled) {
          const data = await res.json();
          setTenantInfo(data);
        }
      } catch {
        // Silently fail — plan defaults to trial
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTenantSettings();
    return () => { cancelled = true; };
  }, []);

  const plan = tenantInfo?.plan || 'trial';
  const planNormalized = normalizePlan(plan);
  const planLabel = PLAN_LABELS[planNormalized] || plan;
  const planLevel = PLAN_LEVEL[planNormalized] || 1;
  const features = PLAN_FEATURES[planNormalized] || BASIQUE_FEATURES;
  const isTrial = tenantInfo?.is_trial ?? true;
  const employeeLimit = tenantInfo?.max_employees || PLAN_EMPLOYEE_LIMITS[planNormalized] || 10;

  const hasFeature = useCallback(
    (feature: string) => features.has(feature),
    [features]
  );

  const getRequiredPlanLabelFn = useCallback(
    (feature: string) => getRequiredPlanLabel(feature),
    []
  );

  const canAddEmployee = useCallback(
    (currentCount: number) => currentCount < employeeLimit,
    [employeeLimit]
  );

  return {
    plan,
    planNormalized,
    planLabel,
    planLevel,
    features,
    isTrial,
    employeeLimit,
    loading,
    hasFeature,
    getRequiredPlanLabel: getRequiredPlanLabelFn,
    canAddEmployee,
  };
}
