# =============================================
# API ROUTES - Constats d'absence / retard
# File: app/api/absences.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func, desc
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.absence_report import AbsenceReport, AbsenceType, AbsenceStatus
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/absences", tags=["Absences / Retards"])

# =============================================
# SCHEMAS
# =============================================

MANAGEMENT_ROLES = [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.MANAGER, UserRole.SUPER_ADMIN]
NOTIFY_ROLES     = [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPER_ADMIN]


class AbsenceCreate(BaseModel):
    employee_id: int
    type: str = "absence"          # absence | tardiness | early_departure | unauthorized_absence
    absence_date: date
    expected_start_time: Optional[str] = None
    actual_start_time:   Optional[str] = None
    actual_departure_time: Optional[str] = None  # Pour type early_departure
    duration_minutes:    Optional[int] = None
    reason:  Optional[str] = None
    notes:   Optional[str] = None
    document: Optional[str] = None
    notify_employee: bool = True    # envoyer notification à l'employé concerné


class AbsenceUpdate(BaseModel):
    status:              Optional[str] = None  # pending|justified|unjustified|notified
    reason:              Optional[str] = None
    notes:               Optional[str] = None
    document:            Optional[str] = None
    expected_start_time: Optional[str] = None
    actual_start_time:   Optional[str] = None
    duration_minutes:    Optional[int] = None


class AbsenceResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    type: str
    status: str
    absence_date: date
    expected_start_time: Optional[str] = None
    actual_start_time:   Optional[str] = None
    duration_minutes:    Optional[int] = None
    reason:   Optional[str] = None
    notes:    Optional[str] = None
    document: Optional[str] = None
    notification_sent: bool
    reported_by_id:   int
    reporter_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# =============================================
# HELPERS
# =============================================

TYPE_LABELS = {
    "absence":              "Absence",
    "tardiness":            "Retard",
    "early_departure":      "Départ anticipé",
    "unauthorized_absence": "Absence non autorisée",
    "sick_leave":           "Arrêt maladie",
}


def create_notification(db, tenant_id, user_id, employee_id,
                        title, message, notif_type="absence",
                        reference_type=None, reference_id=None,
                        action_url=None, priority="normal"):
    sp = None
    try:
        sp = db.begin_nested()
        db.execute(
            text("""
                INSERT INTO notifications
                  (tenant_id, user_id, employee_id, title, message,
                   type, priority, reference_type, reference_id, action_url,
                   is_read, created_at)
                VALUES
                  (:tenant_id, :user_id, :employee_id, :title, :message,
                   :type, :priority, :reference_type, :reference_id, :action_url,
                   false, now())
            """),
            {
                "tenant_id": tenant_id, "user_id": user_id, "employee_id": employee_id,
                "title": title, "message": message, "type": notif_type, "priority": priority,
                "reference_type": reference_type, "reference_id": reference_id,
                "action_url": action_url,
            }
        )
        sp.commit()
    except Exception as e:
        if sp is not None:
            try:
                sp.rollback()
            except Exception:
                pass
        logger.warning(f"[absences] Notification error: {e}")


def _enrich(report: AbsenceReport, db: Session) -> dict:
    """Ajoute employee_name et reporter_name au dict."""
    data = AbsenceResponse.from_orm(report).dict()
    try:
        row = db.execute(
            text("SELECT first_name, last_name FROM employees WHERE id = :id"),
            {"id": report.employee_id}
        ).fetchone()
        if row:
            data["employee_name"] = f"{row[0] or ''} {row[1] or ''}".strip()
    except Exception:
        pass
    try:
        row = db.execute(
            text("SELECT first_name, last_name FROM employees WHERE id = :id"),
            {"id": report.reported_by_id}
        ).fetchone()
        if row:
            data["reporter_name"] = f"{row[0] or ''} {row[1] or ''}".strip()
    except Exception:
        pass
    return data


# =============================================
# ENDPOINTS
# =============================================

@router.post("", status_code=201)
def create_absence_report(
    body: AbsenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Créer un constat d'absence ou de retard.
    Accessible aux managers, RH, admin, DG, super_admin.
    """
    import traceback
    try:
        return _create_absence_report_inner(body, db, current_user)
    except HTTPException:
        raise
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("[absences] POST /absences ERREUR COMPLETE:\n%s", tb)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

def _create_absence_report_inner(
    body: AbsenceCreate,
    db: Session,
    current_user: User,
):
    if current_user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Récupérer l'employee_id du déclarant (via users.employee_id)
    if not current_user.employee_id:
        raise HTTPException(status_code=403, detail="Profil employé introuvable")
    reporter_employee_id = current_user.employee_id

    # Vérifier que l'employé cible appartient au même tenant
    # users.employee_id → employees.id (pas de user_id sur employees)
    target_row = db.execute(
        text("""
            SELECT e.id, u.id AS user_id, e.first_name, e.last_name
            FROM employees e
            LEFT JOIN users u ON u.employee_id = e.id
            WHERE e.id = :eid AND e.tenant_id = :tid
        """),
        {"eid": body.employee_id, "tid": current_user.tenant_id}
    ).fetchone()
    if not target_row:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    report = AbsenceReport(
        tenant_id=current_user.tenant_id,
        employee_id=body.employee_id,
        type=AbsenceType(body.type),
        status=AbsenceStatus.PENDING,
        absence_date=body.absence_date,
        expected_start_time=body.expected_start_time,
        actual_start_time=body.actual_departure_time if body.type == "early_departure" else body.actual_start_time,
        duration_minutes=body.duration_minutes,
        reason=body.reason,
        notes=body.notes,
        document=body.document,
        reported_by_id=reporter_employee_id,
        notification_sent=False,
    )
    db.add(report)
    db.flush()

    # Notifier l'employé concerné
    if body.notify_employee and target_row[1]:  # target_row[1] = user_id
        type_label = TYPE_LABELS.get(body.type, body.type)
        emp_name = f"{target_row[2] or ''} {target_row[3] or ''}".strip()
        create_notification(
            db, current_user.tenant_id, target_row[1], body.employee_id,
            title=f"Constat {type_label.lower()} enregistré",
            message=f"Un constat de {type_label.lower()} a été créé pour le {body.absence_date.strftime('%d/%m/%Y')}.",
            notif_type="absence_report",
            reference_type="absence_report",
            reference_id=report.id,
            action_url="/dashboard/my-space",
            priority="normal",
        )
        report.notification_sent = True

    # Notifier les RH/Admin du tenant
    try:
        managers = db.execute(
            text("""
                SELECT u.id, u.employee_id FROM users u
                WHERE u.role::text IN ('admin', 'super_admin', 'dg', 'rh')
                  AND u.tenant_id = :tid AND u.id != :uid
                  AND u.employee_id IS NOT NULL
            """),
            {
                "tid": current_user.tenant_id,
                "uid": current_user.id,
            }
        ).fetchall()
        emp_name_display = f"{target_row[2] or ''} {target_row[3] or ''}".strip() or f"l'employé #{body.employee_id}"
        type_label = TYPE_LABELS.get(body.type, body.type)
        for mgr_user_id, mgr_emp_id in managers:
            create_notification(
                db, current_user.tenant_id, mgr_user_id, mgr_emp_id,
                title=f"Nouveau constat : {type_label}",
                message=f"Un constat de {type_label.lower()} a été enregistré pour {emp_name_display} le {body.absence_date.strftime('%d/%m/%Y')}.",
                notif_type="absence_report",
                reference_type="absence_report",
                reference_id=report.id,
                action_url="/dashboard/employees?tab=absences",
                priority="normal",
            )
    except Exception as e:
        logger.warning(f"[absences] Manager notification error: {e}")

    db.commit()
    db.refresh(report)
    return _enrich(report, db)


@router.get("")
def list_absence_reports(
    status:   Optional[str] = Query(None),
    type:     Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    from_date:   Optional[date] = Query(None),
    to_date:     Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lister les constats.
    manager → voit uniquement son équipe.
    RH/Admin/DG → voit tout le tenant.
    """
    if current_user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Accès refusé")

    filters = ["ar.tenant_id = :tid"]
    params: dict = {"tid": current_user.tenant_id}

    if status:
        filters.append("ar.status = :status")
        params["status"] = status
    if type:
        filters.append("ar.type = :atype")
        params["atype"] = type
    if employee_id:
        filters.append("ar.employee_id = :eid")
        params["eid"] = employee_id
    if from_date:
        filters.append("ar.absence_date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        filters.append("ar.absence_date <= :to_date")
        params["to_date"] = to_date

    # MANAGER : restreindre à son équipe (via users.employee_id)
    if current_user.role == UserRole.MANAGER:
        filters.append("""
            ar.employee_id IN (
                SELECT id FROM employees
                WHERE manager_id = :manager_emp_id
                AND tenant_id = :tid
            )
        """)
        params["manager_emp_id"] = current_user.employee_id

    where = " AND ".join(filters)
    count_row = db.execute(
        text(f"SELECT COUNT(*) FROM absence_reports ar WHERE {where}"), params
    ).fetchone()
    total = count_row[0] if count_row else 0

    rows = db.execute(
        text(f"""
            SELECT ar.*, 
                   e.first_name as emp_fn, e.last_name as emp_ln,
                   r.first_name as rep_fn, r.last_name as rep_ln
            FROM absence_reports ar
            LEFT JOIN employees e ON e.id = ar.employee_id
            LEFT JOIN employees r ON r.id = ar.reported_by_id
            WHERE {where}
            ORDER BY ar.absence_date DESC, ar.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": limit, "offset": offset}
    ).fetchall()

    items = []
    for row in rows:
        d = dict(row._mapping)
        d["employee_name"] = f"{d.pop('emp_fn', '') or ''} {d.pop('emp_ln', '') or ''}".strip()
        d["reporter_name"]  = f"{d.pop('rep_fn', '') or ''} {d.pop('rep_ln', '') or ''}".strip()
        # Normalize enums to string values
        if hasattr(d.get("type"), "value"):
            d["type"] = d["type"].value
        if hasattr(d.get("status"), "value"):
            d["status"] = d["status"].value
        items.append(d)

    return {"items": items, "total": total}


@router.get("/stats")
def get_absence_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Statistiques globales d'absence/retard pour le tenant."""
    import traceback
    try:
        return _get_absence_stats_inner(db, current_user)
    except HTTPException:
        raise
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("[absences] GET /absences/stats ERREUR COMPLETE:\n%s", tb)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

def _get_absence_stats_inner(
    db: Session,
    current_user: User,
):
    if current_user.role not in [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    tid = current_user.tenant_id

    totals_row = db.execute(text("""
        SELECT
          COUNT(*) FILTER (WHERE 1=1) AS total,
          COUNT(*) FILTER (WHERE status::text = 'pending')    AS pending,
          COUNT(*) FILTER (WHERE status::text = 'justified')  AS justified,
          COUNT(*) FILTER (WHERE status::text = 'unjustified') AS unjustified,
          COUNT(*) FILTER (WHERE absence_date >= now()::date - 7)  AS last_7_days,
          COUNT(*) FILTER (WHERE absence_date >= now()::date - 30) AS last_30_days
        FROM absence_reports WHERE tenant_id = :tid
    """), {"tid": tid}).fetchone()

    by_type_rows = db.execute(text("""
        SELECT type::text, COUNT(*) AS cnt
        FROM absence_reports WHERE tenant_id = :tid
        GROUP BY type ORDER BY cnt DESC
    """), {"tid": tid}).fetchall()

    by_employee_rows = db.execute(text("""
        SELECT ar.employee_id, e.first_name, e.last_name, COUNT(*) AS cnt
        FROM absence_reports ar
        JOIN employees e ON e.id = ar.employee_id
        WHERE ar.tenant_id = :tid AND ar.absence_date >= now()::date - 90
        GROUP BY ar.employee_id, e.first_name, e.last_name
        ORDER BY cnt DESC LIMIT 5
    """), {"tid": tid}).fetchall()

    trend_rows = db.execute(text("""
        SELECT absence_date::text AS abs_date, COUNT(*) AS cnt
        FROM absence_reports
        WHERE tenant_id = :tid AND absence_date >= now()::date - 30
        GROUP BY abs_date ORDER BY abs_date ASC
    """), {"tid": tid}).fetchall()

    type_labels = {
        "absence": "Absence", "tardiness": "Retard",
        "early_departure": "Départ anticipé", "unauthorized_absence": "Absence non autorisée",
        "sick_leave": "Arrêt maladie",
    }

    m = totals_row._mapping if totals_row else {}
    return {
        "total":       m.get("total", 0),
        "pending":     m.get("pending", 0),
        "justified":   m.get("justified", 0),
        "unjustified": m.get("unjustified", 0),
        "last_7_days":  m.get("last_7_days", 0),
        "last_30_days": m.get("last_30_days", 0),
        "by_type": [
            {"type": r[0], "label": type_labels.get(r[0], r[0]), "count": r[1]}
            for r in by_type_rows
        ],
        "top_employees": [
            {"employee_id": r[0], "name": f"{r[1] or ''} {r[2] or ''}".strip(), "count": r[3]}
            for r in by_employee_rows
        ],
        "trend": [{"date": r[0], "count": r[1]} for r in trend_rows],
    }


@router.get("/{report_id}")
def get_absence_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Accès refusé")
    report = db.query(AbsenceReport).filter(
        AbsenceReport.id == report_id,
        AbsenceReport.tenant_id == current_user.tenant_id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Constat introuvable")
    return _enrich(report, db)


@router.put("/{report_id}")
def update_absence_report(
    report_id: int,
    body: AbsenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Accès refusé")
    report = db.query(AbsenceReport).filter(
        AbsenceReport.id == report_id,
        AbsenceReport.tenant_id == current_user.tenant_id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Constat introuvable")

    if body.status:
        try:
            report.status = AbsenceStatus(body.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Statut invalide : {body.status}")
    if body.reason              is not None: report.reason              = body.reason
    if body.notes               is not None: report.notes               = body.notes
    if body.document            is not None: report.document            = body.document
    if body.expected_start_time is not None: report.expected_start_time = body.expected_start_time
    if body.actual_start_time   is not None: report.actual_start_time   = body.actual_start_time
    if body.duration_minutes    is not None: report.duration_minutes    = body.duration_minutes

    db.commit()
    db.refresh(report)
    return _enrich(report, db)


@router.delete("/{report_id}", status_code=204)
def delete_absence_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Seuls les RH/Admin peuvent supprimer un constat")
    report = db.query(AbsenceReport).filter(
        AbsenceReport.id == report_id,
        AbsenceReport.tenant_id == current_user.tenant_id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Constat introuvable")
    db.delete(report)
    db.commit()
