# app/schemas/daily_checklist.py

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime

VALID_DAYS = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}


class ChecklistItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: str = "medium"
    days_of_week: List[str] = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    objective_id: Optional[int] = None
    key_result_id: Optional[int] = None
    kr_contribution: Optional[float] = Field(None, gt=0)
    order: int = 0

    @field_validator("days_of_week")
    @classmethod
    def validate_days(cls, v: List[str]) -> List[str]:
        invalid = [d for d in v if d.lower() not in VALID_DAYS]
        if invalid:
            raise ValueError(f"Jours invalides: {invalid}")
        if not v:
            raise ValueError("Au moins un jour requis")
        return [d.lower() for d in v]

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in {"low", "medium", "high", "urgent"}:
            raise ValueError("Priorité invalide")
        return v


class ChecklistItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    priority: Optional[str] = None
    days_of_week: Optional[List[str]] = None
    objective_id: Optional[int] = None
    key_result_id: Optional[int] = None
    kr_contribution: Optional[float] = Field(None, gt=0)
    order: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("days_of_week")
    @classmethod
    def validate_days(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        invalid = [d for d in v if d.lower() not in VALID_DAYS]
        if invalid:
            raise ValueError(f"Jours invalides: {invalid}")
        if not v:
            raise ValueError("Au moins un jour requis")
        return [d.lower() for d in v]


class ChecklistItemResponse(BaseModel):
    id: int
    tenant_id: int
    employee_id: int
    employee_name: Optional[str] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    title: str
    description: Optional[str]
    priority: str
    days_of_week: List[str]
    objective_id: Optional[int]
    objective_title: Optional[str] = None
    key_result_id: Optional[int]
    key_result_title: Optional[str] = None
    kr_contribution: Optional[float]
    order: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChecklistTodayItem(BaseModel):
    item_id: int
    task_id: Optional[int]
    title: str
    description: Optional[str]
    priority: str
    objective_id: Optional[int]
    key_result_id: Optional[int]
    kr_contribution: Optional[float]
    status: str  # pending / in_progress / completed / cancelled
    completed_at: Optional[datetime]


class DailyChecklistTodayResponse(BaseModel):
    date: str
    day_name: str
    items: List[ChecklistTodayItem]
    total: int
    completed: int
    completion_rate: float


class InjectResult(BaseModel):
    injected: int
    skipped: int
    errors: int
