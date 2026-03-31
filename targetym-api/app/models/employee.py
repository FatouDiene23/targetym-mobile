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


class Gender(str, enum.Enum):
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
    employee = "employee"      # Collaborateur standard
    manager = "manager"        # Manager d'équipe
    rh = "rh"                  # Équipe RH
    admin = "admin"            # Administrateur (DAF, etc.)
    dg = "dg"                  # Direction Générale / CODIR


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
    gender = Column(Enum(Gender), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    nationality = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    
    # Informations professionnelles
    job_title = Column(String(200), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    is_manager = Column(Boolean, default=False)
    is_juriste = Column(Boolean, default=False, server_default="false")
    role = Column(Enum(EmployeeRole), default=EmployeeRole.employee)
    site = Column(String(200), nullable=True)
    classification = Column(String(100), nullable=True)
    coefficient = Column(String(50), nullable=True)
    probation_end_date = Column(Date, nullable=True)
    contract_end_date = Column(Date, nullable=True)
    
    # Contrat
    contract_type = Column(Enum(ContractType), nullable=True)
    hire_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    
    # Rémunération
    salary = Column(Numeric(15, 2), nullable=True)  # Salaire brut (legacy)
    net_salary = Column(Numeric(15, 2), nullable=True)  # Salaire net (legacy)
    salaire_brut = Column(Numeric(15, 2), nullable=True)  # Salaire brut mensuel
    part_variable = Column(Numeric(15, 2), nullable=True)  # Part variable / prime
    currency = Column(String(10), default="XOF")
    
    # Statut
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE)
    
    # ============================================
    # Gestion des invitations
    # ============================================
    invitation_sent_at = Column(DateTime(timezone=True), nullable=True)
    invitation_token = Column(String(255), nullable=True)
    
    # ============================================
    # Signature électronique
    # ============================================
    signature_url = Column(Text, nullable=True)  # Data URL base64 de la signature dessinée

    # ============================================
    # Information familiale
    # ============================================
    marital_status = Column(String(50), nullable=True)       # Situation matrimoniale
    spouse_name = Column(String(200), nullable=True)         # Conjoint(e) Nom & Prénom
    spouse_birth_date = Column(Date, nullable=True)          # Conjoint(e) Date de naissance

    # ============================================
    # Adresse professionnelle
    # ============================================
    work_email = Column(String(255), nullable=True)          # Email professionnel
    work_phone = Column(String(50), nullable=True)           # Téléphone professionnel

    # ============================================
    # Information médicale
    # ============================================
    has_disability = Column(Boolean, default=False, nullable=True)
    disability_description = Column(Text, nullable=True)

    # ============================================
    # Contact d'urgence
    # ============================================
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)

    # ============================================
    # Organisation
    # ============================================
    comex_member = Column(String(200), nullable=True)        # Membre COMEX (Nom & Prénom)
    hrbp = Column(String(200), nullable=True)                # HRBP (Nom & Prénom)
    salary_category = Column(String(100), nullable=True)     # Catégorie salariale

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    department = relationship("Department", foreign_keys=[department_id])
    manager = relationship("Employee", remote_side=[id], foreign_keys=[manager_id])

    # Contentieux
    labor_disputes = relationship("LaborDispute", foreign_keys="[LaborDispute.employee_id]", back_populates="employee")
    assigned_disputes = relationship("LaborDispute", foreign_keys="[LaborDispute.assigned_to_id]", back_populates="assigned_to")

    def __repr__(self):
        return f"<Employee {self.first_name} {self.last_name}>"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"