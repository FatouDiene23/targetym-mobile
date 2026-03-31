# ============================================
# API: Gestion des Missions
# Fichier: app/api/missions.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field
from enum import Enum
import json

from app.api.deps import get_db, get_current_user

router = APIRouter(prefix="/api/missions", tags=["Missions"])


# ============================================
# ENUMS
# ============================================

class MissionStatus(str, Enum):
    BROUILLON = "brouillon"
    EN_ATTENTE_MANAGER = "en_attente_manager"
    EN_ATTENTE_RH = "en_attente_rh"
    APPROUVEE = "approuvee"
    REJETEE = "rejetee"
    EN_COURS = "en_cours"
    TERMINEE = "terminee"
    CLOTUREE = "cloturee"

class InitiatedBy(str, Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    RH = "rh"
    DG = "dg"

class TransportType(str, Enum):
    AVION = "avion"
    TRAIN = "train"
    VOITURE_PERSONNELLE = "voiture_personnelle"
    VOITURE_SERVICE = "voiture_service"
    BUS = "bus"
    AUTRE = "autre"

class AccommodationType(str, Enum):
    HOTEL = "hotel"
    RESIDENCE = "residence"
    CHEZ_TIERS = "chez_tiers"
    AUCUN = "aucun"
    AUTRE = "autre"

class ExpenseType(str, Enum):
    TRANSPORT = "transport"
    HEBERGEMENT = "hebergement"
    REPAS = "repas"
    TAXI = "taxi"
    CARBURANT = "carburant"
    PARKING = "parking"
    COMMUNICATION = "communication"
    AUTRE = "autre"

class ExpenseStatus(str, Enum):
    BROUILLON = "brouillon"
    SOUMIS = "soumis"
    APPROUVE = "approuve"
    REJETE = "rejete"
    REMBOURSE = "rembourse"


# ============================================
# SCHEMAS (Pydantic)
# ============================================

class MissionCreate(BaseModel):
    employee_id: int
    subject: str
    description: Optional[str] = None
    departure_location: str
    destination: str
    destination_country: Optional[str] = None
    trip_type: Optional[str] = None  # aller_simple | aller_retour | multi_destination
    start_date: date
    end_date: date
    transport_type: TransportType
    transport_details: Optional[str] = None
    accommodation_type: Optional[AccommodationType] = None
    accommodation_details: Optional[str] = None
    estimated_budget: Optional[float] = None
    manager_id: Optional[int] = None
    as_draft: bool = False

class MissionUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    departure_location: Optional[str] = None
    destination: Optional[str] = None
    destination_country: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    transport_type: Optional[TransportType] = None
    transport_details: Optional[str] = None
    accommodation_type: Optional[AccommodationType] = None
    accommodation_details: Optional[str] = None
    estimated_budget: Optional[float] = None

class MissionValidation(BaseModel):
    approved: bool
    comments: Optional[str] = None
    rejection_reason: Optional[str] = None
    per_diem_amount: Optional[float] = None  # Pour validation RH
    advance_amount: Optional[float] = None   # Pour validation RH

class MissionComplete(BaseModel):
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    mission_report: Optional[str] = None

class ExpenseCreate(BaseModel):
    expense_type: ExpenseType
    description: str
    expense_date: date
    amount: float
    currency: str = "XOF"
    receipt_url: Optional[str] = None
    receipt_filename: Optional[str] = None

class ExpenseValidation(BaseModel):
    approved: bool
    comments: Optional[str] = None
    rejection_reason: Optional[str] = None


# ============================================
# HELPERS
# ============================================

def get_user_role(current_user) -> str:
    """Récupérer le rôle de l'utilisateur"""
    role = getattr(current_user, 'role', None)
    if role:
        return role.lower() if isinstance(role, str) else role
    return "employee"

def can_manage_all_missions(role: str) -> bool:
    """Vérifier si le rôle peut gérer toutes les missions"""
    return role in ["rh", "admin", "dg", "superadmin"]

def can_validate_as_manager(role: str) -> bool:
    """Vérifier si le rôle peut valider en tant que manager"""
    return role in ["manager", "rh", "admin", "dg", "superadmin"]


def enrich_with_signatures(mission_data: dict, db: Session, tenant_id: int) -> dict:
    """Enrichir les données mission avec les signatures électroniques.
    
    Récupère signature_url depuis la table employees pour :
    - L'employé concerné
    - Le manager validateur
    - Le RH validateur (ou premier RH du tenant en fallback)
    """
    employee_id = mission_data.get("employee_id")
    manager_id = mission_data.get("manager_id")
    
    # 1. Signature de l'employé
    if employee_id:
        emp_row = db.execute(text(
            "SELECT signature_url FROM employees WHERE id = :eid AND tenant_id = :tid"
        ), {"eid": employee_id, "tid": tenant_id}).fetchone()
        mission_data["employee_signature_url"] = emp_row[0] if emp_row and emp_row[0] else None
    else:
        mission_data["employee_signature_url"] = None
    
    # 2. Signature du manager / responsable
    if manager_id:
        mgr_row = db.execute(text(
            "SELECT signature_url FROM employees WHERE id = :mid AND tenant_id = :tid"
        ), {"mid": manager_id, "tid": tenant_id}).fetchone()
        mission_data["manager_signature_url"] = mgr_row[0] if mgr_row and mgr_row[0] else None
    else:
        mission_data["manager_signature_url"] = None
    
    # 3. Signature DRH — chercher le validateur RH, sinon fallback premier RH du tenant
    rh_validated_by = mission_data.get("rh_validated_by")
    if rh_validated_by:
        rh_row = db.execute(text(
            "SELECT signature_url, first_name || ' ' || last_name AS full_name "
            "FROM employees WHERE id = :rid AND tenant_id = :tid"
        ), {"rid": rh_validated_by, "tid": tenant_id}).fetchone()
        mission_data["drh_signature_url"] = rh_row[0] if rh_row and rh_row[0] else None
        if not mission_data.get("rh_validator_name") and rh_row:
            mission_data["rh_validator_name"] = rh_row[1]
    else:
        # Fallback: premier employé avec rôle RH du tenant
        rh_row = db.execute(text(
            "SELECT signature_url, first_name || ' ' || last_name AS full_name "
            "FROM employees WHERE tenant_id = :tid AND role = 'rh' LIMIT 1"
        ), {"tid": tenant_id}).fetchone()
        mission_data["drh_signature_url"] = rh_row[0] if rh_row and rh_row[0] else None
        if not mission_data.get("rh_validator_name") and rh_row:
            mission_data["rh_validator_name"] = rh_row[1]
    
    return mission_data


# ============================================
# ENDPOINTS: MISSIONS
# ============================================

@router.get("/")
def list_missions(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Liste des missions avec filtres"""
    role = get_user_role(current_user)
    offset = (page - 1) * limit
    
    # Base query
    where_clauses = ["mv.tenant_id = :tenant_id"]
    params = {"tenant_id": current_user.tenant_id, "limit": limit, "offset": offset}
    
    # Récupérer l'employee_id du user courant
    current_emp_id = current_user.employee_id

    # Filtrage par rôle
    if not can_manage_all_missions(role):
        if role == "manager":
            where_clauses.append("""
                (mv.employee_id = :emp_id
                 OR mv.created_by_id = :user_id
                 OR mv.manager_id = :emp_id
                 OR mv.employee_id IN (SELECT id FROM employees WHERE manager_id = :emp_id AND tenant_id = :tenant_id))
            """)
            params["user_id"] = current_user.id
            params["emp_id"] = current_emp_id or -1
        else:
            where_clauses.append("(mv.employee_id = :emp_id OR mv.created_by_id = :user_id)")
            params["user_id"] = current_user.id
            params["emp_id"] = current_emp_id or -1
    
    if status:
        where_clauses.append("mv.status = :status")
        params["status"] = status
    
    if employee_id:
        where_clauses.append("mv.employee_id = :filter_employee_id")
        params["filter_employee_id"] = employee_id
    
    if search:
        where_clauses.append("(mv.subject ILIKE :search OR mv.destination ILIKE :search OR mv.reference ILIKE :search OR mv.employee_name ILIKE :search)")
        params["search"] = f"%{search}%"
    
    where_sql = " AND ".join(where_clauses)
    
    count_query = f"SELECT COUNT(*) FROM missions_view mv WHERE {where_sql}"
    total = db.execute(text(count_query), params).scalar()
    
    data_query = f"""
        SELECT mv.id, mv.reference, mv.subject, mv.destination, mv.destination_country,
               mv.start_date, mv.end_date, mv.status, mv.transport_type,
               mv.per_diem_amount, mv.per_diem_currency, mv.initiated_by,
               mv.created_at, mv.employee_id, mv.employee_name, mv.employee_code,
               mv.department_name, mv.duration_days, mv.employee_job_title
        FROM missions_view mv
        WHERE {where_sql}
        ORDER BY mv.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    
    rows = db.execute(text(data_query), params).fetchall()
    
    missions = []
    for row in rows:
        missions.append({
            "id": row[0], "reference": row[1], "subject": row[2],
            "destination": row[3], "destination_country": row[4],
            "start_date": str(row[5]), "end_date": str(row[6]),
            "status": row[7], "transport_type": row[8],
            "per_diem_amount": float(row[9]) if row[9] else None,
            "per_diem_currency": row[10], "initiated_by": row[11],
            "created_at": str(row[12]), "employee_id": row[13],
            "employee_name": row[14], "employee_code": row[15],
            "department_name": row[16], "duration_days": row[17],
            "employee_job_title": row[18]
        })
    
    return {
        "missions": missions,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/pending")
def list_pending_missions(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Missions en attente de validation pour l'utilisateur courant"""
    role = get_user_role(current_user)
    
    current_emp_id = current_user.employee_id
    where_clauses = ["mv.tenant_id = :tenant_id"]
    params = {"tenant_id": current_user.tenant_id, "emp_id": current_emp_id or -1}
    
    if role == "manager":
        where_clauses.append("mv.status = 'en_attente_manager'")
        where_clauses.append("""
            (mv.manager_id = :emp_id
             OR mv.employee_id IN (SELECT id FROM employees WHERE manager_id = :emp_id AND tenant_id = :tenant_id))
        """)
    elif can_manage_all_missions(role):
        where_clauses.append("mv.status IN ('en_attente_manager', 'en_attente_rh')")
    else:
        return {"missions": [], "total": 0}
    
    where_sql = " AND ".join(where_clauses)
    
    query = f"""
        SELECT mv.id, mv.reference, mv.subject, mv.destination, mv.destination_country,
               mv.start_date, mv.end_date, mv.status, mv.transport_type,
               mv.per_diem_amount, mv.per_diem_currency, mv.initiated_by,
               mv.created_at, mv.employee_id, mv.employee_name, mv.employee_code,
               mv.department_name, mv.duration_days, mv.employee_job_title
        FROM missions_view mv
        WHERE {where_sql}
        ORDER BY mv.created_at ASC
    """
    
    rows = db.execute(text(query), params).fetchall()
    
    missions = []
    for row in rows:
        missions.append({
            "id": row[0], "reference": row[1], "subject": row[2],
            "destination": row[3], "destination_country": row[4],
            "start_date": str(row[5]), "end_date": str(row[6]),
            "status": row[7], "transport_type": row[8],
            "per_diem_amount": float(row[9]) if row[9] else None,
            "per_diem_currency": row[10], "initiated_by": row[11],
            "created_at": str(row[12]), "employee_id": row[13],
            "employee_name": row[14], "employee_code": row[15],
            "department_name": row[16], "duration_days": row[17],
            "employee_job_title": row[18]
        })
    
    return {"missions": missions, "total": len(missions)}


@router.get("/stats")
def get_mission_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Statistiques des missions"""
    role = get_user_role(current_user)
    
    current_emp_id = current_user.employee_id
    base_filter = "tenant_id = :tenant_id"
    params = {"tenant_id": current_user.tenant_id, "user_id": current_user.id, "emp_id": current_emp_id or -1}
    
    if not can_manage_all_missions(role):
        base_filter += " AND (employee_id = :emp_id OR created_by_id = :user_id)"
    
    stats_query = f"""
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'brouillon') as brouillon,
            COUNT(*) FILTER (WHERE status IN ('en_attente_manager', 'en_attente_rh')) as en_attente,
            COUNT(*) FILTER (WHERE status = 'approuvee') as approuvee,
            COUNT(*) FILTER (WHERE status = 'en_cours') as en_cours,
            COUNT(*) FILTER (WHERE status = 'terminee') as terminee,
            COUNT(*) FILTER (WHERE status = 'rejetee') as rejetee,
            COUNT(*) FILTER (WHERE status = 'cloturee') as cloturee,
            COALESCE(SUM(per_diem_amount) FILTER (WHERE status IN ('approuvee', 'en_cours', 'terminee', 'cloturee')), 0) as total_per_diem
        FROM missions
        WHERE {base_filter}
    """
    
    row = db.execute(text(stats_query), params).fetchone()
    
    pending_count = 0
    if role == "manager":
        pending_query = """
            SELECT COUNT(*) FROM missions 
            WHERE tenant_id = :tenant_id AND status = 'en_attente_manager'
            AND (manager_id = :emp_id OR employee_id IN (SELECT id FROM employees WHERE manager_id = :emp_id AND tenant_id = :tenant_id))
        """
        pending_count = db.execute(text(pending_query), params).scalar()
    elif can_manage_all_missions(role):
        pending_query = """
            SELECT COUNT(*) FROM missions 
            WHERE tenant_id = :tenant_id AND status IN ('en_attente_manager', 'en_attente_rh')
        """
        pending_count = db.execute(text(pending_query), params).scalar()
    
    return {
        "total": row[0],
        "brouillon": row[1],
        "en_attente": row[2],
        "approuvee": row[3],
        "en_cours": row[4],
        "terminee": row[5],
        "rejetee": row[6],
        "cloturee": row[7],
        "total_per_diem": float(row[8]),
        "pending_validation": pending_count
    }


@router.get("/{mission_id}")
def get_mission(
    mission_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Détail d'une mission avec signatures électroniques"""
    role = get_user_role(current_user)
    
    query = """
        SELECT mv.*, 
               m.description, m.departure_location, m.transport_details,
               m.accommodation_type, m.accommodation_details,
               m.estimated_budget, m.advance_amount, m.advance_paid,
               m.manager_id, m.manager_validated_at, m.manager_comments,
               m.rh_validated_at, m.rh_validated_by, m.rh_comments,
               m.rejection_reason, m.rejected_by, m.rejected_at,
               m.actual_start_date, m.actual_end_date,
               m.mission_report, m.mission_report_submitted_at,
               m.attachments,
               mgr.first_name || ' ' || mgr.last_name AS manager_name,
               rv.first_name || ' ' || rv.last_name AS rh_validator_name
        FROM missions_view mv
        JOIN missions m ON mv.id = m.id
        LEFT JOIN employees mgr ON m.manager_id = mgr.id
        LEFT JOIN employees rv ON m.rh_validated_by = rv.id
        WHERE mv.id = :mission_id AND mv.tenant_id = :tenant_id
    """
    
    row = db.execute(text(query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    # Vérifier l'accès
    current_emp_id = current_user.employee_id
    if not can_manage_all_missions(role):
        if role == "manager":
            emp_ids = db.execute(text(
                "SELECT id FROM employees WHERE manager_id = :uid AND tenant_id = :tid"
            ), {"uid": current_emp_id or -1, "tid": current_user.tenant_id}).fetchall()
            team_ids = [e[0] for e in emp_ids]
            if current_emp_id:
                team_ids.append(current_emp_id)
            if row.employee_id not in team_ids and row.created_by_id != current_user.id and row.manager_id != current_emp_id:
                raise HTTPException(status_code=403, detail="Accès non autorisé")
        else:
            if row.employee_id != current_emp_id and row.created_by_id != current_user.id:
                raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Récupérer les frais
    expenses_query = """
        SELECT me.id, me.expense_type, me.description, me.expense_date,
               me.amount, me.currency, me.status, me.receipt_url, me.receipt_filename,
               me.validated_by, me.validated_at, me.validation_comments,
               me.rejection_reason, me.reimbursed_at, me.reimbursement_reference,
               v.first_name || ' ' || v.last_name as validator_name
        FROM mission_expenses me
        LEFT JOIN employees v ON me.validated_by = v.id
        WHERE me.mission_id = :mission_id AND me.tenant_id = :tenant_id
        ORDER BY me.expense_date ASC
    """
    expense_rows = db.execute(text(expenses_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchall()
    
    expenses = []
    for e in expense_rows:
        expenses.append({
            "id": e[0], "expense_type": e[1], "description": e[2],
            "expense_date": str(e[3]), "amount": float(e[4]), "currency": e[5],
            "status": e[6], "receipt_url": e[7], "receipt_filename": e[8],
            "validated_by": e[9], "validated_at": str(e[10]) if e[10] else None,
            "validation_comments": e[11], "rejection_reason": e[12],
            "reimbursed_at": str(e[13]) if e[13] else None,
            "reimbursement_reference": e[14], "validator_name": e[15]
        })
    
    mission_data = {
        "id": row.id, "reference": row.reference, "subject": row.subject,
        "description": row.description, "departure_location": row.departure_location,
        "destination": row.destination, "destination_country": row.destination_country,
        "start_date": str(row.start_date), "end_date": str(row.end_date),
        "status": row.status, "transport_type": row.transport_type,
        "transport_details": row.transport_details,
        "accommodation_type": row.accommodation_type,
        "accommodation_details": row.accommodation_details,
        "estimated_budget": float(row.estimated_budget) if row.estimated_budget else None,
        "per_diem_amount": float(row.per_diem_amount) if row.per_diem_amount else None,
        "per_diem_currency": row.per_diem_currency,
        "advance_amount": float(row.advance_amount) if row.advance_amount else None,
        "advance_paid": row.advance_paid,
        "initiated_by": row.initiated_by,
        "created_at": str(row.created_at),
        "employee_id": row.employee_id, "employee_name": row.employee_name,
        "employee_code": row.employee_code, "employee_job_title": row.employee_job_title,
        "department_name": row.department_name, "duration_days": row.duration_days,
        "manager_id": row.manager_id, "manager_name": row.manager_name,
        "manager_validated_at": str(row.manager_validated_at) if row.manager_validated_at else None,
        "manager_comments": row.manager_comments,
        "rh_validated_by": row.rh_validated_by,
        "rh_validated_at": str(row.rh_validated_at) if row.rh_validated_at else None,
        "rh_comments": row.rh_comments,
        "rh_validator_name": row.rh_validator_name,
        "rejection_reason": row.rejection_reason,
        "actual_start_date": str(row.actual_start_date) if row.actual_start_date else None,
        "actual_end_date": str(row.actual_end_date) if row.actual_end_date else None,
        "mission_report": row.mission_report,
        "created_by_name": row.created_by_name,
        "attachments": row.attachments or [],
        "expenses": expenses,
        "total_expenses": float(row.total_expenses),
        "total_approved_expenses": float(row.total_approved_expenses)
    }
    
    # Enrichir avec les signatures électroniques
    mission_data = enrich_with_signatures(mission_data, db, current_user.tenant_id)
    
    return mission_data


@router.post("/")
def create_mission(
    data: MissionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Créer une mission"""
    role = get_user_role(current_user)
    
    current_emp_id = current_user.employee_id
    if can_manage_all_missions(role):
        initiated_by = "rh" if role == "rh" else "dg" if role == "dg" else "rh"
    elif role == "manager":
        initiated_by = "manager" if data.employee_id != current_emp_id else "employee"
    else:
        initiated_by = "employee"
        if data.employee_id != current_emp_id:
            raise HTTPException(status_code=403, detail="Vous ne pouvez créer une mission que pour vous-même")
    
    ref = db.execute(text("SELECT generate_mission_reference(:tid)"), {"tid": current_user.tenant_id}).scalar()
    
    manager_id = data.manager_id
    if not manager_id:
        mgr_row = db.execute(text("SELECT manager_id FROM employees WHERE id = :eid"), {"eid": data.employee_id}).fetchone()
        if mgr_row and mgr_row[0]:
            manager_id = mgr_row[0]
    
    if data.as_draft:
        initial_status = MissionStatus.BROUILLON.value
    elif initiated_by in ["rh", "dg"]:
        initial_status = MissionStatus.APPROUVEE.value
    else:
        initial_status = MissionStatus.EN_ATTENTE_MANAGER.value if manager_id else MissionStatus.EN_ATTENTE_RH.value
    
    insert_query = """
        INSERT INTO missions (
            tenant_id, reference, employee_id, created_by_id, initiated_by,
            subject, description, departure_location, destination, destination_country,
            trip_type, start_date, end_date, transport_type, transport_details,
            accommodation_type, accommodation_details, estimated_budget,
            manager_id, status
        ) VALUES (
            :tenant_id, :reference, :employee_id, :created_by_id, :initiated_by,
            :subject, :description, :departure_location, :destination, :destination_country,
            :trip_type, :start_date, :end_date, :transport_type, :transport_details,
            :accommodation_type, :accommodation_details, :estimated_budget,
            :manager_id, :status
        ) RETURNING id
    """
    
    result = db.execute(text(insert_query), {
        "tenant_id": current_user.tenant_id,
        "reference": ref,
        "employee_id": data.employee_id,
        "created_by_id": current_user.id,
        "initiated_by": initiated_by,
        "subject": data.subject,
        "description": data.description,
        "departure_location": data.departure_location,
        "destination": data.destination,
        "destination_country": data.destination_country,
        "trip_type": data.trip_type,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "transport_type": data.transport_type.value,
        "transport_details": data.transport_details,
        "accommodation_type": data.accommodation_type.value if data.accommodation_type else None,
        "accommodation_details": data.accommodation_details,
        "estimated_budget": data.estimated_budget,
        "manager_id": manager_id,
        "status": initial_status
    })
    
    mission_id = result.fetchone()[0]
    db.commit()
    
    return {
        "id": mission_id,
        "reference": ref,
        "status": initial_status,
        "message": "Mission créée avec succès"
    }


@router.put("/{mission_id}")
def update_mission(
    mission_id: int,
    data: MissionUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Modifier une mission (brouillon ou rejetée)"""
    check_query = """
        SELECT status, employee_id, created_by_id FROM missions 
        WHERE id = :mission_id AND tenant_id = :tenant_id
    """
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    status, employee_id, created_by_id = row
    
    role = get_user_role(current_user)
    if not can_manage_all_missions(role):
        if employee_id != current_user.id and created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    if status not in [MissionStatus.BROUILLON.value, MissionStatus.REJETEE.value]:
        raise HTTPException(status_code=400, detail="Seules les missions en brouillon ou rejetées peuvent être modifiées")
    
    update_fields = []
    params = {"mission_id": mission_id}
    
    for field, value in data.dict(exclude_unset=True).items():
        if value is not None:
            if field in ["transport_type", "accommodation_type"] and value:
                value = value.value
            update_fields.append(f"{field} = :{field}")
            params[field] = value
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    update_query = f"UPDATE missions SET {', '.join(update_fields)} WHERE id = :mission_id"
    db.execute(text(update_query), params)
    db.commit()
    
    return {"message": "Mission mise à jour avec succès"}


@router.post("/{mission_id}/submit")
def submit_mission(
    mission_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Soumettre une mission pour validation"""
    check_query = """
        SELECT status, employee_id, created_by_id, manager_id FROM missions
        WHERE id = :mission_id AND tenant_id = :tenant_id
    """
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    status, employee_id, created_by_id, manager_id = row
    
    current_emp_id = current_user.employee_id
    if employee_id != current_emp_id and created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    if status not in [MissionStatus.BROUILLON.value, MissionStatus.REJETEE.value]:
        raise HTTPException(status_code=400, detail="Cette mission ne peut pas être soumise")
    
    new_status = MissionStatus.EN_ATTENTE_MANAGER.value if manager_id else MissionStatus.EN_ATTENTE_RH.value
    
    db.execute(text("UPDATE missions SET status = :status WHERE id = :id"), {"status": new_status, "id": mission_id})
    db.commit()
    
    return {"message": "Mission soumise pour validation", "status": new_status}


@router.post("/{mission_id}/validate/manager")
def validate_mission_manager(
    mission_id: int,
    data: MissionValidation,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Validation par le manager"""
    role = get_user_role(current_user)
    
    if not can_validate_as_manager(role):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    check_query = """
        SELECT m.status, m.employee_id, m.manager_id, e.manager_id as emp_manager
        FROM missions m
        JOIN employees e ON m.employee_id = e.id
        WHERE m.id = :mission_id AND m.tenant_id = :tenant_id
    """
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    status, employee_id, manager_id, emp_manager = row
    
    if status != MissionStatus.EN_ATTENTE_MANAGER.value:
        raise HTTPException(status_code=400, detail="Cette mission n'est pas en attente de validation manager")
    
    if not can_manage_all_missions(role):
        if manager_id != current_user.id and emp_manager != current_user.id:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas le manager de cet employé")
    
    if data.approved:
        new_status = MissionStatus.EN_ATTENTE_RH.value
        db.execute(text("""
            UPDATE missions SET 
                status = :status,
                manager_validated_at = CURRENT_TIMESTAMP,
                manager_validated_by = :validated_by,
                manager_comments = :comments
            WHERE id = :mission_id
        """), {
            "status": new_status,
            "validated_by": current_user.id,
            "comments": data.comments,
            "mission_id": mission_id
        })
    else:
        new_status = MissionStatus.REJETEE.value
        db.execute(text("""
            UPDATE missions SET 
                status = :status,
                rejection_reason = :reason,
                rejected_by = :rejected_by,
                rejected_at = CURRENT_TIMESTAMP,
                manager_comments = :comments
            WHERE id = :mission_id
        """), {
            "status": new_status,
            "reason": data.rejection_reason or data.comments,
            "rejected_by": current_user.id,
            "comments": data.comments,
            "mission_id": mission_id
        })
    
    db.commit()

    try:
        from app.services.email_service import send_mission_decision_email
        from app.models.employee import Employee
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        mission_row = db.execute(text("SELECT title FROM missions WHERE id = :mid"), {"mid": mission_id}).fetchone()
        if emp and emp.email and mission_row:
            send_mission_decision_email(
                to_email=emp.email,
                first_name=emp.first_name,
                mission_title=mission_row[0] or f"Mission #{mission_id}",
                approved=data.approved,
                stage="manager",
                comments=data.comments,
                rejection_reason=data.rejection_reason if not data.approved else None,
            )
    except Exception as e:
        print(f"⚠️ Email mission manager non envoyé: {e}")

    return {"message": "Mission traitée par le manager", "status": new_status, "approved": data.approved}


@router.post("/{mission_id}/validate/rh")
def validate_mission_rh(
    mission_id: int,
    data: MissionValidation,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Validation par RH (avec per diem)"""
    role = get_user_role(current_user)
    
    if not can_manage_all_missions(role):
        raise HTTPException(status_code=403, detail="Seuls RH/Admin/DG peuvent valider à cette étape")
    
    check_query = "SELECT status FROM missions WHERE id = :mission_id AND tenant_id = :tenant_id"
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    if row[0] not in [MissionStatus.EN_ATTENTE_RH.value, MissionStatus.EN_ATTENTE_MANAGER.value]:
        raise HTTPException(status_code=400, detail="Cette mission n'est pas en attente de validation RH")
    
    if data.approved:
        new_status = MissionStatus.APPROUVEE.value
        update_fields = {
            "status": new_status,
            "validated_by": current_user.id,
            "comments": data.comments,
            "per_diem": data.per_diem_amount,
            "advance": data.advance_amount or 0,
            "mission_id": mission_id
        }
        
        db.execute(text("""
            UPDATE missions SET 
                status = :status,
                rh_validated_at = CURRENT_TIMESTAMP,
                rh_validated_by = :validated_by,
                rh_comments = :comments,
                per_diem_amount = COALESCE(:per_diem, per_diem_amount),
                advance_amount = COALESCE(:advance, advance_amount)
            WHERE id = :mission_id
        """), update_fields)
    else:
        new_status = MissionStatus.REJETEE.value
        db.execute(text("""
            UPDATE missions SET 
                status = :status,
                rejection_reason = :reason,
                rejected_by = :rejected_by,
                rejected_at = CURRENT_TIMESTAMP,
                rh_comments = :comments
            WHERE id = :mission_id
        """), {
            "status": new_status,
            "reason": data.rejection_reason or data.comments,
            "rejected_by": current_user.id,
            "comments": data.comments,
            "mission_id": mission_id
        })
    
    db.commit()

    try:
        from app.services.email_service import send_mission_decision_email
        from app.models.employee import Employee
        emp_row = db.execute(text("SELECT employee_id, title FROM missions WHERE id = :mid"), {"mid": mission_id}).fetchone()
        if emp_row:
            emp = db.query(Employee).filter(Employee.id == emp_row[0]).first()
            if emp and emp.email:
                send_mission_decision_email(
                    to_email=emp.email,
                    first_name=emp.first_name,
                    mission_title=emp_row[1] or f"Mission #{mission_id}",
                    approved=data.approved,
                    stage="rh",
                    comments=data.comments,
                    rejection_reason=data.rejection_reason if not data.approved else None,
                )
    except Exception as e:
        print(f"⚠️ Email mission RH non envoyé: {e}")

    return {"message": "Mission traitée par RH", "status": new_status, "approved": data.approved}


@router.post("/{mission_id}/start")
def start_mission(
    mission_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Démarrer une mission"""
    check_query = "SELECT status, employee_id FROM missions WHERE id = :mission_id AND tenant_id = :tenant_id"
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    if row[0] != MissionStatus.APPROUVEE.value:
        raise HTTPException(status_code=400, detail="Cette mission n'est pas approuvée")
    
    db.execute(text("""
        UPDATE missions SET 
            status = 'en_cours',
            actual_start_date = COALESCE(actual_start_date, CURRENT_DATE)
        WHERE id = :mission_id
    """), {"mission_id": mission_id})
    db.commit()
    
    return {"message": "Mission démarrée", "status": "en_cours"}


@router.post("/{mission_id}/complete")
def complete_mission(
    mission_id: int,
    data: MissionComplete,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Terminer une mission"""
    check_query = "SELECT status, employee_id FROM missions WHERE id = :mission_id AND tenant_id = :tenant_id"
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    if row[0] not in [MissionStatus.APPROUVEE.value, MissionStatus.EN_COURS.value]:
        raise HTTPException(status_code=400, detail="Cette mission ne peut pas être terminée")
    
    db.execute(text("""
        UPDATE missions SET 
            status = 'terminee',
            actual_end_date = COALESCE(:actual_end_date, CURRENT_DATE),
            actual_start_date = COALESCE(actual_start_date, :actual_start_date, start_date),
            mission_report = :report,
            mission_report_submitted_at = CASE WHEN :report IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = :mission_id
    """), {
        "mission_id": mission_id,
        "actual_start_date": data.actual_start_date,
        "actual_end_date": data.actual_end_date,
        "report": data.mission_report
    })
    db.commit()
    
    return {"message": "Mission terminée", "status": "terminee"}


@router.delete("/{mission_id}")
def delete_mission(
    mission_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Supprimer une mission (brouillon uniquement)"""
    role = get_user_role(current_user)
    
    check_query = "SELECT status, employee_id, created_by_id FROM missions WHERE id = :mission_id AND tenant_id = :tenant_id"
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    status, employee_id, created_by_id = row
    
    if not can_manage_all_missions(role):
        if employee_id != current_user.id and created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    if status != MissionStatus.BROUILLON.value:
        raise HTTPException(status_code=400, detail="Seules les missions en brouillon peuvent être supprimées")
    
    db.execute(text("DELETE FROM missions WHERE id = :mission_id"), {"mission_id": mission_id})
    db.commit()
    
    return {"message": "Mission supprimée"}


# ============================================
# ENDPOINTS: FRAIS DE MISSION
# ============================================

@router.post("/{mission_id}/expenses")
def add_expense(
    mission_id: int,
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Ajouter un frais de mission"""
    check_query = """
        SELECT status, employee_id FROM missions 
        WHERE id = :mission_id AND tenant_id = :tenant_id
    """
    row = db.execute(text(check_query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    status, employee_id = row
    
    if employee_id != current_user.id:
        role = get_user_role(current_user)
        if not can_manage_all_missions(role):
            raise HTTPException(status_code=403, detail="Vous ne pouvez pas ajouter de frais pour cette mission")
    
    if status not in [MissionStatus.EN_COURS.value, MissionStatus.TERMINEE.value, MissionStatus.APPROUVEE.value]:
        raise HTTPException(status_code=400, detail="Les frais ne peuvent être ajoutés qu'aux missions approuvées, en cours ou terminées")
    
    insert_query = """
        INSERT INTO mission_expenses (
            tenant_id, mission_id, employee_id,
            expense_type, description, expense_date, amount, currency,
            receipt_url, receipt_filename, status
        ) VALUES (
            :tenant_id, :mission_id, :employee_id,
            :expense_type, :description, :expense_date, :amount, :currency,
            :receipt_url, :receipt_filename, 'soumis'
        ) RETURNING id
    """
    
    result = db.execute(text(insert_query), {
        "tenant_id": current_user.tenant_id,
        "mission_id": mission_id,
        "employee_id": employee_id,
        "expense_type": data.expense_type.value,
        "description": data.description,
        "expense_date": data.expense_date,
        "amount": data.amount,
        "currency": data.currency,
        "receipt_url": data.receipt_url,
        "receipt_filename": data.receipt_filename
    })
    
    expense_id = result.fetchone()[0]
    db.commit()
    
    return {"id": expense_id, "message": "Frais ajouté avec succès"}


@router.get("/{mission_id}/expenses")
def list_mission_expenses(
    mission_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Liste les frais d'une mission"""
    query = """
        SELECT 
            me.id, me.expense_type, me.description, me.expense_date,
            me.amount, me.currency, me.status, me.receipt_url, me.receipt_filename,
            me.validated_by, me.validated_at, me.validation_comments,
            me.rejection_reason, me.reimbursed_at, me.reimbursement_reference,
            v.first_name || ' ' || v.last_name as validator_name
        FROM mission_expenses me
        LEFT JOIN employees v ON me.validated_by = v.id
        WHERE me.mission_id = :mission_id AND me.tenant_id = :tenant_id
        ORDER BY me.expense_date ASC
    """
    
    rows = db.execute(text(query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchall()
    
    expenses = []
    for e in rows:
        expenses.append({
            "id": e[0], "expense_type": e[1], "description": e[2],
            "expense_date": str(e[3]), "amount": float(e[4]), "currency": e[5],
            "status": e[6], "receipt_url": e[7], "receipt_filename": e[8],
            "validated_by": e[9], "validated_at": str(e[10]) if e[10] else None,
            "validation_comments": e[11], "rejection_reason": e[12],
            "reimbursed_at": str(e[13]) if e[13] else None,
            "reimbursement_reference": e[14], "validator_name": e[15]
        })
    
    return {"expenses": expenses, "total": len(expenses)}


@router.post("/expenses/{expense_id}/validate")
def validate_expense(
    expense_id: int,
    data: ExpenseValidation,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Valider/Rejeter un frais"""
    role = get_user_role(current_user)
    
    if not can_manage_all_missions(role) and role != "manager":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    check_query = "SELECT status FROM mission_expenses WHERE id = :expense_id AND tenant_id = :tenant_id"
    row = db.execute(text(check_query), {"expense_id": expense_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Frais non trouvé")
    
    if row[0] != ExpenseStatus.SOUMIS.value:
        raise HTTPException(status_code=400, detail="Ce frais n'est pas en attente de validation")
    
    new_status = ExpenseStatus.APPROUVE.value if data.approved else ExpenseStatus.REJETE.value
    
    db.execute(text("""
        UPDATE mission_expenses SET 
            status = :status,
            validated_by = :validated_by,
            validated_at = CURRENT_TIMESTAMP,
            validation_comments = :comments,
            rejection_reason = :reason
        WHERE id = :expense_id
    """), {
        "status": new_status,
        "validated_by": current_user.id,
        "comments": data.comments,
        "reason": data.rejection_reason,
        "expense_id": expense_id
    })
    db.commit()
    
    return {"message": "Frais traité", "status": new_status, "approved": data.approved}


@router.post("/expenses/{expense_id}/reimburse")
def mark_expense_reimbursed(
    expense_id: int,
    reference: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Marquer un frais comme remboursé"""
    role = get_user_role(current_user)
    
    if role not in ["rh", "admin", "dg"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    check_query = "SELECT status FROM mission_expenses WHERE id = :expense_id AND tenant_id = :tenant_id"
    row = db.execute(text(check_query), {"expense_id": expense_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Frais non trouvé")
    
    if row[0] != ExpenseStatus.APPROUVE.value:
        raise HTTPException(status_code=400, detail="Seuls les frais approuvés peuvent être marqués comme remboursés")
    
    db.execute(text("""
        UPDATE mission_expenses SET 
            status = 'rembourse',
            reimbursed_at = CURRENT_TIMESTAMP,
            reimbursement_reference = :reference
        WHERE id = :expense_id
    """), {"expense_id": expense_id, "reference": reference})
    db.commit()
    
    return {"message": "Frais marqué comme remboursé"}


# ============================================
# ENDPOINTS: PARAMÈTRES
# ============================================

@router.get("/settings/config")
def get_mission_settings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Récupérer les paramètres de mission du tenant"""
    query = "SELECT * FROM mission_settings WHERE tenant_id = :tenant_id"
    row = db.execute(text(query), {"tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        return {
            "default_per_diem_local": 25000,
            "default_per_diem_national": 50000,
            "default_per_diem_international": 100000,
            "default_currency": "XOF",
            "max_hotel_per_night": 75000,
            "max_meal_per_day": 15000,
            "max_taxi_per_day": 10000,
            "require_manager_approval": True,
            "require_rh_approval": True,
            "auto_approve_for_dg": True,
            "reference_prefix": "OM"
        }
    
    return {
        "default_per_diem_local": float(row.default_per_diem_local),
        "default_per_diem_national": float(row.default_per_diem_national),
        "default_per_diem_international": float(row.default_per_diem_international),
        "default_currency": row.default_currency,
        "max_hotel_per_night": float(row.max_hotel_per_night),
        "max_meal_per_day": float(row.max_meal_per_day),
        "max_taxi_per_day": float(row.max_taxi_per_day),
        "require_manager_approval": row.require_manager_approval,
        "require_rh_approval": row.require_rh_approval,
        "auto_approve_for_dg": row.auto_approve_for_dg,
        "reference_prefix": row.reference_prefix
    }


@router.put("/settings/config")
def update_mission_settings(
    data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Mettre à jour les paramètres de mission"""
    role = get_user_role(current_user)
    
    if not can_manage_all_missions(role):
        raise HTTPException(status_code=403, detail="Seuls RH/Admin/DG peuvent modifier les paramètres")
    
    existing = db.execute(text("SELECT id FROM mission_settings WHERE tenant_id = :tid"), {"tid": current_user.tenant_id}).fetchone()
    
    allowed_fields = [
        "default_per_diem_local", "default_per_diem_national", "default_per_diem_international",
        "default_currency", "max_hotel_per_night", "max_meal_per_day", "max_taxi_per_day",
        "require_manager_approval", "require_rh_approval", "auto_approve_for_dg", "reference_prefix"
    ]
    
    if existing:
        update_parts = []
        params = {"tid": current_user.tenant_id}
        for key, value in data.items():
            if key in allowed_fields:
                update_parts.append(f"{key} = :{key}")
                params[key] = value
        
        if update_parts:
            query = f"UPDATE mission_settings SET {', '.join(update_parts)} WHERE tenant_id = :tid"
            db.execute(text(query), params)
    else:
        params = {"tenant_id": current_user.tenant_id}
        for key, value in data.items():
            if key in allowed_fields:
                params[key] = value
        
        fields = ", ".join(params.keys())
        values = ", ".join(f":{k}" for k in params.keys())
        db.execute(text(f"INSERT INTO mission_settings ({fields}) VALUES ({values})"), params)
    
    db.commit()
    return {"message": "Paramètres mis à jour"}


# ============================================
# ENDPOINT: GÉNÉRER PDF (données pour le frontend)
# ============================================

@router.get("/{mission_id}/pdf")
def generate_mission_pdf(
    mission_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Générer l'ordre de mission en PDF (retourne les données enrichies avec signatures)"""
    query = """
        SELECT mv.*, m.description, m.departure_location, m.transport_details,
               m.accommodation_type, m.accommodation_details,
               m.estimated_budget, m.advance_amount, m.advance_paid,
               m.manager_id, m.rh_validated_by,
               mgr.first_name || ' ' || mgr.last_name AS manager_name,
               rv.first_name || ' ' || rv.last_name AS rh_validator_name
        FROM missions_view mv
        JOIN missions m ON mv.id = m.id
        LEFT JOIN employees mgr ON m.manager_id = mgr.id
        LEFT JOIN employees rv ON m.rh_validated_by = rv.id
        WHERE mv.id = :mission_id AND mv.tenant_id = :tenant_id
    """
    
    row = db.execute(text(query), {"mission_id": mission_id, "tenant_id": current_user.tenant_id}).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    if row.status not in [MissionStatus.APPROUVEE.value, MissionStatus.EN_COURS.value, MissionStatus.TERMINEE.value, MissionStatus.CLOTUREE.value]:
        raise HTTPException(status_code=400, detail="L'ordre de mission ne peut être généré que pour les missions approuvées")
    
    pdf_data = {
        "reference": row.reference,
        "employee_id": row.employee_id,
        "employee_name": row.employee_name,
        "employee_code": row.employee_code,
        "employee_job_title": row.employee_job_title,
        "department_name": row.department_name,
        "subject": row.subject,
        "description": row.description,
        "departure_location": row.departure_location,
        "destination": row.destination,
        "destination_country": row.destination_country,
        "start_date": str(row.start_date),
        "end_date": str(row.end_date),
        "duration_days": row.duration_days,
        "transport_type": row.transport_type,
        "transport_details": row.transport_details,
        "accommodation_type": row.accommodation_type,
        "accommodation_details": row.accommodation_details,
        "per_diem_amount": float(row.per_diem_amount) if row.per_diem_amount else None,
        "per_diem_currency": row.per_diem_currency,
        "advance_amount": float(row.advance_amount) if row.advance_amount else None,
        "manager_id": row.manager_id,
        "manager_name": row.manager_name,
        "manager_validated_at": str(row.manager_validated_at) if row.manager_validated_at else None,
        "rh_validated_by": row.rh_validated_by,
        "rh_validator_name": row.rh_validator_name,
        "rh_validated_at": str(row.rh_validated_at) if row.rh_validated_at else None,
        "status": row.status
    }
    
    # Enrichir avec les signatures électroniques
    pdf_data = enrich_with_signatures(pdf_data, db, current_user.tenant_id)
    
    return pdf_data