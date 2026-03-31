# app/models/training_plan_subsidiaries.py
"""
Modèle de liaison Plan de Formation ↔ Filiales
"""

from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TrainingPlanSubsidiary(Base):
    __tablename__ = "training_plan_subsidiaries"
    __table_args__ = (
        UniqueConstraint("plan_id", "subsidiary_tenant_id", name="uq_plan_subsidiary"),
    )

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False)
    subsidiary_tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    is_excluded = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    plan = relationship("TrainingPlan", backref="subsidiaries")
    subsidiary_tenant = relationship("Tenant", foreign_keys=[subsidiary_tenant_id])
