# app/api/training_providers.py
"""
API Fournisseurs de Formation — TARGETYM AI
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.training_provider import TrainingProvider

router = APIRouter(prefix="/api/training", tags=["Fournisseurs de Formation"])

FULL_ACCESS_ROLES = ['admin', 'dg', 'dga', 'rh', 'drh']


def require_rh_access(current_user: User):
    role = current_user.role.value.lower() if current_user.role else ''
    if role not in FULL_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé RH/Admin")


# ============================================
# SCHEMAS
# ============================================

class ProviderCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    type: str = "externe"
    specialties: Optional[str] = None


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    type: Optional[str] = None
    specialties: Optional[str] = None
    is_active: Optional[bool] = None


# ============================================
# HELPER
# ============================================

def provider_to_dict(p: TrainingProvider) -> dict:
    return {
        "id": p.id,
        "tenant_id": p.tenant_id,
        "name": p.name,
        "contact_name": p.contact_name,
        "email": p.email,
        "phone": p.phone,
        "website": p.website,
        "type": p.type.value if hasattr(p.type, 'value') else p.type,
        "specialties": p.specialties,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ============================================
# ENDPOINTS
# ============================================

@router.get("/providers")
def list_providers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste tous les fournisseurs du tenant (Admin/RH uniquement)"""
    require_rh_access(current_user)
    providers = db.query(TrainingProvider).filter(
        TrainingProvider.tenant_id == current_user.tenant_id
    ).order_by(TrainingProvider.name).all()
    return [provider_to_dict(p) for p in providers]


@router.post("/providers", status_code=201)
def create_provider(
    data: ProviderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer un fournisseur de formation"""
    require_rh_access(current_user)
    provider = TrainingProvider(
        tenant_id=current_user.tenant_id,
        name=data.name,
        contact_name=data.contact_name,
        email=data.email,
        phone=data.phone,
        website=data.website,
        type=data.type,
        specialties=data.specialties,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider_to_dict(provider)


@router.put("/providers/{provider_id}")
def update_provider(
    provider_id: int,
    data: ProviderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Modifier un fournisseur"""
    require_rh_access(current_user)
    provider = db.query(TrainingProvider).filter(
        TrainingProvider.id == provider_id,
        TrainingProvider.tenant_id == current_user.tenant_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    for field, value in data.dict(exclude_none=True).items():
        setattr(provider, field, value)
    provider.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(provider)
    return provider_to_dict(provider)


@router.delete("/providers/{provider_id}")
def deactivate_provider(
    provider_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Désactiver un fournisseur (soft delete)"""
    require_rh_access(current_user)
    provider = db.query(TrainingProvider).filter(
        TrainingProvider.id == provider_id,
        TrainingProvider.tenant_id == current_user.tenant_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    provider.is_active = False
    provider.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Fournisseur désactivé"}
