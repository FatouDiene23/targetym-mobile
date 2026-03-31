# app/models/daily_checklist.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DailyChecklistItem(Base):
    """
    Template de daily checklist par employé.
    Créé par le manager, injecté chaque jour dans my-space/tasks.
    """
    __tablename__ = "daily_checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Pour qui / par qui
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    # Contenu
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="medium", nullable=False)

    # Jours actifs: "monday,tuesday,wednesday,thursday,friday"
    days_of_week = Column(
        String(100),
        nullable=False,
        default="monday,tuesday,wednesday,thursday,friday"
    )

    # Lien OKR (optionnel)
    objective_id = Column(
        Integer,
        ForeignKey("objectives.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    key_result_id = Column(
        Integer,
        ForeignKey("key_results.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Valeur ajoutée au KR current lors de la complétion (Option A)
    kr_contribution = Column(Float, nullable=True)

    # Ordre d'affichage
    order = Column(Integer, default=0, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<DailyChecklistItem '{self.title}' → emp {self.employee_id}>"
