# app/models/training_assignments.py
"""
Modèle Inscriptions / Assignations aux Sessions de Formation
"""

import enum
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AssignmentStatus(str, enum.Enum):
    INVITED = "invited"
    CONFIRMED = "confirmed"
    ATTENDED = "attended"
    ABSENT = "absent"
    CANCELLED = "cancelled"


class TrainingAssignment(Base):
    __tablename__ = "training_assignments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    schedule_id = Column(Integer, ForeignKey("training_schedule.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)

    status = Column(
        Enum(AssignmentStatus, values_callable=lambda e: [m.value for m in e]),
        default=AssignmentStatus.INVITED, nullable=False
    )
    invitation_sent_at = Column(DateTime(timezone=True), nullable=True)
    confirmation_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    schedule = relationship("TrainingSchedule", back_populates="assignments")
    employee = relationship("Employee", foreign_keys=[employee_id])
