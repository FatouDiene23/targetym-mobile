# app/api/training_plans.py
"""
Endpoints API pour le sous-module Plan de Formation
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user, require_rh
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.training_plans import TrainingPlan, PlanLevel, PlanStatus, TrainingPlanObjective, ObjectiveType, TrainingPlanTarget
from app.models.training_needs import TrainingNeed, NeedPriority, NeedStatus
from app.models.training_plan_actions import TrainingPlanAction, TargetType, Modality, BillingMode
from app.models.training_schedule import TrainingSchedule, Quarter, ScheduleStatus
from app.models.training_assignments import TrainingAssignment
from app.models.learning import Course
from app.models.training_provider import TrainingProvider
from app.models.training_plan_subsidiaries import TrainingPlanSubsidiary
from app.models.tenant import Tenant
from app.models.okr import Objective
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_LEARNING
from app.schemas.training_plans import (
    TrainingPlanCreate, TrainingPlanUpdate,
    TrainingNeedCreate,
    TrainingPlanActionCreate, TrainingPlanActionUpdate,
    TrainingScheduleCreate, TrainingScheduleUpdate,
    TrainingPlanObjectiveCreate, TrainingPlanObjectiveUpdate,
    TrainingPlanTargetCreate,
)

router = APIRouter(
    prefix="/api/training-plans",
    tags=["Plan de Formation"],
    dependencies=[Depends(require_feature(FEATURE_LEARNING))]
)


# ============================================
# HELPERS
# ============================================

def _to_enum(enum_class, value):
    """Convertit une string ou un enum Pydantic en instance SQLAlchemy enum.

    Accepte : 'draft', 'DRAFT', PydanticEnum.draft → PlanStatus.DRAFT
    """
    if value is None:
        return None
    raw = value.value if hasattr(value, 'value') else str(value)
    raw_lower = raw.lower()
    for member in enum_class:
        if member.value == raw_lower or member.name.lower() == raw_lower:
            return member
    return raw_lower  # fallback — laisse SQLAlchemy gérer l'erreur


def _get_user_role(current_user: User) -> str:
    """Retourne le rôle en lowercase string."""
    return str(current_user.role.value).lower() if current_user.role else "employee"


def _is_admin_or_rh(current_user: User) -> bool:
    role = _get_user_role(current_user)
    return role in ("admin", "super_admin", "rh", "dg", "dga")


def _get_plan_or_404(plan_id: int, tenant_id: int, db: Session) -> TrainingPlan:
    """Récupère un plan par id + tenant, 404 sinon."""
    plan = db.query(TrainingPlan).filter(
        TrainingPlan.id == plan_id,
        TrainingPlan.tenant_id == tenant_id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de formation non trouvé")
    return plan


def _serialize_plan(plan: TrainingPlan) -> dict:
    return {
        "id": plan.id,
        "tenant_id": plan.tenant_id,
        "parent_plan_id": plan.parent_plan_id,
        "title": plan.title,
        "description": plan.description,
        "year": plan.year,
        "start_date": plan.start_date.isoformat() if plan.start_date else None,
        "end_date": plan.end_date.isoformat() if plan.end_date else None,
        "plan_level": plan.plan_level.value if plan.plan_level else None,
        "status": plan.status.value if plan.status else None,
        "budget_ceiling": float(plan.budget_ceiling) if plan.budget_ceiling else None,
        "currency": plan.currency,
        "created_by_id": plan.created_by_id,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
    }


def _serialize_action(action: TrainingPlanAction, db: Session) -> dict:
    course_title = None
    if action.course_id:
        course = db.query(Course).filter(Course.id == action.course_id).first()
        if course:
            course_title = course.title

    provider_name = None
    if action.provider_id:
        provider = db.query(TrainingProvider).filter(TrainingProvider.id == action.provider_id).first()
        if provider:
            provider_name = provider.name

    return {
        "id": action.id,
        "tenant_id": action.tenant_id,
        "plan_id": action.plan_id,
        "course_id": action.course_id,
        "title": action.title or course_title,
        "target_type": action.target_type.value if action.target_type else None,
        "target_id": action.target_id,
        "is_mandatory": action.is_mandatory,
        "modality": action.modality.value if action.modality else None,
        "provider_id": action.provider_id,
        "unit_cost": float(action.unit_cost) if action.unit_cost else None,
        "billing_mode": action.billing_mode.value if action.billing_mode else None,
        "max_participants": action.max_participants,
        "objective_id": action.objective_id,
        "course_title": course_title,
        "provider_name": provider_name,
        "created_at": action.created_at.isoformat() if action.created_at else None,
        "updated_at": action.updated_at.isoformat() if action.updated_at else None,
    }


def _serialize_schedule(schedule: TrainingSchedule, db: Session) -> dict:
    action_title = None
    action = db.query(TrainingPlanAction).filter(
        TrainingPlanAction.id == schedule.action_id
    ).first()
    if action:
        if action.title:
            action_title = action.title
        elif action.course_id:
            course = db.query(Course).filter(Course.id == action.course_id).first()
            if course:
                action_title = course.title

    trainer_name = None
    if schedule.trainer_id:
        trainer = db.query(Employee).filter(Employee.id == schedule.trainer_id).first()
        if trainer:
            trainer_name = f"{trainer.first_name} {trainer.last_name}"

    enrolled_count = db.query(func.count(TrainingAssignment.id)).filter(
        TrainingAssignment.schedule_id == schedule.id
    ).scalar() or 0

    return {
        "id": schedule.id,
        "tenant_id": schedule.tenant_id,
        "plan_id": schedule.plan_id,
        "action_id": schedule.action_id,
        "start_date": schedule.start_date.isoformat() if schedule.start_date else None,
        "end_date": schedule.end_date.isoformat() if schedule.end_date else None,
        "quarter": schedule.quarter.value if schedule.quarter else None,
        "status": schedule.status.value if schedule.status else None,
        "location": schedule.location,
        "trainer_id": schedule.trainer_id,
        "external_trainer": schedule.external_trainer,
        "max_participants": schedule.max_participants,
        "action_title": action_title,
        "trainer_name": trainer_name,
        "enrolled_count": enrolled_count,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
    }


def _serialize_need(need: TrainingNeed, db: Session) -> dict:
    employee_name = None
    if need.employee_id:
        emp = db.query(Employee).filter(Employee.id == need.employee_id).first()
        if emp:
            employee_name = f"{emp.first_name} {emp.last_name}"

    return {
        "id": need.id,
        "tenant_id": need.tenant_id,
        "plan_id": need.plan_id,
        "employee_id": need.employee_id,
        "employee_name": employee_name,
        "source": need.source,
        "skill_target": need.skill_target,
        "priority": need.priority.value if need.priority else None,
        "year": need.year,
        "status": need.status.value if need.status else None,
        "created_at": need.created_at.isoformat() if need.created_at else None,
        "updated_at": need.updated_at.isoformat() if need.updated_at else None,
    }


# ============================================
# TENANT INFO (pour le frontend)
# ============================================

@router.get("/tenant-info")
async def get_tenant_group_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Infos groupe/filiale du tenant courant pour adapter l'UI."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    subsidiaries = []
    if tenant.is_group:
        subs = db.query(Tenant).filter(Tenant.parent_tenant_id == tenant.id).all()
        subsidiaries = [{"id": s.id, "name": s.name} for s in subs]

    return {
        "is_group": tenant.is_group,
        "group_type": tenant.group_type.value if tenant.group_type else "standalone",
        "parent_tenant_id": tenant.parent_tenant_id,
        "subsidiaries": subsidiaries,
    }


# ============================================
# PLANS — CRUD
# ============================================

@router.get("/")
async def list_training_plans(
    year: Optional[int] = None,
    status: Optional[str] = None,
    plan_level: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des plans de formation du tenant."""
    query = db.query(TrainingPlan).filter(
        TrainingPlan.tenant_id == current_user.tenant_id
    )

    if year is not None:
        query = query.filter(TrainingPlan.year == year)
    if status:
        query = query.filter(TrainingPlan.status == status)
    if plan_level:
        query = query.filter(TrainingPlan.plan_level == plan_level)

    total = query.count()
    plans = (
        query
        .order_by(TrainingPlan.year.desc(), TrainingPlan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_serialize_plan(p) for p in plans],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/")
async def create_training_plan(
    data: TrainingPlanCreate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Créer un plan de formation (Admin/RH uniquement)."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()

    # Règle 1 — Une filiale ne peut pas créer un plan de niveau groupe
    plan_level_enum = _to_enum(PlanLevel, data.plan_level) if data.plan_level else PlanLevel.LOCAL
    if tenant and tenant.parent_tenant_id is not None and plan_level_enum == PlanLevel.GROUP:
        raise HTTPException(
            status_code=403,
            detail="Une filiale ne peut pas créer un plan de niveau groupe"
        )

    plan = TrainingPlan(
        tenant_id=current_user.tenant_id,
        title=data.title,
        description=data.description,
        year=data.year,
        start_date=data.start_date,
        end_date=data.end_date,
        plan_level=plan_level_enum,
        status=PlanStatus.DRAFT,
        budget_ceiling=data.budget_ceiling,
        currency=data.currency or "XOF",
        parent_plan_id=data.parent_plan_id,
        created_by_id=current_user.id,
    )
    db.add(plan)
    db.flush()

    # Règle 2 — Lors de la création d'un plan groupe, associer toutes les filiales
    if plan_level_enum == PlanLevel.GROUP and tenant and tenant.is_group:
        subsidiaries = db.query(Tenant).filter(
            Tenant.parent_tenant_id == tenant.id
        ).all()
        excluded_ids = set(data.excluded_subsidiary_ids or [])
        for sub in subsidiaries:
            entry = TrainingPlanSubsidiary(
                plan_id=plan.id,
                subsidiary_tenant_id=sub.id,
                is_excluded=(sub.id in excluded_ids),
            )
            db.add(entry)

    db.commit()
    db.refresh(plan)
    return {"id": plan.id, "message": "Plan de formation créé avec succès"}


# ============================================
# ANALYTICS — SUIVI DE LA MISE EN ŒUVRE
# ============================================

@router.get("/analytics")
async def get_training_plan_analytics(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tableau de bord de suivi de la mise en œuvre des plans de formation.

    Retourne :
    - KPIs globaux (taux de réalisation, sessions, employés formés, budget)
    - Répartition par trimestre (planifié vs réalisé)
    - Répartition par modalité
    - Tableau de suivi par plan
    """
    target_year = year or datetime.utcnow().year
    tenant_id = current_user.tenant_id

    # ---- Plans de l'année ----
    plans = db.query(TrainingPlan).filter(
        TrainingPlan.tenant_id == tenant_id,
        TrainingPlan.year == target_year,
    ).all()
    plan_ids = [p.id for p in plans]

    # ---- Actions ----
    actions_total = 0
    if plan_ids:
        actions_total = db.query(func.count(TrainingPlanAction.id)).filter(
            TrainingPlanAction.plan_id.in_(plan_ids),
            TrainingPlanAction.tenant_id == tenant_id,
        ).scalar() or 0

    # ---- Sessions (schedules) ----
    sessions_total = 0
    sessions_planned = 0
    sessions_in_progress = 0
    sessions_completed = 0
    sessions_cancelled = 0

    if plan_ids:
        session_stats = db.query(
            TrainingSchedule.status,
            func.count(TrainingSchedule.id).label("cnt"),
        ).filter(
            TrainingSchedule.plan_id.in_(plan_ids),
            TrainingSchedule.tenant_id == tenant_id,
        ).group_by(TrainingSchedule.status).all()

        for row in session_stats:
            cnt = row.cnt
            sessions_total += cnt
            if row.status == ScheduleStatus.PLANNED:
                sessions_planned += cnt
            elif row.status == ScheduleStatus.IN_PROGRESS:
                sessions_in_progress += cnt
            elif row.status == ScheduleStatus.COMPLETED:
                sessions_completed += cnt
            elif row.status == ScheduleStatus.CANCELLED:
                sessions_cancelled += cnt

    implementation_rate = round(
        (sessions_completed / sessions_total * 100) if sessions_total > 0 else 0.0,
        1
    )

    # ---- Employés formés (assignations complétées) ----
    employees_trained = 0
    if plan_ids:
        employees_trained = db.query(func.count(func.distinct(TrainingAssignment.employee_id))).join(
            TrainingSchedule,
            TrainingAssignment.schedule_id == TrainingSchedule.id,
        ).filter(
            TrainingSchedule.plan_id.in_(plan_ids),
            TrainingSchedule.tenant_id == tenant_id,
            TrainingSchedule.status == ScheduleStatus.COMPLETED,
        ).scalar() or 0

    # ---- Budget global ----
    total_budget_ceiling = float(
        db.query(func.sum(TrainingPlan.budget_ceiling)).filter(
            TrainingPlan.id.in_(plan_ids),
        ).scalar() or 0
    )

    # Coût estimé global : somme des coûts par action plan
    total_estimated_cost = 0.0
    if plan_ids:
        actions = db.query(TrainingPlanAction).filter(
            TrainingPlanAction.plan_id.in_(plan_ids),
            TrainingPlanAction.tenant_id == tenant_id,
        ).all()
        for action in actions:
            unit_cost = float(action.unit_cost) if action.unit_cost else 0.0
            billing = action.billing_mode.value if action.billing_mode else None
            scheduled_sessions = db.query(func.count(TrainingSchedule.id)).filter(
                TrainingSchedule.action_id == action.id,
                TrainingSchedule.status != ScheduleStatus.CANCELLED,
            ).scalar() or 0
            total_participants = db.query(func.count(TrainingAssignment.id)).join(
                TrainingSchedule,
                TrainingAssignment.schedule_id == TrainingSchedule.id,
            ).filter(
                TrainingSchedule.action_id == action.id,
            ).scalar() or 0
            if billing == "per_participant":
                total_estimated_cost += unit_cost * total_participants
            elif billing == "per_session":
                total_estimated_cost += unit_cost * scheduled_sessions
            elif billing == "forfait":
                total_estimated_cost += unit_cost
            else:
                total_estimated_cost += unit_cost * total_participants

    budget_consumption_percent = round(
        (total_estimated_cost / total_budget_ceiling * 100) if total_budget_ceiling > 0 else 0.0,
        1
    )

    # ---- Répartition par trimestre ----
    quarterly = []
    for q in ["T1", "T2", "T3", "T4"]:
        q_planned = 0
        q_completed = 0
        if plan_ids:
            q_planned = db.query(func.count(TrainingSchedule.id)).filter(
                TrainingSchedule.plan_id.in_(plan_ids),
                TrainingSchedule.tenant_id == tenant_id,
                TrainingSchedule.quarter == q,
                TrainingSchedule.status.in_([ScheduleStatus.PLANNED, ScheduleStatus.IN_PROGRESS]),
            ).scalar() or 0
            q_completed = db.query(func.count(TrainingSchedule.id)).filter(
                TrainingSchedule.plan_id.in_(plan_ids),
                TrainingSchedule.tenant_id == tenant_id,
                TrainingSchedule.quarter == q,
                TrainingSchedule.status == ScheduleStatus.COMPLETED,
            ).scalar() or 0
        quarterly.append({
            "quarter": q,
            "planned": q_planned,
            "completed": q_completed,
            "rate": round((q_completed / (q_planned + q_completed) * 100) if (q_planned + q_completed) > 0 else 0.0, 1),
        })

    # ---- Répartition par modalité ----
    modality_breakdown = []
    if plan_ids:
        modality_stats = db.query(
            TrainingPlanAction.modality,
            func.count(TrainingPlanAction.id).label("cnt"),
        ).filter(
            TrainingPlanAction.plan_id.in_(plan_ids),
            TrainingPlanAction.tenant_id == tenant_id,
        ).group_by(TrainingPlanAction.modality).all()
        for row in modality_stats:
            modality_breakdown.append({
                "modality": row.modality.value if row.modality else "non_défini",
                "count": row.cnt,
            })

    # ---- Tableau de suivi par plan ----
    plans_tracking = []
    for plan in plans:
        p_sessions_total = db.query(func.count(TrainingSchedule.id)).filter(
            TrainingSchedule.plan_id == plan.id,
        ).scalar() or 0
        p_sessions_completed = db.query(func.count(TrainingSchedule.id)).filter(
            TrainingSchedule.plan_id == plan.id,
            TrainingSchedule.status == ScheduleStatus.COMPLETED,
        ).scalar() or 0
        p_sessions_cancelled = db.query(func.count(TrainingSchedule.id)).filter(
            TrainingSchedule.plan_id == plan.id,
            TrainingSchedule.status == ScheduleStatus.CANCELLED,
        ).scalar() or 0
        p_actions_count = db.query(func.count(TrainingPlanAction.id)).filter(
            TrainingPlanAction.plan_id == plan.id,
        ).scalar() or 0
        p_needs_count = db.query(func.count(TrainingNeed.id)).filter(
            TrainingNeed.plan_id == plan.id,
        ).scalar() or 0
        p_rate = round(
            (p_sessions_completed / p_sessions_total * 100) if p_sessions_total > 0 else 0.0,
            1
        )
        plans_tracking.append({
            "id": plan.id,
            "title": plan.title,
            "status": plan.status.value if plan.status else None,
            "plan_level": plan.plan_level.value if plan.plan_level else None,
            "budget_ceiling": float(plan.budget_ceiling) if plan.budget_ceiling else None,
            "currency": plan.currency or "XOF",
            "actions_count": p_actions_count,
            "needs_count": p_needs_count,
            "sessions_total": p_sessions_total,
            "sessions_completed": p_sessions_completed,
            "sessions_cancelled": p_sessions_cancelled,
            "implementation_rate": p_rate,
        })

    return {
        "year": target_year,
        "kpis": {
            "plans_count": len(plans),
            "actions_total": actions_total,
            "sessions_total": sessions_total,
            "sessions_planned": sessions_planned,
            "sessions_in_progress": sessions_in_progress,
            "sessions_completed": sessions_completed,
            "sessions_cancelled": sessions_cancelled,
            "implementation_rate": implementation_rate,
            "employees_trained": employees_trained,
            "total_budget_ceiling": total_budget_ceiling,
            "total_estimated_cost": round(total_estimated_cost, 2),
            "budget_consumption_percent": budget_consumption_percent,
        },
        "quarterly": quarterly,
        "modality_breakdown": modality_breakdown,
        "plans_tracking": plans_tracking,
    }


@router.get("/{plan_id}")
async def get_training_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Détail d'un plan de formation."""
    plan = _get_plan_or_404(plan_id, current_user.tenant_id, db)

    result = _serialize_plan(plan)

    # Stats résumées
    actions_count = db.query(func.count(TrainingPlanAction.id)).filter(
        TrainingPlanAction.plan_id == plan_id
    ).scalar() or 0
    needs_count = db.query(func.count(TrainingNeed.id)).filter(
        TrainingNeed.plan_id == plan_id
    ).scalar() or 0
    schedules_count = db.query(func.count(TrainingSchedule.id)).filter(
        TrainingSchedule.plan_id == plan_id
    ).scalar() or 0

    objectives_count = db.query(func.count(TrainingPlanObjective.id)).filter(
        TrainingPlanObjective.plan_id == plan_id
    ).scalar() or 0
    targets_count = db.query(func.count(TrainingPlanTarget.id)).filter(
        TrainingPlanTarget.plan_id == plan_id
    ).scalar() or 0

    result["actions_count"] = actions_count
    result["needs_count"] = needs_count
    result["schedules_count"] = schedules_count
    result["objectives_count"] = objectives_count
    result["targets_count"] = targets_count

    return result


@router.put("/{plan_id}")
async def update_training_plan(
    plan_id: int,
    data: TrainingPlanUpdate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Modifier un plan de formation (Admin/RH uniquement)."""
    plan = _get_plan_or_404(plan_id, current_user.tenant_id, db)

    # Mapping champ → enum SQLAlchemy pour conversion correcte
    field_enum_map = {
        'plan_level': PlanLevel,
        'status': PlanStatus,
    }

    for field, value in data.dict(exclude_unset=True).items():
        if hasattr(plan, field) and value is not None:
            if field in field_enum_map:
                value = _to_enum(field_enum_map[field], value)
            setattr(plan, field, value)

    plan.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Plan de formation mis à jour"}


@router.delete("/{plan_id}")
async def delete_training_plan(
    plan_id: int,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Soft delete — passe le statut à 'cancelled'."""
    plan = _get_plan_or_404(plan_id, current_user.tenant_id, db)
    plan.status = PlanStatus.CLOSED
    plan.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Plan de formation annulé"}


# ============================================
# ACTIONS DU PLAN
# ============================================

@router.get("/{plan_id}/actions")
async def list_plan_actions(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des actions d'un plan."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    actions = db.query(TrainingPlanAction).filter(
        TrainingPlanAction.plan_id == plan_id,
        TrainingPlanAction.tenant_id == current_user.tenant_id,
    ).order_by(TrainingPlanAction.created_at.asc()).all()

    return {"items": [_serialize_action(a, db) for a in actions], "total": len(actions)}


@router.post("/{plan_id}/actions")
async def create_plan_action(
    plan_id: int,
    data: TrainingPlanActionCreate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Ajouter une action au plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    # Vérifier qu'il y a un titre OU un course_id
    if not data.course_id and not data.title:
        raise HTTPException(
            status_code=400,
            detail="Un titre ou un course_id est requis"
        )

    action = TrainingPlanAction(
        tenant_id=current_user.tenant_id,
        plan_id=plan_id,
        course_id=data.course_id,
        title=data.title,
        target_type=_to_enum(TargetType, data.target_type) if data.target_type else TargetType.INDIVIDUAL,
        target_id=data.target_id,
        is_mandatory=data.is_mandatory,
        modality=_to_enum(Modality, data.modality) if data.modality else Modality.PRESENTIEL,
        provider_id=data.provider_id,
        unit_cost=data.unit_cost,
        billing_mode=_to_enum(BillingMode, data.billing_mode) if data.billing_mode else None,
        max_participants=data.max_participants,
        objective_id=data.objective_id,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return {"id": action.id, "message": "Action ajoutée au plan"}


@router.put("/{plan_id}/actions/{action_id}")
async def update_plan_action(
    plan_id: int,
    action_id: int,
    data: TrainingPlanActionUpdate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Modifier une action du plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    action = db.query(TrainingPlanAction).filter(
        TrainingPlanAction.id == action_id,
        TrainingPlanAction.plan_id == plan_id,
        TrainingPlanAction.tenant_id == current_user.tenant_id,
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action non trouvée")

    # Actions obligatoires héritées du groupe : non modifiables par la filiale
    if action.is_mandatory and not _is_admin_or_rh(current_user):
        raise HTTPException(
            status_code=403,
            detail="Cette action obligatoire ne peut pas être modifiée"
        )

    action_enum_map = {
        'target_type': TargetType,
        'modality': Modality,
        'billing_mode': BillingMode,
    }

    for field, value in data.dict(exclude_unset=True).items():
        if hasattr(action, field) and value is not None:
            if field in action_enum_map:
                value = _to_enum(action_enum_map[field], value)
            setattr(action, field, value)

    action.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Action mise à jour"}


@router.delete("/{plan_id}/actions/{action_id}")
async def delete_plan_action(
    plan_id: int,
    action_id: int,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Supprimer une action du plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    action = db.query(TrainingPlanAction).filter(
        TrainingPlanAction.id == action_id,
        TrainingPlanAction.plan_id == plan_id,
        TrainingPlanAction.tenant_id == current_user.tenant_id,
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action non trouvée")

    # Bloquer la suppression si action obligatoire (héritage groupe)
    if action.is_mandatory:
        raise HTTPException(
            status_code=403,
            detail="Impossible de supprimer une action obligatoire héritée du groupe"
        )

    db.delete(action)
    db.commit()
    return {"message": "Action supprimée"}


# ============================================
# CALENDRIER (SCHEDULE)
# ============================================

@router.get("/{plan_id}/schedule")
async def list_plan_schedule(
    plan_id: int,
    quarter: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calendrier du plan de formation."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    query = db.query(TrainingSchedule).filter(
        TrainingSchedule.plan_id == plan_id,
        TrainingSchedule.tenant_id == current_user.tenant_id,
    )

    if quarter:
        query = query.filter(TrainingSchedule.quarter == quarter)
    if status:
        query = query.filter(TrainingSchedule.status == status)

    schedules = query.order_by(TrainingSchedule.start_date.asc()).all()
    return {"items": [_serialize_schedule(s, db) for s in schedules], "total": len(schedules)}


@router.post("/{plan_id}/schedule")
async def create_schedule(
    plan_id: int,
    data: TrainingScheduleCreate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Planifier une session de formation (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    # Vérifier que l'action appartient au plan
    action = db.query(TrainingPlanAction).filter(
        TrainingPlanAction.id == data.action_id,
        TrainingPlanAction.plan_id == plan_id,
        TrainingPlanAction.tenant_id == current_user.tenant_id,
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action non trouvée dans ce plan")

    schedule = TrainingSchedule(
        tenant_id=current_user.tenant_id,
        plan_id=plan_id,
        action_id=data.action_id,
        start_date=data.start_date,
        end_date=data.end_date,
        quarter=_to_enum(Quarter, data.quarter) if data.quarter else None,
        status=ScheduleStatus.PLANNED,
        location=data.location,
        trainer_id=data.trainer_id,
        external_trainer=data.external_trainer,
        max_participants=data.max_participants,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return {"id": schedule.id, "message": "Session planifiée"}


@router.patch("/{plan_id}/schedule/{schedule_id}")
async def update_schedule(
    plan_id: int,
    schedule_id: int,
    data: TrainingScheduleUpdate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Modifier dates/statut d'une session (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    schedule = db.query(TrainingSchedule).filter(
        TrainingSchedule.id == schedule_id,
        TrainingSchedule.plan_id == plan_id,
        TrainingSchedule.tenant_id == current_user.tenant_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    schedule_enum_map = {
        'quarter': Quarter,
        'status': ScheduleStatus,
    }

    for field, value in data.dict(exclude_unset=True).items():
        if hasattr(schedule, field) and value is not None:
            if field in schedule_enum_map:
                value = _to_enum(schedule_enum_map[field], value)
            setattr(schedule, field, value)

    schedule.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Session mise à jour"}


# ============================================
# BESOINS DE FORMATION
# ============================================

@router.get("/{plan_id}/needs")
async def list_plan_needs(
    plan_id: int,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des besoins de formation identifiés."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    query = db.query(TrainingNeed).filter(
        TrainingNeed.plan_id == plan_id,
        TrainingNeed.tenant_id == current_user.tenant_id,
    )

    # Managers : voient uniquement les besoins de leur équipe
    role = _get_user_role(current_user)
    if role == "manager":
        team_ids = [
            e.id for e in db.query(Employee.id).filter(
                Employee.tenant_id == current_user.tenant_id,
                Employee.manager_id == current_user.employee_id,
            ).all()
        ]
        if current_user.employee_id:
            team_ids.append(current_user.employee_id)
        query = query.filter(TrainingNeed.employee_id.in_(team_ids))
    elif role == "employee":
        # Employé : voit uniquement ses propres besoins
        query = query.filter(TrainingNeed.employee_id == current_user.employee_id)

    if priority:
        query = query.filter(TrainingNeed.priority == priority)
    if status:
        query = query.filter(TrainingNeed.status == status)
    if employee_id:
        query = query.filter(TrainingNeed.employee_id == employee_id)

    needs = query.order_by(TrainingNeed.created_at.desc()).all()
    return {"items": [_serialize_need(n, db) for n in needs], "total": len(needs)}


@router.post("/{plan_id}/needs")
async def create_plan_need(
    plan_id: int,
    data: TrainingNeedCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ajouter un besoin de formation.

    - Admin/RH : peuvent ajouter pour n'importe quel employé
    - Manager : peut ajouter pour son équipe
    - Employé : peut ajouter uniquement pour lui-même
    """
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    role = _get_user_role(current_user)

    # Vérifier l'autorisation selon le rôle
    if role == "employee":
        if data.employee_id != current_user.employee_id:
            raise HTTPException(
                status_code=403,
                detail="Vous ne pouvez soumettre un besoin que pour vous-même"
            )
    elif role == "manager":
        # Manager peut soumettre pour son équipe ou pour lui-même
        team_ids = [
            e.id for e in db.query(Employee.id).filter(
                Employee.tenant_id == current_user.tenant_id,
                Employee.manager_id == current_user.employee_id,
            ).all()
        ]
        if current_user.employee_id:
            team_ids.append(current_user.employee_id)
        if data.employee_id not in team_ids:
            raise HTTPException(
                status_code=403,
                detail="Vous ne pouvez soumettre un besoin que pour votre équipe"
            )
    # Admin/RH/DG : pas de restriction

    # Vérifier que l'employé appartient au tenant
    employee = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    # Déduplication par (employee_id, skill_target, year)
    if data.skill_target and data.year:
        existing = db.query(TrainingNeed).filter(
            TrainingNeed.plan_id == plan_id,
            TrainingNeed.employee_id == data.employee_id,
            TrainingNeed.skill_target == data.skill_target,
            TrainingNeed.year == data.year,
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Un besoin identique existe déjà pour cet employé, cette compétence et cette année"
            )

    need = TrainingNeed(
        tenant_id=current_user.tenant_id,
        plan_id=plan_id,
        employee_id=data.employee_id,
        source=data.source,
        skill_target=data.skill_target,
        priority=_to_enum(NeedPriority, data.priority) if data.priority else NeedPriority.MEDIUM,
        year=data.year,
        status=_to_enum(NeedStatus, data.status) if data.status else NeedStatus.IDENTIFIED,
    )
    db.add(need)
    db.commit()
    db.refresh(need)
    return {"id": need.id, "message": "Besoin de formation ajouté"}


# ============================================
# BUDGET
# ============================================

@router.get("/{plan_id}/budget")
async def get_plan_budget(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Résumé budgétaire du plan de formation."""
    plan = _get_plan_or_404(plan_id, current_user.tenant_id, db)

    actions = db.query(TrainingPlanAction).filter(
        TrainingPlanAction.plan_id == plan_id,
        TrainingPlanAction.tenant_id == current_user.tenant_id,
    ).all()

    lines = []
    total_estimated = 0.0

    for action in actions:
        # Nombre de sessions planifiées
        scheduled_sessions = db.query(func.count(TrainingSchedule.id)).filter(
            TrainingSchedule.action_id == action.id,
        ).scalar() or 0

        # Nombre total de participants inscrits
        total_participants = db.query(func.count(TrainingAssignment.id)).join(
            TrainingSchedule,
            TrainingAssignment.schedule_id == TrainingSchedule.id,
        ).filter(
            TrainingSchedule.action_id == action.id,
        ).scalar() or 0

        # Calcul du coût estimé
        unit_cost = float(action.unit_cost) if action.unit_cost else 0.0
        billing = action.billing_mode.value if action.billing_mode else None
        estimated_cost = 0.0

        if billing == "per_participant":
            estimated_cost = unit_cost * total_participants
        elif billing == "per_session":
            estimated_cost = unit_cost * scheduled_sessions
        elif billing == "forfait":
            estimated_cost = unit_cost
        else:
            # Pas de mode de facturation = estimation par participant par défaut
            estimated_cost = unit_cost * total_participants

        total_estimated += estimated_cost

        # Titre de l'action
        action_title = action.title
        course_title = None
        if action.course_id:
            course = db.query(Course).filter(Course.id == action.course_id).first()
            if course:
                course_title = course.title
                if not action_title:
                    action_title = course_title

        lines.append({
            "action_id": action.id,
            "action_title": action_title,
            "course_title": course_title,
            "modality": action.modality.value if action.modality else None,
            "unit_cost": unit_cost if unit_cost > 0 else None,
            "billing_mode": billing,
            "scheduled_sessions": scheduled_sessions,
            "total_participants": total_participants,
            "estimated_cost": round(estimated_cost, 2),
        })

    budget_ceiling = float(plan.budget_ceiling) if plan.budget_ceiling else None
    budget_remaining = None
    budget_usage_percent = None
    if budget_ceiling and budget_ceiling > 0:
        budget_remaining = round(budget_ceiling - total_estimated, 2)
        budget_usage_percent = round((total_estimated / budget_ceiling) * 100, 1)

    return {
        "plan_id": plan.id,
        "budget_ceiling": budget_ceiling,
        "currency": plan.currency or "XOF",
        "total_estimated": round(total_estimated, 2),
        "budget_remaining": budget_remaining,
        "budget_usage_percent": budget_usage_percent,
        "actions_count": len(actions),
        "lines": lines,
    }


# ============================================
# OBJECTIFS DU PLAN
# ============================================

def _serialize_objective(obj: TrainingPlanObjective, db: Session) -> dict:
    okr_title = None
    if obj.okr_id:
        okr = db.query(Objective).filter(Objective.id == obj.okr_id).first()
        if okr:
            okr_title = okr.title

    return {
        "id": obj.id,
        "tenant_id": obj.tenant_id,
        "plan_id": obj.plan_id,
        "okr_id": obj.okr_id,
        "title": obj.title,
        "objective_type": obj.objective_type.value if obj.objective_type else None,
        "description": obj.description,
        "progress_pct": float(obj.progress_pct) if obj.progress_pct is not None else 0.0,
        "created_by_id": obj.created_by_id,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "okr_title": okr_title,
    }


@router.get("/{plan_id}/objectives")
async def list_plan_objectives(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des objectifs d'un plan."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    objectives = db.query(TrainingPlanObjective).filter(
        TrainingPlanObjective.plan_id == plan_id,
        TrainingPlanObjective.tenant_id == current_user.tenant_id,
    ).order_by(TrainingPlanObjective.created_at.asc()).all()

    return {"items": [_serialize_objective(o, db) for o in objectives], "total": len(objectives)}


@router.post("/{plan_id}/objectives")
async def create_plan_objective(
    plan_id: int,
    data: TrainingPlanObjectiveCreate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Ajouter un objectif au plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    obj = TrainingPlanObjective(
        tenant_id=current_user.tenant_id,
        plan_id=plan_id,
        title=data.title,
        objective_type=_to_enum(ObjectiveType, data.objective_type) if data.objective_type else ObjectiveType.AUTRE,
        okr_id=data.okr_id,
        description=data.description,
        progress_pct=data.progress_pct or 0,
        created_by_id=current_user.id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return {"id": obj.id, "message": "Objectif ajouté au plan"}


@router.put("/{plan_id}/objectives/{objective_id}")
async def update_plan_objective(
    plan_id: int,
    objective_id: int,
    data: TrainingPlanObjectiveUpdate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Modifier un objectif du plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    obj = db.query(TrainingPlanObjective).filter(
        TrainingPlanObjective.id == objective_id,
        TrainingPlanObjective.plan_id == plan_id,
        TrainingPlanObjective.tenant_id == current_user.tenant_id,
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Objectif non trouvé")

    field_enum_map = {'objective_type': ObjectiveType}

    for field, value in data.dict(exclude_unset=True).items():
        if hasattr(obj, field) and value is not None:
            if field in field_enum_map:
                value = _to_enum(field_enum_map[field], value)
            setattr(obj, field, value)

    obj.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Objectif mis à jour"}


@router.delete("/{plan_id}/objectives/{objective_id}")
async def delete_plan_objective(
    plan_id: int,
    objective_id: int,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Supprimer un objectif du plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    obj = db.query(TrainingPlanObjective).filter(
        TrainingPlanObjective.id == objective_id,
        TrainingPlanObjective.plan_id == plan_id,
        TrainingPlanObjective.tenant_id == current_user.tenant_id,
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Objectif non trouvé")

    db.delete(obj)
    db.commit()
    return {"message": "Objectif supprimé"}


# ============================================
# CIBLES DU PLAN
# ============================================

@router.get("/{plan_id}/targets")
async def list_plan_targets(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des cibles d'un plan."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    targets = db.query(TrainingPlanTarget).filter(
        TrainingPlanTarget.plan_id == plan_id,
        TrainingPlanTarget.tenant_id == current_user.tenant_id,
    ).order_by(TrainingPlanTarget.created_at.asc()).all()

    items = []
    for t in targets:
        items.append({
            "id": t.id,
            "tenant_id": t.tenant_id,
            "plan_id": t.plan_id,
            "target_type": t.target_type,
            "target_id": t.target_id,
            "target_label": t.target_label,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    return {"items": items, "total": len(items)}


@router.post("/{plan_id}/targets")
async def create_plan_target(
    plan_id: int,
    data: TrainingPlanTargetCreate,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Ajouter une cible au plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    target = TrainingPlanTarget(
        tenant_id=current_user.tenant_id,
        plan_id=plan_id,
        target_type=data.target_type,
        target_id=data.target_id,
        target_label=data.target_label,
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return {"id": target.id, "message": "Cible ajoutée au plan"}


@router.delete("/{plan_id}/targets/{target_id}")
async def delete_plan_target(
    plan_id: int,
    target_id: int,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Supprimer une cible du plan (Admin/RH uniquement)."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    target = db.query(TrainingPlanTarget).filter(
        TrainingPlanTarget.id == target_id,
        TrainingPlanTarget.plan_id == plan_id,
        TrainingPlanTarget.tenant_id == current_user.tenant_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Cible non trouvée")

    db.delete(target)
    db.commit()
    return {"message": "Cible supprimée"}


# ============================================
# FILIALES (SUBSIDIARIES)
# ============================================

@router.get("/{plan_id}/subsidiaries")
async def list_plan_subsidiaries(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des filiales associées à un plan groupe avec statut included/excluded."""
    plan = _get_plan_or_404(plan_id, current_user.tenant_id, db)

    entries = db.query(TrainingPlanSubsidiary).filter(
        TrainingPlanSubsidiary.plan_id == plan_id,
    ).all()

    items = []
    for entry in entries:
        tenant = db.query(Tenant).filter(Tenant.id == entry.subsidiary_tenant_id).first()
        items.append({
            "tenant_id": entry.subsidiary_tenant_id,
            "name": tenant.name if tenant else "Inconnu",
            "is_excluded": entry.is_excluded,
        })

    return {"items": items, "total": len(items)}


@router.post("/{plan_id}/subsidiaries/exclude")
async def exclude_subsidiary(
    plan_id: int,
    body: dict,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Exclure une filiale du plan groupe."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    subsidiary_tenant_id = body.get("subsidiary_tenant_id")
    if not subsidiary_tenant_id:
        raise HTTPException(status_code=400, detail="subsidiary_tenant_id requis")

    entry = db.query(TrainingPlanSubsidiary).filter(
        TrainingPlanSubsidiary.plan_id == plan_id,
        TrainingPlanSubsidiary.subsidiary_tenant_id == subsidiary_tenant_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Filiale non trouvée dans ce plan")

    entry.is_excluded = True
    db.commit()
    return {"message": "Filiale exclue du plan"}


@router.post("/{plan_id}/subsidiaries/include")
async def include_subsidiary(
    plan_id: int,
    body: dict,
    current_user: User = Depends(require_rh),
    db: Session = Depends(get_db),
):
    """Réinclure une filiale dans le plan groupe."""
    _get_plan_or_404(plan_id, current_user.tenant_id, db)

    subsidiary_tenant_id = body.get("subsidiary_tenant_id")
    if not subsidiary_tenant_id:
        raise HTTPException(status_code=400, detail="subsidiary_tenant_id requis")

    entry = db.query(TrainingPlanSubsidiary).filter(
        TrainingPlanSubsidiary.plan_id == plan_id,
        TrainingPlanSubsidiary.subsidiary_tenant_id == subsidiary_tenant_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Filiale non trouvée dans ce plan")

    entry.is_excluded = False
    db.commit()
    return {"message": "Filiale réincluse dans le plan"}

