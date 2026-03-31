from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from app.core.database import get_db
from app.models.department import Department
from app.models.employee import Employee, EmployeeStatus, EmployeeRole
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentWithChildren
)
from app.api.deps import get_current_user, get_current_tenant, require_rh, require_manager

router = APIRouter(prefix="/api/departments", tags=["Departments"])

# Niveaux organisationnels (ordre d'affichage uniquement, pas de contrainte parent)
LEVEL_HIERARCHY = {
    "president": {"order": 0, "label": "Présidence"},
    "vice_president": {"order": 1, "label": "Vice-Présidence"},
    "dg": {"order": 2, "label": "Direction Générale"},
    "dga": {"order": 3, "label": "Direction Générale Adjointe"},
    "direction_centrale": {"order": 4, "label": "Direction Centrale"},
    "direction": {"order": 5, "label": "Direction"},
    "departement": {"order": 6, "label": "Département"},
    "service": {"order": 7, "label": "Service"},
}


def get_level_label(level: str) -> str:
    """Retourne le label français d'un niveau"""
    return LEVEL_HIERARCHY.get(level, {}).get("label", level)


def resolve_target_tenant_id(
    db: Session,
    current_user: User,
    tenant: Tenant,
    subsidiary_tenant_id: Optional[int],
) -> int:
    """Résout le tenant cible pour la vue filiale d'un groupe."""
    if not subsidiary_tenant_id:
        return tenant.id

    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
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


@router.get("", response_model=List[DepartmentResponse])
@router.get("/", response_model=List[DepartmentResponse], include_in_schema=False)
async def get_departments(
    include_inactive: bool = Query(False),
    level: Optional[str] = Query(None, description="Filtrer par niveau (president, vice_president, dg, dga, direction_centrale, direction, departement, service)"),
    subsidiary_tenant_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Liste des départements/unités organisationnelles"""
    target_tenant_id = resolve_target_tenant_id(db, current_user, tenant, subsidiary_tenant_id)
    query = db.query(Department).filter(Department.tenant_id == target_tenant_id)
    
    if not include_inactive:
        query = query.filter(Department.is_active.is_not(False))
    
    if level:
        query = query.filter(Department.level == level)
    
    departments = query.all()
    
    # Trier par niveau hiérarchique puis par nom
    def sort_key(dept):
        level_order = LEVEL_HIERARCHY.get(dept.level, {}).get("order", 99)
        return (level_order, dept.name)
    
    departments.sort(key=sort_key)
    
    return departments


@router.get("/levels")
async def get_organizational_levels(
    current_user: User = Depends(get_current_user)
):
    """Retourne la liste des niveaux hiérarchiques disponibles"""
    return [
        {
            "value": key,
            "label": info["label"],
            "order": info["order"],
        }
        for key, info in LEVEL_HIERARCHY.items()
    ]


@router.get("/tree", response_model=List[DepartmentWithChildren])
async def get_departments_tree(
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Arborescence des départements (organigramme)"""
    departments = db.query(Department).filter(
        Department.tenant_id == tenant.id,
        Department.is_active == True
    ).all()
    
    # Compter les employés par département
    employee_counts = dict(
        db.query(
            Employee.department_id,
            func.count(Employee.id)
        ).filter(
            Employee.tenant_id == tenant.id,
            Employee.status != EmployeeStatus.TERMINATED
        ).group_by(Employee.department_id).all()
    )
    
    # Construire l'arbre
    dept_dict = {}
    for dept in departments:
        dept_data = DepartmentWithChildren.model_validate(dept)
        dept_data.employee_count = employee_counts.get(dept.id, 0)
        dept_dict[dept.id] = dept_data
    
    # Organiser en hiérarchie
    root_depts = []
    for dept_id, dept in dept_dict.items():
        if dept.parent_id and dept.parent_id in dept_dict:
            dept_dict[dept.parent_id].children.append(dept)
        else:
            root_depts.append(dept)
    
    # Trier les racines par niveau
    def sort_key(d):
        return LEVEL_HIERARCHY.get(d.level, {}).get("order", 99)
    
    root_depts.sort(key=sort_key)
    
    return root_depts


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Détail d'un département"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == tenant.id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    return department


@router.post("/", response_model=DepartmentResponse)
async def create_department(
    data: DepartmentCreate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Créer un département/unité organisationnelle"""
    
    # Valider que le niveau existe
    if data.level not in LEVEL_HIERARCHY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Niveau invalide. Valeurs autorisées: {', '.join(LEVEL_HIERARCHY.keys())}"
        )
    
    # Vérifier parent si spécifié
    if data.parent_id:
        parent = db.query(Department).filter(
            Department.id == data.parent_id,
            Department.tenant_id == tenant.id
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unité parent non trouvée"
            )
    
    # Vérifier responsable si spécifié
    if data.head_id:
        head = db.query(Employee).filter(
            Employee.id == data.head_id,
            Employee.tenant_id == tenant.id
        ).first()
        if not head:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Responsable non trouvé"
            )
    
    department = Department(
        tenant_id=tenant.id,
        **data.model_dump()
    )
    
    db.add(department)
    db.commit()
    db.refresh(department)
    
    return department


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    data: DepartmentUpdate,
    current_user: User = Depends(require_rh),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Modifier un département"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == tenant.id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    # Vérifier qu'on ne crée pas de boucle avec parent_id
    if data.parent_id:
        if data.parent_id == department_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un département ne peut pas être son propre parent"
            )
        
        parent = db.query(Department).filter(
            Department.id == data.parent_id,
            Department.tenant_id == tenant.id
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unité parent non trouvée"
            )
    
    # Valider le niveau si changé
    if data.level and data.level not in LEVEL_HIERARCHY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Niveau invalide. Valeurs autorisées: {', '.join(LEVEL_HIERARCHY.keys())}"
        )
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(department, field, value)
    
    db.commit()
    db.refresh(department)
    
    return department


@router.delete("/{department_id}")
async def delete_department(
    department_id: int,
    current_user: User = Depends(require_rh),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Désactiver un département"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == tenant.id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    # Vérifier qu'il n'y a pas d'employés actifs
    active_employees = db.query(Employee).filter(
        Employee.department_id == department_id,
        Employee.status != EmployeeStatus.TERMINATED
    ).count()
    
    if active_employees > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer: {active_employees} employés sont encore dans ce département"
        )
    
    # Vérifier qu'il n'y a pas d'enfants actifs
    active_children = db.query(Department).filter(
        Department.parent_id == department_id,
        Department.is_active == True
    ).count()
    
    if active_children > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer: {active_children} unités sont rattachées à ce département"
        )
    
    department.is_active = False
    db.commit()
    
    return {"message": "Département désactivé avec succès"}


@router.get("/{department_id}/employees", response_model=List)
async def get_department_employees(
    department_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Liste des employés d'un département"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == tenant.id
    ).first()
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )
    
    employees = db.query(Employee).filter(
        Employee.department_id == department_id,
        Employee.tenant_id == tenant.id,
        Employee.status != EmployeeStatus.TERMINATED
    ).all()
    
    return employees