from sqlalchemy import Column, Integer, DateTime, String, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class TimestampMixin:
    """Mixin pour les timestamps automatiques"""
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TenantMixin:
    """Mixin pour le multi-tenant - chaque enregistrement appartient à un tenant"""
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
