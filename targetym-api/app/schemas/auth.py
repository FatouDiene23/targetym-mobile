from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tenant_slug: Optional[str] = None  # Pour rejoindre un tenant existant


class RegisterTenantRequest(BaseModel):
    """Inscription d'une nouvelle entreprise avec essai gratuit"""
    # Informations entreprise
    company_name: str = Field(..., min_length=2, max_length=255, description="Nom de l'entreprise")
    
    # Informations admin
    email: EmailStr = Field(..., description="Email de l'administrateur")
    password: str = Field(..., min_length=8, description="Mot de passe (min 8 caractères)")
    first_name: str = Field(..., min_length=1, max_length=100, description="Prénom")
    last_name: str = Field(..., min_length=1, max_length=100, description="Nom")
    phone: Optional[str] = Field(None, max_length=50, description="Téléphone (optionnel)")
    job_title: Optional[str] = Field(None, max_length=100, description="Poste (optionnel)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "company_name": "Ma Startup",
                "email": "admin@mastartup.com",
                "password": "motdepasse123",
                "first_name": "Jean",
                "last_name": "Dupont",
                "phone": "+221 77 123 45 67",
                "job_title": "Directeur Général"
            }
        }


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: UserRole
    tenant_id: Optional[int]
    is_active: bool
    created_at: datetime
    employee_id: Optional[int] = None 

    class Config:
        from_attributes = True


class TenantInfoResponse(BaseModel):
    """Informations tenant retournées lors de l'inscription"""
    id: int
    name: str
    slug: str
    trial_ends_at: Optional[str] = None
    trial_days_remaining: Optional[int] = None
    max_employees: int

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    tenant: Optional[TenantInfoResponse] = None  # Ajouté pour register-tenant

    class Config:
        from_attributes = True


class TrialStatusResponse(BaseModel):
    """Statut de la période d'essai"""
    is_trial: bool
    trial_ends_at: Optional[str] = None
    trial_days_remaining: Optional[int] = None
    is_expired: bool = False
    plan: str
    max_employees: int
    current_employees: int
    employees_remaining: int


# Update forward reference
TokenResponse.model_rebuild()