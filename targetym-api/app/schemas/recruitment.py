# ============================================
# app/schemas/recruitment.py
# ============================================

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

# ============================================
# ENUMS
# ============================================

class JobStatus(str, Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    closed = "closed"
    filled = "filled"

class JobUrgency(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

class ContractType(str, Enum):
    cdi = "CDI"
    cdd = "CDD"
    stage = "Stage"
    alternance = "Alternance"
    freelance = "Freelance"
    interim = "Interim"

class CandidateStage(str, Enum):
    new = "new"
    screening = "screening"
    phone_screen = "phone_screen"
    hr_interview = "hr_interview"
    technical = "technical"
    final = "final"
    offer = "offer"
    hired = "hired"
    rejected = "rejected"
    withdrawn = "withdrawn"

class CandidateSource(str, Enum):
    linkedin = "LinkedIn"
    indeed = "Indeed"
    website = "Site Carrière"
    referral = "Référence interne"
    agency = "Cabinet"
    other = "Autre"

class InterviewType(str, Enum):
    phone = "phone"
    video = "video"
    onsite = "onsite"

class InterviewStatus(str, Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"

class TimelineEventType(str, Enum):
    applied = "applied"
    screened = "screened"
    interview_scheduled = "interview_scheduled"
    interview_completed = "interview_completed"
    test_sent = "test_sent"
    test_completed = "test_completed"
    offer_sent = "offer_sent"
    offer_accepted = "offer_accepted"
    offer_declined = "offer_declined"
    hired = "hired"
    rejected = "rejected"
    note_added = "note_added"
    stage_changed = "stage_changed"

# ============================================
# JOB POSTING SCHEMAS
# ============================================

class JobPostingBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    department_id: Optional[int] = None
    location: str = Field(..., min_length=2, max_length=100)
    remote_policy: Optional[str] = "onsite"
    contract_type: Optional[str] = "CDI"
    description: Optional[str] = None
    responsibilities: Optional[str] = None
    requirements: Optional[List[str]] = None
    nice_to_have: Optional[List[str]] = None
    benefits: Optional[List[str]] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = "XOF"
    show_salary: Optional[bool] = False
    visibility: Optional[str] = "internal"
    urgency: Optional[str] = "medium"
    hiring_manager_id: Optional[int] = None
    recruiter_id: Optional[int] = None
    deadline: Optional[date] = None

class JobPostingCreate(JobPostingBase):
    pass

class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    department_id: Optional[int] = None
    location: Optional[str] = None
    remote_policy: Optional[str] = None
    contract_type: Optional[str] = None
    description: Optional[str] = None
    responsibilities: Optional[str] = None
    requirements: Optional[List[str]] = None
    nice_to_have: Optional[List[str]] = None
    benefits: Optional[List[str]] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = None
    show_salary: Optional[bool] = None
    visibility: Optional[str] = None
    status: Optional[str] = None
    urgency: Optional[str] = None
    hiring_manager_id: Optional[int] = None
    recruiter_id: Optional[int] = None
    deadline: Optional[date] = None

class JobPostingResponse(JobPostingBase):
    id: int
    status: str
    posted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    tenant_id: int
    department_name: Optional[str] = None
    hiring_manager_name: Optional[str] = None
    recruiter_name: Optional[str] = None
    applicants_count: Optional[int] = 0

    class Config:
        from_attributes = True

class JobPostingList(BaseModel):
    items: List[JobPostingResponse]
    total: int
    page: int
    page_size: int
    pages: int

# ============================================
# CANDIDATE SCHEMAS
# ============================================

class CandidateBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    current_company: Optional[str] = None
    current_position: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    expected_salary: Optional[float] = None
    salary_currency: Optional[str] = "XOF"
    notice_period: Optional[str] = None
    available_from: Optional[date] = None
    source: Optional[str] = "Autre"
    source_details: Optional[str] = None
    referrer_employee_id: Optional[int] = None
    cover_letter: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class CandidateCreate(CandidateBase):
    job_posting_id: Optional[int] = None

class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    current_company: Optional[str] = None
    current_position: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    expected_salary: Optional[float] = None
    salary_currency: Optional[str] = None
    notice_period: Optional[str] = None
    available_from: Optional[date] = None
    source: Optional[str] = None
    source_details: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class AIScoreDetail(BaseModel):
    category: str
    score: int

class CandidateResponse(CandidateBase):
    id: int
    cv_filename: Optional[str] = None
    cv_url: Optional[str] = None
    ai_score: Optional[int] = None
    ai_score_details: Optional[List[AIScoreDetail]] = None
    ai_analysis: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tenant_id: int
    full_name: Optional[str] = None

    class Config:
        from_attributes = True

class CandidateList(BaseModel):
    items: List[CandidateResponse]
    total: int
    page: int
    page_size: int
    pages: int

# ============================================
# APPLICATION SCHEMAS
# ============================================

class ApplicationCreate(BaseModel):
    candidate_id: int
    job_posting_id: int

class ApplicationUpdate(BaseModel):
    stage: Optional[str] = None
    recruiter_rating: Optional[int] = Field(None, ge=1, le=5)
    hiring_manager_rating: Optional[int] = Field(None, ge=1, le=5)
    rejection_reason: Optional[str] = None
    offer_salary: Optional[float] = None

class ApplicationStageUpdate(BaseModel):
    stage: str
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None

class TimelineEventResponse(BaseModel):
    id: int
    event_type: str
    event_title: str
    event_description: Optional[str] = None
    performed_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ApplicationResponse(BaseModel):
    id: int
    candidate_id: int
    job_posting_id: int
    stage: str
    match_score: Optional[int] = None
    recruiter_rating: Optional[int] = None
    hiring_manager_rating: Optional[int] = None
    rejection_reason: Optional[str] = None
    offer_salary: Optional[float] = None
    offer_sent_at: Optional[datetime] = None
    offer_response: Optional[str] = None
    offer_response_at: Optional[datetime] = None
    applied_at: datetime
    updated_at: datetime
    hired_at: Optional[datetime] = None
    tenant_id: int
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    candidate_location: Optional[str] = None
    candidate_skills: Optional[List[str]] = None
    candidate_experience: Optional[str] = None
    candidate_education: Optional[str] = None
    candidate_ai_score: Optional[int] = None
    candidate_ai_score_details: Optional[List[AIScoreDetail]] = None
    candidate_source: Optional[str] = None
    candidate_current_company: Optional[str] = None
    candidate_expected_salary: Optional[float] = None
    salary_currency: str = "XOF"
    candidate_notice_period: Optional[str] = None
    candidate_linkedin_url: Optional[str] = None
    candidate_cv_url: Optional[str] = None
    candidate_cv_filename: Optional[str] = None
    job_title: Optional[str] = None
    timeline: Optional[List[TimelineEventResponse]] = None

    class Config:
        from_attributes = True

class ApplicationList(BaseModel):
    items: List[ApplicationResponse]
    total: int
    page: int
    page_size: int
    pages: int

# ============================================
# INTERVIEW SCHEMAS
# ============================================

class InterviewBase(BaseModel):
    application_id: int
    interview_type: Optional[str] = "video"
    scheduled_at: datetime
    duration_minutes: Optional[int] = 60
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    interviewer_ids: Optional[List[int]] = None
    interview_notes: Optional[str] = None

class InterviewCreate(InterviewBase):
    pass

class InterviewUpdate(BaseModel):
    interview_type: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    interviewer_ids: Optional[List[int]] = None
    feedback: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    recommendation: Optional[str] = None
    interview_notes: Optional[str] = None
    candidate_feedback: Optional[str] = None

class InterviewResponse(InterviewBase):
    id: int
    status: str
    feedback: Optional[str] = None
    rating: Optional[int] = None
    recommendation: Optional[str] = None
    candidate_feedback: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    tenant_id: int
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    interviewer_names: Optional[List[str]] = None

    class Config:
        from_attributes = True

class InterviewList(BaseModel):
    items: List[InterviewResponse]
    total: int
    page: int
    page_size: int
    pages: int

# ============================================
# STATS SCHEMAS
# ============================================

class RecruitmentStats(BaseModel):
    open_positions: int
    total_candidates: int
    in_interview: int
    avg_time_to_hire: int
    hires_this_month: int
    hires_this_year: int

class PipelineStats(BaseModel):
    stage: str
    stage_label: str
    count: int
    color: str

class SourceStats(BaseModel):
    source: str
    count: int
    percentage: float
    color: str

class HiringTrend(BaseModel):
    month: str
    applications: int
    hires: int

class DepartmentStats(BaseModel):
    department: str
    count: int

class TopCandidate(BaseModel):
    id: int
    name: str
    position: str
    ai_score: int
    stage: str

class RecruitmentAnalytics(BaseModel):
    stats: RecruitmentStats
    pipeline: List[PipelineStats]
    sources: List[SourceStats]
    hiring_trend: List[HiringTrend]
    by_department: List[DepartmentStats]
    top_candidates: List[TopCandidate]

# ============================================
# OTHER SCHEMAS
# ============================================

class SendOfferRequest(BaseModel):
    salary: float
    currency: Optional[str] = "XOF"
    start_date: Optional[date] = None
    notes: Optional[str] = None

class OfferResponseRequest(BaseModel):
    response: str
    notes: Optional[str] = None
