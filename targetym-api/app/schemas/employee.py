from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.models.employee import ContractType, EmployeeStatus, Gender


class EmployeeCreate(BaseModel):
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    is_manager: Optional[bool] = False
    role: Optional[str] = "employee"
    site: Optional[str] = None
    contract_type: ContractType = ContractType.CDI
    hire_date: Optional[date] = None
    end_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    salary: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    salaire_brut: Optional[Decimal] = None
    part_variable: Optional[Decimal] = None
    currency: str = "XOF"
    classification: Optional[str] = None
    coefficient: Optional[str] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    probation_end_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    # Famille
    marital_status: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_birth_date: Optional[date] = None
    # Adresse pro
    work_email: Optional[str] = None
    work_phone: Optional[str] = None
    # Médical
    has_disability: Optional[bool] = None
    disability_description: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Organisation
    comex_member: Optional[str] = None
    hrbp: Optional[str] = None
    salary_category: Optional[str] = None
    # Juridique
    is_juriste: Optional[bool] = False


class EmployeeUpdate(BaseModel):
    """Pour compatibilité avec les imports existants"""
    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    is_manager: Optional[bool] = None
    role: Optional[str] = None
    site: Optional[str] = None
    contract_type: Optional[ContractType] = None
    hire_date: Optional[date] = None
    end_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    salary: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    salaire_brut: Optional[Decimal] = None
    part_variable: Optional[Decimal] = None
    currency: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    classification: Optional[str] = None
    coefficient: Optional[str] = None
    # Famille
    marital_status: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_birth_date: Optional[date] = None
    # Adresse pro
    work_email: Optional[str] = None
    work_phone: Optional[str] = None
    # Médical
    has_disability: Optional[bool] = None
    disability_description: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Organisation
    comex_member: Optional[str] = None
    hrbp: Optional[str] = None
    salary_category: Optional[str] = None
    # Juridique
    is_juriste: Optional[bool] = None


class EmployeeUpdateByRH(BaseModel):
    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    is_manager: Optional[bool] = None
    role: Optional[str] = None
    site: Optional[str] = None
    contract_type: Optional[ContractType] = None
    hire_date: Optional[date] = None
    end_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    salary: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    salaire_brut: Optional[Decimal] = None
    part_variable: Optional[Decimal] = None
    currency: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    classification: Optional[str] = None
    coefficient: Optional[str] = None
    # Famille
    marital_status: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_birth_date: Optional[date] = None
    # Adresse pro
    work_email: Optional[str] = None
    work_phone: Optional[str] = None
    # Médical
    has_disability: Optional[bool] = None
    disability_description: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Organisation
    comex_member: Optional[str] = None
    hrbp: Optional[str] = None
    salary_category: Optional[str] = None
    # Juridique
    is_juriste: Optional[bool] = None


class EmployeeUpdateBySelf(BaseModel):
    """Champs que l'employé peut modifier lui-même"""
    phone: Optional[str] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: int
    tenant_id: int
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    is_manager: Optional[bool] = False
    is_active: Optional[bool] = True
    role: Optional[str] = "employee"
    site: Optional[str] = None
    contract_type: Optional[ContractType] = None
    hire_date: Optional[date] = None
    end_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    salary: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    salaire_brut: Optional[Decimal] = None
    part_variable: Optional[Decimal] = None
    currency: Optional[str] = "XOF"
    classification: Optional[str] = None
    coefficient: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    probation_end_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    # Famille
    marital_status: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_birth_date: Optional[date] = None
    # Adresse pro
    work_email: Optional[str] = None
    work_phone: Optional[str] = None
    # Médical
    has_disability: Optional[bool] = None
    disability_description: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Organisation
    comex_member: Optional[str] = None
    hrbp: Optional[str] = None
    salary_category: Optional[str] = None
    # Juridique
    is_juriste: Optional[bool] = False

    class Config:
        from_attributes = True


class EmployeeListResponse(BaseModel):
    """Version allégée pour les listes"""
    id: int
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    is_manager: Optional[bool] = False
    is_active: Optional[bool] = True
    role: Optional[str] = "employee"
    site: Optional[str] = None
    contract_type: Optional[ContractType] = None
    hire_date: Optional[date] = None
    salary: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    salaire_brut: Optional[Decimal] = None
    part_variable: Optional[Decimal] = None
    currency: Optional[str] = "XOF"
    classification: Optional[str] = None
    coefficient: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    photo_url: Optional[str] = None
    # Champs étendus (nécessaires pour l'affichage dans le profil)
    marital_status: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_birth_date: Optional[date] = None
    work_email: Optional[str] = None
    work_phone: Optional[str] = None
    has_disability: Optional[bool] = None
    disability_description: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    comex_member: Optional[str] = None
    hrbp: Optional[str] = None
    salary_category: Optional[str] = None
    # Juridique
    is_juriste: Optional[bool] = False

    class Config:
        from_attributes = True


class EmployeesPageResponse(BaseModel):
    items: List[EmployeeListResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class EmployeeStats(BaseModel):
    total: int
    active: int
    inactive: Optional[int] = 0
    on_leave: Optional[int] = 0
    probation: Optional[int] = 0
    managers: Optional[int] = 0
    top_managers: Optional[int] = 0
    female: Optional[int] = 0
    male: Optional[int] = 0
    new_this_month: Optional[int] = 0
    by_department: Optional[dict] = {}
    by_gender: Optional[dict] = {}
    by_contract_type: Optional[dict] = {}