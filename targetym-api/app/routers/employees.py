from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Employee, Department, UserRole
from app.models.salary_history import SalaryHistory
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdateByRH,
    EmployeeUpdateBySelf,
    EmployeeResponse,
    EmployeeListResponse,
    EmployeesPageResponse,
)

router = APIRouter(prefix="/employees", tags=["Employés"])


# =============================================
# HELPERS
# =============================================

def employee_to_response(employee: Employee, db: Session) -> dict:
    """Convertir un employé en dict avec department_name et manager_name"""
    
    # Déterminer is_active basé sur status
    is_active = True
    if employee.status:
        status_str = str(employee.status).upper()
        if 'TERMINATED' in status_str or 'SUSPENDED' in status_str:
            is_active = False
    
    data = {
        "id": employee.id,
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
        "is_active": is_active,
        "site": employee.site,
        "contract_type": employee.contract_type,
        "hire_date": employee.hire_date,
        "end_date": getattr(employee, 'end_date', None),
        "probation_end_date": getattr(employee, 'probation_end_date', None),
        "salary": employee.salary,
        "net_salary": getattr(employee, 'net_salary', None),
        "currency": employee.currency or "XOF",
        "status": employee.status,
        "created_at": employee.created_at,
        "updated_at": employee.updated_at,
        "tenant_id": employee.tenant_id,
    }
    
    # Récupérer le nom du département
    if employee.department_id:
        dept = db.query(Department).filter(Department.id == employee.department_id).first()
        if dept:
            data["department_name"] = dept.name
    
    # Récupérer le nom du manager
    if employee.manager_id:
        manager = db.query(Employee).filter(Employee.id == employee.manager_id).first()
        if manager:
            data["manager_name"] = f"{manager.first_name} {manager.last_name}"
    
    return data


def track_salary_change(
    db: Session,
    employee: Employee,
    new_salary: float,
    reason: str = None,
    changed_by_user_id: int = None,
):
    """
    Enregistre automatiquement un changement de salaire dans l'historique.
    À appeler dans update_employee() quand le salaire change.
    """
    old_salary = float(employee.salary) if employee.salary else None
    change_pct = None
    
    if old_salary and old_salary > 0:
        change_pct = round(((new_salary - old_salary) / old_salary) * 100, 2)
    
    entry = SalaryHistory(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        effective_date=date.today(),
        amount=new_salary,
        currency=employee.currency or "XOF",
        previous_amount=old_salary,
        change_percentage=change_pct,
        reason=reason,
        created_by=changed_by_user_id,
    )
    db.add(entry)
    # Ne pas commit ici - le commit est fait dans l'endpoint parent


# =============================================
# ENDPOINTS
# =============================================

@router.get("", response_model=EmployeesPageResponse)
async def list_employees(
    department_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_manager: Optional[bool] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Liste des employés avec pagination (filtrée par tenant automatiquement)
    """
    query = db.query(Employee).filter(Employee.tenant_id == current_user.tenant_id)
    
    # Filtres
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    
    # Filtre is_active basé sur status
    if is_active is not None:
        if is_active:
            query = query.filter(Employee.status.notin_(['terminated', 'suspended']))
        else:
            query = query.filter(Employee.status.in_(['terminated', 'suspended']))
    
    if status:
        query = query.filter(Employee.status == status)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Employee.first_name.ilike(search_term)) |
            (Employee.last_name.ilike(search_term)) |
            (Employee.email.ilike(search_term)) |
            (Employee.employee_id.ilike(search_term)) |
            (Employee.job_title.ilike(search_term))
        )
    
    # Total count
    total = query.count()
    
    # Pagination
    skip = (page - 1) * page_size
    employees = query.order_by(Employee.last_name).offset(skip).limit(page_size).all()
    
    # Convertir avec department_name
    items = [employee_to_response(emp, db) for emp in employees]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/me", response_model=EmployeeResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer mon profil employé
    """
    if not current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil employé non trouvé"
        )
    
    employee = db.query(Employee).filter(
        Employee.id == current_user.employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil employé non trouvé"
        )
    
    return employee_to_response(employee, db)


@router.put("/me", response_model=EmployeeResponse)
async def update_my_profile(
    data: EmployeeUpdateBySelf,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour mon profil (infos personnelles seulement)
    """
    if not current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil employé non trouvé"
        )
    
    employee = db.query(Employee).filter(
        Employee.id == current_user.employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil employé non trouvé"
        )
    
    # Mettre à jour uniquement les champs autorisés
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(employee, field, value)
    
    db.commit()
    db.refresh(employee)
    
    return employee_to_response(employee, db)


@router.get("/stats")
async def get_employee_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Statistiques des employés (pour dashboard)
    """
    tenant_id = current_user.tenant_id
    
    total = db.query(Employee).filter(
        Employee.tenant_id == tenant_id
    ).count()
    
    active = db.query(Employee).filter(
        Employee.tenant_id == tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).count()
    
    inactive = db.query(Employee).filter(
        Employee.tenant_id == tenant_id,
        Employee.status.in_(['terminated', 'suspended'])
    ).count()
    
    on_leave = db.query(Employee).filter(
        Employee.tenant_id == tenant_id,
        Employee.status == 'on_leave'
    ).count()
    
    managers = db.query(func.count(func.distinct(Employee.manager_id))).filter(
        Employee.tenant_id == tenant_id,
        Employee.manager_id.isnot(None),
        Employee.status.notin_(['terminated', 'suspended'])
    ).scalar() or 0
    
    by_gender = db.query(
        Employee.gender,
        func.count(Employee.id)
    ).filter(
        Employee.tenant_id == tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).group_by(Employee.gender).all()
    
    gender_dict = {str(gender): count for gender, count in by_gender if gender}
    
    female_count = 0
    male_count = 0
    for gender, count in by_gender:
        if gender:
            gender_str = str(gender).upper()
            if 'FEMALE' in gender_str or gender_str == 'F':
                female_count += count
            elif 'MALE' in gender_str or gender_str == 'M':
                male_count += count
    
    by_department = db.query(
        Department.name,
        func.count(Employee.id)
    ).join(Employee, Employee.department_id == Department.id).filter(
        Employee.tenant_id == tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).group_by(Department.name).all()
    
    by_contract = db.query(
        Employee.contract_type,
        func.count(Employee.id)
    ).filter(
        Employee.tenant_id == tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).group_by(Employee.contract_type).all()
    
    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "on_leave": on_leave,
        "managers": managers,
        "top_managers": 0,
        "female": female_count,
        "male": male_count,
        "new_this_month": 0,
        "by_gender": gender_dict,
        "by_department": {name: count for name, count in by_department},
        "by_contract_type": {str(ctype): count for ctype, count in by_contract if ctype}
    }


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer un employé par ID
    """
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    return employee_to_response(employee, db)


@router.get("/{employee_id}/salary-history")
async def get_salary_history(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Récupérer l'historique salarial d'un employé.
    
    Permissions:
    - L'employé peut voir son propre historique
    - Le manager peut voir l'historique de ses N-1
    - RH/Admin/DG peuvent voir tout le monde
    """
    # Vérifier que l'employé existe et appartient au même tenant
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    # Vérification des permissions
    user_role = str(current_user.role).lower() if current_user.role else "employee"
    for prefix in ["userrole.", "role."]:
        if user_role.startswith(prefix):
            user_role = user_role[len(prefix):]
    
    # Vérifier si c'est l'employé lui-même
    is_self = False
    if hasattr(current_user, 'employee_id') and current_user.employee_id:
        is_self = current_user.employee_id == employee_id
    else:
        is_self = current_user.email == employee.email
    
    is_hr_admin = user_role in ['rh', 'hr', 'admin', 'dg', 'dga', 'super_admin']
    
    # Vérifier si c'est le manager
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cet historique salarial"
        )
    
    # Récupérer l'historique trié par date
    history = db.query(SalaryHistory).filter(
        SalaryHistory.employee_id == employee_id,
        SalaryHistory.tenant_id == current_user.tenant_id
    ).order_by(SalaryHistory.effective_date.asc()).all()
    
    result = []
    for entry in history:
        result.append({
            "id": entry.id,
            "effective_date": str(entry.effective_date),
            "amount": float(entry.amount),
            "currency": entry.currency or "XOF",
            "previous_amount": float(entry.previous_amount) if entry.previous_amount else None,
            "change_percentage": float(entry.change_percentage) if entry.change_percentage else None,
            "reason": entry.reason,
            "created_at": str(entry.created_at) if entry.created_at else None,
        })
    
    return result


@router.post("", response_model=EmployeeResponse)
async def create_employee(
    data: EmployeeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Créer un employé (RH/Admin seulement)
    """
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    existing = db.query(Employee).filter(
        Employee.email == data.email.lower(),
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un employé avec cet email existe déjà"
        )
    
    employee_data = data.model_dump()
    employee = Employee(
        tenant_id=current_user.tenant_id,
        **employee_data
    )
    employee.email = employee.email.lower()
    
    db.add(employee)
    db.commit()
    db.refresh(employee)
    
    # --- Auto-track salaire initial ---
    if employee.salary and float(employee.salary) > 0:
        track_salary_change(
            db=db,
            employee=employee,
            new_salary=float(employee.salary),
            reason="Salaire initial",
            changed_by_user_id=current_user.id,
        )
        db.commit()
    
    return employee_to_response(employee, db)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    data: EmployeeUpdateByRH,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour un employé (RH/Admin seulement)
    """
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    # --- Auto-track salary change ---
    update_data = data.model_dump(exclude_unset=True)
    if 'salary' in update_data and update_data['salary'] is not None:
        current_salary = float(employee.salary) if employee.salary else 0
        new_salary = float(update_data['salary'])
        if new_salary != current_salary:
            track_salary_change(
                db=db,
                employee=employee,
                new_salary=new_salary,
                reason="Modification par RH",
                changed_by_user_id=current_user.id,
            )
    
    # Mettre à jour les champs
    for field, value in update_data.items():
        setattr(employee, field, value)
    
    db.commit()
    db.refresh(employee)
    
    return employee_to_response(employee, db)


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Désactiver un employé (soft delete)
    """
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    employee.status = 'terminated'
    db.commit()
    
    return {"message": "Employé désactivé"}


@router.get("/{employee_id}/team", response_model=List[EmployeeListResponse])
async def get_team_members(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les membres de l'équipe d'un manager
    """
    manager = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manager non trouvé"
        )
    
    team = db.query(Employee).filter(
        Employee.manager_id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.status.notin_(['terminated', 'suspended'])
    ).all()
    
    return [employee_to_response(emp, db) for emp in team]