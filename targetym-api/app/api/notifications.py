"""
Notifications API Router
Endpoints pour gérer les notifications utilisateur
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def get_user_id(current_user) -> int:
    if isinstance(current_user, dict):
        return current_user.get("user_id") or current_user.get("sub") or current_user.get("id")
    return getattr(current_user, "id", None) or getattr(current_user, "user_id", None)


def get_tenant_id(current_user) -> int:
    if isinstance(current_user, dict):
        return current_user.get("tenant_id", 1)
    return getattr(current_user, "tenant_id", 1)


# GET /api/notifications/ — Liste paginée
@router.get("/")
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_read: Optional[bool] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_id = get_user_id(current_user)
    tenant_id = get_tenant_id(current_user)
    
    where = ["n.user_id = :user_id", "n.tenant_id = :tenant_id", "(n.expires_at IS NULL OR n.expires_at > NOW())"]
    params: dict = {"user_id": user_id, "tenant_id": tenant_id}
    
    if is_read is not None:
        where.append("n.is_read = :is_read")
        params["is_read"] = is_read
    if type:
        where.append("n.type = :type")
        params["type"] = type
    
    where_sql = " AND ".join(where)
    
    total = db.execute(text(f"SELECT COUNT(*) FROM notifications n WHERE {where_sql}"), params).scalar()
    
    params["limit"] = page_size
    params["offset"] = (page - 1) * page_size
    
    rows = db.execute(text(f"""
        SELECT n.id, n.title, n.message, n.type, n.priority,
               n.reference_type, n.reference_id, n.action_url,
               n.is_read, n.read_at, n.created_at
        FROM notifications n WHERE {where_sql}
        ORDER BY n.created_at DESC LIMIT :limit OFFSET :offset
    """), params).fetchall()
    
    return {
        "items": [{
            "id": r.id, "title": r.title, "message": r.message,
            "type": r.type, "priority": r.priority,
            "reference_type": r.reference_type, "reference_id": r.reference_id,
            "action_url": r.action_url, "is_read": r.is_read,
            "read_at": r.read_at.isoformat() if r.read_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in rows],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


# GET /api/notifications/unread-count
@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user_id = get_user_id(current_user)
    tenant_id = get_tenant_id(current_user)
    count = db.execute(text("""
        SELECT COUNT(*) FROM notifications
        WHERE user_id = :user_id AND tenant_id = :tenant_id AND is_read = false
        AND (expires_at IS NULL OR expires_at > NOW())
    """), {"user_id": user_id, "tenant_id": tenant_id}).scalar()
    return {"count": count}


# GET /api/notifications/recent — 5 dernières pour dropdown
@router.get("/recent")
def recent_notifications(
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_id = get_user_id(current_user)
    tenant_id = get_tenant_id(current_user)
    rows = db.execute(text("""
        SELECT id, title, message, type, priority, action_url, is_read, created_at
        FROM notifications
        WHERE user_id = :user_id AND tenant_id = :tenant_id
        AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT :limit
    """), {"user_id": user_id, "tenant_id": tenant_id, "limit": limit}).fetchall()
    
    return {"items": [{
        "id": r.id, "title": r.title, "message": r.message,
        "type": r.type, "priority": r.priority, "action_url": r.action_url,
        "is_read": r.is_read,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]}


# PUT /api/notifications/{id}/read
@router.put("/{notification_id}/read")
def mark_as_read(notification_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user_id = get_user_id(current_user)
    result = db.execute(text("""
        UPDATE notifications SET is_read = true, read_at = NOW()
        WHERE id = :id AND user_id = :user_id AND is_read = false RETURNING id
    """), {"id": notification_id, "user_id": user_id}).fetchone()
    db.commit()
    if not result:
        raise HTTPException(status_code=404, detail="Notification non trouvée")
    return {"success": True, "id": notification_id}


# PUT /api/notifications/read-all
@router.put("/read-all")
def mark_all_as_read(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user_id = get_user_id(current_user)
    tenant_id = get_tenant_id(current_user)
    result = db.execute(text("""
        UPDATE notifications SET is_read = true, read_at = NOW()
        WHERE user_id = :user_id AND tenant_id = :tenant_id AND is_read = false
    """), {"user_id": user_id, "tenant_id": tenant_id})
    db.commit()
    return {"success": True, "updated": result.rowcount}


# DELETE /api/notifications/{id}
@router.delete("/{notification_id}")
def delete_notification(notification_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user_id = get_user_id(current_user)
    result = db.execute(text("""
        DELETE FROM notifications WHERE id = :id AND user_id = :user_id RETURNING id
    """), {"id": notification_id, "user_id": user_id}).fetchone()
    db.commit()
    if not result:
        raise HTTPException(status_code=404, detail="Notification non trouvée")
    return {"success": True, "deleted": notification_id}


# ============================================
# PRÉFÉRENCES DE NOTIFICATIONS
# ============================================

NOTIFICATION_CATEGORIES = [
    {"key": "leave_requests", "label": "Demandes de congés", "description": "Nouvelles demandes et validations de congés"},
    {"key": "documents", "label": "Documents", "description": "Nouveaux documents ajoutés à votre dossier"},
    {"key": "onboarding", "label": "Onboarding", "description": "Étapes d'intégration des nouveaux collaborateurs"},
    {"key": "departures", "label": "Départs", "description": "Procédures de départ et offboarding"},
    {"key": "evaluations", "label": "Évaluations", "description": "Campagnes et évaluations de performance"},
    {"key": "objectives", "label": "Objectifs OKR", "description": "Mises à jour sur les objectifs de l'équipe"},
    {"key": "missions", "label": "Missions", "description": "Demandes et validations de missions"},
    {"key": "weekly_report", "label": "Rapports hebdomadaires", "description": "Résumé hebdomadaire par email"},
]


@router.get("/preferences")
def get_preferences(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user_id = get_user_id(current_user)
    tenant_id = get_tenant_id(current_user)

    rows = db.execute(text("""
        SELECT category, enabled FROM notification_preferences
        WHERE user_id = :uid AND tenant_id = :tid
    """), {"uid": user_id, "tid": tenant_id}).fetchall()

    saved = {r.category: r.enabled for r in rows}

    return {
        "categories": [
            {**cat, "enabled": saved.get(cat["key"], True)}
            for cat in NOTIFICATION_CATEGORIES
        ]
    }


@router.put("/preferences")
def update_preferences(
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_id = get_user_id(current_user)
    tenant_id = get_tenant_id(current_user)
    preferences = body.get("preferences", {})

    valid_keys = {c["key"] for c in NOTIFICATION_CATEGORIES}

    for key, enabled in preferences.items():
        if key not in valid_keys:
            continue
        db.execute(text("""
            INSERT INTO notification_preferences (user_id, tenant_id, category, enabled)
            VALUES (:uid, :tid, :cat, :enabled)
            ON CONFLICT (user_id, tenant_id, category)
            DO UPDATE SET enabled = :enabled
        """), {"uid": user_id, "tid": tenant_id, "cat": key, "enabled": bool(enabled)})

    db.commit()
    return {"success": True}
