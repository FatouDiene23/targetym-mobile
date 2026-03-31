# app/models/training_needs.py
"""
Modèle Besoins de Formation
"""

import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class NeedPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class NeedStatus(str, enum.Enum):
    IDENTIFIED = "identified"
    PLANNED = "planned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TrainingNeed(Base):
    __tablename__ = "training_needs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)

    source = Column(ARRAY(String), nullable=True)  # ['OKR', 'Performance', 'Obligatoire', 'Manager', 'Employee']
    skill_target = Column(String(255), nullable=True)
    priority = Column(
        Enum(NeedPriority, values_callable=lambda e: [m.value for m in e]),
        default=NeedPriority.MEDIUM, nullable=False
    )
    year = Column(Integer, nullable=True)
    status = Column(
        Enum(NeedStatus, values_callable=lambda e: [m.value for m in e]),
        default=NeedStatus.IDENTIFIED, nullable=False
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    plan = relationship("TrainingPlan", back_populates="needs")
    employee = relationship("Employee", foreign_keys=[employee_id])
