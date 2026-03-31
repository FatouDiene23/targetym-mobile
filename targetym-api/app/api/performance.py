# =============================================
# API ROUTES - Performance & Feedback
# File: app/api/performance.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from typing import Optional, List
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.performance import Feedback, FeedbackLike, FeedbackReply, EvaluationCampaign, EvaluationAssignment, Evaluation, OneOnOne
from app.models.employee import Employee
from app.models.user import User
from app.schemas.performance import (
    # Feedback
    FeedbackCreate, FeedbackUpdate, FeedbackResponse, FeedbackListResponse,
    # Campaign
    EvaluationCampaignCreate, EvaluationCampaignUpdate, EvaluationCampaignResponse, EvaluationCampaignListResponse,
    # Evaluation
    EvaluationCreate, EvaluationUpdate, EvaluationSubmit, EvaluationValidate,
    EvaluationResponse, EvaluationListResponse,
    # OneOnOne
    OneOnOneCreate, OneOnOneUpdate, OneOnOneComplete, OneOnOneCancel,
    OneOnOneResponse, OneOnOneListResponse, OneOnOneTask,
    # Stats
    PerformanceStats, FeedbackStats, EvaluationStats,
    # Global score
    GlobalScoreResponse, CampaignScoreItem,
    # Enums
    FeedbackType, EvaluationStatus, CampaignStatus, OneOnOneStatus
)
from app.api.deps import get_current_user, get_current_tenant
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_PERFORMANCE

router = APIRouter(prefix="/api/performance", tags=["Performance & Feedback"], dependencies=[Depends(require_feature(FEATURE_PERFORMANCE))])


# =============================================
# HELPERS
# =============================================

def get_employee_id_or_error(current_user: User, db: Session) -> int:
    """
    Récupère l'employee_id de l'utilisateur courant.
    Si l'utilisateur n'a pas d'employee_id, cherche un employé avec le même email.
    Lève une exception si aucun employé n'est trouvé.
    """
    if current_user.employee_id:
        return current_user.employee_id
    
    # Chercher un employé avec le même email
    employee = db.query(Employee).filter(
        Employee.email == current_user.email,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if employee:
        # Mettre à jour le user avec l'employee_id trouvé
        current_user.employee_id = employee.id
        db.commit()
        return employee.id
    
    raise HTTPException(
        status_code=400, 
        detail="Votre compte utilisateur n'est pas lié à un profil employé. Contactez votre administrateur RH."
    )


def get_employee_initials(first_name: str, last_name: str) -> str:
    """Génère les initiales d'un employé"""
    return f"{first_name[0] if first_name else ''}{last_name[0] if last_name else ''}".upper()


def enrich_feedback(feedback: Feedback, current_employee_id: int, db: Session) -> dict:
    """Enrichit un feedback avec les infos employé + attitudes"""
    from app.models.attitude import FeedbackAttitude, Attitude

    from_emp = db.query(Employee).filter(Employee.id == feedback.from_employee_id).first()
    to_emp = db.query(Employee).filter(Employee.id == feedback.to_employee_id).first()

    # Vérifier si l'utilisateur courant a liké
    is_liked = False
    if current_employee_id:
        is_liked = db.query(FeedbackLike).filter(
            FeedbackLike.feedback_id == feedback.id,
            FeedbackLike.employee_id == current_employee_id
        ).first() is not None

    # Récupérer les attitudes cochées
    feedback_attitudes = db.query(FeedbackAttitude, Attitude).join(
        Attitude, FeedbackAttitude.attitude_id == Attitude.id
    ).filter(
        FeedbackAttitude.feedback_id == feedback.id
    ).all()

    attitudes_data = [
        {
            "attitude_id": a.Attitude.id,
            "code": a.Attitude.code,
            "name": a.Attitude.name,
            "icon": a.Attitude.icon,
            "sentiment": a.FeedbackAttitude.sentiment
        }
        for a in feedback_attitudes
    ]

    return {
        "id": feedback.id,
        "tenant_id": feedback.tenant_id,
        "from_employee_id": feedback.from_employee_id,
        "to_employee_id": feedback.to_employee_id,
        "type": feedback.type,
        "interaction_type": feedback.interaction_type,
        "message": feedback.message,
        "is_public": feedback.is_public,
        "likes_count": feedback.likes_count or 0,
        "created_at": feedback.created_at,
        "updated_at": feedback.updated_at,
        "from_employee_name": f"{from_emp.first_name} {from_emp.last_name}" if from_emp else None,
        "from_employee_initials": get_employee_initials(from_emp.first_name, from_emp.last_name) if from_emp else None,
        "to_employee_name": f"{to_emp.first_name} {to_emp.last_name}" if to_emp else None,
        "to_employee_initials": get_employee_initials(to_emp.first_name, to_emp.last_name) if to_emp else None,
        "is_liked_by_me": is_liked,
        "attitudes": attitudes_data
    }


def enrich_evaluation(evaluation: Evaluation, db: Session) -> dict:
    """Enrichit une évaluation avec les infos employé"""
    employee = db.query(Employee).filter(Employee.id == evaluation.employee_id).first()
    evaluator = db.query(Employee).filter(Employee.id == evaluation.evaluator_id).first() if evaluation.evaluator_id else None
    campaign = db.query(EvaluationCampaign).filter(EvaluationCampaign.id == evaluation.campaign_id).first() if evaluation.campaign_id else None
    
    return {
        "id": evaluation.id,
        "tenant_id": evaluation.tenant_id,
        "campaign_id": evaluation.campaign_id,
        "employee_id": evaluation.employee_id,
        "evaluator_id": evaluation.evaluator_id,
        "type": evaluation.type,
        "status": evaluation.status,
        "scores": evaluation.scores,
        "overall_score": float(evaluation.overall_score) if evaluation.overall_score else None,
        "strengths": evaluation.strengths,
        "improvements": evaluation.improvements,
        "goals": evaluation.goals,
        "manager_comments": evaluation.manager_comments,
        "employee_comments": evaluation.employee_comments,
        "okr_achievement_score": float(evaluation.okr_achievement_score) if evaluation.okr_achievement_score else None,
        "due_date": evaluation.due_date,
        "submitted_at": evaluation.submitted_at,
        "validated_at": evaluation.validated_at,
        "validated_by": evaluation.validated_by,
        "created_at": evaluation.created_at,
        "updated_at": evaluation.updated_at,
        "employee_name": f"{employee.first_name} {employee.last_name}" if employee else None,
        "employee_initials": get_employee_initials(employee.first_name, employee.last_name) if employee else None,
        "employee_department": employee.department.name if employee and employee.department else None,
        "employee_job_title": employee.job_title if employee else None,
        "evaluator_name": f"{evaluator.first_name} {evaluator.last_name}" if evaluator else None,
        "campaign_name": campaign.name if campaign else None,
    }


def enrich_one_on_one(one_on_one: OneOnOne, db: Session) -> dict:
    """Enrichit un 1-on-1 avec les infos employé"""
    employee = db.query(Employee).filter(Employee.id == one_on_one.employee_id).first()
    manager = db.query(Employee).filter(Employee.id == one_on_one.manager_id).first()
    
    return {
        "id": one_on_one.id,
        "tenant_id": one_on_one.tenant_id,
        "employee_id": one_on_one.employee_id,
        "manager_id": one_on_one.manager_id,
        "scheduled_date": one_on_one.scheduled_date,
        "duration_minutes": one_on_one.duration_minutes,
        "location": one_on_one.location,
        "status": one_on_one.status,
        "notes": one_on_one.notes,
        "action_items": one_on_one.action_items,
        "mood": one_on_one.mood,
        "topics": one_on_one.topics,
        "is_recurring": one_on_one.is_recurring,
        "recurrence_pattern": one_on_one.recurrence_pattern,
        "completed_at": one_on_one.completed_at,
        "cancelled_at": one_on_one.cancelled_at,
        "cancel_reason": one_on_one.cancel_reason,
        "created_at": one_on_one.created_at,
        "updated_at": one_on_one.updated_at,
        "employee_name": f"{employee.first_name} {employee.last_name}" if employee else None,
        "employee_initials": get_employee_initials(employee.first_name, employee.last_name) if employee else None,
        "manager_name": f"{manager.first_name} {manager.last_name}" if manager else None,
        "evaluation_score": one_on_one.evaluation_score,
        "evaluation_comment": one_on_one.evaluation_comment,
        "tasks": one_on_one.tasks or [],
    }


# =============================================
# FEEDBACKS
# =============================================

@router.get("/feedbacks", response_model=FeedbackListResponse)
async def get_feedbacks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    to_employee_id: Optional[int] = None,
    from_employee_id: Optional[int] = None,
    type: Optional[FeedbackType] = None,
    is_public: Optional[bool] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste des feedbacks avec filtres"""
    query = db.query(Feedback).filter(Feedback.tenant_id == current_user.tenant_id)
    
    # Filtres
    if to_employee_id:
        query = query.filter(Feedback.to_employee_id == to_employee_id)
    if from_employee_id:
        query = query.filter(Feedback.from_employee_id == from_employee_id)
    if type:
        query = query.filter(Feedback.type == type.value)
    if is_public is not None:
        query = query.filter(Feedback.is_public == is_public)
    if department_id:
        query = query.join(Employee, Feedback.to_employee_id == Employee.id)\
                     .filter(Employee.department_id == department_id)
    
    # Pour les non-RH/Admin, ne montrer que les feedbacks publics ou ceux qu'ils ont donnés/reçus
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    employee_id = current_user.employee_id
    
    if user_role not in ['admin', 'super_admin', 'rh']:
        if employee_id:
            query = query.filter(
                or_(
                    Feedback.is_public == True,
                    Feedback.from_employee_id == employee_id,
                    Feedback.to_employee_id == employee_id
                )
            )
        else:
            query = query.filter(Feedback.is_public == True)
    
    # Pagination
    total = query.count()
    feedbacks = query.order_by(desc(Feedback.created_at))\
                     .offset((page - 1) * page_size)\
                     .limit(page_size)\
                     .all()
    
    return {
        "items": [enrich_feedback(fb, employee_id, db) for fb in feedbacks],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.post("/feedbacks", response_model=FeedbackResponse)
async def create_feedback(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer un nouveau feedback avec attitudes optionnelles"""
    from app.models.attitude import Attitude, FeedbackAttitude

    # Récupérer l'employee_id de l'utilisateur
    from_employee_id = get_employee_id_or_error(current_user, db)

    # Vérifier que le destinataire existe
    to_employee = db.query(Employee).filter(
        Employee.id == data.to_employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    if not to_employee:
        raise HTTPException(status_code=404, detail="Employé destinataire non trouvé")

    # On ne peut pas se donner un feedback à soi-même
    if data.to_employee_id == from_employee_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous donner un feedback à vous-même")

    # Créer le feedback
    feedback = Feedback(
        tenant_id=current_user.tenant_id,
        from_employee_id=from_employee_id,
        to_employee_id=data.to_employee_id,
        type=data.type.value if hasattr(data.type, 'value') else data.type,
        interaction_type=data.interaction_type.value if data.interaction_type and hasattr(data.interaction_type, 'value') else data.interaction_type,
        message=data.message,
        is_public=data.is_public,
        likes_count=0
    )

    db.add(feedback)
    db.flush()  # Pour obtenir l'ID du feedback avant commit

    # Ajouter les attitudes cochées
    if data.attitudes:
        for att_data in data.attitudes:
            # Valider que l'attitude existe et est active
            attitude = db.query(Attitude).filter(
                Attitude.id == att_data.attitude_id,
                Attitude.tenant_id == current_user.tenant_id,
                Attitude.is_active == True
            ).first()

            if not attitude:
                continue  # Ignorer les attitudes invalides

            fb_attitude = FeedbackAttitude(
                feedback_id=feedback.id,
                attitude_id=att_data.attitude_id,
                sentiment=att_data.sentiment
            )
            db.add(fb_attitude)

    db.commit()
    db.refresh(feedback)

    return enrich_feedback(feedback, from_employee_id, db)


@router.post("/feedbacks/{feedback_id}/like")
async def like_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liker/Unliker un feedback"""
    employee_id = get_employee_id_or_error(current_user, db)
    
    feedback = db.query(Feedback).filter(
        Feedback.id == feedback_id,
        Feedback.tenant_id == current_user.tenant_id
    ).first()
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback non trouvé")
    
    if not feedback.is_public:
        raise HTTPException(status_code=400, detail="On ne peut liker que les feedbacks publics")
    
    # Vérifier si déjà liké
    existing_like = db.query(FeedbackLike).filter(
        FeedbackLike.feedback_id == feedback_id,
        FeedbackLike.employee_id == employee_id
    ).first()
    
    if existing_like:
        # Unlike
        db.delete(existing_like)
        feedback.likes_count = max(0, (feedback.likes_count or 0) - 1)
    else:
        # Like
        new_like = FeedbackLike(feedback_id=feedback_id, employee_id=employee_id)
        db.add(new_like)
        feedback.likes_count = (feedback.likes_count or 0) + 1
    
    db.commit()
    
    return {"likes_count": feedback.likes_count, "is_liked": existing_like is None}


@router.delete("/feedbacks/{feedback_id}")
async def delete_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Supprimer un feedback.
    - Auteur: uniquement dans les 15 premières minutes après création
    - RH/Admin: toujours (modération)
    """
    feedback = db.query(Feedback).filter(
        Feedback.id == feedback_id,
        Feedback.tenant_id == current_user.tenant_id
    ).first()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback non trouvé")

    from_employee_id = get_employee_id_or_error(current_user, db)
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'

    # RH/Admin peuvent toujours supprimer (modération)
    if user_role in ['admin', 'super_admin', 'rh']:
        db.delete(feedback)
        db.commit()
        return {"message": "Feedback supprimé (modération RH)"}

    # L'auteur peut supprimer uniquement dans les 15 premières minutes
    if feedback.from_employee_id != from_employee_id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres feedbacks")

    minutes_since_creation = (datetime.now(feedback.created_at.tzinfo) - feedback.created_at).total_seconds() / 60

    if minutes_since_creation > 15:
        raise HTTPException(
            status_code=403,
            detail="La suppression n'est autorisée que dans les 15 premières minutes après création"
        )

    db.delete(feedback)
    db.commit()
    return {"message": "Feedback supprimé"}


# =============================================
# FEEDBACK REPLIES
# =============================================

class ReplyCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class ReplyResponse(BaseModel):
    id: int
    feedback_id: int
    employee_id: int
    employee_name: str
    employee_initials: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/feedbacks/{feedback_id}/replies", response_model=List[ReplyResponse])
async def get_feedback_replies(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupérer les réponses d'un feedback.
    Seuls l'expéditeur et le destinataire du feedback peuvent voir les réponses.
    """
    feedback = db.query(Feedback).filter(
        Feedback.id == feedback_id,
        Feedback.tenant_id == current_user.tenant_id
    ).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback non trouvé")

    employee_id = get_employee_id_or_error(current_user, db)
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'

    if user_role not in ['admin', 'super_admin', 'rh']:
        if employee_id not in (feedback.from_employee_id, feedback.to_employee_id):
            raise HTTPException(status_code=403, detail="Accès réservé aux participants du feedback")

    replies = db.query(FeedbackReply).filter(
        FeedbackReply.feedback_id == feedback_id
    ).order_by(FeedbackReply.created_at.asc()).all()

    result = []
    for reply in replies:
        emp = db.query(Employee).filter(Employee.id == reply.employee_id).first()
        name = f"{emp.first_name} {emp.last_name}" if emp else "Inconnu"
        initials = f"{emp.first_name[0]}{emp.last_name[0]}" if emp and emp.first_name and emp.last_name else "?"
        result.append(ReplyResponse(
            id=reply.id,
            feedback_id=reply.feedback_id,
            employee_id=reply.employee_id,
            employee_name=name,
            employee_initials=initials.upper(),
            content=reply.content,
            created_at=reply.created_at
        ))
    return result


@router.post("/feedbacks/{feedback_id}/replies", response_model=ReplyResponse)
async def create_feedback_reply(
    feedback_id: int,
    data: ReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Répondre à un feedback.
    Seuls l'expéditeur et le destinataire du feedback peuvent répondre.
    """
    feedback = db.query(Feedback).filter(
        Feedback.id == feedback_id,
        Feedback.tenant_id == current_user.tenant_id
    ).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback non trouvé")

    employee_id = get_employee_id_or_error(current_user, db)

    if employee_id not in (feedback.from_employee_id, feedback.to_employee_id):
        raise HTTPException(status_code=403, detail="Seuls l'expéditeur et le destinataire peuvent répondre")

    reply = FeedbackReply(
        feedback_id=feedback_id,
        employee_id=employee_id,
        content=data.content.strip()
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    name = f"{emp.first_name} {emp.last_name}" if emp else "Inconnu"
    initials = f"{emp.first_name[0]}{emp.last_name[0]}" if emp and emp.first_name and emp.last_name else "?"

    return ReplyResponse(
        id=reply.id,
        feedback_id=reply.feedback_id,
        employee_id=reply.employee_id,
        employee_name=name,
        employee_initials=initials.upper(),
        content=reply.content,
        created_at=reply.created_at
    )


# =============================================
# ATTITUDES INITIALIZATION
# =============================================

@router.post("/attitudes/initialize")
async def initialize_attitudes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initialise les attitudes par défaut pour le tenant courant si elles n'existent pas.
    Accessible à tous les utilisateurs authentifiés (appelé automatiquement au chargement de la page).
    Idempotent — ne recrée pas les attitudes déjà existantes (par code).
    """
    from app.models.attitude import Attitude

    DEFAULT_ATTITUDES = [
        {"code": "PATIENCE",     "name": "Patience",                   "category": "Savoir-être",  "icon": "Hourglass",    "display_order": 1},
        {"code": "DISPO",        "name": "Disponibilité",              "category": "Savoir-être",  "icon": "Bell",         "display_order": 2},
        {"code": "ANTICIP",      "name": "Anticipation",               "category": "Savoir-être",  "icon": "Eye",          "display_order": 3},
        {"code": "DISCIPLINE",   "name": "Discipline",                 "category": "Savoir-être",  "icon": "FileText", "display_order": 4},
        {"code": "RESPECT",      "name": "Respect",                    "category": "Savoir-être",  "icon": "Handshake",    "display_order": 5},
        {"code": "APPUI_TECH",   "name": "Appui technique",            "category": "Savoir-faire", "icon": "Wrench",       "display_order": 6},
        {"code": "COACHING",     "name": "Coaching",                   "category": "Savoir-faire", "icon": "Target",       "display_order": 7},
        {"code": "INTELL_EMO",   "name": "Intelligence émotionnelle",  "category": "Savoir-être",  "icon": "Brain",        "display_order": 8},
        {"code": "OUVERTURE",    "name": "Ouverture d'esprit",         "category": "Savoir-être",  "icon": "Globe",        "display_order": 9},
        {"code": "REACTIVITE",   "name": "Réactivité",                 "category": "Savoir-être",  "icon": "Zap",          "display_order": 10},
        {"code": "DISCRETION",   "name": "Discrétion",                 "category": "Savoir-être",  "icon": "Shield",  "display_order": 11},
        {"code": "COMPASSION",   "name": "Compassion",                 "category": "Savoir-être",  "icon": "Heart",        "display_order": 12},
        {"code": "SOUTIEN_EMO",  "name": "Soutien Émotionnel",         "category": "Savoir-être",  "icon": "HeartPulse",   "display_order": 13},
        {"code": "DEP_FONCT",    "name": "Dépassement de fonction",    "category": "Savoir-faire", "icon": "TrendingUp",   "display_order": 14},
        {"code": "PONCTUALITE",  "name": "Ponctualité",                "category": "Savoir-être",  "icon": "Clock",        "display_order": 15},
        {"code": "SOUTIEN_TECH", "name": "Soutien Technique",          "category": "Savoir-faire", "icon": "Cog",          "display_order": 16},
    ]

    created_count = 0
    for att_data in DEFAULT_ATTITUDES:
        existing = db.query(Attitude).filter(
            Attitude.tenant_id == current_user.tenant_id,
            Attitude.code == att_data["code"]
        ).first()
        if not existing:
            db.add(Attitude(tenant_id=current_user.tenant_id, **att_data))
            created_count += 1

    db.commit()
    return {"message": f"{created_count} attitudes créées", "created": created_count}


# =============================================
# CAMPAIGNS
# =============================================

@router.get("/campaigns", response_model=EvaluationCampaignListResponse)
async def get_campaigns(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[CampaignStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Liste des campagnes d'évaluation selon le rôle:
    - Employé: seulement les campagnes où il a une évaluation
    - Manager: campagnes de son équipe + ses propres campagnes
    - RH/Admin: toutes les campagnes
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    employee_id = current_user.employee_id
    
    # Trouver employee_id si non défini
    if not employee_id:
        emp = db.query(Employee).filter(
            Employee.tenant_id == current_user.tenant_id,
            Employee.email == current_user.email
        ).first()
        if emp:
            employee_id = emp.id
    
    query = db.query(EvaluationCampaign).filter(EvaluationCampaign.tenant_id == current_user.tenant_id)
    
    # Filtrage selon le rôle
    if user_role in ['admin', 'super_admin', 'rh', 'dg']:
        # Voir toutes les campagnes
        pass
    elif user_role == 'manager' and employee_id:
        # Manager: campagnes où lui ou son équipe a des évaluations
        team_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == employee_id).all()]
        all_ids = [employee_id] + team_ids
        
        # Sous-requête: campagnes avec évaluations pour ces employés
        campaign_ids_with_evals = db.query(Evaluation.campaign_id).filter(
            Evaluation.employee_id.in_(all_ids),
            Evaluation.campaign_id.isnot(None)
        ).distinct().subquery()
        
        query = query.filter(EvaluationCampaign.id.in_(campaign_ids_with_evals))
    else:
        # Employé: seulement ses campagnes
        if employee_id:
            campaign_ids_with_evals = db.query(Evaluation.campaign_id).filter(
                Evaluation.employee_id == employee_id,
                Evaluation.campaign_id.isnot(None)
            ).distinct().subquery()
            
            query = query.filter(EvaluationCampaign.id.in_(campaign_ids_with_evals))
        else:
            # Pas d'employee_id = pas de campagnes
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }
    
    if status:
        query = query.filter(EvaluationCampaign.status == status.value)
    
    total = query.count()
    campaigns = query.order_by(desc(EvaluationCampaign.created_at))\
                     .offset((page - 1) * page_size)\
                     .limit(page_size)\
                     .all()
    
    items = []
    for camp in campaigns:
        # ✅ EXCLURE LES ÉVALUATIONS ANNULÉES DU COMPTAGE
        if user_role in ['admin', 'super_admin', 'rh', 'dg']:
            total_evals = db.query(Evaluation).filter(
                Evaluation.campaign_id == camp.id,
                Evaluation.status != 'cancelled'  # ← AJOUTÉ
            ).count()
            completed_evals = db.query(Evaluation).filter(
                Evaluation.campaign_id == camp.id,
                Evaluation.status.in_(['submitted', 'validated'])
            ).count()
        elif user_role == 'manager' and employee_id:
            team_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == employee_id).all()]
            all_ids = [employee_id] + team_ids
            total_evals = db.query(Evaluation).filter(
                Evaluation.campaign_id == camp.id,
                Evaluation.employee_id.in_(all_ids),
                Evaluation.status != 'cancelled'  # ← AJOUTÉ
            ).count()
            completed_evals = db.query(Evaluation).filter(
                Evaluation.campaign_id == camp.id,
                Evaluation.employee_id.in_(all_ids),
                Evaluation.status.in_(['submitted', 'validated'])
            ).count()
        else:
            total_evals = db.query(Evaluation).filter(
                Evaluation.campaign_id == camp.id,
                Evaluation.employee_id == employee_id,
                Evaluation.status != 'cancelled'  # ← AJOUTÉ
            ).count()
            completed_evals = db.query(Evaluation).filter(
                Evaluation.campaign_id == camp.id,
                Evaluation.employee_id == employee_id,
                Evaluation.status.in_(['submitted', 'validated'])
            ).count()
        
        creator = db.query(Employee).filter(Employee.id == camp.created_by).first() if camp.created_by else None
        
        items.append({
            "id": camp.id,
            "tenant_id": camp.tenant_id,
            "name": camp.name,
            "description": camp.description,
            "type": camp.type,
            "status": camp.status,
            "start_date": camp.start_date,
            "end_date": camp.end_date,
            "template": camp.template,
            "created_by": camp.created_by,
            "created_by_name": f"{creator.first_name} {creator.last_name}" if creator else None,
            "created_at": camp.created_at,
            "updated_at": camp.updated_at,
            "total_evaluations": total_evals,
            "completed_evaluations": completed_evals,
            "progress_percentage": (completed_evals / total_evals * 100) if total_evals > 0 else 0
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.post("/campaigns", response_model=EvaluationCampaignResponse)
async def create_campaign(
    data: EvaluationCampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer une nouvelle campagne d'évaluation (RH/Admin uniquement)"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs et RH")

    employee_id = current_user.employee_id

    campaign = EvaluationCampaign(
        tenant_id=current_user.tenant_id,
        name=data.name,
        description=data.description,
        type=data.type.value if hasattr(data.type, 'value') else data.type,
        start_date=data.start_date,
        end_date=data.end_date,
        template=data.template.model_dump() if data.template else None,
        status='active',
        created_by=employee_id,
        # Périodicité
        period=data.period.value if hasattr(data.period, 'value') else data.period,
        quarter=data.quarter,
        # Pondérations
        weight_self=data.weight_self,
        weight_manager=data.weight_manager,
        weight_peer=data.weight_peer,
        weight_direct_report=data.weight_direct_report,
        # Types d'évaluateurs
        include_self_evaluation=data.include_self_evaluation,
        include_manager_evaluation=data.include_manager_evaluation,
        include_peer_evaluation=data.include_peer_evaluation,
        include_direct_report_evaluation=data.include_direct_report_evaluation,
        # Min/max évaluateurs
        min_peer_evaluators=data.min_peer_evaluators,
        max_peer_evaluators=data.max_peer_evaluators,
        min_direct_report_evaluators=data.min_direct_report_evaluators,
        max_direct_report_evaluators=data.max_direct_report_evaluators,
    )

    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    # Index des sélections d'évaluateurs par employé
    evaluator_map: dict = {}
    if data.evaluator_selections:
        for sel in data.evaluator_selections:
            evaluator_map[sel.employee_id] = sel

    # Résoudre la liste des employés concernés
    if data.employee_ids:
        employees = db.query(Employee).filter(
            Employee.id.in_(data.employee_ids),
            Employee.tenant_id == current_user.tenant_id
        ).all()
    elif data.department_ids:
        employees = db.query(Employee).filter(
            Employee.department_id.in_(data.department_ids),
            Employee.tenant_id == current_user.tenant_id
        ).all()
    else:
        employees = db.query(Employee).filter(
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()

    period_value = data.period.value if hasattr(data.period, 'value') else data.period

    for emp in employees:
        sel = evaluator_map.get(emp.id)

        # Auto-évaluation
        if data.include_self_evaluation:
            db.add(Evaluation(
                tenant_id=current_user.tenant_id,
                campaign_id=campaign.id,
                employee_id=emp.id,
                evaluator_id=emp.id,
                type='self',
                status='pending',
                period=period_value,
                due_date=data.end_date
            ))
            db.add(EvaluationAssignment(
                tenant_id=current_user.tenant_id,
                campaign_id=campaign.id,
                employee_id=emp.id,
                evaluator_id=emp.id,
                evaluator_type='self',
                status='pending'
            ))

        # Évaluation manager
        if data.include_manager_evaluation and emp.manager_id:
            db.add(Evaluation(
                tenant_id=current_user.tenant_id,
                campaign_id=campaign.id,
                employee_id=emp.id,
                evaluator_id=emp.manager_id,
                type='manager',
                status='pending',
                period=period_value,
                due_date=data.end_date
            ))
            db.add(EvaluationAssignment(
                tenant_id=current_user.tenant_id,
                campaign_id=campaign.id,
                employee_id=emp.id,
                evaluator_id=emp.manager_id,
                evaluator_type='manager',
                status='pending'
            ))

        # Évaluations collègues (peer)
        if data.include_peer_evaluation and sel and sel.peer_ids:
            for peer_id in sel.peer_ids[:data.max_peer_evaluators]:
                db.add(Evaluation(
                    tenant_id=current_user.tenant_id,
                    campaign_id=campaign.id,
                    employee_id=emp.id,
                    evaluator_id=peer_id,
                    type='peer',
                    status='pending',
                    period=period_value,
                    due_date=data.end_date
                ))
                db.add(EvaluationAssignment(
                    tenant_id=current_user.tenant_id,
                    campaign_id=campaign.id,
                    employee_id=emp.id,
                    evaluator_id=peer_id,
                    evaluator_type='peer',
                    status='pending'
                ))

        # Évaluations collaborateurs (direct_report)
        if data.include_direct_report_evaluation and sel and sel.direct_report_ids:
            for dr_id in sel.direct_report_ids[:data.max_direct_report_evaluators]:
                db.add(Evaluation(
                    tenant_id=current_user.tenant_id,
                    campaign_id=campaign.id,
                    employee_id=emp.id,
                    evaluator_id=dr_id,
                    type='direct_report',
                    status='pending',
                    period=period_value,
                    due_date=data.end_date
                ))
                db.add(EvaluationAssignment(
                    tenant_id=current_user.tenant_id,
                    campaign_id=campaign.id,
                    employee_id=emp.id,
                    evaluator_id=dr_id,
                    evaluator_type='direct_report',
                    status='pending'
                ))

    db.commit()

    total_evals = db.query(func.count(Evaluation.id)).filter(
        Evaluation.campaign_id == campaign.id
    ).scalar() or 0

    return {
        "id": campaign.id,
        "tenant_id": campaign.tenant_id,
        "name": campaign.name,
        "description": campaign.description,
        "type": campaign.type,
        "status": campaign.status,
        "start_date": campaign.start_date,
        "end_date": campaign.end_date,
        "template": campaign.template,
        "period": campaign.period,
        "quarter": campaign.quarter,
        "weight_self": campaign.weight_self,
        "weight_manager": campaign.weight_manager,
        "weight_peer": campaign.weight_peer,
        "weight_direct_report": campaign.weight_direct_report,
        "include_self_evaluation": campaign.include_self_evaluation,
        "include_manager_evaluation": campaign.include_manager_evaluation,
        "include_peer_evaluation": campaign.include_peer_evaluation,
        "include_direct_report_evaluation": campaign.include_direct_report_evaluation,
        "min_peer_evaluators": campaign.min_peer_evaluators,
        "max_peer_evaluators": campaign.max_peer_evaluators,
        "min_direct_report_evaluators": campaign.min_direct_report_evaluators,
        "max_direct_report_evaluators": campaign.max_direct_report_evaluators,
        "created_by": campaign.created_by,
        "created_by_name": None,
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
        "total_evaluations": total_evals,
        "completed_evaluations": 0,
        "progress_percentage": 0
    }



@router.put("/campaigns/{campaign_id}", response_model=EvaluationCampaignResponse)
async def update_campaign(
    campaign_id: int,
    data: EvaluationCampaignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mettre à jour une campagne"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs et RH")
    
    campaign = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.id == campaign_id,
        EvaluationCampaign.tenant_id == current_user.tenant_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            if key == 'status' and hasattr(value, 'value'):
                value = value.value
            if key == 'template' and hasattr(value, 'model_dump'):
                value = value.model_dump()
            setattr(campaign, key, value)
    
    db.commit()
    db.refresh(campaign)
    
    # ✅ EXCLURE LES ÉVALUATIONS ANNULÉES
    total_evals = db.query(Evaluation).filter(
        Evaluation.campaign_id == campaign.id,
        Evaluation.status != 'cancelled'  # ← AJOUTÉ
    ).count()
    completed_evals = db.query(Evaluation).filter(
        Evaluation.campaign_id == campaign.id,
        Evaluation.status.in_(['submitted', 'validated'])
    ).count()
    
    return {
        "id": campaign.id,
        "tenant_id": campaign.tenant_id,
        "name": campaign.name,
        "description": campaign.description,
        "type": campaign.type,
        "status": campaign.status,
        "start_date": campaign.start_date,
        "end_date": campaign.end_date,
        "template": campaign.template,
        "created_by": campaign.created_by,
        "created_by_name": None,
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
        "total_evaluations": total_evals,
        "completed_evaluations": completed_evals,
        "progress_percentage": (completed_evals / total_evals * 100) if total_evals > 0 else 0
    }


# =============================================
# Router annuler
# =============================================

@router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Annuler une campagne d'évaluation.
    - Change le statut en 'cancelled'
    - Annule toutes les évaluations 'pending' liées
    - Garde les évaluations déjà soumises/validées
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs et RH")
    
    campaign = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.id == campaign_id,
        EvaluationCampaign.tenant_id == current_user.tenant_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")
    
    if campaign.status == 'cancelled':
        raise HTTPException(status_code=400, detail="Cette campagne est déjà annulée")
    
    if campaign.status == 'archived':
        raise HTTPException(status_code=400, detail="Impossible d'annuler une campagne archivée")
    
    # Annuler la campagne
    campaign.status = 'cancelled'
    campaign.updated_at = datetime.utcnow()
    
    # Annuler les évaluations pending (garder submitted/validated)
    pending_evaluations = db.query(Evaluation).filter(
        Evaluation.campaign_id == campaign_id,
        Evaluation.status.in_(['pending', 'in_progress'])
    ).all()
    
    cancelled_count = 0
    for eval in pending_evaluations:
        eval.status = 'cancelled'
        eval.updated_at = datetime.utcnow()
        cancelled_count += 1
    
    db.commit()
    
    return {
        "message": "Campagne annulée avec succès",
        "campaign_id": campaign_id,
        "campaign_name": campaign.name,
        "evaluations_cancelled": cancelled_count,
        "reason": reason
    }


@router.post("/campaigns/{campaign_id}/archive")
async def archive_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Archiver une campagne d'évaluation.
    - Change le statut en 'archived'
    - La campagne n'apparaît plus dans les listes par défaut
    - Toutes les données sont conservées
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs et RH")
    
    campaign = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.id == campaign_id,
        EvaluationCampaign.tenant_id == current_user.tenant_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")
    
    if campaign.status == 'archived':
        raise HTTPException(status_code=400, detail="Cette campagne est déjà archivée")
    
    if campaign.status == 'active':
        raise HTTPException(status_code=400, detail="Impossible d'archiver une campagne active. Terminez-la ou annulez-la d'abord.")
    
    # Archiver la campagne
    campaign.status = 'archived'
    campaign.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Campagne archivée avec succès",
        "campaign_id": campaign_id,
        "campaign_name": campaign.name
    }


@router.post("/campaigns/{campaign_id}/restore")
async def restore_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Restaurer une campagne archivée.
    - Change le statut en 'completed' (ou 'active' si dates le permettent)
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs et RH")
    
    campaign = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.id == campaign_id,
        EvaluationCampaign.tenant_id == current_user.tenant_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")
    
    if campaign.status != 'archived':
        raise HTTPException(status_code=400, detail="Seules les campagnes archivées peuvent être restaurées")
    
    # Déterminer le nouveau statut
    today = date.today()
    if campaign.end_date and campaign.end_date < today:
        new_status = 'completed'
    elif campaign.start_date and campaign.start_date <= today:
        new_status = 'active'
    else:
        new_status = 'draft'
    
    campaign.status = new_status
    campaign.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Campagne restaurée avec succès",
        "campaign_id": campaign_id,
        "campaign_name": campaign.name,
        "new_status": new_status
    }


# =============================================
# EVALUATIONS
# =============================================

@router.get("/evaluations", response_model=EvaluationListResponse)
async def get_evaluations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    campaign_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    status: Optional[EvaluationStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste des évaluations"""
    query = db.query(Evaluation).filter(Evaluation.tenant_id == current_user.tenant_id)
    
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    current_employee_id = current_user.employee_id
    
    # Filtrer pour non-admin/RH: voir uniquement ses propres évaluations ou celles de son équipe
    if user_role not in ['admin', 'super_admin', 'rh']:
        if current_employee_id:
            # Trouver les IDs des employés managés
            managed_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == current_employee_id).all()]
            managed_ids.append(current_employee_id)
            query = query.filter(
                or_(
                    Evaluation.employee_id.in_(managed_ids),
                    Evaluation.evaluator_id == current_employee_id
                )
            )
        else:
            query = query.filter(Evaluation.id == -1)  # Aucun résultat
    
    if campaign_id:
        query = query.filter(Evaluation.campaign_id == campaign_id)
    if employee_id:
        query = query.filter(Evaluation.employee_id == employee_id)
    if status:
        query = query.filter(Evaluation.status == status.value)
    
    total = query.count()
    evaluations = query.order_by(desc(Evaluation.created_at))\
                       .offset((page - 1) * page_size)\
                       .limit(page_size)\
                       .all()
    
    return {
        "items": [enrich_evaluation(ev, db) for ev in evaluations],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/evaluations/{evaluation_id}", response_model=EvaluationResponse)
async def get_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Détail d'une évaluation"""
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.tenant_id == current_user.tenant_id
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation non trouvée")
    
    return enrich_evaluation(evaluation, db)


@router.put("/evaluations/{evaluation_id}", response_model=EvaluationResponse)
async def update_evaluation(
    evaluation_id: int,
    data: EvaluationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mettre à jour une évaluation"""
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.tenant_id == current_user.tenant_id
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation non trouvée")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            if key == 'status' and hasattr(value, 'value'):
                value = value.value
            setattr(evaluation, key, value)
    
    db.commit()
    db.refresh(evaluation)
    
    return enrich_evaluation(evaluation, db)


@router.post("/evaluations/{evaluation_id}/submit", response_model=EvaluationResponse)
async def submit_evaluation(
    evaluation_id: int,
    data: EvaluationSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soumettre une évaluation"""
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.tenant_id == current_user.tenant_id
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation non trouvée")
    
    if evaluation.status in ['submitted', 'validated']:
        raise HTTPException(status_code=400, detail="Cette évaluation a déjà été soumise")
    
    # ✅ BLOQUER SI ANNULÉE
    if evaluation.status == 'cancelled':
        raise HTTPException(status_code=400, detail="Cette évaluation a été annulée et ne peut plus être modifiée")
    
    # Convertir les scores
    scores_dict = {}
    if data.scores:
        for k, v in data.scores.items():
            if hasattr(v, 'model_dump'):
                scores_dict[k] = v.model_dump()
            elif isinstance(v, dict):
                scores_dict[k] = v
            else:
                scores_dict[k] = {"score": v, "comment": ""}
    
    evaluation.scores = scores_dict
    evaluation.overall_score = data.overall_score
    evaluation.strengths = data.strengths
    evaluation.improvements = data.improvements
    evaluation.goals = data.goals
    evaluation.status = 'submitted'
    evaluation.submitted_at = datetime.utcnow()

    # Calcul du weighted_score si la campagne a des pondérations
    if evaluation.campaign_id:
        campaign = db.query(EvaluationCampaign).filter(
            EvaluationCampaign.id == evaluation.campaign_id
        ).first()
        if campaign:
            # Poids pour ce type d'évaluation
            type_weight_map = {
                'self': campaign.weight_self or 0,
                'manager': campaign.weight_manager or 0,
                'peer': campaign.weight_peer or 0,
                'direct_report': campaign.weight_direct_report or 0,
            }
            eval_type = str(evaluation.type)
            type_weight = type_weight_map.get(eval_type, 0)

            # Pour peer et direct_report, plusieurs évaluateurs partagent le même poids
            # → weight_score = overall_score * type_weight / 100 / n_evaluators_of_this_type
            if eval_type in ('peer', 'direct_report') and type_weight > 0:
                n_same_type = db.query(func.count(Evaluation.id)).filter(
                    Evaluation.campaign_id == evaluation.campaign_id,
                    Evaluation.employee_id == evaluation.employee_id,
                    Evaluation.type == eval_type
                ).scalar() or 1
                evaluation.weighted_score = round(
                    float(data.overall_score) * type_weight / 100 / n_same_type, 4
                )
            elif type_weight > 0:
                evaluation.weighted_score = round(
                    float(data.overall_score) * type_weight / 100, 4
                )

        # Synchroniser le statut de l'assignment correspondant
        assignment = db.query(EvaluationAssignment).filter(
            EvaluationAssignment.campaign_id == evaluation.campaign_id,
            EvaluationAssignment.employee_id == evaluation.employee_id,
            EvaluationAssignment.evaluator_id == evaluation.evaluator_id
        ).first()
        if assignment:
            assignment.status = 'completed'
            assignment.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(evaluation)

    return enrich_evaluation(evaluation, db)


@router.post("/evaluations/{evaluation_id}/validate", response_model=EvaluationResponse)
async def validate_evaluation(
    evaluation_id: int,
    data: EvaluationValidate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Valider une évaluation (manager/RH)"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh', 'manager']:
        raise HTTPException(status_code=403, detail="Accès réservé aux managers et administrateurs")
    
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.tenant_id == current_user.tenant_id
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation non trouvée")
    
    if evaluation.status != 'submitted':
        raise HTTPException(status_code=400, detail="Seules les évaluations soumises peuvent être validées")

    # Un manager ne peut valider que les évaluations de ses N-1
    if user_role == 'manager':
        current_employee_id = current_user.employee_id
        if current_employee_id:
            evaluated_employee = db.query(Employee).filter(Employee.id == evaluation.employee_id).first()
            if not evaluated_employee or evaluated_employee.manager_id != current_employee_id:
                raise HTTPException(
                    status_code=403,
                    detail="Vous ne pouvez valider que les évaluations de vos collaborateurs directs"
                )

    evaluation.manager_comments = data.manager_comments
    evaluation.status = 'validated' if data.approved else 'in_progress'
    evaluation.validated_at = datetime.utcnow() if data.approved else None
    evaluation.validated_by = current_user.employee_id
    
    db.commit()
    db.refresh(evaluation)
    
    return enrich_evaluation(evaluation, db)


# =============================================
# ONE-ON-ONES
# =============================================

@router.get("/one-on-ones", response_model=OneOnOneListResponse)
async def get_one_on_ones(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    employee_id: Optional[int] = None,
    status: Optional[OneOnOneStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste des 1-on-1"""
    query = db.query(OneOnOne).filter(OneOnOne.tenant_id == current_user.tenant_id)
    
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    current_employee_id = current_user.employee_id
    
    # Filtrer pour non-admin/RH
    if user_role not in ['admin', 'super_admin', 'rh']:
        if current_employee_id:
            query = query.filter(
                or_(
                    OneOnOne.employee_id == current_employee_id,
                    OneOnOne.manager_id == current_employee_id
                )
            )
        else:
            query = query.filter(OneOnOne.id == -1)
    
    if employee_id:
        query = query.filter(
            or_(OneOnOne.employee_id == employee_id, OneOnOne.manager_id == employee_id)
        )
    if status:
        query = query.filter(OneOnOne.status == status.value)
    
    total = query.count()
    one_on_ones = query.order_by(desc(OneOnOne.scheduled_date))\
                       .offset((page - 1) * page_size)\
                       .limit(page_size)\
                       .all()
    
    return {
        "items": [enrich_one_on_one(o, db) for o in one_on_ones],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.post("/one-on-ones", response_model=OneOnOneResponse)
async def create_one_on_one(
    data: OneOnOneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Planifier un 1-on-1"""
    # Récupérer l'employee_id du manager (utilisateur courant)
    manager_id = get_employee_id_or_error(current_user, db)
    
    # Vérifier que l'employé existe
    employee = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    # Un manager ne peut planifier un 1-on-1 qu'avec ses N-1
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role == 'manager':
        if employee.manager_id != manager_id:
            raise HTTPException(
                status_code=403,
                detail="Vous ne pouvez planifier un entretien qu'avec vos collaborateurs directs"
            )

    # Parser la date
    scheduled_date = data.scheduled_date
    if isinstance(scheduled_date, str):
        scheduled_date = datetime.fromisoformat(scheduled_date.replace('Z', '+00:00'))
    
    one_on_one = OneOnOne(
        tenant_id=current_user.tenant_id,
        employee_id=data.employee_id,
        manager_id=manager_id,
        scheduled_date=scheduled_date,
        duration_minutes=data.duration_minutes,
        location=data.location,
        topics=data.topics,
        status='scheduled',
        is_recurring=data.is_recurring if hasattr(data, 'is_recurring') else False,
        recurrence_pattern=data.recurrence_pattern.value if hasattr(data, 'recurrence_pattern') and data.recurrence_pattern else None
    )
    
    db.add(one_on_one)
    db.commit()
    db.refresh(one_on_one)

    # Sync vers Teams/Google Calendar si intégration active
    try:
        from app.services.sync_hooks import sync_one_on_one_created
        manager_email = current_user.email or ""
        employee_email = employee.email or ""
        if manager_email and employee_email:
            sync_one_on_one_created(db, current_user.tenant_id, one_on_one, manager_email, employee_email)
    except Exception:
        pass

    return enrich_one_on_one(one_on_one, db)


@router.post("/one-on-ones/{one_on_one_id}/complete", response_model=OneOnOneResponse)
async def complete_one_on_one(
    one_on_one_id: int,
    data: OneOnOneComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marquer un 1-on-1 comme complété"""
    one_on_one = db.query(OneOnOne).filter(
        OneOnOne.id == one_on_one_id,
        OneOnOne.tenant_id == current_user.tenant_id
    ).first()
    
    if not one_on_one:
        raise HTTPException(status_code=404, detail="1-on-1 non trouvé")
    
    import uuid
    one_on_one.notes = data.notes
    one_on_one.action_items = data.action_items
    one_on_one.mood = data.mood.value if data.mood else None
    one_on_one.evaluation_score = data.evaluation_score
    one_on_one.evaluation_comment = data.evaluation_comment
    # Convertir les tâches créées en tâches avec id/status
    if data.tasks:
        one_on_one.tasks = [
            {
                "id": str(uuid.uuid4()),
                "title": t.title,
                "type": t.type,
                "assignee": t.assignee,
                "due_date": t.due_date,
                "status": "pending",
                "completed_at": None,
            }
            for t in data.tasks
        ]
    else:
        one_on_one.tasks = []
    one_on_one.status = 'completed'
    one_on_one.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(one_on_one)
    
    return enrich_one_on_one(one_on_one, db)


@router.patch("/one-on-ones/{one_on_one_id}/tasks/{task_id}")
async def update_one_on_one_task(
    one_on_one_id: int,
    task_id: str,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mettre à jour le statut d'une tâche d'un 1-on-1 (manager ou employé concerné)"""
    one_on_one = db.query(OneOnOne).filter(
        OneOnOne.id == one_on_one_id,
        OneOnOne.tenant_id == current_user.tenant_id
    ).first()
    if not one_on_one:
        raise HTTPException(status_code=404, detail="1-on-1 non trouvé")

    employee_id = current_user.employee_id
    if employee_id not in (one_on_one.employee_id, one_on_one.manager_id):
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if status not in ('pending', 'done'):
        raise HTTPException(status_code=422, detail="Statut invalide (pending|done)")

    tasks = list(one_on_one.tasks or [])
    updated = False
    for t in tasks:
        if t.get('id') == task_id:
            t['status'] = status
            t['completed_at'] = datetime.utcnow().isoformat() if status == 'done' else None
            updated = True
            break
    if not updated:
        raise HTTPException(status_code=404, detail="Tâche non trouvée")

    from sqlalchemy import update as sql_update
    db.execute(
        sql_update(OneOnOne)
        .where(OneOnOne.id == one_on_one_id)
        .values(tasks=tasks)
    )
    db.commit()
    db.refresh(one_on_one)
    return enrich_one_on_one(one_on_one, db)


@router.post("/one-on-ones/{one_on_one_id}/cancel", response_model=OneOnOneResponse)
async def cancel_one_on_one(
    one_on_one_id: int,
    data: OneOnOneCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Annuler un 1-on-1"""
    one_on_one = db.query(OneOnOne).filter(
        OneOnOne.id == one_on_one_id,
        OneOnOne.tenant_id == current_user.tenant_id
    ).first()
    
    if not one_on_one:
        raise HTTPException(status_code=404, detail="1-on-1 non trouvé")
    
    one_on_one.status = 'cancelled'
    one_on_one.cancelled_at = datetime.utcnow()
    one_on_one.cancel_reason = data.reason
    
    db.commit()
    db.refresh(one_on_one)
    
    return enrich_one_on_one(one_on_one, db)


# =============================================
# STATS
# =============================================

@router.get("/my-stats")
async def get_my_performance_stats(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Statistiques personnalisées selon le rôle:
    - Employé: ses propres stats
    - Manager: ses stats + stats de son équipe
    - RH/Admin: stats globales
    """
    employee_id = current_user.employee_id
    year = year or datetime.now().year

    # my-stats retourne toujours les stats PERSONNELLES, peu importe le rôle
    # (les admins/RH qui veulent des stats globales doivent utiliser /api/performance/stats)
    scope = "personal"

    # Si l'employee_id n'est pas lié au user, chercher par email
    if not employee_id:
        emp = db.query(Employee).filter(
            Employee.email == current_user.email,
            Employee.tenant_id == current_user.tenant_id
        ).first()
        if emp:
            employee_id = emp.id
            current_user.employee_id = emp.id
            db.commit()

    employee_ids = [employee_id] if employee_id else []

    if not employee_ids:
        return {
            "scope": scope,
            "avg_score": 0,
            "evaluations_total": 0,
            "evaluations_completed": 0,
            "evaluations_pending": 0,
            "evaluations_in_progress": 0,
            "feedbacks_received": 0,
            "feedbacks_given": 0,
            "one_on_ones_scheduled": 0,
            "one_on_ones_completed": 0,
            "okr_achievement": 0,
            "team_size": 0
        }
    
    # ✅ BASE QUERY - EXCLURE LES ÉVALUATIONS ANNULÉES
    eval_query = db.query(Evaluation).filter(
        Evaluation.tenant_id == current_user.tenant_id,
        Evaluation.status != 'cancelled'  # ← AJOUTÉ
    )
    if employee_ids:
        eval_query = eval_query.filter(Evaluation.employee_id.in_(employee_ids))
    
    # Stats évaluations (exclut déjà cancelled via eval_query)
    total_evals = eval_query.count()
    completed_evals = eval_query.filter(Evaluation.status.in_(['submitted', 'validated'])).count()
    pending_evals = eval_query.filter(Evaluation.status == 'pending').count()
    in_progress_evals = eval_query.filter(Evaluation.status == 'in_progress').count()
    
    # ✅ SCORE MOYEN - EXCLURE LES ÉVALUATIONS ANNULÉES
    avg_score = db.query(func.avg(Evaluation.overall_score)).filter(
        Evaluation.tenant_id == current_user.tenant_id,
        Evaluation.overall_score.isnot(None),
        Evaluation.status != 'cancelled'  # ← AJOUTÉ
    )
    if employee_ids:
        avg_score = avg_score.filter(Evaluation.employee_id.in_(employee_ids))
    avg_score = avg_score.scalar() or 0
    
    # Feedbacks
    if employee_ids:
        feedbacks_received = db.query(Feedback).filter(
            Feedback.tenant_id == current_user.tenant_id,
            Feedback.to_employee_id.in_(employee_ids)
        ).count()
        feedbacks_given = db.query(Feedback).filter(
            Feedback.tenant_id == current_user.tenant_id,
            Feedback.from_employee_id.in_(employee_ids)
        ).count()
    else:
        feedbacks_received = db.query(Feedback).filter(Feedback.tenant_id == current_user.tenant_id).count()
        feedbacks_given = feedbacks_received
    
    # ✅ 1-ON-1 - EXCLURE LES ANNULÉS
    oo_query = db.query(OneOnOne).filter(
        OneOnOne.tenant_id == current_user.tenant_id,
        OneOnOne.status != 'cancelled'  # ← AJOUTÉ
    )
    if employee_ids:
        oo_query = oo_query.filter(
            or_(
                OneOnOne.employee_id.in_(employee_ids),
                OneOnOne.manager_id.in_(employee_ids)
            )
        )
    one_on_ones_scheduled = oo_query.filter(OneOnOne.status == 'scheduled').count()
    one_on_ones_completed = oo_query.filter(OneOnOne.status == 'completed').count()
    
    # Taille équipe (pour manager)
    team_size = 0
    if scope == "team" and employee_id:
        team_size = db.query(Employee).filter(Employee.manager_id == employee_id).count()
    elif scope == "global":
        team_size = db.query(Employee).filter(
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).count()
    
    # OKR achievement - calculé depuis les vrais OKRs de l'employé
    okr_achievement = 0.0
    try:
        from app.models.okr import Objective
        from app.api.okr import calculate_objective_progress
        okr_query = db.query(Objective).filter(
            Objective.tenant_id == current_user.tenant_id,
            Objective.is_active == True
        )
        if employee_ids:
            okr_query = okr_query.filter(Objective.owner_id.in_(employee_ids))
        objectives = okr_query.all()
        if objectives:
            total_progress = sum(calculate_objective_progress(obj) for obj in objectives)
            okr_achievement = round(total_progress / len(objectives), 1)
    except Exception:
        okr_achievement = 0.0
    
    # Score moyen des 1-on-1 évalués
    avg_oo_score = db.query(func.avg(OneOnOne.evaluation_score)).filter(
        OneOnOne.tenant_id == current_user.tenant_id,
        OneOnOne.evaluation_score.isnot(None),
        OneOnOne.status == 'completed'
    )
    if employee_ids:
        avg_oo_score = avg_oo_score.filter(
            or_(OneOnOne.employee_id.in_(employee_ids), OneOnOne.manager_id.in_(employee_ids))
        )
    avg_oo_score_val = round(float(avg_oo_score.scalar() or 0), 2)

    return {
        "scope": scope,
        "avg_score": round(float(avg_score), 2),
        "evaluations_total": total_evals,
        "evaluations_completed": completed_evals,
        "evaluations_pending": pending_evals,
        "evaluations_in_progress": in_progress_evals,
        "completion_rate": (completed_evals / total_evals * 100) if total_evals > 0 else 0,
        "feedbacks_received": feedbacks_received,
        "feedbacks_given": feedbacks_given,
        "one_on_ones_scheduled": one_on_ones_scheduled,
        "one_on_ones_completed": one_on_ones_completed,
        "avg_one_on_one_score": avg_oo_score_val,
        "okr_achievement": okr_achievement,
        "team_size": team_size
    }


@router.get("/stats", response_model=PerformanceStats)
async def get_performance_stats(
    year: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Statistiques globales de performance (RH/Admin/Manager)"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh', 'manager']:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    year = year or datetime.now().year
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)
    
    # ✅ QUERY DE BASE - EXCLURE LES ÉVALUATIONS ANNULÉES
    eval_query = db.query(Evaluation).filter(
        Evaluation.tenant_id == current_user.tenant_id,
        Evaluation.created_at >= start_date,
        Evaluation.created_at <= end_date,
        Evaluation.status != 'cancelled'  # ← AJOUTÉ
    )
    
    # Feedbacks ce mois
    month_start = date(datetime.now().year, datetime.now().month, 1)
    feedbacks_this_month = db.query(Feedback).filter(
        Feedback.tenant_id == current_user.tenant_id,
        Feedback.created_at >= month_start
    ).count()
    
    # Total feedbacks
    feedbacks_total = db.query(Feedback).filter(Feedback.tenant_id == current_user.tenant_id).count()
    
    # Évaluations stats (exclut déjà cancelled via eval_query)
    total_evals = eval_query.count()
    completed_evals = eval_query.filter(Evaluation.status.in_(['submitted', 'validated'])).count()
    pending_evals = eval_query.filter(Evaluation.status == 'pending').count()
    in_progress_evals = eval_query.filter(Evaluation.status == 'in_progress').count()
    
    # ✅ SCORE MOYEN - EXCLURE LES ANNULÉS
    avg_score_result = db.query(func.avg(Evaluation.overall_score)).filter(
        Evaluation.tenant_id == current_user.tenant_id,
        Evaluation.overall_score.isnot(None),
        Evaluation.status != 'cancelled'  # ← AJOUTÉ
    ).scalar() or 0
    
    # ✅ 1-ON-1 CETTE SEMAINE - EXCLURE LES ANNULÉS
    week_start = datetime.now() - timedelta(days=datetime.now().weekday())
    one_on_ones_this_week = db.query(OneOnOne).filter(
        OneOnOne.tenant_id == current_user.tenant_id,
        OneOnOne.scheduled_date >= week_start,
        OneOnOne.status.in_(['scheduled', 'completed'])  # Exclut déjà cancelled
    ).count()
    
    # Top feedback givers
    top_givers = db.query(
        Employee.first_name,
        Employee.last_name,
        func.count(Feedback.id).label('count')
    ).join(Feedback, Feedback.from_employee_id == Employee.id)\
     .filter(Feedback.tenant_id == current_user.tenant_id)\
     .group_by(Employee.id, Employee.first_name, Employee.last_name)\
     .order_by(desc('count'))\
     .limit(5).all()
    
    return {
        "avg_score": round(float(avg_score_result), 2),
        "score_distribution": {
            "Exceptionnel": 0,
            "Dépasse attentes": 0,
            "Atteint attentes": 0,
            "À améliorer": 0,
            "Insuffisant": 0
        },
        "evaluations_total": total_evals,
        "evaluations_completed": completed_evals,
        "evaluations_pending": pending_evals,
        "evaluations_in_progress": in_progress_evals,
        "completion_rate": (completed_evals / total_evals * 100) if total_evals > 0 else 0,
        "feedbacks_this_month": feedbacks_this_month,
        "feedbacks_total": feedbacks_total,
        "top_feedback_givers": [{"name": f"{g[0]} {g[1]}", "count": g[2]} for g in top_givers],
        "okr_achievement_avg": 78.0,
        "one_on_ones_this_week": one_on_ones_this_week,
        "one_on_ones_this_month": 0,
        "competency_averages": {},
        "score_trend": []
    }


# =============================================
# NOTE GLOBALE ANNUELLE
# =============================================

@router.get("/global-score/{employee_id}", response_model=GlobalScoreResponse)
async def get_global_score(
    employee_id: int,
    year: int = Query(default=None, description="Année (défaut : année en cours)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retourne la note globale annuelle d'un employé = moyenne des scores
    de toutes les campagnes (trimestriel, semestriel, annuel) pour l'année donnée.

    Accessible par l'employé lui-même, son manager, RH et admin.
    """
    if year is None:
        year = datetime.utcnow().year

    # Vérifier droits d'accès
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ('admin', 'super_admin', 'rh', 'manager'):
        # Employé simple : ne peut voir que ses propres données
        if current_user.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Accès non autorisé")

    # Récupérer toutes les campagnes de l'année pour ce tenant
    campaigns = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.tenant_id == current_user.tenant_id,
        func.extract('year', EvaluationCampaign.start_date) == year
    ).all()

    campaign_scores = []
    for camp in campaigns:
        # Calculer le score pondéré de l'employé pour cette campagne
        # = somme des weighted_score de toutes ses évaluations soumises/validées
        evals = db.query(Evaluation).filter(
            Evaluation.campaign_id == camp.id,
            Evaluation.employee_id == employee_id,
            Evaluation.status.in_(['submitted', 'validated']),
            Evaluation.weighted_score.isnot(None)
        ).all()

        if evals:
            campaign_score = round(sum(float(e.weighted_score) for e in evals), 2)
        else:
            campaign_score = None

        campaign_scores.append(CampaignScoreItem(
            campaign_id=camp.id,
            campaign_name=camp.name,
            period=camp.period or 'annual',
            quarter=camp.quarter,
            score=campaign_score
        ))

    # Note globale = moyenne des scores non-nuls des campagnes
    valid_scores = [c.score for c in campaign_scores if c.score is not None]
    campaign_avg = round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else None

    # Score moyen des 1-on-1 (sur 5, normalisé sur 10 pour homogénéité)
    oo_scores_raw = db.query(OneOnOne.evaluation_score).filter(
        OneOnOne.tenant_id == current_user.tenant_id,
        OneOnOne.employee_id == employee_id,
        OneOnOne.status == 'completed',
        OneOnOne.evaluation_score.isnot(None),
        func.extract('year', OneOnOne.completed_at) == year
    ).all()
    oo_score_avg = None
    if oo_scores_raw:
        raw_avg = sum(r[0] for r in oo_scores_raw) / len(oo_scores_raw)
        oo_score_avg = round(raw_avg * 2, 2)  # normalize /5 → /10

    # Note globale finale : 80% campagnes + 20% 1-on-1 (si disponibles)
    if campaign_avg is not None and oo_score_avg is not None:
        global_score = round(campaign_avg * 0.8 + oo_score_avg * 0.2, 2)
    elif campaign_avg is not None:
        global_score = campaign_avg
    elif oo_score_avg is not None:
        global_score = oo_score_avg
    else:
        global_score = None

    return GlobalScoreResponse(
        employee_id=employee_id,
        year=year,
        campaigns=campaign_scores,
        global_score=global_score
    )
