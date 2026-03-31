"""
FastAPI dependencies for plan-based access control.

Usage:
    # Protect a whole router
    router = APIRouter(dependencies=[Depends(require_feature(FEATURE_OKR))])

    # Protect a single endpoint
    @router.post("/", dependencies=[Depends(require_feature(FEATURE_ANALYTICS))])

    # Block employee creation when limit reached
    @router.post("/", dependencies=[Depends(require_employee_slot)])
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.plan_features import (
    has_feature,
    normalize_plan,
    get_required_plan,
    get_employee_limit,
    PLAN_LABELS,
    FEATURE_MIN_PLAN,
)
from app.api.deps import get_current_tenant
from app.models.tenant import Tenant
from app.models.employee import Employee


def require_feature(feature: str):
    """
    Factory that returns a FastAPI dependency which verifies
    the current tenant's plan includes *feature*.

    Raises HTTP 403 with structured body on failure.
    """

    def _guard(tenant: Tenant = Depends(get_current_tenant)):
        plan = normalize_plan(tenant.plan)
        if not has_feature(plan, feature):
            required = FEATURE_MIN_PLAN.get(feature, "premium")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PLAN_RESTRICTION",
                    "current_plan": plan,
                    "current_plan_label": PLAN_LABELS.get(plan, plan),
                    "required_plan": required,
                    "required_plan_label": PLAN_LABELS.get(required, required),
                    "feature": feature,
                    "message": (
                        f"La fonctionnalité « {feature} » nécessite le plan "
                        f"{PLAN_LABELS.get(required, required)}. "
                        f"Votre plan actuel est {PLAN_LABELS.get(plan, plan)}."
                    ),
                },
            )

    return _guard


def require_employee_slot(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """
    Dependency that verifies the tenant has not reached its employee limit.
    Uses tenant.max_employees (set by super-admin or plan default).

    Raises HTTP 403 with structured body when full.
    """
    plan = normalize_plan(tenant.plan)
    max_emp = tenant.max_employees or get_employee_limit(plan)

    current_count = (
        db.query(func.count(Employee.id))
        .filter(
            Employee.tenant_id == tenant.id,
            Employee.status != "terminated",
        )
        .scalar()
    )

    if current_count >= max_emp:
        # Suggest the next plan up
        from app.core.plan_features import PLAN_LEVEL, PLAN_EMPLOYEE_LIMITS

        current_level = PLAN_LEVEL.get(plan, 1)
        next_plan = None
        for p, lvl in sorted(PLAN_LEVEL.items(), key=lambda x: x[1]):
            if lvl > current_level:
                next_plan = p
                break

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "EMPLOYEE_LIMIT_REACHED",
                "current": current_count,
                "max": max_emp,
                "plan": plan,
                "plan_label": PLAN_LABELS.get(plan, plan),
                "next_plan": next_plan,
                "next_plan_label": PLAN_LABELS.get(next_plan, "") if next_plan else None,
                "next_plan_limit": PLAN_EMPLOYEE_LIMITS.get(next_plan, 0) if next_plan else None,
                "message": (
                    f"Limite de {max_emp} employés atteinte pour le plan "
                    f"{PLAN_LABELS.get(plan, plan)}. "
                    + (
                        f"Passez au plan {PLAN_LABELS.get(next_plan, '')} "
                        f"pour {PLAN_EMPLOYEE_LIMITS.get(next_plan, 0)} employés inclus."
                        if next_plan
                        else "Contactez le support pour augmenter votre limite."
                    )
                ),
            },
        )
