# =============================================
# API ROUTES - Ressources de formation (vidéos, PDF, liens)
# File: app/api/resources.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.resource import ResourceCategory, Resource
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resources", tags=["Ressources"])

ADMIN_ROLES = [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPER_ADMIN]


# =============================================
# SCHEMAS
# =============================================

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    display_order: int = 0
    is_published: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    display_order: Optional[int] = None
    is_published: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    display_order: int = 0
    is_published: bool = True
    resource_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    resource_type: str = "video"  # video | pdf | link | article
    duration_minutes: Optional[int] = None
    category_id: Optional[int] = None
    display_order: int = 0
    is_published: bool = True


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    video_url: Optional[str] = None
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    resource_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    category_id: Optional[int] = None
    display_order: Optional[int] = None
    is_published: Optional[bool] = None


class ResourceResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    resource_type: str
    duration_minutes: Optional[int] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    display_order: int = 0
    is_published: bool = True
    views_count: int = 0
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ResourcesListResponse(BaseModel):
    items: List[ResourceResponse]
    total: int


# =============================================
# HELPERS
# =============================================

def _format_resource(r: Resource, db: Session) -> ResourceResponse:
    """Formate une ressource avec les infos de catégorie et créateur."""
    cat_name = None
    if r.category_id:
        cat = db.query(ResourceCategory).filter(ResourceCategory.id == r.category_id).first()
        if cat:
            cat_name = cat.name

    creator_name = None
    if r.created_by_id:
        from app.models.user import User as UserModel
        u = db.query(UserModel).filter(UserModel.id == r.created_by_id).first()
        if u:
            creator_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email

    return ResourceResponse(
        id=r.id,
        title=r.title,
        description=r.description,
        video_url=r.video_url,
        file_url=r.file_url,
        thumbnail_url=r.thumbnail_url,
        resource_type=r.resource_type or "video",
        duration_minutes=r.duration_minutes,
        category_id=r.category_id,
        category_name=cat_name,
        display_order=r.display_order or 0,
        is_published=r.is_published if r.is_published is not None else True,
        views_count=r.views_count or 0,
        created_by_id=r.created_by_id,
        created_by_name=creator_name,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


# =============================================
# ROUTES — CATÉGORIES
# =============================================

@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les catégories de ressources du tenant."""
    q = db.query(ResourceCategory).filter(ResourceCategory.tenant_id == current_user.tenant_id)

    if current_user.role not in ADMIN_ROLES:
        q = q.filter(ResourceCategory.is_published == True)

    categories = q.order_by(ResourceCategory.display_order, ResourceCategory.name).all()

    result = []
    for cat in categories:
        count_q = db.query(Resource).filter(Resource.category_id == cat.id)
        if current_user.role not in ADMIN_ROLES:
            count_q = count_q.filter(Resource.is_published == True)
        result.append(CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            cover_image_url=cat.cover_image_url,
            display_order=cat.display_order or 0,
            is_published=cat.is_published if cat.is_published is not None else True,
            resource_count=count_q.count(),
            created_at=cat.created_at,
        ))
    return result


@router.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée une catégorie de ressource (Admin, RH, DG)."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Le nom ne peut pas être vide")

    cat = ResourceCategory(
        tenant_id=current_user.tenant_id,
        name=payload.name.strip(),
        description=payload.description,
        cover_image_url=payload.cover_image_url,
        display_order=payload.display_order,
        is_published=payload.is_published,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        cover_image_url=cat.cover_image_url,
        display_order=cat.display_order or 0,
        is_published=cat.is_published if cat.is_published is not None else True,
        resource_count=0,
        created_at=cat.created_at,
    )


@router.put("/categories/{cat_id}", response_model=CategoryResponse)
def update_category(
    cat_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour une catégorie."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    cat = db.query(ResourceCategory).filter(
        ResourceCategory.id == cat_id,
        ResourceCategory.tenant_id == current_user.tenant_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")

    if payload.name is not None:
        cat.name = payload.name.strip()
    if payload.description is not None:
        cat.description = payload.description
    if payload.cover_image_url is not None:
        cat.cover_image_url = payload.cover_image_url
    if payload.display_order is not None:
        cat.display_order = payload.display_order
    if payload.is_published is not None:
        cat.is_published = payload.is_published

    db.commit()
    db.refresh(cat)
    count = db.query(Resource).filter(Resource.category_id == cat.id).count()
    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        cover_image_url=cat.cover_image_url,
        display_order=cat.display_order or 0,
        is_published=cat.is_published if cat.is_published is not None else True,
        resource_count=count,
        created_at=cat.created_at,
    )


@router.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime une catégorie et ses ressources associées."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    cat = db.query(ResourceCategory).filter(
        ResourceCategory.id == cat_id,
        ResourceCategory.tenant_id == current_user.tenant_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")

    db.delete(cat)
    db.commit()
    return {"success": True, "message": "Catégorie supprimée"}


# =============================================
# ROUTES — RESSOURCES
# =============================================

@router.get("", response_model=ResourcesListResponse)
def list_resources(
    category_id: Optional[int] = Query(None),
    resource_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_published: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les ressources du tenant (avec filtres optionnels)."""
    q = db.query(Resource).filter(Resource.tenant_id == current_user.tenant_id)

    if current_user.role not in ADMIN_ROLES:
        q = q.filter(Resource.is_published == True)
    elif is_published is not None:
        q = q.filter(Resource.is_published == is_published)

    if category_id is not None:
        q = q.filter(Resource.category_id == category_id)
    if resource_type:
        q = q.filter(Resource.resource_type == resource_type)
    if search:
        q = q.filter(Resource.title.ilike(f"%{search}%"))

    total = q.count()
    resources = q.order_by(Resource.display_order, desc(Resource.created_at)).offset(skip).limit(limit).all()

    return ResourcesListResponse(
        items=[_format_resource(r, db) for r in resources],
        total=total,
    )


@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Récupère une ressource par son ID. Incrémente le compteur de vues."""
    r = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == current_user.tenant_id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    if not r.is_published and current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Ressource non publiée")

    if r.is_published:
        r.views_count = (r.views_count or 0) + 1
        db.commit()
        db.refresh(r)

    return _format_resource(r, db)


@router.post("", response_model=ResourceResponse, status_code=201)
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée une ressource (Admin, RH, DG)."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Le titre ne peut pas être vide")
    if payload.resource_type not in ("video", "pdf", "link", "article"):
        raise HTTPException(status_code=400, detail="Type invalide (video | pdf | link | article)")

    # Vérifier que la catégorie appartient au même tenant
    if payload.category_id:
        cat = db.query(ResourceCategory).filter(
            ResourceCategory.id == payload.category_id,
            ResourceCategory.tenant_id == current_user.tenant_id,
        ).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Catégorie introuvable")

    r = Resource(
        tenant_id=current_user.tenant_id,
        category_id=payload.category_id,
        title=payload.title.strip(),
        description=payload.description,
        video_url=payload.video_url,
        file_url=payload.file_url,
        thumbnail_url=payload.thumbnail_url,
        resource_type=payload.resource_type,
        duration_minutes=payload.duration_minutes,
        display_order=payload.display_order,
        is_published=payload.is_published,
        created_by_id=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    logger.info("Resource créée id=%s tenant=%s par user=%s", r.id, current_user.tenant_id, current_user.id)
    return _format_resource(r, db)


@router.put("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour une ressource."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    r = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == current_user.tenant_id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Ressource introuvable")

    if payload.title is not None:
        r.title = payload.title.strip()
    if payload.description is not None:
        r.description = payload.description
    if payload.video_url is not None:
        r.video_url = payload.video_url
    if payload.file_url is not None:
        r.file_url = payload.file_url
    if payload.thumbnail_url is not None:
        r.thumbnail_url = payload.thumbnail_url
    if payload.resource_type is not None:
        r.resource_type = payload.resource_type
    if payload.duration_minutes is not None:
        r.duration_minutes = payload.duration_minutes
    if payload.category_id is not None:
        cat = db.query(ResourceCategory).filter(
            ResourceCategory.id == payload.category_id,
            ResourceCategory.tenant_id == current_user.tenant_id,
        ).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Catégorie introuvable")
        r.category_id = payload.category_id
    if payload.display_order is not None:
        r.display_order = payload.display_order
    if payload.is_published is not None:
        r.is_published = payload.is_published

    db.commit()
    db.refresh(r)
    return _format_resource(r, db)


@router.delete("/{resource_id}")
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime une ressource."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    r = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == current_user.tenant_id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Ressource introuvable")

    db.delete(r)
    db.commit()
    logger.info("Resource supprimée id=%s tenant=%s par user=%s", resource_id, current_user.tenant_id, current_user.id)
    return {"success": True, "message": "Ressource supprimée"}
