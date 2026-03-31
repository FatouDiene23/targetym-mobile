# =============================================
# MODÈLE: Évaluation Post-Formation (EPF)
# File: app/models/post_training_evaluation.py
# =============================================

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, CheckConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class PostTrainingEvalSettings(Base):
    """Configuration EPF par tenant"""
    __tablename__ = "post_training_eval_settings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Déclenchement
    trigger_delay_days = Column(Integer, default=0)           # 0 = immédiat, 7 = J+7
    default_evaluator_type = Column(String(20), default="internal")  # 'trainer' | 'internal'

    # Seuil
    passing_threshold = Column(Integer, default=70)           # Score min /100
    auto_retrain = Column(Boolean, default=True)

    # Questionnaire par défaut
    default_criteria = Column(JSONB, default=[
        {"code": "maitrise_theorique", "label": "Maîtrise théorique", "weight": 25},
        {"code": "application_pratique", "label": "Application pratique", "weight": 25},
        {"code": "participation", "label": "Participation & engagement", "weight": 25},
        {"code": "comprehension_globale", "label": "Compréhension globale", "weight": 25}
    ])

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class PostTrainingEvaluation(Base):
    """Évaluation post-formation"""
    __tablename__ = "post_training_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    # Lien formation
    assignment_id = Column(Integer, ForeignKey("course_assignments.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)

    # Évaluateur
    evaluator_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    evaluator_type = Column(String(20), default="internal")

    # Planification
    scheduled_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)

    # Statut
    status = Column(String(20), default="pending")
    # CheckConstraint ajouté via migration SQL

    # Résultats
    score = Column(Numeric(5, 1), nullable=True)
    criteria_scores = Column(JSONB, nullable=True)
    comments = Column(Text, nullable=True)
    strengths = Column(Text, nullable=True)
    improvements = Column(Text, nullable=True)

    # Résultat
    competency_validated = Column(Boolean, default=False)
    recommendation = Column(String(30), default="pending")
    recommendation_details = Column(Text, nullable=True)

    # Re-formation
    retrain_course_id = Column(Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    retrain_assignment_id = Column(Integer, ForeignKey("course_assignments.id", ondelete="SET NULL"), nullable=True)

    # Sync Carrière
    career_synced = Column(Boolean, default=False)
    career_synced_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id])
    evaluator = relationship("Employee", foreign_keys=[evaluator_id])
    course = relationship("Course", foreign_keys=[course_id])
    assignment = relationship("CourseAssignment", foreign_keys=[assignment_id])
    retrain_course = relationship("Course", foreign_keys=[retrain_course_id])
