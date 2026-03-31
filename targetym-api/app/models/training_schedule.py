# app/models/training_schedule.py
"""
Modèle Planification des Sessions de Formation
"""

import enum
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Quarter(str, enum.Enum):
    T1 = "T1"
    T2 = "T2"
    T3 = "T3"
    T4 = "T4"


class ScheduleStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TrainingSchedule(Base):
    __tablename__ = "training_schedule"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False)
    action_id = Column(Integer, ForeignKey("training_plan_actions.id", ondelete="CASCADE"), nullable=False)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    quarter = Column(
        Enum(Quarter, values_callable=lambda e: [m.value for m in e]),
        nullable=True
    )
    status = Column(
        Enum(ScheduleStatus, values_callable=lambda e: [m.value for m in e]),
        default=ScheduleStatus.PLANNED, nullable=False
    )

    location = Column(String(255), nullable=True)
    trainer_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    external_trainer = Column(String(255), nullable=True)
    max_participants = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    plan = relationship("TrainingPlan", back_populates="schedules")
    action = relationship("TrainingPlanAction", back_populates="schedules")
    trainer = relationship("Employee", foreign_keys=[trainer_id])
    assignments = relationship("TrainingAssignment", back_populates="schedule", cascade="all, delete-orphan")
