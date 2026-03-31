from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class GroupType(str, enum.Enum):
    standalone = "standalone"   # entreprise normale (défaut)
    group = "group"             # maison mère / groupe
    subsidiary = "subsidiary"   # filiale d'un groupe


class GroupConversionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Tenant(Base):
    """Modèle pour les entreprises clientes (multi-tenant)"""
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    logo_url = Column(String(500), nullable=True)
    
    # Contact
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    
    # Settings
    plan = Column(String(50), default="trial")  # trial, starter, professional, enterprise
    max_employees = Column(Integer, default=10)  # 10 pour l'essai gratuit
    currency = Column(String(10), default="XOF")
    timezone = Column(String(50), default="Africa/Dakar")
    
    # Période d'essai
    is_trial = Column(Boolean, default=True)
    trial_starts_at = Column(DateTime(timezone=True), nullable=True)  # Date d'activation back-office
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)

    # Back-office
    activation_note = Column(Text, nullable=True)   # Note interne lors de l'activation
    block_reason = Column(Text, nullable=True)       # Motif de blocage

    # Security
    require_2fa = Column(Boolean, default=False)

    # Status
    is_active = Column(Boolean, default=False)  # False par défaut → "En attente" jusqu'à activation Back-office

    # Intégration IntoWork
    intowork_company_id = Column(Integer, nullable=True, index=True)  # ID de la Company liée sur IntoWork
    intowork_api_key = Column(String(255), nullable=True)  # Clé API IntoWork (pour Targetym→IntoWork)
    intowork_linked_at = Column(DateTime(timezone=True), nullable=True)  # Date de liaison
    targetym_api_key = Column(String(255), nullable=True, index=True)  # Clé API Targetym (pour IntoWork→Targetym), générée en base

    # Groupe / Filiales
    group_type = Column(SAEnum(GroupType, name="grouptype"), default=GroupType.standalone, nullable=False)
    parent_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    is_group = Column(Boolean, default=False, nullable=False)
    max_subsidiaries = Column(Integer, default=0, nullable=False)  # Quota de filiales autorisées (défini par le SuperAdmin)

    # Relation : liste des filiales (backref = .parent)
    subsidiaries = relationship(
        "Tenant",
        backref=backref("parent", remote_side="Tenant.id"),
        foreign_keys=[parent_tenant_id],
    )
    
    # Modules optionnels
    has_cb_module = Column(Boolean, default=False, server_default='false', nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations C&B
    cb_ipe_criteria = relationship("CbIpeCriteria", back_populates="tenant")
    cb_job_evaluations = relationship("CbJobEvaluation", back_populates="tenant")
    cb_collective_agreements = relationship("CbCollectiveAgreement", back_populates="tenant")
    cb_salary_grids = relationship("CbSalaryGrid", back_populates="tenant")
    cb_simulations = relationship("CbSimulation", back_populates="tenant")
    cb_simulation_lines = relationship("CbSimulationLine", back_populates="tenant")
    cb_tenant_config = relationship("CbTenantConfig", back_populates="tenant", uselist=False)

    def __repr__(self):
        return f"<Tenant {self.name}>"
    
    @property
    def is_trial_expired(self) -> bool:
        """Vérifie si la période d'essai est expirée"""
        if not self.is_trial or not self.trial_ends_at:
            return False
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) > self.trial_ends_at
    
    @property
    def trial_days_remaining(self) -> int:
        """Nombre de jours restants dans l'essai"""
        if not self.is_trial or not self.trial_ends_at:
            return 0
        from datetime import datetime, timezone
        delta = self.trial_ends_at - datetime.now(timezone.utc)
        return max(0, delta.days)


class GroupConversionRequest(Base):
    """Demande d'un tenant admin pour convertir son tenant en groupe"""
    __tablename__ = "group_conversion_requests"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    requested_by_email = Column(String(255), nullable=True)
    reason = Column(Text, nullable=True)
    # Infos commerciales
    nb_subsidiaries = Column(Integer, nullable=True)          # Nombre de filiales souhaitées
    contact_phone = Column(String(50), nullable=True)         # Téléphone de contact
    quote_amount = Column(Integer, nullable=True)             # Montant devis en XOF (calculé auto)
    payment_status = Column(String(20), default='unpaid', nullable=False)  # unpaid / paid
    payment_ref = Column(String(255), nullable=True)          # Référence paiement (saisie par superadmin)
    # Workflow
    status = Column(SAEnum(GroupConversionStatus, name="groupconversionstatus"), default=GroupConversionStatus.pending, nullable=False)
    reviewed_by_email = Column(String(255), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    tenant = relationship("Tenant", backref="conversion_requests", foreign_keys=[tenant_id])

    def __repr__(self):
        return f"<GroupConversionRequest tenant_id={self.tenant_id} status={self.status}>"