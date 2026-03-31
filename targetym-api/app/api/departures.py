# ============================================
# API: Gestion des Départs (Offboarding)
# Fichier: app/api/departures.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import date, datetime, timedelta
from pydantic import BaseModel
from io import BytesIO
import logging

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.employee import Employee, EmployeeStatus
from app.models.tenant import Tenant
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_DEPARTURES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/departures", tags=["Departures"], dependencies=[Depends(require_feature(FEATURE_DEPARTURES))])


# ============================================
# HELPERS
# ============================================

def get_user_role(current_user) -> str:
    role = getattr(current_user, 'role', None)
    if role:
        return role.lower() if isinstance(role, str) else str(role.value).lower()
    return "employee"

def is_hr_or_admin(role: str) -> bool:
    return role in ["rh", "admin", "dg", "dga", "drh", "superadmin", "super_admin"]

def is_manager_role(role: str) -> bool:
    return role in ["manager"] or is_hr_or_admin(role)

def create_notification(db: Session, tenant_id: int, user_id: int, employee_id: int,
                       title: str, message: str, notif_type: str,
                       reference_type: str = None, reference_id: int = None,
                       action_url: str = None, priority: str = 'normal'):
    try:
        db.execute(text("""
            INSERT INTO notifications (tenant_id, user_id, employee_id, title, message,
                type, priority, reference_type, reference_id, action_url)
            VALUES (:tenant_id, :user_id, :employee_id, :title, :message,
                :type, :priority, :reference_type, :reference_id, :action_url)
        """), {
            "tenant_id": tenant_id, "user_id": user_id, "employee_id": employee_id,
            "title": title, "message": message, "type": notif_type,
            "priority": priority, "reference_type": reference_type,
            "reference_id": reference_id, "action_url": action_url
        })
        db.commit()
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        db.rollback()

def calculate_notice_period(contract_type: str, hire_date: date, departure_type: str) -> int:
    """Calcule le préavis en jours selon le type de contrat et l'ancienneté."""
    if departure_type == "end_of_contract":
        return 0
    if contract_type and contract_type.lower() in ["cdd", "stage", "interim"]:
        return 0
    if hire_date:
        seniority_years = (date.today() - hire_date).days / 365.25
        if seniority_years < 1:
            return 30
        else:
            return 90
    return 30

def get_default_checklist_items() -> list:
    """Template par défaut de checklist offboarding."""
    return [
        {"title": "Restitution du matériel informatique (PC, écran, souris...)", "category": "equipment", "assigned_to": "it", "sort_order": 1},
        {"title": "Restitution des clés et badges d'accès", "category": "equipment", "assigned_to": "it", "sort_order": 2},
        {"title": "Révocation des accès aux systèmes et applications", "category": "access", "assigned_to": "it", "sort_order": 3},
        {"title": "Désactivation de l'adresse email et des comptes", "category": "access", "assigned_to": "it", "sort_order": 4},
        {"title": "Transfert des dossiers et projets en cours", "category": "knowledge", "assigned_to": "manager", "sort_order": 5},
        {"title": "Transfert des connaissances clés", "category": "knowledge", "assigned_to": "manager", "sort_order": 6},
        {"title": "Récupération des documents confidentiels", "category": "documents", "assigned_to": "rh", "sort_order": 7},
        {"title": "Signature du solde de tout compte", "category": "documents", "assigned_to": "rh", "sort_order": 8},
        {"title": "Remise du certificat de travail", "category": "documents", "assigned_to": "rh", "sort_order": 9},
        {"title": "Entretien de départ réalisé", "category": "hr", "assigned_to": "rh", "sort_order": 10},
        {"title": "Mise à jour de l'organigramme", "category": "hr", "assigned_to": "rh", "sort_order": 11},
        {"title": "Notification à l'équipe", "category": "hr", "assigned_to": "manager", "sort_order": 12},
    ]


# ============================================
# SCHEMAS Pydantic
# ============================================

class DepartureCreate(BaseModel):
    employee_id: int
    departure_type: str  # resignation, termination, mutual_agreement, retirement, end_of_contract, transfer
    reason: Optional[str] = None
    detailed_reason: Optional[str] = None
    legal_reason: Optional[str] = None
    requested_departure_date: date
    notification_date: Optional[date] = None

class DepartureUpdate(BaseModel):
    reason: Optional[str] = None
    detailed_reason: Optional[str] = None
    legal_reason: Optional[str] = None
    requested_departure_date: Optional[date] = None
    effective_date: Optional[date] = None
    last_working_day: Optional[date] = None

class ResignationCreate(BaseModel):
    reason: Optional[str] = None
    detailed_reason: Optional[str] = None
    requested_departure_date: date

class TeamDepartureCreate(BaseModel):
    employee_id: int
    departure_type: str  # NOT termination
    reason: Optional[str] = None
    detailed_reason: Optional[str] = None
    requested_departure_date: date

class ValidationPayload(BaseModel):
    comment: Optional[str] = None
    approved: bool = True

class ChecklistItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "general"
    assigned_to: str = "rh"
    is_required: bool = True

class ExitInterviewCreate(BaseModel):
    scheduled_date: date
    scheduled_time: Optional[str] = None
    interviewer_id: Optional[int] = None
    location: Optional[str] = None

class ExitInterviewUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    departure_reason_rating: Optional[int] = None
    management_rating: Optional[int] = None
    work_environment_rating: Optional[int] = None
    career_growth_rating: Optional[int] = None
    compensation_rating: Optional[int] = None
    primary_departure_reason: Optional[str] = None
    would_recommend: Optional[bool] = None
    would_return: Optional[bool] = None
    suggestions: Optional[str] = None
    positive_aspects: Optional[str] = None
    improvement_areas: Optional[str] = None
    additional_notes: Optional[str] = None


# ============================================
# DEPARTURES CRUD
# ============================================

@router.get("/stats")
def get_departure_stats(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stats globales des départs."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    tenant_id = current_user.tenant_id
    target_year = year or date.today().year

    # Stats par status
    stats_rows = db.execute(text("""
        SELECT status, COUNT(*) as count
        FROM departures
        WHERE tenant_id = :tid AND EXTRACT(YEAR FROM created_at) = :year
        GROUP BY status
    """), {"tid": tenant_id, "year": target_year}).fetchall()

    status_counts = {r[0]: r[1] for r in stats_rows}

    # Stats par type
    type_rows = db.execute(text("""
        SELECT departure_type, COUNT(*) as count
        FROM departures
        WHERE tenant_id = :tid AND EXTRACT(YEAR FROM created_at) = :year
        GROUP BY departure_type
    """), {"tid": tenant_id, "year": target_year}).fetchall()

    type_counts = [{"type": r[0], "count": r[1]} for r in type_rows]

    # Évolution mensuelle
    monthly_rows = db.execute(text("""
        SELECT EXTRACT(MONTH FROM notification_date) as month, COUNT(*) as count
        FROM departures
        WHERE tenant_id = :tid AND EXTRACT(YEAR FROM notification_date) = :year
        GROUP BY EXTRACT(MONTH FROM notification_date)
        ORDER BY month
    """), {"tid": tenant_id, "year": target_year}).fetchall()

    monthly = [{"month": int(r[0]), "count": r[1]} for r in monthly_rows]

    # Taux de turnover
    total_employees = db.execute(text("""
        SELECT COUNT(*) FROM employees WHERE tenant_id = :tid AND status::text != 'terminated'
    """), {"tid": tenant_id}).scalar() or 1

    total_departures_year = db.execute(text("""
        SELECT COUNT(*) FROM departures
        WHERE tenant_id = :tid AND EXTRACT(YEAR FROM created_at) = :year AND status IN ('completed', 'in_progress', 'validated')
    """), {"tid": tenant_id, "year": target_year}).scalar() or 0

    turnover_rate = round((total_departures_year / total_employees) * 100, 1)

    # Raisons principales (from exit interviews)
    reason_rows = db.execute(text("""
        SELECT ei.primary_departure_reason, COUNT(*) as count
        FROM exit_interviews ei
        JOIN departures d ON d.id = ei.departure_id
        WHERE d.tenant_id = :tid AND EXTRACT(YEAR FROM d.created_at) = :year
          AND ei.primary_departure_reason IS NOT NULL
        GROUP BY ei.primary_departure_reason
        ORDER BY count DESC
    """), {"tid": tenant_id, "year": target_year}).fetchall()

    reasons = [{"reason": r[0], "count": r[1]} for r in reason_rows]

    # Ancienneté moyenne des départs
    avg_seniority = db.execute(text("""
        SELECT AVG(EXTRACT(YEAR FROM AGE(d.effective_date, e.hire_date)))
        FROM departures d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.tenant_id = :tid AND EXTRACT(YEAR FROM d.created_at) = :year
          AND d.status = 'completed' AND e.hire_date IS NOT NULL AND d.effective_date IS NOT NULL
    """), {"tid": tenant_id, "year": target_year}).scalar()

    return {
        "year": target_year,
        "turnover_rate": turnover_rate,
        "total_departures": sum(status_counts.values()),
        "status_counts": status_counts,
        "by_type": type_counts,
        "monthly": monthly,
        "departure_reasons": reasons,
        "avg_seniority_years": round(float(avg_seniority), 1) if avg_seniority else 0,
        "total_active_employees": total_employees,
    }


@router.get("/")
def list_departures(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status: Optional[str] = None,
    departure_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste paginée des départs."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role) and role != "manager":
        raise HTTPException(403, "Accès réservé RH/Admin/Direction/Manager")

    tenant_id = current_user.tenant_id
    conditions = ["d.tenant_id = :tid"]
    params = {"tid": tenant_id}

    # Manager: only see their direct reports
    if role == "manager" and not is_hr_or_admin(role):
        conditions.append("e.manager_id = (SELECT id FROM employees WHERE id = (SELECT employee_id FROM users WHERE id = :uid))")
        params["uid"] = current_user.id

    if status:
        conditions.append("d.status = :status")
        params["status"] = status
    if departure_type:
        conditions.append("d.departure_type = :dtype")
        params["dtype"] = departure_type
    if search:
        conditions.append("(e.first_name ILIKE :search OR e.last_name ILIKE :search)")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM departures d
        JOIN employees e ON e.id = d.employee_id
        WHERE {where}
    """), params).scalar() or 0

    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    rows = db.execute(text(f"""
        SELECT d.*, e.first_name, e.last_name, e.job_title, e.photo_url, e.department_id,
               e.hire_date, e.contract_type, e.salary, e.currency,
               dep.name as department_name,
               (SELECT COUNT(*) FROM offboarding_checklist_items WHERE departure_id = d.id) as checklist_total,
               (SELECT COUNT(*) FROM offboarding_checklist_items WHERE departure_id = d.id AND is_completed = true) as checklist_done
        FROM departures d
        JOIN employees e ON e.id = d.employee_id
        LEFT JOIN departments dep ON dep.id = e.department_id
        WHERE {where}
        ORDER BY d.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": f"{r.first_name or ''} {r.last_name or ''}".strip(),
            "employee_job_title": r.job_title,
            "employee_photo_url": r.photo_url,
            "employee_department": r.department_name,
            "employee_hire_date": str(r.hire_date) if r.hire_date else None,
            "departure_type": r.departure_type,
            "reason": r.reason,
            "detailed_reason": r.detailed_reason,
            "legal_reason": r.legal_reason,
            "notification_date": str(r.notification_date) if r.notification_date else None,
            "requested_departure_date": str(r.requested_departure_date) if r.requested_departure_date else None,
            "notice_period_days": r.notice_period_days,
            "notice_end_date": str(r.notice_end_date) if r.notice_end_date else None,
            "effective_date": str(r.effective_date) if r.effective_date else None,
            "last_working_day": str(r.last_working_day) if r.last_working_day else None,
            "status": r.status,
            "leave_balance_days": float(r.leave_balance_days) if r.leave_balance_days else 0,
            "leave_compensation_amount": float(r.leave_compensation_amount) if r.leave_compensation_amount else 0,
            "initiated_by_role": r.initiated_by_role,
            "checklist_total": r.checklist_total,
            "checklist_done": r.checklist_done,
            "created_at": str(r.created_at) if r.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/my-resignation")
def get_my_resignation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupérer la démission en cours du collaborateur."""
    employee_id = current_user.employee_id
    if not employee_id:
        return {"departure": None}

    dep = db.execute(text("""
        SELECT d.*, e.first_name, e.last_name
        FROM departures d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.employee_id = :eid AND d.tenant_id = :tid
          AND d.departure_type = 'resignation' AND d.initiated_by_role = 'employee'
          AND d.status NOT IN ('completed', 'cancelled')
        ORDER BY d.id DESC LIMIT 1
    """), {"eid": employee_id, "tid": current_user.tenant_id}).fetchone()

    if not dep:
        return {"departure": None}

    return {"departure": {
        "id": dep.id, "status": dep.status, "reason": dep.reason,
        "notification_date": str(dep.notification_date) if dep.notification_date else None,
        "requested_departure_date": str(dep.requested_departure_date) if dep.requested_departure_date else None,
        "notice_period_days": dep.notice_period_days,
        "notice_end_date": str(dep.notice_end_date) if dep.notice_end_date else None,
        "effective_date": str(dep.effective_date) if dep.effective_date else None,
        "leave_balance_days": float(dep.leave_balance_days) if dep.leave_balance_days else 0,
        "leave_compensation_amount": float(dep.leave_compensation_amount) if dep.leave_compensation_amount else 0,
        "manager_validated_at": str(dep.manager_validated_at) if dep.manager_validated_at else None,
        "manager_comment": dep.manager_comment,
        "rh_validated_at": str(dep.rh_validated_at) if dep.rh_validated_at else None,
        "rh_comment": dep.rh_comment,
        "created_at": str(dep.created_at) if dep.created_at else None,
    }}


@router.get("/{departure_id}")
def get_departure(
    departure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Détail d'un départ avec checklist et entretien."""
    tenant_id = current_user.tenant_id

    dep = db.execute(text("""
        SELECT d.*, e.first_name, e.last_name, e.job_title, e.photo_url,
               e.department_id, e.hire_date, e.contract_type, e.salary, e.currency, e.email,
               dep.name as department_name
        FROM departures d
        JOIN employees e ON e.id = d.employee_id
        LEFT JOIN departments dep ON dep.id = e.department_id
        WHERE d.id = :did AND d.tenant_id = :tid
    """), {"did": departure_id, "tid": tenant_id}).fetchone()

    if not dep:
        raise HTTPException(404, "Départ non trouvé")

    # Checklist items
    checklist = db.execute(text("""
        SELECT * FROM offboarding_checklist_items
        WHERE departure_id = :did ORDER BY sort_order
    """), {"did": departure_id}).fetchall()

    checklist_items = [{
        "id": c.id, "title": c.title, "description": c.description,
        "category": c.category, "assigned_to": c.assigned_to,
        "is_completed": c.is_completed, "completed_by": c.completed_by,
        "completed_at": str(c.completed_at) if c.completed_at else None,
        "sort_order": c.sort_order, "is_required": c.is_required,
    } for c in checklist]

    # Exit interview
    interview = db.execute(text("""
        SELECT * FROM exit_interviews WHERE departure_id = :did
    """), {"did": departure_id}).fetchone()

    interview_data = None
    if interview:
        interview_data = {
            "id": interview.id,
            "scheduled_date": str(interview.scheduled_date) if interview.scheduled_date else None,
            "scheduled_time": interview.scheduled_time,
            "interviewer_id": interview.interviewer_id,
            "location": interview.location,
            "status": interview.status,
            "departure_reason_rating": interview.departure_reason_rating,
            "management_rating": interview.management_rating,
            "work_environment_rating": interview.work_environment_rating,
            "career_growth_rating": interview.career_growth_rating,
            "compensation_rating": interview.compensation_rating,
            "primary_departure_reason": interview.primary_departure_reason,
            "would_recommend": interview.would_recommend,
            "would_return": interview.would_return,
            "suggestions": interview.suggestions,
            "positive_aspects": interview.positive_aspects,
            "improvement_areas": interview.improvement_areas,
            "additional_notes": interview.additional_notes,
            "completed_at": str(interview.completed_at) if interview.completed_at else None,
        }

    return {
        "id": dep.id,
        "employee_id": dep.employee_id,
        "employee_name": f"{dep.first_name or ''} {dep.last_name or ''}".strip(),
        "employee_job_title": dep.job_title,
        "employee_photo_url": dep.photo_url,
        "employee_department": dep.department_name,
        "employee_hire_date": str(dep.hire_date) if dep.hire_date else None,
        "employee_email": dep.email,
        "employee_salary": float(dep.salary) if dep.salary else 0,
        "employee_currency": dep.currency or "XOF",
        "employee_contract_type": dep.contract_type,
        "departure_type": dep.departure_type,
        "reason": dep.reason,
        "detailed_reason": dep.detailed_reason,
        "legal_reason": dep.legal_reason,
        "notification_date": str(dep.notification_date) if dep.notification_date else None,
        "requested_departure_date": str(dep.requested_departure_date) if dep.requested_departure_date else None,
        "notice_period_days": dep.notice_period_days,
        "notice_end_date": str(dep.notice_end_date) if dep.notice_end_date else None,
        "effective_date": str(dep.effective_date) if dep.effective_date else None,
        "last_working_day": str(dep.last_working_day) if dep.last_working_day else None,
        "status": dep.status,
        "manager_validated_by": dep.manager_validated_by,
        "manager_validated_at": str(dep.manager_validated_at) if dep.manager_validated_at else None,
        "manager_comment": dep.manager_comment,
        "rh_validated_by": dep.rh_validated_by,
        "rh_validated_at": str(dep.rh_validated_at) if dep.rh_validated_at else None,
        "rh_comment": dep.rh_comment,
        "direction_validated_by": dep.direction_validated_by,
        "direction_validated_at": str(dep.direction_validated_at) if dep.direction_validated_at else None,
        "direction_comment": dep.direction_comment,
        "leave_balance_days": float(dep.leave_balance_days) if dep.leave_balance_days else 0,
        "leave_compensation_amount": float(dep.leave_compensation_amount) if dep.leave_compensation_amount else 0,
        "initiated_by": dep.initiated_by,
        "initiated_by_role": dep.initiated_by_role,
        "created_at": str(dep.created_at) if dep.created_at else None,
        "checklist": checklist_items,
        "exit_interview": interview_data,
    }


def _compute_leave_balance(db: Session, employee_id: int) -> dict:
    """Récupère le solde de congés restants."""
    current_year = date.today().year
    row = db.execute(text("""
        SELECT COALESCE(SUM(lb.allocated + lb.carried_over - lb.taken - lb.pending), 0) as total_remaining
        FROM leave_balances lb
        WHERE lb.employee_id = :eid AND lb.year = :year
    """), {"eid": employee_id, "year": current_year}).fetchone()
    return {"days": float(row.total_remaining) if row else 0}


def _create_departure_core(db, tenant_id, employee_id, departure_type, reason, detailed_reason,
                           legal_reason, requested_departure_date, notification_dt,
                           initiated_by, initiated_by_role):
    """Core logic for creating a departure."""
    # Validate employee
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == tenant_id
    ).first()
    if not employee:
        raise HTTPException(404, "Employé non trouvé")
    if employee.status == EmployeeStatus.TERMINATED:
        raise HTTPException(400, "Cet employé est déjà en statut terminé")

    # Check no active departure
    existing = db.execute(text("""
        SELECT id FROM departures
        WHERE employee_id = :eid AND tenant_id = :tid AND status NOT IN ('completed', 'cancelled')
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()
    if existing:
        raise HTTPException(400, "Un départ est déjà en cours pour cet employé")

    # Validate termination requires legal_reason
    if departure_type == "termination" and not legal_reason:
        raise HTTPException(400, "Le motif légal est obligatoire pour un licenciement")

    # Calculate notice period
    contract_type = employee.contract_type.value if employee.contract_type else None
    notice_days = calculate_notice_period(contract_type, employee.hire_date, departure_type)
    notice_end = notification_dt + timedelta(days=notice_days) if notice_days > 0 else requested_departure_date

    # Leave balance
    leave_info = _compute_leave_balance(db, employee_id)
    salary = float(employee.salary) if employee.salary else 0
    daily_rate = salary / 30 if salary > 0 else 0
    leave_compensation = round(leave_info["days"] * daily_rate, 2) if leave_info["days"] > 0 else 0

    # Determine initial status based on flow
    if initiated_by_role == "employee":
        initial_status = "pending_manager"
    elif initiated_by_role == "manager":
        initial_status = "pending_rh"
    else:  # rh/admin/dg
        if departure_type == "termination":
            initial_status = "pending_direction"
        else:
            initial_status = "validated"

    db.execute(text("""
        INSERT INTO departures (tenant_id, employee_id, departure_type, reason, detailed_reason,
            legal_reason, notification_date, requested_departure_date, notice_period_days,
            notice_end_date, effective_date, last_working_day, status,
            leave_balance_days, leave_compensation_amount, initiated_by, initiated_by_role)
        VALUES (:tid, :eid, :dtype, :reason, :detailed, :legal, :notif_date, :req_date,
            :notice_days, :notice_end, :eff_date, :last_day, :status,
            :leave_days, :leave_comp, :init_by, :init_role)
    """), {
        "tid": tenant_id, "eid": employee_id, "dtype": departure_type,
        "reason": reason, "detailed": detailed_reason, "legal": legal_reason,
        "notif_date": notification_dt, "req_date": requested_departure_date,
        "notice_days": notice_days, "notice_end": notice_end,
        "eff_date": notice_end, "last_day": notice_end,
        "status": initial_status,
        "leave_days": leave_info["days"], "leave_comp": leave_compensation,
        "init_by": initiated_by, "init_role": initiated_by_role,
    })
    db.commit()

    # Get created departure
    new_dep = db.execute(text("""
        SELECT id FROM departures WHERE employee_id = :eid AND tenant_id = :tid
        ORDER BY id DESC LIMIT 1
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()

    # If already validated (RH created non-termination), inject checklist
    if initial_status == "validated":
        _inject_default_checklist(db, new_dep.id)

    return {"id": new_dep.id, "status": initial_status, "notice_period_days": notice_days,
            "notice_end_date": str(notice_end), "leave_balance_days": leave_info["days"],
            "leave_compensation_amount": leave_compensation}


def _inject_default_checklist(db: Session, departure_id: int):
    """Inject default offboarding checklist items."""
    for item in get_default_checklist_items():
        db.execute(text("""
            INSERT INTO offboarding_checklist_items (departure_id, title, category, assigned_to, sort_order, is_required)
            VALUES (:did, :title, :cat, :assigned, :sort, true)
        """), {"did": departure_id, "title": item["title"], "cat": item["category"],
               "assigned": item["assigned_to"], "sort": item["sort_order"]})
    db.commit()


@router.post("/")
def create_departure(
    data: DepartureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer un départ (RH/Admin/DG — tous types)."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    return _create_departure_core(
        db, current_user.tenant_id, data.employee_id, data.departure_type,
        data.reason, data.detailed_reason, data.legal_reason,
        data.requested_departure_date,
        data.notification_date or date.today(),
        current_user.id, "rh"
    )


@router.post("/my-resignation")
def create_my_resignation(
    data: ResignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Self-service : soumettre sa démission."""
    employee = db.query(Employee).filter(
        Employee.id == current_user.employee_id, Employee.tenant_id == current_user.tenant_id
    ).first()
    if not employee:
        raise HTTPException(404, "Profil employé non trouvé")

    return _create_departure_core(
        db, current_user.tenant_id, employee.id, "resignation",
        data.reason, data.detailed_reason, None,
        data.requested_departure_date, date.today(),
        current_user.id, "employee"
    )


@router.post("/team")
def create_team_departure(
    data: TeamDepartureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manager initie un départ pour un direct report (sauf licenciement)."""
    role = get_user_role(current_user)
    if not is_manager_role(role):
        raise HTTPException(403, "Accès réservé aux managers")

    if data.departure_type == "termination":
        raise HTTPException(400, "Le licenciement ne peut être initié que par les RH/Direction")

    # Verify direct report
    manager_emp = db.query(Employee).filter(Employee.id == current_user.employee_id).first()
    if manager_emp:
        target = db.query(Employee).filter(
            Employee.id == data.employee_id, Employee.manager_id == manager_emp.id
        ).first()
        if not target and not is_hr_or_admin(role):
            raise HTTPException(403, "Cet employé n'est pas dans votre équipe")

    return _create_departure_core(
        db, current_user.tenant_id, data.employee_id, data.departure_type,
        data.reason, data.detailed_reason, None,
        data.requested_departure_date, date.today(),
        current_user.id, "manager"
    )


@router.put("/{departure_id}")
def update_departure(
    departure_id: int,
    data: DepartureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Modifier un départ."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    dep = db.execute(text("""
        SELECT * FROM departures WHERE id = :did AND tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Départ non trouvé")
    if dep.status in ("completed", "cancelled"):
        raise HTTPException(400, "Ce départ ne peut plus être modifié")

    updates = []
    params = {"did": departure_id}
    for field in ["reason", "detailed_reason", "legal_reason", "requested_departure_date", "effective_date", "last_working_day"]:
        val = getattr(data, field, None)
        if val is not None:
            updates.append(f"{field} = :{field}")
            params[field] = val if not isinstance(val, date) else val
    if updates:
        updates.append("updated_at = NOW()")
        db.execute(text(f"UPDATE departures SET {', '.join(updates)} WHERE id = :did"), params)
        db.commit()

    return {"message": "Départ mis à jour"}


# ============================================
# VALIDATION CHAIN
# ============================================

@router.post("/{departure_id}/validate-manager")
def validate_manager(
    departure_id: int,
    data: ValidationPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validation Manager N+1."""
    role = get_user_role(current_user)
    if not is_manager_role(role):
        raise HTTPException(403, "Accès réservé aux managers")

    dep = db.execute(text("""
        SELECT * FROM departures WHERE id = :did AND tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Départ non trouvé")
    if dep.status != "pending_manager":
        raise HTTPException(400, f"Ce départ n'est pas en attente de validation manager (statut: {dep.status})")

    if not data.approved:
        db.execute(text("""
            UPDATE departures SET status = 'cancelled', manager_validated_by = :uid,
            manager_validated_at = NOW(), manager_comment = :comment, updated_at = NOW()
            WHERE id = :did
        """), {"did": departure_id, "uid": current_user.id, "comment": data.comment})
        db.commit()
        return {"message": "Départ refusé par le manager", "status": "cancelled"}

    db.execute(text("""
        UPDATE departures SET status = 'pending_rh', manager_validated_by = :uid,
        manager_validated_at = NOW(), manager_comment = :comment, updated_at = NOW()
        WHERE id = :did
    """), {"did": departure_id, "uid": current_user.id, "comment": data.comment})
    db.commit()

    return {"message": "Validation manager effectuée", "status": "pending_rh"}


@router.post("/{departure_id}/validate-rh")
def validate_rh(
    departure_id: int,
    data: ValidationPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validation RH."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    dep = db.execute(text("""
        SELECT * FROM departures WHERE id = :did AND tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Départ non trouvé")
    if dep.status != "pending_rh":
        raise HTTPException(400, f"Ce départ n'est pas en attente de validation RH (statut: {dep.status})")

    if not data.approved:
        db.execute(text("""
            UPDATE departures SET status = 'cancelled', rh_validated_by = :uid,
            rh_validated_at = NOW(), rh_comment = :comment, updated_at = NOW()
            WHERE id = :did
        """), {"did": departure_id, "uid": current_user.id, "comment": data.comment})
        db.commit()
        return {"message": "Départ refusé par RH", "status": "cancelled"}

    db.execute(text("""
        UPDATE departures SET status = 'validated', rh_validated_by = :uid,
        rh_validated_at = NOW(), rh_comment = :comment, updated_at = NOW()
        WHERE id = :did
    """), {"did": departure_id, "uid": current_user.id, "comment": data.comment})
    db.commit()

    # Inject checklist on validation
    _inject_default_checklist(db, departure_id)

    # Notify employee
    emp = db.execute(text("SELECT id FROM employees WHERE id = (SELECT employee_id FROM departures WHERE id = :did)"),
                     {"did": departure_id}).fetchone()
    if emp:
        user = db.execute(text("SELECT id FROM users WHERE employee_id = :eid AND tenant_id = :tid"),
                          {"eid": emp.id, "tid": current_user.tenant_id}).fetchone()
        if user:
            create_notification(db, current_user.tenant_id, user.id, emp.id,
                              "Départ validé", "Votre procédure de départ a été validée par les RH.",
                              "departure", "departure", departure_id,
                              f"/dashboard/my-space/resignation")

    return {"message": "Validation RH effectuée, checklist injectée", "status": "validated"}


@router.post("/{departure_id}/validate-direction")
def validate_direction(
    departure_id: int,
    data: ValidationPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validation Direction (licenciement uniquement)."""
    role = get_user_role(current_user)
    if role not in ["dg", "dga", "admin", "superadmin", "super_admin"]:
        raise HTTPException(403, "Accès réservé à la Direction")

    dep = db.execute(text("""
        SELECT * FROM departures WHERE id = :did AND tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Départ non trouvé")
    if dep.status != "pending_direction":
        raise HTTPException(400, f"Ce départ n'est pas en attente de validation Direction (statut: {dep.status})")

    if not data.approved:
        db.execute(text("""
            UPDATE departures SET status = 'cancelled', direction_validated_by = :uid,
            direction_validated_at = NOW(), direction_comment = :comment, updated_at = NOW()
            WHERE id = :did
        """), {"did": departure_id, "uid": current_user.id, "comment": data.comment})
        db.commit()
        return {"message": "Licenciement refusé par la Direction", "status": "cancelled"}

    db.execute(text("""
        UPDATE departures SET status = 'validated', direction_validated_by = :uid,
        direction_validated_at = NOW(), direction_comment = :comment, updated_at = NOW()
        WHERE id = :did
    """), {"did": departure_id, "uid": current_user.id, "comment": data.comment})
    db.commit()

    _inject_default_checklist(db, departure_id)

    return {"message": "Validation Direction effectuée, checklist injectée", "status": "validated"}


@router.post("/{departure_id}/cancel")
def cancel_departure(
    departure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Annuler un départ."""
    dep = db.execute(text("""
        SELECT * FROM departures WHERE id = :did AND tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Départ non trouvé")
    if dep.status in ("completed",):
        raise HTTPException(400, "Un départ clôturé ne peut pas être annulé")

    # Employee can cancel their own resignation if still pending
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        if dep.initiated_by != current_user.id:
            raise HTTPException(403, "Vous ne pouvez annuler que votre propre démission")
        if dep.status not in ("draft", "pending_manager", "pending_rh"):
            raise HTTPException(400, "Cette démission ne peut plus être annulée à ce stade")

    db.execute(text("""
        UPDATE departures SET status = 'cancelled', updated_at = NOW() WHERE id = :did
    """), {"did": departure_id})
    db.commit()

    return {"message": "Départ annulé"}


@router.post("/{departure_id}/complete")
def complete_departure(
    departure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clôturer un départ → archiver employé."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    dep = db.execute(text("""
        SELECT * FROM departures WHERE id = :did AND tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Départ non trouvé")
    if dep.status not in ("validated", "in_progress"):
        raise HTTPException(400, "Le départ doit être validé avant la clôture")

    # Check required checklist items
    uncompleted = db.execute(text("""
        SELECT COUNT(*) FROM offboarding_checklist_items
        WHERE departure_id = :did AND is_required = true AND is_completed = false
    """), {"did": departure_id}).scalar() or 0

    if uncompleted > 0:
        raise HTTPException(400, f"Il reste {uncompleted} élément(s) requis non complété(s) dans la checklist")

    # Update departure
    effective = dep.effective_date or date.today()
    db.execute(text("""
        UPDATE departures SET status = 'completed', effective_date = :eff, updated_at = NOW()
        WHERE id = :did
    """), {"did": departure_id, "eff": effective})

    # Archive employee
    db.execute(text("""
        UPDATE employees SET status = 'terminated'::employeestatus, end_date = :end_date
        WHERE id = :eid AND tenant_id = :tid
    """), {"eid": dep.employee_id, "end_date": effective, "tid": current_user.tenant_id})

    db.commit()

    # Notify manager
    emp = db.query(Employee).filter(Employee.id == dep.employee_id).first()
    if emp and emp.manager_id:
        manager_user = db.execute(text("SELECT id FROM users WHERE employee_id = :mid AND tenant_id = :tid"),
                                  {"mid": emp.manager_id, "tid": current_user.tenant_id}).fetchone()
        if manager_user:
            create_notification(db, current_user.tenant_id, manager_user.id, emp.manager_id,
                              "Départ clôturé", f"Le départ de {emp.first_name} {emp.last_name} a été clôturé.",
                              "departure", "departure", departure_id,
                              "/dashboard/departures")

    return {"message": "Départ clôturé, employé archivé", "status": "completed"}


# ============================================
# CHECKLIST
# ============================================

@router.get("/{departure_id}/checklist")
def get_checklist(
    departure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Items de la checklist."""
    items = db.execute(text("""
        SELECT * FROM offboarding_checklist_items
        WHERE departure_id = :did ORDER BY sort_order
    """), {"did": departure_id}).fetchall()

    return [{
        "id": c.id, "title": c.title, "description": c.description,
        "category": c.category, "assigned_to": c.assigned_to,
        "is_completed": c.is_completed, "completed_by": c.completed_by,
        "completed_at": str(c.completed_at) if c.completed_at else None,
        "sort_order": c.sort_order, "is_required": c.is_required,
    } for c in items]


@router.put("/{departure_id}/checklist/{item_id}")
def toggle_checklist_item(
    departure_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle un item de la checklist."""
    item = db.execute(text("""
        SELECT * FROM offboarding_checklist_items WHERE id = :iid AND departure_id = :did
    """), {"iid": item_id, "did": departure_id}).fetchone()
    if not item:
        raise HTTPException(404, "Item non trouvé")

    new_completed = not item.is_completed
    db.execute(text("""
        UPDATE offboarding_checklist_items
        SET is_completed = :completed,
            completed_by = CASE WHEN :completed THEN :uid ELSE NULL END,
            completed_at = CASE WHEN :completed THEN NOW() ELSE NULL END
        WHERE id = :iid
    """), {"iid": item_id, "completed": new_completed, "uid": current_user.id})

    # Update departure status to in_progress if first item completed
    if new_completed:
        dep = db.execute(text("SELECT status FROM departures WHERE id = :did"), {"did": departure_id}).fetchone()
        if dep and dep.status == "validated":
            db.execute(text("UPDATE departures SET status = 'in_progress', updated_at = NOW() WHERE id = :did"),
                      {"did": departure_id})

    db.commit()
    return {"message": "Item mis à jour", "is_completed": new_completed}


@router.post("/{departure_id}/checklist")
def add_checklist_item(
    departure_id: int,
    data: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ajouter un item custom à la checklist."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    max_sort = db.execute(text("""
        SELECT COALESCE(MAX(sort_order), 0) FROM offboarding_checklist_items WHERE departure_id = :did
    """), {"did": departure_id}).scalar() or 0

    db.execute(text("""
        INSERT INTO offboarding_checklist_items (departure_id, title, description, category, assigned_to, sort_order, is_required)
        VALUES (:did, :title, :desc, :cat, :assigned, :sort, :req)
    """), {"did": departure_id, "title": data.title, "desc": data.description,
           "cat": data.category, "assigned": data.assigned_to,
           "sort": max_sort + 1, "req": data.is_required})
    db.commit()

    return {"message": "Item ajouté"}


@router.delete("/{departure_id}/checklist/{item_id}")
def delete_checklist_item(
    departure_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Supprimer un item de la checklist."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    db.execute(text("""
        DELETE FROM offboarding_checklist_items WHERE id = :iid AND departure_id = :did
    """), {"iid": item_id, "did": departure_id})
    db.commit()

    return {"message": "Item supprimé"}


# ============================================
# EXIT INTERVIEW
# ============================================

@router.get("/{departure_id}/exit-interview")
def get_exit_interview(
    departure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupérer l'entretien de départ."""
    interview = db.execute(text("""
        SELECT ei.*, u.first_name as interviewer_first_name, u.last_name as interviewer_last_name
        FROM exit_interviews ei
        LEFT JOIN users u ON u.id = ei.interviewer_id
        WHERE ei.departure_id = :did
    """), {"did": departure_id}).fetchone()

    if not interview:
        return None

    return {
        "id": interview.id,
        "scheduled_date": str(interview.scheduled_date) if interview.scheduled_date else None,
        "scheduled_time": interview.scheduled_time,
        "interviewer_id": interview.interviewer_id,
        "interviewer_name": f"{interview.interviewer_first_name or ''} {interview.interviewer_last_name or ''}".strip() if interview.interviewer_id else None,
        "location": interview.location,
        "status": interview.status,
        "departure_reason_rating": interview.departure_reason_rating,
        "management_rating": interview.management_rating,
        "work_environment_rating": interview.work_environment_rating,
        "career_growth_rating": interview.career_growth_rating,
        "compensation_rating": interview.compensation_rating,
        "primary_departure_reason": interview.primary_departure_reason,
        "would_recommend": interview.would_recommend,
        "would_return": interview.would_return,
        "suggestions": interview.suggestions,
        "positive_aspects": interview.positive_aspects,
        "improvement_areas": interview.improvement_areas,
        "additional_notes": interview.additional_notes,
        "completed_at": str(interview.completed_at) if interview.completed_at else None,
    }


@router.post("/{departure_id}/exit-interview")
def create_exit_interview(
    departure_id: int,
    data: ExitInterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Planifier un entretien de départ."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    existing = db.execute(text("SELECT id FROM exit_interviews WHERE departure_id = :did"),
                          {"did": departure_id}).fetchone()
    if existing:
        raise HTTPException(400, "Un entretien de départ existe déjà pour ce départ")

    db.execute(text("""
        INSERT INTO exit_interviews (departure_id, scheduled_date, scheduled_time, interviewer_id, location)
        VALUES (:did, :sdate, :stime, :iid, :loc)
    """), {"did": departure_id, "sdate": data.scheduled_date, "stime": data.scheduled_time,
           "iid": data.interviewer_id or current_user.id, "loc": data.location})
    db.commit()

    return {"message": "Entretien de départ planifié"}


@router.put("/{departure_id}/exit-interview")
def update_exit_interview(
    departure_id: int,
    data: ExitInterviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mettre à jour / remplir le questionnaire de l'entretien."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    existing = db.execute(text("SELECT id FROM exit_interviews WHERE departure_id = :did"),
                          {"did": departure_id}).fetchone()
    if not existing:
        raise HTTPException(404, "Entretien non trouvé")

    updates = []
    params = {"did": departure_id}
    fields = ["scheduled_date", "scheduled_time", "location", "status",
              "departure_reason_rating", "management_rating", "work_environment_rating",
              "career_growth_rating", "compensation_rating", "primary_departure_reason",
              "would_recommend", "would_return", "suggestions", "positive_aspects",
              "improvement_areas", "additional_notes"]

    for field in fields:
        val = getattr(data, field, None)
        if val is not None:
            updates.append(f"{field} = :{field}")
            params[field] = val

    # If status is completed, set completed_at
    if data.status == "completed":
        updates.append("completed_at = NOW()")

    if updates:
        db.execute(text(f"UPDATE exit_interviews SET {', '.join(updates)} WHERE departure_id = :did"), params)
        db.commit()

    return {"message": "Entretien mis à jour"}


# ============================================
# DOCUMENT GENERATION - Solde de tout compte
# ============================================

@router.post("/{departure_id}/generate-settlement")
def generate_settlement(
    departure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Générer le PDF du solde de tout compte."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    dep = db.execute(text("""
        SELECT d.*, e.first_name, e.last_name, e.job_title, e.hire_date,
               e.salary, e.currency, e.contract_type, e.employee_id as matricule,
               dep.name as department_name
        FROM departures d
        JOIN employees e ON e.id = d.employee_id
        LEFT JOIN departments dep ON dep.id = e.department_id
        WHERE d.id = :did AND d.tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()

    if not dep:
        raise HTTPException(404, "Départ non trouvé")

    # Get tenant info
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()

    # Get certificate settings
    settings = db.execute(text("""
        SELECT certificate_company_name, certificate_company_address, certificate_company_city,
               certificate_signatory_name, certificate_signatory_title
        FROM tenants WHERE id = :tid
    """), {"tid": current_user.tenant_id}).fetchone()

    company_name = settings.certificate_company_name if settings and settings.certificate_company_name else (tenant.name if tenant else "Entreprise")
    company_address = settings.certificate_company_address if settings and settings.certificate_company_address else ""
    company_city = settings.certificate_company_city if settings and settings.certificate_company_city else ""
    signatory_name = settings.certificate_signatory_name if settings and settings.certificate_signatory_name else ""
    signatory_title = settings.certificate_signatory_title if settings and settings.certificate_signatory_title else ""

    # Compute amounts
    salary = float(dep.salary) if dep.salary else 0
    currency = dep.currency or "XOF"
    leave_days = float(dep.leave_balance_days) if dep.leave_balance_days else 0
    daily_rate = salary / 30 if salary > 0 else 0
    leave_compensation = round(leave_days * daily_rate, 2) if leave_days > 0 else 0

    # Notice period compensation (if dispensed)
    notice_compensation = 0  # Only if dispensed from notice period

    total_net = leave_compensation + notice_compensation

    emp_name = f"{dep.first_name or ''} {dep.last_name or ''}".strip()

    # Generate PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                          leftMargin=2.5*cm, rightMargin=2.5*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=16, spaceAfter=20, alignment=TA_CENTER)
    normal = ParagraphStyle('Normal2', parent=styles['Normal'], fontSize=11, leading=16, alignment=TA_JUSTIFY)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=11, leading=16, fontName='Helvetica-Bold')
    right_style = ParagraphStyle('Right', parent=styles['Normal'], fontSize=11, alignment=TA_RIGHT)
    small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=9, textColor=colors.gray)

    elements = []

    # Header
    elements.append(Paragraph(company_name, bold_style))
    if company_address:
        elements.append(Paragraph(company_address, small_style))
    if company_city:
        elements.append(Paragraph(company_city, small_style))
    elements.append(Spacer(1, 1*cm))

    # Date
    today_str = date.today().strftime("%d/%m/%Y")
    elements.append(Paragraph(f"{company_city}, le {today_str}", right_style))
    elements.append(Spacer(1, 1*cm))

    # Title
    elements.append(Paragraph("SOLDE DE TOUT COMPTE", title_style))
    elements.append(Spacer(1, 0.5*cm))

    # Employee info
    hire_str = dep.hire_date.strftime("%d/%m/%Y") if dep.hire_date else "N/A"
    eff_str = dep.effective_date.strftime("%d/%m/%Y") if dep.effective_date else date.today().strftime("%d/%m/%Y")
    elements.append(Paragraph(f"<b>Collaborateur :</b> {emp_name}", normal))
    elements.append(Paragraph(f"<b>Matricule :</b> {dep.matricule or 'N/A'}", normal))
    elements.append(Paragraph(f"<b>Poste :</b> {dep.job_title or 'N/A'}", normal))
    elements.append(Paragraph(f"<b>Département :</b> {dep.department_name or 'N/A'}", normal))
    elements.append(Paragraph(f"<b>Date d'entrée :</b> {hire_str}", normal))
    elements.append(Paragraph(f"<b>Date de sortie :</b> {eff_str}", normal))
    elements.append(Spacer(1, 0.8*cm))

    # Table of amounts
    table_data = [
        ["Rubrique", "Détail", f"Montant ({currency})"],
        ["Indemnité compensatrice de congés", f"{leave_days} jours × {daily_rate:,.0f} {currency}/jour", f"{leave_compensation:,.0f}"],
    ]

    if notice_compensation > 0:
        table_data.append(["Indemnité de préavis", f"{dep.notice_period_days} jours", f"{notice_compensation:,.0f}"])

    table_data.append(["", "", ""])
    table_data.append(["TOTAL NET À PAYER", "", f"{total_net:,.0f} {currency}"])

    t = Table(table_data, colWidths=[7*cm, 5*cm, 4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -2), 0.5, colors.grey),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 1*cm))

    # Legal text
    elements.append(Paragraph(
        "Le présent solde de tout compte est établi en double exemplaire, dont un est remis au salarié. "
        "Le salarié reconnaît avoir reçu la somme indiquée ci-dessus pour solde de tout compte. "
        "Conformément à la législation en vigueur, le salarié dispose d'un délai de six mois pour contester "
        "les sommes figurant sur le présent reçu.",
        normal
    ))
    elements.append(Spacer(1, 1.5*cm))

    # Signatures
    sig_data = [
        ["L'employeur", "Le salarié"],
        [f"\n\n\n{signatory_name}\n{signatory_title}" if signatory_name else "\n\n\n", f"\n\n\n{emp_name}"],
    ]
    sig_table = Table(sig_data, colWidths=[8*cm, 8*cm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)

    filename = f"solde_tout_compte_{emp_name.replace(' ', '_')}_{today_str.replace('/', '-')}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/{departure_id}/generate-certificate")
def generate_certificate_from_departure(
    departure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Redirige vers le module certificats existant."""
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(403, "Accès réservé RH/Admin/Direction")

    dep = db.execute(text("""
        SELECT employee_id FROM departures WHERE id = :did AND tenant_id = :tid
    """), {"did": departure_id, "tid": current_user.tenant_id}).fetchone()

    if not dep:
        raise HTTPException(404, "Départ non trouvé")

    return {
        "message": "Utilisez l'endpoint certificats pour générer le document",
        "certificate_url": f"/api/certificates/employee/{dep.employee_id}/work-certificate?doc_type=certificat",
        "employee_id": dep.employee_id,
    }
