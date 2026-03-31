# =============================================
# API ROUTES - 360° Feedback & Calibration
# File: app/api/performance_360.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.database import get_db
from app.models.performance import (
    EvaluationCampaign, Evaluation, EvaluationAssignment,
    CalibrationSession, CalibrationParticipant, CalibrationScoreAdjustment
)
from app.models.employee import Employee
from app.models.user import User
from app.schemas.performance_360 import (
    # Assignments
    EvaluationAssignmentCreate, EvaluationAssignmentResponse,
    BulkAssignmentCreate, AutoAssignmentRequest,
    # Campaign 360
    Campaign360Create, Campaign360Response,
    # 360 Summary
    Evaluation360Summary, Evaluation360ListResponse,
    # Calibration
    CalibrationSessionCreate, CalibrationSessionUpdate,
    CalibrationSessionResponse, CalibrationSessionListResponse,
    # Score Adjustments
    ScoreAdjustmentCreate, ScoreAdjustmentResponse, BulkScoreAdjustment,
    # Comparison
    CalibrationComparisonItem, CalibrationComparisonResponse,
    # Participants
    CalibrationParticipantResponse, AddParticipantsRequest,
    # Enums
    EvaluatorType, PeerSelectionMode, CalibrationStatus, AssignmentStatus
)
from app.api.deps import get_current_user
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_PERFORMANCE

router = APIRouter(prefix="/api/performance/360", tags=["360° Feedback & Calibration"], dependencies=[Depends(require_feature(FEATURE_PERFORMANCE))])


# =============================================
# HELPERS
# =============================================

def check_rh_admin_access(current_user: User):
    """Vérifie que l'utilisateur est RH ou Admin"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh']:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH et administrateurs")
    return user_role


def check_rh_admin_manager_access(current_user: User):
    """Vérifie que l'utilisateur est RH, Admin ou Manager"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh', 'manager']:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH, administrateurs et managers")
    return user_role


def get_employee_name(employee: Employee) -> str:
    return f"{employee.first_name} {employee.last_name}" if employee else None


# =============================================
# 360° CAMPAIGNS
# =============================================

@router.post("/campaigns", response_model=Campaign360Response)
async def create_360_campaign(
    data: Campaign360Create,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer une campagne d'évaluation 360°"""
    check_rh_admin_access(current_user)
    
    # Créer la campagne
    campaign = EvaluationCampaign(
        tenant_id=current_user.tenant_id,
        name=data.name,
        description=data.description,
        type='360',
        start_date=data.start_date,
        end_date=data.end_date,
        status='draft',
        template=data.template,
        is_360=True,
        peer_selection_mode=data.peer_selection_mode.value,
        min_peer_evaluators=data.min_peer_evaluators,
        max_peer_evaluators=data.max_peer_evaluators,
        include_self_evaluation=data.include_self_evaluation,
        include_manager_evaluation=data.include_manager_evaluation,
        include_peer_evaluation=data.include_peer_evaluation,
        include_direct_report_evaluation=data.include_direct_report_evaluation,
        created_by=current_user.employee_id
    )
    
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    
    # Récupérer les employés ciblés
    if data.employee_ids:
        employees = db.query(Employee).filter(
            Employee.id.in_(data.employee_ids),
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()
    elif data.department_ids:
        employees = db.query(Employee).filter(
            Employee.department_id.in_(data.department_ids),
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()
    else:
        employees = db.query(Employee).filter(
            Employee.tenant_id == current_user.tenant_id,
            Employee.status == 'active'
        ).all()
    
    # Créer les assignations de base (auto-évaluation + manager)
    for emp in employees:
        group_id = uuid.uuid4()
        
        # Auto-évaluation
        if data.include_self_evaluation:
            assignment = EvaluationAssignment(
                tenant_id=current_user.tenant_id,
                campaign_id=campaign.id,
                employee_id=emp.id,
                evaluator_id=emp.id,
                evaluator_type='self',
                status='pending'
            )
            db.add(assignment)
        
        # Évaluation manager
        if data.include_manager_evaluation and emp.manager_id:
            assignment = EvaluationAssignment(
                tenant_id=current_user.tenant_id,
                campaign_id=campaign.id,
                employee_id=emp.id,
                evaluator_id=emp.manager_id,
                evaluator_type='manager',
                status='pending'
            )
            db.add(assignment)
        
        # Évaluations par les subordonnés directs
        if data.include_direct_report_evaluation:
            direct_reports = db.query(Employee).filter(
                Employee.manager_id == emp.id,
                Employee.tenant_id == current_user.tenant_id,
                Employee.status == 'active'
            ).all()
            for dr in direct_reports:
                assignment = EvaluationAssignment(
                    tenant_id=current_user.tenant_id,
                    campaign_id=campaign.id,
                    employee_id=emp.id,
                    evaluator_id=dr.id,
                    evaluator_type='direct_report',
                    status='pending'
                )
                db.add(assignment)
    
    db.commit()
    
    # Compter les stats
    total_assignments = db.query(EvaluationAssignment).filter(
        EvaluationAssignment.campaign_id == campaign.id
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
        "is_360": campaign.is_360,
        "peer_selection_mode": campaign.peer_selection_mode,
        "min_peer_evaluators": campaign.min_peer_evaluators,
        "max_peer_evaluators": campaign.max_peer_evaluators,
        "include_self_evaluation": campaign.include_self_evaluation,
        "include_manager_evaluation": campaign.include_manager_evaluation,
        "include_peer_evaluation": campaign.include_peer_evaluation,
        "include_direct_report_evaluation": campaign.include_direct_report_evaluation,
        "total_employees": len(employees),
        "total_evaluations": total_assignments,
        "completed_evaluations": 0,
        "progress_percentage": 0,
        "pending_assignments": total_assignments,
        "completed_assignments": 0,
        "created_by": campaign.created_by,
        "created_by_name": None,
        "created_at": campaign.created_at
    }


# =============================================
# EVALUATION ASSIGNMENTS (qui évalue qui)
# =============================================

@router.get("/campaigns/{campaign_id}/assignments")
async def get_campaign_assignments(
    campaign_id: int,
    employee_id: Optional[int] = None,
    evaluator_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste des assignations d'évaluation pour une campagne"""
    check_rh_admin_manager_access(current_user)
    
    query = db.query(EvaluationAssignment).filter(
        EvaluationAssignment.campaign_id == campaign_id,
        EvaluationAssignment.tenant_id == current_user.tenant_id
    )
    
    if employee_id:
        query = query.filter(EvaluationAssignment.employee_id == employee_id)
    if evaluator_type:
        query = query.filter(EvaluationAssignment.evaluator_type == evaluator_type)
    if status:
        query = query.filter(EvaluationAssignment.status == status)
    
    total = query.count()
    assignments = query.offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for a in assignments:
        emp = db.query(Employee).filter(Employee.id == a.employee_id).first()
        evaluator = db.query(Employee).filter(Employee.id == a.evaluator_id).first()
        items.append({
            "id": a.id,
            "tenant_id": a.tenant_id,
            "campaign_id": a.campaign_id,
            "employee_id": a.employee_id,
            "employee_name": get_employee_name(emp),
            "evaluator_id": a.evaluator_id,
            "evaluator_name": get_employee_name(evaluator),
            "evaluator_type": a.evaluator_type,
            "status": a.status,
            "evaluation_id": a.evaluation_id,
            "assigned_at": a.assigned_at,
            "completed_at": a.completed_at
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.post("/campaigns/{campaign_id}/assignments/bulk")
async def bulk_create_assignments(
    campaign_id: int,
    data: BulkAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer plusieurs assignations en masse (pour les pairs)"""
    check_rh_admin_access(current_user)
    
    campaign = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.id == campaign_id,
        EvaluationCampaign.tenant_id == current_user.tenant_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")
    
    created = 0
    skipped = 0
    
    for item in data.assignments:
        # Vérifier si l'assignation existe déjà
        existing = db.query(EvaluationAssignment).filter(
            EvaluationAssignment.campaign_id == campaign_id,
            EvaluationAssignment.employee_id == item['employee_id'],
            EvaluationAssignment.evaluator_id == item['evaluator_id']
        ).first()
        
        if existing:
            skipped += 1
            continue
        
        assignment = EvaluationAssignment(
            tenant_id=current_user.tenant_id,
            campaign_id=campaign_id,
            employee_id=item['employee_id'],
            evaluator_id=item['evaluator_id'],
            evaluator_type=item.get('evaluator_type', 'peer'),
            status='pending'
        )
        db.add(assignment)
        created += 1
    
    db.commit()
    
    return {
        "message": f"{created} assignations créées, {skipped} ignorées (déjà existantes)",
        "created": created,
        "skipped": skipped
    }


@router.delete("/assignments/{assignment_id}")
async def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Supprimer une assignation"""
    check_rh_admin_access(current_user)
    
    assignment = db.query(EvaluationAssignment).filter(
        EvaluationAssignment.id == assignment_id,
        EvaluationAssignment.tenant_id == current_user.tenant_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignation non trouvée")
    
    if assignment.status == 'completed':
        raise HTTPException(status_code=400, detail="Impossible de supprimer une assignation complétée")
    
    db.delete(assignment)
    db.commit()
    
    return {"message": "Assignation supprimée"}


# =============================================
# 360° SUMMARY (vue consolidée par employé)
# =============================================

@router.get("/campaigns/{campaign_id}/summary", response_model=Evaluation360ListResponse)
async def get_360_summary(
    campaign_id: int,
    department_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Résumé 360° par employé pour une campagne"""
    check_rh_admin_manager_access(current_user)
    
    # Récupérer tous les employés évalués dans cette campagne
    subquery = db.query(EvaluationAssignment.employee_id).filter(
        EvaluationAssignment.campaign_id == campaign_id
    ).distinct().subquery()
    
    query = db.query(Employee).filter(
        Employee.id.in_(subquery),
        Employee.tenant_id == current_user.tenant_id
    )
    
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    
    total = query.count()
    employees = query.offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for emp in employees:
        # Récupérer toutes les évaluations de cet employé pour cette campagne
        evaluations = db.query(Evaluation).filter(
            Evaluation.campaign_id == campaign_id,
            Evaluation.employee_id == emp.id
        ).all()
        
        # Calculer les scores par type
        self_score = None
        manager_score = None
        peer_scores = []
        dr_scores = []
        
        for ev in evaluations:
            if ev.overall_score:
                if ev.type == 'self':
                    self_score = float(ev.overall_score)
                elif ev.type == 'manager':
                    manager_score = float(ev.overall_score)
                elif ev.type == 'peer':
                    peer_scores.append(float(ev.overall_score))
                elif ev.type == 'direct_report':
                    dr_scores.append(float(ev.overall_score))
        
        peer_avg = sum(peer_scores) / len(peer_scores) if peer_scores else None
        dr_avg = sum(dr_scores) / len(dr_scores) if dr_scores else None
        
        # Score moyen global
        all_scores = [s for s in [self_score, manager_score, peer_avg, dr_avg] if s is not None]
        avg_score = sum(all_scores) / len(all_scores) if all_scores else None
        
        # Score calibré (si existe)
        calibrated = next((ev.calibrated_score for ev in evaluations if ev.is_calibrated), None)
        
        # Status global
        statuses = [ev.status for ev in evaluations]
        if all(s == 'validated' for s in statuses):
            overall_status = 'validated'
        elif all(s in ['submitted', 'validated'] for s in statuses):
            overall_status = 'submitted'
        elif any(s != 'pending' for s in statuses):
            overall_status = 'in_progress'
        else:
            overall_status = 'pending'
        
        items.append(Evaluation360Summary(
            employee_id=emp.id,
            employee_name=get_employee_name(emp),
            department_name=emp.department.name if emp.department else None,
            job_title=emp.job_title,
            campaign_id=campaign_id,
            self_score=self_score,
            manager_score=manager_score,
            peer_avg_score=peer_avg,
            direct_report_avg_score=dr_avg,
            average_score=avg_score,
            calibrated_score=float(calibrated) if calibrated else None,
            peer_count=len(peer_scores),
            direct_report_count=len(dr_scores),
            completed_count=len([s for s in statuses if s in ['submitted', 'validated']]),
            total_evaluations=len(evaluations),
            overall_status=overall_status
        ))
    
    return Evaluation360ListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


# =============================================
# CALIBRATION SESSIONS
# =============================================

@router.get("/calibration/sessions", response_model=CalibrationSessionListResponse)
async def get_calibration_sessions(
    campaign_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste des sessions de calibration"""
    check_rh_admin_manager_access(current_user)
    
    query = db.query(CalibrationSession).filter(
        CalibrationSession.tenant_id == current_user.tenant_id
    )
    
    if campaign_id:
        query = query.filter(CalibrationSession.campaign_id == campaign_id)
    if status:
        query = query.filter(CalibrationSession.status == status)
    
    total = query.count()
    sessions = query.order_by(desc(CalibrationSession.scheduled_date))\
                    .offset((page - 1) * page_size)\
                    .limit(page_size).all()
    
    items = []
    for s in sessions:
        facilitator = db.query(Employee).filter(Employee.id == s.facilitator_id).first() if s.facilitator_id else None
        dept = s.department
        
        participants_count = db.query(CalibrationParticipant).filter(
            CalibrationParticipant.session_id == s.id
        ).count()
        
        adjustments_count = db.query(CalibrationScoreAdjustment).filter(
            CalibrationScoreAdjustment.session_id == s.id
        ).count()
        
        items.append(CalibrationSessionResponse(
            id=s.id,
            tenant_id=s.tenant_id,
            campaign_id=s.campaign_id,
            name=s.name,
            description=s.description,
            department_id=s.department_id,
            department_name=dept.name if dept else None,
            scheduled_date=s.scheduled_date,
            duration_minutes=s.duration_minutes,
            location=s.location,
            status=s.status,
            notes=s.notes,
            decisions=s.decisions,
            facilitator_id=s.facilitator_id,
            facilitator_name=get_employee_name(facilitator),
            participants_count=participants_count,
            adjustments_made=adjustments_count,
            started_at=s.started_at,
            completed_at=s.completed_at,
            created_at=s.created_at
        ))
    
    return CalibrationSessionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.post("/calibration/sessions", response_model=CalibrationSessionResponse)
async def create_calibration_session(
    data: CalibrationSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer une session de calibration"""
    check_rh_admin_access(current_user)
    
    # Vérifier que la campagne existe
    campaign = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.id == data.campaign_id,
        EvaluationCampaign.tenant_id == current_user.tenant_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")
    
    session = CalibrationSession(
        tenant_id=current_user.tenant_id,
        campaign_id=data.campaign_id,
        name=data.name,
        description=data.description,
        department_id=data.department_id,
        scheduled_date=data.scheduled_date,
        duration_minutes=data.duration_minutes,
        location=data.location,
        status='scheduled',
        facilitator_id=current_user.employee_id
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Ajouter les participants
    for emp_id in data.participant_ids:
        participant = CalibrationParticipant(
            session_id=session.id,
            employee_id=emp_id,
            role='participant'
        )
        db.add(participant)
    
    # Ajouter le facilitateur comme participant
    if current_user.employee_id and current_user.employee_id not in data.participant_ids:
        facilitator_part = CalibrationParticipant(
            session_id=session.id,
            employee_id=current_user.employee_id,
            role='facilitator'
        )
        db.add(facilitator_part)
    
    db.commit()
    
    return CalibrationSessionResponse(
        id=session.id,
        tenant_id=session.tenant_id,
        campaign_id=session.campaign_id,
        name=session.name,
        description=session.description,
        department_id=session.department_id,
        scheduled_date=session.scheduled_date,
        duration_minutes=session.duration_minutes,
        location=session.location,
        status=session.status,
        facilitator_id=session.facilitator_id,
        participants_count=len(data.participant_ids) + 1,
        created_at=session.created_at
    )


@router.get("/calibration/sessions/{session_id}/comparison", response_model=CalibrationComparisonResponse)
async def get_calibration_comparison(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Vue de comparaison pour la calibration"""
    check_rh_admin_manager_access(current_user)
    
    session = db.query(CalibrationSession).filter(
        CalibrationSession.id == session_id,
        CalibrationSession.tenant_id == current_user.tenant_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    campaign = db.query(EvaluationCampaign).filter(
        EvaluationCampaign.id == session.campaign_id
    ).first()
    
    # Récupérer les évaluations à comparer
    query = db.query(Evaluation).filter(
        Evaluation.campaign_id == session.campaign_id,
        Evaluation.tenant_id == current_user.tenant_id
    )
    
    if session.department_id:
        query = query.join(Employee, Evaluation.employee_id == Employee.id)\
                     .filter(Employee.department_id == session.department_id)
    
    evaluations = query.all()
    
    # Grouper par employé
    employee_evals = {}
    for ev in evaluations:
        if ev.employee_id not in employee_evals:
            employee_evals[ev.employee_id] = {'self': None, 'manager': None, 'peers': []}
        
        if ev.type == 'self':
            employee_evals[ev.employee_id]['self'] = ev
        elif ev.type == 'manager':
            employee_evals[ev.employee_id]['manager'] = ev
        elif ev.type == 'peer':
            employee_evals[ev.employee_id]['peers'].append(ev)
    
    items = []
    total_before = []
    total_after = []
    needs_review_count = 0
    calibrated_count = 0
    
    for emp_id, evals in employee_evals.items():
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        
        self_score = float(evals['self'].overall_score) if evals['self'] and evals['self'].overall_score else None
        manager_score = float(evals['manager'].overall_score) if evals['manager'] and evals['manager'].overall_score else None
        
        peer_scores = [float(p.overall_score) for p in evals['peers'] if p.overall_score]
        peer_avg = sum(peer_scores) / len(peer_scores) if peer_scores else None
        
        # Calculer l'écart self vs manager
        gap = abs(self_score - manager_score) if self_score and manager_score else None
        needs_review = gap is not None and gap > 1.0
        
        if needs_review:
            needs_review_count += 1
        
        # Score global (utiliser manager si disponible, sinon self)
        overall = manager_score or self_score
        calibrated = None
        is_calibrated = False
        
        # Vérifier si déjà calibré
        if evals['manager'] and evals['manager'].is_calibrated:
            calibrated = float(evals['manager'].calibrated_score) if evals['manager'].calibrated_score else None
            is_calibrated = True
            calibrated_count += 1
        
        if overall:
            total_before.append(overall)
        if calibrated:
            total_after.append(calibrated)
        
        items.append(CalibrationComparisonItem(
            evaluation_id=evals['manager'].id if evals['manager'] else (evals['self'].id if evals['self'] else 0),
            employee_id=emp_id,
            employee_name=get_employee_name(emp),
            job_title=emp.job_title if emp else None,
            department_name=emp.department.name if emp and emp.department else None,
            self_score=self_score,
            manager_score=manager_score,
            peer_avg_score=peer_avg,
            overall_score=overall,
            calibrated_score=calibrated,
            self_manager_gap=gap,
            is_calibrated=is_calibrated,
            status=evals['manager'].status if evals['manager'] else 'pending',
            needs_review=needs_review
        ))
    
    # Trier par écart décroissant (les plus gros écarts en premier)
    items.sort(key=lambda x: x.self_manager_gap or 0, reverse=True)
    
    return CalibrationComparisonResponse(
        session_id=session_id,
        campaign_id=session.campaign_id,
        campaign_name=campaign.name if campaign else None,
        department_name=session.department.name if session.department else None,
        items=items,
        total_employees=len(items),
        calibrated_count=calibrated_count,
        needs_review_count=needs_review_count,
        avg_score_before=sum(total_before) / len(total_before) if total_before else None,
        avg_score_after=sum(total_after) / len(total_after) if total_after else None
    )


# =============================================
# SCORE ADJUSTMENTS
# =============================================

@router.post("/calibration/sessions/{session_id}/adjustments")
async def create_score_adjustment(
    session_id: int,
    data: ScoreAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Proposer un ajustement de score lors de la calibration"""
    check_rh_admin_manager_access(current_user)
    
    session = db.query(CalibrationSession).filter(
        CalibrationSession.id == session_id,
        CalibrationSession.tenant_id == current_user.tenant_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    if session.status == 'completed':
        raise HTTPException(status_code=400, detail="Cette session est déjà terminée")
    
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == data.evaluation_id,
        Evaluation.tenant_id == current_user.tenant_id
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation non trouvée")
    
    original_score = float(evaluation.overall_score) if evaluation.overall_score else 0
    
    # Créer l'ajustement
    adjustment = CalibrationScoreAdjustment(
        session_id=session_id,
        evaluation_id=data.evaluation_id,
        original_score=original_score,
        calibrated_score=data.calibrated_score,
        reason=data.reason,
        proposed_by=current_user.employee_id,
        approved=True,  # Auto-approuvé pour l'instant
        approved_by=current_user.employee_id
    )
    
    db.add(adjustment)
    
    # Mettre à jour l'évaluation
    evaluation.calibrated_score = data.calibrated_score
    evaluation.is_calibrated = True
    evaluation.calibration_session_id = session_id
    
    db.commit()
    
    return {
        "message": "Ajustement enregistré",
        "adjustment_id": adjustment.id,
        "original_score": original_score,
        "calibrated_score": data.calibrated_score
    }


@router.post("/calibration/sessions/{session_id}/complete")
async def complete_calibration_session(
    session_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Terminer une session de calibration"""
    check_rh_admin_access(current_user)
    
    session = db.query(CalibrationSession).filter(
        CalibrationSession.id == session_id,
        CalibrationSession.tenant_id == current_user.tenant_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    session.status = 'completed'
    session.completed_at = datetime.utcnow()
    if notes:
        session.notes = notes
    
    # Récupérer les décisions prises
    adjustments = db.query(CalibrationScoreAdjustment).filter(
        CalibrationScoreAdjustment.session_id == session_id
    ).all()
    
    decisions = []
    for adj in adjustments:
        emp = db.query(Employee).join(Evaluation, Evaluation.employee_id == Employee.id)\
                .filter(Evaluation.id == adj.evaluation_id).first()
        decisions.append({
            "employee_id": emp.id if emp else None,
            "employee_name": get_employee_name(emp),
            "original_score": float(adj.original_score),
            "calibrated_score": float(adj.calibrated_score),
            "reason": adj.reason
        })
    
    session.decisions = decisions
    
    db.commit()
    
    return {
        "message": "Session de calibration terminée",
        "adjustments_made": len(adjustments)
    }
