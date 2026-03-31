# =============================================
# API ROUTES: Évaluation Post-Formation (EPF)
# File: app/api/post_training_eval.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from typing import Optional, List
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.post_training_evaluation import PostTrainingEvaluation, PostTrainingEvalSettings
from app.models.learning import Course, CourseAssignment
from app.models.employee import Employee
from app.models.user import User
from app.api.deps import get_current_user
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_LEARNING

router = APIRouter(prefix="/api/learning/post-eval", tags=["Évaluation Post-Formation"], dependencies=[Depends(require_feature(FEATURE_LEARNING))])


# =============================================
# SCHEMAS
# =============================================

class CriteriaScoreItem(BaseModel):
    code: str
    label: str
    score: float = Field(ge=0, le=100)
    weight: float = Field(ge=0, le=100)

class EvaluateRequest(BaseModel):
    """Soumettre une évaluation (EPF-02)"""
    criteria_scores: List[CriteriaScoreItem]
    comments: Optional[str] = None
    strengths: Optional[str] = None
    improvements: Optional[str] = None

class AssignEvaluatorRequest(BaseModel):
    """Assigner un évaluateur"""
    evaluator_id: int
    evaluator_type: str = "internal"  # 'trainer' | 'internal'

class SettingsUpdate(BaseModel):
    """Mise à jour des paramètres EPF"""
    trigger_delay_days: Optional[int] = None
    default_evaluator_type: Optional[str] = None
    passing_threshold: Optional[int] = None
    auto_retrain: Optional[bool] = None
    default_criteria: Optional[list] = None


# =============================================
# HELPERS
# =============================================

def get_employee_id_or_error(current_user: User, db: Session) -> int:
    """Récupère l'employee_id de l'utilisateur courant."""
    if current_user.employee_id:
        return current_user.employee_id
    employee = db.query(Employee).filter(
        Employee.email == current_user.email,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    if employee:
        current_user.employee_id = employee.id
        db.commit()
        return employee.id
    raise HTTPException(400, "Compte non lié à un profil employé")


def get_user_role(current_user: User) -> str:
    return str(current_user.role.value).lower() if current_user.role else 'employee'


def get_or_create_settings(tenant_id: int, db: Session) -> PostTrainingEvalSettings:
    """Récupère ou crée les paramètres EPF pour un tenant"""
    settings = db.query(PostTrainingEvalSettings).filter(
        PostTrainingEvalSettings.tenant_id == tenant_id
    ).first()
    if not settings:
        settings = PostTrainingEvalSettings(tenant_id=tenant_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def compute_final_score(criteria_scores: list) -> float:
    """Calcule le score final pondéré /100"""
    total_weight = sum(c.get("weight", 0) for c in criteria_scores)
    if total_weight == 0:
        return 0.0
    weighted_sum = sum(
        c.get("score", 0) * c.get("weight", 0) / total_weight
        for c in criteria_scores
    )
    return round(weighted_sum, 1)


def enrich_evaluation(pte: PostTrainingEvaluation, db: Session) -> dict:
    """Enrichit une évaluation avec les infos liées"""
    employee = db.query(Employee).filter(Employee.id == pte.employee_id).first()
    evaluator = db.query(Employee).filter(Employee.id == pte.evaluator_id).first() if pte.evaluator_id else None
    course = db.query(Course).filter(Course.id == pte.course_id).first()
    retrain_course = db.query(Course).filter(Course.id == pte.retrain_course_id).first() if pte.retrain_course_id else None

    return {
        "id": pte.id,
        "tenant_id": pte.tenant_id,
        "assignment_id": pte.assignment_id,
        "course_id": pte.course_id,
        "employee_id": pte.employee_id,

        # Employee info
        "employee_name": f"{employee.first_name} {employee.last_name}" if employee else None,
        "employee_initials": f"{employee.first_name[0]}{employee.last_name[0]}".upper() if employee else None,
        "employee_job_title": employee.job_title if employee else None,

        # Course info
        "course_title": course.title if course else None,
        "course_category": course.category if course else None,
        "course_emoji": course.image_emoji if course else "📚",

        # Evaluator info
        "evaluator_id": pte.evaluator_id,
        "evaluator_name": f"{evaluator.first_name} {evaluator.last_name}" if evaluator else None,
        "evaluator_initials": f"{evaluator.first_name[0]}{evaluator.last_name[0]}".upper() if evaluator else None,
        "evaluator_type": pte.evaluator_type,

        # Scheduling
        "scheduled_date": pte.scheduled_date.isoformat() if pte.scheduled_date else None,
        "due_date": pte.due_date.isoformat() if pte.due_date else None,

        # Status & Results
        "status": pte.status,
        "score": float(pte.score) if pte.score is not None else None,
        "criteria_scores": pte.criteria_scores,
        "comments": pte.comments,
        "strengths": pte.strengths,
        "improvements": pte.improvements,

        # Outcome
        "competency_validated": pte.competency_validated,
        "recommendation": pte.recommendation,
        "recommendation_details": pte.recommendation_details,

        # Re-training
        "retrain_course_id": pte.retrain_course_id,
        "retrain_course_title": retrain_course.title if retrain_course else None,
        "retrain_assignment_id": pte.retrain_assignment_id,

        # Sync
        "career_synced": pte.career_synced,
        "career_synced_at": pte.career_synced_at.isoformat() if pte.career_synced_at else None,

        # Timestamps
        "started_at": pte.started_at.isoformat() if pte.started_at else None,
        "completed_at": pte.completed_at.isoformat() if pte.completed_at else None,
        "created_at": pte.created_at.isoformat() if pte.created_at else None,
    }


# =============================================
# EPF-05: Dashboard évaluateur - Évaluations à compléter
# =============================================

@router.get("/pending")
async def get_pending_evaluations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Liste des évaluations en attente.
    - Évaluateur: ses évaluations assignées
    - RH/Admin: toutes les évaluations pending
    - Manager: évaluations de son équipe
    """
    user_role = get_user_role(current_user)
    employee_id = get_employee_id_or_error(current_user, db)

    query = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.tenant_id == current_user.tenant_id,
        PostTrainingEvaluation.status.in_(["pending", "in_progress"])
    )

    if user_role in ['admin', 'super_admin', 'rh']:
        pass  # Voir tout
    elif user_role in ['manager', 'dg', 'dga']:
        # Évaluations assignées à moi OU de mon équipe
        team_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == employee_id).all()]
        query = query.filter(
            or_(
                PostTrainingEvaluation.evaluator_id == employee_id,
                PostTrainingEvaluation.employee_id.in_(team_ids)
            )
        )
    else:
        # Employé: seulement les évaluations qui me sont assignées comme évaluateur
        query = query.filter(PostTrainingEvaluation.evaluator_id == employee_id)

    evaluations = query.order_by(PostTrainingEvaluation.scheduled_date.asc()).all()

    return {
        "items": [enrich_evaluation(e, db) for e in evaluations],
        "total": len(evaluations)
    }


# =============================================
# EPF-06: Historique des évaluations par employé
# =============================================

@router.get("/history/{employee_id}")
async def get_employee_evaluation_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Historique des évaluations d'un collaborateur avec tendance.
    Permissions: RH/Admin voient tout, Manager voit son équipe, Employé voit les siens.
    """
    user_role = get_user_role(current_user)
    current_emp_id = get_employee_id_or_error(current_user, db)

    # Vérification permissions
    if user_role not in ['admin', 'super_admin', 'rh', 'dg', 'dga']:
        if user_role == 'manager':
            team_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == current_emp_id).all()]
            if employee_id != current_emp_id and employee_id not in team_ids:
                raise HTTPException(403, "Accès non autorisé à cet historique")
        elif employee_id != current_emp_id:
            raise HTTPException(403, "Vous ne pouvez voir que votre propre historique")

    evaluations = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.tenant_id == current_user.tenant_id,
        PostTrainingEvaluation.employee_id == employee_id,
        PostTrainingEvaluation.status == "completed"
    ).order_by(PostTrainingEvaluation.completed_at.asc()).all()

    # Calculer les stats résumées
    scores = [float(e.score) for e in evaluations if e.score is not None]
    validated_count = sum(1 for e in evaluations if e.competency_validated)
    retrain_count = sum(1 for e in evaluations if e.recommendation == "retrain")

    # Tendance (comparaison dernières évaluations)
    trend = "stable"
    if len(scores) >= 2:
        recent_avg = sum(scores[-3:]) / len(scores[-3:])  # 3 dernières
        older_avg = sum(scores[:-3]) / len(scores[:-3]) if len(scores) > 3 else scores[0]
        if recent_avg > older_avg + 5:
            trend = "up"
        elif recent_avg < older_avg - 5:
            trend = "down"

    employee = db.query(Employee).filter(Employee.id == employee_id).first()

    return {
        "employee_id": employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}" if employee else None,
        "summary": {
            "total_evaluations": len(evaluations),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "min_score": round(min(scores), 1) if scores else 0,
            "max_score": round(max(scores), 1) if scores else 0,
            "validated_count": validated_count,
            "retrain_count": retrain_count,
            "validation_rate": round(validated_count / len(evaluations) * 100, 1) if evaluations else 0,
            "trend": trend
        },
        "evaluations": [enrich_evaluation(e, db) for e in evaluations]
    }


# =============================================
# Liste de toutes les évaluations (avec filtres)
# =============================================

@router.get("/")
async def list_evaluations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    evaluator_id: Optional[int] = None,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste des évaluations post-formation avec filtres"""
    user_role = get_user_role(current_user)
    current_emp_id = get_employee_id_or_error(current_user, db)

    query = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.tenant_id == current_user.tenant_id
    )

    # Filtrage permissions
    if user_role not in ['admin', 'super_admin', 'rh', 'dg', 'dga']:
        if user_role == 'manager':
            team_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == current_emp_id).all()]
            all_ids = [current_emp_id] + team_ids
            query = query.filter(
                or_(
                    PostTrainingEvaluation.employee_id.in_(all_ids),
                    PostTrainingEvaluation.evaluator_id == current_emp_id
                )
            )
        else:
            query = query.filter(
                or_(
                    PostTrainingEvaluation.employee_id == current_emp_id,
                    PostTrainingEvaluation.evaluator_id == current_emp_id
                )
            )

    # Filtres additionnels
    if status:
        query = query.filter(PostTrainingEvaluation.status == status)
    if employee_id:
        query = query.filter(PostTrainingEvaluation.employee_id == employee_id)
    if evaluator_id:
        query = query.filter(PostTrainingEvaluation.evaluator_id == evaluator_id)
    if course_id:
        query = query.filter(PostTrainingEvaluation.course_id == course_id)

    total = query.count()
    evaluations = query.order_by(desc(PostTrainingEvaluation.created_at))\
                       .offset((page - 1) * page_size)\
                       .limit(page_size)\
                       .all()

    return {
        "items": [enrich_evaluation(e, db) for e in evaluations],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


# =============================================
# Détail d'une évaluation
# =============================================

@router.get("/{evaluation_id}")
async def get_evaluation_detail(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Détail d'une évaluation post-formation"""
    pte = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.id == evaluation_id,
        PostTrainingEvaluation.tenant_id == current_user.tenant_id
    ).first()
    if not pte:
        raise HTTPException(404, "Évaluation non trouvée")

    settings = get_or_create_settings(current_user.tenant_id, db)

    result = enrich_evaluation(pte, db)
    result["passing_threshold"] = settings.passing_threshold
    result["default_criteria"] = settings.default_criteria
    return result


# =============================================
# EPF-01: Assigner un évaluateur
# =============================================

@router.post("/{evaluation_id}/assign-evaluator")
async def assign_evaluator(
    evaluation_id: int,
    data: AssignEvaluatorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assigner un évaluateur à une évaluation post-formation"""
    user_role = get_user_role(current_user)
    if user_role not in ['admin', 'super_admin', 'rh', 'manager', 'dg', 'dga']:
        raise HTTPException(403, "Accès non autorisé")

    pte = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.id == evaluation_id,
        PostTrainingEvaluation.tenant_id == current_user.tenant_id
    ).first()
    if not pte:
        raise HTTPException(404, "Évaluation non trouvée")

    # Vérifier que l'évaluateur existe
    evaluator = db.query(Employee).filter(
        Employee.id == data.evaluator_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    if not evaluator:
        raise HTTPException(404, "Évaluateur non trouvé")

    # L'évaluateur ne peut pas être le même que l'évalué
    if data.evaluator_id == pte.employee_id:
        raise HTTPException(400, "L'évaluateur ne peut pas être le même que l'évalué")

    pte.evaluator_id = data.evaluator_id
    pte.evaluator_type = data.evaluator_type
    pte.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "Évaluateur assigné", "evaluation_id": pte.id, "evaluator_id": data.evaluator_id}


# =============================================
# EPF-02: Soumettre l'évaluation (questionnaire + score)
# =============================================

@router.post("/{evaluation_id}/evaluate")
async def submit_evaluation(
    evaluation_id: int,
    data: EvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Soumettre une évaluation post-formation.
    Calcule le score pondéré, détermine si compétence validée,
    et génère la recommandation automatique.
    """
    employee_id = get_employee_id_or_error(current_user, db)
    user_role = get_user_role(current_user)

    pte = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.id == evaluation_id,
        PostTrainingEvaluation.tenant_id == current_user.tenant_id
    ).first()
    if not pte:
        raise HTTPException(404, "Évaluation non trouvée")

    if pte.status == "completed":
        raise HTTPException(400, "Cette évaluation est déjà complétée")

    if pte.status == "cancelled":
        raise HTTPException(400, "Cette évaluation a été annulée")

    # Vérifier que c'est bien l'évaluateur assigné (ou RH/Admin)
    if user_role not in ['admin', 'super_admin', 'rh']:
        if pte.evaluator_id and pte.evaluator_id != employee_id:
            raise HTTPException(403, "Seul l'évaluateur assigné peut soumettre cette évaluation")

    # Si pas encore d'évaluateur assigné, auto-assigner l'utilisateur courant
    if not pte.evaluator_id:
        pte.evaluator_id = employee_id

    # Récupérer les paramètres
    settings = get_or_create_settings(current_user.tenant_id, db)

    # Calculer le score final pondéré
    criteria_data = [c.model_dump() for c in data.criteria_scores]
    final_score = compute_final_score(criteria_data)

    # Déterminer la validation et recommandation
    threshold = settings.passing_threshold
    competency_validated = final_score >= threshold

    if competency_validated:
        recommendation = "validated"
        recommendation_details = f"Score {final_score}/100 ≥ seuil {threshold}. Compétence théorique validée."
    elif final_score >= threshold * 0.7:  # Entre 70% du seuil et le seuil
        recommendation = "complement"
        recommendation_details = f"Score {final_score}/100 < seuil {threshold}. Formation complémentaire recommandée."
    else:
        recommendation = "retrain"
        recommendation_details = f"Score {final_score}/100 << seuil {threshold}. Re-formation nécessaire."

    # Mettre à jour l'évaluation
    pte.score = final_score
    pte.criteria_scores = criteria_data
    pte.comments = data.comments
    pte.strengths = data.strengths
    pte.improvements = data.improvements
    pte.competency_validated = competency_validated
    pte.recommendation = recommendation
    pte.recommendation_details = recommendation_details
    pte.status = "completed"
    pte.completed_at = datetime.utcnow()
    pte.updated_at = datetime.utcnow()

    # EPF-04: Auto-recommendation re-formation si score < seuil
    if not competency_validated and settings.auto_retrain:
        # Créer automatiquement une nouvelle assignation pour la même formation
        new_assignment = CourseAssignment(
            tenant_id=current_user.tenant_id,
            employee_id=pte.employee_id,
            course_id=pte.course_id,
            assigned_by_id=current_user.id,
            status="assigned",
            deadline=date.today() + timedelta(days=30)  # Deadline à 30 jours
        )
        db.add(new_assignment)
        db.flush()

        pte.retrain_course_id = pte.course_id
        pte.retrain_assignment_id = new_assignment.id
        pte.recommendation_details += f" Re-formation auto-assignée (ID: {new_assignment.id})."

    db.commit()
    db.refresh(pte)

    return enrich_evaluation(pte, db)


# =============================================
# EPF-03: Sync score vers module Carrière
# =============================================

@router.post("/{evaluation_id}/sync-career")
async def sync_to_career(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Synchronise le score vers le module Carrière.
    Émet l'event 'post_training_evaluated' pour le module Carrière.
    """
    user_role = get_user_role(current_user)
    if user_role not in ['admin', 'super_admin', 'rh', 'dg']:
        raise HTTPException(403, "Accès réservé RH/Admin")

    pte = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.id == evaluation_id,
        PostTrainingEvaluation.tenant_id == current_user.tenant_id
    ).first()
    if not pte:
        raise HTTPException(404, "Évaluation non trouvée")

    if pte.status != "completed":
        raise HTTPException(400, "L'évaluation doit être complétée avant la synchronisation")

    if pte.career_synced:
        raise HTTPException(400, "Déjà synchronisé avec le module Carrière")

    # Marquer comme synchronisé
    pte.career_synced = True
    pte.career_synced_at = datetime.utcnow()
    pte.updated_at = datetime.utcnow()
    db.commit()

    # Event payload pour le module Carrière
    career_event = {
        "event": "post_training_evaluated",
        "employee_id": pte.employee_id,
        "course_id": pte.course_id,
        "score": float(pte.score),
        "competency_validated": pte.competency_validated,
        "recommendation": pte.recommendation,
        "evaluation_id": pte.id,
        "completed_at": pte.completed_at.isoformat() if pte.completed_at else None
    }

    return {
        "message": "Score synchronisé avec le module Carrière",
        "career_event": career_event,
        "evaluation_id": pte.id
    }


# =============================================
# API exposer scores pour module Carrière (EPF-03)
# =============================================

@router.get("/career-data/{employee_id}")
async def get_career_data(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint API pour le module Carrière.
    Retourne les scores d'évaluation post-formation pour un employé.
    """
    evaluations = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.tenant_id == current_user.tenant_id,
        PostTrainingEvaluation.employee_id == employee_id,
        PostTrainingEvaluation.status == "completed"
    ).order_by(desc(PostTrainingEvaluation.completed_at)).all()

    scores = [float(e.score) for e in evaluations if e.score is not None]

    return {
        "employee_id": employee_id,
        "total_evaluations": len(evaluations),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "all_validated": all(e.competency_validated for e in evaluations) if evaluations else False,
        "pending_retrains": sum(1 for e in evaluations if e.recommendation == "retrain" and not e.retrain_assignment_id),
        "evaluations": [
            {
                "course_id": e.course_id,
                "course_title": db.query(Course).filter(Course.id == e.course_id).first().title if db.query(Course).filter(Course.id == e.course_id).first() else None,
                "score": float(e.score) if e.score else None,
                "competency_validated": e.competency_validated,
                "completed_at": e.completed_at.isoformat() if e.completed_at else None
            }
            for e in evaluations
        ]
    }


# =============================================
# Paramètres EPF (Config)
# =============================================

@router.get("/settings/config")
async def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupérer les paramètres EPF du tenant"""
    settings = get_or_create_settings(current_user.tenant_id, db)
    return {
        "trigger_delay_days": settings.trigger_delay_days,
        "default_evaluator_type": settings.default_evaluator_type,
        "passing_threshold": settings.passing_threshold,
        "auto_retrain": settings.auto_retrain,
        "default_criteria": settings.default_criteria
    }


@router.put("/settings/config")
async def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mettre à jour les paramètres EPF (RH/Admin)"""
    user_role = get_user_role(current_user)
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(403, "Accès réservé RH/Admin")

    settings = get_or_create_settings(current_user.tenant_id, db)

    if data.trigger_delay_days is not None:
        settings.trigger_delay_days = data.trigger_delay_days
    if data.default_evaluator_type is not None:
        settings.default_evaluator_type = data.default_evaluator_type
    if data.passing_threshold is not None:
        if data.passing_threshold < 0 or data.passing_threshold > 100:
            raise HTTPException(400, "Le seuil doit être entre 0 et 100")
        settings.passing_threshold = data.passing_threshold
    if data.auto_retrain is not None:
        settings.auto_retrain = data.auto_retrain
    if data.default_criteria is not None:
        settings.default_criteria = data.default_criteria

    settings.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Paramètres mis à jour", "settings": {
        "trigger_delay_days": settings.trigger_delay_days,
        "default_evaluator_type": settings.default_evaluator_type,
        "passing_threshold": settings.passing_threshold,
        "auto_retrain": settings.auto_retrain,
        "default_criteria": settings.default_criteria
    }}


# =============================================
# Stats EPF
# =============================================

@router.get("/stats/overview")
async def get_epf_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Statistiques EPF filtrées selon le rôle"""
    user_role = get_user_role(current_user)
    current_emp_id = get_employee_id_or_error(current_user, db)

    base = db.query(PostTrainingEvaluation).filter(
        PostTrainingEvaluation.tenant_id == current_user.tenant_id
    )

    # Filtrage par rôle — identique à list_evaluations
    if user_role not in ['admin', 'super_admin', 'rh', 'dg', 'dga']:
        if user_role == 'manager':
            team_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == current_emp_id).all()]
            all_ids = [current_emp_id] + team_ids
            base = base.filter(
                or_(
                    PostTrainingEvaluation.employee_id.in_(all_ids),
                    PostTrainingEvaluation.evaluator_id == current_emp_id
                )
            )
        else:
            base = base.filter(
                or_(
                    PostTrainingEvaluation.employee_id == current_emp_id,
                    PostTrainingEvaluation.evaluator_id == current_emp_id
                )
            )

    total = base.count()
    pending = base.filter(PostTrainingEvaluation.status == "pending").count()
    in_progress = base.filter(PostTrainingEvaluation.status == "in_progress").count()
    completed = base.filter(PostTrainingEvaluation.status == "completed").count()

    completed_evals = base.filter(PostTrainingEvaluation.status == "completed").all()
    scores = [float(e.score) for e in completed_evals if e.score is not None]
    validated = sum(1 for e in completed_evals if e.competency_validated)
    retrain = sum(1 for e in completed_evals if e.recommendation == "retrain")

    settings = get_or_create_settings(current_user.tenant_id, db)

    return {
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "completed": completed,
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "validation_rate": round(validated / len(completed_evals) * 100, 1) if completed_evals else 0,
        "retrain_count": retrain,
        "passing_threshold": settings.passing_threshold
    }
