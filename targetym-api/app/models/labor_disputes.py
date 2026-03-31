"""
Modèles SQLAlchemy — Module Contentieux & Précontentieux
Tables : labor_disputes, dispute_stages_history, dispute_audiences,
         dispute_documents, dispute_notifications_config
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Text,
    ForeignKey, Enum, ARRAY
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


# ============================================
# ENUMS
# ============================================

class DisputeStage(str, enum.Enum):
    CONVOCATION_IT = "convocation_it"
    ENTRETIEN_IT = "entretien_it"
    CONCILIATION = "conciliation"
    ACCORD_AMIABLE = "accord_amiable"
    CONTENTIEUX = "contentieux"
    AUDIENCE = "audience"
    JUGEMENT = "jugement"
    CLOTURE = "cloture"


class DisputeStatus(str, enum.Enum):
    OUVERT = "ouvert"
    EN_COURS = "en_cours"
    SUSPENDU = "suspendu"
    CLOS_ACCORD = "clos_accord"
    CLOS_JUGEMENT = "clos_jugement"
    CLOS_ABANDON = "clos_abandon"


class AudienceType(str, enum.Enum):
    PLAIDOIRIE = "plaidoirie"
    RENVOI = "renvoi"
    DELIBERE = "delibere"
    JUGEMENT = "jugement"


class ConciliationResult(str, enum.Enum):
    REUSSIE = "reussie"
    ECHOUEE = "echouee"
    EN_ATTENTE = "en_attente"


# ============================================
# TABLE: labor_disputes (dossiers contentieux)
# ============================================

class LaborDispute(Base):
    """Dossier contentieux / précontentieux"""
    __tablename__ = "labor_disputes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    reference_number = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    current_stage = Column(
        Enum(DisputeStage, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=DisputeStage.CONVOCATION_IT,
    )
    status = Column(
        Enum(DisputeStatus, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=DisputeStatus.OUVERT,
    )
    opened_date = Column(Date, nullable=False)
    closed_date = Column(Date, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("employees.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="labor_disputes")
    assigned_to = relationship("Employee", foreign_keys=[assigned_to_id], back_populates="assigned_disputes")
    created_by = relationship("User", foreign_keys=[created_by_id])
    stages_history = relationship("DisputeStageHistory", back_populates="dispute", cascade="all, delete-orphan")
    audiences = relationship("DisputeAudience", back_populates="dispute", cascade="all, delete-orphan")
    documents = relationship("DisputeDocument", back_populates="dispute", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<LaborDispute {self.reference_number} — {self.title}>"


# ============================================
# TABLE: dispute_stages_history
# ============================================

class DisputeStageHistory(Base):
    """Historique des étapes d'un dossier contentieux"""
    __tablename__ = "dispute_stages_history"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    dispute_id = Column(Integer, ForeignKey("labor_disputes.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(
        Enum(DisputeStage, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    dispute = relationship("LaborDispute", back_populates="stages_history")
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self):
        return f"<DisputeStageHistory dispute={self.dispute_id} stage={self.stage}>"


# ============================================
# TABLE: dispute_audiences
# ============================================

class DisputeAudience(Base):
    """Audience liée à un dossier contentieux"""
    __tablename__ = "dispute_audiences"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    dispute_id = Column(Integer, ForeignKey("labor_disputes.id", ondelete="CASCADE"), nullable=False, index=True)
    audience_date = Column(DateTime(timezone=True), nullable=False)
    audience_type = Column(
        Enum(AudienceType, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    next_audience_date = Column(Date, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    dispute = relationship("LaborDispute", back_populates="audiences")
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self):
        return f"<DisputeAudience dispute={self.dispute_id} date={self.audience_date}>"


# ============================================
# TABLE: dispute_documents (pièces jointes S3)
# ============================================

class DisputeDocument(Base):
    """Document/pièce jointe S3 d'un dossier contentieux"""
    __tablename__ = "dispute_documents"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    dispute_id = Column(Integer, ForeignKey("labor_disputes.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    s3_key = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    dispute = relationship("LaborDispute", back_populates="documents")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])

    def __repr__(self):
        return f"<DisputeDocument {self.filename}>"


# ============================================
# TABLE: dispute_notifications_config
# ============================================

class DisputeNotificationsConfig(Base):
    """Configuration des rappels de dossiers contentieux (1 par tenant)"""
    __tablename__ = "dispute_notifications_config"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    reminder_days_before = Column(ARRAY(Integer), nullable=False, server_default="{7,1}")
    notify_rh = Column(Boolean, nullable=False, default=True, server_default="true")
    notify_juriste = Column(Boolean, nullable=False, default=True, server_default="true")
    notify_dg = Column(Boolean, nullable=False, default=True, server_default="true")
    notify_manager = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<DisputeNotificationsConfig tenant={self.tenant_id}>"
