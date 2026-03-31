"""
Payment Service — Interface abstraite pour les paiements.

Implémentation actuelle : ManualPaymentService (back-office gère manuellement).
Prévu pour branchement PayDunya sans modifier le code appelant.
"""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.models.invoice import Invoice, InvoiceStatus


# ─── Interface abstraite ───────────────────────────────────────────────────────

class PaymentServiceBase(ABC):
    """Interface commune à toutes les implémentations de paiement."""

    @abstractmethod
    def create_invoice(
        self,
        db: Session,
        tenant_id: int,
        amount: float,
        currency: str,
        description: Optional[str],
        due_date: Optional[datetime],
        pdf_url: Optional[str],
        created_by_email: Optional[str],
    ) -> Invoice:
        """Crée une nouvelle facture pour un tenant."""
        ...

    @abstractmethod
    def process_payment(
        self,
        db: Session,
        invoice: Invoice,
        payment_ref: Optional[str] = None,
    ) -> Invoice:
        """Marque une facture comme payée."""
        ...

    @abstractmethod
    def get_payment_status(self, db: Session, invoice_id: int) -> Optional[str]:
        """Retourne le statut de paiement d'une facture."""
        ...

    @abstractmethod
    def cancel_invoice(self, db: Session, invoice: Invoice) -> Invoice:
        """Annule une facture."""
        ...


# ─── Implémentation manuelle (actuelle) ───────────────────────────────────────

class ManualPaymentService(PaymentServiceBase):
    """
    Paiement manuel : le SUPER_ADMIN crée, valide et annule les factures
    directement depuis le back-office.
    Pas de gateway externe — tout est géré en base.
    """

    PROVIDER = "manual"

    def create_invoice(
        self,
        db: Session,
        tenant_id: int,
        amount: float,
        currency: str = "XOF",
        description: Optional[str] = None,
        due_date: Optional[datetime] = None,
        pdf_url: Optional[str] = None,
        created_by_email: Optional[str] = None,
    ) -> Invoice:
        invoice = Invoice(
            tenant_id=tenant_id,
            amount=amount,
            currency=currency,
            description=description,
            status=InvoiceStatus.pending,
            payment_provider=self.PROVIDER,
            due_date=due_date,
            pdf_url=pdf_url,
            created_by_email=created_by_email,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice

    def process_payment(
        self,
        db: Session,
        invoice: Invoice,
        payment_ref: Optional[str] = None,
    ) -> Invoice:
        invoice.status = InvoiceStatus.paid
        invoice.payment_ref = payment_ref
        invoice.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(invoice)
        return invoice

    def get_payment_status(self, db: Session, invoice_id: int) -> Optional[str]:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return None
        return invoice.status.value

    def cancel_invoice(self, db: Session, invoice: Invoice) -> Invoice:
        invoice.status = InvoiceStatus.cancelled
        invoice.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(invoice)
        return invoice


# ─── Future implémentation PayDunya ───────────────────────────────────────────
# class PayDunyaPaymentService(PaymentServiceBase):
#     """Brancher PayDunya ici sans modifier billing.py ni le back-office."""
#     PROVIDER = "paydunya"
#     ...


# ─── Instance globale (injectée dans les routes) ──────────────────────────────
payment_service: PaymentServiceBase = ManualPaymentService()
