from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.employee import Employee

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Récupère l'utilisateur courant à partir du token JWT
    """
    token = credentials.credentials
    print(f"[get_current_user] Token reçu: {token[:20]}...")
    
    payload = decode_token(token)
    
    if not payload:
        print(f"[get_current_user] ERREUR: Token invalide ou expiré")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré"
        )
    
    if payload.get("type") != "access":
        print(f"[get_current_user] ERREUR: Type de token incorrect: {payload.get('type')}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de type incorrect"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        print(f"[get_current_user] ERREUR: Pas de user_id dans le token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide"
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user:
        print(f"[get_current_user] ERREUR: Utilisateur {user_id} non trouvé")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    if not user.is_active:
        print(f"[get_current_user] ERREUR: Compte désactivé pour {user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )
    
    # Si le token est un token d'impersonation (généré par un SUPER_ADMIN),
    # on pose un flag non-ORM sur l'objet user pour bypass les checks de rôle dans les deps.
    if payload.get("impersonation") is True:
        user._impersonating = True
        print(f"[get_current_user] IMPERSONATION: {user.email} impersonné par {payload.get('impersonated_by')}")
    
    print(f"[get_current_user] SUCCESS: User {user.email}, Role: {user.role}")
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Vérifie que l'utilisateur est actif"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte inactif"
        )
    return current_user


def get_current_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Tenant:
    """
    Récupère le tenant de l'utilisateur courant
    """
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin doit spécifier un tenant"
        )
    
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilisateur non associé à une entreprise"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    
    if not tenant or not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Entreprise non trouvée ou inactive"
        )
    
    return tenant


def get_current_employee(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Employee:
    """
    Récupère l'employé associé à l'utilisateur courant
    """
    if not current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilisateur non associé à un employé"
        )
    
    employee = db.query(Employee).filter(
        Employee.id == current_user.employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    return employee


def require_role(required_roles: list):
    """
    Decorator pour vérifier les rôles
    Usage: @router.get("/", dependencies=[Depends(require_role([UserRole.ADMIN]))])
    """
    def role_checker(current_user: User = Depends(get_current_user)):
        if getattr(current_user, '_impersonating', False):
            return current_user
        if current_user.role not in required_roles and current_user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissions insuffisantes"
            )
        return current_user
    return role_checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est admin ou super_admin"""
    if getattr(current_user, '_impersonating', False):
        return current_user
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )
    return current_user


def require_manager(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est au moins manager (inclut RH)"""
    if getattr(current_user, '_impersonating', False):
        return current_user
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RH, UserRole.MANAGER]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux managers et administrateurs"
        )
    return current_user


def require_rh(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est RH, admin ou super_admin"""
    if getattr(current_user, '_impersonating', False):
        return current_user
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RH]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux RH et administrateurs"
        )
    return current_user


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est super_admin (équipe technique uniquement)"""
    print(f"[require_super_admin] User: {current_user.email}, Role: {current_user.role}, Type: {type(current_user.role)}")
    print(f"[require_super_admin] Expected: {UserRole.SUPER_ADMIN}, Comparison: {current_user.role == UserRole.SUPER_ADMIN}")
    
    if current_user.role != UserRole.SUPER_ADMIN:
        print(f"[require_super_admin] REJECTED - Role mismatch")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé à l'équipe technique"
        )
    
    print(f"[require_super_admin] ACCEPTED")
    return current_user