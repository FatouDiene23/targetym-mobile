from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskSource(str, Enum):
    MANUAL = "manual"
    DAILY_CHECKLIST = "daily_checklist"
    ASANA = "asana"
    JIRA = "jira"
    NOTION = "notion"
    TRELLO = "trello"
    MONDAY = "monday"
    ONBOARDING = "onboarding"
    OTHER = "other"


class DailyValidationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ============================================
# TASK SCHEMAS
# ============================================

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    assigned_to_id: int
    due_date: date
    priority: TaskPriority = TaskPriority.MEDIUM
    # Lien OKR (obligatoire sauf si is_administrative=True)
    objective_id: Optional[int] = None
    key_result_id: Optional[int] = None
    # 🆕 Tâche administrative (pas de lien OKR requis)
    is_administrative: bool = False


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    # Lien OKR
    objective_id: Optional[int] = None
    key_result_id: Optional[int] = None
    # 🆕 Tâche administrative
    is_administrative: Optional[bool] = None


class TaskComplete(BaseModel):
    """Pour marquer une tâche comme terminée"""
    completion_note: Optional[str] = None


class TaskIncompleteReason(BaseModel):
    """Pour justifier une tâche non terminée lors de la soumission journalière"""
    incomplete_reason: str = Field(..., min_length=1, max_length=500)


class TaskResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    description: Optional[str]
    assigned_to_id: int
    assigned_to_name: Optional[str] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    due_date: date
    completed_at: Optional[datetime]
    status: TaskStatus
    priority: TaskPriority
    completion_note: Optional[str]
    incomplete_reason: Optional[str]
    is_overdue: bool = False
    # Source externe
    source: TaskSource = TaskSource.MANUAL
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    # Lien OKR
    objective_id: Optional[int] = None
    objective_title: Optional[str] = None
    key_result_id: Optional[int] = None
    key_result_title: Optional[str] = None
    # 🆕 Tâche administrative
    is_administrative: bool = False
    # Daily checklist
    checklist_item_id: Optional[int] = None
    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TasksPageResponse(BaseModel):
    items: List[TaskResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TaskStats(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    overdue: int
    due_today: int


# ============================================
# DAILY VALIDATION SCHEMAS
# ============================================

class DailyValidationSubmit(BaseModel):
    """Pour soumettre sa journée"""
    submission_note: Optional[str] = None
    incomplete_tasks: Optional[List[dict]] = None  # [{task_id: int, reason: str}]


class DailyValidationAction(BaseModel):
    """Pour valider ou rejeter une journée"""
    approved: bool
    comment: Optional[str] = None


class DailyValidationResponse(BaseModel):
    id: int
    tenant_id: int
    employee_id: int
    employee_name: Optional[str] = None
    validation_date: date
    status: DailyValidationStatus
    submitted_at: Optional[datetime]
    submission_note: Optional[str]
    validated_by_id: Optional[int]
    validated_by_name: Optional[str] = None
    validated_at: Optional[datetime]
    validation_comment: Optional[str]
    total_tasks: int
    completed_tasks: int
    completion_rate: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True


class DailyValidationsPageResponse(BaseModel):
    items: List[DailyValidationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PendingValidationResponse(BaseModel):
    """Validation en attente avec détails des tâches"""
    validation: DailyValidationResponse
    tasks: List[TaskResponse]