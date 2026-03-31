from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Employee, LeaveType, LeaveBalance, LeaveRequest, LeaveRequestStatus, UserRole
from app.schemas.leave import (
    LeaveTypeCreate,
    LeaveTypeUpdate,
    LeaveTypeResponse,
    LeaveBalanceResponse,
    LeaveRequestCreate,
    LeaveRequestApprove,
    LeaveRequestResponse,
    LeaveCalendarEntry,
    LeaveCalendarResponse,
)

router = APIRouter(prefix="/leaves", tags=["Congés"])


# ==================== LEAVE TYPES ====================

@router.get("/types", response_model=List[LeaveTypeResponse])
async def list_leave_types(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des types de congés"""
    types = db.query(LeaveType).filter(
        LeaveType.tenant_id == current_user.tenant_id,
        LeaveType.is_active == True
    ).all()
    return types


@router.post("/types", response_model=LeaveTypeResponse)
async def create_leave_type(
    data: LeaveTypeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer un type de congé (RH/Admin)"""
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    leave_type = LeaveType(
        tenant_id=current_user.tenant_id,
        **data.model_dump()
    )
    db.add(leave_type)
    db.commit()
    db.refresh(leave_type)
    return leave_type


# ==================== LEAVE BALANCE ====================

@router.get("/balance", response_model=List[LeaveBalanceResponse])
async def get_my_balance(
    year: int = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupérer mon solde de congés"""
    if not current_user.employee_id:
        raise HTTPException(status_code=404, detail="Profil employé non trouvé")
    
    if not year:
        year = date.today().year
    
    balances = db.query(LeaveBalance).join(LeaveType).filter(
        LeaveBalance.tenant_id == current_user.tenant_id,
        LeaveBalance.employee_id == current_user.employee_id,
        LeaveBalance.year == year
    ).all()
    
    result = []
    for b in balances:
        result.append(LeaveBalanceResponse(
            id=b.id,
            employee_id=b.employee_id,
            leave_type_id=b.leave_type_id,
            leave_type_name=b.leave_type.name,
            leave_type_code=b.leave_type.code,
            year=b.year,
            allocated=b.allocated,
            taken=b.taken,
            pending=b.pending,
            carried_over=b.carried_over,
            available=b.available
        ))
    
    return result


@router.get("/balance/{employee_id}", response_model=List[LeaveBalanceResponse])
async def get_employee_balance(
    employee_id: int,
    year: int = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupérer le solde de congés d'un employé (Manager/RH)"""
    if current_user.role not in [UserRole.MANAGER.value, UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        if current_user.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Accès refusé")
    
    if not year:
        year = date.today().year
    
    balances = db.query(LeaveBalance).join(LeaveType).filter(
        LeaveBalance.tenant_id == current_user.tenant_id,
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.year == year
    ).all()
    
    result = []
    for b in balances:
        result.append(LeaveBalanceResponse(
            id=b.id,
            employee_id=b.employee_id,
            leave_type_id=b.leave_type_id,
            leave_type_name=b.leave_type.name,
            leave_type_code=b.leave_type.code,
            year=b.year,
            allocated=b.allocated,
            taken=b.taken,
            pending=b.pending,
            carried_over=b.carried_over,
            available=b.available
        ))
    
    return result


# ==================== LEAVE REQUESTS ====================

def calculate_days(start_date: date, end_date: date, start_half: bool, end_half: bool) -> Decimal:
    """Calculer le nombre de jours de congé"""
    days = (end_date - start_date).days + 1
    if start_half:
        days -= 0.5
    if end_half:
        days -= 0.5
    return Decimal(str(days))


@router.get("/requests", response_model=List[LeaveRequestResponse])
async def list_my_requests(
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste de mes demandes de congés"""
    if not current_user.employee_id:
        raise HTTPException(status_code=404, detail="Profil employé non trouvé")
    
    query = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == current_user.tenant_id,
        LeaveRequest.employee_id == current_user.employee_id
    )
    
    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter)
    
    requests = query.order_by(LeaveRequest.created_at.desc()).all()
    
    result = []
    for r in requests:
        result.append(LeaveRequestResponse(
            id=r.id,
            tenant_id=r.tenant_id,
            employee_id=r.employee_id,
            employee_name=r.employee.full_name if r.employee else None,
            leave_type_id=r.leave_type_id,
            leave_type_name=r.leave_type.name if r.leave_type else None,
            leave_type_code=r.leave_type.code if r.leave_type else None,
            start_date=r.start_date,
            end_date=r.end_date,
            days_requested=r.days_requested,
            start_half_day=r.start_half_day,
            end_half_day=r.end_half_day,
            reason=r.reason,
            status=r.status,
            approved_by_id=r.approved_by_id,
            approved_by_name=r.approved_by.full_name if r.approved_by else None,
            approved_at=r.approved_at,
            rejection_reason=r.rejection_reason,
            attachment_url=r.attachment_url,
            created_at=r.created_at,
            updated_at=r.updated_at
        ))
    
    return result


@router.get("/requests/pending", response_model=List[LeaveRequestResponse])
async def list_pending_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des demandes en attente (pour manager/RH)"""
    if current_user.role not in [UserRole.MANAGER.value, UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    query = db.query(LeaveRequest).join(Employee).filter(
        LeaveRequest.tenant_id == current_user.tenant_id,
        LeaveRequest.status == LeaveRequestStatus.PENDING.value
    )
    
    if current_user.role == UserRole.MANAGER.value and current_user.employee_id:
        query = query.filter(Employee.manager_id == current_user.employee_id)
    
    requests = query.order_by(LeaveRequest.created_at.asc()).all()
    
    result = []
    for r in requests:
        result.append(LeaveRequestResponse(
            id=r.id,
            tenant_id=r.tenant_id,
            employee_id=r.employee_id,
            employee_name=r.employee.full_name if r.employee else None,
            leave_type_id=r.leave_type_id,
            leave_type_name=r.leave_type.name if r.leave_type else None,
            leave_type_code=r.leave_type.code if r.leave_type else None,
            start_date=r.start_date,
            end_date=r.end_date,
            days_requested=r.days_requested,
            start_half_day=r.start_half_day,
            end_half_day=r.end_half_day,
            reason=r.reason,
            status=r.status,
            approved_by_id=r.approved_by_id,
            approved_by_name=r.approved_by.full_name if r.approved_by else None,
            approved_at=r.approved_at,
            rejection_reason=r.rejection_reason,
            attachment_url=r.attachment_url,
            created_at=r.created_at,
            updated_at=r.updated_at
        ))
    
    return result


@router.post("/requests", response_model=LeaveRequestResponse)
async def create_leave_request(
    data: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer une demande de congé"""
    if not current_user.employee_id:
        raise HTTPException(status_code=404, detail="Profil employé non trouvé")
    
    leave_type = db.query(LeaveType).filter(
        LeaveType.id == data.leave_type_id,
        LeaveType.tenant_id == current_user.tenant_id,
        LeaveType.is_active == True
    ).first()
    
    if not leave_type:
        raise HTTPException(status_code=404, detail="Type de congé non trouvé")
    
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="La date de fin doit être après la date de début")
    
    days = calculate_days(data.start_date, data.end_date, data.start_half_day, data.end_half_day)
    
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == current_user.tenant_id,
        LeaveBalance.employee_id == current_user.employee_id,
        LeaveBalance.leave_type_id == data.leave_type_id,
        LeaveBalance.year == data.start_date.year
    ).first()
    
    if balance and balance.available < float(days):
        raise HTTPException(
            status_code=400, 
            detail=f"Solde insuffisant. Disponible: {balance.available} jours, Demandé: {days} jours"
        )
    
    leave_request = LeaveRequest(
        tenant_id=current_user.tenant_id,
        employee_id=current_user.employee_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        days_requested=days,
        start_half_day=data.start_half_day,
        end_half_day=data.end_half_day,
        reason=data.reason,
        status=LeaveRequestStatus.PENDING.value
    )
    
    if balance:
        balance.pending = (balance.pending or 0) + days
    
    db.add(leave_request)
    db.commit()
    db.refresh(leave_request)
    
    return LeaveRequestResponse(
        id=leave_request.id,
        tenant_id=leave_request.tenant_id,
        employee_id=leave_request.employee_id,
        employee_name=leave_request.employee.full_name,
        leave_type_id=leave_request.leave_type_id,
        leave_type_name=leave_type.name,
        leave_type_code=leave_type.code,
        start_date=leave_request.start_date,
        end_date=leave_request.end_date,
        days_requested=leave_request.days_requested,
        start_half_day=leave_request.start_half_day,
        end_half_day=leave_request.end_half_day,
        reason=leave_request.reason,
        status=leave_request.status,
        approved_by_id=None,
        approved_at=None,
        rejection_reason=None,
        attachment_url=None,
        created_at=leave_request.created_at,
        updated_at=leave_request.updated_at
    )


@router.post("/requests/{request_id}/approve", response_model=LeaveRequestResponse)
async def approve_leave_request(
    request_id: int,
    data: LeaveRequestApprove,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approuver ou refuser une demande de congé"""
    if current_user.role not in [UserRole.MANAGER.value, UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    leave_request = db.query(LeaveRequest).filter(
        LeaveRequest.id == request_id,
        LeaveRequest.tenant_id == current_user.tenant_id
    ).first()
    
    if not leave_request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if leave_request.status != LeaveRequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée")
    
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.tenant_id == current_user.tenant_id,
        LeaveBalance.employee_id == leave_request.employee_id,
        LeaveBalance.leave_type_id == leave_request.leave_type_id,
        LeaveBalance.year == leave_request.start_date.year
    ).first()
    
    if data.approved:
        leave_request.status = LeaveRequestStatus.APPROVED.value
        leave_request.approved_by_id = current_user.id
        leave_request.approved_at = datetime.utcnow()
        
        if balance:
            balance.pending = (balance.pending or 0) - leave_request.days_requested
            balance.taken = (balance.taken or 0) + leave_request.days_requested
    else:
        leave_request.status = LeaveRequestStatus.REJECTED.value
        leave_request.approved_by_id = current_user.id
        leave_request.approved_at = datetime.utcnow()
        leave_request.rejection_reason = data.rejection_reason
        
        if balance:
            balance.pending = (balance.pending or 0) - leave_request.days_requested
    
    db.commit()
    db.refresh(leave_request)
    
    return LeaveRequestResponse(
        id=leave_request.id,
        tenant_id=leave_request.tenant_id,
        employee_id=leave_request.employee_id,
        employee_name=leave_request.employee.full_name,
        leave_type_id=leave_request.leave_type_id,
        leave_type_name=leave_request.leave_type.name,
        leave_type_code=leave_request.leave_type.code,
        start_date=leave_request.start_date,
        end_date=leave_request.end_date,
        days_requested=leave_request.days_requested,
        start_half_day=leave_request.start_half_day,
        end_half_day=leave_request.end_half_day,
        reason=leave_request.reason,
        status=leave_request.status,
        approved_by_id=leave_request.approved_by_id,
        approved_by_name=leave_request.approved_by.full_name if leave_request.approved_by else None,
        approved_at=leave_request.approved_at,
        rejection_reason=leave_request.rejection_reason,
        attachment_url=leave_request.attachment_url,
        created_at=leave_request.created_at,
        updated_at=leave_request.updated_at
    )


@router.delete("/requests/{request_id}")
async def cancel_leave_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Annuler une demande de congé (par l'employé)"""
    if not current_user.employee_id:
        raise HTTPException(status_code=404, detail="Profil employé non trouvé")
    
    leave_request = db.query(LeaveRequest).filter(
        LeaveRequest.id == request_id,
        LeaveRequest.tenant_id == current_user.tenant_id,
        LeaveRequest.employee_id == current_user.employee_id
    ).first()
    
    if not leave_request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if leave_request.status not in [LeaveRequestStatus.DRAFT.value, LeaveRequestStatus.PENDING.value]:
        raise HTTPException(status_code=400, detail="Impossible d'annuler cette demande")
    
    if leave_request.status == LeaveRequestStatus.PENDING.value:
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.tenant_id == current_user.tenant_id,
            LeaveBalance.employee_id == leave_request.employee_id,
            LeaveBalance.leave_type_id == leave_request.leave_type_id,
            LeaveBalance.year == leave_request.start_date.year
        ).first()
        
        if balance:
            balance.pending = (balance.pending or 0) - leave_request.days_requested
    
    leave_request.status = LeaveRequestStatus.CANCELLED.value
    db.commit()
    
    return {"message": "Demande annulée"}


# ==================== CALENDAR ====================

@router.get("/calendar", response_model=LeaveCalendarResponse)
async def get_leave_calendar(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calendrier des congés"""
    query = db.query(LeaveRequest).join(Employee).filter(
        LeaveRequest.tenant_id == current_user.tenant_id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        or_(
            and_(LeaveRequest.start_date >= start_date, LeaveRequest.start_date <= end_date),
            and_(LeaveRequest.end_date >= start_date, LeaveRequest.end_date <= end_date),
            and_(LeaveRequest.start_date <= start_date, LeaveRequest.end_date >= end_date)
        )
    )
    
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    
    requests = query.all()
    
    entries = []
    for r in requests:
        dept_name = r.employee.department.name if r.employee.department else None
        entries.append(LeaveCalendarEntry(
            employee_id=r.employee_id,
            employee_name=r.employee.full_name,
            department=dept_name,
            leave_type=r.leave_type.name,
            start_date=r.start_date,
            end_date=r.end_date,
            days=float(r.days_requested),
            status=r.status
        ))
    
    today = date.today()
    on_leave_today = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == current_user.tenant_id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today
    ).count()
    
    return LeaveCalendarResponse(
        period_start=start_date,
        period_end=end_date,
        entries=entries,
        total_on_leave=on_leave_today
    )


@router.get("/stats")
async def get_leave_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Statistiques des congés"""
    tenant_id = current_user.tenant_id
    today = date.today()
    
    on_leave = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant_id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
        LeaveRequest.start_date <= today,
        LeaveRequest.end_date >= today
    ).count()
    
    pending = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant_id,
        LeaveRequest.status == LeaveRequestStatus.PENDING.value
    ).count()
    
    first_of_month = today.replace(day=1)
    this_month = db.query(LeaveRequest).filter(
        LeaveRequest.tenant_id == tenant_id,
        LeaveRequest.created_at >= first_of_month
    ).count()
    
    return {
        "on_leave_today": on_leave,
        "pending_requests": pending,
        "requests_this_month": this_month
    }
