from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Department(Base):
    """Modèle pour les départements / unités organisationnelles"""
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#3B82F6")
    
    # Niveau hiérarchique
    # Valeurs: dg, dga, direction_centrale, direction, departement, service
    level = Column(String(50), default="departement", nullable=False)
    
    # Hiérarchie (parent)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Responsable du département
    head_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Department {self.name} ({self.level})>"