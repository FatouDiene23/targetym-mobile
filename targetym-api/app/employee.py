from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Enum, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"
    SUSPENDED = "suspended"
    PROBATION = "probation"


class GenderType(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class ContractType(str, enum.Enum):
    CDI = "cdi"
    CDD = "cdd"
    STAGE = "stage"
    ALTERNANCE = "alternance"
    CONSULTANT = "consultant"
    INTERIM = "interim"


class EmployeeRole(str, enum.Enum):
    """Rôle de l'employé dans l'organisation"""
    EMPLOYEE = "employee"      # Collaborateur standard
    MANAGER = "manager"        # Manager d'équipe
    RH = "rh"                  # Équipe RH
    ADMIN = "admin"            # Administrateur (DAF, etc.)
    DG = "dg"                  # Direction Générale / CODIR


class Employee(Base):
    """Modèle employé - Dossier RH complet"""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Identifiant unique dans l'entreprise
    employee_id = Column(String(50), nullable=True)  # Matricule
    
    # Informations personnelles
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    gender = Column(Enum(GenderType), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    nationality = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    
    # Informations professionnelles
    job_title = Column(String(200), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    is_manager = Column(Boolean, default=False)
    role = Column(Enum(EmployeeRole), default=EmployeeRole.EMPLOYEE)  # NOUVEAU
    site = Column(String(200), nullable=True)
    
    # Contrat
    contract_type = Column(Enum(ContractType), nullable=True)
    hire_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    probation_end_date = Column(Date, nullable=True)
    
    # Rémunération
    salary = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(10), default="XOF")
    
    # Statut
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    department = relationship("Department", foreign_keys=[department_id])
    manager = relationship("Employee", remote_side=[id], foreign_keys=[manager_id])

    def __repr__(self):
        return f"<Employee {self.first_name} {self.last_name}>"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
