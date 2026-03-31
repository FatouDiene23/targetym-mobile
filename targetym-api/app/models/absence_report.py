"""
AbsenceReport model — constats d'absence/retard créés par les managers/RH.
"""

import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    ForeignKey, Enum, func
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class AbsenceType(str, enum.Enum):
    ABSENCE = "absence"
    TARDINESS = "tardiness"         # retard
    EARLY_DEPARTURE = "early_departure"  # départ anticipé
    UNAUTHORIZED_ABSENCE = "unauthorized_absence"  # absence non autorisée
    SICK_LEAVE = "sick_leave"        # arrêt maladie


class AbsenceStatus(str, enum.Enum):
    PENDING = "pending"          # en attente de traitement
    JUSTIFIED = "justified"      # absence justifiée
    UNJUSTIFIED = "unjustified"  # absence injustifiée
    NOTIFIED = "notified"        # employé notifié


class AbsenceReport(Base):
    __tablename__ = "absence_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Employé concerné
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)

    # Type + statut
    type = Column(Enum(AbsenceType), nullable=False, default=AbsenceType.ABSENCE)
    status = Column(Enum(AbsenceStatus), nullable=False, default=AbsenceStatus.PENDING)

    # Date/heure du constat
    absence_date = Column(Date, nullable=False, index=True)
    expected_start_time = Column(String(10), nullable=True)   # ex : "09:00"
    actual_start_time   = Column(String(10), nullable=True)   # ex : "10:45"
    duration_minutes    = Column(Integer, nullable=True)      # retard en minutes

    # Détails
    reason   = Column(Text, nullable=True)    # raison fournie par l'employé
    notes    = Column(Text, nullable=True)    # observations du manager
    document = Column(Text, nullable=True)    # URL justificatif (optionnel)

    # Notification envoyée
    notification_sent = Column(Boolean, default=False)

    # Auteur du constat
    reported_by_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    employee    = relationship("Employee", foreign_keys=[employee_id], lazy="select")
    reported_by = relationship("Employee", foreign_keys=[reported_by_id], lazy="select")
