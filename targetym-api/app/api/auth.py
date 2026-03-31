from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from typing import Optional
import re
import base64
import io

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.employee import Employee, EmployeeStatus
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterTenantRequest,
    TokenResponse,
    RefreshTokenRequest,
    ChangePasswordRequest,
    UserResponse
)
from app.api.deps import get_current_user
from fastapi.security import HTTPBearer

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Configuration essai gratuit
TRIAL_DAYS = 30            # Durée du trial après activation manuelle
TRIAL_MAX_EMPLOYEES = 50   # Accès Premium pendant le trial

# Domaines emails personnels bloqués
BLOCKED_EMAIL_DOMAINS = [
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.fr', 'yahoo.co.uk', 'ymail.com',
    'hotmail.com', 'hotmail.fr', 'hotmail.co.uk',
    'outlook.com', 'outlook.fr',
    'live.com', 'live.fr',
    'msn.com',
    'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'aol.fr',
    'protonmail.com', 'proton.me',
    'mail.com', 'email.com',
    'gmx.com', 'gmx.fr',
    'zoho.com',
    'yandex.com', 'yandex.ru',
    'mail.ru',
    'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net',
]


# ============================================
# SCHEMAS pour les nouveaux endpoints
# ============================================

class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class TenantSettingsResponse(BaseModel):
    id: int
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    plan: str
    is_trial: bool
    trial_ends_at: Optional[str] = None
    max_employees: int
    currency: str = "XOF"

    class Config:
        from_attributes = True


class UpdateTenantSettingsRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    currency: Optional[str] = None


# ============================================
# HELPERS
# ============================================

def is_professional_email(email: str) -> bool:
    """Vérifie si l'email est professionnel (pas Gmail, Yahoo, etc.)"""
    domain = email.split('@')[-1].lower()
    return domain not in BLOCKED_EMAIL_DOMAINS


def validate_professional_email(email: str) -> None:
    """Lève une exception si l'email n'est pas professionnel"""
    if not is_professional_email(email):
        domain = email.split('@')[-1].lower()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Les emails personnels ({domain}) ne sont pas acceptés. Veuillez utiliser votre email professionnel."
        )


def generate_slug(company_name: str) -> str:
    """Génère un slug unique à partir du nom de l'entreprise"""
    slug = company_name.lower().strip()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug


def generate_employee_id(tenant_id: int, db: Session) -> str:
    """Génère un matricule unique pour un employé"""
    count = db.query(Employee).filter(Employee.tenant_id == tenant_id).count()
    return f"EMP{tenant_id:03d}{count + 1:04d}"


# ============================================
# AUTH ENDPOINTS
# ============================================

@router.post("/login")
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Connexion utilisateur"""
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )
    
    # Vérifier si le tenant est actif et non expiré
    if user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant:
            # Tenant désactivé — distinguer "en attente de validation" vs "désactivé"
            if not tenant.is_active:
                # Pas encore activé (trial_ends_at est NULL) → en attente de validation
                if tenant.is_trial and not tenant.trial_ends_at:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Votre compte est en cours de validation. Vous serez contacté sous 24H."
                    )
                # Trial expiré → automatiquement désactivé
                if tenant.is_trial and tenant.trial_ends_at:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Votre période d'essai a expiré. Veuillez souscrire à un abonnement pour réactiver votre compte."
                    )
                # Désactivé manuellement
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Votre entreprise a été désactivée. Contactez le support."
                )
            # Tenant actif mais trial expiré → désactiver et bloquer
            if tenant.is_trial and tenant.trial_ends_at:
                if datetime.now(timezone.utc) > tenant.trial_ends_at:
                    tenant.is_active = False
                    db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Votre période d'essai a expiré. Veuillez souscrire à un abonnement pour réactiver votre compte."
                    )
    
    # Mise à jour last_login
    user.last_login = datetime.utcnow()
    db.commit()

    # Vérifier si 2FA est requis par le tenant
    if user.tenant_id:
        if not tenant:
            tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant and getattr(tenant, 'require_2fa', False):
            # Créer un token temporaire pour le flow 2FA
            temp_token = create_access_token(
                data={"sub": str(user.id), "type": "2fa_pending"},
                expires_delta=timedelta(minutes=5)
            )
            return {
                "requires_2fa": True,
                "needs_setup": not getattr(user, 'totp_enabled', False),
                "temp_token": temp_token,
                "access_token": None,
                "refresh_token": None,
                "token_type": "bearer",
                "user": user
            }

    # Création tokens (flow normal sans 2FA)
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "requires_2fa": False,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Inscription d'un nouvel utilisateur (employé d'un tenant existant)"""
    
    # Bloquer les emails personnels (Gmail, Yahoo, etc.)
    validate_professional_email(data.email)
    
    # Vérifier si l'email existe
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte existe déjà avec cet email"
        )
    
    # Trouver le tenant si spécifié
    tenant_id = None
    if data.tenant_slug:
        tenant = db.query(Tenant).filter(Tenant.slug == data.tenant_slug).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entreprise non trouvée"
            )
        if not tenant.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cette entreprise n'accepte pas de nouvelles inscriptions"
            )
        tenant_id = tenant.id
    
    # Créer l'utilisateur
    new_user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.EMPLOYEE,
        tenant_id=tenant_id,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Création tokens
    access_token = create_access_token(data={"sub": str(new_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(new_user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": new_user
    }


@router.post("/register-tenant", response_model=TokenResponse)
async def register_tenant(data: RegisterTenantRequest, db: Session = Depends(get_db)):
    """
    Inscription d'une nouvelle entreprise avec période d'essai gratuit.
    Crée: Tenant + User (admin) + Employee
    """
    
    # 0. Vérifier que l'email est professionnel
    validate_professional_email(data.email)
    
    # 1. Vérifier si l'email existe déjà
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte existe déjà avec cet email"
        )
    
    # 2. Générer le slug et vérifier l'unicité
    base_slug = generate_slug(data.company_name)
    slug = base_slug
    counter = 1
    
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # 3. Créer le Tenant — INACTIF, en attente de validation manuelle
    #    trial_ends_at sera défini lors de l'activation par le super-admin
    new_tenant = Tenant(
        name=data.company_name,
        slug=slug,
        email=data.email,
        phone=data.phone,
        plan="trial",
        max_employees=TRIAL_MAX_EMPLOYEES,
        is_trial=True,
        trial_ends_at=None,          # Pas de date tant que non activé
        is_active=False              # Validation manuelle requise
    )
    
    db.add(new_tenant)
    db.flush()
    
    # 4-5. Créer Employee + User admin via helper
    from app.core.tenant_admin import create_tenant_admin
    new_employee, new_user, _pwd = create_tenant_admin(
        db, new_tenant,
        first_name=data.first_name,
        last_name=data.last_name,
        password=data.password,
        send_email=False,
    )
    db.commit()
    db.refresh(new_user)
    db.refresh(new_tenant)
    
    # 6. Compte en attente de validation — pas de tokens
    return {
        "access_token": None,
        "refresh_token": None,
        "token_type": "bearer",
        "user": new_user,
        "tenant": {
            "id": new_tenant.id,
            "name": new_tenant.name,
            "slug": new_tenant.slug,
            "trial_ends_at": None,
            "trial_days_remaining": 0,
            "max_employees": new_tenant.max_employees,
            "pending_activation": True
        }
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Rafraîchir le token d'accès"""
    payload = decode_token(data.refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide"
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé ou inactif"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Récupérer le profil de l'utilisateur connecté"""
    return current_user


# ============================================
# PROFILE UPDATE
# ============================================

@router.put("/profile")
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour le profil de l'utilisateur connecté"""
    updated = False
    
    if data.first_name is not None:
        current_user.first_name = data.first_name
        updated = True
    
    if data.last_name is not None:
        current_user.last_name = data.last_name
        updated = True
    
    if data.phone is not None:
        current_user.phone = data.phone
        updated = True
    
    if updated:
        # Aussi mettre à jour la fiche employé associée si elle existe
        if current_user.employee_id:
            employee = db.query(Employee).filter(
                Employee.id == current_user.employee_id
            ).first()
            if employee:
                if data.first_name is not None:
                    employee.first_name = data.first_name
                if data.last_name is not None:
                    employee.last_name = data.last_name
                if data.phone is not None:
                    employee.phone = data.phone
        
        db.commit()
        db.refresh(current_user)
    
    return {
        "message": "Profil mis à jour avec succès",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "role": current_user.role,
        }
    }


# ============================================
# TENANT SETTINGS (Paramètres entreprise)
# ============================================

@router.get("/tenant-settings")
async def get_tenant_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupérer les paramètres de l'entreprise"""
    if not current_user.tenant_id:
        # SUPER_ADMIN sans tenant — retourner une réponse vide plutôt qu'une erreur
        return {
            "id": None,
            "name": "",
            "slug": "",
            "email": None,
            "phone": None,
            "plan": None,
            "plan_normalized": None,
            "plan_label": None,
            "plan_level": 0,
            "plan_features": [],
            "is_trial": False,
            "trial_ends_at": None,
            "max_employees": 0,
            "employee_limit_default": 0,
            "currency": "XOF",
            "is_group": False,
            "group_type": "standalone",
        }
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entreprise non trouvée"
        )
    
    from app.core.plan_features import (
        normalize_plan, PLAN_LABELS, PLAN_LEVEL,
        PLAN_FEATURES, get_employee_limit,
    )
    plan = normalize_plan(tenant.plan)

    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "email": tenant.email,
        "phone": getattr(tenant, 'phone', None),
        "plan": tenant.plan,
        "plan_normalized": plan,
        "plan_label": PLAN_LABELS.get(plan, plan),
        "plan_level": PLAN_LEVEL.get(plan, 1),
        "plan_features": sorted(PLAN_FEATURES.get(plan, [])),
        "is_trial": tenant.is_trial,
        "trial_ends_at": tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
        "max_employees": tenant.max_employees or get_employee_limit(plan),
        "employee_limit_default": get_employee_limit(plan),
        "currency": getattr(tenant, 'currency', 'XOF') or 'XOF',
        "is_group": getattr(tenant, 'is_group', False) or False,
        "group_type": getattr(tenant, 'group_type', 'standalone').value if hasattr(getattr(tenant, 'group_type', None), 'value') else str(getattr(tenant, 'group_type', 'standalone') or 'standalone'),
    }


@router.put("/tenant-settings")
async def update_tenant_settings(
    data: UpdateTenantSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour les paramètres de l'entreprise (Admin/RH uniquement)"""
    # Vérifier les permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs et RH peuvent modifier les paramètres"
        )
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilisateur sans entreprise"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entreprise non trouvée"
        )
    
    if data.name is not None:
        tenant.name = data.name
    
    if data.email is not None:
        tenant.email = data.email
    
    if data.phone is not None:
        tenant.phone = data.phone

    if data.currency is not None:
        from app.core.currency import SUPPORTED_CURRENCIES
        if data.currency.upper() not in SUPPORTED_CURRENCIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Devise non supportée. Devises disponibles: {', '.join(SUPPORTED_CURRENCIES)}"
            )
        tenant.currency = data.currency.upper()

    db.commit()
    db.refresh(tenant)

    return {
        "message": "Paramètres mis à jour avec succès",
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "email": tenant.email,
            "phone": getattr(tenant, 'phone', None),
            "plan": tenant.plan,
            "currency": getattr(tenant, 'currency', 'XOF') or 'XOF',
        }
    }


# ============================================
# PLAN CHANGE REQUEST
# ============================================

class PlanChangeRequest(BaseModel):
    target_plan: str
    message: str = ""

@router.post("/settings/plan-change-request")
async def request_plan_change(
    data: PlanChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soumettre une demande de changement de plan (envoi email au back-office)."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RH, UserRole.DG]:
        raise HTTPException(status_code=403, detail="Non autorisé")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    from app.services.email_service import send_plan_change_request_email
    try:
        send_plan_change_request_email(
            tenant_name=tenant.name or "—",
            tenant_email=tenant.email or current_user.email,
            current_plan=tenant.plan or "trial",
            target_plan=data.target_plan,
            message=data.message,
            requested_by=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email,
        )
    except Exception:
        pass  # Don't fail the request if email fails

    return {"message": "Demande envoyée avec succès"}


# ============================================
# PASSWORD & TRIAL
# ============================================

@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Changer le mot de passe"""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect"
        )
    
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    
    return {"message": "Mot de passe modifié avec succès"}


# ============================================
# FORGOT / RESET PASSWORD
# ============================================

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Envoyer un email de réinitialisation de mot de passe."""
    user = db.query(User).filter(User.email == data.email.lower().strip(), User.is_active == True).first()

    # Toujours retourner un succès pour ne pas révéler si l'email existe
    if not user:
        return {"message": "Si cette adresse existe, un email de réinitialisation a été envoyé."}

    # Créer un token de reset (expire dans 24h)
    import secrets
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    db.commit()

    # Envoyer l'email
    try:
        from app.services.email_service import send_password_reset_email
        employee = db.query(Employee).filter(Employee.id == user.employee_id).first() if user.employee_id else None
        first_name = employee.first_name if employee else user.email.split("@")[0]

        send_password_reset_email(
            to_email=user.email,
            first_name=first_name,
            reset_token=reset_token,
        )
    except Exception as e:
        print(f"Erreur envoi email reset: {e}")

    return {"message": "Si cette adresse existe, un email de réinitialisation a été envoyé."}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Réinitialiser le mot de passe avec un token."""
    user = db.query(User).filter(
        User.reset_token == data.token,
        User.is_active == True
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")

    if user.reset_token_expires and user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expiré. Veuillez faire une nouvelle demande.")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères")

    user.hashed_password = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return {"message": "Mot de passe réinitialisé avec succès"}


@router.get("/trial-status")
async def get_trial_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupérer le statut de la période d'essai"""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilisateur sans entreprise"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entreprise non trouvée"
        )
    
    employee_count = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.status != EmployeeStatus.TERMINATED
    ).count()
    
    return {
        "is_trial": tenant.is_trial,
        "trial_ends_at": tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
        "trial_days_remaining": tenant.trial_days_remaining if tenant.is_trial else None,
        "is_expired": tenant.is_trial_expired if tenant.is_trial else False,
        "plan": tenant.plan,
        "max_employees": tenant.max_employees,
        "current_employees": employee_count,
        "employees_remaining": max(0, tenant.max_employees - employee_count)
    }


# ============================================
# 2FA TOTP ENDPOINTS
# ============================================

def get_2fa_pending_user(db: Session, credentials):
    """Valide un temp_token 2fa_pending et retourne le user."""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    # Accepter les tokens 2fa_pending (le type est dans le payload custom)
    # Note: create_access_token ajoute "type": "access" par défaut, on override
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalide")
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Token invalide")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    return user


class TwoFactorVerifyRequest(BaseModel):
    code: str


@router.post("/2fa/setup")
async def setup_2fa(
    db: Session = Depends(get_db),
    credentials=Depends(HTTPBearer())
):
    """Génère un secret TOTP et un QR code pour la configuration initiale."""
    try:
        import pyotp
        import qrcode
    except ImportError:
        raise HTTPException(status_code=500, detail="Modules 2FA non disponibles")

    user = get_2fa_pending_user(db, credentials)

    # Générer un nouveau secret
    secret = pyotp.random_base32()
    user.totp_secret = secret
    db.commit()

    # Générer le provisioning URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name="Targetym AI"
    )

    # Générer le QR code en base64
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "qr_code_base64": f"data:image/png;base64,{qr_base64}"
    }


@router.post("/2fa/verify")
async def verify_2fa(
    data: TwoFactorVerifyRequest,
    db: Session = Depends(get_db),
    credentials=Depends(HTTPBearer())
):
    """Vérifie un code TOTP et retourne les vrais tokens si valide."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=500, detail="Module 2FA non disponible")

    user = get_2fa_pending_user(db, credentials)

    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non configuré. Appelez /2fa/setup d'abord.")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Code invalide ou expiré")

    # Activer la 2FA si c'est le premier setup
    if not user.totp_enabled:
        user.totp_enabled = True
        db.commit()

    # Générer les vrais tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }


# ============================================
# TENANT SECURITY SETTINGS
# ============================================

@router.get("/tenant-security")
async def get_tenant_security(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupérer les paramètres de sécurité du tenant (admin only)."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RH]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    total_users = db.query(User).filter(
        User.tenant_id == tenant.id,
        User.is_active == True
    ).count()

    users_with_2fa = db.query(User).filter(
        User.tenant_id == tenant.id,
        User.is_active == True,
        User.totp_enabled == True
    ).count()

    return {
        "require_2fa": getattr(tenant, 'require_2fa', False),
        "total_users": total_users,
        "users_with_2fa": users_with_2fa,
    }


@router.get("/2fa-status")
async def get_2fa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vérifie si l'utilisateur connecté doit configurer la 2FA."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    require_2fa = bool(tenant and getattr(tenant, 'require_2fa', False))
    totp_enabled = bool(getattr(current_user, 'totp_enabled', False))

    return {
        "require_2fa": require_2fa,
        "totp_enabled": totp_enabled,
        "needs_setup": require_2fa and not totp_enabled,
    }


@router.post("/2fa/setup-authenticated")
async def setup_2fa_authenticated(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configure la 2FA pour un utilisateur déjà connecté (token normal)."""
    try:
        import pyotp
        import qrcode
    except ImportError:
        raise HTTPException(status_code=500, detail="Modules 2FA non disponibles")

    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    db.commit()

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="Targetym AI"
    )

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "qr_code_base64": f"data:image/png;base64,{qr_base64}"
    }


@router.post("/2fa/verify-authenticated")
async def verify_2fa_authenticated(
    data: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vérifie un code TOTP pour un utilisateur déjà connecté."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=500, detail="Module 2FA non disponible")

    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non configuré. Appelez /2fa/setup-authenticated d'abord.")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Code invalide ou expiré")

    if not current_user.totp_enabled:
        current_user.totp_enabled = True
        db.commit()

    return {"success": True, "totp_enabled": True}


class UpdateTenantSecurityRequest(BaseModel):
    require_2fa: bool


@router.put("/tenant-security")
async def update_tenant_security(
    data: UpdateTenantSecurityRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour les paramètres de sécurité du tenant (admin only)."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    tenant.require_2fa = data.require_2fa
    db.commit()

    return {"success": True, "require_2fa": tenant.require_2fa}