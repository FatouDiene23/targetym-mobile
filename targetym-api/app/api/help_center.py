"""
API endpoints publics pour le centre d'aide
Accessible sans authentification
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from app.core.database import get_db
from app.models.help_center import HelpCategory, HelpArticle, ArticleFeedback
from app.schemas.help_center import (
    HelpCategoryResponse,
    HelpArticleListItem,
    HelpArticleDetail,
    ArticleFeedbackCreate,
    ArticleFeedbackResponse,
    HelpSearchResult
)

router = APIRouter()


# ============================================
# CATÉGORIES
# ============================================

@router.get("/categories", response_model=List[HelpCategoryResponse])
async def get_categories(
    published_only: bool = True,
    db: Session = Depends(get_db)
):
    """
    Liste toutes les catégories du centre d'aide
    Par défaut, retourne uniquement les catégories publiées
    """
    query = db.query(HelpCategory)
    
    if published_only:
        query = query.filter(HelpCategory.is_published == True)
    
    categories = query.order_by(HelpCategory.order.asc(), HelpCategory.name.asc()).all()
    
    # Ajouter le compteur d'articles pour chaque catégorie
    result = []
    for cat in categories:
        count = db.query(HelpArticle).filter(
            HelpArticle.category_id == cat.id,
            HelpArticle.is_published == True
        ).count()
        
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "icon": cat.icon,
            "description": cat.description,
            "order": cat.order,
            "is_published": cat.is_published,
            "created_at": cat.created_at,
            "updated_at": cat.updated_at,
            "article_count": count
        }
        result.append(HelpCategoryResponse(**cat_dict))
    
    return result


@router.get("/categories/{slug}", response_model=HelpCategoryResponse)
async def get_category_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """Récupère une catégorie par son slug"""
    category = db.query(HelpCategory).filter(HelpCategory.slug == slug).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )
    
    count = db.query(HelpArticle).filter(
        HelpArticle.category_id == category.id,
        HelpArticle.is_published == True
    ).count()
    
    return HelpCategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        icon=category.icon,
        description=category.description,
        order=category.order,
        is_published=category.is_published,
        created_at=category.created_at,
        updated_at=category.updated_at,
        article_count=count
    )


# ============================================
# ARTICLES
# ============================================

@router.get("/articles", response_model=List[HelpArticleListItem])
async def get_articles(
    category_slug: Optional[str] = None,
    published_only: bool = True,
    limit: int = Query(default=50, le=100),
    db: Session = Depends(get_db)
):
    """
    Liste les articles
    Peut filtrer par catégorie via le slug
    """
    query = db.query(HelpArticle)
    
    if published_only:
        query = query.filter(HelpArticle.is_published == True)
    
    if category_slug:
        category = db.query(HelpCategory).filter(HelpCategory.slug == category_slug).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Catégorie non trouvée"
            )
        query = query.filter(HelpArticle.category_id == category.id)
    
    articles = query.order_by(
        HelpArticle.order.asc(),
        HelpArticle.created_at.desc()
    ).limit(limit).all()
    
    return articles


@router.get("/articles/{slug}", response_model=HelpArticleDetail)
async def get_article_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """
    Récupère un article par son slug
    Incrémente automatiquement le compteur de vues
    """
    article = db.query(HelpArticle).filter(HelpArticle.slug == slug).first()
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouvé"
        )
    
    # Incrémenter le compteur de vues
    article.views_count += 1
    db.commit()
    
    # Calculer les stats de feedback
    helpful_count = db.query(ArticleFeedback).filter(
        ArticleFeedback.article_id == article.id,
        ArticleFeedback.is_helpful == True
    ).count()
    
    not_helpful_count = db.query(ArticleFeedback).filter(
        ArticleFeedback.article_id == article.id,
        ArticleFeedback.is_helpful == False
    ).count()
    
    return HelpArticleDetail(
        id=article.id,
        category_id=article.category_id,
        title=article.title,
        slug=article.slug,
        excerpt=article.excerpt,
        content=article.content,
        cover_image_url=article.cover_image_url,
        video_url=article.video_url,
        is_published=article.is_published,
        order=article.order,
        views_count=article.views_count,
        created_at=article.created_at,
        updated_at=article.updated_at,
        created_by=article.created_by,
        updated_by=article.updated_by,
        helpful_count=helpful_count,
        not_helpful_count=not_helpful_count
    )


# ============================================
# RECHERCHE
# ============================================

@router.get("/search", response_model=List[HelpSearchResult])
async def search_articles(
    q: str = Query(..., min_length=2, description="Terme de recherche"),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db)
):
    """
    Recherche dans les articles (titre et contenu)
    """
    # Recherche simple avec LIKE (peut être amélioré avec full-text search)
    search_term = f"%{q}%"
    
    articles = db.query(HelpArticle, HelpCategory).join(
        HelpCategory, HelpArticle.category_id == HelpCategory.id
    ).filter(
        HelpArticle.is_published == True,
        or_(
            HelpArticle.title.ilike(search_term),
            HelpArticle.excerpt.ilike(search_term),
            HelpArticle.content.ilike(search_term)
        )
    ).order_by(HelpArticle.views_count.desc()).limit(limit).all()
    
    results = []
    for article, category in articles:
        results.append(HelpSearchResult(
            id=article.id,
            title=article.title,
            slug=article.slug,
            excerpt=article.excerpt,
            category_name=category.name,
            category_slug=category.slug
        ))
    
    return results


# ============================================
# FEEDBACK
# ============================================

@router.post("/feedback", response_model=ArticleFeedbackResponse)
async def create_feedback(
    data: ArticleFeedbackCreate,
    db: Session = Depends(get_db)
):
    """
    Ajoute un feedback utilisateur sur un article
    """
    # Vérifier que l'article existe
    article = db.query(HelpArticle).filter(HelpArticle.id == data.article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouvé"
        )
    
    feedback = ArticleFeedback(
        article_id=data.article_id,
        is_helpful=data.is_helpful,
        comment=data.comment,
        user_email=data.user_email
    )
    
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    return feedback


# ============================================
# ARTICLES POPULAIRES
# ============================================

@router.get("/popular", response_model=List[HelpArticleListItem])
async def get_popular_articles(
    limit: int = Query(default=5, le=20),
    db: Session = Depends(get_db)
):
    """
    Retourne les articles les plus consultés
    """
    articles = db.query(HelpArticle).filter(
        HelpArticle.is_published == True
    ).order_by(HelpArticle.views_count.desc()).limit(limit).all()
    
    return articles
