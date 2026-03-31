# =============================================
# SCHEMAS - Performance & Feedback
# File: app/schemas/performance.py
# =============================================

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum


# =============================================
# ENUMS
# =============================================

class FeedbackType(str, Enum):
    recognition = "recognition"
    improvement = "improvement"
    general = "general"


class InteractionType(str, Enum):
    request = "request"
    file = "file"
    project = "project"
    mission = "mission"
    other = "other"


class EvaluationType(str, Enum):
    self = "self"
    manager = "manager"
    peer = "peer"
    direct_report = "direct_report"
    full_360 = "360"


class EvaluationStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    submitted = "submitted"
    validated = "validated"
    cancelled = "cancelled"  # ← AJOUTÉ


class CampaignType(str, Enum):
    annual = "annual"
    mid_year = "mid_year"
    full_360 = "360"
    probation = "probation"


class PeriodType(str, Enum):
    quarterly = "quarterly"
    semester = "semester"
    annual = "annual"


class CampaignStatus(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    archived = "archived"  # ← AJOUTÉ


class OneOnOneStatus(str, Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    rescheduled = "rescheduled"


class MoodType(str, Enum):
    positive = "positive"
    neutral = "neutral"
    concerned = "concerned"


class RecurrencePattern(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"


# =============================================
# FEEDBACK SCHEMAS
# =============================================

class FeedbackAttitudeItem(BaseModel):
    attitude_id: int
    sentiment: str = Field(..., pattern='^(recognition|improvement)$')


class FeedbackBase(BaseModel):
    to_employee_id: int
    type: FeedbackType = FeedbackType.general
    interaction_type: Optional[InteractionType] = None
    message: str = Field(..., min_length=10, max_length=2000)
    is_public: bool = True


class FeedbackCreate(FeedbackBase):
    attitudes: Optional[List[FeedbackAttitudeItem]] = None


class FeedbackUpdate(BaseModel):
    message: Optional[str] = Field(None, min_length=10, max_length=2000)
    is_public: Optional[bool] = None


class FeedbackResponse(FeedbackBase):
    id: int
    from_employee_id: int
    from_employee_name: Optional[str] = None
    from_employee_initials: Optional[str] = None
    to_employee_name: Optional[str] = None
    to_employee_initials: Optional[str] = None
    likes_count: int = 0
    is_liked_by_me: bool = False
    attitudes: Optional[List[dict]] = None
    interaction_type: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeedbackListResponse(BaseModel):
    items: List[FeedbackResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================
# EVALUATION CAMPAIGN SCHEMAS
# =============================================

class CampaignTemplateCategory(BaseModel):
    name: str
    weight: int = Field(..., ge=0, le=100)
    questions: List[str] = []


class CampaignTemplate(BaseModel):
    categories: List[CampaignTemplateCategory]
    include_okr_score: bool = True
    include_self_evaluation: bool = True
    include_manager_evaluation: bool = True
    include_peer_evaluation: bool = False


class EvaluatorSelection(BaseModel):
    """Sélection des évaluateurs pour un employé dans la campagne"""
    employee_id: int
    peer_ids: Optional[List[int]] = None          # Collègues (même niveau)
    direct_report_ids: Optional[List[int]] = None  # Collaborateurs (N-1)


class EvaluationCampaignBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    type: CampaignType
    start_date: date
    end_date: date
    template: Optional[CampaignTemplate] = None

    # Périodicité
    period: PeriodType = PeriodType.annual
    quarter: Optional[int] = Field(None, ge=1, le=4)  # 1-4 si period='quarterly'

    # Pondération des types d'évaluateurs (somme doit égaler 100)
    weight_self: int = Field(25, ge=0, le=100)
    weight_manager: int = Field(25, ge=0, le=100)
    weight_peer: int = Field(25, ge=0, le=100)
    weight_direct_report: int = Field(25, ge=0, le=100)

    # Types d'évaluateurs à inclure
    include_self_evaluation: bool = True
    include_manager_evaluation: bool = True
    include_peer_evaluation: bool = False
    include_direct_report_evaluation: bool = False

    # Min/max évaluateurs
    min_peer_evaluators: int = Field(1, ge=1, le=5)
    max_peer_evaluators: int = Field(2, ge=1, le=5)
    min_direct_report_evaluators: int = Field(1, ge=1, le=5)
    max_direct_report_evaluators: int = Field(3, ge=1, le=10)


class EvaluationCampaignCreate(EvaluationCampaignBase):
    employee_ids: Optional[List[int]] = None       # Employés concernés (None = tous)
    department_ids: Optional[List[int]] = None     # Ou par département
    evaluator_selections: Optional[List[EvaluatorSelection]] = None  # Sélection évaluateurs par employé


class EvaluationCampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[CampaignStatus] = None
    template: Optional[CampaignTemplate] = None


class EvaluationCampaignResponse(EvaluationCampaignBase):
    id: int
    status: CampaignStatus
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None

    # Stats calculées
    total_evaluations: int = 0
    completed_evaluations: int = 0
    progress_percentage: float = 0.0

    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EvaluationCampaignListResponse(BaseModel):
    items: List[EvaluationCampaignResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================
# EVALUATION SCHEMAS
# =============================================

class EvaluationScoreItem(BaseModel):
    score: Union[int, float] = Field(..., ge=0, le=100)
    comment: Optional[str] = None


class EvaluationBase(BaseModel):
    employee_id: int
    evaluator_id: Optional[int] = None
    type: EvaluationType
    campaign_id: Optional[int] = None
    due_date: Optional[date] = None


class EvaluationCreate(EvaluationBase):
    pass


class EvaluationUpdate(BaseModel):
    scores: Optional[Dict[str, EvaluationScoreItem]] = None
    overall_score: Optional[float] = Field(None, ge=0, le=5)
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    goals: Optional[str] = None
    manager_comments: Optional[str] = None
    employee_comments: Optional[str] = None
    status: Optional[EvaluationStatus] = None


class EvaluationSubmit(BaseModel):
    """
    Schéma pour soumettre une évaluation.
    Les scores peuvent être envoyés de différentes manières :
    - Dict[str, EvaluationScoreItem] : {"Compétences": {"score": 85, "comment": "..."}}
    - Dict[str, dict] : {"Compétences": {"score": 85, "comment": "..."}}
    """
    scores: Dict[str, Any]  # Flexible pour accepter différents formats
    overall_score: float = Field(..., ge=0, le=5)
    strengths: Optional[Union[str, List[str]]] = None  # Peut être string ou liste
    improvements: Optional[Union[str, List[str]]] = None  # Peut être string ou liste
    goals: Optional[Union[str, List[str]]] = None  # Peut être string ou liste
    employee_comments: Optional[str] = None


class EvaluationValidate(BaseModel):
    manager_comments: Optional[str] = None
    approved: bool = True


class EvaluationResponse(BaseModel):
    id: int
    tenant_id: int
    campaign_id: Optional[int] = None
    campaign_name: Optional[str] = None
    
    employee_id: int
    employee_name: Optional[str] = None
    employee_initials: Optional[str] = None
    employee_department: Optional[str] = None
    employee_job_title: Optional[str] = None
    
    evaluator_id: Optional[int] = None
    evaluator_name: Optional[str] = None
    
    type: EvaluationType
    status: EvaluationStatus
    
    scores: Optional[Dict[str, Any]] = None
    overall_score: Optional[float] = None
    calibrated_score: Optional[float] = None
    is_calibrated: bool = False
    
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    goals: Optional[str] = None
    manager_comments: Optional[str] = None
    employee_comments: Optional[str] = None
    
    okr_achievement_score: Optional[float] = None

    period: Optional[str] = None
    weighted_score: Optional[float] = None

    due_date: Optional[date] = None
    submitted_at: Optional[datetime] = None
    validated_at: Optional[datetime] = None
    validated_by: Optional[int] = None

    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EvaluationListResponse(BaseModel):
    items: List[EvaluationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================
# ONE-ON-ONE SCHEMAS
# =============================================

class OneOnOneBase(BaseModel):
    employee_id: int
    scheduled_date: datetime
    duration_minutes: int = Field(30, ge=15, le=120)
    location: Optional[str] = Field(None, max_length=255)
    topics: Optional[List[str]] = None


class OneOnOneCreate(OneOnOneBase):
    is_recurring: bool = False
    recurrence_pattern: Optional[RecurrencePattern] = None


class OneOnOneUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=120)
    location: Optional[str] = Field(None, max_length=255)
    topics: Optional[List[str]] = None
    status: Optional[OneOnOneStatus] = None


class OneOnOneTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    type: str = Field('task', pattern='^(task|training)$')  # task | training
    assignee: str = Field('employee', pattern='^(manager|employee)$')  # who must do it
    due_date: Optional[str] = None  # ISO date string YYYY-MM-DD


class OneOnOneTask(BaseModel):
    id: str
    title: str
    type: str  # task | training
    assignee: str  # manager | employee
    due_date: Optional[str] = None
    status: str = 'pending'  # pending | done
    completed_at: Optional[str] = None


class OneOnOneComplete(BaseModel):
    notes: str = Field(..., min_length=10)
    action_items: Optional[List[str]] = None
    mood: Optional[MoodType] = None
    evaluation_score: Optional[int] = Field(None, ge=1, le=5)
    evaluation_comment: Optional[str] = Field(None, max_length=500)
    tasks: Optional[List[OneOnOneTaskCreate]] = None


class OneOnOneCancel(BaseModel):
    reason: Optional[str] = Field(None, max_length=255)


class OneOnOneResponse(BaseModel):
    id: int
    tenant_id: int
    
    employee_id: int
    employee_name: Optional[str] = None
    employee_initials: Optional[str] = None
    
    manager_id: int
    manager_name: Optional[str] = None
    
    scheduled_date: datetime
    duration_minutes: int
    location: Optional[str] = None
    
    status: OneOnOneStatus
    
    notes: Optional[str] = None
    action_items: Optional[List[str]] = None
    mood: Optional[MoodType] = None
    topics: Optional[List[str]] = None
    evaluation_score: Optional[int] = None
    evaluation_comment: Optional[str] = None
    tasks: Optional[List[dict]] = None
    
    is_recurring: bool = False
    recurrence_pattern: Optional[RecurrencePattern] = None
    
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OneOnOneListResponse(BaseModel):
    items: List[OneOnOneResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================
# STATS SCHEMAS
# =============================================

class PerformanceStats(BaseModel):
    # Scores
    avg_score: float
    score_distribution: Dict[str, int]  # {"Exceptionnel": 8, "Dépasse attentes": 15, ...}
    
    # Évaluations
    evaluations_total: int
    evaluations_completed: int
    evaluations_pending: int
    evaluations_in_progress: int
    completion_rate: float
    
    # Feedbacks
    feedbacks_this_month: int
    feedbacks_total: int
    top_feedback_givers: List[Dict[str, Any]]  # [{"name": "...", "count": 24}, ...]
    
    # OKRs
    okr_achievement_avg: float
    
    # 1-on-1
    one_on_ones_this_week: int
    one_on_ones_this_month: int
    
    # Compétences moyennes
    competency_averages: Dict[str, float]  # {"technical": 85, "leadership": 72, ...}
    
    # Tendance
    score_trend: List[Dict[str, Any]]  # [{"month": "Jan", "score": 3.8}, ...]


class FeedbackStats(BaseModel):
    total: int
    this_month: int
    by_type: Dict[str, int]
    top_givers: List[Dict[str, Any]]
    top_receivers: List[Dict[str, Any]]


class EvaluationStats(BaseModel):
    total: int
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    avg_score: float
    completion_rate: float
    by_department: Dict[str, Dict[str, Any]]


# =============================================
# SCORE GLOBAL (note annuelle = moyenne campagnes)
# =============================================

class CampaignScoreItem(BaseModel):
    campaign_id: int
    campaign_name: str
    period: str
    quarter: Optional[int] = None
    score: Optional[float] = None  # Score pondéré final de la campagne pour cet employé


class GlobalScoreResponse(BaseModel):
    employee_id: int
    year: int
    campaigns: List[CampaignScoreItem]
    global_score: Optional[float] = None  # Moyenne de tous les scores campagnes