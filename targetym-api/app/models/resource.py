# app/models/resource.py
"""
Modèles Ressources — Catégories et vidéos de formation.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ResourceCategory(Base):
    """Catégorie de ressource (regroupement thématique de vidéos)."""
    __tablename__ = "resource_categories"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)

    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    display_order = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    resources = relationship("Resource", back_populates="category", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ResourceCategory #{self.id} '{self.name}'>"


class Resource(Base):
    """Vidéo ou ressource de formation."""
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)

    category_id = Column(Integer, ForeignKey("resource_categories.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    video_url = Column(String(500), nullable=True)   # YouTube / Vimeo / etc.
    file_url = Column(String(500), nullable=True)    # PDF ou autre fichier
    thumbnail_url = Column(String(500), nullable=True)

    resource_type = Column(String(30), default="video")
    # video | pdf | link | article

    duration_minutes = Column(Integer, nullable=True)   # Durée estimée
    display_order = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)
    views_count = Column(Integer, default=0)

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    category = relationship("ResourceCategory", back_populates="resources")
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self):
        return f"<Resource #{self.id} '{self.title}' type={self.resource_type}>"
