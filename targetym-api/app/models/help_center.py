"""
Modèles pour le centre d'aide
Articles et catégories accessibles publiquement
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.base import TimestampMixin


class HelpCategory(Base, TimestampMixin):
    """Catégories pour organiser les articles d'aide"""
    __tablename__ = "help_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # ex: "Congés", "OKR", "Recrutement"
    slug = Column(String(100), unique=True, nullable=False, index=True)  # ex: "conges", "okr"
    icon = Column(String(50), nullable=True)  # Nom de l'icône Lucide (ex: "Plane", "Target")
    description = Column(Text, nullable=True)  # Description courte de la catégorie
    order = Column(Integer, default=0)  # Ordre d'affichage
    is_published = Column(Boolean, default=True)  # Visible ou non

    # Relations
    articles = relationship("HelpArticle", back_populates="category", cascade="all, delete-orphan")


class HelpArticle(Base, TimestampMixin):
    """Articles du centre d'aide"""
    __tablename__ = "help_articles"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("help_categories.id"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)  # ex: "Comment poser un congé ?"
    slug = Column(String(255), unique=True, nullable=False, index=True)  # ex: "comment-poser-conge"
    excerpt = Column(Text, nullable=True)  # Résumé court pour la liste
    content = Column(Text, nullable=False)  # Contenu HTML/Markdown riche
    
    cover_image_url = Column(String(500), nullable=True)  # Image de couverture
    video_url = Column(String(500), nullable=True)  # URL embed YouTube/Vimeo
    
    is_published = Column(Boolean, default=False)  # Brouillon ou publié
    order = Column(Integer, default=0)  # Ordre dans la catégorie
    views_count = Column(Integer, default=0)  # Nombre de vues
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Superadmin qui a créé
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Dernier éditeur

    # Relations
    category = relationship("HelpCategory", back_populates="articles")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    feedbacks = relationship("ArticleFeedback", back_populates="article", cascade="all, delete-orphan")


class ArticleFeedback(Base):
    """Feedback utilisateur sur les articles (utile/pas utile)"""
    __tablename__ = "article_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("help_articles.id"), nullable=False, index=True)
    is_helpful = Column(Boolean, nullable=False)  # True = 👍, False = 👎
    comment = Column(Text, nullable=True)  # Commentaire optionnel
    user_email = Column(String(255), nullable=True)  # Email si fourni (optionnel)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relations
    article = relationship("HelpArticle", back_populates="feedbacks")
