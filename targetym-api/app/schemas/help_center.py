"""
Schémas Pydantic pour le centre d'aide
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ============================================
# CATÉGORIES
# ============================================

class HelpCategoryBase(BaseModel):
    """Base pour les catégories"""
    name: str = Field(..., max_length=100)
    slug: str = Field(..., max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    order: int = Field(default=0)
    is_published: bool = Field(default=True)


class HelpCategoryCreate(HelpCategoryBase):
    """Création d'une catégorie"""
    pass


class HelpCategoryUpdate(BaseModel):
    """Mise à jour d'une catégorie (tous champs optionnels)"""
    name: Optional[str] = Field(None, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    order: Optional[int] = None
    is_published: Optional[bool] = None


class HelpCategoryResponse(HelpCategoryBase):
    """Réponse catégorie"""
    id: int
    created_at: datetime
    updated_at: datetime
    article_count: Optional[int] = 0  # Nombre d'articles dans la catégorie

    class Config:
        from_attributes = True


# ============================================
# ARTICLES
# ============================================

class HelpArticleBase(BaseModel):
    """Base pour les articles"""
    category_id: int
    title: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    excerpt: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = Field(None, max_length=500)
    video_url: Optional[str] = Field(None, max_length=500)
    is_published: bool = Field(default=False)
    order: int = Field(default=0)


class HelpArticleCreate(HelpArticleBase):
    """Création d'un article"""
    pass


class HelpArticleUpdate(BaseModel):
    """Mise à jour d'un article (tous champs optionnels)"""
    category_id: Optional[int] = None
    title: Optional[str] = Field(None, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = Field(None, max_length=500)
    video_url: Optional[str] = Field(None, max_length=500)
    is_published: Optional[bool] = None
    order: Optional[int] = None


class HelpArticleListItem(BaseModel):
    """Article dans une liste (version light)"""
    id: int
    category_id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_published: bool
    views_count: int
    created_at: datetime
    updated_at: datetime
    
    # Stats feedback
    helpful_count: Optional[int] = 0
    not_helpful_count: Optional[int] = 0

    class Config:
        from_attributes = True


class HelpArticleDetail(HelpArticleBase):
    """Article détaillé"""
    id: int
    views_count: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    # Stats feedback
    helpful_count: Optional[int] = 0
    not_helpful_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ============================================
# FEEDBACK
# ============================================

class ArticleFeedbackCreate(BaseModel):
    """Création d'un feedback"""
    article_id: int
    is_helpful: bool
    comment: Optional[str] = None
    user_email: Optional[str] = Field(None, max_length=255)


class ArticleFeedbackResponse(BaseModel):
    """Réponse feedback"""
    id: int
    article_id: int
    is_helpful: bool
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# RECHERCHE
# ============================================

class HelpSearchResult(BaseModel):
    """Résultat de recherche"""
    id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    category_name: str
    category_slug: str
    relevance: Optional[float] = None  # Score de pertinence

    class Config:
        from_attributes = True


# ============================================
# STATISTIQUES
# ============================================

class HelpStatsResponse(BaseModel):
    """Statistiques globales du centre d'aide"""
    total_categories: int
    total_articles: int
    published_articles: int
    draft_articles: int
    total_views: int
    total_feedbacks: int
    helpful_percentage: Optional[float] = None
