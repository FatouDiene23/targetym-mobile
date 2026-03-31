# app/models/training_plan_actions.py
"""
Modèle Actions du Plan de Formation
"""

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TargetType(str, enum.Enum):
    INDIVIDUAL = "individual"
    JOB = "job"
    LEVEL = "level"
    DEPARTMENT = "department"
    GROUP = "group"


class Modality(str, enum.Enum):
    PRESENTIEL = "presentiel"
    DISTANCIEL = "distanciel"
    BLENDED = "blended"
    ELEARNING = "elearning"


class BillingMode(str, enum.Enum):
    PER_PARTICIPANT = "per_participant"
    PER_SESSION = "per_session"
    FORFAIT = "forfait"


class TrainingPlanAction(Base):
    __tablename__ = "training_plan_actions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(255), nullable=True)  # si pas de course lié
    target_type = Column(
        Enum(TargetType, values_callable=lambda e: [m.value for m in e]),
        default=TargetType.INDIVIDUAL, nullable=False
    )
    target_id = Column(Integer, nullable=True)

    is_mandatory = Column(Boolean, default=False)  # héritage groupe
    modality = Column(
        Enum(Modality, values_callable=lambda e: [m.value for m in e]),
        default=Modality.PRESENTIEL, nullable=False
    )

    provider_id = Column(Integer, ForeignKey("training_providers.id", ondelete="SET NULL"), nullable=True)
    unit_cost = Column(Numeric(15, 2), nullable=True)
    billing_mode = Column(
        Enum(BillingMode, values_callable=lambda e: [m.value for m in e]),
        nullable=True
    )
    max_participants = Column(Integer, nullable=True)

    objective_id = Column(Integer, ForeignKey("training_plan_objectives.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    plan = relationship("TrainingPlan", back_populates="actions")
    objective = relationship("TrainingPlanObjective", foreign_keys=[objective_id])
    course = relationship("Course", foreign_keys=[course_id])
    provider = relationship("TrainingProvider", foreign_keys=[provider_id])
    schedules = relationship("TrainingSchedule", back_populates="action", cascade="all, delete-orphan")
