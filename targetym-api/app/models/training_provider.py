# app/models/training_provider.py
"""
Modèle pour les fournisseurs de formation
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from datetime import datetime
import enum

from app.core.database import Base


class ProviderType(str, enum.Enum):
    interne = "interne"
    externe = "externe"


class TrainingProvider(Base):
    __tablename__ = "training_providers"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    contact_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    website = Column(String(500))
    type = Column(SAEnum(ProviderType, name="provider_type_enum"), nullable=False, default=ProviderType.externe)
    specialties = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
