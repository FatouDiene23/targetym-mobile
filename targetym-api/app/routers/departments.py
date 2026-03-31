from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Department, Employee, UserRole


# ==================== SCHEMAS ====================

class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = "#3B82F6"
    parent_id: Optional[int] = None
    head_id: Optional[int] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[int] = None
    head_id: Optional[int] = None
    is_active: Optional[bool] = None

class DepartmentResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None  # Changé en Optional pour gérer NULL
    parent_id: Optional[int] = None
    head_id: Optional[int] = None
    is_active: Optional[bool] = True  # Changé en Optional
    employee_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ==================== ROUTER ====================

router = APIRouter(prefix="/departments", tags=["Départements"])


@router.get("", response_model=List[DepartmentResponse])
async def list_departments(
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Liste des départements (filtrée par tenant automatiquement)
    """
    query = db.query(Department).filter(Department.tenant_id == current_user.tenant_id)
    
    # Filtres
    if is_active is not None:
        query = query.filter(Department.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Department.name.ilike(search_term)) |
            (Department.code.ilike(search_term))
        )
    
    departments = query.order_by(Department.name).all()
    
    # Ajouter le comptage des employés pour chaque département
    result = []
    for dept in departments:
        employee_count = db.query(Employee).filter(
            Employee.department_id == dept.id,
            Employee.tenant_id == current_user.tenant_id,
            Employee.is_active == True
        ).count()
        
        result.append(DepartmentResponse(
            id=dept.id,
            name=dept.name,
            code=dept.code,
            description=dept.description,
            color=dept.color or "#3B82F6",  # Valeur par défaut si NULL
            parent_id=dept.parent_id,
            head_id=dept.head_id,
            is_active=dept.is_active if dept.is_active is not None else True,
            employee_count=employee_count
        ))
    
    return result


@router.get("/stats")
async def get_department_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Statistiques des départements
    """
    tenant_id = current_user.tenant_id
    
    # Total départements
    total = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).count()
    
    # Départements actifs
    active = db.query(Department).filter(
        Department.tenant_id == tenant_id,
        Department.is_active == True
    ).count()
    
    # Employés par département
    by_department = db.query(
        Department.name,
        func.count(Employee.id).label('count')
    ).outerjoin(Employee, Employee.department_id == Department.id).filter(
        Department.tenant_id == tenant_id
    ).group_by(Department.id, Department.name).all()
    
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "by_department": [{"name": name, "count": count} for name, count in by_department]
    }


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer un département par ID
    """
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    # Compter les employés
    employee_count = db.query(Employee).filter(
        Employee.department_id == department.id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True
    ).count()
    
    return DepartmentResponse(
        id=department.id,
        name=department.name,
        code=department.code,
        description=department.description,
        color=department.color or "#3B82F6",
        parent_id=department.parent_id,
        head_id=department.head_id,
        is_active=department.is_active if department.is_active is not None else True,
        employee_count=employee_count
    )


@router.post("", response_model=DepartmentResponse)
async def create_department(
    data: DepartmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Créer un département (RH/Admin seulement)
    """
    # Vérifier les droits
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    # Vérifier si un département avec ce nom existe déjà
    existing = db.query(Department).filter(
        Department.name == data.name,
        Department.tenant_id == current_user.tenant_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un département avec ce nom existe déjà"
        )
    
    # Si parent_id est fourni, vérifier qu'il existe
    if data.parent_id:
        parent = db.query(Department).filter(
            Department.id == data.parent_id,
            Department.tenant_id == current_user.tenant_id
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Département parent non trouvé"
            )
    
    # Créer le département
    department = Department(
        tenant_id=current_user.tenant_id,
        name=data.name,
        code=data.code or data.name[:4].upper(),
        description=data.description,
        color=data.color or "#3B82F6",
        parent_id=data.parent_id,
        head_id=data.head_id,
        is_active=True
    )
    
    db.add(department)
    db.commit()
    db.refresh(department)
    
    return DepartmentResponse(
        id=department.id,
        name=department.name,
        code=department.code,
        description=department.description,
        color=department.color,
        parent_id=department.parent_id,
        head_id=department.head_id,
        is_active=department.is_active,
        employee_count=0
    )


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    data: DepartmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour un département (RH/Admin seulement)
    """
    # Vérifier les droits
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    # Mettre à jour
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(department, field, value)
    
    db.commit()
    db.refresh(department)
    
    # Compter les employés
    employee_count = db.query(Employee).filter(
        Employee.department_id == department.id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True
    ).count()
    
    return DepartmentResponse(
        id=department.id,
        name=department.name,
        code=department.code,
        description=department.description,
        color=department.color or "#3B82F6",
        parent_id=department.parent_id,
        head_id=department.head_id,
        is_active=department.is_active,
        employee_count=employee_count
    )


@router.delete("/{department_id}")
async def delete_department(
    department_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Désactiver un département (soft delete)
    """
    # Vérifier les droits
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé"
        )
    
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    # Vérifier si des employés sont dans ce département
    employee_count = db.query(Employee).filter(
        Employee.department_id == department_id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True
    ).count()
    
    if employee_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer: {employee_count} employé(s) dans ce département"
        )
    
    # Soft delete
    department.is_active = False
    db.commit()
    
    return {"message": "Département désactivé"}


@router.get("/{department_id}/employees")
async def get_department_employees(
    department_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les employés d'un département
    """
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    employees = db.query(Employee).filter(
        Employee.department_id == department_id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True
    ).order_by(Employee.last_name).all()
    
    return employees
