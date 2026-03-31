# app/models/okr.py

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class ObjectiveLevel(str, enum.Enum):
    ENTERPRISE = "enterprise"
    DEPARTMENT = "department"
    INDIVIDUAL = "individual"


class ObjectiveStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    BEHIND = "behind"
    EXCEEDED = "exceeded"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Objective(Base):
    __tablename__ = "objectives"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Infos principales
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(Enum(ObjectiveLevel), nullable=False, default=ObjectiveLevel.INDIVIDUAL)
    
    # Propriétaire et département
    owner_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Hiérarchie (pour alignement stratégique)
    parent_id = Column(Integer, ForeignKey("objectives.id"), nullable=True)
    
    # Période
    period = Column(String(50), nullable=False)  # Ex: "2024", "Q4 2024", "2024-Q4"
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    
    # Progression et statut
    progress = Column(Float, default=0)  # 0-100
    status = Column(Enum(ObjectiveStatus), nullable=False, default=ObjectiveStatus.DRAFT)
    
    # Métadonnées
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relations
    owner = relationship("Employee", foreign_keys=[owner_id], backref="objectives")
    department = relationship("Department", backref="objectives")
    parent = relationship("Objective", remote_side=[id], backref="children")
    key_results = relationship("KeyResult", back_populates="objective", cascade="all, delete-orphan")
    initiatives = relationship("Initiative", back_populates="objective", cascade="all, delete-orphan")


class KeyResult(Base):
    __tablename__ = "key_results"

    id = Column(Integer, primary_key=True, index=True)
    objective_id = Column(Integer, ForeignKey("objectives.id", ondelete="CASCADE"), nullable=False)
    
    # Infos KR
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Mesure
    target = Column(Float, nullable=False)  # Valeur cible
    current = Column(Float, default=0)  # Valeur actuelle
    unit = Column(String(50), nullable=True)  # Ex: "%", "clients", "M XOF", "jours"
    
    # Poids pour le calcul de progression
    weight = Column(Float, default=100)  # Poids en % (total des KR d'un objectif = 100)
    
    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relations
    objective = relationship("Objective", back_populates="key_results")
    
    @property
    def progress(self) -> float:
        """Calcule la progression du KR en pourcentage"""
        if self.target == 0:
            return 0
        return min((self.current / self.target) * 100, 100)


class InitiativeSource(str, enum.Enum):
    MANUAL = "manual"
    ASANA = "asana"
    NOTION = "notion"
    TRELLO = "trello"
    JIRA = "jira"
    MONDAY = "monday"
    OTHER = "other"


class InitiativeStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    BEHIND = "behind"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Initiative(Base):
    __tablename__ = "initiatives"

    id = Column(Integer, primary_key=True, index=True)
    objective_id = Column(Integer, ForeignKey("objectives.id", ondelete="CASCADE"), nullable=False)
    
    # Infos initiative
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Source externe
    source = Column(Enum(InitiativeSource), default=InitiativeSource.MANUAL)
    external_id = Column(String(255), nullable=True)  # ID dans le système source
    external_url = Column(String(500), nullable=True)  # Lien vers le système source
    
    # Progression et dates
    progress = Column(Float, default=0)  # 0-100
    status = Column(Enum(InitiativeStatus), default=InitiativeStatus.NOT_STARTED)
    due_date = Column(Date, nullable=True)
    
    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relations
    objective = relationship("Objective", back_populates="initiatives")
