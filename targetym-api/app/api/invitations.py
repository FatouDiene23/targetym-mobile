"""
API Invitations - Gestion des invitations employés
À ajouter dans app/api/employees.py ou créer comme fichier séparé
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models.employee import Employee, EmployeeStatus, EmployeeRole
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.api.deps import get_current_user, get_current_tenant, require_admin, require_manager
from app.services.email_service import send_invitation_email, send_welcome_reminder_email

import secrets
import string
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/api/invitations", tags=["Invitations"])


# ============================================
# SCHEMAS
# ============================================

class InvitationStats(BaseModel):
    total_employees: int
    not_invited: int
    pending: int
    accepted: int


class InvitationEmployee(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    job_title: Optional[str] = None
    department_name: Optional[str] = None
    invitation_status: str  # 'not_invited', 'pending', 'accepted'
    invitation_sent_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    has_user_account: bool


class InvitationsListResponse(BaseModel):
    items: List[InvitationEmployee]
    stats: InvitationStats


class SendInvitationResponse(BaseModel):
    success: bool
    message: str
    email_sent: bool
    temp_password: Optional[str] = None


# ============================================
# HELPERS
# ============================================

def generate_temp_password(length: int = 12) -> str:
    """Génère un mot de passe temporaire sécurisé"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_invitation_token() -> str:
    """Génère un token d'invitation unique"""
    return secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    """Hash un mot de passe"""
    return pwd_context.hash(password)


def get_invitation_status(employee: Employee, user: Optional[User]) -> str:
    """Détermine le statut d'invitation d'un employé"""
    if not user:
        # Pas de compte User
        if employee.invitation_sent_at:
            return 'pending'  # Invitation envoyée mais pas de compte (cas rare)
        return 'not_invited'
    
    # A un compte User
    if user.last_login:
        return 'accepted'  # S'est déjà connecté
    elif employee.invitation_sent_at:
        return 'pending'  # Invitation envoyée, pas encore connecté
    else:
        return 'not_invited'  # Compte créé mais invitation pas envoyée


# ============================================
# ENDPOINTS
# ============================================

@router.get("/", response_model=InvitationsListResponse)
async def get_invitations_list(
    status_filter: Optional[str] = Query(None, description="Filter: not_invited, pending, accepted"),
    search: Optional[str] = None,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Liste des employés avec leur statut d'invitation
    """
    from app.models.department import Department
    
    # Récupérer tous les employés actifs
    employees_query = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.status.notin_([EmployeeStatus.TERMINATED])
    )
    
    if search:
        search_filter = f"%{search}%"
        employees_query = employees_query.filter(
            or_(
                Employee.first_name.ilike(search_filter),
                Employee.last_name.ilike(search_filter),
                Employee.email.ilike(search_filter)
            )
        )
    
    employees = employees_query.all()
    
    # Stats
    stats = {
        'total_employees': len(employees),
        'not_invited': 0,
        'pending': 0,
        'accepted': 0
    }
    
    items = []
    
    for emp in employees:
        # Chercher le User associé
        user = db.query(User).filter(User.employee_id == emp.id).first()
        
        # Déterminer le statut
        inv_status = get_invitation_status(emp, user)
        
        # Compter pour les stats
        if inv_status == 'not_invited':
            stats['not_invited'] += 1
        elif inv_status == 'pending':
            stats['pending'] += 1
        else:
            stats['accepted'] += 1
        
        # Filtrer si demandé
        if status_filter and inv_status != status_filter:
            continue
        
        # Récupérer le département
        dept_name = None
        if emp.department_id:
            dept = db.query(Department).filter(Department.id == emp.department_id).first()
            if dept:
                dept_name = dept.name
        
        items.append({
            'id': emp.id,
            'first_name': emp.first_name,
            'last_name': emp.last_name,
            'email': emp.email,
            'job_title': emp.job_title,
            'department_name': dept_name,
            'invitation_status': inv_status,
            'invitation_sent_at': emp.invitation_sent_at,
            'last_login': user.last_login if user else None,
            'has_user_account': user is not None
        })
    
    # Trier: pending d'abord, puis not_invited, puis accepted
    status_order = {'pending': 0, 'not_invited': 1, 'accepted': 2}
    items.sort(key=lambda x: (status_order.get(x['invitation_status'], 3), x['first_name']))
    
    return {
        'items': items,
        'stats': stats
    }


@router.get("/stats", response_model=InvitationStats)
async def get_invitation_stats(
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Statistiques des invitations
    """
    # Employés actifs
    employees = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.status.notin_([EmployeeStatus.TERMINATED])
    ).all()
    
    stats = {
        'total_employees': len(employees),
        'not_invited': 0,
        'pending': 0,
        'accepted': 0
    }
    
    for emp in employees:
        user = db.query(User).filter(User.employee_id == emp.id).first()
        inv_status = get_invitation_status(emp, user)
        
        if inv_status == 'not_invited':
            stats['not_invited'] += 1
        elif inv_status == 'pending':
            stats['pending'] += 1
        else:
            stats['accepted'] += 1
    
    return stats


@router.post("/{employee_id}/send", response_model=SendInvitationResponse)
async def send_invitation(
    employee_id: int,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Envoyer une invitation à un employé
    - Crée le compte User si nécessaire
    - Envoie l'email d'invitation
    """
    # Vérifier que l'employé existe
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    if not employee.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'employé n'a pas d'adresse email"
        )
    
    # Vérifier si un compte User existe déjà
    existing_user = db.query(User).filter(User.employee_id == employee.id).first()
    
    temp_password = None
    
    if not existing_user:
        # Vérifier qu'aucun User n'a cet email
        email_user = db.query(User).filter(User.email == employee.email).first()
        if email_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un compte avec cet email existe déjà"
            )
        
        # Créer le compte User
        temp_password = generate_temp_password()
        hashed_password = hash_password(temp_password)
        
        # Mapper le rôle
        role_mapping = {
            'employee': UserRole.EMPLOYEE,
            'manager': UserRole.MANAGER,
            'rh': UserRole.RH,
            'admin': UserRole.ADMIN,
            'dg': UserRole.ADMIN,
        }

        # Forcer ADMIN si l'email employé == email du tenant
        if tenant.email and employee.email and employee.email.lower() == tenant.email.lower():
            user_role = UserRole.ADMIN
            # Synchroniser aussi le rôle employé
            employee.role = EmployeeRole.admin
        else:
            employee_role = str(employee.role.value) if employee.role else 'employee'
            user_role = role_mapping.get(employee_role, UserRole.EMPLOYEE)
        
        new_user = User(
            email=employee.email,
            hashed_password=hashed_password,
            first_name=employee.first_name,
            last_name=employee.last_name,
            role=user_role,
            tenant_id=tenant.id,
            employee_id=employee.id,
            is_active=True,
            is_verified=False
        )
        
        db.add(new_user)
    else:
        # Compte existe déjà, on régénère un mot de passe temporaire
        temp_password = generate_temp_password()
        existing_user.hashed_password = hash_password(temp_password)
        existing_user.is_verified = False
    
    # Mettre à jour les champs d'invitation
    employee.invitation_sent_at = datetime.utcnow()
    employee.invitation_token = generate_invitation_token()
    
    db.commit()
    
    # Envoyer l'email
    email_result = send_invitation_email(
        to_email=employee.email,
        first_name=employee.first_name,
        company_name=tenant.name,
        temp_password=temp_password
    )
    
    if email_result.get('sent'):
        return {
            'success': True,
            'message': f"Invitation envoyée à {employee.email}",
            'email_sent': True,
            'temp_password': temp_password  # Afficher une seule fois pour backup
        }
    else:
        # Email non envoyé mais compte créé
        return {
            'success': True,
            'message': f"Compte créé mais email non envoyé: {email_result.get('error', 'Erreur inconnue')}",
            'email_sent': False,
            'temp_password': temp_password
        }


@router.post("/{employee_id}/resend", response_model=SendInvitationResponse)
async def resend_invitation(
    employee_id: int,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Renvoyer une invitation (relance)
    """
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    # Vérifier que le compte User existe
    user = db.query(User).filter(User.employee_id == employee.id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun compte n'existe pour cet employé. Utilisez 'Envoyer invitation' d'abord."
        )
    
    if user.last_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet employé s'est déjà connecté. Impossible de renvoyer l'invitation."
        )
    
    # Régénérer le mot de passe
    temp_password = generate_temp_password()
    user.hashed_password = hash_password(temp_password)
    
    # Mettre à jour la date d'invitation
    employee.invitation_sent_at = datetime.utcnow()
    employee.invitation_token = generate_invitation_token()
    
    db.commit()
    
    # Calculer le nombre de jours depuis la première invitation
    # (pour le message de rappel)
    
    # Envoyer l'email
    email_result = send_invitation_email(
        to_email=employee.email,
        first_name=employee.first_name,
        company_name=tenant.name,
        temp_password=temp_password
    )
    
    if email_result.get('sent'):
        return {
            'success': True,
            'message': f"Invitation renvoyée à {employee.email}",
            'email_sent': True,
            'temp_password': temp_password
        }
    else:
        return {
            'success': True,
            'message': f"Mot de passe régénéré mais email non envoyé: {email_result.get('error')}",
            'email_sent': False,
            'temp_password': temp_password
        }


@router.post("/send-bulk")
async def send_bulk_invitations(
    employee_ids: List[int],
    current_user: User = Depends(require_admin),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Envoyer des invitations en masse
    """
    results = {
        'success': [],
        'failed': [],
        'skipped': []
    }
    
    for emp_id in employee_ids:
        employee = db.query(Employee).filter(
            Employee.id == emp_id,
            Employee.tenant_id == tenant.id
        ).first()
        
        if not employee:
            results['failed'].append({'id': emp_id, 'reason': 'Employé non trouvé'})
            continue
        
        if not employee.email:
            results['skipped'].append({'id': emp_id, 'name': f"{employee.first_name} {employee.last_name}", 'reason': 'Pas d\'email'})
            continue
        
        # Vérifier si déjà connecté
        user = db.query(User).filter(User.employee_id == emp_id).first()
        if user and user.last_login:
            results['skipped'].append({'id': emp_id, 'name': f"{employee.first_name} {employee.last_name}", 'reason': 'Déjà connecté'})
            continue
        
        try:
            # Créer compte si nécessaire
            temp_password = generate_temp_password()
            
            if not user:
                email_user = db.query(User).filter(User.email == employee.email).first()
                if email_user:
                    results['skipped'].append({'id': emp_id, 'name': f"{employee.first_name} {employee.last_name}", 'reason': 'Email déjà utilisé'})
                    continue
                
                role_mapping = {
                    'employee': UserRole.EMPLOYEE,
                    'manager': UserRole.MANAGER,
                    'rh': UserRole.RH,
                    'admin': UserRole.ADMIN,
                    'dg': UserRole.ADMIN,
                }
                employee_role = str(employee.role.value) if employee.role else 'employee'
                user_role = role_mapping.get(employee_role, UserRole.EMPLOYEE)
                
                new_user = User(
                    email=employee.email,
                    hashed_password=hash_password(temp_password),
                    first_name=employee.first_name,
                    last_name=employee.last_name,
                    role=user_role,
                    tenant_id=tenant.id,
                    employee_id=employee.id,
                    is_active=True,
                    is_verified=False
                )
                db.add(new_user)
            else:
                user.hashed_password = hash_password(temp_password)
            
            employee.invitation_sent_at = datetime.utcnow()
            employee.invitation_token = generate_invitation_token()
            
            db.commit()
            
            # Envoyer email
            email_result = send_invitation_email(
                to_email=employee.email,
                first_name=employee.first_name,
                company_name=tenant.name,
                temp_password=temp_password
            )
            
            results['success'].append({
                'id': emp_id,
                'name': f"{employee.first_name} {employee.last_name}",
                'email': employee.email,
                'email_sent': email_result.get('sent', False)
            })
            
        except Exception as e:
            results['failed'].append({'id': emp_id, 'reason': str(e)})
    
    return {
        'total_processed': len(employee_ids),
        'success_count': len(results['success']),
        'failed_count': len(results['failed']),
        'skipped_count': len(results['skipped']),
        'results': results
    }


@router.delete("/{employee_id}/cancel")
async def cancel_invitation(
    employee_id: int,
    current_user: User = Depends(require_admin),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Annuler une invitation (désactiver le compte User)
    """
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    user = db.query(User).filter(User.employee_id == employee.id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun compte n'existe pour cet employé"
        )
    
    if user.last_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible d'annuler : l'employé s'est déjà connecté"
        )
    
    # Désactiver le compte
    user.is_active = False
    
    # Effacer les infos d'invitation
    employee.invitation_sent_at = None
    employee.invitation_token = None
    
    db.commit()
    
    return {"message": "Invitation annulée avec succès"}
