"""
Service centralisé de création de notifications.

Insère des entrées dans la table `notifications` via SQL brut
(pas d'ORM model dédié, conformément au pattern existant dans sos.py).

Usage:
    from app.services.notification_service import (
        notify_leave_created,
        notify_leave_decision,
        notify_signature_request,
        notify_signature_action,
    )
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Primitive interne
# ---------------------------------------------------------------------------

def _insert_notification(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    title: str,
    message: str,
    notif_type: str,
    priority: str = "normal",
    reference_type: str = None,
    reference_id: int = None,
    action_url: str = None,
    employee_id: int = None,
):
    """Insère une notification pour un utilisateur. Silencieux en cas d'erreur."""
    try:
        db.execute(
            text("""
                INSERT INTO notifications
                    (tenant_id, user_id, employee_id, title, message,
                     type, priority, reference_type, reference_id, action_url)
                VALUES
                    (:tenant_id, :user_id, :employee_id, :title, :message,
                     :type, :priority, :reference_type, :reference_id, :action_url)
            """),
            {
                "tenant_id":      tenant_id,
                "user_id":        user_id,
                "employee_id":    employee_id,
                "title":          title,
                "message":        message,
                "type":           notif_type,
                "priority":       priority,
                "reference_type": reference_type,
                "reference_id":   reference_id,
                "action_url":     action_url,
            },
        )
    except Exception as exc:
        logger.error("notification_service._insert_notification error: %s", exc)


# ---------------------------------------------------------------------------
# Congés (Leaves)
# ---------------------------------------------------------------------------

def notify_leave_created(db: Session, tenant_id: int, employee, leave_request, leave_type_name: str):
    """
    Notifie tous les responsables RH / Admin / DG du tenant qu'une nouvelle
    demande de congé vient d'être soumise.

    Args:
        employee   : instance Employee (doit avoir first_name, last_name, id)
        leave_request : instance LeaveRequest (start_date, end_date, days_requested, id)
        leave_type_name : nom du type de congé (ex. "Congé payé")
    """
    try:
        from app.models.user import User, UserRole

        days = float(leave_request.days_requested)
        emp_name = f"{employee.first_name} {employee.last_name}"
        title = "Nouvelle demande de congé"
        message = (
            f"{emp_name} a déposé une demande de {leave_type_name} "
            f"du {leave_request.start_date.strftime('%d/%m/%Y')} "
            f"au {leave_request.end_date.strftime('%d/%m/%Y')} "
            f"({days:g} jour{'s' if days > 1 else ''})."
        )

        # Destinataires : tous les users admin/rh/dg du tenant
        admins = (
            db.query(User)
            .filter(
                User.tenant_id == tenant_id,
                User.is_active == True,
                User.role.in_([UserRole.ADMIN, UserRole.RH, UserRole.DG]),
            )
            .all()
        )

        for admin in admins:
            _insert_notification(
                db,
                tenant_id=tenant_id,
                user_id=admin.id,
                employee_id=employee.id,
                title=title,
                message=message,
                notif_type="leave_request",
                priority="normal",
                reference_type="leave_request",
                reference_id=leave_request.id,
                action_url="/dashboard/leaves",
            )
        db.commit()
    except Exception as exc:
        logger.error("notify_leave_created error: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass


def notify_leave_decision(db: Session, tenant_id: int, leave_request, approved: bool, rejection_reason: str = None):
    """
    Notifie l'employé que sa demande de congé a été approuvée ou refusée.

    Args:
        leave_request : instance LeaveRequest (employee_id, start_date, end_date, id)
        approved      : True = approuvée, False = refusée
        rejection_reason : motif de refus (optionnel)
    """
    try:
        from app.models.user import User

        # Trouver le compte utilisateur lié à cet employé
        employee_user = (
            db.query(User)
            .filter(
                User.tenant_id == tenant_id,
                User.employee_id == leave_request.employee_id,
                User.is_active == True,
            )
            .first()
        )

        if not employee_user:
            return  # Pas de compte utilisateur → pas de notification

        start = leave_request.start_date.strftime("%d/%m/%Y")
        end = leave_request.end_date.strftime("%d/%m/%Y")

        if approved:
            title = "Congé approuvé ✓"
            message = f"Votre demande de congé du {start} au {end} a été approuvée."
            notif_type = "leave_approved"
            priority = "normal"
        else:
            title = "Demande de congé refusée"
            reason_part = f" Motif : {rejection_reason}" if rejection_reason else ""
            message = f"Votre demande de congé du {start} au {end} a été refusée.{reason_part}"
            notif_type = "leave_rejected"
            priority = "high"

        _insert_notification(
            db,
            tenant_id=tenant_id,
            user_id=employee_user.id,
            employee_id=leave_request.employee_id,
            title=title,
            message=message,
            notif_type=notif_type,
            priority=priority,
            reference_type="leave_request",
            reference_id=leave_request.id,
            action_url="/dashboard/my-space",
        )
        db.commit()
    except Exception as exc:
        logger.error("notify_leave_decision error: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Signatures électroniques
# ---------------------------------------------------------------------------

def notify_signature_request(db: Session, tenant_id: int, employee, document):
    """
    Notifie un employé qu'il a un document à signer.

    Args:
        employee  : instance Employee (email, first_name, last_name, id)
        document  : instance SignatureDocument (title, id)
    """
    try:
        from app.models.user import User

        # Trouver le compte utilisateur de l'employé (match par email)
        employee_user = (
            db.query(User)
            .filter(
                User.email == employee.email,
                User.tenant_id == tenant_id,
                User.is_active == True,
            )
            .first()
        )

        if not employee_user:
            # Fallback : match par employee_id si disponible
            employee_user = (
                db.query(User)
                .filter(
                    User.tenant_id == tenant_id,
                    User.employee_id == employee.id,
                    User.is_active == True,
                )
                .first()
            )

        if not employee_user:
            return

        _insert_notification(
            db,
            tenant_id=tenant_id,
            user_id=employee_user.id,
            employee_id=employee.id,
            title="Document à signer",
            message=f"Vous avez un document à signer : « {document.title} ».",
            notif_type="signature_request",
            priority="high",
            reference_type="signature_document",
            reference_id=document.id,
            action_url="/dashboard/my-space",
        )
        db.commit()
    except Exception as exc:
        logger.error("notify_signature_request error (employee=%s): %s", getattr(employee, 'id', '?'), exc)
        try:
            db.rollback()
        except Exception:
            pass


def notify_signature_action(db: Session, tenant_id: int, document, employee_name: str, action: str):
    """
    Notifie le créateur du document qu'un signataire a agi (signé ou refusé).

    Args:
        document      : instance SignatureDocument (created_by_user_id, title, id)
        employee_name : nom complet du signataire
        action        : "signed" | "rejected"
    """
    if not document.created_by_user_id:
        return

    try:
        from app.models.user import User

        creator = db.query(User).filter(User.id == document.created_by_user_id).first()
        if not creator:
            return

        if action == "signed":
            title = "Document signé"
            message = f"« {document.title} » a été signé par {employee_name}."
            notif_type = "signature_signed"
            priority = "normal"
        else:  # rejected
            title = "Signature refusée"
            message = f"{employee_name} a refusé de signer « {document.title} »."
            notif_type = "signature_rejected"
            priority = "high"

        _insert_notification(
            db,
            tenant_id=tenant_id,
            user_id=creator.id,
            employee_id=None,
            title=title,
            message=message,
            notif_type=notif_type,
            priority=priority,
            reference_type="signature_document",
            reference_id=document.id,
            action_url="/dashboard/employees/signatures",
        )
        db.commit()
    except Exception as exc:
        logger.error("notify_signature_action error (doc=%s, action=%s): %s", document.id, action, exc)
        try:
            db.rollback()
        except Exception:
            pass
