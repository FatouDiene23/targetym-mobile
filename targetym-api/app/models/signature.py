# =============================================
# MODÈLE — Signature Électronique
# Sprint 4 - signature_documents + signature_requests
# =============================================

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class SignatureDocumentStatus(str, enum.Enum):
    DRAFT            = "draft"             # Brouillon, pas encore envoyé
    SENT             = "sent"              # Envoyé aux signataires
    PARTIALLY_SIGNED = "partially_signed"  # Partiellement signé
    FULLY_SIGNED     = "fully_signed"      # Tous ont signé
    EXPIRED          = "expired"           # Délai dépassé
    CANCELLED        = "cancelled"         # Annulé


class SignatureDocumentType(str, enum.Enum):
    CONTRAT_TRAVAIL      = "contrat_travail"
    AVENANT              = "avenant"
    ACCORD               = "accord"
    NDA                  = "nda"
    FICHE_PAIE           = "fiche_paie"
    ATTESTATION          = "attestation"
    REGLEMENT_INTERIEUR  = "reglement_interieur"
    AUTRE                = "autre"


class SignatureRequestStatus(str, enum.Enum):
    PENDING  = "pending"   # En attente de signature
    VIEWED   = "viewed"    # Document ouvert, pas encore signé
    SIGNED   = "signed"    # Signé
    REJECTED = "rejected"  # Refusé
    EXPIRED  = "expired"   # Délai dépassé


class SignatureDocument(Base):
    """Document à faire signer électroniquement."""
    __tablename__ = "signature_documents"

    id             = Column(Integer, primary_key=True, index=True)
    tenant_id      = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Infos document
    title          = Column(String(255), nullable=False)
    description    = Column(Text, nullable=True)
    document_type  = Column(SAEnum(SignatureDocumentType), default=SignatureDocumentType.AUTRE, nullable=False)
    status         = Column(SAEnum(SignatureDocumentStatus), default=SignatureDocumentStatus.DRAFT, nullable=False)

    # Fichier PDF (base64)
    file_data      = Column(Text, nullable=True)    # PDF original encodé base64
    file_name      = Column(String(255), nullable=True)
    hash_sha256    = Column(String(64), nullable=True)  # Empreinte du document original

    # Expiration + notes
    expires_at     = Column(DateTime(timezone=True), nullable=True)
    notes          = Column(Text, nullable=True)

    # Créateur
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    requests       = relationship("SignatureRequest", back_populates="document", cascade="all, delete-orphan")


class SignatureRequest(Base):
    """Demande de signature adressée à un signataire précis."""
    __tablename__ = "signature_requests"

    id             = Column(Integer, primary_key=True, index=True)
    tenant_id      = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    document_id    = Column(Integer, ForeignKey("signature_documents.id"), nullable=False, index=True)
    employee_id    = Column(Integer, ForeignKey("employees.id"), nullable=False)

    # Ordre de signature (1 = premier à signer, etc.)
    order_index    = Column(Integer, default=1, nullable=False)

    # Statut
    status         = Column(SAEnum(SignatureRequestStatus), default=SignatureRequestStatus.PENDING, nullable=False)

    # Signature capturée (image PNG en base64)
    signature_image_b64 = Column(Text, nullable=True)

    # Traçabilité
    signed_at      = Column(DateTime(timezone=True), nullable=True)
    viewed_at      = Column(DateTime(timezone=True), nullable=True)
    ip_address     = Column(String(50), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Timestamps
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    document       = relationship("SignatureDocument", back_populates="requests")
