# app/models/learning.py
"""
Modèles pour le module Formation & Développement
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, Numeric, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


# ============================================
# COURSES (Catalogue des formations)
# ============================================

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    provider = Column(String(255))
    external_url = Column(String(500))
    duration_hours = Column(Numeric(5, 1))
    level = Column(String(20), default="beginner")
    image_emoji = Column(String(10), default="📚")
    is_mandatory = Column(Boolean, default=False)
    requires_certificate = Column(Boolean, default=False)  # NOUVEAU: Certificat requis pour validation
    is_active = Column(Boolean, default=True)

    provider_id = Column(Integer, ForeignKey("training_providers.id", ondelete="SET NULL"), nullable=True)

    # Plan de formation — coût et facturation
    unit_cost = Column(Numeric(15, 2), nullable=True)
    billing_mode = Column(String(20), nullable=True)  # per_participant, per_session, forfait

    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    assignments = relationship("CourseAssignment", back_populates="course", cascade="all, delete-orphan")
    path_courses = relationship("LearningPathCourse", back_populates="course", cascade="all, delete-orphan")
    course_skills = relationship("CourseSkill", back_populates="course", cascade="all, delete-orphan")


# ============================================
# LEARNING PATHS (Parcours de formation)
# ============================================

class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    is_active = Column(Boolean, default=True)
    
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    path_courses = relationship("LearningPathCourse", back_populates="learning_path", cascade="all, delete-orphan", order_by="LearningPathCourse.order_index")


class LearningPathCourse(Base):
    __tablename__ = "learning_path_courses"

    id = Column(Integer, primary_key=True, index=True)
    learning_path_id = Column(Integer, ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0)

    # Relations
    learning_path = relationship("LearningPath", back_populates="path_courses")
    course = relationship("Course", back_populates="path_courses")


# ============================================
# COURSE ASSIGNMENTS (Assignations)
# ============================================

class CourseAssignment(Base):
    __tablename__ = "course_assignments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    learning_path_id = Column(Integer, ForeignKey("learning_paths.id", ondelete="SET NULL"), nullable=True)
    
    # Assignation
    assigned_by_id = Column(Integer, ForeignKey("users.id"))
    assigned_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    deadline = Column(Date, nullable=True)
    
    # Statut: assigned -> in_progress -> pending_validation -> completed/rejected
    status = Column(String(30), default="assigned")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completion_note = Column(Text)
    
    # Justificatif
    certificate_file = Column(String(500))
    certificate_filename = Column(String(255))
    
    # Validation
    validated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id])
    course = relationship("Course", back_populates="assignments")
    learning_path = relationship("LearningPath")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    validated_by = relationship("User", foreign_keys=[validated_by_id])


# ============================================
# CERTIFICATION TYPES
# ============================================

class CertificationType(Base):
    __tablename__ = "certification_types"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    provider = Column(String(255))
    description = Column(Text)
    validity_months = Column(Integer, nullable=True)  # NULL = permanent
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee_certifications = relationship("EmployeeCertification", back_populates="certification_type", cascade="all, delete-orphan")


# ============================================
# EMPLOYEE CERTIFICATIONS
# ============================================

class EmployeeCertification(Base):
    __tablename__ = "employee_certifications"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    certification_type_id = Column(Integer, ForeignKey("certification_types.id", ondelete="CASCADE"), nullable=False)
    
    obtained_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    
    certificate_file = Column(String(500))
    certificate_filename = Column(String(255))
    credential_id = Column(String(255))
    credential_url = Column(String(500))
    
    status = Column(String(20), default="valid")  # valid, expiring_soon, expired
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee = relationship("Employee")
    certification_type = relationship("CertificationType", back_populates="employee_certifications")


# ============================================
# SKILLS (Référentiel des compétences)
# ============================================

class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    description = Column(Text)
    is_active = Column(Boolean, default=True)

    # ── Hiérarchie & classification ────────────────────────────────────────
    # skill_type: soft_skill | technical | management
    skill_type = Column(String(30), default='soft_skill')
    # hierarchy_level: stagiaire | assistant | manager | senior_manager | executive | top_executive
    hierarchy_level = Column(String(50), nullable=True)
    # department: operations | finance | rh | admin | it | commercial | direction | all
    department = Column(String(100), nullable=True)
    # is_global: compétence transversale (tous niveaux/départements)
    is_global = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee_skills = relationship("EmployeeSkill", back_populates="skill", cascade="all, delete-orphan")
    course_skills = relationship("CourseSkill", back_populates="skill", cascade="all, delete-orphan")


# ============================================
# EMPLOYEE SKILLS (Compétences des employés)
# ============================================

class EmployeeSkill(Base):
    __tablename__ = "employee_skills"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    
    current_level = Column(Integer, default=0)  # 0-100 (score global)
    target_level = Column(Integer, nullable=True)  # 0-100

    # ── Scores composants (calculés automatiquement) ──────────────────────
    formations_score = Column(Integer, default=0)   # % formations requises complétées
    performance_score = Column(Integer, default=0)  # score performance normalisé 0-100
    attitude_score = Column(Integer, default=0)     # score attitude normalisé 0-100
    notes = Column(Text, nullable=True)
    last_computed_at = Column(DateTime(timezone=True), nullable=True)

    assessed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assessed_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id])
    skill = relationship("Skill", back_populates="employee_skills")
    assessed_by = relationship("User", foreign_keys=[assessed_by_id])


# ============================================
# COURSE SKILLS (Liaison Formation ↔ Compétence)
# ============================================

class CourseSkill(Base):
    __tablename__ = "course_skills"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)

    # Relations
    course = relationship("Course", back_populates="course_skills")
    skill = relationship("Skill", back_populates="course_skills")


# ============================================
# DEVELOPMENT PLANS
# ============================================

class DevelopmentPlan(Base):
    __tablename__ = "development_plans"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(255))
    employee_current_role = Column(String(255))
    target_role = Column(String(255))
    target_date = Column(Date, nullable=True)
    
    status = Column(String(20), default="draft")  # draft, active, completed, cancelled
    progress = Column(Integer, default=0)  # 0-100
    
    notes = Column(Text)
    
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    plan_skills = relationship("DevelopmentPlanSkill", back_populates="plan", cascade="all, delete-orphan")
    plan_courses = relationship("DevelopmentPlanCourse", back_populates="plan", cascade="all, delete-orphan", order_by="DevelopmentPlanCourse.order_index")


class DevelopmentPlanSkill(Base):
    __tablename__ = "development_plan_skills"

    id = Column(Integer, primary_key=True, index=True)
    development_plan_id = Column(Integer, ForeignKey("development_plans.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    current_level = Column(Integer, default=0)
    target_level = Column(Integer, default=100)

    # Relations
    plan = relationship("DevelopmentPlan", back_populates="plan_skills")
    skill = relationship("Skill")


class DevelopmentPlanCourse(Base):
    __tablename__ = "development_plan_courses"

    id = Column(Integer, primary_key=True, index=True)
    development_plan_id = Column(Integer, ForeignKey("development_plans.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="planned")  # planned, in_progress, completed
    order_index = Column(Integer, default=0)

    # Relations
    plan = relationship("DevelopmentPlan", back_populates="plan_courses")
    course = relationship("Course")


# ============================================
# COURSE REQUESTS (Demandes de formation)
# ============================================

class CourseRequest(Base):
    __tablename__ = "course_requests"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    requested_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    title = Column(String(255), nullable=False)
    description = Column(Text)
    reason = Column(Text)
    external_url = Column(String(500))
    provider = Column(String(255))
    
    for_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    status = Column(String(20), default="pending")  # pending, approved, rejected
    
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_comment = Column(Text)
    
    created_course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    for_employee = relationship("Employee", foreign_keys=[for_employee_id])
    created_course = relationship("Course")