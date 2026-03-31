from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime
from decimal import Decimal


# ==================== ATTENDANCE RECORD ====================

class AttendanceRecordBase(BaseModel):
    """Base pour AttendanceRecord"""
    employee_id: int
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    status: str = "present"
    notes: Optional[str] = None


class AttendanceRecordCreate(AttendanceRecordBase):
    """Création manuelle d'un pointage"""
    pass


class AttendanceRecordUpdate(BaseModel):
    """Mise à jour d'un pointage"""
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    hours_worked: Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AttendanceRecordResponse(BaseModel):
    """Réponse pointage"""
    id: int
    tenant_id: str
    employee_id: int
    employee_name: Optional[str] = None
    date: date
    check_in: Optional[time]
    check_out: Optional[time]
    break_start: Optional[time]
    break_end: Optional[time]
    hours_worked: Optional[Decimal]
    overtime_hours: Optional[Decimal]
    status: str
    source: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== ATTENDANCE IMPORT ====================

class AttendanceImportMapping(BaseModel):
    """Mapping des colonnes Excel pour import"""
    employee_column: str  # Colonne matricule ou email
    employee_match_by: str = "email"  # email ou employee_number
    date_column: str
    date_format: str = "%Y-%m-%d"  # Format de date dans le fichier
    check_in_column: Optional[str] = None
    check_out_column: Optional[str] = None
    status_column: Optional[str] = None


class AttendanceImportRequest(BaseModel):
    """Requête d'import"""
    mapping: AttendanceImportMapping
    skip_header: bool = True
    sheet_name: Optional[str] = None  # Pour Excel multi-feuilles


class AttendanceImportResponse(BaseModel):
    """Réponse import"""
    id: int
    tenant_id: str
    filename: str
    total_rows: int
    imported_rows: int
    failed_rows: int
    period_start: Optional[date]
    period_end: Optional[date]
    status: str
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AttendanceImportError(BaseModel):
    """Erreur d'import détaillée"""
    row_number: int
    error: str
    data: Optional[dict] = None


class AttendanceImportResult(BaseModel):
    """Résultat détaillé d'un import"""
    import_id: int
    status: str
    total_rows: int
    imported_rows: int
    failed_rows: int
    errors: List[AttendanceImportError]


# ==================== ATTENDANCE STATS ====================

class AttendanceStats(BaseModel):
    """Statistiques de pointage"""
    period_start: date
    period_end: date
    total_employees: int
    total_days: int
    present_days: int
    absent_days: int
    late_days: int
    remote_days: int
    attendance_rate: float
    absenteeism_rate: float
    average_hours_per_day: float


class EmployeeAttendanceStats(BaseModel):
    """Stats de pointage par employé"""
    employee_id: int
    employee_name: str
    department: Optional[str]
    present_days: int
    absent_days: int
    late_days: int
    total_hours: Decimal
    overtime_hours: Decimal
    attendance_rate: float


# ==================== EXCEL TEMPLATE ====================

class AttendanceTemplateColumn(BaseModel):
    """Colonne du template Excel"""
    name: str
    description: str
    required: bool
    example: str


class AttendanceTemplateResponse(BaseModel):
    """Template Excel pour import"""
    columns: List[AttendanceTemplateColumn]
    download_url: str
