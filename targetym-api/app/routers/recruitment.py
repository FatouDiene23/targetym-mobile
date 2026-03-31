# ============================================
# app/routers/recruitment.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional
from datetime import datetime, timedelta
import math
import re

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Employee, Department
from app.models.user import User
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

def get_tenant_id(current_user: User) -> int:
    return current_user.tenant_id or 1

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
    current_user: User = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    query = db.query(JobPosting).filter(JobPosting.tenant_id == tenant_id)
    
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
def create_job(data: JobPostingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    job = JobPosting(**data.model_dump(), status="draft", tenant_id=tenant_id)
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
def get_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    applicants_count = db.query(CandidateApplication).filter(CandidateApplication.job_posting_id == job.id).count()
    
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
def update_job(job_id: int, data: JobPostingUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("status") == "active" and not job.posted_at:
        update_data["posted_at"] = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(job, field, value)
    
    db.commit()
    db.refresh(job)
    return get_job(job_id, db, current_user)


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    apps_count = db.query(CandidateApplication).filter(CandidateApplication.job_posting_id == job_id).count()
    if apps_count > 0:
        raise HTTPException(status_code=400, detail="Impossible de supprimer une offre avec des candidatures")
    
    db.delete(job)
    db.commit()
    return {"message": "Offre supprimée"}


@router.post("/jobs/{job_id}/publish", response_model=JobPostingResponse)
def publish_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    job.status = "active"
    job.posted_at = datetime.utcnow()
    db.commit()

    # ── Sync vers IntoWork si Interne+Externe ──────────────────────────────
    try:
        from app.models.tenant import Tenant
        import httpx, os, logging
        _log = logging.getLogger(__name__)
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        job_visibility = getattr(job, 'visibility', 'internal') or 'internal'
        if job_visibility == 'internal_external' and tenant and tenant.intowork_company_id and tenant.intowork_api_key:
            _raw_url = os.getenv("INTOWORK_API_URL", "") or ""
            _m = re.search(r'https?://[^\s]+', _raw_url)
            intowork_url = _m.group(0).rstrip('/') if _m else "https://intowork-dashboard-production-1ede.up.railway.app"
            # Mapping remote_policy → location_type
            remote_map = {"onsite": "on_site", "remote": "remote", "hybrid": "hybrid"}
            location_type = remote_map.get((job.remote_policy or "").lower(), "on_site")
            # Mapping contract_type → job_type
            contract_map = {
                "cdi": "full_time", "cdd": "contract", "stage": "internship",
                "alternance": "internship", "freelance": "contract", "interim": "temporary"
            }
            job_type = contract_map.get((job.contract_type or "").lower(), "full_time")
            payload = {
                "company_id": tenant.intowork_company_id,
                "api_key": tenant.intowork_api_key,
                "targetym_tenant_id": tenant_id,
                "job": {
                    "targetym_job_posting_id": job.id,
                    "title": job.title,
                    "description": job.description or "",
                    "location": job.location or "",
                    "job_type": job_type,
                    "location_type": location_type,
                    "salary_min": float(job.salary_min) if job.salary_min else None,
                    "salary_max": float(job.salary_max) if job.salary_max else None,
                    "currency": job.salary_currency or "XOF",
                }
            }
            resp = httpx.post(
                f"{intowork_url}/api/integrations/targetym/webhook/sync-job",
                json=payload,
                timeout=10.0
            )
            if resp.status_code == 200:
                _log.info(f"✅ Job #{job.id} synchronisé vers IntoWork : {resp.json()}")
            else:
                _log.warning(f"⚠️ IntoWork a répondu {resp.status_code} pour sync-job #{job.id}: {resp.text[:200]}")
    except Exception as _e:
        import logging as _logging
        _logging.getLogger(__name__).error(f"❌ Erreur sync job vers IntoWork : {_e}")
    # ──────────────────────────────────────────────────────────────

    return get_job(job_id, db, current_user)


@router.post("/jobs/{job_id}/close", response_model=JobPostingResponse)
def close_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    job.status = "closed"
    db.commit()
    return get_job(job_id, db, current_user)

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
    current_user: User = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    query = db.query(Candidate).filter(Candidate.tenant_id == tenant_id)
    
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
def create_candidate(data: CandidateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    
    existing = db.query(Candidate).filter(Candidate.email == data.email, Candidate.tenant_id == tenant_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Un candidat avec cet email existe déjà")
    
    job_posting_id = data.job_posting_id
    candidate_data = data.model_dump(exclude={"job_posting_id"})
    
    candidate = Candidate(**candidate_data, tenant_id=tenant_id)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    if job_posting_id:
        application = CandidateApplication(
            candidate_id=candidate.id, job_posting_id=job_posting_id, stage="new", tenant_id=tenant_id
        )
        db.add(application)
        db.commit()
        add_timeline_event(db, application.id, "applied", "Candidature reçue", tenant_id=tenant_id)
    
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
def get_candidate(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id).first()
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
def update_candidate(candidate_id: int, data: CandidateUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    
    db.commit()
    db.refresh(candidate)
    return get_candidate(candidate_id, db, current_user)


@router.delete("/candidates/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id).first()
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
    current_user: User = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    query = db.query(CandidateApplication).filter(CandidateApplication.tenant_id == tenant_id)
    
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
            candidate_notice_period=candidate.notice_period, candidate_linkedin_url=candidate.linkedin_url,
            job_title=job.title if job else None, timeline=timeline_items
        ))
    
    return ApplicationList(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("/applications", response_model=ApplicationResponse)
def create_application(data: ApplicationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    
    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id, Candidate.tenant_id == tenant_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    job = db.query(JobPosting).filter(JobPosting.id == data.job_posting_id, JobPosting.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre non trouvée")
    
    existing = db.query(CandidateApplication).filter(
        CandidateApplication.candidate_id == data.candidate_id,
        CandidateApplication.job_posting_id == data.job_posting_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce candidat a déjà postulé à cette offre")
    
    application = CandidateApplication(
        candidate_id=data.candidate_id, job_posting_id=data.job_posting_id, stage="new", tenant_id=tenant_id
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    
    add_timeline_event(db, application.id, "applied", "Candidature reçue", f"Candidature pour {job.title}", tenant_id=tenant_id)
    
    return list_applications(job_posting_id=data.job_posting_id, db=db, current_user=current_user, page_size=100).items[0]


@router.put("/applications/{application_id}/stage", response_model=ApplicationResponse)
def update_application_stage(application_id: int, data: ApplicationStageUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    old_stage = app.stage
    app.stage = data.stage
    if data.rejection_reason:
        app.rejection_reason = data.rejection_reason
    if data.stage == "hired":
        app.hired_at = datetime.utcnow()
    
    db.commit()
    
    employee_id = current_user.employee_id if hasattr(current_user, 'employee_id') else None
    event_title = f"Étape: {STAGE_LABELS.get(old_stage, old_stage)} → {STAGE_LABELS.get(data.stage, data.stage)}"
    add_timeline_event(db, application_id, "stage_changed", event_title, data.notes, performed_by_id=employee_id, tenant_id=tenant_id)
    
    apps = list_applications(db=db, current_user=current_user, page_size=200)
    for a in apps.items:
        if a.id == application_id:
            return a
    raise HTTPException(status_code=404, detail="Candidature non trouvée")


@router.post("/applications/{application_id}/reject")
def reject_application(application_id: int, reason: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    app.stage = "rejected"
    app.rejection_reason = reason
    db.commit()
    
    add_timeline_event(db, application_id, "rejected", "Candidature refusée", reason, tenant_id=tenant_id)
    return {"message": "Candidature refusée"}


@router.post("/applications/{application_id}/offer", response_model=ApplicationResponse)
def send_offer(application_id: int, data: SendOfferRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    app.stage = "offer"
    app.offer_salary = data.salary
    app.offer_sent_at = datetime.utcnow()
    db.commit()
    
    add_timeline_event(db, application_id, "offer_sent", f"Offre envoyée - {data.salary:,.0f} {data.currency}", data.notes, tenant_id=tenant_id)
    
    apps = list_applications(db=db, current_user=current_user, page_size=200)
    for a in apps.items:
        if a.id == application_id:
            return a
    raise HTTPException(status_code=404, detail="Candidature non trouvée")


@router.post("/applications/{application_id}/offer-response")
def handle_offer_response(application_id: int, data: OfferResponseRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    app = db.query(CandidateApplication).filter(CandidateApplication.id == application_id, CandidateApplication.tenant_id == tenant_id).first()
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
    add_timeline_event(db, application_id, event_type, event_title, data.notes, tenant_id=tenant_id)
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
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    query = db.query(Interview).filter(Interview.tenant_id == tenant_id)
    
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
def create_interview(data: InterviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    
    app = db.query(CandidateApplication).filter(CandidateApplication.id == data.application_id, CandidateApplication.tenant_id == tenant_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    interview = Interview(**data.model_dump(), status="scheduled", tenant_id=tenant_id)
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    type_label = {"phone": "téléphonique", "video": "vidéo", "onsite": "sur site"}.get(data.interview_type, data.interview_type)
    add_timeline_event(db, data.application_id, "interview_scheduled", f"Entretien {type_label} planifié",
                       f"Prévu le {data.scheduled_at.strftime('%d/%m/%Y à %H:%M')}", tenant_id=tenant_id)
    
    interviews = list_interviews(application_id=data.application_id, db=db, current_user=current_user)
    for i in interviews.items:
        if i.id == interview.id:
            return i
    raise HTTPException(status_code=500, detail="Erreur création entretien")


@router.put("/interviews/{interview_id}", response_model=InterviewResponse)
def update_interview(interview_id: int, data: InterviewUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.tenant_id == tenant_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Entretien non trouvé")
    
    update_data = data.model_dump(exclude_unset=True)
    
    if update_data.get("status") == "completed":
        update_data["completed_at"] = datetime.utcnow()
        feedback_text = f"Note: {data.rating}/5" if data.rating else None
        if data.recommendation:
            rec_labels = {"hire": "Recruter", "maybe": "Peut-être", "no_hire": "Ne pas recruter"}
            feedback_text = f"{feedback_text} - {rec_labels.get(data.recommendation, data.recommendation)}" if feedback_text else rec_labels.get(data.recommendation)
        add_timeline_event(db, interview.application_id, "interview_completed", "Entretien terminé", feedback_text, tenant_id=tenant_id)
    
    for field, value in update_data.items():
        setattr(interview, field, value)
    
    db.commit()
    
    interviews = list_interviews(db=db, current_user=current_user, page_size=100)
    for i in interviews.items:
        if i.id == interview_id:
            return i
    raise HTTPException(status_code=404, detail="Entretien non trouvé")


@router.delete("/interviews/{interview_id}")
def delete_interview(interview_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.tenant_id == tenant_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Entretien non trouvé")
    
    db.delete(interview)
    db.commit()
    return {"message": "Entretien supprimé"}


# ============================================
# STATS & ANALYTICS
# ============================================

@router.get("/stats", response_model=RecruitmentStats)
def get_recruitment_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    
    open_positions = db.query(JobPosting).filter(JobPosting.tenant_id == tenant_id, JobPosting.status == "active").count()
    total_candidates = db.query(Candidate).filter(Candidate.tenant_id == tenant_id).count()
    
    interview_stages = ["phone_screen", "hr_interview", "technical", "final"]
    in_interview = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id == tenant_id, CandidateApplication.stage.in_(interview_stages)
    ).count()
    
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    hired_apps = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id == tenant_id, CandidateApplication.stage == "hired",
        CandidateApplication.hired_at >= six_months_ago
    ).all()
    
    avg_time_to_hire = 0
    if hired_apps:
        total_days = sum((app.hired_at - app.applied_at).days for app in hired_apps if app.hired_at)
        avg_time_to_hire = total_days // len(hired_apps) if hired_apps else 0
    
    first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    hires_this_month = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id == tenant_id, CandidateApplication.stage == "hired",
        CandidateApplication.hired_at >= first_of_month
    ).count()
    
    first_of_year = datetime.utcnow().replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    hires_this_year = db.query(CandidateApplication).filter(
        CandidateApplication.tenant_id == tenant_id, CandidateApplication.stage == "hired",
        CandidateApplication.hired_at >= first_of_year
    ).count()
    
    return RecruitmentStats(
        open_positions=open_positions, total_candidates=total_candidates, in_interview=in_interview,
        avg_time_to_hire=avg_time_to_hire, hires_this_month=hires_this_month, hires_this_year=hires_this_year
    )


@router.get("/analytics", response_model=RecruitmentAnalytics)
def get_recruitment_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant_id = get_tenant_id(current_user)
    stats = get_recruitment_stats(db, current_user)
    
    # Pipeline
    pipeline = []
    for stage in ["new", "screening", "phone_screen", "hr_interview", "technical", "final", "offer", "hired"]:
        count = db.query(CandidateApplication).filter(CandidateApplication.tenant_id == tenant_id, CandidateApplication.stage == stage).count()
        pipeline.append(PipelineStats(stage=stage, stage_label=STAGE_LABELS.get(stage, stage), count=count, color=STAGE_COLORS.get(stage, "#6B7280")))
    
    # Sources
    sources = []
    total_apps = db.query(CandidateApplication).filter(CandidateApplication.tenant_id == tenant_id).count()
    source_counts = db.query(Candidate.source, func.count(CandidateApplication.id)).join(CandidateApplication).filter(
        CandidateApplication.tenant_id == tenant_id
    ).group_by(Candidate.source).all()
    
    for source, count in source_counts:
        source_name = source if source else "Autre"
        sources.append(SourceStats(
            source=source_name, count=count,
            percentage=round((count / total_apps) * 100, 1) if total_apps > 0 else 0,
            color=SOURCE_COLORS.get(source_name, "#6B7280")
        ))
    
    # Hiring trend
    hiring_trend = []
    month_names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
    for i in range(5, -1, -1):
        target_date = datetime.utcnow() - timedelta(days=i*30)
        month_start = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start.replace(month=month_start.month % 12 + 1) if month_start.month < 12
                     else month_start.replace(year=month_start.year + 1, month=1))
        
        applications = db.query(CandidateApplication).filter(
            CandidateApplication.tenant_id == tenant_id,
            CandidateApplication.applied_at >= month_start, CandidateApplication.applied_at < month_end
        ).count()
        
        hires = db.query(CandidateApplication).filter(
            CandidateApplication.tenant_id == tenant_id, CandidateApplication.stage == "hired",
            CandidateApplication.hired_at >= month_start, CandidateApplication.hired_at < month_end
        ).count()
        
        hiring_trend.append(HiringTrend(month=month_names[month_start.month - 1], applications=applications, hires=hires))
    
    # By department
    by_department = []
    dept_counts = db.query(Department.name, func.count(CandidateApplication.id)).join(
        JobPosting, JobPosting.department_id == Department.id
    ).join(CandidateApplication, CandidateApplication.job_posting_id == JobPosting.id).filter(
        CandidateApplication.tenant_id == tenant_id
    ).group_by(Department.name).all()
    
    for dept_name, count in dept_counts:
        by_department.append(DepartmentStats(department=dept_name or "Non assigné", count=count))
    
    # Top candidates
    top_candidates = []
    top_apps = db.query(CandidateApplication).join(Candidate).filter(
        CandidateApplication.tenant_id == tenant_id, Candidate.ai_score.isnot(None),
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
