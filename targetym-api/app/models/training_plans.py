# app/models/training_plans.py
"""
Modèle Plan de Formation
"""

import enum
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Numeric, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class PlanLevel(str, enum.Enum):
    GROUP = "group"
    SUBSIDIARY = "subsidiary"
    LOCAL = "local"


class PlanStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    CLOSED = "closed"


class ObjectiveType(str, enum.Enum):
    OKR = "okr"
    EXCELLENCE_OPERATIONNELLE = "excellence_operationnelle"
    DEVELOPPEMENT_COMPETENCES = "developpement_competences"
    CONFORMITE_REGLEMENTAIRE = "conformite_reglementaire"
    MANAGERIAL = "managerial"
    AUTRE = "autre"


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    parent_plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    year = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    plan_level = Column(
        Enum(PlanLevel, values_callable=lambda e: [m.value for m in e]),
        default=PlanLevel.LOCAL, nullable=False
    )
    status = Column(
        Enum(PlanStatus, values_callable=lambda e: [m.value for m in e]),
        default=PlanStatus.DRAFT, nullable=False
    )

    budget_ceiling = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(10), default="XOF")

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    parent_plan = relationship("TrainingPlan", remote_side=[id], foreign_keys=[parent_plan_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    needs = relationship("TrainingNeed", back_populates="plan", cascade="all, delete-orphan")
    actions = relationship("TrainingPlanAction", back_populates="plan", cascade="all, delete-orphan")
    schedules = relationship("TrainingSchedule", back_populates="plan", cascade="all, delete-orphan")
    objectives = relationship("TrainingPlanObjective", back_populates="plan", cascade="all, delete-orphan")
    targets = relationship("TrainingPlanTarget", back_populates="plan", cascade="all, delete-orphan")


class TrainingPlanObjective(Base):
    __tablename__ = "training_plan_objectives"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False)
    okr_id = Column(Integer, ForeignKey("objectives.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(255), nullable=False)
    objective_type = Column(
        Enum(ObjectiveType, values_callable=lambda e: [m.value for m in e]),
        default=ObjectiveType.AUTRE, nullable=False
    )
    description = Column(Text, nullable=True)
    progress_pct = Column(Numeric(5, 2), default=0, nullable=False)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    plan = relationship("TrainingPlan", back_populates="objectives")
    okr = relationship("Objective", foreign_keys=[okr_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class TrainingPlanTarget(Base):
    __tablename__ = "training_plan_targets"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False)

    target_type = Column(String(20), nullable=False)  # 'department', 'profile', 'level'
    target_id = Column(Integer, nullable=True)  # id département si target_type='department'
    target_label = Column(String(255), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    plan = relationship("TrainingPlan", back_populates="targets")
