# =============================================
# API ROUTES - Attitudes & Scoring
# File: app/api/attitudes.py
# =============================================
"""
Endpoints pour:
- CRUD attitudes (config RH)
- Scores d'attitudes par employé (formule Hermann)
- Intégration avec le feedback existant

"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, case
from typing import Optional, List
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.performance import Feedback
from app.models.attitude import Attitude, FeedbackAttitude
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/attitudes", tags=["Attitudes"])


# =============================================
# SCHEMAS
# =============================================

class AttitudeResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    category: str
    icon: str
    is_active: bool
    display_order: int

    class Config:
        from_attributes = True


class AttitudeCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    category: str = "Savoir-être"
    icon: str = "⭐"
    display_order: int = 0


class AttitudeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class AttitudeScoreItem(BaseModel):
    attitude_id: int
    attitude_code: str
    attitude_name: str
    attitude_icon: str
    total_feedbacks: int         # Nombre total de feedbackers ayant coché cette attitude
    recognition_count: int       # Nombre de "Reconnaissance"
    improvement_count: int       # Nombre de "À améliorer"
    score_solde: int             # Reconnaissance − Amélioration (points absolus)
    score_pct: float             # Reconnaissance / Total × 100 (pour validation ≥ 95%)


class EmployeeAttitudeScoresResponse(BaseModel):
    employee_id: int
    employee_name: str
    global_score: float          # Moyenne des score_pct de toutes les attitudes
    total_feedbacks_with_attitudes: int
    scores: List[AttitudeScoreItem]
    period: Optional[dict] = None


class AttitudeLeaderboardItem(BaseModel):
    employee_id: int
    employee_name: str
    job_title: Optional[str] = None
    department_name: Optional[str] = None
    global_attitude_score: float
    top_attitude: Optional[str] = None
    total_feedbacks: int


# =============================================
# CRUD ATTITUDES (Config RH - FBK-06)
# =============================================

@router.get("", response_model=List[AttitudeResponse])
async def get_attitudes(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste des attitudes configurées pour le tenant"""
    query = db.query(Attitude).filter(Attitude.tenant_id == current_user.tenant_id)
    if active_only:
        query = query.filter(Attitude.is_active == True)
    return query.order_by(Attitude.display_order, Attitude.name).all()


@router.post("", response_model=AttitudeResponse)
async def create_attitude(
    data: AttitudeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer une nouvelle attitude (RH/Admin) - FBK-06"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH et administrateurs")
    
    existing = db.query(Attitude).filter(
        Attitude.tenant_id == current_user.tenant_id,
        Attitude.code == data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Une attitude avec le code '{data.code}' existe déjà")
    
    attitude = Attitude(
        tenant_id=current_user.tenant_id,
        code=data.code,
        name=data.name,
        description=data.description,
        category=data.category,
        icon=data.icon,
        display_order=data.display_order
    )
    db.add(attitude)
    db.commit()
    db.refresh(attitude)
    return attitude


@router.post("/seed-defaults", response_model=List[AttitudeResponse])
async def seed_default_attitudes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initialiser les 9 attitudes Targetym pour ce tenant (RH/Admin).
    Idempotent — ne recrée pas les attitudes déjà existantes (par code).
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH et administrateurs")

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

    created = []
    for att_data in DEFAULT_ATTITUDES:
        existing = db.query(Attitude).filter(
            Attitude.tenant_id == current_user.tenant_id,
            Attitude.code == att_data["code"]
        ).first()
        if not existing:
            att = Attitude(
                tenant_id=current_user.tenant_id,
                **att_data
            )
            db.add(att)
            db.flush()
            created.append(att)

    db.commit()
    for att in created:
        db.refresh(att)

    # Retourner toutes les attitudes actives du tenant
    return db.query(Attitude).filter(
        Attitude.tenant_id == current_user.tenant_id,
        Attitude.is_active == True
    ).order_by(Attitude.display_order).all()


@router.put("/{attitude_id}", response_model=AttitudeResponse)
async def update_attitude(
    attitude_id: int,
    data: AttitudeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Modifier une attitude (RH/Admin) - FBK-06"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH et administrateurs")
    
    attitude = db.query(Attitude).filter(
        Attitude.id == attitude_id,
        Attitude.tenant_id == current_user.tenant_id
    ).first()
    if not attitude:
        raise HTTPException(status_code=404, detail="Attitude non trouvée")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(attitude, key, value)
    
    db.commit()
    db.refresh(attitude)
    return attitude


# =============================================
# CALCUL DES SCORES (FBK-02, FBK-04)
# =============================================

def compute_attitude_scores(
    employee_id: int,
    tenant_id: int,
    db: Session,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None
) -> tuple:
    """
    Calcule les scores d'attitudes pour un employé.
    
    Formule Hermann:
      Score Solde = Reconnaissance − Amélioration
      Score %    = Reconnaissance / Total Feedbackers × 100
      Score Global = Moyenne des Score % de toutes les attitudes
    
    Returns: (scores_list, global_score, total_feedbacks_with_attitudes)
    """
    # Feedbacks reçus par l'employé dans la période
    feedback_query = db.query(Feedback.id).filter(
        Feedback.to_employee_id == employee_id,
        Feedback.tenant_id == tenant_id
    )
    if period_start:
        feedback_query = feedback_query.filter(Feedback.created_at >= datetime.combine(period_start, datetime.min.time()))
    if period_end:
        feedback_query = feedback_query.filter(Feedback.created_at <= datetime.combine(period_end, datetime.max.time()))
    
    feedback_ids = [f[0] for f in feedback_query.all()]
    
    # Toutes les attitudes actives du tenant
    attitudes = db.query(Attitude).filter(
        Attitude.tenant_id == tenant_id,
        Attitude.is_active == True
    ).order_by(Attitude.display_order).all()
    
    scores = []
    total_score_pct = 0
    scored_count = 0
    max_feedbacks = 0
    
    for attitude in attitudes:
        if feedback_ids:
            stats = db.query(
                func.count(FeedbackAttitude.id).label('total'),
                func.count(case(
                    (FeedbackAttitude.sentiment == 'recognition', 1)
                )).label('recognition'),
                func.count(case(
                    (FeedbackAttitude.sentiment == 'improvement', 1)
                )).label('improvement')
            ).filter(
                FeedbackAttitude.feedback_id.in_(feedback_ids),
                FeedbackAttitude.attitude_id == attitude.id
            ).first()
            
            total = stats.total or 0
            recognition = stats.recognition or 0
            improvement = stats.improvement or 0
        else:
            total = 0
            recognition = 0
            improvement = 0
        
        # Score Solde = Reconnaissance − Amélioration (points absolus)
        score_solde = recognition - improvement
        
        # Score % = Reconnaissance / Total Feedbackers × 100
        score_pct = round((recognition / total) * 100, 1) if total > 0 else 0.0
        
        if total > 0:
            total_score_pct += score_pct
            scored_count += 1
            max_feedbacks = max(max_feedbacks, total)
        
        scores.append(AttitudeScoreItem(
            attitude_id=attitude.id,
            attitude_code=attitude.code,
            attitude_name=attitude.name,
            attitude_icon=attitude.icon,
            total_feedbacks=total,
            recognition_count=recognition,
            improvement_count=improvement,
            score_solde=score_solde,
            score_pct=score_pct
        ))
    
    # Score Global = Moyenne des Score % de toutes les attitudes
    global_score = round(total_score_pct / scored_count, 1) if scored_count > 0 else 0.0
    
    return scores, global_score, max_feedbacks


# =============================================
# ENDPOINTS SCORES (FBK-03, FBK-04, FBK-05)
# =============================================

@router.get("/scores/employee/{employee_id}", response_model=EmployeeAttitudeScoresResponse)
async def get_employee_attitude_scores(
    employee_id: int,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Scores d'attitudes pour un employé (FBK-03, FBK-04).
    
    FBK-05 Confidentialité: le collaborateur voit les scores agrégés,
    jamais les feedbackers individuels.
    
    Accès:
    - Employé: ses propres scores uniquement
    - Manager: scores de ses N-1
    - RH/Admin/DG: tous les scores
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    # Vérifier les permissions
    if user_role not in ['admin', 'super_admin', 'rh', 'dg']:
        current_emp_id = current_user.employee_id
        if current_emp_id != employee_id:
            if employee.manager_id != current_emp_id:
                raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    scores, global_score, total_feedbacks = compute_attitude_scores(
        employee_id=employee_id,
        tenant_id=current_user.tenant_id,
        db=db,
        period_start=period_start,
        period_end=period_end
    )
    
    return EmployeeAttitudeScoresResponse(
        employee_id=employee_id,
        employee_name=f"{employee.first_name} {employee.last_name}",
        global_score=global_score,
        total_feedbacks_with_attitudes=total_feedbacks,
        scores=scores,
        period={
            "start": period_start.isoformat() if period_start else None,
            "end": period_end.isoformat() if period_end else None
        }
    )


@router.get("/scores/me", response_model=EmployeeAttitudeScoresResponse)
async def get_my_attitude_scores(
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mes propres scores d'attitudes (FBK-03)"""
    employee_id = current_user.employee_id
    if not employee_id:
        emp = db.query(Employee).filter(
            Employee.email == current_user.email,
            Employee.tenant_id == current_user.tenant_id
        ).first()
        if emp:
            employee_id = emp.id
        else:
            raise HTTPException(status_code=400, detail="Profil employé non trouvé")
    
    return await get_employee_attitude_scores(
        employee_id=employee_id,
        period_start=period_start,
        period_end=period_end,
        db=db,
        current_user=current_user
    )


@router.get("/scores/team", response_model=List[AttitudeLeaderboardItem])
async def get_team_attitude_scores(
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    sort_by: str = Query("global_attitude_score", description="Tri: global_attitude_score, total_feedbacks"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Scores d'attitudes de l'équipe.
    - Manager: ses N-1
    - RH/Admin/DG: tous les employés
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    
    if user_role in ['admin', 'super_admin', 'rh', 'dg']:
        employees = db.query(Employee).filter(
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()
    else:
        manager_id = current_user.employee_id
        if not manager_id:
            raise HTTPException(status_code=400, detail="Profil employé non trouvé")
        employees = db.query(Employee).filter(
            Employee.manager_id == manager_id,
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()
        if not employees:
            raise HTTPException(status_code=403, detail="Aucun collaborateur trouvé")
    
    items = []
    for emp in employees:
        scores, global_score, total_fb = compute_attitude_scores(
            employee_id=emp.id,
            tenant_id=current_user.tenant_id,
            db=db,
            period_start=period_start,
            period_end=period_end
        )
        
        # Trouver la meilleure attitude
        top_attitude = None
        if scores:
            scored = [s for s in scores if s.total_feedbacks > 0]
            if scored:
                best = max(scored, key=lambda s: s.score_pct)
                top_attitude = best.attitude_name
        
        items.append(AttitudeLeaderboardItem(
            employee_id=emp.id,
            employee_name=f"{emp.first_name} {emp.last_name}",
            job_title=emp.job_title,
            department_name=emp.department.name if emp.department else None,
            global_attitude_score=global_score,
            top_attitude=top_attitude,
            total_feedbacks=total_fb
        ))
    
    # Trier
    items.sort(key=lambda x: getattr(x, sort_by, 0) or 0, reverse=True)
    
    return items