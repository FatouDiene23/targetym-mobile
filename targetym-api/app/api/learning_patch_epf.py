# =============================================
# PATCH: Auto-déclenchement Évaluation Post-Formation
# File: app/api/learning_patch_epf.py
#
# Ce fichier contient la fonction à appeler dans le endpoint
# validate_assignment de learning.py pour auto-créer une
# évaluation post-formation quand une formation est validée.
# =============================================

from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import Optional

from app.models.post_training_evaluation import PostTrainingEvaluation, PostTrainingEvalSettings
from app.models.learning import CourseAssignment, Course
from app.models.employee import Employee


def get_or_create_settings(tenant_id: int, db: Session) -> PostTrainingEvalSettings:
    """Récupère ou crée les paramètres EPF pour un tenant"""
    settings = db.query(PostTrainingEvalSettings).filter(
        PostTrainingEvalSettings.tenant_id == tenant_id
    ).first()
    if not settings:
        settings = PostTrainingEvalSettings(tenant_id=tenant_id)
        db.add(settings)
        db.flush()
    return settings


def trigger_post_training_evaluation(
    assignment_id: int,
    tenant_id: int,
    db: Session,
    evaluator_id: Optional[int] = None
) -> Optional[PostTrainingEvaluation]:
    """
    Déclenche automatiquement une évaluation post-formation (EPF-01).

    Appelé quand un CourseAssignment passe à status='completed'.

    Args:
        assignment_id: ID de l'assignation validée
        tenant_id: ID du tenant
        db: Session SQLAlchemy
        evaluator_id: ID de l'évaluateur (optionnel, sera assigné plus tard si None)

    Returns:
        PostTrainingEvaluation créée ou None si déjà existante
    """
    # Vérifier qu'il n'y a pas déjà une évaluation pour cet assignment
    existing = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.assignment_id == assignment_id,
        PostTrainingEvaluation.status.notin_(["cancelled"])
    ).first()

    if existing:
        return None  # Évaluation déjà existante, ne pas dupliquer

    # Récupérer l'assignment
    assignment = db.query(CourseAssignment).filter(
        CourseAssignment.id == assignment_id
    ).first()

    if not assignment:
        return None

    # Récupérer les paramètres EPF
    settings = get_or_create_settings(tenant_id, db)

    # Calculer les dates selon le délai configuré
    today = date.today()
    scheduled_date = today + timedelta(days=settings.trigger_delay_days)
    due_date = scheduled_date + timedelta(days=14)  # 2 semaines pour évaluer

    # Si evaluator_type = 'internal' et pas d'évaluateur spécifié,
    # on assigne le manager de l'employé par défaut
    if not evaluator_id and settings.default_evaluator_type == "internal":
        employee = db.query(Employee).filter(
            Employee.id == assignment.employee_id
        ).first()
        if employee and employee.manager_id:
            evaluator_id = employee.manager_id

    # Créer l'évaluation post-formation
    pte = PostTrainingEvaluation(
        tenant_id=tenant_id,
        assignment_id=assignment_id,
        course_id=assignment.course_id,
        employee_id=assignment.employee_id,
        evaluator_id=evaluator_id,
        evaluator_type=settings.default_evaluator_type,
        scheduled_date=scheduled_date,
        due_date=due_date,
        status="pending",
        criteria_scores=settings.default_criteria  # Pré-remplir les critères
    )

    db.add(pte)
    db.flush()

    return pte


# =============================================
# CODE À INTÉGRER DANS learning.py
# =============================================
#
# Dans le endpoint validate_assignment, après la ligne:
#   a.status = "completed"
#
# Ajouter:
#
# ```python
# # === EPF: Auto-déclenchement évaluation post-formation ===
# try:
#     from app.api.learning_patch_epf import trigger_post_training_evaluation
#     pte = trigger_post_training_evaluation(
#         assignment_id=a.id,
#         tenant_id=current_user.tenant_id,
#         db=db,
#         evaluator_id=None  # Sera le manager par défaut
#     )
#     if pte:
#         print(f"[EPF] Évaluation post-formation #{pte.id} créée pour assignment #{a.id}")
# except Exception as e:
#     print(f"[EPF] Erreur création évaluation post-formation: {e}")
#     # Ne pas bloquer la validation si l'EPF échoue
# ```
#
# =============================================
