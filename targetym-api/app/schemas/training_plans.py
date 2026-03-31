# app/schemas/training_plans.py
"""
Schemas Pydantic pour le sous-module Plan de Formation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


# ============================================
# ENUMS
# ============================================

class PlanLevelEnum(str, Enum):
    group = "group"
    subsidiary = "subsidiary"
    local = "local"


class PlanStatusEnum(str, Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    active = "active"
    closed = "closed"


class NeedPriorityEnum(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class NeedStatusEnum(str, Enum):
    identified = "identified"
    planned = "planned"
    completed = "completed"
    cancelled = "cancelled"


class TargetTypeEnum(str, Enum):
    individual = "individual"
    job = "job"
    level = "level"
    department = "department"
    group = "group"


class ModalityEnum(str, Enum):
    presentiel = "presentiel"
    distanciel = "distanciel"
    blended = "blended"
    elearning = "elearning"


class BillingModeEnum(str, Enum):
    per_participant = "per_participant"
    per_session = "per_session"
    forfait = "forfait"


class QuarterEnum(str, Enum):
    T1 = "T1"
    T2 = "T2"
    T3 = "T3"
    T4 = "T4"


class ScheduleStatusEnum(str, Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class AssignmentStatusEnum(str, Enum):
    invited = "invited"
    confirmed = "confirmed"
    attended = "attended"
    absent = "absent"
    cancelled = "cancelled"


class ObjectiveTypeEnum(str, Enum):
    okr = "okr"
    excellence_operationnelle = "excellence_operationnelle"
    developpement_competences = "developpement_competences"
    conformite_reglementaire = "conformite_reglementaire"
    managerial = "managerial"
    autre = "autre"


# ============================================
# TRAINING PLANS
# ============================================

class TrainingPlanCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    year: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    plan_level: PlanLevelEnum = PlanLevelEnum.local
    budget_ceiling: Optional[float] = None
    currency: str = "XOF"
    parent_plan_id: Optional[int] = None
    excluded_subsidiary_ids: Optional[List[int]] = []


class TrainingPlanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    year: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    plan_level: Optional[PlanLevelEnum] = None
    status: Optional[PlanStatusEnum] = None
    budget_ceiling: Optional[float] = None
    currency: Optional[str] = None


class TrainingPlanResponse(BaseModel):
    id: int
    tenant_id: int
    parent_plan_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    year: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    plan_level: str
    status: str
    budget_ceiling: Optional[float] = None
    currency: str
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# TRAINING NEEDS
# ============================================

class TrainingNeedCreate(BaseModel):
    employee_id: int
    source: Optional[List[str]] = None
    skill_target: Optional[str] = Field(None, max_length=255)
    priority: NeedPriorityEnum = NeedPriorityEnum.medium
    year: Optional[int] = None
    status: Optional[NeedStatusEnum] = NeedStatusEnum.identified


class TrainingNeedResponse(BaseModel):
    id: int
    tenant_id: int
    plan_id: int
    employee_id: int
    source: Optional[List[str]] = None
    skill_target: Optional[str] = None
    priority: str
    year: Optional[int] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# TRAINING PLAN ACTIONS
# ============================================

class TrainingPlanActionCreate(BaseModel):
    course_id: Optional[int] = None
    title: Optional[str] = Field(None, max_length=255)
    target_type: TargetTypeEnum = TargetTypeEnum.individual
    target_id: Optional[int] = None
    is_mandatory: bool = False
    modality: ModalityEnum = ModalityEnum.presentiel
    provider_id: Optional[int] = None
    unit_cost: Optional[float] = None
    billing_mode: Optional[BillingModeEnum] = None
    max_participants: Optional[int] = None
    objective_id: Optional[int] = None


class TrainingPlanActionUpdate(BaseModel):
    course_id: Optional[int] = None
    title: Optional[str] = Field(None, max_length=255)
    target_type: Optional[TargetTypeEnum] = None
    target_id: Optional[int] = None
    is_mandatory: Optional[bool] = None
    modality: Optional[ModalityEnum] = None
    provider_id: Optional[int] = None
    unit_cost: Optional[float] = None
    billing_mode: Optional[BillingModeEnum] = None
    max_participants: Optional[int] = None
    objective_id: Optional[int] = None


class TrainingPlanActionResponse(BaseModel):
    id: int
    tenant_id: int
    plan_id: int
    course_id: Optional[int] = None
    title: Optional[str] = None
    target_type: str
    target_id: Optional[int] = None
    is_mandatory: bool
    modality: str
    provider_id: Optional[int] = None
    unit_cost: Optional[float] = None
    billing_mode: Optional[str] = None
    max_participants: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Enriched fields
    course_title: Optional[str] = None
    provider_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================
# TRAINING SCHEDULE
# ============================================

class TrainingScheduleCreate(BaseModel):
    action_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    quarter: Optional[QuarterEnum] = None
    location: Optional[str] = Field(None, max_length=255)
    trainer_id: Optional[int] = None
    external_trainer: Optional[str] = Field(None, max_length=255)
    max_participants: Optional[int] = None


class TrainingScheduleUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    quarter: Optional[QuarterEnum] = None
    status: Optional[ScheduleStatusEnum] = None
    location: Optional[str] = Field(None, max_length=255)
    trainer_id: Optional[int] = None
    external_trainer: Optional[str] = Field(None, max_length=255)
    max_participants: Optional[int] = None


class TrainingScheduleResponse(BaseModel):
    id: int
    tenant_id: int
    plan_id: int
    action_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    quarter: Optional[str] = None
    status: str
    location: Optional[str] = None
    trainer_id: Optional[int] = None
    external_trainer: Optional[str] = None
    max_participants: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Enriched fields
    action_title: Optional[str] = None
    trainer_name: Optional[str] = None
    enrolled_count: Optional[int] = None

    class Config:
        from_attributes = True


# ============================================
# SUBSIDIARIES
# ============================================

class SubsidiaryStatusResponse(BaseModel):
    tenant_id: int
    name: str
    is_excluded: bool

    class Config:
        from_attributes = True


# ============================================
# BUDGET
# ============================================

class BudgetLineItem(BaseModel):
    action_id: int
    action_title: Optional[str] = None
    course_title: Optional[str] = None
    modality: Optional[str] = None
    unit_cost: Optional[float] = None
    billing_mode: Optional[str] = None
    scheduled_sessions: int = 0
    total_participants: int = 0
    estimated_cost: float = 0.0


class BudgetSummaryResponse(BaseModel):
    plan_id: int
    budget_ceiling: Optional[float] = None
    currency: str = "XOF"
    total_estimated: float = 0.0
    budget_remaining: Optional[float] = None
    budget_usage_percent: Optional[float] = None
    actions_count: int = 0
    lines: List[BudgetLineItem] = []


# ============================================
# TRAINING PLAN OBJECTIVES
# ============================================

class TrainingPlanObjectiveCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    objective_type: ObjectiveTypeEnum = ObjectiveTypeEnum.autre
    okr_id: Optional[int] = None
    description: Optional[str] = None
    progress_pct: float = 0.0


class TrainingPlanObjectiveUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    objective_type: Optional[ObjectiveTypeEnum] = None
    okr_id: Optional[int] = None
    description: Optional[str] = None
    progress_pct: Optional[float] = None


class TrainingPlanObjectiveResponse(BaseModel):
    id: int
    tenant_id: int
    plan_id: int
    okr_id: Optional[int] = None
    title: str
    objective_type: str
    description: Optional[str] = None
    progress_pct: float = 0.0
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    okr_title: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================
# TRAINING PLAN TARGETS
# ============================================

class TrainingPlanTargetCreate(BaseModel):
    target_type: str = Field(..., max_length=20)  # 'department', 'profile', 'level'
    target_id: Optional[int] = None
    target_label: str = Field(..., min_length=1, max_length=255)


class TrainingPlanTargetResponse(BaseModel):
    id: int
    tenant_id: int
    plan_id: int
    target_type: str
    target_id: Optional[int] = None
    target_label: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
