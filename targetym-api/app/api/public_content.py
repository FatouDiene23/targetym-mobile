"""
Routes publiques pour le site marketing targetym.ai
Exposent les articles de blog et ressources créés par le superadmintech (tenant_id IS NULL)
Aucune authentification requise.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.blog import BlogPost
from app.models.resource import Resource, ResourceCategory

router = APIRouter(prefix="/api/public", tags=["Public Content - Website"])


# =============================================
# SCHEMAS
# =============================================

class PublicBlogPost(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    author_name: Optional[str] = None
    published_at: Optional[datetime] = None
    views_count: int = 0

    class Config:
        from_attributes = True


class PublicBlogPostFull(PublicBlogPost):
    content: str


class PublicBlogListResponse(BaseModel):
    items: List[PublicBlogPost]
    total: int


class PublicCategory(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    resource_count: int = 0

    class Config:
        from_attributes = True


class PublicResource(BaseModel):
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

    class Config:
        from_attributes = True


class PublicResourcesResponse(BaseModel):
    categories: List[PublicCategory]
    resources: List[PublicResource]
    total: int


# =============================================
# ROUTES BLOG
# =============================================

@router.get("/blog", response_model=PublicBlogListResponse)
def list_public_blog_posts(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Liste les articles publiés par l'équipe Targetym (tenant_id IS NULL).
    Accessible sans authentification depuis le site marketing.
    """
    q = (
        db.query(BlogPost)
        .filter(BlogPost.tenant_id.is_(None), BlogPost.status == "published")
    )
    if category:
        q = q.filter(BlogPost.category == category)
    if search:
        q = q.filter(BlogPost.title.ilike(f"%{search}%"))

    total = q.count()
    posts = q.order_by(desc(BlogPost.published_at), desc(BlogPost.created_at)).offset(skip).limit(limit).all()

    return PublicBlogListResponse(
        items=[
            PublicBlogPost(
                id=p.id,
                title=p.title,
                slug=p.slug,
                excerpt=p.excerpt,
                cover_image_url=p.cover_image_url,
                category=p.category,
                tags=p.tags,
                author_name=None,
                published_at=p.published_at,
                views_count=p.views_count or 0,
            )
            for p in posts
        ],
        total=total,
    )


@router.get("/blog/categories")
def list_public_blog_categories(db: Session = Depends(get_db)):
    """Catégories distinctes des articles publiés (tenant_id IS NULL)."""
    from sqlalchemy import func
    rows = (
        db.query(BlogPost.category, func.count(BlogPost.id).label("count"))
        .filter(
            BlogPost.tenant_id.is_(None),
            BlogPost.status == "published",
            BlogPost.category.isnot(None),
        )
        .group_by(BlogPost.category)
        .order_by(desc("count"))
        .all()
    )
    return [{"category": r[0], "count": r[1]} for r in rows]


@router.get("/blog/{slug}", response_model=PublicBlogPostFull)
def get_public_blog_post(slug: str, db: Session = Depends(get_db)):
    """Retourne un article publié par slug (tenant_id IS NULL)."""
    from fastapi import HTTPException
    post = db.query(BlogPost).filter(
        BlogPost.slug == slug,
        BlogPost.tenant_id.is_(None),
        BlogPost.status == "published",
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Article introuvable")

    # Incrémenter le compteur de vues
    post.views_count = (post.views_count or 0) + 1
    db.commit()

    return PublicBlogPostFull(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        content=post.content,
        cover_image_url=post.cover_image_url,
        category=post.category,
        tags=post.tags,
        author_name=None,
        published_at=post.published_at,
        views_count=post.views_count,
    )


# =============================================
# ROUTES RESSOURCES
# =============================================

@router.get("/resources", response_model=PublicResourcesResponse)
def list_public_resources(
    category_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Liste les ressources publiées par l'équipe Targetym (tenant_id IS NULL).
    Accessible sans authentification depuis le site marketing.
    """
    cats = (
        db.query(ResourceCategory)
        .filter(ResourceCategory.tenant_id.is_(None), ResourceCategory.is_published == True)
        .order_by(ResourceCategory.display_order, ResourceCategory.name)
        .all()
    )

    q = db.query(Resource).filter(
        Resource.tenant_id.is_(None),
        Resource.is_published == True,
    )
    if category_id:
        q = q.filter(Resource.category_id == category_id)
    if search:
        q = q.filter(Resource.title.ilike(f"%{search}%"))

    resources = q.order_by(Resource.display_order, Resource.title).all()

    # Map category id → name
    cat_map = {c.id: c.name for c in cats}

    public_cats = []
    for c in cats:
        count = sum(1 for r in resources if r.category_id == c.id)
        public_cats.append(PublicCategory(
            id=c.id,
            name=c.name,
            description=c.description,
            cover_image_url=c.cover_image_url,
            resource_count=count,
        ))

    public_resources = [
        PublicResource(
            id=r.id,
            title=r.title,
            description=r.description,
            video_url=r.video_url,
            file_url=r.file_url,
            thumbnail_url=r.thumbnail_url,
            resource_type=r.resource_type or "video",
            duration_minutes=r.duration_minutes,
            category_id=r.category_id,
            category_name=cat_map.get(r.category_id) if r.category_id else None,
        )
        for r in resources
    ]

    return PublicResourcesResponse(
        categories=public_cats,
        resources=public_resources,
        total=len(public_resources),
    )
