# =============================================
# API ROUTES - Alertes SOS (Bouton de détresse)
# File: app/api/sos.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, desc
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.sos_alert import SOSAlert
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sos", tags=["SOS - Alertes de détresse"])

# =============================================
# SCHEMAS
# =============================================

PRIORITY_ROLES = [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPER_ADMIN]


class SOSCreate(BaseModel):
    category: str = "general"
    message: Optional[str] = None
    is_anonymous: bool = False
    location_hint: Optional[str] = None


class SOSUpdateStatus(BaseModel):
    status: str  # acknowledged | in_progress | resolved | closed
    resolution_note: Optional[str] = None


class SOSResponse(BaseModel):
    id: int
    category: str
    message: Optional[str] = None
    is_anonymous: bool
    status: str
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    employee_id: Optional[int] = None
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    location_hint: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SOSListResponse(BaseModel):
    items: List[SOSResponse]
    total: int
    new_count: int


# =============================================
# HELPERS
# =============================================

CATEGORY_LABELS = {
    "general":     "Situation générale",
    "harassment":  "Harcèlement",
    "burnout":     "Épuisement (burnout)",
    "conflict":    "Conflit",
    "security":    "Sécurité physique",
    "health":      "Problème de santé",
    "equipment":   "Outils / Matériel",
}

STATUS_LABELS = {
    "new":          "Nouveau",
    "acknowledged": "Pris en compte",
    "in_progress":  "En cours de traitement",
    "resolved":     "Résolu",
    "closed":       "Fermé",
}


def _notify_priority_users(db: Session, tenant_id: int, alert: SOSAlert, sender_name: str):
    """Envoie une notification à tous les RH, Admin et DG du tenant."""
    try:
        rows = db.execute(
            text("SELECT id, employee_id FROM users WHERE tenant_id = :tid AND role IN ('rh', 'admin', 'dg') AND is_active = true"),
            {"tid": tenant_id}
        ).fetchall()

        category_label = CATEGORY_LABELS.get(alert.category, alert.category)
        title = f"🆘 Alerte SOS reçue — {category_label}"
        message = (
            f"{'Un collaborateur (anonyme)' if alert.is_anonymous else sender_name} "
            f"a déclenché une alerte : {category_label}."
            + (f" Message : {alert.message[:100]}" if alert.message else "")
        )

        for row in rows:
            db.execute(text("""
                INSERT INTO notifications (tenant_id, user_id, employee_id, title, message,
                    type, priority, reference_type, reference_id, action_url)
                VALUES (:tenant_id, :user_id, :employee_id, :title, :message,
                    'sos_alert', 'urgent', 'sos_alert', :ref_id, '/dashboard/employees/sos')
            """), {
                "tenant_id": tenant_id,
                "user_id": row[0],
                "employee_id": row[1],
                "title": title,
                "message": message,
                "ref_id": alert.id,
            })
        db.commit()
    except Exception as e:
        logger.error(f"Error notifying SOS recipients: {e}")
        db.rollback()


def _alert_to_response(a: SOSAlert, db: Session, include_identity: bool = True) -> SOSResponse:
    sender_name = None
    sender_email = None
    if not a.is_anonymous and include_identity:
        user = db.query(User).filter(User.id == a.user_id).first()
        if user:
            sender_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
            sender_email = user.email

    handler_name = None
    if a.handled_by_id:
        h = db.query(User).filter(User.id == a.handled_by_id).first()
        if h:
            handler_name = f"{h.first_name or ''} {h.last_name or ''}".strip() or h.email

    return SOSResponse(
        id=a.id,
        category=a.category,
        message=a.message if (not a.is_anonymous or include_identity) else None,
        is_anonymous=a.is_anonymous,
        status=a.status,
        sender_name=sender_name,
        sender_email=sender_email,
        employee_id=a.employee_id if (not a.is_anonymous or include_identity) else None,
        handled_by=handler_name,
        handled_at=a.handled_at,
        resolution_note=a.resolution_note,
        location_hint=a.location_hint,
        created_at=a.created_at,
    )


# =============================================
# ROUTES
# =============================================

@router.post("", response_model=SOSResponse)
@router.post("/", response_model=SOSResponse, include_in_schema=False)
def trigger_sos(
    payload: SOSCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Déclencher une alerte SOS. Accessible à tous les utilisateurs connectés."""
    alert = SOSAlert(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        employee_id=current_user.employee_id,
        category=payload.category,
        message=payload.message,
        is_anonymous=payload.is_anonymous,
        location_hint=payload.location_hint,
        status="new",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Notifier RH + DG + Admin
    sender_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email
    _notify_priority_users(db, current_user.tenant_id, alert, sender_name)

    return _alert_to_response(alert, db, include_identity=True)


@router.get("/mine", response_model=SOSListResponse)
def list_my_sos_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mes propres alertes SOS — accessible à tout utilisateur connecté."""
    query = db.query(SOSAlert).filter(
        SOSAlert.tenant_id == current_user.tenant_id,
        SOSAlert.user_id == current_user.id,
    )

    total = query.count()
    # "nouvelle" = pas encore résolue / fermée
    new_count = query.filter(
        SOSAlert.status.notin_(["resolved", "closed"])
    ).count()

    alerts = query.order_by(desc(SOSAlert.created_at)).limit(50).all()
    return SOSListResponse(
        items=[_alert_to_response(a, db, include_identity=True) for a in alerts],
        total=total,
        new_count=new_count,
    )


@router.get("", response_model=SOSListResponse)
@router.get("/", response_model=SOSListResponse, include_in_schema=False)
def list_sos_alerts(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste des alertes SOS. RH / Admin / DG uniquement."""
    if current_user.role not in PRIORITY_ROLES:
        raise HTTPException(status_code=403, detail="Réservé aux RH / Admin / DG")

    query = db.query(SOSAlert).filter(SOSAlert.tenant_id == current_user.tenant_id)
    if status:
        query = query.filter(SOSAlert.status == status)
    if category:
        query = query.filter(SOSAlert.category == category)

    total = query.count()
    new_count = db.query(SOSAlert).filter(
        SOSAlert.tenant_id == current_user.tenant_id,
        SOSAlert.status == "new"
    ).count()

    alerts = query.order_by(desc(SOSAlert.created_at)).offset(skip).limit(limit).all()
    return SOSListResponse(
        items=[_alert_to_response(a, db, include_identity=True) for a in alerts],
        total=total,
        new_count=new_count,
    )


@router.put("/{alert_id}/status", response_model=SOSResponse)
def update_sos_status(
    alert_id: int,
    payload: SOSUpdateStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mettre à jour le statut d'une alerte. RH / Admin / DG uniquement."""
    if current_user.role not in PRIORITY_ROLES:
        raise HTTPException(status_code=403, detail="Réservé aux RH / Admin / DG")

    alert = db.query(SOSAlert).filter(
        SOSAlert.id == alert_id,
        SOSAlert.tenant_id == current_user.tenant_id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    alert.status = payload.status
    if payload.resolution_note:
        alert.resolution_note = payload.resolution_note
    if payload.status in ("acknowledged", "in_progress", "resolved", "closed"):
        alert.handled_by_id = current_user.id
        alert.handled_at = datetime.utcnow()

    db.commit()
    db.refresh(alert)
    return _alert_to_response(alert, db, include_identity=True)


@router.delete("/{alert_id}")
def delete_sos_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprimer une alerte SOS.
    - L'auteur peut supprimer sa propre alerte si elle est encore au statut 'new'.
    - RH / Admin / DG peuvent supprimer n'importe quelle alerte.
    """
    alert = db.query(SOSAlert).filter(
        SOSAlert.id == alert_id,
        SOSAlert.tenant_id == current_user.tenant_id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    is_owner = alert.user_id == current_user.id
    is_admin = current_user.role in PRIORITY_ROLES

    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à supprimer cette alerte")

    if is_owner and not is_admin and alert.status != "new":
        raise HTTPException(
            status_code=400,
            detail="Vous ne pouvez supprimer votre alerte que si elle n'a pas encore été prise en charge"
        )

    db.delete(alert)
    db.commit()
    return {"success": True, "message": "Alerte supprimée"}


@router.get("/stats")
def sos_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Statistiques SOS pour le tableau de bord admin/DG."""
    if current_user.role not in PRIORITY_ROLES:
        raise HTTPException(status_code=403, detail="Réservé aux RH / Admin / DG")

    rows = db.execute(text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'new') AS new_alerts,
            COUNT(*) FILTER (WHERE status IN ('acknowledged', 'in_progress')) AS in_progress,
            COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
            COUNT(*) FILTER (WHERE status = 'closed') AS closed,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS last_30_days,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7_days
        FROM sos_alerts
        WHERE tenant_id = :tid
    """), {"tid": current_user.tenant_id}).fetchone()

    # Répartition par catégorie
    cat_rows = db.execute(text("""
        SELECT category, COUNT(*) as count
        FROM sos_alerts
        WHERE tenant_id = :tid
        GROUP BY category
        ORDER BY count DESC
    """), {"tid": current_user.tenant_id}).fetchall()

    # Heatmap : alertes par jour sur les 30 derniers jours
    heatmap_rows = db.execute(text("""
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM sos_alerts
        WHERE tenant_id = :tid AND created_at >= now() - interval '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day
    """), {"tid": current_user.tenant_id}).fetchall()

    return {
        "total": rows[0],
        "new_alerts": rows[1],
        "in_progress": rows[2],
        "resolved": rows[3],
        "closed": rows[4],
        "last_30_days": rows[5],
        "last_7_days": rows[6],
        "by_category": [{"category": r[0], "count": r[1], "label": CATEGORY_LABELS.get(r[0], r[0])} for r in cat_rows],
        "heatmap": [{"date": str(r[0]), "count": r[1]} for r in heatmap_rows],
    }
