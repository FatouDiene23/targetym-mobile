"""
API Signature Électronique
Endpoints pour la gestion des documents à signer et des demandes de signature.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import hashlib
import base64
import io

from app.services.signature_pdf_service import build_final_pdf

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.signature import (
    SignatureDocument, SignatureRequest,
    SignatureDocumentStatus, SignatureDocumentType, SignatureRequestStatus,
)

router = APIRouter(prefix="/api/signatures", tags=["signatures"])


# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────

class SignatoryIn(BaseModel):
    employee_id: int
    order_index: int = 0


class DocumentCreateIn(BaseModel):
    title: str
    description: Optional[str] = None
    document_type: SignatureDocumentType
    file_data: str          # base64-encoded PDF
    file_name: str
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None
    signatories: List[SignatoryIn] = []


class SignRequestBody(BaseModel):
    signature_image_b64: str   # base64-encoded PNG drawn on canvas


class RejectRequestBody(BaseModel):
    reason: str


class SignatoryOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    order_index: int
    status: str
    signed_at: Optional[datetime]
    viewed_at: Optional[datetime]
    rejection_reason: Optional[str]

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    document_type: str
    status: str
    file_name: Optional[str]
    hash_sha256: Optional[str]
    expires_at: Optional[datetime]
    notes: Optional[str]
    created_by_user_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    requests: List[SignatoryOut] = []

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    total: int
    draft: int
    sent: int
    partially_signed: int
    fully_signed: int
    expired: int
    cancelled: int
    pending_for_me: int


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

ADMIN_ROLES = {UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPER_ADMIN}


def _require_admin(user: User):
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")


def _get_employee_for_user(db: Session, user: User) -> Optional[Employee]:
    return db.query(Employee).filter(
        Employee.email == user.email,
        Employee.tenant_id == user.tenant_id,
    ).first()


def _build_signatory_out(req: SignatureRequest, db: Session) -> SignatoryOut:
    emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
    name = f"{emp.first_name} {emp.last_name}" if emp else f"Employé #{req.employee_id}"
    return SignatoryOut(
        id=req.id,
        employee_id=req.employee_id,
        employee_name=name,
        order_index=req.order_index,
        status=req.status.value if hasattr(req.status, 'value') else req.status,
        signed_at=req.signed_at,
        viewed_at=req.viewed_at,
        rejection_reason=req.rejection_reason,
    )


def _build_document_out(doc: SignatureDocument, db: Session) -> DocumentOut:
    requests_out = [_build_signatory_out(r, db) for r in sorted(doc.requests, key=lambda r: r.order_index)]
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        description=doc.description,
        document_type=doc.document_type.value if hasattr(doc.document_type, 'value') else doc.document_type,
        status=doc.status.value if hasattr(doc.status, 'value') else doc.status,
        file_name=doc.file_name,
        hash_sha256=doc.hash_sha256,
        expires_at=doc.expires_at,
        notes=doc.notes,
        created_by_user_id=doc.created_by_user_id,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        requests=requests_out,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Admin endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/documents", response_model=DocumentOut)
def create_document(
    body: DocumentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Créer un nouveau document à signer (upload PDF en base64)."""
    _require_admin(user)

    # Compute hash of the original PDF bytes
    try:
        pdf_bytes = base64.b64decode(body.file_data)
        sha256 = hashlib.sha256(pdf_bytes).hexdigest()
    except Exception:
        sha256 = None

    doc = SignatureDocument(
        tenant_id=user.tenant_id,
        title=body.title,
        description=body.description,
        document_type=body.document_type,
        status=SignatureDocumentStatus.DRAFT,
        file_data=body.file_data,
        file_name=body.file_name,
        hash_sha256=sha256,
        expires_at=body.expires_at,
        notes=body.notes,
        created_by_user_id=user.id,
    )
    db.add(doc)
    db.flush()   # get doc.id before creating requests

    for s in body.signatories:
        req = SignatureRequest(
            tenant_id=user.tenant_id,
            document_id=doc.id,
            employee_id=s.employee_id,
            order_index=s.order_index,
            status=SignatureRequestStatus.PENDING,
        )
        db.add(req)

    db.commit()
    db.refresh(doc)
    return _build_document_out(doc, db)


@router.get("/documents", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister tous les documents du tenant (admin/rh/dg)."""
    _require_admin(user)
    docs = (
        db.query(SignatureDocument)
        .filter(SignatureDocument.tenant_id == user.tenant_id)
        .order_by(SignatureDocument.created_at.desc())
        .all()
    )
    return [_build_document_out(d, db) for d in docs]


@router.get("/documents/{doc_id}", response_model=DocumentOut)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Détail d'un document avec la liste des signataires."""
    _require_admin(user)
    doc = db.query(SignatureDocument).filter(
        SignatureDocument.id == doc_id,
        SignatureDocument.tenant_id == user.tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return _build_document_out(doc, db)


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Supprimer un document (seulement si statut = draft)."""
    _require_admin(user)
    doc = db.query(SignatureDocument).filter(
        SignatureDocument.id == doc_id,
        SignatureDocument.tenant_id == user.tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if doc.status != SignatureDocumentStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Seuls les documents en brouillon peuvent être supprimés")
    db.delete(doc)
    db.commit()


@router.post("/documents/{doc_id}/send", response_model=DocumentOut)
def send_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Envoyer le document aux signataires (passe de draft → sent)."""
    _require_admin(user)
    doc = db.query(SignatureDocument).filter(
        SignatureDocument.id == doc_id,
        SignatureDocument.tenant_id == user.tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if doc.status != SignatureDocumentStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Le document n'est pas en brouillon")
    if not doc.requests:
        raise HTTPException(status_code=400, detail="Aucun signataire défini")
    doc.status = SignatureDocumentStatus.SENT
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)

    # --- Notifications aux signataires ---
    try:
        from app.services.notification_service import notify_signature_request
        for sig_req in doc.requests:
            sig_emp = db.query(Employee).filter(Employee.id == sig_req.employee_id).first()
            if sig_emp:
                notify_signature_request(db, user.tenant_id, sig_emp, doc)
    except Exception:
        pass

    return _build_document_out(doc, db)


@router.post("/documents/{doc_id}/cancel", response_model=DocumentOut)
def cancel_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Annuler un document en cours de signature."""
    _require_admin(user)
    doc = db.query(SignatureDocument).filter(
        SignatureDocument.id == doc_id,
        SignatureDocument.tenant_id == user.tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if doc.status in (SignatureDocumentStatus.FULLY_SIGNED, SignatureDocumentStatus.CANCELLED):
        raise HTTPException(status_code=400, detail="Impossible d'annuler ce document")
    doc.status = SignatureDocumentStatus.CANCELLED
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return _build_document_out(doc, db)


@router.get("/stats", response_model=StatsOut)
def get_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Statistiques tableau de bord signatures."""
    _require_admin(user)

    docs = db.query(SignatureDocument).filter(
        SignatureDocument.tenant_id == user.tenant_id,
    ).all()

    counts = {s.value: 0 for s in SignatureDocumentStatus}
    for d in docs:
        key = d.status.value if hasattr(d.status, 'value') else d.status
        counts[key] = counts.get(key, 0) + 1

    # pending_for_me: requests not yet signed where doc is sent
    pending_for_me = 0  # not applicable for admins listing

    return StatsOut(
        total=len(docs),
        draft=counts.get('draft', 0),
        sent=counts.get('sent', 0),
        partially_signed=counts.get('partially_signed', 0),
        fully_signed=counts.get('fully_signed', 0),
        expired=counts.get('expired', 0),
        cancelled=counts.get('cancelled', 0),
        pending_for_me=pending_for_me,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Employee endpoints (Mon Espace)
# ──────────────────────────────────────────────────────────────────────────────

class PendingRequestOut(BaseModel):
    id: int
    document_id: int
    document_title: str
    document_type: str
    file_name: Optional[str]
    status: str
    expires_at: Optional[datetime]
    viewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/pending", response_model=List[PendingRequestOut])
def get_my_pending(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Récupère les demandes de signature en attente pour l'employé connecté."""
    emp = _get_employee_for_user(db, user)
    if not emp:
        return []

    reqs = (
        db.query(SignatureRequest)
        .filter(
            SignatureRequest.employee_id == emp.id,
            SignatureRequest.status.in_([
                SignatureRequestStatus.PENDING,
                SignatureRequestStatus.VIEWED,
            ]),
        )
        .all()
    )
    out = []
    for r in reqs:
        doc = db.query(SignatureDocument).filter(
            SignatureDocument.id == r.document_id,
            SignatureDocument.status == SignatureDocumentStatus.SENT,
        ).first()
        if not doc:
            continue
        out.append(PendingRequestOut(
            id=r.id,
            document_id=doc.id,
            document_title=doc.title,
            document_type=doc.document_type.value if hasattr(doc.document_type, 'value') else doc.document_type,
            file_name=doc.file_name,
            status=r.status.value if hasattr(r.status, 'value') else r.status,
            expires_at=doc.expires_at,
            viewed_at=r.viewed_at,
            created_at=r.created_at,
        ))
    return out


@router.put("/requests/{req_id}/view", response_model=dict)
def mark_viewed(
    req_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marquer une demande comme vue (l'employé a ouvert le document)."""
    emp = _get_employee_for_user(db, user)
    if not emp:
        raise HTTPException(status_code=403, detail="Profil employé introuvable")

    req = db.query(SignatureRequest).filter(
        SignatureRequest.id == req_id,
        SignatureRequest.employee_id == emp.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")

    if req.status == SignatureRequestStatus.PENDING:
        req.status = SignatureRequestStatus.VIEWED
        req.viewed_at = datetime.utcnow()
        req.updated_at = datetime.utcnow()
        db.commit()

    return {"ok": True}


@router.post("/requests/{req_id}/sign", response_model=dict)
def sign_request(
    req_id: int,
    body: SignRequestBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Signer un document (soumet la signature dessinée en base64)."""
    emp = _get_employee_for_user(db, user)
    if not emp:
        raise HTTPException(status_code=403, detail="Profil employé introuvable")

    req = db.query(SignatureRequest).filter(
        SignatureRequest.id == req_id,
        SignatureRequest.employee_id == emp.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if req.status == SignatureRequestStatus.SIGNED:
        raise HTTPException(status_code=400, detail="Document déjà signé")
    if req.status == SignatureRequestStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Document refusé, impossible de signer")

    req.status = SignatureRequestStatus.SIGNED
    req.signature_image_b64 = body.signature_image_b64
    req.signed_at = datetime.utcnow()
    req.updated_at = datetime.utcnow()
    req.ip_address = request.client.host if request.client else None

    db.flush()

    # Update document status
    doc = req.document
    all_reqs = db.query(SignatureRequest).filter(
        SignatureRequest.document_id == doc.id
    ).all()
    signed_count = sum(1 for r in all_reqs if r.status == SignatureRequestStatus.SIGNED)
    total = len(all_reqs)

    if signed_count == total:
        doc.status = SignatureDocumentStatus.FULLY_SIGNED
    else:
        doc.status = SignatureDocumentStatus.PARTIALLY_SIGNED
    doc.updated_at = datetime.utcnow()

    db.commit()

    # --- Notification au créateur ---
    try:
        from app.services.notification_service import notify_signature_action
        notify_signature_action(
            db,
            req.document.tenant_id,
            req.document,
            f"{emp.first_name} {emp.last_name}",
            "signed",
        )
    except Exception:
        pass

    return {"ok": True, "signed_count": signed_count, "total": total}


@router.post("/requests/{req_id}/reject", response_model=dict)
def reject_request(
    req_id: int,
    body: RejectRequestBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Refuser de signer un document."""
    emp = _get_employee_for_user(db, user)
    if not emp:
        raise HTTPException(status_code=403, detail="Profil employé introuvable")

    req = db.query(SignatureRequest).filter(
        SignatureRequest.id == req_id,
        SignatureRequest.employee_id == emp.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if req.status in (SignatureRequestStatus.SIGNED, SignatureRequestStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Demande déjà traitée")

    req.status = SignatureRequestStatus.REJECTED
    req.rejection_reason = body.reason
    req.updated_at = datetime.utcnow()
    db.commit()

    # --- Notification au créateur ---
    try:
        from app.services.notification_service import notify_signature_action
        doc = req.document
        notify_signature_action(
            db,
            doc.tenant_id,
            doc,
            f"{emp.first_name} {emp.last_name}",
            "rejected",
        )
    except Exception:
        pass

    return {"ok": True}


@router.get("/documents/{doc_id}/final-pdf")
def download_final_pdf(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Génère et retourne le PDF final signé (pages originales + signatures + audit trail)."""
    _require_admin(user)
    doc = db.query(SignatureDocument).filter(
        SignatureDocument.id == doc_id,
        SignatureDocument.tenant_id == user.tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if doc.status not in (
        SignatureDocumentStatus.FULLY_SIGNED,
        SignatureDocumentStatus.PARTIALLY_SIGNED,
        SignatureDocumentStatus.SENT,
    ):
        raise HTTPException(status_code=400, detail="PDF final disponible uniquement pour les documents envoyés ou signés")

    # Injecter les noms d'employés sur les requests
    requests = sorted(doc.requests, key=lambda r: r.order_index)
    for req in requests:
        emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
        req._employee_name = f"{emp.first_name} {emp.last_name}" if emp else f"Employé #{req.employee_id}"

    pdf_bytes = build_final_pdf(doc, requests)
    safe_name = doc.title.replace(" ", "_")[:60]
    filename = f"signed_{safe_name}_{doc_id}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/requests/{req_id}/document-data", response_model=dict)
def get_document_data_for_signing(
    req_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Récupère le PDF en base64 pour affichage dans la modale de signature."""
    emp = _get_employee_for_user(db, user)
    if not emp:
        raise HTTPException(status_code=403, detail="Profil employé introuvable")

    req = db.query(SignatureRequest).filter(
        SignatureRequest.id == req_id,
        SignatureRequest.employee_id == emp.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")

    doc = req.document
    if not doc or doc.status not in (SignatureDocumentStatus.SENT, SignatureDocumentStatus.PARTIALLY_SIGNED):
        raise HTTPException(status_code=400, detail="Document non disponible")

    return {
        "file_data": doc.file_data,
        "file_name": doc.file_name,
        "title": doc.title,
    }
