from sqlalchemy import Column, String, Boolean, DateTime, Integer, SmallInteger, ForeignKey, Text, Date, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class LeaveType(Base):
    """
    Modèle LeaveType - Types de congés disponibles
    Configurable par tenant
    """
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Infos
    name = Column(String(100), nullable=False)  # Congés annuels, RTT, Maladie, etc.
    code = Column(String(20), nullable=False)  # CA, RTT, MAL, etc.
    description = Column(Text, nullable=True)
    
    # Configuration
    default_days = Column(Integer, default=0)  # Jours alloués par défaut par an
    accrual_rate = Column(Numeric(4, 2), default=2.0)  # Jours acquis par mois
    max_carryover = Column(Integer, nullable=True)  # Max jours reportables en N+1
    is_annual = Column(Boolean, default=False)  # Congé à acquisition mensuelle
    is_system = Column(Boolean, default=False)  # Type système non supprimable
    is_paid = Column(Boolean, default=True)  # Congé payé ou non
    requires_justification = Column(Boolean, default=False)  # Justificatif requis
    requires_approval = Column(Boolean, default=True)  # Validation manager requise
    max_consecutive_days = Column(Integer, nullable=True)  # Max jours consécutifs
    min_notice_days = Column(Integer, default=0)  # Préavis minimum en jours
    
    # Couleur pour affichage
    color = Column(String(20), default="#10B981")
    
    # Statut
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<LeaveType {self.name}>"


class LeaveBalance(Base):
    """
    Modèle LeaveBalance - Solde de congés par employé et par type
    """
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    
    # Soldes
    year = Column(Integer, nullable=False)  # Année concernée
    initial_balance = Column(Numeric(5, 2), default=0)  # Solde initial saisi par RH
    allocated = Column(Numeric(5, 2), default=0)  # Jours alloués
    taken = Column(Numeric(5, 2), default=0)  # Jours pris
    pending = Column(Numeric(5, 2), default=0)  # Jours en attente de validation
    carried_over = Column(Numeric(5, 2), default=0)   # Report de l'année précédente (solde au 31/12 N-1)
    accrual_start_month = Column(SmallInteger, default=1)  # Mois de début d'acquisition (1=jan, 2=fév…)

    @property
    def available(self):
        """Jours disponibles = solde_31dec_N-1 + taux_acq × mois_courus - pris - en_attente"""
        from datetime import date
        extra = 0
        if self.leave_type and self.leave_type.is_annual:
            today = date.today()
            year = self.year or today.year
            if year == today.year:
                start_month = self.accrual_start_month or 1
                months_elapsed = max(0, today.month - start_month + 1)
            elif year < today.year:
                months_elapsed = 12  # Année clôturée : 12 mois complets
            else:
                months_elapsed = 0   # Année future
            extra = float(self.leave_type.accrual_rate or 2.0) * months_elapsed
        return float(self.initial_balance or 0) + float(self.carried_over or 0) + extra - float(self.taken or 0) - float(self.pending or 0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations (sans back_populates pour éviter les conflits)
    leave_type = relationship("LeaveType")

    def __repr__(self):
        return f"<LeaveBalance {self.employee_id} - {self.leave_type_id}>"


class LeaveRequestStatus(str, enum.Enum):
    """Statuts possibles d'une demande de congé"""
    DRAFT = "draft"  # Brouillon
    PENDING = "pending"  # En attente de validation
    APPROVED = "approved"  # Approuvé
    REJECTED = "rejected"  # Refusé
    CANCELLED = "cancelled"  # Annulé par l'employé


class LeaveRequest(Base):
    """
    Modèle LeaveRequest - Demande de congé
    """
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    
    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Numeric(5, 2), nullable=False)
    
    # Détails
    start_half_day = Column(Boolean, default=False)  # Commence à mi-journée
    end_half_day = Column(Boolean, default=False)  # Finit à mi-journée
    reason = Column(Text, nullable=True)  # Motif
    
    # Statut
    status = Column(String(20), default=LeaveRequestStatus.PENDING.value)
    
    # Validation
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Documents
    attachment_url = Column(String(500), nullable=True)  # Justificatif
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations (sans back_populates pour éviter les conflits)
    employee = relationship("Employee", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType")
    approved_by = relationship("User", foreign_keys=[approved_by_id])

    def __repr__(self):
        return f"<LeaveRequest {self.employee_id} - {self.start_date} to {self.end_date}>"
