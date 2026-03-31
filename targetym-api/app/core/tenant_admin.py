"""
Helper pour garantir la création de l'admin (Employee + User)
lors de la création d'un tenant.

Appelé par tous les endpoints de création de tenant.
Idempotent : ne recrée pas si l'employé ou le user existent déjà.
"""

import secrets
import string
from sqlalchemy.orm import Session
from app.models.employee import Employee, EmployeeStatus, EmployeeRole
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.core.security import hash_password


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def create_tenant_admin(
    db: Session,
    tenant: Tenant,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    password: str | None = None,
    send_email: bool = True,
) -> tuple[Employee, User, str | None]:
    """
    Garantit qu'un Employee admin + User admin existent pour le tenant.

    Retourne (employee, user, temp_password_or_None).
    temp_password est non-None uniquement si un nouveau user a été créé
    sans mot de passe fourni.
    """
    if not tenant.email:
        return None, None, None

    # 1. Chercher ou créer l'employé
    employee = db.query(Employee).filter(
        Employee.email == tenant.email,
        Employee.tenant_id == tenant.id,
    ).first()

    if not employee:
        # Générer un employee_id unique
        emp_count = db.query(Employee).filter(
            Employee.tenant_id == tenant.id
        ).count()
        employee_id = f"EMP{tenant.id:03d}{emp_count + 1:04d}"

        employee = Employee(
            tenant_id=tenant.id,
            employee_id=employee_id,
            email=tenant.email,
            first_name=first_name or tenant.name,
            last_name=last_name or "",
            role=EmployeeRole.admin,
            status=EmployeeStatus.ACTIVE,
            is_manager=True,
            job_title="Administrateur",
        )
        db.add(employee)
        db.flush()

    # S'assurer que le rôle est admin
    if employee.role != EmployeeRole.admin:
        employee.role = EmployeeRole.admin

    # 2. Chercher ou créer le user
    temp_password = None
    user = db.query(User).filter(
        User.email == tenant.email,
        User.tenant_id == tenant.id,
    ).first()

    if not user:
        if password:
            hashed = hash_password(password)
        else:
            temp_password = generate_temp_password()
            hashed = hash_password(temp_password)

        user = User(
            tenant_id=tenant.id,
            email=tenant.email,
            first_name=first_name or tenant.name,
            last_name=last_name or "",
            hashed_password=hashed,
            role=UserRole.ADMIN,
            employee_id=employee.id,
            is_active=True,
            is_verified=password is not None,
        )
        db.add(user)
        db.flush()

        # Envoyer email d'invitation si mot de passe temporaire
        if temp_password and send_email:
            try:
                from app.services.email_service import send_invitation_email
                send_invitation_email(
                    to_email=tenant.email,
                    first_name=first_name or tenant.name,
                    company_name=tenant.name,
                    temp_password=temp_password,
                )
            except Exception:
                pass  # Ne pas bloquer la création si l'email échoue
    else:
        # User existe déjà — s'assurer du lien et du rôle
        if not user.employee_id:
            user.employee_id = employee.id
        if user.role != UserRole.ADMIN:
            user.role = UserRole.ADMIN

    return employee, user, temp_password
