# =============================================
# MODEL - SalaryHistory
# File: app/models/salary_history.py
# 
# Add to your models __init__.py:
#   from app.models.salary_history import SalaryHistory
# =============================================

from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SalaryHistory(Base):
    """
    Historique des changements de salaire d'un employé.
    Une entrée est créée automatiquement à chaque modification du salaire.
    """
    __tablename__ = "salary_history"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Montants
    effective_date = Column(Date, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="XOF")
    previous_amount = Column(Numeric(12, 2), nullable=True)
    change_percentage = Column(Numeric(5, 2), nullable=True)
    
    # Contexte
    reason = Column(String(255), nullable=True)  # "Embauche", "Augmentation annuelle", "Promotion"
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    employee = relationship("Employee", backref="salary_history_entries")
