# app/models/benefit.py
"""
Modèle EmployeeBenefit — Avantages accordés aux employés.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Enum, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class BenefitCategory(str, enum.Enum):
    FINANCIER = "financier"      # Prime, bonus, treizième mois
    NATURE = "nature"            # Voiture, logement, téléphone
    SANTE = "sante"              # Assurance maladie, mutuelle
    RETRAITE = "retraite"        # Fonds de retraite, CNSS complémentaire
    FORMATION = "formation"      # Budget formation, certifications
    TRANSPORT = "transport"      # Indemnité transport, véhicule
    REPAS = "repas"              # Tickets restaurant, cantine
    AUTRE = "autre"


class BenefitFrequency(str, enum.Enum):
    MENSUEL = "mensuel"
    TRIMESTRIEL = "trimestriel"
    SEMESTRIEL = "semestriel"
    ANNUEL = "annuel"
    UNIQUE = "unique"            # Versement unique (ex: aide installation)


class BenefitStatus(str, enum.Enum):
    ACTIF = "actif"
    SUSPENDU = "suspendu"
    EXPIRE = "expire"


class EmployeeBenefit(Base):
    """Avantage accordé à un employé."""
    __tablename__ = "employee_benefits"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Employé bénéficiaire
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)

    # Description de l'avantage
    label = Column(String(200), nullable=False)               # Ex : "Prime de transport"
    category = Column(String(50), nullable=False, default=BenefitCategory.AUTRE)

    # Valeur financière (optionnel pour avantages en nature)
    amount = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(10), nullable=False, default="XOF")

    # Périodicité
    frequency = Column(String(50), nullable=False, default=BenefitFrequency.MENSUEL)

    # Période de validité
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)          # NULL = sans fin définie

    # Statut
    status = Column(String(20), nullable=False, default=BenefitStatus.ACTIF)

    # Notes libres
    notes = Column(Text, nullable=True)

    # Traçabilité
    created_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id], backref="benefits")
    created_by = relationship("Employee", foreign_keys=[created_by_id])

    def __repr__(self):
        return f"<EmployeeBenefit {self.label} → emp {self.employee_id} ({self.frequency})>"
