# app/models/task.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class TaskStatus(str, enum.Enum):
    PENDING = "pending"           # À faire
    IN_PROGRESS = "in_progress"   # En cours
    COMPLETED = "completed"       # Terminée
    CANCELLED = "cancelled"       # Annulée


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskSource(str, enum.Enum):
    """Source de la tâche"""
    MANUAL = "manual"               # Créée dans TARGETYM
    DAILY_CHECKLIST = "daily_checklist"  # Injectée depuis le template daily checklist
    ASANA = "asana"
    JIRA = "jira"
    NOTION = "notion"
    TRELLO = "trello"
    MONDAY = "monday"
    OTHER = "other"


class DailyValidationStatus(str, enum.Enum):
    PENDING = "pending"       # En attente de validation
    APPROVED = "approved"     # Validée par le manager
    REJECTED = "rejected"     # Rejetée


class Task(Base):
    """Modèle pour les tâches des employés"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Contenu de la tâche
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Assignation
    assigned_to_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)  # À qui
    created_by_id = Column(Integer, ForeignKey("employees.id"), nullable=False)  # Par qui
    
    # Dates
    due_date = Column(Date, nullable=False)  # Date d'échéance
    completed_at = Column(DateTime(timezone=True), nullable=True)  # Quand terminée
    
    # Statut et priorité - UTILISER LES VALEURS STRING DIRECTEMENT
    status = Column(String(20), default="pending", nullable=False)
    priority = Column(String(20), default="medium", nullable=False)
    
    # Pour la validation journalière
    completion_note = Column(Text, nullable=True)  # Note lors de la complétion
    incomplete_reason = Column(Text, nullable=True)  # Justification si non terminée
    
    # ============================================
    # SOURCE EXTERNE (Asana, Jira, etc.)
    # ============================================
    source = Column(String(20), default="manual", nullable=False, index=True)
    external_id = Column(String(255), nullable=True, index=True)   # ID dans Asana/Jira/etc
    external_url = Column(String(500), nullable=True)              # Lien direct vers la tâche
    last_synced_at = Column(DateTime(timezone=True), nullable=True)  # Dernière sync
    
    # ============================================
    # LIEN AVEC OKRs
    # ============================================
    objective_id = Column(Integer, ForeignKey("objectives.id", ondelete="SET NULL"), nullable=True, index=True)
    key_result_id = Column(Integer, ForeignKey("key_results.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Tâche administrative (sans lien OKR obligatoire)
    is_administrative = Column(Boolean, default=False, nullable=False)
    
    # ============================================
    # DAILY CHECKLIST
    # ============================================
    checklist_item_id = Column(
        Integer,
        ForeignKey("daily_checklist_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # ============================================

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relations OKR
    objective = relationship("Objective", backref="tasks")
    key_result = relationship("KeyResult", backref="tasks")

    def __repr__(self):
        return f"<Task {self.title}>"
    
    @property
    def is_overdue(self) -> bool:
        """Vérifie si la tâche est en retard"""
        if self.status == "completed":
            return False
        from datetime import date
        return self.due_date < date.today()
    
    @property
    def is_external(self) -> bool:
        """Vérifie si la tâche vient d'une source externe"""
        return self.source != "manual"


class DailyValidation(Base):
    """Validation journalière par le manager"""
    __tablename__ = "daily_validations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Qui soumet
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    
    # Pour quelle date
    validation_date = Column(Date, nullable=False)
    
    # Statut
    status = Column(String(20), default="pending", nullable=False)
    
    # Soumission
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    submission_note = Column(Text, nullable=True)  # Note de l'employé
    
    # Validation par le manager
    validated_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    validation_comment = Column(Text, nullable=True)  # Commentaire du manager
    
    # Stats au moment de la soumission
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<DailyValidation {self.employee_id} - {self.validation_date}>"
    
    @property
    def completion_rate(self) -> float:
        """Taux de complétion des tâches"""
        if self.total_tasks == 0:
            return 0
        return round((self.completed_tasks / self.total_tasks) * 100, 1)