# =============================================
# PERFORMANCE SCORE CALCULATOR
# File: app/services/performance_calculator.py
# =============================================
"""
Module de calcul du score de performance global.

Formule:
    Performance = OKR (40%) + Tâches (25%) + Validations (20%) + Feedbacks (15%)

Ce module connecte:
    - Les OKRs (objectives, key_results)
    - Les Tâches (tasks, daily_validations)
    - Les Feedbacks (feedbacks)
    - Les Évaluations (evaluations)
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import date, datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass


# =============================================
# CONFIGURATION DES POIDS
# =============================================

WEIGHTS = {
    "okr": 0.40,           # 40% - Objectifs & Key Results
    "tasks": 0.25,         # 25% - Complétion des tâches
    "validations": 0.20,   # 20% - Validations journalières approuvées
    "feedbacks": 0.15,     # 15% - Feedbacks reçus
}


# =============================================
# DATA CLASSES
# =============================================

@dataclass
class OKRMetrics:
    """Métriques OKR d'un employé"""
    total_objectives: int
    active_objectives: int
    avg_progress: float
    completed_objectives: int
    objectives_detail: List[Dict]
    score: float  # Score normalisé sur 100


@dataclass
class TaskMetrics:
    """Métriques de tâches d'un employé"""
    total_tasks: int
    completed_tasks: int
    on_time_tasks: int
    overdue_tasks: int
    completion_rate: float
    on_time_rate: float
    by_source: Dict[str, int]
    score: float  # Score normalisé sur 100


@dataclass
class ValidationMetrics:
    """Métriques de validations journalières"""
    total_validations: int
    approved_validations: int
    rejected_validations: int
    pending_validations: int
    approval_rate: float
    avg_completion_rate: float
    score: float  # Score normalisé sur 100


@dataclass
class FeedbackMetrics:
    """Métriques de feedbacks"""
    total_received: int
    recognition_count: int
    improvement_count: int
    general_count: int
    total_likes: int
    avg_feedback_score: float
    score: float  # Score normalisé sur 100


@dataclass
class PerformanceScore:
    """Score de performance global"""
    overall_score: float
    okr_score: float
    task_score: float
    validation_score: float
    feedback_score: float
    okr_metrics: OKRMetrics
    task_metrics: TaskMetrics
    validation_metrics: ValidationMetrics
    feedback_metrics: FeedbackMetrics
    period_start: date
    period_end: date
    weights: Dict[str, float]


# =============================================
# FONCTIONS DE CALCUL
# =============================================

def calculate_okr_metrics(
    employee_id: int,
    tenant_id: int,
    period_start: date,
    period_end: date,
    db: Session
) -> OKRMetrics:
    """
    Calcule les métriques OKR pour un employé.
    
    Score = moyenne pondérée de la progression des objectifs actifs
    """
    from app.models.okr import Objective, KeyResult, ObjectiveStatus
    
    # Récupérer les objectifs de l'employé pour la période
    objectives = db.query(Objective).filter(
        Objective.tenant_id == tenant_id,
        Objective.owner_id == employee_id,
        Objective.is_active == True,
        or_(
            Objective.status.in_(['active', 'on_track', 'at_risk', 'behind', 'completed', 'exceeded']),
            Objective.status == None  # Pour les anciens enregistrements
        ),
        or_(
            and_(Objective.start_date <= period_end, Objective.end_date >= period_start),
            Objective.start_date == None  # Objectifs sans dates explicites
        )
    ).all()
    
    if not objectives:
        return OKRMetrics(
            total_objectives=0,
            active_objectives=0,
            avg_progress=0,
            completed_objectives=0,
            objectives_detail=[],
            score=0
        )
    
    # Calculer la progression de chaque objectif
    objectives_detail = []
    total_progress = 0
    completed_count = 0
    
    for obj in objectives:
        # Calculer la progression basée sur les Key Results
        progress = 0
        if obj.key_results:
            total_weight = sum(kr.weight for kr in obj.key_results)
            if total_weight > 0:
                weighted_progress = sum(
                    (min(kr.current / kr.target, 1) * 100 if kr.target > 0 else 0) * kr.weight
                    for kr in obj.key_results
                )
                progress = weighted_progress / total_weight
        else:
            progress = obj.progress or 0
        
        total_progress += progress
        
        if obj.status in ['completed', 'exceeded'] or progress >= 100:
            completed_count += 1
        
        objectives_detail.append({
            "id": obj.id,
            "title": obj.title,
            "level": obj.level.value if obj.level else "individual",
            "progress": round(progress, 1),
            "status": obj.status.value if obj.status else "active",
            "key_results_count": len(obj.key_results)
        })
    
    avg_progress = total_progress / len(objectives) if objectives else 0
    
    return OKRMetrics(
        total_objectives=len(objectives),
        active_objectives=len([o for o in objectives if o.status not in ['completed', 'exceeded', 'cancelled']]),
        avg_progress=round(avg_progress, 1),
        completed_objectives=completed_count,
        objectives_detail=objectives_detail,
        score=round(avg_progress, 1)  # Score = progression moyenne
    )


def calculate_task_metrics(
    employee_id: int,
    tenant_id: int,
    period_start: date,
    period_end: date,
    db: Session
) -> TaskMetrics:
    """
    Calcule les métriques de tâches pour un employé.
    
    Score = (completion_rate * 0.7) + (on_time_rate * 0.3)
    """
    from app.models.task import Task
    
    # Récupérer les tâches de la période
    tasks = db.query(Task).filter(
        Task.tenant_id == tenant_id,
        Task.assigned_to_id == employee_id,
        Task.due_date >= period_start,
        Task.due_date <= period_end,
        Task.status != 'cancelled'
    ).all()
    
    if not tasks:
        return TaskMetrics(
            total_tasks=0,
            completed_tasks=0,
            on_time_tasks=0,
            overdue_tasks=0,
            completion_rate=0,
            on_time_rate=0,
            by_source={},
            score=0
        )
    
    total = len(tasks)
    completed = [t for t in tasks if t.status == 'completed']
    completed_count = len(completed)
    
    # Tâches terminées à temps (completed_at <= due_date)
    on_time = [
        t for t in completed 
        if t.completed_at and t.completed_at.date() <= t.due_date
    ]
    on_time_count = len(on_time)
    
    # Tâches en retard (non complétées et due_date passée)
    today = date.today()
    overdue = [
        t for t in tasks 
        if t.status != 'completed' and t.due_date < today
    ]
    overdue_count = len(overdue)
    
    # Répartition par source
    by_source = {}
    for t in tasks:
        source = t.source or 'manual'
        by_source[source] = by_source.get(source, 0) + 1
    
    completion_rate = (completed_count / total * 100) if total > 0 else 0
    on_time_rate = (on_time_count / completed_count * 100) if completed_count > 0 else 0
    
    # Score combiné : 70% completion + 30% on-time
    score = (completion_rate * 0.7) + (on_time_rate * 0.3)
    
    return TaskMetrics(
        total_tasks=total,
        completed_tasks=completed_count,
        on_time_tasks=on_time_count,
        overdue_tasks=overdue_count,
        completion_rate=round(completion_rate, 1),
        on_time_rate=round(on_time_rate, 1),
        by_source=by_source,
        score=round(score, 1)
    )


def calculate_validation_metrics(
    employee_id: int,
    tenant_id: int,
    period_start: date,
    period_end: date,
    db: Session
) -> ValidationMetrics:
    """
    Calcule les métriques de validations journalières.
    
    Score = (approval_rate * 0.6) + (avg_completion_rate * 0.4)
    """
    from app.models.task import DailyValidation
    
    # Récupérer les validations de la période
    validations = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == tenant_id,
        DailyValidation.employee_id == employee_id,
        DailyValidation.validation_date >= period_start,
        DailyValidation.validation_date <= period_end
    ).all()
    
    if not validations:
        return ValidationMetrics(
            total_validations=0,
            approved_validations=0,
            rejected_validations=0,
            pending_validations=0,
            approval_rate=0,
            avg_completion_rate=0,
            score=0
        )
    
    total = len(validations)
    approved = len([v for v in validations if v.status == 'approved'])
    rejected = len([v for v in validations if v.status == 'rejected'])
    pending = len([v for v in validations if v.status == 'pending'])
    
    # Taux d'approbation (exclure les pending du calcul)
    decided = approved + rejected
    approval_rate = (approved / decided * 100) if decided > 0 else 0
    
    # Taux de complétion moyen des journées soumises
    completion_rates = [
        (v.completed_tasks / v.total_tasks * 100) if v.total_tasks > 0 else 0
        for v in validations
    ]
    avg_completion_rate = sum(completion_rates) / len(completion_rates) if completion_rates else 0
    
    # Score combiné : 60% approval + 40% completion
    score = (approval_rate * 0.6) + (avg_completion_rate * 0.4)
    
    return ValidationMetrics(
        total_validations=total,
        approved_validations=approved,
        rejected_validations=rejected,
        pending_validations=pending,
        approval_rate=round(approval_rate, 1),
        avg_completion_rate=round(avg_completion_rate, 1),
        score=round(score, 1)
    )


def calculate_feedback_metrics(
    employee_id: int,
    tenant_id: int,
    period_start: date,
    period_end: date,
    db: Session
) -> FeedbackMetrics:
    """
    Calcule les métriques de feedbacks reçus.
    
    Score basé sur:
    - Nombre de feedbacks recognition (poids 1.5)
    - Nombre de feedbacks general (poids 1.0)
    - Nombre de feedbacks improvement (poids 0.5)
    - Bonus pour les likes reçus
    """
    from app.models.performance import Feedback
    
    # Récupérer les feedbacks reçus pendant la période
    feedbacks = db.query(Feedback).filter(
        Feedback.tenant_id == tenant_id,
        Feedback.to_employee_id == employee_id,
        Feedback.created_at >= datetime.combine(period_start, datetime.min.time()),
        Feedback.created_at <= datetime.combine(period_end, datetime.max.time())
    ).all()
    
    if not feedbacks:
        return FeedbackMetrics(
            total_received=0,
            recognition_count=0,
            improvement_count=0,
            general_count=0,
            total_likes=0,
            avg_feedback_score=0,
            score=0
        )
    
    recognition = len([f for f in feedbacks if f.type == 'recognition'])
    improvement = len([f for f in feedbacks if f.type == 'improvement'])
    general = len([f for f in feedbacks if f.type == 'general'])
    total_likes = sum(f.likes_count or 0 for f in feedbacks)
    
    # Score pondéré par type
    # Recognition = positif (1.5), General = neutre (1.0), Improvement = à améliorer (0.5)
    weighted_score = (recognition * 1.5) + (general * 1.0) + (improvement * 0.5)
    max_possible = len(feedbacks) * 1.5  # Si tous étaient recognition
    
    # Normaliser sur 100
    if max_possible > 0:
        base_score = (weighted_score / max_possible) * 100
    else:
        base_score = 0
    
    # Bonus likes (max +10 points)
    likes_bonus = min(total_likes * 0.5, 10)
    
    score = min(base_score + likes_bonus, 100)
    
    # Score moyen par feedback
    avg_feedback_score = weighted_score / len(feedbacks) if feedbacks else 0
    
    return FeedbackMetrics(
        total_received=len(feedbacks),
        recognition_count=recognition,
        improvement_count=improvement,
        general_count=general,
        total_likes=total_likes,
        avg_feedback_score=round(avg_feedback_score, 2),
        score=round(score, 1)
    )


def calculate_overall_performance(
    employee_id: int,
    tenant_id: int,
    period_start: date,
    period_end: date,
    db: Session,
    custom_weights: Optional[Dict[str, float]] = None
) -> PerformanceScore:
    """
    Calcule le score de performance global d'un employé.
    
    Formule par défaut:
        Performance = OKR (40%) + Tâches (25%) + Validations (20%) + Feedbacks (15%)
    
    Args:
        employee_id: ID de l'employé
        tenant_id: ID du tenant
        period_start: Début de la période
        period_end: Fin de la période
        db: Session SQLAlchemy
        custom_weights: Poids personnalisés (optionnel)
    
    Returns:
        PerformanceScore avec tous les détails
    """
    weights = custom_weights or WEIGHTS
    
    # Calculer chaque composante
    okr_metrics = calculate_okr_metrics(employee_id, tenant_id, period_start, period_end, db)
    task_metrics = calculate_task_metrics(employee_id, tenant_id, period_start, period_end, db)
    validation_metrics = calculate_validation_metrics(employee_id, tenant_id, period_start, period_end, db)
    feedback_metrics = calculate_feedback_metrics(employee_id, tenant_id, period_start, period_end, db)
    
    # Calculer le score global pondéré
    overall_score = (
        okr_metrics.score * weights.get("okr", 0.40) +
        task_metrics.score * weights.get("tasks", 0.25) +
        validation_metrics.score * weights.get("validations", 0.20) +
        feedback_metrics.score * weights.get("feedbacks", 0.15)
    )
    
    return PerformanceScore(
        overall_score=round(overall_score, 1),
        okr_score=okr_metrics.score,
        task_score=task_metrics.score,
        validation_score=validation_metrics.score,
        feedback_score=feedback_metrics.score,
        okr_metrics=okr_metrics,
        task_metrics=task_metrics,
        validation_metrics=validation_metrics,
        feedback_metrics=feedback_metrics,
        period_start=period_start,
        period_end=period_end,
        weights=weights
    )


# =============================================
# HELPERS
# =============================================

def get_period_dates(period: str) -> tuple:
    """
    Retourne les dates de début et fin pour une période donnée.
    
    Périodes supportées:
    - "week": Semaine en cours
    - "month": Mois en cours
    - "quarter": Trimestre en cours
    - "year": Année en cours
    - "last_month": Mois précédent
    - "last_quarter": Trimestre précédent
    - "Q1", "Q2", "Q3", "Q4": Trimestre spécifique de l'année en cours
    - "2024-Q1", etc.: Trimestre d'une année spécifique
    """
    today = date.today()
    
    if period == "week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    
    elif period == "month":
        start = today.replace(day=1)
        next_month = start.replace(month=start.month % 12 + 1, day=1) if start.month < 12 else start.replace(year=start.year + 1, month=1, day=1)
        end = next_month - timedelta(days=1)
    
    elif period == "quarter":
        quarter = (today.month - 1) // 3
        start = date(today.year, quarter * 3 + 1, 1)
        end_month = quarter * 3 + 3
        if end_month == 12:
            end = date(today.year, 12, 31)
        else:
            end = date(today.year, end_month + 1, 1) - timedelta(days=1)
    
    elif period == "year":
        start = date(today.year, 1, 1)
        end = date(today.year, 12, 31)
    
    elif period == "last_month":
        first_of_month = today.replace(day=1)
        end = first_of_month - timedelta(days=1)
        start = end.replace(day=1)
    
    elif period == "last_quarter":
        current_quarter = (today.month - 1) // 3
        if current_quarter == 0:
            year = today.year - 1
            quarter = 3
        else:
            year = today.year
            quarter = current_quarter - 1
        start = date(year, quarter * 3 + 1, 1)
        end_month = quarter * 3 + 3
        if end_month == 12:
            end = date(year, 12, 31)
        else:
            end = date(year, end_month + 1, 1) - timedelta(days=1)
    
    elif period.startswith("Q") and len(period) == 2:
        quarter = int(period[1]) - 1
        start = date(today.year, quarter * 3 + 1, 1)
        end_month = quarter * 3 + 3
        if end_month == 12:
            end = date(today.year, 12, 31)
        else:
            end = date(today.year, end_month + 1, 1) - timedelta(days=1)
    
    elif "-Q" in period:
        year, q = period.split("-Q")
        year = int(year)
        quarter = int(q) - 1
        start = date(year, quarter * 3 + 1, 1)
        end_month = quarter * 3 + 3
        if end_month == 12:
            end = date(year, 12, 31)
        else:
            end = date(year, end_month + 1, 1) - timedelta(days=1)
    
    else:
        # Par défaut: mois en cours
        start = today.replace(day=1)
        next_month = start.replace(month=start.month % 12 + 1, day=1) if start.month < 12 else start.replace(year=start.year + 1, month=1, day=1)
        end = next_month - timedelta(days=1)
    
    return start, end


def performance_score_to_dict(score: PerformanceScore) -> Dict[str, Any]:
    """Convertit un PerformanceScore en dictionnaire pour l'API"""
    return {
        "overall_score": score.overall_score,
        "okr_score": score.okr_score,
        "task_score": score.task_score,
        "validation_score": score.validation_score,
        "feedback_score": score.feedback_score,
        "period": {
            "start": score.period_start.isoformat(),
            "end": score.period_end.isoformat()
        },
        "weights": score.weights,
        "breakdown": {
            "okr": {
                "score": score.okr_metrics.score,
                "total_objectives": score.okr_metrics.total_objectives,
                "active_objectives": score.okr_metrics.active_objectives,
                "avg_progress": score.okr_metrics.avg_progress,
                "completed_objectives": score.okr_metrics.completed_objectives,
                "details": score.okr_metrics.objectives_detail
            },
            "tasks": {
                "score": score.task_metrics.score,
                "total_tasks": score.task_metrics.total_tasks,
                "completed_tasks": score.task_metrics.completed_tasks,
                "on_time_tasks": score.task_metrics.on_time_tasks,
                "overdue_tasks": score.task_metrics.overdue_tasks,
                "completion_rate": score.task_metrics.completion_rate,
                "on_time_rate": score.task_metrics.on_time_rate,
                "by_source": score.task_metrics.by_source
            },
            "validations": {
                "score": score.validation_metrics.score,
                "total_validations": score.validation_metrics.total_validations,
                "approved_validations": score.validation_metrics.approved_validations,
                "rejected_validations": score.validation_metrics.rejected_validations,
                "pending_validations": score.validation_metrics.pending_validations,
                "approval_rate": score.validation_metrics.approval_rate,
                "avg_completion_rate": score.validation_metrics.avg_completion_rate
            },
            "feedbacks": {
                "score": score.feedback_metrics.score,
                "total_received": score.feedback_metrics.total_received,
                "recognition_count": score.feedback_metrics.recognition_count,
                "improvement_count": score.feedback_metrics.improvement_count,
                "general_count": score.feedback_metrics.general_count,
                "total_likes": score.feedback_metrics.total_likes,
                "avg_feedback_score": score.feedback_metrics.avg_feedback_score
            }
        }
    }
