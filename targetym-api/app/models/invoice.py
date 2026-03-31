from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class InvoiceStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"


class Invoice(Base):
    """Factures par tenant — gérées manuellement par le SUPER_ADMIN"""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="XOF")
    description = Column(Text, nullable=True)

    status = Column(SAEnum(InvoiceStatus, name="invoicestatus"), nullable=False, default=InvoiceStatus.pending)

    # Payment provider abstraction (manual → paydunya plus tard)
    payment_provider = Column(String(50), nullable=False, default="manual")
    payment_ref = Column(String(255), nullable=True)  # Référence paiement saisie par admin

    invoice_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)
    pdf_url = Column(String(500), nullable=True)

    created_by_email = Column(String(255), nullable=True)  # Email du SUPER_ADMIN qui a créé
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    tenant = relationship("Tenant", backref="invoices", foreign_keys=[tenant_id])

    def __repr__(self):
        return f"<Invoice tenant_id={self.tenant_id} amount={self.amount} {self.currency} status={self.status}>"
