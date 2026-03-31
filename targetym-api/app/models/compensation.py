"""
Module Compensation & Benefits — Modèles SQLAlchemy
8 tables : cb_ipe_criteria, cb_job_evaluations, cb_collective_agreements,
cb_cc_categories, cb_salary_grids, cb_simulations, cb_simulation_lines, cb_tenant_config
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Text,
    ForeignKey, Numeric, Enum as SAEnum, TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


# ── Enums ────────────────────────────────────────────────────

_values_callable = lambda e: [m.value for m in e]


class IpeCriterion(str, enum.Enum):
    IMPACT = "impact"
    COMMUNICATION = "communication"
    INNOVATION = "innovation"
    KNOWLEDGE = "knowledge"


class CbConformityStatus(str, enum.Enum):
    CONFORME = "conforme"
    A_REVISER = "a_reviser"
    BLOQUANT = "bloquant"
    NON_EVALUE = "non_evalue"


class SimulationStatus(str, enum.Enum):
    BROUILLON = "brouillon"
    SOUMIS = "soumis"
    APPROUVE = "approuve"
    REJETE = "rejete"


class SimulationPolicy(str, enum.Enum):
    UNIFORME = "uniforme"
    ANCIENNETE = "anciennete"
    CATEGORIE = "categorie"


# ── Tables ───────────────────────────────────────────────────

class CbIpeCriteria(Base):
    """Critères IPE configurables (globaux si tenant_id IS NULL)"""
    __tablename__ = "cb_ipe_criteria"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True)
    criterion = Column(
        SAEnum(IpeCriterion, name="ipe_criterion", values_callable=_values_callable),
        nullable=False,
    )
    label = Column(String(255), nullable=False)
    levels = Column(JSONB, nullable=False)
    weight = Column(Numeric(5, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="cb_ipe_criteria")

    def __repr__(self):
        return f"<CbIpeCriteria {self.criterion} tenant={self.tenant_id}>"


class CbJobEvaluation(Base):
    """Pesée IPE par poste"""
    __tablename__ = "cb_job_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    job_id = Column(Integer, nullable=True)
    job_title = Column(String(255), nullable=True)
    job_family = Column(String(100), nullable=True)
    country = Column(String(10), nullable=True)
    scores = Column(JSONB, nullable=False)
    total_score = Column(Integer, nullable=False)
    mercer_band = Column(String(20), nullable=True)
    market_p25 = Column(Numeric(15, 2), nullable=True)
    market_p50 = Column(Numeric(15, 2), nullable=True)
    market_p75 = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(10), nullable=True)
    conformity_status = Column(
        SAEnum(CbConformityStatus, name="cb_conformity_status", values_callable=_values_callable),
        nullable=False,
        default=CbConformityStatus.NON_EVALUE,
    )
    evaluated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="cb_job_evaluations")
    evaluated_by = relationship("User", foreign_keys=[evaluated_by_id])
    salary_grids = relationship("CbSalaryGrid", back_populates="evaluation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CbJobEvaluation {self.job_title or self.job_id} band={self.mercer_band}>"


class CbCollectiveAgreement(Base):
    """Conventions collectives (globales TargetYM si tenant_id IS NULL)"""
    __tablename__ = "cb_collective_agreements"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True)
    country = Column(String(10), nullable=False)
    sector = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=True)
    effective_date = Column(Date, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    source_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="cb_collective_agreements")
    categories = relationship("CbCcCategory", back_populates="agreement", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CbCollectiveAgreement {self.name} ({self.country})>"


class CbCcCategory(Base):
    """Catégories de convention collective"""
    __tablename__ = "cb_cc_categories"

    id = Column(Integer, primary_key=True, index=True)
    agreement_id = Column(Integer, ForeignKey("cb_collective_agreements.id", ondelete="CASCADE"), nullable=False)
    category_code = Column(String(20), nullable=False)
    category_label = Column(String(255), nullable=False)
    min_salary = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), nullable=False)
    mercer_band_min = Column(String(20), nullable=True)
    mercer_band_max = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    agreement = relationship("CbCollectiveAgreement", back_populates="categories")
    salary_grids = relationship("CbSalaryGrid", back_populates="cc_category")

    def __repr__(self):
        return f"<CbCcCategory {self.category_code} — {self.category_label}>"


class CbSalaryGrid(Base):
    """Grilles salariales générées (réconciliation marché × CC)"""
    __tablename__ = "cb_salary_grids"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    evaluation_id = Column(Integer, ForeignKey("cb_job_evaluations.id", ondelete="CASCADE"), nullable=False)
    cc_category_id = Column(Integer, ForeignKey("cb_cc_categories.id", ondelete="SET NULL"), nullable=True)
    country = Column(String(10), nullable=False)
    currency = Column(String(10), nullable=False)
    min_salary = Column(Numeric(15, 2), nullable=False)
    mid_salary = Column(Numeric(15, 2), nullable=False)
    max_salary = Column(Numeric(15, 2), nullable=False)
    cc_minimum = Column(Numeric(15, 2), nullable=True)
    conformity_status = Column(
        SAEnum(CbConformityStatus, name="cb_conformity_status", values_callable=_values_callable, create_type=False),
        nullable=False,
    )
    reconciliation_notes = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="cb_salary_grids")
    evaluation = relationship("CbJobEvaluation", back_populates="salary_grids")
    cc_category = relationship("CbCcCategory", back_populates="salary_grids")
    generated_by = relationship("User", foreign_keys=[generated_by_id])

    def __repr__(self):
        return f"<CbSalaryGrid eval={self.evaluation_id} {self.min_salary}-{self.max_salary} {self.currency}>"


class CbSimulation(Base):
    """Simulations de révision salariale"""
    __tablename__ = "cb_simulations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    budget_type = Column(String(20), nullable=False)
    budget_value = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), nullable=False)
    policy = Column(
        SAEnum(SimulationPolicy, name="simulation_policy", values_callable=_values_callable),
        nullable=False,
        default=SimulationPolicy.UNIFORME,
    )
    scope_type = Column(String(20), nullable=False, default="all")
    scope_id = Column(Integer, nullable=True)
    status = Column(
        SAEnum(SimulationStatus, name="simulation_status", values_callable=_values_callable),
        nullable=False,
        default=SimulationStatus.BROUILLON,
    )
    year = Column(Integer, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="cb_simulations")
    created_by = relationship("User", foreign_keys=[created_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    lines = relationship("CbSimulationLine", back_populates="simulation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CbSimulation {self.title} ({self.status})>"


class CbSimulationLine(Base):
    """Lignes de simulation (une par employé)"""
    __tablename__ = "cb_simulation_lines"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    simulation_id = Column(Integer, ForeignKey("cb_simulations.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    current_salary = Column(Numeric(15, 2), nullable=False)
    proposed_increase_pct = Column(Numeric(5, 2), nullable=False)
    proposed_salary = Column(Numeric(15, 2), nullable=False)
    cc_minimum = Column(Numeric(15, 2), nullable=True)
    conformity_status = Column(
        SAEnum(CbConformityStatus, name="cb_conformity_status", values_callable=_values_callable, create_type=False),
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant", back_populates="cb_simulation_lines")
    simulation = relationship("CbSimulation", back_populates="lines")
    employee = relationship("Employee", foreign_keys=[employee_id])

    def __repr__(self):
        return f"<CbSimulationLine emp={self.employee_id} {self.current_salary}→{self.proposed_salary}>"


class CbTenantConfig(Base):
    """Configuration C&B par tenant"""
    __tablename__ = "cb_tenant_config"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    default_currency = Column(String(10), nullable=False, default="XOF")
    default_country = Column(String(10), nullable=True)
    active_agreement_ids = Column(ARRAY(Integer), nullable=True)
    reminder_days_before_cc_update = Column(Integer, nullable=False, default=30)
    workflow_approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="cb_tenant_config")
    workflow_approver = relationship("User", foreign_keys=[workflow_approver_id])

    def __repr__(self):
        return f"<CbTenantConfig tenant={self.tenant_id} currency={self.default_currency}>"
