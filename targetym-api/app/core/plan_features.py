"""
Plan & Feature gating system.

Defines which features are available on each plan, plan hierarchy,
employee limits per plan, and helper functions.

Plans (with legacy aliases):
  - trial       → accès Premium complet (50 employés), validé manuellement
  - starter     → alias for basique
  - basique     → level 1
  - professional→ alias for premium
  - premium     → level 2
  - enterprise  → alias for entreprise
  - entreprise  → level 3
"""

from typing import Dict, Set, Optional

# ============================================
# FEATURE CONSTANTS
# ============================================

# --- Basique (starter / trial) ---
FEATURE_RECRUITMENT = "recruitment"
FEATURE_ONBOARDING = "onboarding"
FEATURE_PERSONNEL = "personnel"
FEATURE_LEAVES = "leaves"
FEATURE_MISSIONS = "missions"
FEATURE_SANCTIONS = "sanctions"
FEATURE_CHATBOT_CONVERSATIONAL = "chatbot_conversational"

# --- Premium (professional) ---
FEATURE_LEARNING = "learning"
FEATURE_CAREERS = "careers"
FEATURE_OKR = "okr"
FEATURE_PERFORMANCE = "performance"
FEATURE_ANALYTICS = "analytics"
FEATURE_DOCUMENTS = "documents"
FEATURE_TASKS = "tasks"
FEATURE_CERTIFICATES = "certificates"
FEATURE_DEPARTURES = "departures"
FEATURE_CHATBOT_AGENT = "chatbot_agent"

# --- Entreprise (enterprise) ---
FEATURE_SUPPORT_H24 = "support_h24"
FEATURE_ATS = "ats"
FEATURE_PAYROLL_ADDON = "payroll_addon"
FEATURE_CHATBOT_ADVANCED = "chatbot_advanced"
FEATURE_CERTIFICATIONS_RH = "certifications_rh"
FEATURE_DATA_INSIGHTS = "data_insights"
FEATURE_GROUP_MODE = "group_mode"

# ============================================
# PLAN HIERARCHY  (canonical names)
# ============================================

PLAN_LEVEL: Dict[str, int] = {
    "trial": 2,       # trial = accès Premium complet
    "basique": 1,
    "starter": 1,
    "premium": 2,
    "professional": 2,
    "entreprise": 3,
    "enterprise": 3,
}

# Canonical name → user-facing label
PLAN_LABELS: Dict[str, str] = {
    "trial": "Essai",
    "basique": "Basique",
    "starter": "Basique",
    "premium": "Premium",
    "professional": "Premium",
    "entreprise": "Entreprise",
    "enterprise": "Entreprise",
}

# ============================================
# FEATURES PER PLAN (cumulative)
# ============================================

_BASIQUE_FEATURES: Set[str] = {
    FEATURE_RECRUITMENT,
    FEATURE_ONBOARDING,
    FEATURE_PERSONNEL,
    FEATURE_LEAVES,
    FEATURE_MISSIONS,
    FEATURE_SANCTIONS,
    FEATURE_CHATBOT_CONVERSATIONAL,
}

_PREMIUM_FEATURES: Set[str] = _BASIQUE_FEATURES | {
    FEATURE_LEARNING,
    FEATURE_CAREERS,
    FEATURE_OKR,
    FEATURE_PERFORMANCE,
    FEATURE_ANALYTICS,
    FEATURE_DOCUMENTS,
    FEATURE_TASKS,
    FEATURE_CERTIFICATES,
    FEATURE_DEPARTURES,
    FEATURE_CHATBOT_AGENT,
}

_ENTREPRISE_FEATURES: Set[str] = _PREMIUM_FEATURES | {
    FEATURE_SUPPORT_H24,
    FEATURE_ATS,
    FEATURE_PAYROLL_ADDON,
    FEATURE_CHATBOT_ADVANCED,
    FEATURE_CERTIFICATIONS_RH,
    FEATURE_DATA_INSIGHTS,
    FEATURE_GROUP_MODE,
}

PLAN_FEATURES: Dict[str, Set[str]] = {
    "trial": _PREMIUM_FEATURES,   # trial = accès Premium complet
    "basique": _BASIQUE_FEATURES,
    "starter": _BASIQUE_FEATURES,
    "premium": _PREMIUM_FEATURES,
    "professional": _PREMIUM_FEATURES,
    "entreprise": _ENTREPRISE_FEATURES,
    "enterprise": _ENTREPRISE_FEATURES,
}

# ============================================
# FEATURE → MINIMUM PLAN (canonical)
# ============================================

FEATURE_MIN_PLAN: Dict[str, str] = {}
for _feat in _BASIQUE_FEATURES:
    FEATURE_MIN_PLAN[_feat] = "basique"
for _feat in _PREMIUM_FEATURES - _BASIQUE_FEATURES:
    FEATURE_MIN_PLAN[_feat] = "premium"
for _feat in _ENTREPRISE_FEATURES - _PREMIUM_FEATURES:
    FEATURE_MIN_PLAN[_feat] = "entreprise"

# ============================================
# EMPLOYEE LIMITS PER PLAN
# ============================================

PLAN_EMPLOYEE_LIMITS: Dict[str, int] = {
    "trial": 50,      # trial = 50 employés (accès Premium)
    "basique": 25,
    "starter": 25,
    "premium": 50,
    "professional": 50,
    "entreprise": 100,
    "enterprise": 100,
}

# Cost per extra employee (FCFA / month)
PLAN_EXTRA_EMPLOYEE_COST: Dict[str, int] = {
    "trial": 0,           # no extra allowed
    "basique": 12_500,
    "starter": 12_500,
    "premium": 12_500,
    "professional": 12_500,
    "entreprise": 5_000,
    "enterprise": 5_000,
}

# ============================================
# HELPERS
# ============================================

def normalize_plan(plan: Optional[str]) -> str:
    """Return a known plan name (defaults to 'trial')."""
    if not plan:
        return "trial"
    p = plan.lower().strip()
    if p in PLAN_LEVEL:
        return p
    return "trial"


def get_plan_level(plan: str) -> int:
    return PLAN_LEVEL.get(normalize_plan(plan), 1)


def has_feature(plan: str, feature: str) -> bool:
    """Check if *plan* includes *feature*."""
    p = normalize_plan(plan)
    features = PLAN_FEATURES.get(p, _BASIQUE_FEATURES)
    return feature in features


def get_required_plan(feature: str) -> str:
    """Return the minimum plan label required for *feature*."""
    canon = FEATURE_MIN_PLAN.get(feature, "basique")
    return PLAN_LABELS.get(canon, "Basique")


def get_employee_limit(plan: str) -> int:
    """Return the included employee count for this plan."""
    p = normalize_plan(plan)
    return PLAN_EMPLOYEE_LIMITS.get(p, 10)
