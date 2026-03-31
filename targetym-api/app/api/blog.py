# =============================================
# API ROUTES - Blog de l'entreprise
# File: app/api/blog.py
# =============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import logging
import re

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.blog import BlogPost
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/blog", tags=["Blog"])

EDITOR_ROLES = [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.MANAGER, UserRole.SUPER_ADMIN]
ADMIN_ROLES  = [UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPER_ADMIN]


# =============================================
# SCHEMAS
# =============================================

class BlogPostCreate(BaseModel):
    title: str
    excerpt: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    status: str = "draft"  # draft | published


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = None


class BlogPostResponse(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    status: str
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    published_at: Optional[datetime] = None
    views_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlogListResponse(BaseModel):
    items: List[BlogPostResponse]
    total: int


# =============================================
# HELPERS
# =============================================

def _slugify(text: str) -> str:
    """Convertit un titre en slug URL-safe."""
    text = text.lower().strip()
    text = re.sub(r"[àáâãäå]", "a", text)
    text = re.sub(r"[éèêë]", "e", text)
    text = re.sub(r"[ïîì]", "i", text)
    text = re.sub(r"[ôóòõö]", "o", text)
    text = re.sub(r"[ûúùü]", "u", text)
    text = re.sub(r"[ç]", "c", text)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = text.strip("-")
    return text[:280]


def _make_unique_slug(db: Session, tenant_id: int, base_slug: str, exclude_id: Optional[int] = None) -> str:
    """Rend le slug unique dans le tenant (ajoute -N si besoin)."""
    slug = base_slug
    counter = 1
    while True:
        q = db.query(BlogPost).filter(
            BlogPost.tenant_id == tenant_id,
            BlogPost.slug == slug
        )
        if exclude_id:
            q = q.filter(BlogPost.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def _format_post(post: BlogPost, db: Session) -> BlogPostResponse:
    """Formate un post avec le nom de l'auteur."""
    author_name = None
    if post.author_id:
        author = db.query(User).filter(User.id == post.author_id).first()
        if author:
            author_name = f"{author.first_name or ''} {author.last_name or ''}".strip() or author.email
    return BlogPostResponse(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        content=post.content,
        cover_image_url=post.cover_image_url,
        category=post.category,
        tags=post.tags,
        status=post.status,
        author_id=post.author_id,
        author_name=author_name,
        published_at=post.published_at,
        views_count=post.views_count or 0,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


# =============================================
# ROUTES
# =============================================

@router.get("", response_model=BlogListResponse)
def list_posts(
    status: Optional[str] = Query(None, description="draft | published"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les articles du blog du tenant.
    - Rôle standard : uniquement les posts publiés.
    - Éditeur/Admin : voit aussi les brouillons.
    """
    q = db.query(BlogPost).filter(BlogPost.tenant_id == current_user.tenant_id)

    # Filtre statut selon rôle
    if current_user.role not in EDITOR_ROLES:
        q = q.filter(BlogPost.status == "published")
    elif status:
        q = q.filter(BlogPost.status == status)

    if category:
        q = q.filter(BlogPost.category == category)
    if search:
        q = q.filter(BlogPost.title.ilike(f"%{search}%"))

    total = q.count()
    posts = q.order_by(desc(BlogPost.published_at), desc(BlogPost.created_at)).offset(skip).limit(limit).all()

    return BlogListResponse(
        items=[_format_post(p, db) for p in posts],
        total=total,
    )


@router.get("/categories")
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les catégories distinctes utilisées dans les posts publiés."""
    rows = (
        db.query(BlogPost.category, func.count(BlogPost.id).label("count"))
        .filter(
            BlogPost.tenant_id == current_user.tenant_id,
            BlogPost.status == "published",
            BlogPost.category.isnot(None),
        )
        .group_by(BlogPost.category)
        .order_by(desc("count"))
        .all()
    )
    return [{"category": r[0], "count": r[1]} for r in rows]


@router.get("/{slug}", response_model=BlogPostResponse)
def get_post(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Récupère un article par son slug. Incrémente le compteur de vues."""
    post = db.query(BlogPost).filter(
        BlogPost.tenant_id == current_user.tenant_id,
        BlogPost.slug == slug,
    ).first()

    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")

    # Les non-éditeurs ne voient pas les brouillons
    if post.status != "published" and current_user.role not in EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Article non publié")

    # Incrémenter vues (seulement pour les posts publiés)
    if post.status == "published":
        post.views_count = (post.views_count or 0) + 1
        db.commit()
        db.refresh(post)

    return _format_post(post, db)


@router.post("", response_model=BlogPostResponse, status_code=201)
def create_post(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée un nouvel article (RH, Admin, DG, Manager, Super Admin)."""
    if current_user.role not in EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Vous n'avez pas les droits pour créer un article")

    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Le titre ne peut pas être vide")
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Le contenu ne peut pas être vide")
    if payload.status not in ("draft", "published"):
        raise HTTPException(status_code=400, detail="Statut invalide (draft | published)")

    base_slug = _slugify(payload.title)
    slug = _make_unique_slug(db, current_user.tenant_id, base_slug)

    published_at = datetime.utcnow() if payload.status == "published" else None

    post = BlogPost(
        tenant_id=current_user.tenant_id,
        title=payload.title.strip(),
        slug=slug,
        excerpt=payload.excerpt,
        content=payload.content,
        cover_image_url=payload.cover_image_url,
        category=payload.category,
        tags=payload.tags,
        status=payload.status,
        author_id=current_user.id,
        published_at=published_at,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    logger.info("BlogPost créé id=%s tenant=%s par user=%s", post.id, current_user.tenant_id, current_user.id)
    return _format_post(post, db)


@router.put("/{post_id}", response_model=BlogPostResponse)
def update_post(
    post_id: int,
    payload: BlogPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour un article (RH, Admin, DG, Manager, Super Admin)."""
    if current_user.role not in EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    post = db.query(BlogPost).filter(
        BlogPost.id == post_id,
        BlogPost.tenant_id == current_user.tenant_id,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")

    if payload.title is not None:
        payload.title = payload.title.strip()
        if not payload.title:
            raise HTTPException(status_code=400, detail="Le titre ne peut pas être vide")
        base_slug = _slugify(payload.title)
        post.slug = _make_unique_slug(db, current_user.tenant_id, base_slug, exclude_id=post_id)
        post.title = payload.title

    if payload.content is not None:
        post.content = payload.content
    if payload.excerpt is not None:
        post.excerpt = payload.excerpt
    if payload.cover_image_url is not None:
        post.cover_image_url = payload.cover_image_url
    if payload.category is not None:
        post.category = payload.category
    if payload.tags is not None:
        post.tags = payload.tags

    if payload.status is not None:
        if payload.status not in ("draft", "published"):
            raise HTTPException(status_code=400, detail="Statut invalide")
        if payload.status == "published" and post.status != "published":
            post.published_at = datetime.utcnow()
        post.status = payload.status

    db.commit()
    db.refresh(post)
    return _format_post(post, db)


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime un article (RH, Admin, DG, Super Admin)."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Droits insuffisants pour supprimer")

    post = db.query(BlogPost).filter(
        BlogPost.id == post_id,
        BlogPost.tenant_id == current_user.tenant_id,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")

    db.delete(post)
    db.commit()
    logger.info("BlogPost supprimé id=%s tenant=%s par user=%s", post_id, current_user.tenant_id, current_user.id)
    return {"success": True, "message": "Article supprimé"}
