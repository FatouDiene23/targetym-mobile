from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


# ── Enums ────────────────────────────────────────────────────────────────────

class DisputeStage(str, Enum):
    CONVOCATION_IT = "convocation_it"
    ENTRETIEN_IT = "entretien_it"
    CONCILIATION = "conciliation"
    ACCORD_AMIABLE = "accord_amiable"
    CONTENTIEUX = "contentieux"
    AUDIENCE = "audience"
    JUGEMENT = "jugement"
    CLOTURE = "cloture"


class DisputeStatus(str, Enum):
    OUVERT = "ouvert"
    EN_COURS = "en_cours"
    SUSPENDU = "suspendu"
    CLOS_ACCORD = "clos_accord"
    CLOS_JUGEMENT = "clos_jugement"
    CLOS_ABANDON = "clos_abandon"


class AudienceType(str, Enum):
    PLAIDOIRIE = "plaidoirie"
    RENVOI = "renvoi"
    DELIBERE = "delibere"
    JUGEMENT = "jugement"


class ConciliationResult(str, Enum):
    REUSSIE = "reussie"
    ECHOUEE = "echouee"
    EN_ATTENTE = "en_attente"


# ── Dossiers ─────────────────────────────────────────────────────────────────

class LaborDisputeCreate(BaseModel):
    employee_id: int
    reference_number: str = Field(..., max_length=50)
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    opened_date: date
    assigned_to_id: Optional[int] = None


class LaborDisputeUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    assigned_to_id: Optional[int] = None


class LaborDisputeResponse(BaseModel):
    id: int
    tenant_id: int
    employee_id: int
    employee_name: Optional[str] = None
    reference_number: str
    title: str
    description: Optional[str] = None
    current_stage: str
    status: str
    opened_date: date
    closed_date: Optional[date] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LaborDisputeDetailResponse(LaborDisputeResponse):
    stages_history: List["DisputeStageHistoryResponse"] = []
    audiences: List["DisputeAudienceResponse"] = []
    documents: List["DisputeDocumentResponse"] = []


class LaborDisputeListResponse(BaseModel):
    items: List[LaborDisputeResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Changement d'étape ──────────────────────────────────────────────────────

class DisputeStageChangeRequest(BaseModel):
    stage: DisputeStage
    notes: Optional[str] = None


class DisputeStageHistoryResponse(BaseModel):
    id: int
    stage: str
    started_at: datetime
    notes: Optional[str] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Audiences ────────────────────────────────────────────────────────────────

class DisputeAudienceCreate(BaseModel):
    audience_date: datetime
    audience_type: AudienceType
    location: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    result: Optional[str] = None
    next_audience_date: Optional[date] = None


class DisputeAudienceUpdate(BaseModel):
    audience_date: Optional[datetime] = None
    audience_type: Optional[AudienceType] = None
    location: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    result: Optional[str] = None
    next_audience_date: Optional[date] = None


class DisputeAudienceResponse(BaseModel):
    id: int
    dispute_id: int
    audience_date: datetime
    audience_type: str
    location: Optional[str] = None
    notes: Optional[str] = None
    result: Optional[str] = None
    next_audience_date: Optional[date] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Documents ────────────────────────────────────────────────────────────────

class DisputeDocumentResponse(BaseModel):
    id: int
    dispute_id: int
    filename: str
    file_size: int
    mime_type: str
    uploaded_by_id: int
    uploaded_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Notifications config ────────────────────────────────────────────────────

class DisputeNotificationsConfigUpdate(BaseModel):
    reminder_days_before: Optional[List[int]] = None
    notify_rh: Optional[bool] = None
    notify_juriste: Optional[bool] = None
    notify_dg: Optional[bool] = None
    notify_manager: Optional[bool] = None


class DisputeNotificationsConfigResponse(BaseModel):
    id: int
    tenant_id: int
    reminder_days_before: List[int]
    notify_rh: bool
    notify_juriste: bool
    notify_dg: bool
    notify_manager: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Forward references
LaborDisputeDetailResponse.model_rebuild()
