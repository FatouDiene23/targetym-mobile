from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import secrets
import urllib.parse

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user, get_current_tenant, require_admin
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.integration import TenantIntegration, IntegrationSyncLog
from app.services.integration_service import (
    get_integration, store_tokens, get_valid_access_token, log_sync
)
import httpx

router = APIRouter(prefix="/api/integrations", tags=["Integrations"])

# Providers config
PROVIDERS = {
    "teams": {
        "name": "Microsoft Teams",
        "description": "Calendrier Outlook & réunions Teams",
        "icon": "teams",
        "features": ["Sync calendrier congés", "Planifier réunions Teams", "Sync entretiens & 1-1"],
    },
    "asana": {
        "name": "Asana",
        "description": "Gestion de projets & tâches",
        "icon": "asana",
        "features": ["Sync tâches bidirectionnelle", "Sync OKR → projets Asana", "Suivi avancement"],
    },
    # "google": {  # À activer plus tard
    #     "name": "Google Workspace",
    #     "description": "Google Calendar & Google Meet",
    #     "icon": "google",
    #     "features": ["Sync calendrier congés", "Planifier réunions Meet", "Sync entretiens & 1-1"],
    # },
}


# ============================================
# LIST INTEGRATIONS
# ============================================

@router.get("/")
async def list_integrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all integrations with their status for the tenant."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Pas de tenant associé")

    # Get all existing integrations for this tenant
    existing = db.query(TenantIntegration).filter(
        TenantIntegration.tenant_id == current_user.tenant_id
    ).all()

    existing_map = {i.provider: i for i in existing}

    result = []
    for provider_id, info in PROVIDERS.items():
        integration = existing_map.get(provider_id)
        connected = bool(integration and integration.is_active)

        item = {
            "id": provider_id,
            "name": info["name"],
            "description": info["description"],
            "icon": info["icon"],
            "features": info["features"],
            "connected": connected,
            "connected_at": integration.connected_at.isoformat() if connected and integration.connected_at else None,
            "last_synced_at": integration.last_synced_at.isoformat() if connected and integration.last_synced_at else None,
            "last_sync_status": integration.last_sync_status if connected else None,
        }
        result.append(item)

    return result


# ============================================
# CONNECT (initiate OAuth)
# ============================================

@router.get("/{provider}/connect")
async def connect_integration(
    provider: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Return the OAuth authorization URL for a provider."""
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider inconnu: {provider}")

    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Pas de tenant associé")

    # Generate state parameter: tenant_id:user_id:nonce
    nonce = secrets.token_urlsafe(16)
    state = f"{current_user.tenant_id}:{current_user.id}:{nonce}"

    if provider == "teams":
        if not settings.MICROSOFT_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Microsoft integration not configured")
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "response_type": "code",
            "scope": "https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/OnlineMeetings.ReadWrite https://graph.microsoft.com/User.Read offline_access",
            "state": state,
            "prompt": "consent",
        }
        auth_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"

    elif provider == "asana":
        if not settings.ASANA_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Asana integration not configured")
        params = {
            "client_id": settings.ASANA_CLIENT_ID,
            "redirect_uri": settings.ASANA_REDIRECT_URI,
            "response_type": "code",
            "state": state,
        }
        auth_url = f"https://app.asana.com/-/oauth_authorize?{urllib.parse.urlencode(params)}"

    elif provider == "google":
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google integration not configured")
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/calendar.events",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    else:
        raise HTTPException(status_code=400, detail="Provider non supporté")

    return {"auth_url": auth_url}


# ============================================
# OAUTH CALLBACKS
# ============================================

@router.get("/teams/callback")
async def teams_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: Session = Depends(get_db)
):
    """Microsoft Teams OAuth callback."""
    tenant_id, user_id = _parse_state(state)

    # Exchange code for tokens
    resp = httpx.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "scope": "https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/OnlineMeetings.ReadWrite https://graph.microsoft.com/User.Read offline_access",
        },
        timeout=30,
    )

    if resp.status_code != 200:
        print(f"Teams OAuth error: {resp.text}")
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&error=teams"
        )

    data = resp.json()

    # Get user info from Graph
    metadata = {}
    try:
        user_resp = httpx.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {data['access_token']}"},
            timeout=15,
        )
        if user_resp.status_code == 200:
            me = user_resp.json()
            metadata = {
                "user_email": me.get("mail") or me.get("userPrincipalName"),
                "display_name": me.get("displayName"),
            }
    except Exception:
        pass

    store_tokens(
        db=db,
        tenant_id=tenant_id,
        provider="teams",
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=data.get("expires_in"),
        connected_by=user_id,
        metadata=metadata,
    )

    return RedirectResponse(
        f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&connected=teams"
    )


@router.get("/asana/callback")
async def asana_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: Session = Depends(get_db)
):
    """Asana OAuth callback."""
    tenant_id, user_id = _parse_state(state)

    resp = httpx.post(
        "https://app.asana.com/-/oauth_token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.ASANA_CLIENT_ID,
            "client_secret": settings.ASANA_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.ASANA_REDIRECT_URI,
        },
        timeout=30,
    )

    if resp.status_code != 200:
        print(f"Asana OAuth error: {resp.text}")
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&error=asana"
        )

    data = resp.json()

    # Get workspace info
    metadata = {}
    try:
        me_resp = httpx.get(
            "https://app.asana.com/api/1.0/users/me",
            headers={"Authorization": f"Bearer {data['access_token']}"},
            timeout=15,
        )
        if me_resp.status_code == 200:
            me = me_resp.json().get("data", {})
            workspaces = me.get("workspaces", [])
            metadata = {
                "user_name": me.get("name"),
                "user_email": me.get("email"),
                "workspaces": workspaces,
            }
    except Exception:
        pass

    store_tokens(
        db=db,
        tenant_id=tenant_id,
        provider="asana",
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=data.get("expires_in"),
        connected_by=user_id,
        metadata=metadata,
    )

    return RedirectResponse(
        f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&connected=asana"
    )


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: Session = Depends(get_db)
):
    """Google Workspace OAuth callback."""
    tenant_id, user_id = _parse_state(state)

    resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        },
        timeout=30,
    )

    if resp.status_code != 200:
        print(f"Google OAuth error: {resp.text}")
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&error=google"
        )

    data = resp.json()

    # Get user info
    metadata = {}
    try:
        user_resp = httpx.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {data['access_token']}"},
            timeout=15,
        )
        if user_resp.status_code == 200:
            me = user_resp.json()
            metadata = {
                "user_email": me.get("email"),
                "user_name": me.get("name"),
            }
    except Exception:
        pass

    store_tokens(
        db=db,
        tenant_id=tenant_id,
        provider="google",
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=data.get("expires_in"),
        connected_by=user_id,
        metadata=metadata,
    )

    return RedirectResponse(
        f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&connected=google"
    )


# ============================================
# DISCONNECT
# ============================================

@router.post("/{provider}/disconnect")
async def disconnect_integration(
    provider: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Disconnect an integration."""
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider inconnu: {provider}")

    integration = get_integration(db, current_user.tenant_id, provider)
    if not integration:
        raise HTTPException(status_code=404, detail="Intégration non trouvée")

    integration.is_active = False
    integration.access_token_encrypted = None
    integration.refresh_token_encrypted = None
    integration.expires_at = None
    db.commit()

    return {"success": True, "message": f"{PROVIDERS[provider]['name']} déconnecté"}


# ============================================
# MANUAL SYNC
# ============================================

@router.post("/{provider}/sync")
async def sync_integration(
    provider: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Trigger a manual sync for a provider."""
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider inconnu: {provider}")

    integration = get_integration(db, current_user.tenant_id, provider)
    if not integration:
        raise HTTPException(status_code=404, detail="Intégration non connectée")

    try:
        token = get_valid_access_token(db, integration)

        if provider == "teams":
            from app.services.teams_service import test_connection
            result = test_connection(token)
        elif provider == "asana":
            from app.services.asana_service import test_connection
            result = test_connection(token)
        elif provider == "google":
            from app.services.google_service import test_connection
            result = test_connection(token)
        else:
            result = {"status": "ok"}

        integration.last_synced_at = datetime.now(timezone.utc)
        integration.last_sync_status = "success"
        integration.last_sync_error = None
        db.commit()

        log_sync(db, current_user.tenant_id, provider, "test", "bidirectional", "success")

        return {"success": True, "result": result}

    except Exception as e:
        integration.last_sync_status = "error"
        integration.last_sync_error = str(e)
        db.commit()

        log_sync(db, current_user.tenant_id, provider, "test", "bidirectional", "error", error_details=str(e))

        raise HTTPException(status_code=500, detail=f"Erreur de synchronisation: {str(e)}")


# ============================================
# HELPERS
# ============================================

def _parse_state(state: str) -> tuple:
    """Parse state parameter: tenant_id:user_id:nonce"""
    try:
        parts = state.split(":")
        tenant_id = int(parts[0])
        user_id = int(parts[1])
        return tenant_id, user_id
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid state parameter")
