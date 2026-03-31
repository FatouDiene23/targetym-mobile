from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.api.deps import get_db, get_current_tenant, get_current_user
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus, EmployeeRole
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveRequestStatus
from app.schemas.leave import (
    LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeResponse,
    LeaveBalanceResponse, LeaveBalanceSummary, LeaveBalanceInitialize,
    LeaveRequestCreate, LeaveRequestUpdate, LeaveRequestApprove, LeaveRequestResponse,
    LeaveRequestListResponse, LeaveCalendarEntry, LeaveCalendarResponse
)

router = APIRouter(prefix="/api/leaves", tags=["Congés"])


# ==================== HELPERS ====================

def calculate_working_days(start_date: date, end_date: date, start_half: bool = False, end_half: bool = False) -> float:
    """Calcule le nombre de jours ouvrés entre deux dates"""
    if start_date > end_date:
        return 0
    
    days = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:
            days += 1
        current += timedelta(days=1)
    
    if start_half and days > 0:
        days -= 0.5
    if end_half and days > 0:
        days -= 0.5
    
    return max(0, days)


def update_employee_leave_status(employee_id: int, tenant_id: int, db: Session):
    """
    Met à jour le statut de l'employé en fonction de ses congés approuvés.
    - Si un congé approuvé couvre aujourd'hui → on_leave
    - Sinon → active (si était on_leave)
    """
    today = date.today()
    
    active_leave = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant_id,
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today
    ).first()
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant_id
    ).first()
    
    if not employee:
        return
    
    if active_leave:
        if employee.status != EmployeeStatus.ON_LEAVE.value:
            employee.status = EmployeeStatus.ON_LEAVE.value
    else:
        if employee.status == EmployeeStatus.ON_LEAVE.value:
            employee.status = EmployeeStatus.ACTIVE.value


def leave_request_to_response(request: LeaveRequest, db: Session) -> dict:
    """Convertit une LeaveRequest en dict pour la réponse"""
    data = {
        "id": request.id,
        "tenant_id": str(request.tenant_id),
        "employee_id": request.employee_id,
        "leave_type_id": request.leave_type_id,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "days_requested": request.days_requested,
        "start_half_day": request.start_half_day,
        "end_half_day": request.end_half_day,
        "reason": request.reason,
        "status": request.status,
        "approved_by_id": request.approved_by_id,
        "approved_at": request.approved_at,
        "rejection_reason": request.rejection_reason,
        "attachment_url": getattr(request, 'attachment_url', None),
        "created_at": request.created_at,
        "updated_at": request.updated_at,
    }
    
    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if employee:
        data["employee_name"] = f"{employee.first_name} {employee.last_name}"
        dept_name = employee.department.name if hasattr(employee, 'department') and employee.department else None
        data["department"] = dept_name
        data["department_name"] = dept_name
        data["job_title"] = employee.job_title
        
        if employee.manager_id:
            manager = db.query(Employee).filter(Employee.id == employee.manager_id).first()
            if manager:
                data["manager_name"] = f"{manager.first_name} {manager.last_name}"
    
    leave_type = db.query(LeaveType).filter(LeaveType.id == request.leave_type_id).first()
    if leave_type:
        data["leave_type_name"] = leave_type.name
        data["leave_type_code"] = leave_type.code
    
    if employee:
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == employee.id,
            LeaveBalance.leave_type_id == request.leave_type_id,
            LeaveBalance.year == request.start_date.year
        ).first()
        if balance:
            data["leave_balance"] = balance.available
    
    if request.approved_by_id:
        approver = db.query(User).filter(User.id == request.approved_by_id).first()
        if approver:
            data["approved_by_name"] = approver.full_name
    
    return data


def resolve_target_tenant_id(
    db: Session,
    current_user: User,
    tenant: Tenant,
    subsidiary_tenant_id: Optional[int],
) -> int:
    """Résout le tenant cible pour la vue filiale d'un groupe."""
    if not subsidiary_tenant_id:
        return tenant.id

    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
        employee = db.query(Employee).filter(
            Employee.id == current_user.employee_id,
            Employee.tenant_id == tenant.id,
        ).first()
        if not employee or employee.role != EmployeeRole.dg:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")

    sub = db.query(Tenant).filter(
        Tenant.id == subsidiary_tenant_id,
        Tenant.parent_tenant_id == tenant.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=403, detail="Filiale non autorisée ou introuvable")

    return sub.id


# ==================== LEAVE TYPES ====================

@router.get("/types", response_model=List[LeaveTypeResponse])
async def get_leave_types(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
):
    query = db.query(LeaveType).filter(LeaveType.tenant_id == tenant.id)
    if active_only:
        query = query.filter(LeaveType.is_active.is_not(False))
    return query.order_by(LeaveType.name).all()


@router.post("/types", response_model=LeaveTypeResponse)
async def create_leave_type(
    data: LeaveTypeCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(LeaveType).filter(
        LeaveType.tenant_id == tenant.id,
        LeaveType.code == data.code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Le code '{data.code}' existe déjà")
    
    leave_type = LeaveType(tenant_id=tenant.id, **data.model_dump())
    db.add(leave_type)
    db.commit()
    db.refresh(leave_type)
    return leave_type


@router.put("/types/{type_id}", response_model=LeaveTypeResponse)
async def update_leave_type(
    type_id: int,
    data: LeaveTypeUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    leave_type = db.query(LeaveType).filter(
        LeaveType.id == type_id,
        LeaveType.tenant_id == tenant.id
    ).first()
    
    if not leave_type:
        raise HTTPException(status_code=404, detail="Type de congé non trouvé")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(leave_type, field, value)
    
    db.commit()
    db.refresh(leave_type)
    return leave_type


@router.delete("/types/{type_id}")
async def delete_leave_type(
    type_id: int,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    leave_type = db.query(LeaveType).filter(
        LeaveType.id == type_id,
        LeaveType.tenant_id == tenant.id
    ).first()
    
    if not leave_type:
        raise HTTPException(status_code=404, detail="Type de congé non trouvé")
    
    leave_type.is_active = False
    db.commit()
    return {"message": "Type de congé désactivé"}


# ==================== LEAVE BALANCES ====================

@router.get("/balances/{employee_id}", response_model=LeaveBalanceSummary)
async def get_employee_balances(
    employee_id: int,
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
):
    if year is None:
        year = date.today().year
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    balances = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == tenant.id,
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.year == year
    ).all()
    
    balance_list = []
    total_available = 0
    total_taken = 0
    total_pending = 0
    
    for balance in balances:
        leave_type = db.query(LeaveType).filter(LeaveType.id == balance.leave_type_id).first()

        # Calcul acquis mensuel — en tenant compte du mois de début d'acquisition
        is_annual = leave_type.is_annual if leave_type else False
        accrual_rate = float(leave_type.accrual_rate or 2.0) if leave_type else 0
        today = date.today()
        if is_annual:
            balance_year = balance.year or today.year
            if balance_year == today.year:
                start_month = balance.accrual_start_month or 1
                months_elapsed = max(0, today.month - start_month + 1)
            elif balance_year < today.year:
                months_elapsed = 12
            else:
                months_elapsed = 0
        else:
            months_elapsed = 0
        accrued_this_year = accrual_rate * months_elapsed if is_annual else 0
        available = balance.available

        balance_list.append({
            "id": balance.id,
            "employee_id": balance.employee_id,
            "leave_type_id": balance.leave_type_id,
            "leave_type_name": leave_type.name if leave_type else None,
            "leave_type_code": leave_type.code if leave_type else None,
            "year": balance.year,
            "initial_balance": balance.initial_balance,
            "allocated": balance.allocated,
            "taken": balance.taken,
            "pending": balance.pending,
            "carried_over": balance.carried_over,
            "accrual_rate": accrual_rate if is_annual else 0,
            "months_elapsed": months_elapsed if is_annual else 0,
            "accrued_this_year": accrued_this_year,
            "available": available
        })

        total_available += available
        total_taken += float(balance.taken or 0)
        total_pending += float(balance.pending or 0)
    
    return {
        "employee_id": employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "year": year,
        "balances": balance_list,
        "total_available": total_available,
        "total_taken": total_taken,
        "total_pending": total_pending
    }


@router.post("/balances/initialize/{employee_id}")
async def initialize_employee_balances(
    employee_id: int,
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    if year is None:
        year = date.today().year
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    leave_types = db.query(LeaveType).filter(
        LeaveType.tenant_id == tenant.id,
        LeaveType.is_active == True
    ).all()

    # Détermine le mois de début d'acquisition selon la date d'embauche
    hire_date = employee.hire_date
    if hire_date and hasattr(hire_date, 'year') and hire_date.year == year:
        accrual_start_month = hire_date.month
    else:
        accrual_start_month = 1  # Employé existant : acquért depuis janvier

    created = 0
    for leave_type in leave_types:
        existing = db.query(LeaveBalance).filter(
            LeaveBalance.tenant_id == tenant.id,
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type.id,
            LeaveBalance.year == year
        ).first()
        
        if not existing:
            balance = LeaveBalance(
                tenant_id=tenant.id,
                employee_id=employee_id,
                leave_type_id=leave_type.id,
                year=year,
                initial_balance=Decimal("0"),
                allocated=Decimal(str(leave_type.default_days)),
                taken=Decimal("0"),
                pending=Decimal("0"),
                carried_over=Decimal("0"),
                accrual_start_month=accrual_start_month if leave_type.is_annual else 1
            )
            db.add(balance)
            created += 1
    
    db.commit()
    return {"message": f"{created} soldes créés pour l'année {year}"}


@router.post("/balances/initialize-all")
async def initialize_all_balances(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    if year is None:
        year = date.today().year

    employees = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.status == EmployeeStatus.ACTIVE
    ).all()

    leave_types = db.query(LeaveType).filter(
        LeaveType.tenant_id == tenant.id,
        LeaveType.is_active == True
    ).all()

    total_created = 0
    for employee in employees:
        # Détermine accrual_start_month selon hire_date
        hire_date = employee.hire_date
        if hire_date and hasattr(hire_date, 'year') and hire_date.year == year:
            emp_accrual_start = hire_date.month
        else:
            emp_accrual_start = 1

        for leave_type in leave_types:
            existing = db.query(LeaveBalance).filter(
                LeaveBalance.tenant_id == tenant.id,
                LeaveBalance.employee_id == employee.id,
                LeaveBalance.leave_type_id == leave_type.id,
                LeaveBalance.year == year
            ).first()

            if not existing:
                balance = LeaveBalance(
                    tenant_id=tenant.id,
                    employee_id=employee.id,
                    leave_type_id=leave_type.id,
                    year=year,
                    initial_balance=Decimal("0"),
                    allocated=Decimal(str(leave_type.default_days)),
                    taken=Decimal("0"),
                    pending=Decimal("0"),
                    carried_over=Decimal("0"),
                    accrual_start_month=emp_accrual_start if leave_type.is_annual else 1
                )
                db.add(balance)
                total_created += 1

    db.commit()
    return {
        "message": f"{total_created} soldes créés pour l'année {year}",
        "employees_count": len(employees),
        "year": year
    }


@router.put("/balances/{balance_id}")
async def update_balance(
    balance_id: int,
    allocated: Optional[float] = Query(None),
    carried_over: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.id == balance_id,
        LeaveBalance.tenant_id == tenant.id
    ).first()
    
    if not balance:
        raise HTTPException(status_code=404, detail="Solde non trouvé")
    
    if allocated is not None:
        balance.allocated = Decimal(str(allocated))
    if carried_over is not None:
        balance.carried_over = Decimal(str(carried_over))
    
    db.commit()
    db.refresh(balance)
    return {"message": "Solde mis à jour"}


@router.post("/balance/year-end-rollover")
async def year_end_rollover(
    year: int = Query(..., description="Année à clôturer (ex: 2025)"),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    """Report automatique des soldes de l'année N vers N+1 — Admin/RH uniquement."""
    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé Admin/RH")

    next_year = year + 1

    # Tous les employés actifs du tenant
    employees = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.status == EmployeeStatus.ACTIVE.value
    ).all()

    processed = 0
    for employee in employees:
        balances = db.query(LeaveBalance).filter(
            LeaveBalance.tenant_id == tenant.id,
            LeaveBalance.employee_id == employee.id,
            LeaveBalance.year == year
        ).all()

        for balance in balances:
            leave_type = db.query(LeaveType).filter(LeaveType.id == balance.leave_type_id).first()
            if not leave_type:
                continue

            available = balance.available
            max_carry = leave_type.max_carryover
            carried = min(available, max_carry) if max_carry is not None else available
            carried = max(0, carried)

            # Vérifier si le solde N+1 existe déjà
            existing = db.query(LeaveBalance).filter(
                LeaveBalance.tenant_id == tenant.id,
                LeaveBalance.employee_id == employee.id,
                LeaveBalance.leave_type_id == balance.leave_type_id,
                LeaveBalance.year == next_year
            ).first()

            if existing:
                existing.carried_over = Decimal(str(carried))
                existing.accrual_start_month = 1  # Emp existant en N+1 : démarre depuis janvier
            else:
                new_balance = LeaveBalance(
                    tenant_id=tenant.id,
                    employee_id=employee.id,
                    leave_type_id=balance.leave_type_id,
                    year=next_year,
                    initial_balance=Decimal("0"),
                    allocated=Decimal(str(leave_type.default_days)),
                    taken=Decimal("0"),
                    pending=Decimal("0"),
                    carried_over=Decimal(str(carried)),
                    accrual_start_month=1  # Employé existant : acquért depuis janvier
                )
                db.add(new_balance)

        processed += 1

    db.commit()
    return {
        "message": f"Report {year} → {next_year} effectué",
        "employees_processed": processed,
        "year_closed": year,
        "year_opened": next_year
    }


@router.post("/balance/{employee_id}/initialize")
async def initialize_balance(
    employee_id: int,
    data: LeaveBalanceInitialize,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    """Saisie ou mise à jour du solde initial — Admin/RH uniquement."""
    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé Admin/RH")

    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    leave_type = db.query(LeaveType).filter(
        LeaveType.id == data.leave_type_id,
        LeaveType.tenant_id == tenant.id
    ).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Type de congé non trouvé")

    balance = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == tenant.id,
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.leave_type_id == data.leave_type_id,
        LeaveBalance.year == data.year
    ).first()

    if balance:
        balance.initial_balance = Decimal(str(data.initial_balance))
    else:
        balance = LeaveBalance(
            tenant_id=tenant.id,
            employee_id=employee_id,
            leave_type_id=data.leave_type_id,
            year=data.year,
            initial_balance=Decimal(str(data.initial_balance)),
            allocated=Decimal(str(leave_type.default_days)),
            taken=Decimal("0"),
            pending=Decimal("0"),
            carried_over=Decimal("0")
        )
        db.add(balance)

    db.commit()
    db.refresh(balance)
    return {
        "message": f"Solde initial de {data.initial_balance} j défini pour {employee.first_name} {employee.last_name}",
        "balance_id": balance.id,
        "initial_balance": float(balance.initial_balance),
        "available": balance.available
    }


@router.post("/balances/year-reset")
async def year_reset_balances(
    year: int = Query(..., description="Année à réinitialiser (ex: 2026)"),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    """Réinitialisation manuelle : remet carried_over et initial_balance à 0 pour tous les employés (année donnée). Admin/RH uniquement."""
    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé Admin/RH")

    updated = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == tenant.id,
        LeaveBalance.year == year
    ).update({
        LeaveBalance.carried_over: Decimal("0"),
        LeaveBalance.initial_balance: Decimal("0")
    }, synchronize_session=False)
    db.commit()
    return {
        "message": f"Soldes de l'année {year} réinitialisés",
        "balances_reset": updated,
        "year": year
    }

@router.get("/requests", response_model=LeaveRequestListResponse)
async def get_leave_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    leave_type_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    target_tenant_id = resolve_target_tenant_id(db, current_user, tenant, subsidiary_tenant_id)
    query = db.query(LeaveRequest).filter(LeaveRequest.tenant_id == target_tenant_id)
    
    if status:
        query = query.filter(LeaveRequest.status == status)
    if employee_id:
        query = query.filter(LeaveRequest.employee_id == employee_id)
    if department_id:
        query = query.join(Employee).filter(Employee.department_id == department_id)
    if leave_type_id:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)
    if start_date:
        query = query.filter(LeaveRequest.start_date >= start_date)
    if end_date:
        query = query.filter(LeaveRequest.end_date <= end_date)
    
    total = query.count()
    offset = (page - 1) * page_size
    requests = query.order_by(LeaveRequest.created_at.desc()).offset(offset).limit(page_size).all()
    items = [leave_request_to_response(req, db) for req in requests]
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/requests/pending", response_model=List[LeaveRequestResponse])
async def get_pending_requests(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
):
    requests = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.PENDING.value
    ).order_by(LeaveRequest.created_at.asc()).all()
    
    return [leave_request_to_response(req, db) for req in requests]


@router.get("/requests/{request_id}", response_model=LeaveRequestResponse)
async def get_leave_request(
    request_id: int,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
):
    request = db.query(LeaveRequest).filter(
        LeaveRequest.id == request_id,
        LeaveRequest.tenant_id == tenant.id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    return leave_request_to_response(request, db)


@router.post("/requests", response_model=LeaveRequestResponse)
async def create_leave_request(
    data: LeaveRequestCreate,
    employee_id: int = Query(...),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    leave_type = db.query(LeaveType).filter(
        LeaveType.id == data.leave_type_id,
        LeaveType.tenant_id == tenant.id,
        LeaveType.is_active == True
    ).first()
    
    if not leave_type:
        raise HTTPException(status_code=404, detail="Type de congé non trouvé ou inactif")
    
    days = calculate_working_days(data.start_date, data.end_date, data.start_half_day, data.end_half_day)
    
    if days <= 0:
        raise HTTPException(status_code=400, detail="La période sélectionnée ne contient aucun jour ouvré")
    
    year = data.start_date.year
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == tenant.id,
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.leave_type_id == data.leave_type_id,
        LeaveBalance.year == year
    ).first()
    
    if balance:
        if days > balance.available:
            raise HTTPException(
                status_code=400,
                detail=f"Solde insuffisant. Disponible: {balance.available} jours, Demandé: {days} jours"
            )
    
    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.status.in_([LeaveRequestStatus.PENDING.value, LeaveRequestStatus.APPROVED.value]),
        or_(
            and_(LeaveRequest.start_date <= data.start_date, LeaveRequest.end_date >= data.start_date),
            and_(LeaveRequest.start_date <= data.end_date, LeaveRequest.end_date >= data.end_date),
            and_(LeaveRequest.start_date >= data.start_date, LeaveRequest.end_date <= data.end_date)
        )
    ).first()
    
    if overlap:
        raise HTTPException(
            status_code=400,
            detail=f"Cette période chevauche une demande existante ({overlap.start_date} - {overlap.end_date})"
        )
    
    leave_request = LeaveRequest(
        tenant_id=tenant.id,
        employee_id=employee_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        days_requested=Decimal(str(days)),
        start_half_day=data.start_half_day,
        end_half_day=data.end_half_day,
        reason=data.reason,
        status=LeaveRequestStatus.PENDING.value
    )
    
    db.add(leave_request)

    if balance:
        balance.pending = Decimal(str(float(balance.pending or 0) + days))

    db.commit()
    db.refresh(leave_request)

    # Email au manager
    try:
        from app.services.email_service import send_leave_request_manager_email
        if employee.manager_id:
            manager = db.query(Employee).filter(Employee.id == employee.manager_id).first()
            if manager and manager.email:
                leave_type_obj = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()
                send_leave_request_manager_email(
                    to_email=manager.email,
                    manager_first_name=manager.first_name,
                    employee_name=f"{employee.first_name} {employee.last_name}",
                    leave_type=leave_type_obj.name if leave_type_obj else "Congé",
                    start_date=str(data.start_date),
                    end_date=str(data.end_date),
                    days=days,
                    reason=data.reason,
                )
    except Exception as e:
        print(f"⚠️ Email demande congé manager non envoyé: {e}")

    # Notification in-app aux admins/RH/DG
    try:
        from app.services.notification_service import notify_leave_created
        notify_leave_created(db, tenant.id, employee, leave_request, leave_type.name)
    except Exception as e:
        print(f"⚠️ Notification congé non envoyée: {e}")

    return leave_request_to_response(leave_request, db)


@router.put("/requests/{request_id}", response_model=LeaveRequestResponse)
async def update_leave_request(
    request_id: int,
    data: LeaveRequestUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    request = db.query(LeaveRequest).filter(
        LeaveRequest.id == request_id,
        LeaveRequest.tenant_id == tenant.id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if request.status != LeaveRequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Seules les demandes en attente peuvent être modifiées")
    
    old_days = float(request.days_requested)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request, field, value)
    
    if 'start_date' in update_data or 'end_date' in update_data:
        new_days = calculate_working_days(
            request.start_date, 
            request.end_date, 
            request.start_half_day, 
            request.end_half_day
        )
        request.days_requested = Decimal(str(new_days))
        
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.tenant_id == tenant.id,
            LeaveBalance.employee_id == request.employee_id,
            LeaveBalance.leave_type_id == request.leave_type_id,
            LeaveBalance.year == request.start_date.year
        ).first()
        
        if balance:
            balance.pending = Decimal(str(float(balance.pending or 0) - old_days + new_days))
    
    db.commit()
    db.refresh(request)
    return leave_request_to_response(request, db)


@router.post("/requests/{request_id}/approve", response_model=LeaveRequestResponse)
async def approve_leave_request(
    request_id: int,
    data: LeaveRequestApprove,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    """Approuver ou refuser une demande de congé"""
    request = db.query(LeaveRequest).filter(
        LeaveRequest.id == request_id,
        LeaveRequest.tenant_id == tenant.id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if request.status != LeaveRequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée")
    
    days = float(request.days_requested)
    
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == tenant.id,
        LeaveBalance.employee_id == request.employee_id,
        LeaveBalance.leave_type_id == request.leave_type_id,
        LeaveBalance.year == request.start_date.year
    ).first()
    
    if data.approved:
        request.status = LeaveRequestStatus.APPROVED.value
        request.approved_by_id = current_user.id
        request.approved_at = datetime.utcnow()

        if balance:
            balance.pending = Decimal(str(max(0, float(balance.pending or 0) - days)))
            balance.taken = Decimal(str(float(balance.taken or 0) + days))

        update_employee_leave_status(request.employee_id, tenant.id, db)

        try:
            from app.services.sync_hooks import sync_leave_approved
            sync_leave_approved(db, tenant.id, request)
        except Exception:
            pass
    else:
        request.status = LeaveRequestStatus.REJECTED.value
        request.approved_by_id = current_user.id
        request.approved_at = datetime.utcnow()
        request.rejection_reason = data.rejection_reason

        if balance:
            balance.pending = Decimal(str(max(0, float(balance.pending or 0) - days)))

    db.commit()
    db.refresh(request)

    # Email à l'employé
    try:
        from app.services.email_service import send_leave_decision_email
        emp = db.query(Employee).filter(Employee.id == request.employee_id).first()
        leave_type_obj = db.query(LeaveType).filter(LeaveType.id == request.leave_type_id).first()
        if emp and emp.email:
            send_leave_decision_email(
                to_email=emp.email,
                first_name=emp.first_name,
                approved=data.approved,
                leave_type=leave_type_obj.name if leave_type_obj else "Congé",
                start_date=str(request.start_date),
                end_date=str(request.end_date),
                days=float(request.days_requested),
                rejection_reason=data.rejection_reason if not data.approved else None,
            )
    except Exception as e:
        print(f"⚠️ Email décision congé non envoyé: {e}")

    # Notification in-app à l'employé
    try:
        from app.services.notification_service import notify_leave_decision
        notify_leave_decision(
            db, tenant.id, request,
            approved=data.approved,
            rejection_reason=data.rejection_reason if not data.approved else None
        )
    except Exception as e:
        print(f"⚠️ Notification décision congé non envoyée: {e}")

    return leave_request_to_response(request, db)


@router.post("/requests/{request_id}/cancel", response_model=LeaveRequestResponse)
async def cancel_leave_request(
    request_id: int,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    request = db.query(LeaveRequest).filter(
        LeaveRequest.id == request_id,
        LeaveRequest.tenant_id == tenant.id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if request.status not in [LeaveRequestStatus.PENDING.value, LeaveRequestStatus.APPROVED.value]:
        raise HTTPException(status_code=400, detail="Cette demande ne peut pas être annulée")
    
    days = float(request.days_requested)
    old_status = request.status
    
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == tenant.id,
        LeaveBalance.employee_id == request.employee_id,
        LeaveBalance.leave_type_id == request.leave_type_id,
        LeaveBalance.year == request.start_date.year
    ).first()
    
    request.status = LeaveRequestStatus.CANCELLED.value
    
    if balance:
        if old_status == LeaveRequestStatus.PENDING.value:
            balance.pending = Decimal(str(max(0, float(balance.pending or 0) - days)))
        elif old_status == LeaveRequestStatus.APPROVED.value:
            balance.taken = Decimal(str(max(0, float(balance.taken or 0) - days)))
    
    update_employee_leave_status(request.employee_id, tenant.id, db)
    
    db.commit()
    db.refresh(request)
    
    return leave_request_to_response(request, db)


@router.delete("/requests/{request_id}")
async def delete_leave_request(
    request_id: int,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    request = db.query(LeaveRequest).filter(
        LeaveRequest.id == request_id,
        LeaveRequest.tenant_id == tenant.id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if request.status not in [LeaveRequestStatus.DRAFT.value, LeaveRequestStatus.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Seules les demandes en brouillon ou annulées peuvent être supprimées")
    
    db.delete(request)
    db.commit()
    
    return {"message": "Demande supprimée"}


# ==================== CALENDAR ====================

@router.get("/calendar", response_model=LeaveCalendarResponse)
async def get_leave_calendar(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
):
    query = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date <= end_date,
        LeaveRequest.end_date >= start_date
    )
    
    if department_id:
        query = query.join(Employee).filter(Employee.department_id == department_id)
    
    requests = query.all()
    
    entries = []
    for req in requests:
        employee = db.query(Employee).filter(Employee.id == req.employee_id).first()
        leave_type = db.query(LeaveType).filter(LeaveType.id == req.leave_type_id).first()
        
        entries.append({
            "employee_id": req.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name}" if employee else "Inconnu",
            "department": employee.department.name if employee and hasattr(employee, 'department') and employee.department else None,
            "leave_type": leave_type.name if leave_type else "Inconnu",
            "start_date": req.start_date,
            "end_date": req.end_date,
            "days": float(req.days_requested),
            "status": req.status
        })
    
    today = date.today()
    on_leave_today = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today
    ).count()
    
    return {
        "period_start": start_date,
        "period_end": end_date,
        "entries": entries,
        "total_on_leave": on_leave_today
    }


# ==================== STATS ====================

@router.get("/stats")
async def get_leave_stats(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
):
    if year is None:
        year = date.today().year
    
    today = date.today()
    
    pending_count = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.PENDING.value
    ).count()
    
    on_leave_today = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today
    ).count()
    
    total_requests = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.start_date >= date(year, 1, 1),
        LeaveRequest.start_date <= date(year, 12, 31)
    ).count()
    
    approved_requests = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date >= date(year, 1, 1),
        LeaveRequest.start_date <= date(year, 12, 31)
    ).count()
    
    total_days_taken = db.query(func.sum(LeaveRequest.days_requested)).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date >= date(year, 1, 1),
        LeaveRequest.start_date <= date(year, 12, 31)
    ).scalar() or 0
    
    by_type = db.query(
        LeaveType.name,
        func.count(LeaveRequest.id).label('count'),
        func.sum(LeaveRequest.days_requested).label('days')
    ).join(LeaveRequest, LeaveRequest.leave_type_id == LeaveType.id).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date >= date(year, 1, 1),
        LeaveRequest.start_date <= date(year, 12, 31)
    ).group_by(LeaveType.name).all()
    
    return {
        "year": year,
        "pending_requests": pending_count,
        "on_leave_today": on_leave_today,
        "total_requests": total_requests,
        "approved_requests": approved_requests,
        "total_days_taken": float(total_days_taken),
        "by_type": [
            {"name": name, "count": count, "days": float(days or 0)}
            for name, count, days in by_type
        ]
    }


# ==================== SYNC CRON JOB ====================

@router.post("/sync-employee-status")
async def sync_all_employee_leave_status(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user)
):
    """
    Synchronise le statut de tous les employés en fonction de leurs congés.
    À appeler quotidiennement via un CRON job.
    """
    today = date.today()
    
    employees = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.status.in_([EmployeeStatus.ACTIVE.value, EmployeeStatus.ON_LEAVE.value])
    ).all()
    
    updated_count = 0
    for employee in employees:
        active_leave = db.query(LeaveRequest).filter(
            LeaveRequest.tenant_id == tenant.id,
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today
        ).first()
        
        if active_leave and employee.status != EmployeeStatus.ON_LEAVE.value:
            employee.status = EmployeeStatus.ON_LEAVE.value
            updated_count += 1
        elif not active_leave and employee.status == EmployeeStatus.ON_LEAVE.value:
            employee.status = EmployeeStatus.ACTIVE.value
            updated_count += 1
    
    db.commit()
    
    return {
        "message": f"{updated_count} statuts d'employés mis à jour",
        "date": today.isoformat()
    }


# Alias: /balance/{employee_id} → même logique que /balances/{employee_id}
@router.get("/balance/{employee_id}")
async def get_employee_balance(
    employee_id: int,
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
):
    """Alias pour /balances/{employee_id} — utilisé par le profil collaborateur."""
    return await get_employee_balances(employee_id, year=year, db=db, tenant=tenant)