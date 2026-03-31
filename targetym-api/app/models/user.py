from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"  # Admin TARGETYM (accès tous tenants)
    ADMIN = "admin"              # Admin entreprise
    DG = "dg"                    # Directeur Général (groupe/filiale)
    RH = "rh"                    # Responsable RH
    MANAGER = "manager"          # Manager d'équipe
    EMPLOYEE = "employee"        # Collaborateur
    RECRUITER = "recruiter"      # Accès recrutement
    VIEWER = "viewer"            # Lecture seule


class User(Base):
    """Modèle utilisateur pour l'authentification"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Profile
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    
    # Role & Tenant
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    
    # Lien avec Employee (si c'est un collaborateur)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # 2FA TOTP
    totp_secret = Column(String(64), nullable=True)
    totp_enabled = Column(Boolean, default=False)

    # Password reset
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    # App Tour (guide applicatif)
    has_completed_app_tour = Column(Boolean, default=False)
    app_tour_completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<User {self.email}>"
    
    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.email.split("@")[0]