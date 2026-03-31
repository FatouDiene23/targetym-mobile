# app/schemas/compensation.py
"""
Schemas Pydantic pour le module Compensation & Benefits
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


# ============================================
# ENUMS
# ============================================

class IpeCriterionEnum(str, Enum):
    impact = "impact"
    communication = "communication"
    innovation = "innovation"
    knowledge = "knowledge"


class CbConformityStatusEnum(str, Enum):
    conforme = "conforme"
    a_reviser = "a_reviser"
    bloquant = "bloquant"
    non_evalue = "non_evalue"


class SimulationStatusEnum(str, Enum):
    brouillon = "brouillon"
    soumis = "soumis"
    approuve = "approuve"
    rejete = "rejete"


class SimulationPolicyEnum(str, Enum):
    uniforme = "uniforme"
    anciennete = "anciennete"
    categorie = "categorie"


# ============================================
# TENANT CONFIG
# ============================================

class CbTenantConfigCreate(BaseModel):
    default_currency: str = Field("XOF", max_length=10)
    default_country: Optional[str] = Field(None, max_length=10)
    active_agreement_ids: Optional[List[int]] = None
    reminder_days_before_cc_update: int = Field(30, ge=1, le=365)
    workflow_approver_id: Optional[int] = None


class CbTenantConfigUpdate(BaseModel):
    default_currency: Optional[str] = Field(None, max_length=10)
    default_country: Optional[str] = Field(None, max_length=10)
    active_agreement_ids: Optional[List[int]] = None
    reminder_days_before_cc_update: Optional[int] = Field(None, ge=1, le=365)
    workflow_approver_id: Optional[int] = None


class CbTenantConfigResponse(BaseModel):
    id: int
    tenant_id: int
    default_currency: str
    default_country: Optional[str] = None
    active_agreement_ids: Optional[List[int]] = None
    reminder_days_before_cc_update: int
    workflow_approver_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# IPE CRITERIA
# ============================================

class CbIpeCriteriaCreate(BaseModel):
    criterion: IpeCriterionEnum
    label: str = Field(..., min_length=1, max_length=255)
    levels: List[Dict[str, Any]]
    weight: float = Field(..., ge=0, le=100)
    is_active: bool = True


class CbIpeCriteriaUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=255)
    levels: Optional[List[Dict[str, Any]]] = None
    weight: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class CbIpeCriteriaResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    criterion: str
    label: str
    levels: List[Dict[str, Any]]
    weight: float
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# JOB EVALUATIONS
# ============================================

class CbJobEvaluationCreate(BaseModel):
    job_id: Optional[int] = None
    job_title: Optional[str] = Field(None, max_length=255)
    job_family: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=10)
    scores: Dict[str, int]
    mercer_band: Optional[str] = Field(None, max_length=20)
    market_p25: Optional[float] = None
    market_p50: Optional[float] = None
    market_p75: Optional[float] = None
    currency: Optional[str] = Field(None, max_length=10)


class CbJobEvaluationUpdate(BaseModel):
    job_id: Optional[int] = None
    job_title: Optional[str] = Field(None, max_length=255)
    job_family: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=10)
    scores: Optional[Dict[str, int]] = None
    mercer_band: Optional[str] = Field(None, max_length=20)
    market_p25: Optional[float] = None
    market_p50: Optional[float] = None
    market_p75: Optional[float] = None
    currency: Optional[str] = Field(None, max_length=10)


class CbJobEvaluationResponse(BaseModel):
    id: int
    tenant_id: int
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    job_family: Optional[str] = None
    country: Optional[str] = None
    scores: Dict[str, int]
    total_score: int
    mercer_band: Optional[str] = None
    market_p25: Optional[float] = None
    market_p50: Optional[float] = None
    market_p75: Optional[float] = None
    currency: Optional[str] = None
    conformity_status: str
    evaluated_by_id: Optional[int] = None
    evaluated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Enriched
    salary_grid: Optional["CbSalaryGridResponse"] = None

    class Config:
        from_attributes = True


# ============================================
# COLLECTIVE AGREEMENTS
# ============================================

class CbCollectiveAgreementCreate(BaseModel):
    country: str = Field(..., max_length=10)
    sector: Optional[str] = Field(None, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    version: Optional[str] = Field(None, max_length=50)
    effective_date: date
    is_active: bool = True
    source_url: Optional[str] = Field(None, max_length=500)


class CbCollectiveAgreementUpdate(BaseModel):
    country: Optional[str] = Field(None, max_length=10)
    sector: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    version: Optional[str] = Field(None, max_length=50)
    effective_date: Optional[date] = None
    is_active: Optional[bool] = None
    source_url: Optional[str] = Field(None, max_length=500)


class CbCollectiveAgreementResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    country: str
    sector: Optional[str] = None
    name: str
    version: Optional[str] = None
    effective_date: date
    is_active: bool
    source_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# CC CATEGORIES
# ============================================

class CbCcCategoryCreate(BaseModel):
    category_code: str = Field(..., max_length=20)
    category_label: str = Field(..., min_length=1, max_length=255)
    min_salary: float = Field(..., ge=0)
    currency: str = Field(..., max_length=10)
    mercer_band_min: Optional[str] = Field(None, max_length=20)
    mercer_band_max: Optional[str] = Field(None, max_length=20)


class CbCcCategoryUpdate(BaseModel):
    category_code: Optional[str] = Field(None, max_length=20)
    category_label: Optional[str] = Field(None, min_length=1, max_length=255)
    min_salary: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=10)
    mercer_band_min: Optional[str] = Field(None, max_length=20)
    mercer_band_max: Optional[str] = Field(None, max_length=20)


class CbCcCategoryResponse(BaseModel):
    id: int
    agreement_id: int
    category_code: str
    category_label: str
    min_salary: float
    currency: str
    mercer_band_min: Optional[str] = None
    mercer_band_max: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# SALARY GRIDS
# ============================================

class CbSalaryGridResponse(BaseModel):
    id: int
    tenant_id: int
    evaluation_id: int
    cc_category_id: Optional[int] = None
    country: str
    currency: str
    min_salary: float
    mid_salary: float
    max_salary: float
    cc_minimum: Optional[float] = None
    conformity_status: str
    reconciliation_notes: Optional[str] = None
    generated_at: Optional[datetime] = None
    generated_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# SIMULATIONS
# ============================================

class CbSimulationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    budget_type: str = Field(..., max_length=20)
    budget_value: float = Field(..., ge=0)
    currency: str = Field(..., max_length=10)
    policy: SimulationPolicyEnum = SimulationPolicyEnum.uniforme
    scope_type: str = Field("all", max_length=20)
    scope_id: Optional[int] = None
    year: int


class CbSimulationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    notes: Optional[str] = None


class CbSimulationLineResponse(BaseModel):
    id: int
    tenant_id: int
    simulation_id: int
    employee_id: int
    current_salary: float
    proposed_increase_pct: float
    proposed_salary: float
    cc_minimum: Optional[float] = None
    conformity_status: str
    created_at: Optional[datetime] = None
    # Enriched
    employee_name: Optional[str] = None
    employee_job_title: Optional[str] = None

    class Config:
        from_attributes = True


class CbSimulationResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    budget_type: str
    budget_value: float
    currency: str
    policy: str
    scope_type: str
    scope_id: Optional[int] = None
    status: str
    year: int
    created_by_id: int
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Enriched
    lines: Optional[List[CbSimulationLineResponse]] = None
    lines_count: Optional[int] = None

    class Config:
        from_attributes = True


# ============================================
# RECONCILIATION
# ============================================

class ReconciliationResponse(BaseModel):
    evaluation_id: int
    conformity_status: str
    salary_grid: CbSalaryGridResponse
    cc_category: Optional[CbCcCategoryResponse] = None
    notes: str


# ============================================
# LIST RESPONSES (PAGINATION)
# ============================================

class CbJobEvaluationListResponse(BaseModel):
    items: List[CbJobEvaluationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CbSalaryGridListResponse(BaseModel):
    items: List[CbSalaryGridResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CbSimulationListResponse(BaseModel):
    items: List[CbSimulationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Resolve forward references
CbJobEvaluationResponse.model_rebuild()
