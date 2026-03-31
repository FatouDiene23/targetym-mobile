# ============================================
# app/api/recruitment.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text
from typing import Optional
from datetime import datetime, timedelta
import math
import logging
import secrets
import string

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import hash_password
from app.api.deps import get_current_user, get_current_tenant
from app.models import Employee, Department, EmployeeStatus
from app.models.employee import EmployeeRole as EmployeeRoleEnum
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.recruitment import (
    JobPosting, Candidate, CandidateApplication, Interview, CandidateTimeline
)
from app.schemas.recruitment import (
    JobPostingCreate, JobPostingUpdate, JobPostingResponse, JobPostingList,
    CandidateCreate, CandidateUpdate, CandidateResponse, CandidateList,
    ApplicationCreate, ApplicationResponse, ApplicationList,
    ApplicationStageUpdate, TimelineEventResponse,
    InterviewCreate, InterviewUpdate, InterviewResponse, InterviewList,
    RecruitmentStats, RecruitmentAnalytics, PipelineStats, SourceStats,
    HiringTrend, DepartmentStats, TopCandidate, AIScoreDetail,
    SendOfferRequest, OfferResponseRequest
)


router = APIRouter(prefix="/api/recruitment", tags=["Recruitment"])

# ============================================
# HELPERS
# ============================================

def _add_to_onboarding_queue(db: Session, app, tenant_id: int):
    """Ajoute un candidat embauché dans la queue d'onboarding et notifie les RH."""
    print(f"[ONBOARDING_QUEUE] Démarrage pour application_id={app.id}, tenant_id={tenant_id}")

    # 1. Insérer dans la queue
    try:
        db.execute(text("""
            INSERT INTO onboarding_queue (tenant_id, application_id, candidate_id, job_posting_id, status, hired_at)
            VALUES (:tid, :app_id, :cid, :jid, 'pending', NOW())
            ON CONFLICT (application_id) DO NOTHING
        """), {"tid": tenant_id, "app_id": app.id, "cid": app.candidate_id, "jid": app.job_posting_id})
        db.commit()
        print(f"[ONBOARDING_QUEUE] ✅ Queue INSERT OK pour application_id={app.id}")
    except Exception as e:
        print(f"[ONBOARDING_QUEUE] ❌ Queue INSERT failed: {e}")
        logger.error(f"Onboarding queue INSERT failed: {e}")
        db.rollback()
        return

    # 2. Récupérer nom candidat + poste via SQL explicite (ORM expiré après commit)
    try:
        row = db.execute(text("""
            SELECT c.first_name || ' ' || c.last_name, jp.title
            FROM candidate_applications ca
            JOIN candidates c ON c.id = ca.candidate_id
            JOIN job_postings jp ON jp.id = ca.job_posting_id
            WHERE ca.id = :app_id
        """), {"app_id": app.id}).fetchone()
        candidate_name = row[0] if row else "Nouveau candidat"
        job_title = row[1] if row else "Poste"
        print(f"[ONBOARDING_QUEUE] Candidat: {candidate_name} | Poste: {job_title}")
    except Exception as e:
        print(f"[ONBOARDING_QUEUE] ❌ Récupération candidat/poste failed: {e}")
        candidate_name, job_title = "Nouveau candidat", "Poste"

    # 3. Récupérer les utilisateurs RH/Admin via ORM (même logique que la query email)
    try:
        rh_users = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.role.in_([UserRole.RH, UserRole.ADMIN, UserRole.SUPER_ADMIN]),
            User.is_active == True
        ).all()
        print(f"[ONBOARDING_QUEUE] {len(rh_users)} RH/Admin trouvés pour notifications: {[u.id for u in rh_users]}")
    except Exception as e:
        print(f"[ONBOARDING_QUEUE] ❌ Récupération RH users failed: {e}")
        logger.error(f"RH users query failed: {e}")
        db.rollback()
        return

    # 4. Créer une notification par utilisateur RH
    for rh_user in rh_users:
        try:
            db.execute(text("""
                INSERT INTO notifications (
                    tenant_id, user_id, employee_id, title, message,
                    type, priority, reference_type, action_url, is_read
                ) VALUES (
                    :tid, :uid, :eid, :title, :msg,
                    'onboarding_task', 'high', 'onboarding_queue', '/dashboard/onboarding', false
                )
            """), {
                "tid": tenant_id,
                "uid": rh_user.id,
                "eid": rh_user.employee_id,
                "title": "Nouveau collaborateur à onboarder",
                "msg": f"{candidate_name} — {job_title} est prêt(e) à être onboardé(e)."
            })
            db.commit()
            print(f"[ONBOARDING_QUEUE] ✅ Notification créée pour user_id={rh_user.id}")
        except Exception as e:
            print(f"[ONBOARDING_QUEUE] ❌ Notification user_id={rh_user.id} failed: {e}")
            logger.error(f"Notification user {rh_user.id} failed: {e}")
            db.rollback()

    # 5. Email aux RH (non bloquant)
    try:
        db.rollback()  # Assure qu'aucune transaction avortée ne bloque la query suivante
        from app.services.email_service import _send, _wrap_email, _email_header, _email_footer
        rh_email_rows = db.query(Employee.email).join(
            User, User.employee_id == Employee.id
        ).filter(
            User.tenant_id == tenant_id,
            User.role.in_([UserRole.RH, UserRole.ADMIN, UserRole.SUPER_ADMIN]),
            User.is_active == True,
            Employee.email.isnot(None)
        ).all()
        for (email,) in rh_email_rows:
            body = (
                f"<p>Bonjour,</p>"
                f"<p>Le candidat <strong>{candidate_name}</strong> vient d'être embauché(e) "
                f"pour le poste <strong>{job_title}</strong>.</p>"
                f"<p>Pensez à démarrer son programme d'onboarding depuis la plateforme.</p>"
                f'<p><a href="https://app.targetym.com/dashboard/onboarding" '
                f'style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;'
                f'text-decoration:none;display:inline-block;margin-top:8px;">Voir l\'onboarding</a></p>'
            )
            _send(
                email,
                f"Nouveau collaborateur à onboarder : {candidate_name}",
                _wrap_email(_email_header("Nouvel embauché à onboarder") + body + _email_footer())
            )
        print(f"[ONBOARDING_QUEUE] ✅ Emails envoyés à {len(rh_email_rows)} RH")
    except Exception as e:
        print(f"[ONBOARDING_QUEUE] ⚠️ Email failed (non bloquant): {e}")
        logger.warning(f"Email RH onboarding queue: {e}")


def add_timeline_event(db: Session, application_id: int, event_type: str, event_title: str,
                       event_description: str = None, performed_by_id: int = None, tenant_id: int = 1):
    event = CandidateTimeline(
        application_id=application_id,
        event_type=event_type,
        event_title=event_title,
        event_description=event_description,
        performed_by_id=performed_by_id,
        tenant_id=tenant_id
    )
    db.add(event)
    db.commit()
    return event

STAGE_LABELS = {
    "new": "Candidatures", "screening": "Screening CV", "phone_screen": "Entretien Tél.",
    "hr_interview": "Entretien RH", "technical": "Entretien Tech", "final": "Entretien Final",
    "offer": "Offre", "hired": "Embauché", "rejected": "Refusé", "withdrawn": "Désisté"
}

STAGE_COLORS = {
    "new": "#6B7280", "screening": "#3B82F6", "phone_screen": "#8B5CF6",
    "hr_interview": "#A855F7", "technical": "#F97316", "final": "#EAB308",
    "offer": "#22C55E", "hired": "#059669", "rejected": "#EF4444", "withdrawn": "#9CA3AF"
}

SOURCE_COLORS = {
    "LinkedIn": "#0A66C2", "Indeed": "#2164F3", "Site Carrière": "#6366F1",
    "Référence interne": "#10B981", "Cabinet": "#F59E0B", "Autre": "#6B7280"
}

# ============================================
# JOB POSTINGS
# ============================================

@router.get("/jobs", response_model=JobPostingList)
def list_jobs(
    status: Optional[str] = None,
    department_id: Optional[int] = None,
    urgency: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    query = db.query(JobPosting).filter(JobPosting.tenant_id == tenant.id)
    
    if status:
        query = query.filter(JobPosting.status == status)
    if department_id:
        query = query.filter(JobPosting.department_id == department_id)
    if urgency:
        query = query.filter(JobPosting.urgency == urgency)
    if search:
        query = query.filter(or_(JobPosting.title.ilike(f"%{search}%"), JobPosting.location.ilike(f"%{search}%")))
    
    total = query.count()
    pages = math.ceil(total / page_size) if total > 0 else 1
    jobs = query.order_by(JobPosting.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for job in jobs:
        applicants_count = db.query(CandidateApplication).filter(
            CandidateApplication.job_posting_id == job.id,
            CandidateApplication.tenant_id == tenant.id,
            CandidateApplication.stage.notin_(["rejected", "withdrawn"])
        ).count()
        
        items.append(JobPostingResponse(
            id=job.id, title=job.title, department_id=job.department_id, location=job.location,
            remote_policy=job.remote_policy, contract_type=job.contract_type, description=job.description,
            responsibilities=job.responsibilities, requirements=job.requirements, nice_to_have=job.nice_to_have,
            benefits=job.benefits, salary_min=float(job.salary_min) if job.salary_min else None,
            salary_max=float(job.salary_max) if job.salary_max else None, salary_currency=job.salary_currency,
            show_salary=job.show_salary, visibility=getattr(job, 'visibility', 'internal') or 'internal',
            status=job.status, urgency=job.urgency,
            hiring_manager_id=job.hiring_manager_id, recruiter_id=job.recruiter_id, deadline=job.deadline,
            posted_at=job.posted_at, created_at=job.created_at, updated_at=job.updated_at, tenant_id=job.tenant_id,
            department_name=job.department.name if job.department else None,
            hiring_manager_name=f"{job.hiring_manager.first_name} {job.hiring_manager.last_name}" if job.hiring_manager else None,
            recruiter_name=f"{job.recruiter.first_name} {job.recruiter.last_name}" if job.recruiter else None,
            applicants_count=applicants_count
        ))
    
    return JobPostingList(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("/jobs", response_model=JobPostingResponse)
def create_job(
    data: JobPostingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    job = JobPosting(**data.model_dump(), status="draft", tenant_id=tenant.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    
    return JobPostingResponse(
        id=job.id, title=job.title, department_id=job.department_id, location=job.location,
        remote_policy=job.remote_policy, contract_type=job.contract_type, description=job.description,
        responsibilities=job.responsibilities, requirements=job.requirements, nice_to_have=job.nice_to_have,
        benefits=job.benefits, salary_min=float(job.salary_min) if job.salary_min else None,
        salary_max=float(job.salary_max) if job.salary_max else None, salary_currency=job.salary_currency,
        show_salary=job.show_salary, visibility=getattr(job, 'visibility', 'internal') or 'internal',
        status=job.status, urgency=job.urgency,
        hiring_manager_id=job.hiring_manager_id, recruiter_id=job.recruiter_id, deadline=job.deadline,
        posted_at=job.posted_at, created_at=job.created_at, updated_at=job.updated_at, tenant_id=job.tenant_id,
        applicants_count=0
    )


@router.get("/jobs/{job_id}", response_model=JobPostingResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    applicants_count = db.query(CandidateApplication).filter(
        CandidateApplication.job_posting_id == job.id,
        CandidateApplication.tenant_id == tenant.id
    ).count()

    return JobPostingResponse(
        id=job.id, title=job.title, department_id=job.department_id, location=job.location,
        remote_policy=job.remote_policy, contract_type=job.contract_type, description=job.description,
        responsibilities=job.responsibilities, requirements=job.requirements, nice_to_have=job.nice_to_have,
        benefits=job.benefits, salary_min=float(job.salary_min) if job.salary_min else None,
        salary_max=float(job.salary_max) if job.salary_max else None, salary_currency=job.salary_currency,
        show_salary=job.show_salary, visibility=getattr(job, 'visibility', 'internal') or 'internal',
        status=job.status, urgency=job.urgency,
        hiring_manager_id=job.hiring_manager_id, recruiter_id=job.recruiter_id, deadline=job.deadline,
        posted_at=job.posted_at, created_at=job.created_at, updated_at=job.updated_at, tenant_id=job.tenant_id,
        department_name=job.department.name if job.department else None,
        hiring_manager_name=f"{job.hiring_manager.first_name} {job.hiring_manager.last_name}" if job.hiring_manager else None,
        applicants_count=applicants_count
    )


@router.put("/jobs/{job_id}", response_model=JobPostingResponse)
def update_job(
    job_id: int,
    data: JobPostingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("status") == "active" and not job.posted_at:
        update_data["posted_at"] = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(job, field, value)
    
    db.commit()
    db.refresh(job)
    return get_job(job_id, db, current_user, tenant)


@router.delete("/jobs/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    apps_count = db.query(CandidateApplication).filter(
        CandidateApplication.job_posting_id == job_id,
        CandidateApplication.tenant_id == tenant.id
    ).count()
    if apps_count > 0:
        raise HTTPException(status_code=400, detail="Impossible de supprimer une offre avec des candidatures")
    
    db.delete(job)
    db.commit()
    return {"message": "Offre supprimée"}


@router.post("/jobs/{job_id}/publish", response_model=JobPostingResponse)
def publish_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    job.status = "active"
    job.posted_at = datetime.utcnow()
    db.commit()

    job_visibility = getattr(job, 'visibility', 'internal') or 'internal'
    try:
        if job_visibility == 'internal_external' and tenant.intowork_company_id and tenant.intowork_api_key:
            from app.services.intowork_service import sync_job_to_intowork
            sync_job_to_intowork(
                intowork_company_id=tenant.intowork_company_id,
                intowork_api_key=tenant.intowork_api_key,
                targetym_tenant_id=tenant.id,
                job_posting_id=job.id,
                title=job.title,
                description=job.description,
                location=job.location,
                contract_type=job.contract_type,
                salary_min=float(job.salary_min) if job.salary_min else None,
                salary_max=float(job.salary_max) if job.salary_max else None,
                salary_currency=job.salary_currency or "XOF",
                remote_policy=job.remote_policy,
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Erreur flux IntoWork (publish job) : {e}")

    return get_job(job_id, db, current_user, tenant)


@router.post("/jobs/{job_id}/close", response_model=JobPostingResponse)
def close_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    job.status = "closed"
    db.commit()
    return get_job(job_id, db, current_user, tenant)

# ============================================
# CANDIDATES
# ============================================

@router.get("/candidates", response_model=CandidateList)
def list_candidates(
    search: Optional[str] = None,
    source: Optional[str] = None,
    min_score: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    query = db.query(Candidate).filter(Candidate.tenant_id == tenant.id)
    
    if search:
        query = query.filter(or_(
            Candidate.first_name.ilike(f"%{search}%"),
            Candidate.last_name.ilike(f"%{search}%"),
            Candidate.email.ilike(f"%{search}%")
        ))
    if source:
        query = query.filter(Candidate.source == source)
    if min_score:
        query = query.filter(Candidate.ai_score >= min_score)
    
    total = query.count()
    pages = math.ceil(total / page_size) if total > 0 else 1
    candidates = query.order_by(Candidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for c in candidates:
        items.append(CandidateResponse(
            id=c.id, first_name=c.first_name, last_name=c.last_name, email=c.email, phone=c.phone,
            location=c.location, linkedin_url=c.linkedin_url, portfolio_url=c.portfolio_url,
            current_company=c.current_company, current_position=c.current_position,
            experience_years=c.experience_years, education=c.education, skills=c.skills,
            languages=c.languages, expected_salary=float(c.expected_salary) if c.expected_salary else None,
            salary_currency=c.salary_currency, notice_period=c.notice_period, available_from=c.available_from,
            source=c.source, source_details=c.source_details, referrer_employee_id=c.referrer_employee_id,
            cover_letter=c.cover_letter, notes=c.notes, tags=c.tags, cv_filename=c.cv_filename,
            cv_url=c.cv_url, ai_score=c.ai_score,
            ai_score_details=[AIScoreDetail(**d) for d in c.ai_score_details] if c.ai_score_details else None,
            ai_analysis=c.ai_analysis, created_at=c.created_at, updated_at=c.updated_at, tenant_id=c.tenant_id,
            full_name=f"{c.first_name} {c.last_name}"
        ))
    
    return CandidateList(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("/candidates", response_model=CandidateResponse)
def create_candidate(
    data: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    existing = db.query(Candidate).filter(Candidate.email == data.email, Candidate.tenant_id == tenant.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Un candidat avec cet email existe déjà")
    
    job_posting_id = data.job_posting_id
    candidate_data = data.model_dump(exclude={"job_posting_id"})
    
    candidate = Candidate(**candidate_data, tenant_id=tenant.id)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    if job_posting_id:
        application = CandidateApplication(
            candidate_id=candidate.id, job_posting_id=job_posting_id, stage="new", tenant_id=tenant.id
        )
        db.add(application)
        db.commit()
        add_timeline_event(db, application.id, "applied", "Candidature reçue", tenant_id=tenant.id)
    
    return CandidateResponse(
        id=candidate.id, first_name=candidate.first_name, last_name=candidate.last_name, email=candidate.email,
        phone=candidate.phone, location=candidate.location, linkedin_url=candidate.linkedin_url,
        portfolio_url=candidate.portfolio_url, current_company=candidate.current_company,
        current_position=candidate.current_position, experience_years=candidate.experience_years,
        education=candidate.education, skills=candidate.skills, languages=candidate.languages,
        expected_salary=float(candidate.expected_salary) if candidate.expected_salary else None,
        salary_currency=candidate.salary_currency, notice_period=candidate.notice_period,
        available_from=candidate.available_from, source=candidate.source, source_details=candidate.source_details,
        referrer_employee_id=candidate.referrer_employee_id, cover_letter=candidate.cover_letter,
        notes=candidate.notes, tags=candidate.tags, cv_filename=candidate.cv_filename, cv_url=candidate.cv_url,
        ai_score=candidate.ai_score, ai_score_details=None, ai_analysis=candidate.ai_analysis,
        created_at=candidate.created_at, updated_at=candidate.updated_at, tenant_id=candidate.tenant_id,
        full_name=f"{candidate.first_name} {candidate.last_name}"
    )


@router.get("/candidates/{candidate_id}", response_model=CandidateResponse)
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant.id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    return CandidateResponse(
        id=candidate.id, first_name=candidate.first_name, last_name=candidate.last_name, email=candidate.email,
        phone=candidate.phone, location=candidate.location, linkedin_url=candidate.linkedin_url,
        portfolio_url=candidate.portfolio_url, current_company=candidate.current_company,
        current_position=candidate.current_position, experience_years=candidate.experience_years,
        education=candidate.education, skills=candidate.skills, languages=candidate.languages,
        expected_salary=float(candidate.expected_salary) if candidate.expected_salary else None,
        salary_currency=candidate.salary_currency, notice_period=candidate.notice_period,
        available_from=candidate.available_from, source=candidate.source, source_details=candidate.source_details,
        referrer_employee_id=candidate.referrer_employee_id, cover_letter=candidate.cover_letter,
        notes=candidate.notes, tags=candidate.tags, cv_filename=candidate.cv_filename, cv_url=candidate.cv_url,
        ai_score=candidate.ai_score,
        ai_score_details=[AIScoreDetail(**d) for d in candidate.ai_score_details] if candidate.ai_score_details else None,
        ai_analysis=candidate.ai_analysis, created_at=candidate.created_at, updated_at=candidate.updated_at,
        tenant_id=candidate.tenant_id, full_name=f"{candidate.first_name} {candidate.last_name}"
    )


@router.put("/candidates/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: int,
    data: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant.id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    
    db.commit()
    db.refresh(candidate)
    return get_candidate(candidate_id, db, current_user, tenant)


@router.delete("/candidates/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant.id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    db.query(CandidateTimeline).filter(
        CandidateTimeline.application_id.in_(db.query(CandidateApplication.id).filter(CandidateApplication.candidate_id == candidate_id))
    ).delete(synchronize_session=False)
    db.query(Interview).filter(
        Interview.application_id.in_(db.query(CandidateApplication.id).filter(CandidateApplication.candidate_id == candidate_id))
    ).delete(synchronize_session=False)
    db.query(CandidateApplication).filter(CandidateApplication.candidate_id == candidate_id).delete()
    db.delete(candidate)
    db.commit()
    return {"message": "Candidat supprimé"}


@router.post("/candidates/{candidate_id}/cv")
def upload_candidate_cv(
    candidate_id: int,
    cv: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """Upload or replace the CV for a recruitment candidate"""
    import os, re, uuid
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant.id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")

    allowed_exts = {'.pdf', '.doc', '.docx'}
    filename = cv.filename or "cv"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Formats acceptés: PDF, DOC, DOCX")

    content = cv.file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop grand (max 10 MB)")

    cv_dir = os.path.abspath("uploads/recruitment/cvs")
    os.makedirs(cv_dir, exist_ok=True)
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.basename(filename))
    unique_name = f"{tenant.id}_{candidate_id}_{uuid.uuid4().hex}{ext}"
    cv_path = os.path.join(cv_dir, unique_name)

    with open(cv_path, "wb") as f:
        f.write(content)

    candidate.cv_filename = safe_name
    candidate.cv_url = cv_path
    db.commit()
    return {"message": "CV uploadé", "cv_filename": safe_name}


@router.get("/candidates/{candidate_id}/cv")
def download_candidate_cv(
    candidate_id: int,
    download: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """Stream the CV file for a recruitment candidate"""
    import os, mimetypes
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant.id).first()
    if not candidate or not candidate.cv_url:
        raise HTTPException(status_code=404, detail="CV non trouvé")

    cv_path = candidate.cv_url
    if not os.path.exists(cv_path):
        raise HTTPException(status_code=404, detail="Fichier CV introuvable sur le serveur")

    media_type, _ = mimetypes.guess_type(cv_path)
    media_type = media_type or "application/octet-stream"
    filename = candidate.cv_filename or os.path.basename(cv_path)
    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=cv_path,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'}
    )


# ============================================
# APPLICATIONS (Pipeline)
# ============================================

@router.get("/applications", response_model=ApplicationList)
def list_applications(
    job_posting_id: Optional[int] = None,
    stage: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    query = db.query(CandidateApplication).filter(CandidateApplication.tenant_id == tenant.id)
    
    if job_posting_id:
        query = query.filter(CandidateApplication.job_posting_id == job_posting_id)
    if stage:
        query = query.filter(CandidateApplication.stage == stage)
    if search:
        query = query.join(Candidate).filter(or_(
            Candidate.first_name.ilike(f"%{search}%"),
            Candidate.last_name.ilike(f"%{search}%"),
            Candidate.email.ilike(f"%{search}%")
        ))
    
    total = query.count()
    pages = math.ceil(total / page_size) if total > 0 else 1
    applications = query.order_by(CandidateApplication.applied_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for app in applications:
        candidate = app.candidate
        job = app.job_posting
        
        timeline = db.query(CandidateTimeline).filter(CandidateTimeline.application_id == app.id).order_by(CandidateTimeline.created_at.desc()).all()
        timeline_items = []
        for t in timeline:
            performer_name = None
            if t.performed_by_id:
                performer = db.query(Employee).filter(Employee.id == t.performed_by_id).first()
                if performer:
                    performer_name = f"{performer.first_name} {performer.last_name}"
            timeline_items.append(TimelineEventResponse(
                id=t.id, event_type=t.event_type, event_title=t.event_title,
                event_description=t.event_description, performed_by_name=performer_name, created_at=t.created_at
            ))
        
        items.append(ApplicationResponse(
            id=app.id, candidate_id=app.candidate_id, job_posting_id=app.job_posting_id, stage=app.stage,
            match_score=app.match_score, recruiter_rating=app.recruiter_rating,
            hiring_manager_rating=app.hiring_manager_rating, rejection_reason=app.rejection_reason,
            offer_salary=float(app.offer_salary) if app.offer_salary else None,
            offer_sent_at=app.offer_sent_at, offer_response=app.offer_response,
            offer_response_at=app.offer_response_at, applied_at=app.applied_at, updated_at=app.updated_at,
            hired_at=app.hired_at, tenant_id=app.tenant_id,
            candidate_name=f"{candidate.first_name} {candidate.last_name}",
            candidate_email=candidate.email, candidate_phone=candidate.phone,
            candidate_location=candidate.location, candidate_skills=candidate.skills,
            candidate_experience=f"{candidate.experience_years} ans" if candidate.experience_years else None,
            candidate_education=candidate.education, candidate_ai_score=candidate.ai_score,
            candidate_ai_score_details=[AIScoreDetail(**d) for d in candidate.ai_score_details] if candidate.ai_score_details else None,
            candidate_source=candidate.source, candidate_current_company=candidate.current_company,
            candidate_expected_salary=float(candidate.expected_salary) if candidate.expected_salary else None,
            salary_currency=candidate.salary_currency or "XOF",
            candidate_notice_period=candidate.notice_period, candidate_linkedin_url=candidate.linkedin_url,
            candidate_cv_url=candidate.cv_url, candidate_cv_filename=candidate.cv_filename,
            job_title=job.title if job else None, timeline=timeline_items
        ))
    
    return ApplicationList(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("/applications", response_model=ApplicationResponse)
def create_application(
    data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id, Candidate.tenant_id == tenant.id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    job = db.query(JobPosting).filter(JobPosting.id == data.job_posting_id, JobPosting.tenant_id == tenant.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    existing = db.query(CandidateApplication).filter(
        CandidateApplication.candidate_id == data.candidate_id,
        CandidateApplication.job_posting_id == data.job_posting_id,
        CandidateApplication.tenant_id == tenant.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce candidat a déjà postulé à cette offre")
    
    application = CandidateApplication(
        candidate_id=data.candidate_id, job_posting_id=data.job_posting_id, stage="new", tenant_id=tenant.id
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    
    add_timeline_event(db, application.id, "applied", "Candidature reçue", f"Candidature pour {job.title}", tenant_id=tenant.id)
    
    apps = list_applications(job_posting_id=data.job_posting_id, page=1, page_size=100, db=db, current_user=current_user, tenant=tenant)
    for a in apps.items:
        if a.id == application.id:
            return a
    raise HTTPException(status_code=500, detail="Erreur création candidature")


@router.put("/applications/{application_id}/stage", response_model=ApplicationResponse)
def update_application_stage(
    application_id: int,
    data: ApplicationStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    old_stage = app.stage
    app.stage = data.stage
    if data.rejection_reason:
        app.rejection_reason = data.rejection_reason
    if data.stage == "hired":
        app.hired_at = datetime.utcnow()

    db.commit()

    if data.stage == "hired":
        _add_to_onboarding_queue(db, app, tenant.id)

    employee_id = current_user.employee_id if hasattr(current_user, 'employee_id') else None
    event_title = f"Étape: {STAGE_LABELS.get(old_stage, old_stage)} → {STAGE_LABELS.get(data.stage, data.stage)}"
    add_timeline_event(db, application_id, "stage_changed", event_title, data.notes, performed_by_id=employee_id, tenant_id=tenant.id)
    
    apps = list_applications(page=1, page_size=200, db=db, current_user=current_user, tenant=tenant)
    for a in apps.items:
        if a.id == application_id:
            return a
    raise HTTPException(status_code=404, detail="Candidature non trouvée")


@router.post("/applications/{application_id}/reject")
def reject_application(
    application_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    app.stage = "rejected"
    app.rejection_reason = reason
    db.commit()
    
    add_timeline_event(db, application_id, "rejected", "Candidature refusée", reason, tenant_id=tenant.id)
    return {"message": "Candidature refusée"}


def _init_employee_skills_from_cv_score(db: Session, employee, candidate, tenant_id: int):
    """
    Initialise les EmployeeSkill depuis le score IA du CV du candidat.
    - Compétences techniques → score "Compétences techniques" de l'IA
    - Compétences globales (is_global=True) → overall ai_score
    """
    if candidate.ai_score is None:
        return
    try:
        import json as _json
        from app.models.learning import Skill, EmployeeSkill as EmployeeSkillModel

        # Lire ai_score_details
        raw_details = candidate.ai_score_details
        details = []
        if raw_details:
            details = _json.loads(raw_details) if isinstance(raw_details, str) else raw_details

        # Construire un mapping catégorie → score
        cat_map = {d.get("category", ""): d.get("score", candidate.ai_score) for d in details if isinstance(d, dict)}
        tech_score = cat_map.get("Compétences techniques", candidate.ai_score)
        soft_score = cat_map.get("Soft skills", candidate.ai_score)

        # IDs de compétences déjà présentes pour cet employé
        existing_skill_ids = {
            r.skill_id for r in db.query(EmployeeSkillModel.skill_id).filter(
                EmployeeSkillModel.employee_id == employee.id
            ).all()
        }

        # Récupérer les compétences du tenant (uniquement globales ou par skill_type connu)
        tenant_skills = db.query(Skill).filter(
            Skill.tenant_id == tenant_id,
            Skill.is_active == True,
        ).all()

        new_skills = []
        for skill in tenant_skills:
            if skill.id in existing_skill_ids:
                continue
            if skill.is_global:
                init_level = candidate.ai_score
            elif skill.skill_type == "technical":
                init_level = tech_score
            elif skill.skill_type == "soft_skill":
                init_level = soft_score
            else:
                continue  # management skills non initialisés depuis le CV

            new_skills.append(EmployeeSkillModel(
                tenant_id=tenant_id,
                employee_id=employee.id,
                skill_id=skill.id,
                current_level=init_level,
                notes="Initialisé depuis le scoring IA du CV",
            ))

        if new_skills:
            db.bulk_save_objects(new_skills)
            db.commit()
            logger.info(f"[CV→Skills] {len(new_skills)} compétences initialisées pour employee_id={employee.id}")
    except Exception as e:
        logger.warning(f"[CV→Skills] Erreur initialisation compétences: {e}")
        db.rollback()


@router.post("/applications/{application_id}/convert-to-employee")
def convert_to_employee(
    application_id: int,
    send_email: bool = Query(True, description="Envoyer email de bienvenue"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """Convertit un candidat embauché en employé : crée son dossier RH + compte utilisateur."""
    application = db.query(CandidateApplication).filter(
        CandidateApplication.id == application_id,
        CandidateApplication.tenant_id == tenant.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")

    candidate = db.query(Candidate).filter(Candidate.id == application.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=400, detail="Candidat introuvable")

    job = db.query(JobPosting).filter(JobPosting.id == application.job_posting_id).first()
    job_title_str = job.title if job else (candidate.current_position or None)

    # --- Employé existant avec le même email dans ce tenant ? ---
    existing_employee = db.query(Employee).filter(
        Employee.email == candidate.email,
        Employee.tenant_id == tenant.id
    ).first()

    if existing_employee:
        # S'assurer que le User est bien lié à cet employé
        existing_user = db.query(User).filter(User.email == candidate.email).first()
        application.stage = "employee"
        if not application.hired_at:
            application.hired_at = datetime.utcnow()
        db.commit()
        add_timeline_event(db, application_id, "stage_changed", "Converti en employé (dossier existant)", tenant_id=tenant.id)
        return {
            "message": "Candidat marqué comme employé (dossier RH existant)",
            "employee_id": existing_employee.id,
            "user_id": existing_user.id if existing_user else None,
            "email": candidate.email,
            "temp_password": None,
            "already_existed": True
        }

    # --- Créer le dossier employé ---
    new_employee = Employee(
        tenant_id=tenant.id,
        first_name=candidate.first_name,
        last_name=candidate.last_name,
        email=candidate.email,
        phone=candidate.phone,
        address=candidate.location,
        job_title=job_title_str,
        status=EmployeeStatus.ACTIVE,
        role=EmployeeRoleEnum.employee,
        hire_date=datetime.utcnow().date(),
        salary=candidate.expected_salary,
        currency=candidate.salary_currency or "XOF",
    )
    db.add(new_employee)
    db.flush()  # récupérer new_employee.id

    # --- Créer le compte utilisateur ---
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))
    hashed_pw = hash_password(temp_password)

    existing_user = db.query(User).filter(User.email == candidate.email).first()
    new_user = None
    if not existing_user:
        new_user = User(
            email=candidate.email,
            hashed_password=hashed_pw,
            first_name=candidate.first_name,
            last_name=candidate.last_name,
            role=UserRole.EMPLOYEE,
            tenant_id=tenant.id,
            employee_id=new_employee.id,
            is_active=True,
            is_verified=False,
        )
        db.add(new_user)
    else:
        # Lier l'utilisateur existant à l'employé s'il n'est pas encore lié
        if not existing_user.employee_id:
            existing_user.employee_id = new_employee.id
        temp_password = None  # pas de nouveau mot de passe

    application.stage = "employee"
    if not application.hired_at:
        application.hired_at = datetime.utcnow()
    db.commit()

    if new_user:
        db.refresh(new_user)
    db.refresh(new_employee)

    # --- Initialisation des compétences depuis le score IA du CV ---
    _init_employee_skills_from_cv_score(db, new_employee, candidate, tenant.id)

    add_timeline_event(db, application_id, "stage_changed",
                       "Converti en employé – dossier RH et compte créés", tenant_id=tenant.id)

    # --- Email de bienvenue ---
    if send_email and new_user and temp_password:
        try:
            from app.services.email_service import send_access_ready_email
            send_access_ready_email(
                to_email=candidate.email,
                first_name=candidate.first_name,
                company_name=tenant.name,
                temp_password=temp_password,
            )
        except Exception as e:
            logger.warning(f"Email bienvenue employé non envoyé: {e}")

    return {
        "message": "Candidat converti en employé avec succès",
        "employee_id": new_employee.id,
        "user_id": new_user.id if new_user else existing_user.id,
        "email": candidate.email,
        "temp_password": temp_password,
        "already_existed": False
    }


@router.delete("/applications/{application_id}")
def delete_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    db.query(CandidateTimeline).filter(CandidateTimeline.application_id == application_id).delete()
    db.query(Interview).filter(Interview.application_id == application_id).delete()
    db.delete(app)
    db.commit()
    return {"message": "Candidature supprimée"}


@router.post("/applications/{application_id}/offer", response_model=ApplicationResponse)
def send_offer(
    application_id: int,
    data: SendOfferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    app.stage = "offer"
    app.offer_salary = data.salary
    app.offer_sent_at = datetime.utcnow()
    db.commit()
    
    add_timeline_event(db, application_id, "offer_sent", f"Offre envoyée - {data.salary:,.0f} {data.currency}", data.notes, tenant_id=tenant.id)
    
    apps = list_applications(page=1, page_size=200, db=db, current_user=current_user, tenant=tenant)
    for a in apps.items:
        if a.id == application_id:
            return a
    raise HTTPException(status_code=404, detail="Candidature non trouvée")


@router.post("/applications/{application_id}/offer-response")
def handle_offer_response(
    application_id: int,
    data: OfferResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    app.offer_response = data.response
    app.offer_response_at = datetime.utcnow()
    
    if data.response == "accepted":
        app.stage = "hired"
        app.hired_at = datetime.utcnow()
        event_type, event_title = "offer_accepted", "Offre acceptée"
    elif data.response == "declined":
        app.stage = "withdrawn"
        event_type, event_title = "offer_declined", "Offre déclinée"
    else:
        event_type, event_title = "note_added", f"Réponse offre: {data.response}"

    db.commit()
    add_timeline_event(db, application_id, event_type, event_title, data.notes, tenant_id=tenant.id)

    if data.response == "accepted":
        _add_to_onboarding_queue(db, app, tenant.id)

    # Email félicitations si embauché
    if data.response == "accepted":
        try:
            from app.services.email_service import send_hired_email
            candidate = app.candidate
            job = app.job_posting
            if candidate and candidate.email:
                send_hired_email(
                    to_email=candidate.email,
                    candidate_name=f"{candidate.first_name} {candidate.last_name}",
                    job_title=job.title if job else "Poste",
                    company_name=tenant.name,
                )
        except Exception as e:
            print(f"⚠️ Email embauche non envoyé: {e}")

    return {"message": f"Réponse enregistrée: {data.response}"}

# ============================================
# INTERVIEWS
# ============================================

@router.get("/interviews", response_model=InterviewList)
def list_interviews(
    application_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    query = db.query(Interview).filter(Interview.tenant_id == tenant.id)
    
    if application_id:
        query = query.filter(Interview.application_id == application_id)
    if status:
        query = query.filter(Interview.status == status)
    if from_date:
        query = query.filter(Interview.scheduled_at >= from_date)
    if to_date:
        query = query.filter(Interview.scheduled_at <= to_date)
    
    total = query.count()
    pages = math.ceil(total / page_size) if total > 0 else 1
    interviews = query.order_by(Interview.scheduled_at.asc()).offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for interview in interviews:
        app = interview.application
        candidate = app.candidate
        job = app.job_posting
        
        interviewer_names = []
        if interview.interviewer_ids:
            for emp_id in interview.interviewer_ids:
                emp = db.query(Employee).filter(Employee.id == emp_id).first()
                if emp:
                    interviewer_names.append(f"{emp.first_name} {emp.last_name}")
        
        items.append(InterviewResponse(
            id=interview.id, application_id=interview.application_id, interview_type=interview.interview_type,
            status=interview.status, scheduled_at=interview.scheduled_at, duration_minutes=interview.duration_minutes,
            location=interview.location, meeting_link=interview.meeting_link, interviewer_ids=interview.interviewer_ids,
            feedback=interview.feedback, rating=interview.rating, recommendation=interview.recommendation,
            interview_notes=interview.interview_notes, candidate_feedback=interview.candidate_feedback,
            completed_at=interview.completed_at, created_at=interview.created_at, updated_at=interview.updated_at,
            tenant_id=interview.tenant_id, candidate_name=f"{candidate.first_name} {candidate.last_name}",
            job_title=job.title if job else None, interviewer_names=interviewer_names
        ))
    
    return InterviewList(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("/interviews", response_model=InterviewResponse)
def create_interview(
    data: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    app = db.query(CandidateApplication).filter(CandidateApplication.id == data.application_id, CandidateApplication.tenant_id == tenant.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    interview = Interview(**data.model_dump(), status="scheduled", tenant_id=tenant.id)
    db.add(interview)
    db.commit()
    db.refresh(interview)

    try:
        from app.services.sync_hooks import sync_interview_created
        candidate = app.candidate
        candidate_name = f"{candidate.first_name} {candidate.last_name}" if candidate else "Candidat"
        organizer_email = current_user.email or ""
        if organizer_email:
            sync_interview_created(db, tenant.id, interview, organizer_email, candidate_name, [organizer_email])
    except Exception:
        pass

    type_label = {"phone": "téléphonique", "video": "vidéo", "onsite": "sur site"}.get(data.interview_type, data.interview_type)
    add_timeline_event(
        db, data.application_id, "interview_scheduled",
        f"Entretien {type_label} planifié",
        f"Prévu le {data.scheduled_at.strftime('%d/%m/%Y à %H:%M')} | interview_id:{interview.id}",
        tenant_id=tenant.id
    )

    # Emails entretien — candidat + interviewers
    try:
        from app.services.email_service import send_interview_scheduled_email
        candidate = app.candidate
        job = app.job_posting
        job_title = job.title if job else "Poste"
        scheduled_str = data.scheduled_at.strftime("%d/%m/%Y à %H:%M")
        candidate_name = f"{candidate.first_name} {candidate.last_name}" if candidate else "Candidat"
        # Email au candidat
        if candidate and candidate.email:
            send_interview_scheduled_email(
                to_email=candidate.email,
                recipient_name=candidate.first_name,
                candidate_name=candidate_name,
                job_title=job_title,
                interview_type=data.interview_type,
                scheduled_at=scheduled_str,
                location=data.location,
                meeting_link=data.meeting_link,
                is_candidate=True,
            )
        # Emails aux interviewers
        if data.interviewer_ids:
            for emp_id in data.interviewer_ids:
                interviewer = db.query(Employee).filter(Employee.id == emp_id).first()
                if interviewer and interviewer.email:
                    send_interview_scheduled_email(
                        to_email=interviewer.email,
                        recipient_name=interviewer.first_name,
                        candidate_name=candidate_name,
                        job_title=job_title,
                        interview_type=data.interview_type,
                        scheduled_at=scheduled_str,
                        location=data.location,
                        meeting_link=data.meeting_link,
                        is_candidate=False,
                    )
    except Exception as e:
        print(f"⚠️ Email entretien non envoyé: {e}")
    
    interviews = list_interviews(application_id=data.application_id, page=1, page_size=100, db=db, current_user=current_user, tenant=tenant)
    for i in interviews.items:
        if i.id == interview.id:
            return i
    raise HTTPException(status_code=500, detail="Erreur création entretien")


@router.put("/interviews/{interview_id}", response_model=InterviewResponse)
def update_interview(
    interview_id: int,
    data: InterviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.tenant_id == tenant.id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Entretien non trouvé")
    
    update_data = data.model_dump(exclude_unset=True)
    
    if update_data.get("status") == "completed":
        update_data["completed_at"] = datetime.utcnow()
        feedback_text = f"Note: {data.rating}/5" if data.rating else None
        if data.recommendation:
            rec_labels = {"hire": "Recruter", "maybe": "Peut-être", "no_hire": "Ne pas recruter"}
            feedback_text = f"{feedback_text} - {rec_labels.get(data.recommendation, data.recommendation)}" if feedback_text else rec_labels.get(data.recommendation)
        add_timeline_event(db, interview.application_id, "interview_completed", "Entretien terminé", feedback_text, tenant_id=tenant.id)
    
    for field, value in update_data.items():
        setattr(interview, field, value)
    
    db.commit()
    
    interviews = list_interviews(page=1, page_size=100, db=db, current_user=current_user, tenant=tenant)
    for i in interviews.items:
        if i.id == interview_id:
            return i
    raise HTTPException(status_code=404, detail="Entretien non trouvé")


@router.delete("/interviews/{interview_id}")
def delete_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.tenant_id == tenant.id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Entretien non trouvé")
    
    application_id = interview.application_id
    
    db.delete(interview)
    
    db.query(CandidateTimeline).filter(
        CandidateTimeline.application_id == application_id,
        CandidateTimeline.event_type == "interview_scheduled",
        CandidateTimeline.event_description.like(f"%interview_id:{interview_id}%")
    ).delete(synchronize_session=False)
    
    add_timeline_event(
        db, application_id, "interview_cancelled",
        "Entretien annulé",
        f"L'entretien a été supprimé",
        tenant_id=tenant.id
    )
    
    db.commit()
    return {"message": "Entretien supprimé"}


# ============================================
# STATS & ANALYTICS
# ============================================

def get_analytics_tenant_ids(db: Session, tenant: Tenant) -> list:
    if getattr(tenant, 'is_group', False):
        subs = db.query(Tenant.id).filter(Tenant.parent_tenant_id == tenant.id).all()
        return [tenant.id] + [s.id for s in subs]
    return [tenant.id]


def resolve_recruitment_tenant_id(
    db: Session,
    current_user: User,
    tenant: Tenant,
    subsidiary_tenant_id: Optional[int],
) -> int:
    if not subsidiary_tenant_id:
        return tenant.id

    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
        employee = db.query(Employee).filter(
            Employee.id == current_user.employee_id,
            Employee.tenant_id == tenant.id,
        ).first()
        employee_role = getattr(employee.role, "value", None) if employee else None
        if employee_role != "dg":
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")

    sub = db.query(Tenant).filter(
        Tenant.id == subsidiary_tenant_id,
        Tenant.parent_tenant_id == tenant.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=403, detail="Filiale non autorisée ou introuvable")

    return sub.id

@router.get("/stats", response_model=RecruitmentStats)
def get_recruitment_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    subsidiary_tenant_id: Optional[int] = Query(None),
):
    if subsidiary_tenant_id:
        resolve_recruitment_tenant_id(db, current_user, tenant, subsidiary_tenant_id)
        tenant_ids = [subsidiary_tenant_id]
    else:
        tenant_ids = get_analytics_tenant_ids(db, tenant)

    open_positions = db.query(JobPosting).filter(
        JobPosting.tenant_id.in_(tenant_ids), JobPosting.status == "active"
    ).count()

    total_candidates = db.query(func.count(func.distinct(CandidateApplication.candidate_id))).filter(
        CandidateApplication.tenant_id.in_(tenant_ids)
    ).scalar() or 0

    interview_stages = ["phone_screen", "hr_interview", "technical", "final"]
    in_interview = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id.in_(tenant_ids), CandidateApplication.stage.in_(interview_stages)
    ).count()

    six_months_ago = datetime.utcnow() - timedelta(days=180)
    hired_apps = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id.in_(tenant_ids), CandidateApplication.stage.in_(["hired", "employee"]),
        CandidateApplication.hired_at >= six_months_ago
    ).all()

    avg_time_to_hire = 0
    if hired_apps:
        total_days = sum((app.hired_at - app.applied_at).days for app in hired_apps if app.hired_at)
        avg_time_to_hire = total_days // len(hired_apps) if hired_apps else 0

    first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    hires_this_month = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id.in_(tenant_ids), CandidateApplication.stage.in_(["hired", "employee"]),
        CandidateApplication.hired_at >= first_of_month
    ).count()

    first_of_year = datetime.utcnow().replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    hires_this_year = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id.in_(tenant_ids), CandidateApplication.stage.in_(["hired", "employee"]),
        CandidateApplication.hired_at >= first_of_year
    ).count()

    return RecruitmentStats(
        open_positions=open_positions, total_candidates=total_candidates, in_interview=in_interview,
        avg_time_to_hire=avg_time_to_hire, hires_this_month=hires_this_month, hires_this_year=hires_this_year
    )


@router.get("/analytics", response_model=RecruitmentAnalytics)
def get_recruitment_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    subsidiary_tenant_id: Optional[int] = Query(None),
):
    if subsidiary_tenant_id:
        resolve_recruitment_tenant_id(db, current_user, tenant, subsidiary_tenant_id)
        tenant_ids = [subsidiary_tenant_id]
    else:
        tenant_ids = get_analytics_tenant_ids(db, tenant)

    stats = get_recruitment_stats(db, current_user, tenant, subsidiary_tenant_id)

    pipeline = []
    for stage in ["new", "screening", "phone_screen", "hr_interview", "technical", "final", "offer", "hired"]:
        count = db.query(CandidateApplication).filter(CandidateApplication.tenant_id.in_(tenant_ids), CandidateApplication.stage == stage).count()
        pipeline.append(PipelineStats(stage=stage, stage_label=STAGE_LABELS.get(stage, stage), count=count, color=STAGE_COLORS.get(stage, "#6B7280")))

    sources = []
    total_apps = db.query(CandidateApplication).filter(CandidateApplication.tenant_id.in_(tenant_ids)).count()
    source_counts = db.query(Candidate.source, func.count(CandidateApplication.id)).join(CandidateApplication).filter(
        CandidateApplication.tenant_id.in_(tenant_ids)
    ).group_by(Candidate.source).all()

    for source, count in source_counts:
        source_name = source if source else "Autre"
        sources.append(SourceStats(
            source=source_name, count=count,
            percentage=round((count / total_apps) * 100, 1) if total_apps > 0 else 0,
            color=SOURCE_COLORS.get(source_name, "#6B7280")
        ))

    hiring_trend = []
    month_names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
    for i in range(5, -1, -1):
        target_date = datetime.utcnow() - timedelta(days=i*30)
        month_start = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start.replace(month=month_start.month % 12 + 1) if month_start.month < 12
                     else month_start.replace(year=month_start.year + 1, month=1))

        applications = db.query(CandidateApplication).filter(
            CandidateApplication.tenant_id.in_(tenant_ids),
            CandidateApplication.applied_at >= month_start, CandidateApplication.applied_at < month_end
        ).count()

        hires = db.query(CandidateApplication).filter(
            CandidateApplication.tenant_id.in_(tenant_ids), CandidateApplication.stage.in_(["hired", "employee"]),
            CandidateApplication.hired_at >= month_start, CandidateApplication.hired_at < month_end
        ).count()

        hiring_trend.append(HiringTrend(month=month_names[month_start.month - 1], applications=applications, hires=hires))

    by_department = []
    dept_counts = db.query(Department.name, func.count(CandidateApplication.id)).join(
        JobPosting, JobPosting.department_id == Department.id
    ).join(CandidateApplication, CandidateApplication.job_posting_id == JobPosting.id).filter(
        CandidateApplication.tenant_id.in_(tenant_ids)
    ).group_by(Department.name).all()

    for dept_name, count in dept_counts:
        by_department.append(DepartmentStats(department=dept_name or "Non assigné", count=count))

    top_candidates = []
    top_apps = db.query(CandidateApplication).join(Candidate).filter(
        CandidateApplication.tenant_id.in_(tenant_ids), Candidate.ai_score.isnot(None),
        CandidateApplication.stage.notin_(["rejected", "withdrawn", "hired"])
    ).order_by(Candidate.ai_score.desc()).limit(5).all()

    for app in top_apps:
        job = app.job_posting
        top_candidates.append(TopCandidate(
            id=app.candidate.id, name=f"{app.candidate.first_name} {app.candidate.last_name}",
            position=job.title if job else "N/A", ai_score=app.candidate.ai_score or 0,
            stage=STAGE_LABELS.get(app.stage, app.stage)
        ))

    return RecruitmentAnalytics(
        stats=stats, pipeline=pipeline, sources=sources, hiring_trend=hiring_trend,
        by_department=by_department, top_candidates=top_candidates
    )

# ============================================
# EMPLOYEE SELF-SERVICE (Candidatures internes)
# ============================================

@router.get("/my-applications")
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    if not hasattr(current_user, 'employee_id') or not current_user.employee_id:
        employee = db.query(Employee).filter(
            Employee.email == current_user.email,
            Employee.tenant_id == tenant.id
        ).first()
        if not employee:
            return []
        employee_id = employee.id
    else:
        employee_id = current_user.employee_id
    
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return []
    
    candidate = db.query(Candidate).filter(
        Candidate.email == employee.email,
        Candidate.tenant_id == tenant.id
    ).first()
    
    if not candidate:
        return []
    
    applications = db.query(CandidateApplication).filter(
        CandidateApplication.candidate_id == candidate.id,
        CandidateApplication.tenant_id == tenant.id
    ).order_by(CandidateApplication.applied_at.desc()).all()
    
    result = []
    for app in applications:
        job = app.job_posting
        result.append({
            "id": app.id,
            "job_posting_id": app.job_posting_id,
            "job_title": job.title if job else "N/A",
            "department_name": job.department.name if job and job.department else None,
            "stage": app.stage,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None,
            "updated_at": app.updated_at.isoformat() if app.updated_at else None
        })
    
    return result


@router.post("/jobs/{job_id}/apply")
def apply_to_job(
    job_id: int,
    data: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    job = db.query(JobPosting).filter(
        JobPosting.id == job_id,
        JobPosting.tenant_id == tenant.id,
        JobPosting.status == "active"
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée ou non disponible")
    
    employee = None
    if hasattr(current_user, 'employee_id') and current_user.employee_id:
        employee = db.query(Employee).filter(Employee.id == current_user.employee_id, Employee.tenant_id == tenant.id).first()

    if not employee:
        employee = db.query(Employee).filter(
            Employee.email == current_user.email,
            Employee.tenant_id == tenant.id
        ).first()

    if not employee:
        raise HTTPException(status_code=400, detail="Profil employé non trouvé")
    
    candidate = db.query(Candidate).filter(
        Candidate.email == employee.email,
        Candidate.tenant_id == tenant.id
    ).first()
    
    if not candidate:
        candidate = Candidate(
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            phone=getattr(employee, 'phone', None),
            location=None,
            current_company=tenant.name if hasattr(tenant, 'name') else "Interne",
            current_position=getattr(employee, 'job_title', None) or getattr(employee, 'position', None),
            source="Mobilité interne",
            tenant_id=tenant.id
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
    
    existing = db.query(CandidateApplication).filter(
        CandidateApplication.candidate_id == candidate.id,
        CandidateApplication.job_posting_id == job_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà postulé à cette offre")
    
    application = CandidateApplication(
        candidate_id=candidate.id,
        job_posting_id=job_id,
        stage="new",
        tenant_id=tenant.id
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    
    cover_letter = data.get("cover_letter") if data else None
    if cover_letter:
        candidate.cover_letter = cover_letter
        db.commit()
    
    add_timeline_event(
        db, application.id, "applied",
        "Candidature interne reçue",
        f"Candidature de {employee.first_name} {employee.last_name} (Mobilité interne)",
        tenant_id=tenant.id
    )
    
    return {
        "message": "Candidature envoyée avec succès",
        "application_id": application.id
    }


@router.delete("/my-applications/{application_id}")
def withdraw_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    employee = None
    if hasattr(current_user, 'employee_id') and current_user.employee_id:
        employee = db.query(Employee).filter(Employee.id == current_user.employee_id, Employee.tenant_id == tenant.id).first()

    if not employee:
        employee = db.query(Employee).filter(
            Employee.email == current_user.email,
            Employee.tenant_id == tenant.id
        ).first()
    
    if not employee:
        raise HTTPException(status_code=400, detail="Profil employé non trouvé")
    
    candidate = db.query(Candidate).filter(
        Candidate.email == employee.email,
        Candidate.tenant_id == tenant.id
    ).first()
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    application = db.query(CandidateApplication).filter(
        CandidateApplication.id == application_id,
        CandidateApplication.candidate_id == candidate.id,
        CandidateApplication.tenant_id == tenant.id
    ).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    if application.stage == "hired":
        raise HTTPException(status_code=400, detail="Impossible de retirer une candidature acceptée")
    
    application.stage = "withdrawn"
    db.commit()
    
    add_timeline_event(
        db, application.id, "withdrawn",
        "Candidature retirée",
        "Le candidat a retiré sa candidature",
        tenant_id=tenant.id
    )
    
    return {"message": "Candidature retirée"}