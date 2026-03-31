# =============================================
# File: app/models/attitude.py
# =============================================

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Attitude(Base):
    """
    Table de référence des attitudes évaluables.
    Configurées par l'admin RH par tenant.
    Les 9 attitudes Hermann:
    patience, disponibilité, anticipation, discipline, respect,
    appui technique, coaching, intelligence émotionnelle, ouverture d'esprit
    """
    __tablename__ = "attitudes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    code = Column(String(50), nullable=False)        # 'patience', 'discipline', etc.
    name = Column(String(100), nullable=False)        # 'Patience', 'Discipline', etc.
    description = Column(Text, nullable=True)
    category = Column(String(50), default='Savoir-être')  # 'Savoir-être', 'Savoir-faire', 'Leadership'
    icon = Column(String(50), default='Star')
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relations
    feedback_attitudes = relationship("FeedbackAttitude", back_populates="attitude", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='uq_attitude_tenant_code'),
        {'schema': None}
    )


class FeedbackAttitude(Base):
    """
    Liaison feedback <-> attitude cochée.
    Chaque feedback peut cocher plusieurs attitudes.
    sentiment = 'recognition' (+1) ou 'improvement' (-1)
    """
    __tablename__ = "feedback_attitudes"

    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(Integer, ForeignKey("feedbacks.id", ondelete="CASCADE"), nullable=False)
    attitude_id = Column(Integer, ForeignKey("attitudes.id"), nullable=False)
    sentiment = Column(String(20), nullable=False)  # 'recognition' ou 'improvement'
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relations
    feedback = relationship("Feedback", backref="feedback_attitudes")
    attitude = relationship("Attitude", back_populates="feedback_attitudes")
    
    __table_args__ = (
        UniqueConstraint('feedback_id', 'attitude_id', name='uq_feedback_attitude'),
        CheckConstraint("sentiment IN ('recognition', 'improvement')", name='ck_sentiment_type'),
        {'schema': None}
    )