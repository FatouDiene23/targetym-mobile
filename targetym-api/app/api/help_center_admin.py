"""
API endpoints admin pour le centre d'aide
RÉSERVÉ aux SUPER_ADMIN (équipe technique uniquement)
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import os
import shutil
from pathlib import Path
from datetime import datetime
from app.core.database import get_db
from app.api.deps import require_super_admin
from app.models.user import User
from app.models.help_center import HelpCategory, HelpArticle, ArticleFeedback
from app.schemas.help_center import (
    HelpCategoryCreate,
    HelpCategoryUpdate,
    HelpCategoryResponse,
    HelpArticleCreate,
    HelpArticleUpdate,
    HelpArticleListItem,
    HelpArticleDetail,
    HelpStatsResponse
)

router = APIRouter()

# Dossier pour stocker les images uploadées
UPLOAD_DIR = Path("/app/public/help-uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ============================================
# CATÉGORIES - ADMIN
# ============================================

@router.get("/categories", response_model=List[HelpCategoryResponse])
async def admin_get_all_categories(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Liste toutes les catégories (publiées et brouillons)"""
    categories = db.query(HelpCategory).order_by(
        HelpCategory.order.asc(),
        HelpCategory.name.asc()
    ).all()
    
    result = []
    for cat in categories:
        count = db.query(HelpArticle).filter(HelpArticle.category_id == cat.id).count()
        result.append(HelpCategoryResponse(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            icon=cat.icon,
            description=cat.description,
            order=cat.order,
            is_published=cat.is_published,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
            article_count=count
        ))
    
    return result


@router.post("/categories", response_model=HelpCategoryResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_category(
    data: HelpCategoryCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Crée une nouvelle catégorie"""
    # Vérifier que le slug n'existe pas déjà
    existing = db.query(HelpCategory).filter(HelpCategory.slug == data.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une catégorie avec ce slug existe déjà"
        )
    
    category = HelpCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    
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
        article_count=0
    )


@router.put("/categories/{category_id}", response_model=HelpCategoryResponse)
async def admin_update_category(
    category_id: int,
    data: HelpCategoryUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Met à jour une catégorie"""
    category = db.query(HelpCategory).filter(HelpCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )
    
    # Vérifier le slug si modifié
    if data.slug and data.slug != category.slug:
        existing = db.query(HelpCategory).filter(HelpCategory.slug == data.slug).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Une catégorie avec ce slug existe déjà"
            )
    
    # Mise à jour
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    
    db.commit()
    db.refresh(category)
    
    count = db.query(HelpArticle).filter(HelpArticle.category_id == category.id).count()
    
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


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_category(
    category_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Supprime une catégorie (et tous ses articles)"""
    category = db.query(HelpCategory).filter(HelpCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )
    
    db.delete(category)
    db.commit()


# ============================================
# ARTICLES - ADMIN
# ============================================

@router.get("/articles", response_model=List[HelpArticleListItem])
async def admin_get_all_articles(
    category_id: int = None,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Liste tous les articles (publiés et brouillons)"""
    query = db.query(HelpArticle)
    
    if category_id:
        query = query.filter(HelpArticle.category_id == category_id)
    
    articles = query.order_by(
        HelpArticle.order.asc(),
        HelpArticle.created_at.desc()
    ).all()
    
    # Calculer les stats de feedback pour chaque article
    result = []
    for article in articles:
        helpful_count = db.query(ArticleFeedback).filter(
            ArticleFeedback.article_id == article.id,
            ArticleFeedback.is_helpful == True
        ).count()
        
        not_helpful_count = db.query(ArticleFeedback).filter(
            ArticleFeedback.article_id == article.id,
            ArticleFeedback.is_helpful == False
        ).count()
        
        result.append(HelpArticleListItem(
            id=article.id,
            category_id=article.category_id,
            title=article.title,
            slug=article.slug,
            excerpt=article.excerpt,
            cover_image_url=article.cover_image_url,
            is_published=article.is_published,
            views_count=article.views_count,
            created_at=article.created_at,
            updated_at=article.updated_at,
            helpful_count=helpful_count,
            not_helpful_count=not_helpful_count
        ))
    
    return result


@router.get("/articles/{article_id}", response_model=HelpArticleDetail)
async def admin_get_article(
    article_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Récupère un article par ID (pas de vue incrémentée)"""
    article = db.query(HelpArticle).filter(HelpArticle.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouvé"
        )
    
    # Stats feedback
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


@router.post("/articles", response_model=HelpArticleDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_article(
    data: HelpArticleCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Crée un nouvel article"""
    # Vérifier que la catégorie existe
    category = db.query(HelpCategory).filter(HelpCategory.id == data.category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )
    
    # Vérifier que le slug n'existe pas déjà
    existing = db.query(HelpArticle).filter(HelpArticle.slug == data.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un article avec ce slug existe déjà"
        )
    
    article = HelpArticle(
        **data.model_dump(),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    db.add(article)
    db.commit()
    db.refresh(article)
    
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
        helpful_count=0,
        not_helpful_count=0
    )


@router.put("/articles/{article_id}", response_model=HelpArticleDetail)
async def admin_update_article(
    article_id: int,
    data: HelpArticleUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Met à jour un article"""
    article = db.query(HelpArticle).filter(HelpArticle.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouvé"
        )
    
    # Vérifier le slug si modifié
    if data.slug and data.slug != article.slug:
        existing = db.query(HelpArticle).filter(HelpArticle.slug == data.slug).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un article avec ce slug existe déjà"
            )
    
    # Mise à jour
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(article, key, value)
    
    article.updated_by = current_user.id
    
    db.commit()
    db.refresh(article)
    
    # Stats feedback
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


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_article(
    article_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Supprime un article"""
    article = db.query(HelpArticle).filter(HelpArticle.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouvé"
        )
    
    db.delete(article)
    db.commit()


# ============================================
# UPLOAD IMAGES
# ============================================

@router.post("/upload-image")
async def admin_upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_super_admin),
):
    """
    Upload une image pour le centre d'aide
    Retourne l'URL de l'image uploadée
    """
    # Vérifier le type de fichier
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de fichier non autorisé. Formats acceptés : JPG, PNG, GIF, WEBP"
        )
    
    # Générer un nom de fichier unique
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    file_extension = Path(file.filename).suffix
    safe_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
    file_path = UPLOAD_DIR / safe_filename
    
    # Enregistrer le fichier
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'upload : {str(e)}"
        )
    
    # Retourner l'URL publique complète (backend AWS)
    app_url = os.getenv("APP_URL", "https://api.targetym.ai").rstrip("/")
    file_url = f"{app_url}/help-uploads/{safe_filename}"
    
    return {
        "url": file_url,
        "filename": safe_filename,
        "message": "Image uploadée avec succès"
    }


# ============================================
# STATISTIQUES
# ============================================

@router.get("/stats", response_model=HelpStatsResponse)
async def admin_get_stats(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Statistiques globales du centre d'aide"""
    total_categories = db.query(HelpCategory).count()
    total_articles = db.query(HelpArticle).count()
    published_articles = db.query(HelpArticle).filter(HelpArticle.is_published == True).count()
    draft_articles = total_articles - published_articles
    
    total_views = db.query(func.sum(HelpArticle.views_count)).scalar() or 0
    total_feedbacks = db.query(ArticleFeedback).count()
    helpful_feedbacks = db.query(ArticleFeedback).filter(ArticleFeedback.is_helpful == True).count()
    
    helpful_percentage = None
    if total_feedbacks > 0:
        helpful_percentage = round((helpful_feedbacks / total_feedbacks) * 100, 1)
    
    return HelpStatsResponse(
        total_categories=total_categories,
        total_articles=total_articles,
        published_articles=published_articles,
        draft_articles=draft_articles,
        total_views=int(total_views),
        total_feedbacks=total_feedbacks,
        helpful_percentage=helpful_percentage
    )
