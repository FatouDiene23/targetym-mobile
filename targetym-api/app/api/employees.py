from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
import base64

from app.core.database import get_db
from app.models.employee import Employee, EmployeeStatus, EmployeeRole
from app.models.salary_history import SalaryHistory
from app.models.department import Department
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeesPageResponse,
    EmployeeStats
)
from app.api.deps import get_current_user, get_current_tenant, require_admin, require_manager
from app.core.plan_guard import require_employee_slot

router = APIRouter(prefix="/api/employees", tags=["Employees"])

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
            detail=f"Les emails personnels ({domain}) ne sont pas acceptés. Veuillez utiliser un email professionnel."
        )


SALARY_VISIBLE_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RH, UserRole.DG]


def resolve_target_tenant_id(
    db: Session,
    current_user: User,
    tenant: Tenant,
    subsidiary_tenant_id: Optional[int],
) -> int:
    """
    Retourne le tenant cible.
    - Sans filiale sélectionnée : tenant courant
    - Avec filiale sélectionnée : accès réservé Admin/RH/DG du groupe parent
    """
    if not subsidiary_tenant_id:
        return tenant.id

    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN, UserRole.DG] and not getattr(current_user, '_impersonating', False):
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
        employee = db.query(Employee).filter(
            Employee.id == current_user.employee_id,
            Employee.tenant_id == tenant.id,
        ).first()
        if not employee or employee.role != EmployeeRole.dg:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")

    sub = db.query(Tenant).filter(
        Tenant.id == subsidiary_tenant_id,
        Tenant.parent_tenant_id == tenant.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=403, detail="Filiale non autorisée ou introuvable")

    return sub.id


def employee_to_dict(employee: Employee, db: Session, include_salary: bool = True) -> dict:
    """Convertir un employé en dict avec department_name.
    include_salary=False masque salary/net_salary (pour les non-RH).
    Résout department_name vers le niveau 'departement' (pas service/direction).
    """
    # Déterminer is_active basé sur status
    is_active = True
    if employee.status:
        status_str = str(employee.status).upper()
        if 'TERMINATED' in status_str or 'SUSPENDED' in status_str:
            is_active = False

    data = {
        "id": employee.id,
        "tenant_id": employee.tenant_id,
        "employee_id": employee.employee_id,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "email": employee.email,
        "phone": employee.phone,
        "gender": employee.gender,
        "date_of_birth": employee.date_of_birth,
        "nationality": employee.nationality,
        "address": employee.address,
        "photo_url": employee.photo_url,
        "job_title": employee.job_title,
        "department_id": employee.department_id,
        "department_name": None,
        "manager_id": employee.manager_id,
        "manager_name": None,
        "is_manager": getattr(employee, 'is_manager', False) or False,
        "role": employee.role.value if employee.role else "employee",
        "is_active": is_active,
        "site": employee.site,
        "contract_type": employee.contract_type,
        "hire_date": employee.hire_date,
        "end_date": getattr(employee, 'end_date', None),
        "probation_end_date": getattr(employee, 'probation_end_date', None),
        "salary": employee.salary if include_salary else None,
        "net_salary": getattr(employee, 'net_salary', None) if include_salary else None,
        "salaire_brut": getattr(employee, 'salaire_brut', None) if include_salary else None,
        "part_variable": getattr(employee, 'part_variable', None) if include_salary else None,
        "currency": employee.currency or "XOF",
        "classification": getattr(employee, 'classification', None),
        "coefficient": getattr(employee, 'coefficient', None),
        "status": employee.status,
        "created_at": employee.created_at,
        "updated_at": employee.updated_at,
        # Famille
        "marital_status": getattr(employee, 'marital_status', None),
        "spouse_name": getattr(employee, 'spouse_name', None),
        "spouse_birth_date": getattr(employee, 'spouse_birth_date', None),
        # Adresse pro
        "work_email": getattr(employee, 'work_email', None),
        "work_phone": getattr(employee, 'work_phone', None),
        # Médical
        "has_disability": getattr(employee, 'has_disability', False),
        "disability_description": getattr(employee, 'disability_description', None),
        "emergency_contact_name": getattr(employee, 'emergency_contact_name', None),
        "emergency_contact_phone": getattr(employee, 'emergency_contact_phone', None),
        # Organisation
        "comex_member": getattr(employee, 'comex_member', None),
        "hrbp": getattr(employee, 'hrbp', None),
        "salary_category": getattr(employee, 'salary_category', None),
        # Juridique
        "is_juriste": getattr(employee, 'is_juriste', False),
    }
    
    # Récupérer le nom du département — résout jusqu'au niveau 'departement'
    if employee.department_id:
        dept = db.query(Department).filter(Department.id == employee.department_id).first()
        if dept:
            resolved = dept
            for _ in range(6):  # max 6 niveaux de hiérarchie
                if resolved.level == 'departement' or resolved.parent_id is None:
                    break
                parent = db.query(Department).filter(Department.id == resolved.parent_id).first()
                if parent is None:
                    break
                resolved = parent
            data["department_name"] = resolved.name
    
    # Récupérer le nom du manager
    if employee.manager_id:
        manager = db.query(Employee).filter(Employee.id == employee.manager_id).first()
        if manager:
            data["manager_name"] = f"{manager.first_name} {manager.last_name}"
    
    return data


@router.get("/", response_model=EmployeesPageResponse)
async def get_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    status: Optional[EmployeeStatus] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Liste des employés avec pagination et filtres"""
    target_tenant_id = resolve_target_tenant_id(db, current_user, tenant, subsidiary_tenant_id)
    query = db.query(Employee).filter(Employee.tenant_id == target_tenant_id)

    # Filtres
    if manager_id:
        query = query.filter(Employee.manager_id == manager_id)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Employee.first_name.ilike(search_filter)) |
            (Employee.last_name.ilike(search_filter)) |
            (Employee.email.ilike(search_filter)) |
            (Employee.employee_id.ilike(search_filter))
        )
    
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    
    if status:
        query = query.filter(Employee.status == status)
    
    # Count total
    total = query.count()
    
    # Pagination
    offset = (page - 1) * page_size
    employees = query.offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    # Masquer salaires pour les non-RH
    can_see_salary = current_user.role in SALARY_VISIBLE_ROLES
    items = [employee_to_dict(emp, db, include_salary=can_see_salary) for emp in employees]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/stats", response_model=EmployeeStats)
async def get_employee_stats(
    subsidiary_tenant_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Statistiques des employés"""
    target_tenant_id = resolve_target_tenant_id(db, current_user, tenant, subsidiary_tenant_id)
    base_query = db.query(Employee).filter(Employee.tenant_id == target_tenant_id)
    
    total = base_query.count()
    active = base_query.filter(Employee.status.notin_(['terminated', 'suspended'])).count()
    inactive = base_query.filter(Employee.status.in_(['terminated', 'suspended'])).count()
    on_leave = base_query.filter(Employee.status == 'on_leave').count()
    probation = base_query.filter(Employee.status == EmployeeStatus.PROBATION).count()
    
    # Managers (ceux qui ont is_manager = True)
    managers = base_query.filter(
        Employee.is_manager == True,
        Employee.status.notin_(['terminated', 'suspended'])
    ).count()
    
    # Par genre (seulement les actifs)
    by_gender_query = db.query(
        Employee.gender,
        func.count(Employee.id)
    ).filter(
        Employee.tenant_id == target_tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).group_by(Employee.gender).all()
    
    by_gender = {str(gender): count for gender, count in by_gender_query if gender}
    
    # Compter hommes et femmes
    female_count = 0
    male_count = 0
    for gender, count in by_gender_query:
        if gender:
            gender_str = str(gender).upper()
            if 'FEMALE' in gender_str or gender_str == 'F':
                female_count += count
            elif 'MALE' in gender_str or gender_str == 'M':
                male_count += count
    
    # Par département
    by_dept = db.query(
        Department.name,
        func.count(Employee.id)
    ).join(
        Employee, Employee.department_id == Department.id
    ).filter(
        Employee.tenant_id == target_tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).group_by(Department.name).all()
    
    by_department = {dept: count for dept, count in by_dept}
    
    # Par type de contrat
    by_contract_query = db.query(
        Employee.contract_type,
        func.count(Employee.id)
    ).filter(
        Employee.tenant_id == target_tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).group_by(Employee.contract_type).all()
    
    by_contract_type = {str(ctype): count for ctype, count in by_contract_query if ctype}

    # Nouveaux ce mois (hire_date dans le mois courant)
    from datetime import date as _date
    today = _date.today()
    first_day_of_month = today.replace(day=1)
    new_this_month = base_query.filter(
        Employee.hire_date >= first_day_of_month,
        Employee.hire_date <= today,
        Employee.status.notin_(['terminated', 'suspended'])
    ).count()
    
    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "on_leave": on_leave,
        "probation": probation,
        "managers": managers,
        "top_managers": 0,
        "female": female_count,
        "male": male_count,
        "new_this_month": new_this_month,
        "by_department": by_department,
        "by_gender": by_gender,
        "by_contract_type": by_contract_type
    }


# ============================================
# ENDPOINT MY-TEAM - Filtrage par rôle
# ============================================

@router.get("/my-team/")
async def get_my_team(
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Retourne les employés selon le rôle de l'utilisateur:
    - Admin/RH/DG/DGA: tous les employés du tenant
    - Manager: seulement son équipe (manager_id = employee_id du user)
    - Employee: liste vide
    """
    # Rôles qui voient tout le monde
    full_access_roles = ['admin', 'dg', 'dga', 'rh']
    
    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    
    if user_role in full_access_roles:
        # Retourner tous les employés actifs du tenant
        employees = db.query(Employee).filter(
            Employee.tenant_id == tenant.id,
            Employee.status.notin_(['terminated', 'suspended'])
        ).order_by(Employee.last_name, Employee.first_name).all()
    elif user_role == 'manager':
        # Manager: retourner seulement son équipe
        if not current_user.employee_id:
            return {"items": [], "total": 0}
        
        employees = db.query(Employee).filter(
            Employee.tenant_id == tenant.id,
            Employee.manager_id == current_user.employee_id,
            Employee.status.notin_(['terminated', 'suspended'])
        ).order_by(Employee.last_name, Employee.first_name).all()
    else:
        # Employee: liste vide (ne peut assigner à personne)
        return {"items": [], "total": 0}
    
    return {
        "items": [
            {
                "id": emp.id,
                "first_name": emp.first_name,
                "last_name": emp.last_name,
                "job_title": emp.job_title,
                "department": emp.department.name if emp.department else None,
                "email": emp.email
            }
            for emp in employees
        ],
        "total": len(employees)
    }


# ============================================
# IMPORT COLLABORATEURS (doit être avant /{employee_id})
# ============================================

@router.post("/import")
async def import_employees(
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Importer des collaborateurs depuis un fichier CSV ou Excel (.xlsx)"""
    import csv
    import io
    from datetime import datetime

    filename = file.filename or ""
    content = await file.read()
    rows: list[dict] = []

    if filename.lower().endswith(".csv"):
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = [dict(r) for r in reader]
    elif filename.lower().endswith(".xlsx"):
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Support Excel non disponible. Utilisez le format CSV."
            )
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        headers: list[str] = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:
                headers = [str(c).strip() if c is not None else "" for c in row]
            else:
                rows.append(dict(zip(headers, [c for c in row])))
        wb.close()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format non supporté. Utilisez CSV ou XLSX."
        )

    FIELD_MAP = {
        "prenom": "first_name", "first_name": "first_name",
        "nom": "last_name", "last_name": "last_name",
        "email": "email",
        "telephone": "phone", "phone": "phone",
        "genre": "gender", "gender": "gender",
        "date_naissance": "date_of_birth", "date_of_birth": "date_of_birth",
        "nationalite": "nationality", "nationality": "nationality",
        "adresse": "address", "address": "address",
        "poste": "job_title", "job_title": "job_title",
        "departement": "department_name", "department": "department_name",
        "est_manager": "is_manager", "is_manager": "is_manager",
        "role": "role",
        "site": "site",
        "type_contrat": "contract_type", "contract_type": "contract_type",
        "date_embauche": "hire_date", "hire_date": "hire_date",
        "salaire_brut": "salary", "salary": "salary",
        "salaire_net": "net_salary", "net_salary": "net_salary",
        "devise": "currency", "currency": "currency",
        "statut": "status", "status": "status",
        "matricule": "employee_id", "employee_id": "employee_id",
    }

    def _str(v) -> str:
        return str(v).strip() if v is not None else ""

    def _parse_date(s: str):
        if not s:
            return None
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                pass
        return None

    def _parse_decimal(s: str):
        if not s:
            return None
        try:
            return float(s.replace(" ", "").replace(",", "."))
        except (ValueError, AttributeError):
            return None

    created = 0
    skipped = 0
    errors: list[dict] = []

    for row_idx, raw_row in enumerate(rows, start=2):
        row: dict[str, str] = {}
        for k, v in raw_row.items():
            if k is None:
                continue
            normalized = str(k).strip().lower().replace(" ", "_")
            mapped = FIELD_MAP.get(normalized)
            if mapped:
                row[mapped] = _str(v)

        if not any(row.values()):
            continue

        first_name = row.get("first_name", "")
        last_name = row.get("last_name", "")
        email = row.get("email", "")

        if not first_name or not last_name or not email:
            errors.append({"row": row_idx, "email": email or "(vide)", "error": "Champs obligatoires manquants: prénom, nom, email"})
            skipped += 1
            continue

        if not is_professional_email(email):
            errors.append({"row": row_idx, "email": email, "error": f"Email personnel non accepté ({email.split('@')[-1]})"})
            skipped += 1
            continue

        existing = db.query(Employee).filter(
            Employee.email == email,
            Employee.tenant_id == tenant.id
        ).first()
        if existing:
            errors.append({"row": row_idx, "email": email, "error": "Email déjà existant — ligne ignorée"})
            skipped += 1
            continue

        if tenant.is_trial:
            current_count = db.query(Employee).filter(
                Employee.tenant_id == tenant.id,
                Employee.status != EmployeeStatus.TERMINATED
            ).count()
            if current_count >= tenant.max_employees:
                errors.append({"row": row_idx, "email": email, "error": f"Limite d'essai de {tenant.max_employees} employés atteinte"})
                skipped += 1
                continue

        department_id = None
        dept_name = row.get("department_name", "")
        if dept_name:
            dept = db.query(Department).filter(
                Department.name.ilike(dept_name),
                Department.tenant_id == tenant.id
            ).first()
            if dept:
                department_id = dept.id

        gender_val = None
        g = row.get("gender", "").lower()
        if g in ("m", "male", "homme"):
            gender_val = "male"
        elif g in ("f", "female", "femme"):
            gender_val = "female"

        is_manager = row.get("is_manager", "").lower() in ("true", "oui", "1", "yes")

        valid_roles = ["employee", "manager", "rh", "admin", "dg", "dga", "drh"]
        role_val = row.get("role", "employee").lower()
        if role_val not in valid_roles:
            role_val = "employee"

        contract_map = {"CDI": "CDI", "CDD": "CDD", "FREELANCE": "Freelance", "STAGE": "Stage", "ALTERNANCE": "Alternance"}
        contract_val = contract_map.get(row.get("contract_type", "CDI").upper(), "CDI")

        status_map = {
            "active": "active", "actif": "active",
            "probation": "probation",
            "on_leave": "on_leave", "conge": "on_leave",
            "terminated": "terminated", "termine": "terminated",
            "suspended": "suspended", "suspendu": "suspended",
        }
        status_val = status_map.get(row.get("status", "active").lower(), "active")

        try:
            employee = Employee(
                tenant_id=tenant.id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=row.get("phone") or None,
                gender=gender_val,
                date_of_birth=_parse_date(row.get("date_of_birth", "")),
                nationality=row.get("nationality") or None,
                address=row.get("address") or None,
                job_title=row.get("job_title") or None,
                department_id=department_id,
                is_manager=is_manager,
                role=role_val,
                site=row.get("site") or None,
                contract_type=contract_val,
                hire_date=_parse_date(row.get("hire_date", "")),
                salary=_parse_decimal(row.get("salary", "")),
                net_salary=_parse_decimal(row.get("net_salary", "")),
                currency=row.get("currency") or "XOF",
                status=status_val,
                employee_id=row.get("employee_id") or None,
            )
            db.add(employee)
            db.commit()
            db.refresh(employee)
            created += 1
        except Exception as e:
            db.rollback()
            errors.append({"row": row_idx, "email": email, "error": str(e)[:200]})
            skipped += 1

    return {
        "total": len(rows),
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


# ============================================
# DETAIL EMPLOYÉ
# ============================================

@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Détail d'un employé"""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )

    # L'employé peut voir son propre salaire, sinon vérifier le rôle
    is_own_profile = current_user.employee_id == employee.id
    can_see_salary = is_own_profile or current_user.role in SALARY_VISIBLE_ROLES
    return employee_to_dict(employee, db, include_salary=can_see_salary)


@router.post("/", response_model=EmployeeResponse, dependencies=[Depends(require_employee_slot)])
async def create_employee(
    data: EmployeeCreate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Créer un employé (Manager+ uniquement)"""

    # Vérifier que l'email est professionnel
    validate_professional_email(data.email)

    # Vérifier email unique dans le tenant
    existing = db.query(Employee).filter(
        Employee.email == data.email,
        Employee.tenant_id == tenant.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un employé avec cet email existe déjà"
        )

    # Vérifier département
    if data.department_id:
        dept = db.query(Department).filter(
            Department.id == data.department_id,
            Department.tenant_id == tenant.id
        ).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Département non trouvé"
            )
    
    # Vérifier manager
    if data.manager_id:
        manager = db.query(Employee).filter(
            Employee.id == data.manager_id,
            Employee.tenant_id == tenant.id
        ).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Manager non trouvé"
            )
    
    employee = Employee(
        tenant_id=tenant.id,
        **data.model_dump()
    )
    
    db.add(employee)
    db.commit()
    db.refresh(employee)
    
    return employee_to_dict(employee, db)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Modifier un employé (Manager+ uniquement)"""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    # Si l'email est modifié, vérifier qu'il est professionnel
    if data.email and data.email != employee.email:
        validate_professional_email(data.email)
    
    # Mise à jour des champs non-None
    update_data = data.model_dump(exclude_unset=True)
    
    # Convertir le rôle string en Enum si présent
    if 'role' in update_data and update_data['role'] is not None:
        try:
            update_data['role'] = EmployeeRole(update_data['role'])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rôle invalide. Valeurs acceptées: employee, manager, rh, admin, dg"
            )
    
    for field, value in update_data.items():
        setattr(employee, field, value)

    # Debug: log les champs étendus reçus pour diagnostiquer la persistance
    extended_fields = ['marital_status', 'spouse_name', 'spouse_birth_date', 'work_email',
                       'work_phone', 'has_disability', 'disability_description',
                       'emergency_contact_name', 'emergency_contact_phone',
                       'comex_member', 'hrbp', 'salary_category']
    received_extended = {f: update_data.get(f, '<not_sent>') for f in extended_fields if f in update_data}
    if received_extended:
        print(f"[update_employee] employee_id={employee_id} extended fields: {received_extended}")
    if 'role' in update_data and update_data['role'] is not None:
        linked_user = db.query(User).filter(User.employee_id == employee.id).first()
        if linked_user:
            role_sync = {
                'employee': UserRole.EMPLOYEE,
                'manager': UserRole.MANAGER,
                'rh': UserRole.RH,
                'admin': UserRole.ADMIN,
                'dg': UserRole.ADMIN,
            }
            new_role_str = str(update_data['role'].value) if hasattr(update_data['role'], 'value') else str(update_data['role'])
            new_user_role = role_sync.get(new_role_str)
            if new_user_role:
                linked_user.role = new_user_role

    db.commit()
    db.refresh(employee)

    # Debug: log les valeurs après commit pour confirmer la persistance DB
    post_commit = {f: getattr(employee, f, '<missing>') for f in ['marital_status', 'spouse_name', 'work_email', 'comex_member', 'hrbp', 'salary_category']}
    print(f"[update_employee] POST-COMMIT employee_id={employee_id}: {post_commit}")

    return employee_to_dict(employee, db)


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: int,
    current_user: User = Depends(require_admin),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Supprimer un employé (soft delete - Admin uniquement)"""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    # Soft delete - on passe en TERMINATED
    employee.status = EmployeeStatus.TERMINATED
    db.commit()
    
    return {"message": "Employé désactivé avec succès"}


@router.patch("/{employee_id}/toggle-status")
async def toggle_employee_status(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Désactiver ou réactiver un employé (Manager/RH/Admin/DG)"""
    allowed_roles = [UserRole.ADMIN, UserRole.RH, UserRole.DG, UserRole.MANAGER, UserRole.SUPER_ADMIN]
    if current_user.role not in allowed_roles and not getattr(current_user, '_impersonating', False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")

    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()

    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")

    if employee.status == EmployeeStatus.ACTIVE:
        employee.status = EmployeeStatus.INACTIVE
        action = "désactivé"
    else:
        employee.status = EmployeeStatus.ACTIVE
        action = "réactivé"

    db.commit()
    return {"message": f"Employé {action} avec succès", "status": employee.status.value}


@router.get("/{employee_id}/direct-reports", response_model=List[EmployeeResponse])
async def get_direct_reports(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Liste des collaborateurs directs d'un manager"""
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
    
    direct_reports = db.query(Employee).filter(
        Employee.manager_id == employee_id,
        Employee.tenant_id == tenant.id,
        Employee.status != EmployeeStatus.TERMINATED
    ).all()
    
    can_see_salary = current_user.role in SALARY_VISIBLE_ROLES
    return [employee_to_dict(emp, db, include_salary=can_see_salary) for emp in direct_reports]


# ============================================
# GESTION DES ACCÈS EMPLOYÉS
# ============================================

import secrets
import string
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_temp_password(length: int = 12) -> str:
    """Génère un mot de passe temporaire sécurisé"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def hash_password(password: str) -> str:
    """Hash un mot de passe"""
    return pwd_context.hash(password)


@router.post("/{employee_id}/activate-access")
async def activate_employee_access(
    employee_id: int,
    send_email: bool = Query(True, description="Envoyer l'email avec le mot de passe"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Créer un compte User pour un employé existant.
    - Génère un mot de passe temporaire
    - Crée le User lié à l'Employee
    - Envoie un email (optionnel)
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
    
    # Vérifier que l'employé a un email
    if not employee.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'employé n'a pas d'adresse email"
        )
    
    # Vérifier qu'un compte n'existe pas déjà
    existing_user = db.query(User).filter(
        User.email == employee.email
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte existe déjà pour cet email"
        )
    
    # Vérifier qu'aucun User n'est déjà lié à cet employee
    linked_user = db.query(User).filter(
        User.employee_id == employee.id
    ).first()
    
    if linked_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte est déjà lié à cet employé"
        )
    
    # Générer mot de passe temporaire
    temp_password = generate_temp_password()
    hashed_password = hash_password(temp_password)
    
    # Mapper le rôle Employee vers le rôle User
    role_mapping = {
        'employee': UserRole.EMPLOYEE,
        'manager': UserRole.MANAGER,
        'rh': UserRole.RH,
        'admin': UserRole.ADMIN,
        'dg': UserRole.ADMIN,
    }
    
    employee_role = str(employee.role.value) if employee.role else 'employee'
    user_role = role_mapping.get(employee_role, UserRole.EMPLOYEE)
    
    # Créer le User
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
    db.commit()
    db.refresh(new_user)

    if send_email:
        try:
            from app.services.email_service import send_access_ready_email
            send_access_ready_email(
                to_email=employee.email,
                first_name=employee.first_name,
                company_name=tenant.name,
                temp_password=temp_password,
            )
        except Exception as e:
            print(f"⚠️ Email accès employé non envoyé: {e}")

    return {
        "message": "Compte créé avec succès",
        "user_id": new_user.id,
        "email": new_user.email,
        "temp_password": temp_password,
        "role": user_role.value
    }


@router.delete("/{employee_id}/deactivate-access")
async def deactivate_employee_access(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Désactiver le compte User d'un employé (sans le supprimer)
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
    
    # Trouver le User lié
    user = db.query(User).filter(
        User.employee_id == employee.id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun compte n'est lié à cet employé"
        )
    
    # Désactiver le compte
    user.is_active = False
    db.commit()
    
    return {"message": "Compte désactivé avec succès"}


@router.get("/{employee_id}/access-status")
async def get_employee_access_status(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Vérifier si un employé a un compte User actif
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
    
    user = db.query(User).filter(
        User.employee_id == employee.id
    ).first()
    
    if not user:
        return {
            "has_access": False,
            "user_id": None,
            "is_active": False,
            "is_verified": False,
            "last_login": None
        }
    
    return {
        "has_access": True,
        "user_id": user.id,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "last_login": user.last_login,
        "role": user.role.value if user.role else None
    }


# ============================================
# SIGNATURE ÉLECTRONIQUE
# ============================================

ALLOWED_SIGNATURE_TYPES = ["image/png", "image/jpeg", "image/webp"]
MAX_SIGNATURE_SIZE = 2 * 1024 * 1024  # 2 MB


@router.post("/{employee_id}/signature")
async def upload_signature(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Uploader une signature électronique pour un employé.
    - L'employé peut uploader sa propre signature
    - RH/Admin peuvent uploader pour n'importe quel employé
    - Formats acceptés: PNG, JPEG, WebP
    - Taille max: 2 MB
    - Stockée en base64 data URL dans signature_url
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
    
    # Vérifier les permissions : soit c'est son propre profil, soit RH/Admin
    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    is_own_profile = (
        current_user.employee_id == employee.id
        or current_user.email == employee.email
    )
    is_admin_or_rh = user_role in ['rh', 'admin', 'dg', 'superadmin']
    
    if not is_own_profile and not is_admin_or_rh:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez uploader que votre propre signature"
        )
    
    # Vérifier le type de fichier
    if file.content_type not in ALLOWED_SIGNATURE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non accepté ({file.content_type}). Formats autorisés: PNG, JPEG, WebP"
        )
    
    # Lire le contenu
    content = await file.read()
    
    # Vérifier la taille
    if len(content) > MAX_SIGNATURE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop volumineux ({len(content) // 1024} KB). Taille max: 2 MB"
        )
    
    # Convertir en base64 data URL
    b64_data = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64_data}"
    
    # Sauvegarder dans la colonne signature_url
    employee.signature_url = data_url
    db.commit()
    
    return {
        "message": "Signature uploadée avec succès",
        "employee_id": employee.id,
        "employee_name": f"{employee.first_name} {employee.last_name}"
    }


@router.delete("/{employee_id}/signature")
async def delete_signature(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Supprimer la signature électronique d'un employé.
    - L'employé peut supprimer sa propre signature
    - RH/Admin peuvent supprimer pour n'importe quel employé
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
    
    # Vérifier les permissions
    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    is_own_profile = (
        current_user.employee_id == employee.id
        or current_user.email == employee.email
    )
    is_admin_or_rh = user_role in ['rh', 'admin', 'dg', 'superadmin']
    
    if not is_own_profile and not is_admin_or_rh:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez supprimer que votre propre signature"
        )
    
    if not employee.signature_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet employé n'a pas de signature enregistrée"
        )
    
    employee.signature_url = None
    db.commit()
    
    return {
        "message": "Signature supprimée avec succès",
        "employee_id": employee.id
    }


# ============================================
# PHOTO DE PROFIL
# ============================================

ALLOWED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/{employee_id}/photo")
async def upload_profile_photo(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Uploader une photo de profil pour un employé.
    - L'employé peut uploader sa propre photo
    - RH/Admin peuvent uploader pour n'importe quel employé
    - Formats acceptés: PNG, JPEG, WebP, GIF
    - Taille max: 5 MB
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

    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    is_own_profile = (
        current_user.employee_id == employee.id
        or current_user.email == employee.email
    )
    is_admin_or_rh = user_role in ['rh', 'admin', 'dg', 'superadmin']

    if not is_own_profile and not is_admin_or_rh:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez modifier que votre propre photo de profil"
        )

    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non accepté ({file.content_type}). Formats autorisés: PNG, JPEG, WebP"
        )

    content = await file.read()

    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop volumineux ({len(content) // 1024} Ko). Taille max: 5 Mo"
        )

    b64_data = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64_data}"

    employee.photo_url = data_url
    db.commit()

    return {
        "message": "Photo uploadée avec succès",
        "employee_id": employee.id,
        "photo_url": data_url
    }


@router.delete("/{employee_id}/photo")
async def delete_profile_photo(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """Supprimer la photo de profil d'un employé."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )

    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    is_own_profile = (
        current_user.employee_id == employee.id
        or current_user.email == employee.email
    )
    is_admin_or_rh = user_role in ['rh', 'admin', 'dg', 'superadmin']

    if not is_own_profile and not is_admin_or_rh:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez supprimer que votre propre photo"
        )

    employee.photo_url = None
    db.commit()

    return {"message": "Photo supprimée", "employee_id": employee.id}


@router.get("/{employee_id}/signature")
async def get_signature(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Récupérer la signature d'un employé (data URL base64).
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
    
    return {
        "employee_id": employee.id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "has_signature": employee.signature_url is not None,
        "signature_url": employee.signature_url
    }


class _SignatureCanvasBody(BaseModel):
    signature_b64: str  # raw base64 string (no data: prefix)


@router.put("/{employee_id}/signature-canvas")
async def save_signature_canvas(
    employee_id: int,
    body: _SignatureCanvasBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant)
):
    """
    Enregistre une signature dessinée sur un canvas (base64 PNG).
    Remplace la signature existante de l'employé.
    """
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    is_own = (
        current_user.employee_id == employee.id
        or current_user.email == employee.email
    )
    is_admin_rh = user_role in ['rh', 'admin', 'dg', 'superadmin']
    if not is_own and not is_admin_rh:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que votre propre signature")

    if not body.signature_b64:
        raise HTTPException(status_code=400, detail="Données de signature manquantes")

    employee.signature_url = f"data:image/png;base64,{body.signature_b64}"
    db.commit()

    return {
        "message": "Signature enregistrée avec succès",
        "employee_id": employee.id,
        "has_signature": True,
        "signature_url": employee.signature_url,
    }


@router.get("/{employee_id}/salary-history")
async def get_salary_history(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Historique salarial d'un employé (RH/Admin/DG ou soi-même)."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    user_role = str(current_user.role).lower() if current_user.role else "employee"
    for prefix in ["userrole.", "role."]:
        if user_role.startswith(prefix):
            user_role = user_role[len(prefix):]

    is_self = (
        (hasattr(current_user, 'employee_id') and current_user.employee_id == employee_id)
        or current_user.email == employee.email
    )
    is_hr_admin = user_role in ['rh', 'hr', 'admin', 'dg', 'dga', 'super_admin', 'superadmin']

    is_manager_of = False
    if not is_self and not is_hr_admin:
        if hasattr(current_user, 'employee_id') and current_user.employee_id:
            is_manager_of = employee.manager_id == current_user.employee_id
        else:
            current_emp = db.query(Employee).filter(
                Employee.email == current_user.email,
                Employee.tenant_id == current_user.tenant_id
            ).first()
            if current_emp:
                is_manager_of = employee.manager_id == current_emp.id

    if not (is_self or is_hr_admin or is_manager_of):
        raise HTTPException(status_code=403, detail="Accès refusé à cet historique salarial")

    history = db.query(SalaryHistory).filter(
        SalaryHistory.employee_id == employee_id,
        SalaryHistory.tenant_id == current_user.tenant_id
    ).order_by(SalaryHistory.effective_date.asc()).all()

    return [
        {
            "id": entry.id,
            "effective_date": str(entry.effective_date),
            "amount": float(entry.amount),
            "currency": entry.currency or "XOF",
            "previous_amount": float(entry.previous_amount) if entry.previous_amount else None,
            "change_percentage": float(entry.change_percentage) if entry.change_percentage else None,
            "reason": entry.reason,
            "created_at": str(entry.created_at) if entry.created_at else None,
        }
        for entry in history
    ]