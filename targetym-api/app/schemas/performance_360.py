# =============================================
# SCHEMAS - 360° Feedback & Calibration
# File: app/schemas/performance_360.py
# =============================================

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from enum import Enum
from uuid import UUID


# =============================================
# ENUMS
# =============================================

class EvaluatorType(str, Enum):
    SELF = 'self'
    MANAGER = 'manager'
    PEER = 'peer'
    DIRECT_REPORT = 'direct_report'


class PeerSelectionMode(str, Enum):
    RH_ASSIGNS = 'rh_assigns'
    MANAGER_ASSIGNS = 'manager_assigns'
    EMPLOYEE_SUGGESTS = 'employee_suggests'
    AUTO = 'auto'


class CalibrationStatus(str, Enum):
    SCHEDULED = 'scheduled'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'


class AssignmentStatus(str, Enum):
    PENDING = 'pending'
    COMPLETED = 'completed'
    SKIPPED = 'skipped'


# =============================================
# EVALUATION ASSIGNMENT SCHEMAS
# =============================================

class EvaluationAssignmentCreate(BaseModel):
    """Créer une assignation d'évaluation"""
    campaign_id: int
    employee_id: int
    evaluator_id: int
    evaluator_type: EvaluatorType


class EvaluationAssignmentResponse(BaseModel):
    id: int
    tenant_id: int
    campaign_id: int
    employee_id: int
    evaluator_id: int
    evaluator_type: str
    status: str
    evaluation_id: Optional[int] = None
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Enriched
    employee_name: Optional[str] = None
    evaluator_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class BulkAssignmentCreate(BaseModel):
    """Créer plusieurs assignations en masse"""
    campaign_id: int
    assignments: List[Dict[str, Any]]
    # Exemple: [{"employee_id": 1, "evaluator_id": 2, "evaluator_type": "peer"}, ...]


class AutoAssignmentRequest(BaseModel):
    """Demande d'assignation automatique basée sur l'organigramme"""
    campaign_id: int
    include_manager: bool = True
    include_peers: bool = True
    include_direct_reports: bool = False
    min_peers: int = 3
    max_peers: int = 5


# =============================================
# 360° CAMPAIGN SCHEMAS
# =============================================

class Campaign360Create(BaseModel):
    """Créer une campagne 360°"""
    name: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    
    # Options 360°
    peer_selection_mode: PeerSelectionMode = PeerSelectionMode.RH_ASSIGNS
    min_peer_evaluators: int = Field(default=3, ge=1, le=10)
    max_peer_evaluators: int = Field(default=5, ge=1, le=15)
    
    include_self_evaluation: bool = True
    include_manager_evaluation: bool = True
    include_peer_evaluation: bool = True
    include_direct_report_evaluation: bool = False
    
    # Template de questions
    template: Optional[Dict[str, Any]] = None
    
    # Employés ciblés (optionnel, sinon tous les actifs)
    employee_ids: Optional[List[int]] = None
    department_ids: Optional[List[int]] = None


class Campaign360Response(BaseModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    type: str
    status: str
    start_date: date
    end_date: date
    
    # Options 360°
    is_360: bool
    peer_selection_mode: Optional[str] = None
    min_peer_evaluators: Optional[int] = None
    max_peer_evaluators: Optional[int] = None
    include_self_evaluation: bool
    include_manager_evaluation: bool
    include_peer_evaluation: bool
    include_direct_report_evaluation: bool
    
    # Stats
    total_employees: int = 0
    total_evaluations: int = 0
    completed_evaluations: int = 0
    progress_percentage: float = 0
    
    # Assignments stats
    pending_assignments: int = 0
    completed_assignments: int = 0
    
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# =============================================
# 360° SUMMARY SCHEMAS
# =============================================

class Evaluation360Summary(BaseModel):
    """Résumé 360° pour un employé"""
    employee_id: int
    employee_name: str
    department_name: Optional[str] = None
    job_title: Optional[str] = None
    campaign_id: int
    campaign_name: Optional[str] = None
    evaluation_group_id: Optional[UUID] = None
    
    # Scores par type d'évaluateur
    self_score: Optional[float] = None
    manager_score: Optional[float] = None
    peer_avg_score: Optional[float] = None
    direct_report_avg_score: Optional[float] = None
    
    # Score global
    average_score: Optional[float] = None
    calibrated_score: Optional[float] = None
    
    # Compteurs
    peer_count: int = 0
    direct_report_count: int = 0
    completed_count: int = 0
    total_evaluations: int = 0
    
    # Status
    overall_status: str = 'pending'
    
    # Détail des évaluations
    evaluations: List[Dict[str, Any]] = []


class Evaluation360ListResponse(BaseModel):
    items: List[Evaluation360Summary]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================
# CALIBRATION SCHEMAS
# =============================================

class CalibrationSessionCreate(BaseModel):
    """Créer une session de calibration"""
    campaign_id: int
    name: str
    description: Optional[str] = None
    department_id: Optional[int] = None  # NULL = toute l'entreprise
    scheduled_date: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    location: Optional[str] = None
    
    # Participants (employee_ids des managers qui participent)
    participant_ids: List[int] = []


class CalibrationSessionUpdate(BaseModel):
    """Mettre à jour une session de calibration"""
    name: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    status: Optional[CalibrationStatus] = None
    notes: Optional[str] = None


class CalibrationSessionResponse(BaseModel):
    id: int
    tenant_id: int
    campaign_id: int
    name: str
    description: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    duration_minutes: int
    location: Optional[str] = None
    status: str
    notes: Optional[str] = None
    decisions: Optional[List[Dict[str, Any]]] = None
    
    facilitator_id: Optional[int] = None
    facilitator_name: Optional[str] = None
    
    # Stats
    participants_count: int = 0
    evaluations_to_review: int = 0
    adjustments_made: int = 0
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CalibrationSessionListResponse(BaseModel):
    items: List[CalibrationSessionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================
# SCORE ADJUSTMENT SCHEMAS
# =============================================

class ScoreAdjustmentCreate(BaseModel):
    """Proposer un ajustement de score"""
    evaluation_id: int
    calibrated_score: float = Field(ge=0, le=5)
    reason: str = Field(min_length=10)


class ScoreAdjustmentResponse(BaseModel):
    id: int
    session_id: int
    evaluation_id: int
    original_score: float
    calibrated_score: float
    reason: str
    proposed_by: Optional[int] = None
    proposed_by_name: Optional[str] = None
    approved: bool
    approved_by: Optional[int] = None
    approved_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    
    # Enriched
    employee_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class BulkScoreAdjustment(BaseModel):
    """Ajustements en masse"""
    session_id: int
    adjustments: List[ScoreAdjustmentCreate]


# =============================================
# CALIBRATION COMPARISON VIEW
# =============================================

class CalibrationComparisonItem(BaseModel):
    """Item pour la vue de comparaison en calibration"""
    evaluation_id: int
    employee_id: int
    employee_name: str
    job_title: Optional[str] = None
    department_name: Optional[str] = None
    
    # Scores
    self_score: Optional[float] = None
    manager_score: Optional[float] = None
    peer_avg_score: Optional[float] = None
    overall_score: Optional[float] = None
    calibrated_score: Optional[float] = None
    
    # Écarts (pour identifier les cas à discuter)
    self_manager_gap: Optional[float] = None  # Écart auto-éval vs manager
    
    is_calibrated: bool = False
    status: str
    
    # Flag si écart important (>1 point)
    needs_review: bool = False


class CalibrationComparisonResponse(BaseModel):
    session_id: int
    campaign_id: int
    campaign_name: str
    department_name: Optional[str] = None
    
    items: List[CalibrationComparisonItem]
    
    # Stats
    total_employees: int = 0
    calibrated_count: int = 0
    needs_review_count: int = 0
    avg_score_before: Optional[float] = None
    avg_score_after: Optional[float] = None


# =============================================
# PARTICIPANT SCHEMAS
# =============================================

class CalibrationParticipantResponse(BaseModel):
    id: int
    session_id: int
    employee_id: int
    employee_name: Optional[str] = None
    role: str
    attended: bool
    
    class Config:
        from_attributes = True


class AddParticipantsRequest(BaseModel):
    """Ajouter des participants à une session"""
    employee_ids: List[int]
    role: str = 'participant'  # 'facilitator', 'participant', 'observer'
