'use client';

import { ReactNode, useState } from 'react';
import { Lock, Crown, ArrowUpRight, X } from 'lucide-react';
import {
  hasFeatureStatic,
  getRequiredPlanLabel,
  normalizePlan,
  PLAN_LABELS,
  PLAN_PRICING,
} from '@/hooks/usePlan';

// ============================================
// PLAN BADGE (for sidebar items)
// ============================================

interface PlanBadgeProps {
  requiredPlan: string; // 'premium' | 'entreprise'
  size?: 'sm' | 'xs';
}

export function PlanBadge({ requiredPlan, size = 'xs' }: PlanBadgeProps) {
  const label = PLAN_LABELS[requiredPlan] || requiredPlan;
  const colors =
    requiredPlan === 'entreprise' || requiredPlan === 'enterprise'
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-purple-500/20 text-purple-400 border-purple-500/30';

  return (
    <span
      className={`inline-flex items-center border rounded-full font-medium whitespace-nowrap ${colors} ${
        size === 'xs' ? 'px-1.5 py-0 text-[10px] leading-4' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <Crown className={size === 'xs' ? 'w-2.5 h-2.5 mr-0.5' : 'w-3 h-3 mr-1'} />
      {label}
    </span>
  );
}

// ============================================
// UPGRADE MODAL
// ============================================

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
  currentPlan?: string;
}

export function UpgradeModal({ open, onClose, feature, currentPlan }: UpgradeModalProps) {
  if (!open) return null;

  const current = normalizePlan(currentPlan);
  const requiredLabel = feature ? getRequiredPlanLabel(feature) : 'Premium';

  const plans = [
    {
      key: 'basique',
      label: 'Basique',
      price: 'Gratuit',
      features: [
        'Recrutement',
        'Onboarding',
        'Gestion du Personnel',
        'Congés & Missions',
        'Sanctions',
        'Chatbot conversationnel',
        '25 employés inclus',
      ],
    },
    {
      key: 'premium',
      label: 'Premium',
      price: '150 000 FCFA/mois',
      popular: true,
      features: [
        'Tout le plan Basique',
        'Formation & Développement',
        'Talents & Carrière',
        'OKR & Objectifs',
        'Performance & Feedback',
        'People Analytics',
        'Documents & Certificats',
        'Tâches & Départs',
        'Chatbot agent IA',
        '50 employés inclus',
      ],
    },
    {
      key: 'entreprise',
      label: 'Entreprise',
      price: '350 000 FCFA/mois',
      features: [
        'Tout le plan Premium',
        'Support H24',
        'ATS avancé',
        'Module Payroll',
        'Chatbot avancé',
        'Certifications RH',
        'Data Insights',
        'Mode Groupe (filiales)',
        '100 employés inclus',
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Passez au plan supérieur
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {feature
                ? `La fonctionnalité requiert le plan ${requiredLabel}.`
                : 'Débloquez toutes les fonctionnalités de Targetym AI.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Plans grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = current === plan.key || (current === 'trial' && plan.key === 'basique');
            const isRequired = feature
              ? plan.label === requiredLabel
              : false;

            return (
              <div
                key={plan.key}
                className={`relative rounded-xl border-2 p-5 transition-all ${
                  isRequired
                    ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-lg'
                    : isCurrent
                    ? 'border-green-500 bg-green-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Populaire
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{plan.label}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {plan.price}
                  </p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start text-sm text-gray-600">
                      <span className="text-green-500 mr-2 mt-0.5">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 text-center text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                    Plan actuel
                  </div>
                ) : (
                  <a
                    href="mailto:contact@targetym.com?subject=Upgrade%20plan"
                    className="w-full flex items-center justify-center py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                  >
                    Contacter les ventes
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Extra employee pricing note */}
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-400 text-center">
            Employé supplémentaire : 12 500 FCFA/mois (Basique &amp; Premium) — 5 000 FCFA/mois (Entreprise).
            Contactez-nous pour un devis personnalisé.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PLAN GATE — wraps content with plan check
// ============================================

type PlanGateMode = 'block' | 'badge' | 'hide';

interface PlanGateProps {
  /** Feature key to check */
  feature: string;
  /** Current tenant plan (from usePlan hook) */
  plan: string;
  /** block = overlay + modal, badge = show with badge, hide = render nothing */
  mode?: PlanGateMode;
  children: ReactNode;
  /** Optional fallback when hidden */
  fallback?: ReactNode;
}

export function PlanGate({
  feature,
  plan,
  mode = 'block',
  children,
  fallback,
}: PlanGateProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const allowed = hasFeatureStatic(plan, feature);

  if (allowed) return <>{children}</>;

  if (mode === 'hide') return <>{fallback || null}</>;

  if (mode === 'badge') {
    const minPlan = getRequiredPlanLabel(feature);
    return (
      <div className="relative">
        {children}
        <div className="absolute top-1 right-1">
          <PlanBadge requiredPlan={minPlan === 'Entreprise' ? 'entreprise' : 'premium'} />
        </div>
      </div>
    );
  }

  // mode === 'block'
  return (
    <>
      <div
        className="relative cursor-pointer"
        onClick={() => setShowUpgrade(true)}
      >
        <div className="pointer-events-none opacity-40 blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-xl">
          <Lock className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-600">
            Nécessite le plan {getRequiredPlanLabel(feature)}
          </p>
          <button className="mt-2 px-4 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">
            Voir les plans
          </button>
        </div>
      </div>
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={feature}
        currentPlan={plan}
      />
    </>
  );
}

// ============================================
// EMPLOYEE LIMIT BANNER
// ============================================

interface EmployeeLimitBannerProps {
  currentCount: number;
  maxEmployees: number;
  plan: string;
}

export function EmployeeLimitBanner({ currentCount, maxEmployees, plan }: EmployeeLimitBannerProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const remaining = maxEmployees - currentCount;
  const isFull = remaining <= 0;

  if (!isFull) return null;

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Lock className="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Limite de {maxEmployees} employés atteinte
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Votre plan {PLAN_LABELS[normalizePlan(plan)] || plan} inclut {maxEmployees} employés.
              Passez au plan supérieur pour en ajouter davantage.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowUpgrade(true)}
          className="ml-4 px-4 py-2 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors whitespace-nowrap"
        >
          Voir les plans
        </button>
      </div>
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        currentPlan={plan}
      />
    </>
  );
}
