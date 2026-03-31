"""
Modèle SupportAuditLog - Traçabilité des actions SUPER_ADMIN
Chaque action VIEW / IMPERSONATE / EDIT / RESET est loggée.
"""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class SupportAuditLog(Base):
    __tablename__ = "support_audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Agent (SUPER_ADMIN qui effectue l'action)
    agent_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    agent_email = Column(String(255), nullable=False)  # Dénormalisé pour historique

    # Cible (optionnel si action globale)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_user_email = Column(String(255), nullable=True)

    # Tenant concerné (optionnel)
    target_tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    target_tenant_name = Column(String(255), nullable=True)

    # Action
    action_type = Column(String(50), nullable=False)  # VIEW | IMPERSONATE | EDIT | RESET | DELETE
    action_detail = Column(JSON, nullable=True)       # Détails libres (champs modifiés, raison, etc.)

    # Contexte réseau
    ip_address = Column(String(50), nullable=True)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<AuditLog {self.action_type} by {self.agent_email} at {self.created_at}>"
