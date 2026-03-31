# app/models/sos_alert.py
"""
Modèle SOSAlert — Alerte de détresse émise par un employé.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SOSAlert(Base):
    """Alerte SOS : un employé signale une situation de détresse."""
    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Émetteur (employé qui appuie sur SOS)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)

    # Catégorie de l'alerte
    category = Column(String(50), nullable=False, default="general")
    # Ex : harassment, burnout, conflict, security, health, general

    # Message libre (optionnel — l'employé peut rester anonyme)
    message = Column(Text, nullable=True)
    is_anonymous = Column(Boolean, nullable=False, default=False)

    # Statut de traitement
    status = Column(String(20), nullable=False, default="new")
    # new | acknowledged | in_progress | resolved | closed

    # Traitement par RH / DG
    handled_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    handled_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)

    # Géolocalisation approximative (optionnel)
    location_hint = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    user = relationship("User", foreign_keys=[user_id])
    handled_by = relationship("User", foreign_keys=[handled_by_id])

    def __repr__(self):
        return f"<SOSAlert #{self.id} cat={self.category} status={self.status}>"
