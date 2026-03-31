from pydantic import BaseModel, field_validator
from typing import Optional, List, Union
from datetime import date, datetime
from decimal import Decimal


# ==================== LEAVE TYPE ====================

class LeaveTypeBase(BaseModel):
    """Base pour LeaveType"""
    name: str
    code: str
    description: Optional[str] = None
    default_days: int = 0
    accrual_rate: float = 2.0
    max_carryover: Optional[int] = None
    is_annual: bool = False
    is_system: bool = False
    is_paid: bool = True
    requires_justification: bool = False
    requires_approval: bool = True
    max_consecutive_days: Optional[int] = None
    min_notice_days: int = 0
    color: str = "#10B981"


class LeaveTypeCreate(LeaveTypeBase):
    """Création d'un type de congé"""
    pass


class LeaveTypeUpdate(BaseModel):
    """Mise à jour d'un type de congé"""
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    default_days: Optional[int] = None
    accrual_rate: Optional[float] = None
    max_carryover: Optional[int] = None
    is_annual: Optional[bool] = None
    is_system: Optional[bool] = None
    is_paid: Optional[bool] = None
    requires_justification: Optional[bool] = None
    requires_approval: Optional[bool] = None
    max_consecutive_days: Optional[int] = None
    min_notice_days: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class LeaveTypeResponse(BaseModel):
    """Réponse LeaveType"""
    id: int
    tenant_id: Union[int, str]
    name: str
    code: str
    description: Optional[str] = None
    default_days: int = 0
    accrual_rate: Optional[float] = 2.0
    max_carryover: Optional[int] = None
    is_annual: bool = False
    is_system: bool = False
    is_paid: bool = True
    requires_justification: bool = False
    requires_approval: bool = True
    max_consecutive_days: Optional[int] = None
    min_notice_days: int = 0
    color: str = "#10B981"
    is_active: Optional[bool] = True

    class Config:
        from_attributes = True


# ==================== LEAVE BALANCE ====================

class LeaveBalanceResponse(BaseModel):
    """Réponse solde de congés"""
    id: int
    employee_id: int
    leave_type_id: int
    leave_type_name: Optional[str] = None
    leave_type_code: Optional[str] = None
    year: int
    initial_balance: Optional[Decimal] = Decimal("0")
    allocated: Decimal
    taken: Decimal
    pending: Decimal
    carried_over: Decimal
    accrual_rate: Optional[float] = 0
    months_elapsed: Optional[int] = 0
    accrued_this_year: Optional[float] = 0
    available: float

    class Config:
        from_attributes = True


class LeaveBalanceInitialize(BaseModel):
    """Saisie du solde initial par RH"""
    leave_type_id: int
    year: int
    initial_balance: float


class LeaveBalanceUpdate(BaseModel):
    """Mise à jour d'un solde"""
    allocated: Optional[float] = None
    carried_over: Optional[float] = None


class LeaveBalanceSummary(BaseModel):
    """Résumé des soldes de congés d'un employé"""
    employee_id: int
    employee_name: str
    year: int
    balances: List[LeaveBalanceResponse]
    total_available: float
    total_taken: float
    total_pending: float


# ==================== LEAVE REQUEST ====================

class LeaveRequestCreate(BaseModel):
    """Création d'une demande de congé (par l'employé)"""
    leave_type_id: int
    start_date: date
    end_date: date
    start_half_day: bool = False
    end_half_day: bool = False
    reason: Optional[str] = None


class LeaveRequestUpdate(BaseModel):
    """Mise à jour d'une demande (brouillon)"""
    leave_type_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_half_day: Optional[bool] = None
    end_half_day: Optional[bool] = None
    reason: Optional[str] = None


class LeaveRequestApprove(BaseModel):
    """Approbation d'une demande (par manager/RH)"""
    approved: bool
    rejection_reason: Optional[str] = None


class LeaveRequestResponse(BaseModel):
    """Réponse demande de congé"""
    id: int
    tenant_id: Union[int, str]
    employee_id: int
    employee_name: Optional[str] = None
    leave_type_id: int
    leave_type_name: Optional[str] = None
    leave_type_code: Optional[str] = None
    start_date: date
    end_date: date
    days_requested: Decimal
    start_half_day: bool
    end_half_day: bool
    reason: Optional[str] = None
    status: str
    approved_by_id: Optional[int] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    attachment_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeaveRequestListResponse(BaseModel):
    """Liste paginée de demandes"""
    items: List[LeaveRequestResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==================== LEAVE CALENDAR ====================

class LeaveCalendarEntry(BaseModel):
    """Entrée du calendrier des congés"""
    employee_id: int
    employee_name: str
    department: Optional[str] = None
    leave_type: str
    start_date: date
    end_date: date
    days: float
    status: str


class LeaveCalendarResponse(BaseModel):
    """Calendrier des congés"""
    period_start: date
    period_end: date
    entries: List[LeaveCalendarEntry]
    total_on_leave: int


# ==================== LEAVE STATS ====================

class LeaveStatsByType(BaseModel):
    """Stats par type de congé"""
    name: str
    count: int
    days: float


class LeaveStatsResponse(BaseModel):
    """Statistiques globales des congés"""
    year: int
    pending_requests: int
    on_leave_today: int
    total_requests: int
    approved_requests: int
    total_days_taken: float
    by_type: List[LeaveStatsByType]
