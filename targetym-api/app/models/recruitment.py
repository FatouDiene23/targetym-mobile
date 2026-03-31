# ============================================
# app/models/recruitment.py
# ============================================

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean, JSON, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
# ============================================
# MODELS
# ============================================

class JobPosting(Base):
    """Offres d'emploi"""
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Infos principales
    title = Column(String(200), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    location = Column(String(100), nullable=False)
    remote_policy = Column(String(50), default="onsite")
    contract_type = Column(String(20), default="CDI")
    
    # Description
    description = Column(Text, nullable=True)
    responsibilities = Column(Text, nullable=True)
    requirements = Column(JSON, nullable=True)
    nice_to_have = Column(JSON, nullable=True)
    benefits = Column(JSON, nullable=True)
    
    # Salaire
    salary_min = Column(Numeric(12, 2), nullable=True)
    salary_max = Column(Numeric(12, 2), nullable=True)
    salary_currency = Column(String(3), default="XOF")
    show_salary = Column(Boolean, default=False)
    
    # Visibilité : "internal" ou "internal_external"
    visibility = Column(String(20), default="internal")

    # Méta
    status = Column(String(20), default="draft")
    urgency = Column(String(20), default="medium")
    hiring_manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    recruiter_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    # Dates
    posted_at = Column(DateTime(timezone=True), nullable=True)
    deadline = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    # Relations
    department = relationship("Department", foreign_keys=[department_id])
    hiring_manager = relationship("Employee", foreign_keys=[hiring_manager_id])
    recruiter = relationship("Employee", foreign_keys=[recruiter_id])
    applications = relationship("CandidateApplication", back_populates="job_posting")


class Candidate(Base):
    """Candidats"""
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    
    # Infos personnelles
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    location = Column(String(200), nullable=True)
    
    # Liens
    linkedin_url = Column(String(255), nullable=True)
    portfolio_url = Column(String(255), nullable=True)
    
    # CV & Documents
    cv_filename = Column(String(255), nullable=True)
    cv_url = Column(String(500), nullable=True)
    cover_letter = Column(Text, nullable=True)
    
    # Profil
    current_company = Column(String(200), nullable=True)
    current_position = Column(String(200), nullable=True)
    experience_years = Column(Integer, nullable=True)
    education = Column(String(300), nullable=True)
    skills = Column(JSON, nullable=True)
    languages = Column(JSON, nullable=True)
    
    # Attentes
    expected_salary = Column(Numeric(12, 2), nullable=True)
    salary_currency = Column(String(3), default="XOF")
    notice_period = Column(String(50), nullable=True)
    available_from = Column(Date, nullable=True)
    
    # Source
    source = Column(String(50), default="Autre")
    source_details = Column(String(255), nullable=True)
    referrer_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    # IA Scoring
    ai_score = Column(Integer, nullable=True)
    ai_score_details = Column(JSON, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    
    # Dates
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    # Relations
    referrer = relationship("Employee", foreign_keys=[referrer_employee_id])
    applications = relationship("CandidateApplication", back_populates="candidate")


class CandidateApplication(Base):
    """Candidatures (lie candidat à une offre)"""
    __tablename__ = "candidate_applications"

    id = Column(Integer, primary_key=True, index=True)
    
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_posting_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    
    # Stage dans le pipeline
    stage = Column(String(30), default="new")

    # Lien avec IntoWork (pour synchronisation bidirectionnelle)
    intowork_application_id = Column(Integer, nullable=True, index=True)
    
    # Scoring spécifique à cette candidature
    match_score = Column(Integer, nullable=True)
    
    # Feedback
    recruiter_rating = Column(Integer, nullable=True)
    hiring_manager_rating = Column(Integer, nullable=True)
    rejection_reason = Column(String(255), nullable=True)
    
    # Offre
    offer_salary = Column(Numeric(12, 2), nullable=True)
    offer_sent_at = Column(DateTime(timezone=True), nullable=True)
    offer_response = Column(String(50), nullable=True)
    offer_response_at = Column(DateTime(timezone=True), nullable=True)
    
    # Dates
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    hired_at = Column(DateTime(timezone=True), nullable=True)
    
    # Tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    # Relations
    candidate = relationship("Candidate", back_populates="applications")
    job_posting = relationship("JobPosting", back_populates="applications")
    interviews = relationship("Interview", back_populates="application")
    timeline_events = relationship("CandidateTimeline", back_populates="application")


class Interview(Base):
    """Entretiens"""
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    
    application_id = Column(Integer, ForeignKey("candidate_applications.id"), nullable=False)
    
    # Type et statut
    interview_type = Column(String(20), default="video")
    status = Column(String(20), default="scheduled")
    
    # Planification
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=60)
    location = Column(String(255), nullable=True)
    meeting_link = Column(String(500), nullable=True)
    
    # Interviewers
    interviewer_ids = Column(JSON, nullable=True)
    
    # Feedback
    feedback = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)
    recommendation = Column(String(50), nullable=True)
    
    # Notes
    interview_notes = Column(Text, nullable=True)
    candidate_feedback = Column(Text, nullable=True)
    
    # Dates
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    # Relations
    application = relationship("CandidateApplication", back_populates="interviews")


class CandidateTimeline(Base):
    """Historique des événements candidat"""
    __tablename__ = "candidate_timeline"

    id = Column(Integer, primary_key=True, index=True)
    
    application_id = Column(Integer, ForeignKey("candidate_applications.id"), nullable=False)
    
    event_type = Column(String(50), nullable=False)
    event_title = Column(String(255), nullable=False)
    event_description = Column(Text, nullable=True)
    
    # Qui a fait l'action
    performed_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    # Données additionnelles
    event_metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    # Relations
    application = relationship("CandidateApplication", back_populates="timeline_events")
    performed_by = relationship("Employee", foreign_keys=[performed_by_id])


class TalentPool(Base):
    """Viviers de talents"""
    __tablename__ = "talent_pools"

    id = Column(Integer, primary_key=True, index=True)
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    auto_criteria = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)


class TalentPoolMember(Base):
    """Membres des viviers de talents"""
    __tablename__ = "talent_pool_members"

    id = Column(Integer, primary_key=True, index=True)
    
    talent_pool_id = Column(Integer, ForeignKey("talent_pools.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    
    added_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
