# app/models/sanction.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class SanctionType(str, enum.Enum):
    AVERTISSEMENT = "Avertissement"
    BLAME = "Blâme"
    MISE_A_PIED = "Mise à pied"
    RETROGRADATION = "Rétrogradation"
    LICENCIEMENT = "Licenciement"
    RAPPEL_A_ORDRE = "Rappel à l'ordre"
    AUTRE = "Autre"


class SanctionStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"      # Annulée avant notification


class Sanction(Base):
    """
    Sanction disciplinaire d'un employé.
    - Pas de modification après création (valeur juridique)
    - Suppression uniquement par RH avant notification
    """
    __tablename__ = "sanctions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Employé sanctionné
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)

    # Détails de la sanction
    type = Column(String(50), nullable=False)  # Valeur libre (correspond aux types frontend)
    date = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active")

    # Traçabilité
    issued_by_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id], backref="sanctions")
    issued_by = relationship("Employee", foreign_keys=[issued_by_id])

    def __repr__(self):
        return f"<Sanction {self.type} → emp {self.employee_id} ({self.date})>"
