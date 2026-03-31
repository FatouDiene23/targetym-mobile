# =============================================
# API ROUTES - Performance Score
# File: app/api/performance_score.py
# =============================================
"""
Endpoints pour le calcul et l'affichage du score de performance global.

Connecte:
- OKRs
- Tâches (toutes sources)
- Validations journalières
- Feedbacks
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.models.user import User
from app.models.employee import Employee
from app.api.deps import get_current_user, get_current_tenant
from app.services.performance_calculator import (
    calculate_overall_performance,
    get_period_dates,
    performance_score_to_dict,
    WEIGHTS
)
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_PERFORMANCE

router = APIRouter(prefix="/api/performance/score", tags=["Performance Score"], dependencies=[Depends(require_feature(FEATURE_PERFORMANCE))])


# =============================================
# SCHEMAS
# =============================================

class PerformanceScoreResponse(BaseModel):
    overall_score: float
    okr_score: float
    task_score: float
    validation_score: float
    feedback_score: float
    period: dict
    weights: dict
    breakdown: dict

    class Config:
        from_attributes = True


class TeamPerformanceItem(BaseModel):
    employee_id: int
    employee_name: str
    job_title: Optional[str]
    overall_score: float
    okr_score: float
    task_score: float
    validation_score: float
    feedback_score: float


class TeamPerformanceResponse(BaseModel):
    items: List[TeamPerformanceItem]
    team_avg_score: float
    period: dict
    total: int


class PerformanceComparisonResponse(BaseModel):
    employee_score: PerformanceScoreResponse
    team_avg: float
    department_avg: Optional[float]
    company_avg: Optional[float]
    rank_in_team: Optional[int]
    rank_in_department: Optional[int]


# =============================================
# HELPERS
# =============================================

def get_employee_from_user(user: User, db: Session) -> Employee:
    """Récupère l'employé associé à l'utilisateur"""
    if user.employee_id:
        employee = db.query(Employee).filter(Employee.id == user.employee_id).first()
        if employee:
            return employee
    
    # Chercher par email
    employee = db.query(Employee).filter(
        Employee.email == user.email,
        Employee.tenant_id == user.tenant_id
    ).first()
    
    if employee:
        # Mettre à jour le user
        user.employee_id = employee.id
        db.commit()
        return employee
    
    raise HTTPException(status_code=400, detail="Profil employé non trouvé")


def is_manager_role(role) -> bool:
    """Vérifie si le rôle est manager ou supérieur"""
    if role is None:
        return False
    role_value = role.value if hasattr(role, 'value') else str(role)
    return role_value.lower() in ['manager', 'rh', 'admin', 'super_admin', 'dg']


# =============================================
# ENDPOINTS
# =============================================

@router.get("/me", response_model=PerformanceScoreResponse)
async def get_my_performance_score(
    period: str = Query("month", description="Période: week, month, quarter, year, last_month, last_quarter, Q1-Q4, YYYY-QX"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mon score de performance global.
    
    Retourne le score calculé à partir de:
    - OKRs (40%)
    - Tâches (25%)
    - Validations journalières (20%)
    - Feedbacks (15%)
    """
    employee = get_employee_from_user(current_user, db)
    period_start, period_end = get_period_dates(period)
    
    score = calculate_overall_performance(
        employee_id=employee.id,
        tenant_id=current_user.tenant_id,
        period_start=period_start,
        period_end=period_end,
        db=db
    )
    
    return performance_score_to_dict(score)


@router.get("/employee/{employee_id}", response_model=PerformanceScoreResponse)
async def get_employee_performance_score(
    employee_id: int,
    period: str = Query("month", description="Période: week, month, quarter, year"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Score de performance d'un employé spécifique.
    
    Accès:
    - Manager: ses collaborateurs directs
    - RH/Admin: tous les employés
    """
    # Vérifier les permissions
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    # Vérifier l'accès
    if user_role not in ['admin', 'super_admin', 'rh', 'dg']:
        current_employee = get_employee_from_user(current_user, db)
        
        # Manager peut voir ses collaborateurs directs
        if employee.manager_id != current_employee.id and employee.id != current_employee.id:
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    period_start, period_end = get_period_dates(period)
    
    score = calculate_overall_performance(
        employee_id=employee.id,
        tenant_id=current_user.tenant_id,
        period_start=period_start,
        period_end=period_end,
        db=db
    )
    
    return performance_score_to_dict(score)


@router.get("/team", response_model=TeamPerformanceResponse)
async def get_team_performance(
    period: str = Query("month", description="Période"),
    sort_by: str = Query("overall_score", description="Tri par: overall_score, okr_score, task_score"),
    sort_order: str = Query("desc", description="asc ou desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Performance de mon équipe (collaborateurs directs).
    
    Accès: Managers uniquement
    """
    if not is_manager_role(current_user.role):
        raise HTTPException(status_code=403, detail="Accès réservé aux managers")
    
    manager = get_employee_from_user(current_user, db)
    period_start, period_end = get_period_dates(period)
    
    # Récupérer les collaborateurs directs
    team_members = db.query(Employee).filter(
        Employee.manager_id == manager.id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.status == 'active'
    ).all()
    
    if not team_members:
        return {
            "items": [],
            "team_avg_score": 0,
            "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
            "total": 0
        }
    
    # Calculer le score de chaque membre
    items = []
    total_score = 0
    
    for member in team_members:
        score = calculate_overall_performance(
            employee_id=member.id,
            tenant_id=current_user.tenant_id,
            period_start=period_start,
            period_end=period_end,
            db=db
        )
        
        items.append({
            "employee_id": member.id,
            "employee_name": f"{member.first_name} {member.last_name}",
            "job_title": member.job_title,
            "overall_score": score.overall_score,
            "okr_score": score.okr_score,
            "task_score": score.task_score,
            "validation_score": score.validation_score,
            "feedback_score": score.feedback_score
        })
        
        total_score += score.overall_score
    
    # Trier
    reverse = sort_order == "desc"
    items.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)
    
    team_avg = total_score / len(items) if items else 0
    
    return {
        "items": items,
        "team_avg_score": round(team_avg, 1),
        "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "total": len(items)
    }


@router.get("/comparison", response_model=PerformanceComparisonResponse)
async def get_performance_comparison(
    period: str = Query("month", description="Période"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compare ma performance avec l'équipe et l'entreprise.
    """
    employee = get_employee_from_user(current_user, db)
    period_start, period_end = get_period_dates(period)
    
    # Mon score
    my_score = calculate_overall_performance(
        employee_id=employee.id,
        tenant_id=current_user.tenant_id,
        period_start=period_start,
        period_end=period_end,
        db=db
    )
    
    # Moyenne équipe (collègues avec le même manager)
    team_avg = None
    rank_in_team = None
    if employee.manager_id:
        teammates = db.query(Employee).filter(
            Employee.manager_id == employee.manager_id,
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()
        
        if teammates:
            team_scores = []
            for tm in teammates:
                tm_score = calculate_overall_performance(
                    employee_id=tm.id,
                    tenant_id=current_user.tenant_id,
                    period_start=period_start,
                    period_end=period_end,
                    db=db
                )
                team_scores.append((tm.id, tm_score.overall_score))
            
            team_avg = sum(s[1] for s in team_scores) / len(team_scores)
            
            # Rang dans l'équipe
            team_scores.sort(key=lambda x: x[1], reverse=True)
            for i, (emp_id, _) in enumerate(team_scores):
                if emp_id == employee.id:
                    rank_in_team = i + 1
                    break
    
    # Moyenne département
    department_avg = None
    rank_in_department = None
    if employee.department_id:
        dept_employees = db.query(Employee).filter(
            Employee.department_id == employee.department_id,
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()
        
        if dept_employees:
            dept_scores = []
            for de in dept_employees:
                de_score = calculate_overall_performance(
                    employee_id=de.id,
                    tenant_id=current_user.tenant_id,
                    period_start=period_start,
                    period_end=period_end,
                    db=db
                )
                dept_scores.append((de.id, de_score.overall_score))
            
            department_avg = sum(s[1] for s in dept_scores) / len(dept_scores)
            
            # Rang dans le département
            dept_scores.sort(key=lambda x: x[1], reverse=True)
            for i, (emp_id, _) in enumerate(dept_scores):
                if emp_id == employee.id:
                    rank_in_department = i + 1
                    break
    
    # Moyenne entreprise (optionnel - peut être lourd)
    company_avg = None
    # Désactivé pour performance - à activer si nécessaire
    
    return {
        "employee_score": performance_score_to_dict(my_score),
        "team_avg": round(team_avg, 1) if team_avg else None,
        "department_avg": round(department_avg, 1) if department_avg else None,
        "company_avg": company_avg,
        "rank_in_team": rank_in_team,
        "rank_in_department": rank_in_department
    }


@router.get("/weights")
async def get_performance_weights(
    current_user: User = Depends(get_current_user)
):
    """
    Retourne les poids utilisés pour le calcul du score.
    """
    return {
        "weights": WEIGHTS,
        "description": {
            "okr": "Progression des Objectifs & Key Results",
            "tasks": "Taux de complétion des tâches (toutes sources)",
            "validations": "Taux d'approbation des validations journalières",
            "feedbacks": "Score basé sur les feedbacks reçus"
        },
        "formula": "Score = (OKR × 40%) + (Tasks × 25%) + (Validations × 20%) + (Feedbacks × 15%)"
    }


@router.get("/department/{department_id}")
async def get_department_performance(
    department_id: int,
    period: str = Query("month", description="Période"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Performance d'un département.
    
    Accès: RH, Admin, DG uniquement
    """
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh', 'dg']:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    period_start, period_end = get_period_dates(period)
    
    # Récupérer les employés du département
    employees = db.query(Employee).filter(
        Employee.department_id == department_id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.status == 'active'
    ).all()
    
    if not employees:
        return {
            "items": [],
            "avg_score": 0,
            "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
            "total": 0
        }
    
    items = []
    total_score = 0
    
    for emp in employees:
        score = calculate_overall_performance(
            employee_id=emp.id,
            tenant_id=current_user.tenant_id,
            period_start=period_start,
            period_end=period_end,
            db=db
        )
        
        items.append({
            "employee_id": emp.id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "job_title": emp.job_title,
            "overall_score": score.overall_score,
            "okr_score": score.okr_score,
            "task_score": score.task_score,
            "validation_score": score.validation_score,
            "feedback_score": score.feedback_score
        })
        
        total_score += score.overall_score
    
    # Trier par score décroissant
    items.sort(key=lambda x: x["overall_score"], reverse=True)
    
    return {
        "items": items,
        "avg_score": round(total_score / len(items), 1) if items else 0,
        "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "total": len(items)
    }


# =============================================
# INTEGRATION AVEC EVALUATIONS
# =============================================

@router.post("/sync-to-evaluation/{evaluation_id}")
async def sync_performance_to_evaluation(
    evaluation_id: int,
    period: str = Query("quarter", description="Période à synchroniser"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Synchronise le score de performance calculé vers une évaluation.
    
    Met à jour:
    - okr_achievement_score
    - Peut ajouter des métriques dans le champ scores (JSON)
    
    Accès: RH, Admin uniquement
    """
    from app.models.performance import Evaluation
    
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH et administrateurs")
    
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.tenant_id == current_user.tenant_id
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation non trouvée")
    
    period_start, period_end = get_period_dates(period)
    
    score = calculate_overall_performance(
        employee_id=evaluation.employee_id,
        tenant_id=current_user.tenant_id,
        period_start=period_start,
        period_end=period_end,
        db=db
    )
    
    # Mettre à jour l'évaluation
    evaluation.okr_achievement_score = score.okr_score
    
    # Ajouter les métriques dans scores si c'est un dict
    if evaluation.scores is None:
        evaluation.scores = {}
    
    evaluation.scores["performance_metrics"] = {
        "overall_score": score.overall_score,
        "okr_score": score.okr_score,
        "task_score": score.task_score,
        "validation_score": score.validation_score,
        "feedback_score": score.feedback_score,
        "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "synced_at": datetime.utcnow().isoformat()
    }
    
    db.commit()
    
    return {
        "message": "Score synchronisé avec l'évaluation",
        "evaluation_id": evaluation_id,
        "okr_achievement_score": score.okr_score,
        "overall_performance_score": score.overall_score
    }
