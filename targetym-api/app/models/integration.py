from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class IntegrationProvider(str, enum.Enum):
    TEAMS = "teams"
    ASANA = "asana"
    GOOGLE = "google"


class TenantIntegration(Base):
    """OAuth integrations per tenant"""
    __tablename__ = "tenant_integrations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False, index=True)

    # Encrypted OAuth tokens
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Provider-specific metadata (workspace ID, calendar ID, team ID, etc.)
    provider_metadata = Column(JSONB, nullable=True, default=dict)

    # Status
    is_active = Column(Boolean, default=True)

    # Audit
    connected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    connected_at = Column(DateTime(timezone=True), nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_status = Column(String(50), nullable=True)
    last_sync_error = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('tenant_id', 'provider', name='uq_tenant_provider'),
    )


class IntegrationSyncLog(Base):
    """Log each sync operation"""
    __tablename__ = "integration_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    sync_type = Column(String(50), nullable=False)  # tasks, leaves, meetings, calendar
    direction = Column(String(20), nullable=False)   # push, pull, bidirectional
    status = Column(String(20), nullable=False)      # success, error, partial
    items_synced = Column(Integer, default=0)
    items_failed = Column(Integer, default=0)
    error_details = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
