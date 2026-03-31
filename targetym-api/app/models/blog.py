# app/models/blog.py
"""
Modèle Blog — Articles et actualités de l'entreprise.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class BlogPost(Base):
    """Article de blog de l'entreprise."""
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    slug = Column(String(300), nullable=False, index=True)  # tenant_id + slug = unique
    excerpt = Column(Text, nullable=True)          # Résumé court
    content = Column(Text, nullable=False)         # Contenu Markdown
    cover_image_url = Column(String(500), nullable=True)

    category = Column(String(100), nullable=True)  # Catégorie libre
    tags = Column(String(500), nullable=True)       # Tags séparés par virgule

    status = Column(String(20), nullable=False, default="draft")
    # draft | published

    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    views_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    author = relationship("User", foreign_keys=[author_id])

    def __repr__(self):
        return f"<BlogPost #{self.id} '{self.title}' status={self.status}>"
