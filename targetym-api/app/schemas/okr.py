# app/schemas/okr.py

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


# Enums
class ObjectiveLevel(str, Enum):
    enterprise = "enterprise"
    department = "department"
    individual = "individual"


class ObjectiveStatus(str, Enum):
    draft = "draft"
    active = "active"
    on_track = "on_track"
    at_risk = "at_risk"
    behind = "behind"
    exceeded = "exceeded"
    completed = "completed"
    cancelled = "cancelled"


class InitiativeSource(str, Enum):
    manual = "manual"
    asana = "asana"
    notion = "notion"
    trello = "trello"
    jira = "jira"
    monday = "monday"
    other = "other"


class InitiativeStatus(str, Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    on_track = "on_track"
    at_risk = "at_risk"
    behind = "behind"
    completed = "completed"
    cancelled = "cancelled"


# ============================================
# KEY RESULTS
# ============================================

class KeyResultBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    target: float = Field(..., gt=0)
    current: float = Field(default=0, ge=0)
    unit: Optional[str] = Field(default=None, max_length=50)
    weight: float = Field(default=100, ge=0, le=100)


class KeyResultCreate(KeyResultBase):
    pass


class KeyResultUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    target: Optional[float] = Field(default=None, gt=0)
    current: Optional[float] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, max_length=50)
    weight: Optional[float] = Field(default=None, ge=0, le=100)


class KeyResultResponse(KeyResultBase):
    id: int
    objective_id: int
    progress: float  # Calculé automatiquement
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# INITIATIVES
# ============================================

class InitiativeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    source: InitiativeSource = InitiativeSource.manual
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    progress: float = Field(default=0, ge=0, le=100)
    status: InitiativeStatus = InitiativeStatus.not_started
    due_date: Optional[date] = None


class InitiativeCreate(InitiativeBase):
    pass


class InitiativeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    source: Optional[InitiativeSource] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    progress: Optional[float] = Field(default=None, ge=0, le=100)
    status: Optional[InitiativeStatus] = None
    due_date: Optional[date] = None


class InitiativeResponse(InitiativeBase):
    id: int
    objective_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# OBJECTIVES
# ============================================

class ObjectiveBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    level: ObjectiveLevel = ObjectiveLevel.individual
    owner_id: Optional[int] = None
    department_id: Optional[int] = None
    parent_id: Optional[int] = None
    period: str = Field(..., min_length=1, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ObjectiveStatus = ObjectiveStatus.draft


class ObjectiveCreate(ObjectiveBase):
    key_results: Optional[List[KeyResultCreate]] = []


class ObjectiveUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    level: Optional[ObjectiveLevel] = None
    owner_id: Optional[int] = None
    department_id: Optional[int] = None
    parent_id: Optional[int] = None
    period: Optional[str] = Field(default=None, min_length=1, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[ObjectiveStatus] = None


class ObjectiveResponse(ObjectiveBase):
    id: int
    tenant_id: int
    progress: float
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Infos enrichies
    owner_name: Optional[str] = None
    owner_initials: Optional[str] = None
    department_name: Optional[str] = None
    
    # Relations
    key_results: List[KeyResultResponse] = []
    initiatives: List[InitiativeResponse] = []

    class Config:
        from_attributes = True


class ObjectiveListResponse(BaseModel):
    """Réponse pour la liste des objectifs (sans les détails complets)"""
    id: int
    tenant_id: int
    title: str
    level: ObjectiveLevel
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    owner_initials: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    parent_id: Optional[int] = None
    period: str
    progress: float
    status: ObjectiveStatus
    key_results_count: int = 0
    initiatives_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# PAGINATION & STATS
# ============================================

class ObjectivesPageResponse(BaseModel):
    items: List[ObjectiveResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class OKRStats(BaseModel):
    total: int
    by_level: dict  # {"enterprise": 2, "department": 5, "individual": 10}
    by_status: dict  # {"on_track": 10, "at_risk": 3, ...}
    avg_progress: float
    completed: int
    in_progress: int
    not_started: int
    overdue: int
    by_department: dict  # {"Tech": {"count": 5, "avg_progress": 75}, ...}
