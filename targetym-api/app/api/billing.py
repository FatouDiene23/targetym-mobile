"""
Billing API — Facturation tenants
- GET  /billing/invoices             → liste des factures (tenant courant)
- GET  /billing/current-plan         → plan + statut + utilisation
- POST /billing/upgrade-request      → demande d'upgrade → notification back-office

- GET  /billing/admin/invoices/{tenant_id}          → toutes les factures d'un tenant (SUPER_ADMIN)
- POST /billing/admin/invoices/{tenant_id}          → créer une facture (SUPER_ADMIN)
- PATCH /billing/admin/invoices/{invoice_id}/pay    → marquer payée (SUPER_ADMIN)
- PATCH /billing/admin/invoices/{invoice_id}/cancel → annuler (SUPER_ADMIN)
- PATCH /billing/admin/tenants/{tenant_id}/plan     → changer plan (SUPER_ADMIN)
"""

from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_super_admin
from app.models.invoice import Invoice, InvoiceStatus
from app.models.tenant import Tenant
from app.models.employee import Employee
from app.models.user import User, UserRole
from app.services.payment_service import payment_service

router = APIRouter(prefix="/billing", tags=["Billing"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class InvoiceOut(BaseModel):
    id: int
    tenant_id: int
    amount: float
    currency: str
    description: Optional[str]
    status: str
    payment_provider: str
    payment_ref: Optional[str]
    invoice_date: datetime
    due_date: Optional[datetime]
    pdf_url: Optional[str]
    created_by_email: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CurrentPlanOut(BaseModel):
    tenant_id: int
    tenant_name: str
    plan: str
    is_trial: bool
    is_active: bool
    trial_ends_at: Optional[datetime]
    trial_days_remaining: int
    max_employees: int
    current_employees: int
    currency: str


class UpgradeRequestIn(BaseModel):
    desired_plan: str
    message: Optional[str] = None


class CreateInvoiceIn(BaseModel):
    amount: float
    currency: str = "XOF"
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    pdf_url: Optional[str] = None


class PayInvoiceIn(BaseModel):
    payment_ref: Optional[str] = None


class ChangePlanIn(BaseModel):
    plan: str
    max_employees: Optional[int] = None
    is_trial: Optional[bool] = None
    trial_ends_at: Optional[datetime] = None
    note: Optional[str] = None


# ─── Routes tenant ────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=List[InvoiceOut])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les factures du tenant courant."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Pas de tenant associé")
    invoices = (
        db.query(Invoice)
        .filter(Invoice.tenant_id == current_user.tenant_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    return invoices


@router.get("/current-plan", response_model=CurrentPlanOut)
def get_current_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne le plan actuel + utilisation du tenant."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Pas de tenant associé")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    employee_count = (
        db.query(Employee).filter(Employee.tenant_id == tenant.id).count()
    )

    return CurrentPlanOut(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        plan=tenant.plan,
        is_trial=tenant.is_trial,
        is_active=tenant.is_active,
        trial_ends_at=tenant.trial_ends_at,
        trial_days_remaining=tenant.trial_days_remaining,
        max_employees=tenant.max_employees,
        current_employees=employee_count,
        currency=tenant.currency,
    )


@router.post("/upgrade-request", status_code=202)
def request_upgrade(
    body: UpgradeRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Envoie une demande d'upgrade au back-office.
    Pour l'instant : log en base (notification future via email/webhook).
    """
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Pas de tenant associé")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    # TODO: envoyer email/notification au SUPER_ADMIN
    # Pour l'instant on log juste la demande
    print(
        f"[UPGRADE REQUEST] Tenant {tenant.name} ({tenant.id}) "
        f"souhaite passer au plan '{body.desired_plan}'. "
        f"Message: {body.message or '—'} "
        f"Demandé par: {current_user.email}"
    )

    return {"message": "Demande envoyée au back-office. Nous vous contacterons sous 24h."}


# ─── Routes Super Admin ───────────────────────────────────────────────────────

@router.get("/admin/invoices/{tenant_id}", response_model=List[InvoiceOut])
def admin_list_invoices(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Liste toutes les factures d'un tenant (SUPER_ADMIN)."""
    invoices = (
        db.query(Invoice)
        .filter(Invoice.tenant_id == tenant_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    return invoices


@router.post("/admin/invoices/{tenant_id}", response_model=InvoiceOut, status_code=201)
def admin_create_invoice(
    tenant_id: int,
    body: CreateInvoiceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Crée une facture pour un tenant (SUPER_ADMIN)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    invoice = payment_service.create_invoice(
        db=db,
        tenant_id=tenant_id,
        amount=body.amount,
        currency=body.currency,
        description=body.description,
        due_date=body.due_date,
        pdf_url=body.pdf_url,
        created_by_email=current_user.email,
    )
    return invoice


@router.patch("/admin/invoices/{invoice_id}/pay", response_model=InvoiceOut)
def admin_pay_invoice(
    invoice_id: int,
    body: PayInvoiceIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Marque une facture comme payée (SUPER_ADMIN)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if invoice.status == InvoiceStatus.cancelled:
        raise HTTPException(status_code=400, detail="Impossible de payer une facture annulée")

    return payment_service.process_payment(db=db, invoice=invoice, payment_ref=body.payment_ref)


@router.patch("/admin/invoices/{invoice_id}/cancel", response_model=InvoiceOut)
def admin_cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Annule une facture (SUPER_ADMIN)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if invoice.status == InvoiceStatus.paid:
        raise HTTPException(status_code=400, detail="Impossible d'annuler une facture payée")

    return payment_service.cancel_invoice(db=db, invoice=invoice)


@router.patch("/admin/tenants/{tenant_id}/plan")
def admin_change_plan(
    tenant_id: int,
    body: ChangePlanIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Change manuellement le plan d'un tenant après confirmation de paiement (SUPER_ADMIN)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    tenant.plan = body.plan
    if body.max_employees is not None:
        tenant.max_employees = body.max_employees
    if body.is_trial is not None:
        tenant.is_trial = body.is_trial
    if body.trial_ends_at is not None:
        tenant.trial_ends_at = body.trial_ends_at
    tenant.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(tenant)

    print(f"[PLAN CHANGE] Tenant {tenant.name} ({tenant.id}) → plan '{body.plan}' par {current_user.email}. Note: {body.note or '—'}")

    return {
        "message": f"Plan mis à jour → {body.plan}",
        "tenant_id": tenant.id,
        "plan": tenant.plan,
        "max_employees": tenant.max_employees,
    }
