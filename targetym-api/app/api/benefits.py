# =============================================
# API ROUTES - Avantages employés
# File: app/api/benefits.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.benefit import EmployeeBenefit
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/benefits", tags=["Benefits - Avantages employés"])

# =============================================
# SCHEMAS
# =============================================

RH_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RH]


class BenefitCreate(BaseModel):
    employee_id: int
    label: str = Field(..., min_length=1, max_length=200)
    category: str = "autre"
    amount: Optional[float] = None
    currency: str = "XOF"
    frequency: str = "mensuel"
    start_date: Optional[str] = None   # ISO date string
    end_date: Optional[str] = None
    status: str = "actif"
    notes: Optional[str] = None


class BenefitUpdate(BaseModel):
    label: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class BenefitResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    label: str
    category: str
    amount: Optional[float] = None
    currency: str
    frequency: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BenefitListResponse(BaseModel):
    items: List[BenefitResponse]
    total: int


# =============================================
# HELPERS
# =============================================

def _benefit_to_response(b: EmployeeBenefit, db: Session) -> BenefitResponse:
    emp = db.query(Employee).filter(Employee.id == b.employee_id).first()
    emp_name = f"{emp.first_name} {emp.last_name}" if emp else None

    creator = db.query(Employee).filter(Employee.id == b.created_by_id).first() if b.created_by_id else None
    creator_name = f"{creator.first_name} {creator.last_name}" if creator else None

    return BenefitResponse(
        id=b.id,
        employee_id=b.employee_id,
        employee_name=emp_name,
        label=b.label,
        category=b.category,
        amount=float(b.amount) if b.amount is not None else None,
        currency=b.currency,
        frequency=b.frequency,
        start_date=b.start_date.isoformat() if b.start_date else None,
        end_date=b.end_date.isoformat() if b.end_date else None,
        status=b.status or "actif",
        notes=b.notes,
        created_by_id=b.created_by_id,
        created_by=creator_name,
        created_at=b.created_at,
    )


# =============================================
# ROUTES
# =============================================

@router.get("", response_model=BenefitListResponse)
@router.get("/", response_model=BenefitListResponse, include_in_schema=False)
def list_benefits(
    employee_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste des avantages. RH/Admin voit tout, Employé voit les siens."""
    query = db.query(EmployeeBenefit).filter(EmployeeBenefit.tenant_id == current_user.tenant_id)

    if current_user.role not in RH_ROLES:
        # Employé / Manager : uniquement ses propres avantages
        if not current_user.employee_id:
            return BenefitListResponse(items=[], total=0)
        query = query.filter(EmployeeBenefit.employee_id == current_user.employee_id)
    else:
        if employee_id:
            query = query.filter(EmployeeBenefit.employee_id == employee_id)

    if category:
        query = query.filter(EmployeeBenefit.category == category)
    if status:
        query = query.filter(EmployeeBenefit.status == status)
    if search:
        query = query.filter(EmployeeBenefit.label.ilike(f"%{search}%"))

    total = query.count()
    benefits = query.order_by(desc(EmployeeBenefit.created_at)).offset(skip).limit(limit).all()

    return BenefitListResponse(
        items=[_benefit_to_response(b, db) for b in benefits],
        total=total,
    )


@router.get("/employee/{employee_id}", response_model=BenefitListResponse)
def get_employee_benefits(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Avantages d'un employé spécifique (utilisé par EmployeeModal)."""
    # Vérification accès
    if current_user.role == UserRole.EMPLOYEE:
        if current_user.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    elif current_user.role == UserRole.MANAGER:
        emp = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == current_user.tenant_id,
            Employee.manager_id == current_user.employee_id,
        ).first()
        if not emp and current_user.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Cet employé n'est pas dans votre équipe")
    elif current_user.role not in RH_ROLES:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    benefits = db.query(EmployeeBenefit).filter(
        EmployeeBenefit.tenant_id == current_user.tenant_id,
        EmployeeBenefit.employee_id == employee_id,
    ).order_by(desc(EmployeeBenefit.created_at)).all()

    return BenefitListResponse(
        items=[_benefit_to_response(b, db) for b in benefits],
        total=len(benefits),
    )


@router.post("", response_model=BenefitResponse)
@router.post("/", response_model=BenefitResponse, include_in_schema=False)
def create_benefit(
    payload: BenefitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Créer un avantage. RH/Admin uniquement."""
    if current_user.role not in RH_ROLES:
        raise HTTPException(status_code=403, detail="Réservé aux RH / Admin")

    # Vérifier que l'employé appartient au même tenant
    emp = db.query(Employee).filter(
        Employee.id == payload.employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    benefit = EmployeeBenefit(
        tenant_id=current_user.tenant_id,
        employee_id=payload.employee_id,
        label=payload.label,
        category=payload.category,
        amount=payload.amount,
        currency=payload.currency,
        frequency=payload.frequency,
        start_date=date.fromisoformat(payload.start_date) if payload.start_date else None,
        end_date=date.fromisoformat(payload.end_date) if payload.end_date else None,
        status=payload.status,
        notes=payload.notes,
        created_by_id=current_user.employee_id,
    )
    db.add(benefit)
    db.commit()
    db.refresh(benefit)
    return _benefit_to_response(benefit, db)


@router.put("/{benefit_id}", response_model=BenefitResponse)
def update_benefit(
    benefit_id: int,
    payload: BenefitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Modifier un avantage. RH/Admin uniquement."""
    if current_user.role not in RH_ROLES:
        raise HTTPException(status_code=403, detail="Réservé aux RH / Admin")

    benefit = db.query(EmployeeBenefit).filter(
        EmployeeBenefit.id == benefit_id,
        EmployeeBenefit.tenant_id == current_user.tenant_id,
    ).first()
    if not benefit:
        raise HTTPException(status_code=404, detail="Avantage introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "start_date" and value:
            setattr(benefit, field, date.fromisoformat(value))
        elif field == "end_date" and value:
            setattr(benefit, field, date.fromisoformat(value))
        else:
            setattr(benefit, field, value)

    db.commit()
    db.refresh(benefit)
    return _benefit_to_response(benefit, db)


@router.delete("/{benefit_id}")
def delete_benefit(
    benefit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprimer un avantage. RH/Admin uniquement."""
    if current_user.role not in RH_ROLES:
        raise HTTPException(status_code=403, detail="Réservé aux RH / Admin")

    benefit = db.query(EmployeeBenefit).filter(
        EmployeeBenefit.id == benefit_id,
        EmployeeBenefit.tenant_id == current_user.tenant_id,
    ).first()
    if not benefit:
        raise HTTPException(status_code=404, detail="Avantage introuvable")

    db.delete(benefit)
    db.commit()
    return {"success": True, "message": "Avantage supprimé"}
