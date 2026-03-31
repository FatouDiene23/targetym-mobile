import httpx
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from typing import Optional

from app.models.integration import TenantIntegration, IntegrationSyncLog
from app.services.encryption_service import encrypt_token, decrypt_token
from app.core.config import settings


def get_integration(db: Session, tenant_id: int, provider: str) -> Optional[TenantIntegration]:
    """Get active integration for a tenant + provider."""
    return db.query(TenantIntegration).filter(
        TenantIntegration.tenant_id == tenant_id,
        TenantIntegration.provider == provider,
        TenantIntegration.is_active == True
    ).first()


def store_tokens(
    db: Session,
    tenant_id: int,
    provider: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_in: Optional[int],
    connected_by: int,
    metadata: Optional[dict] = None
) -> TenantIntegration:
    """Store or update OAuth tokens for a tenant integration."""
    integration = db.query(TenantIntegration).filter(
        TenantIntegration.tenant_id == tenant_id,
        TenantIntegration.provider == provider
    ).first()

    expires_at = None
    if expires_in:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    if integration:
        integration.access_token_encrypted = encrypt_token(access_token)
        if refresh_token:
            integration.refresh_token_encrypted = encrypt_token(refresh_token)
        integration.expires_at = expires_at
        integration.is_active = True
        integration.connected_by = connected_by
        integration.connected_at = datetime.now(timezone.utc)
        if metadata:
            integration.provider_metadata = {**(integration.provider_metadata or {}), **metadata}
    else:
        integration = TenantIntegration(
            tenant_id=tenant_id,
            provider=provider,
            access_token_encrypted=encrypt_token(access_token),
            refresh_token_encrypted=encrypt_token(refresh_token) if refresh_token else None,
            expires_at=expires_at,
            is_active=True,
            connected_by=connected_by,
            connected_at=datetime.now(timezone.utc),
            provider_metadata=metadata or {}
        )
        db.add(integration)

    db.commit()
    db.refresh(integration)
    return integration


def get_valid_access_token(db: Session, integration: TenantIntegration) -> str:
    """Get a valid access token, refreshing if expired."""
    if not integration.access_token_encrypted:
        raise ValueError("No access token stored")

    # Check if token expired (with 5-minute buffer)
    if integration.expires_at:
        buffer = datetime.now(timezone.utc) + timedelta(minutes=5)
        if integration.expires_at < buffer:
            return _refresh_access_token(db, integration)

    return decrypt_token(integration.access_token_encrypted)


def _refresh_access_token(db: Session, integration: TenantIntegration) -> str:
    """Refresh an expired access token."""
    if not integration.refresh_token_encrypted:
        raise ValueError("No refresh token — reconnection required")

    refresh_token = decrypt_token(integration.refresh_token_encrypted)
    provider = integration.provider

    if provider == "teams":
        return _refresh_microsoft(db, integration, refresh_token)
    elif provider == "asana":
        return _refresh_asana(db, integration, refresh_token)
    elif provider == "google":
        return _refresh_google(db, integration, refresh_token)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _refresh_microsoft(db: Session, integration: TenantIntegration, refresh_token: str) -> str:
    """Refresh Microsoft OAuth token."""
    resp = httpx.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        data={
            "grant_type": "refresh_token",
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "scope": "https://graph.microsoft.com/.default offline_access",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    _update_tokens(db, integration, data)
    return decrypt_token(integration.access_token_encrypted)


def _refresh_asana(db: Session, integration: TenantIntegration, refresh_token: str) -> str:
    """Refresh Asana OAuth token."""
    resp = httpx.post(
        "https://app.asana.com/-/oauth_token",
        data={
            "grant_type": "refresh_token",
            "client_id": settings.ASANA_CLIENT_ID,
            "client_secret": settings.ASANA_CLIENT_SECRET,
            "refresh_token": refresh_token,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    _update_tokens(db, integration, data)
    return decrypt_token(integration.access_token_encrypted)


def _refresh_google(db: Session, integration: TenantIntegration, refresh_token: str) -> str:
    """Refresh Google OAuth token."""
    resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "grant_type": "refresh_token",
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    _update_tokens(db, integration, data)
    return decrypt_token(integration.access_token_encrypted)


def _update_tokens(db: Session, integration: TenantIntegration, data: dict):
    """Update tokens after refresh."""
    integration.access_token_encrypted = encrypt_token(data["access_token"])
    if data.get("refresh_token"):
        integration.refresh_token_encrypted = encrypt_token(data["refresh_token"])
    if data.get("expires_in"):
        integration.expires_at = datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"])
    db.commit()


def log_sync(
    db: Session,
    tenant_id: int,
    provider: str,
    sync_type: str,
    direction: str,
    status: str,
    items_synced: int = 0,
    items_failed: int = 0,
    error_details: Optional[str] = None
) -> IntegrationSyncLog:
    """Log a sync operation."""
    log = IntegrationSyncLog(
        tenant_id=tenant_id,
        provider=provider,
        sync_type=sync_type,
        direction=direction,
        status=status,
        items_synced=items_synced,
        items_failed=items_failed,
        error_details=error_details,
        completed_at=datetime.now(timezone.utc) if status != "in_progress" else None
    )
    db.add(log)
    db.commit()
    return log
