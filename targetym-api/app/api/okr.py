# app/api/okr.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date

from app.core.database import get_db
from app.models.okr import Objective, KeyResult, Initiative, ObjectiveLevel, ObjectiveStatus
from app.models.employee import Employee
from app.models.department import Department
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.okr import (
    ObjectiveCreate,
    ObjectiveUpdate,
    ObjectiveResponse,
    ObjectivesPageResponse,
    KeyResultCreate,
    KeyResultUpdate,
    KeyResultResponse,
    InitiativeCreate,
    InitiativeUpdate,
    InitiativeResponse,
    OKRStats
)
from app.api.deps import get_current_user, get_current_tenant, require_manager
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_OKR

router = APIRouter(prefix="/api/okr", tags=["OKR"], dependencies=[Depends(require_feature(FEATURE_OKR))])


# ============================================
# HELPERS
# ============================================

def calculate_objective_progress(objective: Objective) -> float:
    """Calcule la progression d'un objectif basé sur ses Key Results"""
    if not objective.key_results:
        return 0
    
    total_weight = sum(kr.weight for kr in objective.key_results)
    if total_weight == 0:
        return 0
    
    weighted_progress = sum(
        (min(kr.current / kr.target, 1) * 100 if kr.target > 0 else 0) * kr.weight
        for kr in objective.key_results
    )
    
    return round(weighted_progress / total_weight, 1)


def determine_status(progress: float, end_date: Optional[date]) -> str:
    """Détermine le statut basé sur la progression et la date de fin"""
    today = date.today()
    
    if progress >= 100:
        return "exceeded" if progress > 100 else "completed"
    
    if end_date and today > end_date:
        return "behind"
    
    if progress >= 70:
        return "on_track"
    elif progress >= 40:
        return "at_risk"
    else:
        return "behind"


def objective_to_dict(objective: Objective, db: Session, include_details: bool = True) -> dict:
    """Convertir un objectif en dict avec les infos enrichies"""
    
    # Calculer la progression
    progress = calculate_objective_progress(objective)
    
    # Infos propriétaire
    owner_name = None
    owner_initials = None
    if objective.owner_id:
        owner = db.query(Employee).filter(Employee.id == objective.owner_id).first()
        if owner:
            owner_name = f"{owner.first_name} {owner.last_name}"
            owner_initials = f"{owner.first_name[0]}{owner.last_name[0]}".upper()
    
    # Infos département
    department_name = None
    if objective.department_id:
        dept = db.query(Department).filter(Department.id == objective.department_id).first()
        if dept:
            department_name = dept.name
    
    data = {
        "id": objective.id,
        "tenant_id": objective.tenant_id,
        "title": objective.title,
        "description": objective.description,
        "level": objective.level.value if objective.level else "individual",
        "owner_id": objective.owner_id,
        "owner_name": owner_name,
        "owner_initials": owner_initials,
        "department_id": objective.department_id,
        "department_name": department_name,
        "parent_id": objective.parent_id,
        "period": objective.period,
        "start_date": objective.start_date,
        "end_date": objective.end_date,
        "progress": progress,
        "status": objective.status.value if objective.status else "draft",
        "is_active": objective.is_active,
        "created_at": objective.created_at,
        "updated_at": objective.updated_at,
    }
    
    if include_details:
        # Key Results
        data["key_results"] = [
            {
                "id": kr.id,
                "objective_id": kr.objective_id,
                "title": kr.title,
                "description": kr.description,
                "target": kr.target,
                "current": kr.current,
                "unit": kr.unit,
                "weight": kr.weight,
                "progress": round(min(kr.current / kr.target * 100, 100), 1) if kr.target > 0 else 0,
                "created_at": kr.created_at,
                "updated_at": kr.updated_at,
            }
            for kr in objective.key_results
        ]
        
        # Initiatives
        data["initiatives"] = [
            {
                "id": init.id,
                "objective_id": init.objective_id,
                "title": init.title,
                "description": init.description,
                "source": init.source.value if init.source else "manual",
                "external_id": init.external_id,
                "external_url": init.external_url,
                "progress": init.progress,
                "status": init.status.value if init.status else "not_started",
                "due_date": init.due_date,
                "created_at": init.created_at,
                "updated_at": init.updated_at,
            }
            for init in objective.initiatives
        ]
    else:
        data["key_results_count"] = len(objective.key_results)
        data["initiatives_count"] = len(objective.initiatives)
    
    return data


# ============================================
# OBJECTIVES ENDPOINTS
# ============================================

@router.get("/objectives", response_model=ObjectivesPageResponse)
async def get_objectives(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    level: Optional[str] = None,
    status: Optional[str] = None,
    owner_id: Optional[int] = None,
    department_id: Optional[int] = None,
    parent_id: Optional[int] = None,
    period: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Liste des objectifs avec pagination et filtres"""
    from sqlalchemy import or_

    query = db.query(Objective).filter(
        Objective.tenant_id == tenant.id,
        Objective.is_active == True
    )

    # Filtrage par rôle : employé ne voit que ses objectifs, manager voit ses N-1 aussi
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'
    if user_role not in ['admin', 'super_admin', 'rh', 'dg']:
        current_employee_id = current_user.employee_id
        if not current_employee_id:
            emp = db.query(Employee).filter(
                Employee.tenant_id == tenant.id,
                Employee.email == current_user.email
            ).first()
            current_employee_id = emp.id if emp else None

        if current_employee_id:
            if user_role == 'manager':
                # Manager : ses objectifs + ceux de ses N-1
                team_ids = [e.id for e in db.query(Employee).filter(Employee.manager_id == current_employee_id).all()]
                all_ids = [current_employee_id] + team_ids
                query = query.filter(
                    or_(
                        Objective.owner_id.in_(all_ids),
                        Objective.level.in_([ObjectiveLevel.ENTERPRISE, ObjectiveLevel.DEPARTMENT])
                    )
                )
            else:
                # Employé : seulement ses objectifs + objectifs enterprise/department
                query = query.filter(
                    or_(
                        Objective.owner_id == current_employee_id,
                        Objective.level.in_([ObjectiveLevel.ENTERPRISE, ObjectiveLevel.DEPARTMENT])
                    )
                )
        else:
            # Pas d'employee_id : seulement objectifs enterprise/department
            query = query.filter(Objective.level.in_([ObjectiveLevel.ENTERPRISE, ObjectiveLevel.DEPARTMENT]))

    # Filtres
    if level:
        try:
            level_enum = ObjectiveLevel(level.lower())
            query = query.filter(Objective.level == level_enum)
        except ValueError:
            pass
    
    if status:
        try:
            status_enum = ObjectiveStatus(status.lower())
            query = query.filter(Objective.status == status_enum)
        except ValueError:
            pass
    
    if owner_id:
        query = query.filter(Objective.owner_id == owner_id)
    
    if department_id:
        query = query.filter(Objective.department_id == department_id)
    
    if parent_id:
        query = query.filter(Objective.parent_id == parent_id)
    
    if period:
        query = query.filter(Objective.period == period)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(Objective.title.ilike(search_filter))
    
    # Count total
    total = query.count()
    
    # Pagination
    offset = (page - 1) * page_size
    objectives = query.order_by(Objective.created_at.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    # Convertir avec infos enrichies
    items = [objective_to_dict(obj, db) for obj in objectives]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/objectives/{objective_id}", response_model=ObjectiveResponse)
async def get_objective(
    objective_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Détail d'un objectif"""
    objective = db.query(Objective).filter(
        Objective.id == objective_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not objective:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Objectif non trouvé"
        )
    
    return objective_to_dict(objective, db)


@router.post("/objectives", response_model=ObjectiveResponse)
async def create_objective(
    data: ObjectiveCreate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Créer un objectif (Manager+ uniquement)"""
    user_role = str(current_user.role.value).lower() if current_user.role else 'employee'

    # Un manager ne peut pas créer d'objectif entreprise (réservé RH/Admin/DG)
    requested_level = data.level.value if data.level else 'individual'
    if user_role == 'manager' and requested_level == 'enterprise':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Les objectifs entreprise sont réservés à la Direction et aux RH"
        )

    # Un manager ne peut assigner un objectif qu'à lui-même ou à ses N-1
    if user_role == 'manager' and data.owner_id:
        current_employee_id = current_user.employee_id
        if current_employee_id and data.owner_id != current_employee_id:
            is_direct_report = db.query(Employee).filter(
                Employee.id == data.owner_id,
                Employee.manager_id == current_employee_id,
                Employee.tenant_id == tenant.id
            ).first()
            if not is_direct_report:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Vous ne pouvez assigner un objectif qu'à vos collaborateurs directs"
                )

    # Vérifier que le parent existe si spécifié
    if data.parent_id:
        parent = db.query(Objective).filter(
            Objective.id == data.parent_id,
            Objective.tenant_id == tenant.id
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Objectif parent non trouvé"
            )
    
    # Vérifier que le propriétaire existe si spécifié
    if data.owner_id:
        owner = db.query(Employee).filter(
            Employee.id == data.owner_id,
            Employee.tenant_id == tenant.id
        ).first()
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Propriétaire non trouvé"
            )
    
    # Vérifier que le département existe si spécifié
    if data.department_id:
        dept = db.query(Department).filter(
            Department.id == data.department_id,
            Department.tenant_id == tenant.id
        ).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Département non trouvé"
            )
    
    # Créer l'objectif
    objective = Objective(
        tenant_id=tenant.id,
        title=data.title,
        description=data.description,
        level=ObjectiveLevel(data.level.value) if data.level else ObjectiveLevel.INDIVIDUAL,
        owner_id=data.owner_id,
        department_id=data.department_id,
        parent_id=data.parent_id,
        period=data.period,
        start_date=data.start_date,
        end_date=data.end_date,
        status=ObjectiveStatus(data.status.value) if data.status else ObjectiveStatus.DRAFT,
        progress=0
    )
    
    db.add(objective)
    db.flush()  # Pour obtenir l'ID
    
    # Ajouter les Key Results si fournis
    if data.key_results:
        for kr_data in data.key_results:
            kr = KeyResult(
                objective_id=objective.id,
                title=kr_data.title,
                description=kr_data.description,
                target=kr_data.target,
                current=kr_data.current,
                unit=kr_data.unit,
                weight=kr_data.weight
            )
            db.add(kr)
    
    db.commit()
    db.refresh(objective)
    
    # Mettre à jour la progression
    objective.progress = calculate_objective_progress(objective)
    db.commit()

    # Email au propriétaire si différent du créateur
    if data.owner_id and data.owner_id != current_user.employee_id:
        try:
            from app.services.email_service import send_okr_assigned_email
            owner = db.query(Employee).filter(
                Employee.id == data.owner_id,
                Employee.tenant_id == tenant.id
            ).first()
            creator_emp = db.query(Employee).filter(
                Employee.id == current_user.employee_id
            ).first() if current_user.employee_id else None
            if owner and owner.email:
                send_okr_assigned_email(
                    to_email=owner.email,
                    first_name=owner.first_name,
                    objective_title=data.title,
                    period=data.period,
                    end_date=str(data.end_date) if data.end_date else None,
                    assigned_by=f"{creator_emp.first_name} {creator_emp.last_name}" if creator_emp else None,
                )
        except Exception as e:
            print(f"⚠️ Email OKR non envoyé: {e}")

    return objective_to_dict(objective, db)


@router.put("/objectives/{objective_id}", response_model=ObjectiveResponse)
async def update_objective(
    objective_id: int,
    data: ObjectiveUpdate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Modifier un objectif"""
    objective = db.query(Objective).filter(
        Objective.id == objective_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not objective:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Objectif non trouvé"
        )
    
    # Mettre à jour les champs fournis
    update_data = data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "level" and value:
            setattr(objective, field, ObjectiveLevel(value.value))
        elif field == "status" and value:
            setattr(objective, field, ObjectiveStatus(value.value))
        else:
            setattr(objective, field, value)
    
    # Recalculer la progression
    objective.progress = calculate_objective_progress(objective)
    
    db.commit()
    db.refresh(objective)
    
    return objective_to_dict(objective, db)


@router.delete("/objectives/{objective_id}")
async def delete_objective(
    objective_id: int,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Supprimer un objectif (soft delete)"""
    objective = db.query(Objective).filter(
        Objective.id == objective_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not objective:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Objectif non trouvé"
        )
    
    # Soft delete
    objective.is_active = False
    objective.status = ObjectiveStatus.CANCELLED
    db.commit()
    
    return {"message": "Objectif supprimé avec succès"}


# ============================================
# KEY RESULTS ENDPOINTS
# ============================================

@router.post("/objectives/{objective_id}/key-results", response_model=KeyResultResponse)
async def add_key_result(
    objective_id: int,
    data: KeyResultCreate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Ajouter un Key Result à un objectif"""
    objective = db.query(Objective).filter(
        Objective.id == objective_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not objective:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Objectif non trouvé"
        )
    
    kr = KeyResult(
        objective_id=objective_id,
        title=data.title,
        description=data.description,
        target=data.target,
        current=data.current,
        unit=data.unit,
        weight=data.weight
    )
    
    db.add(kr)
    db.commit()
    db.refresh(kr)
    
    # Mettre à jour la progression de l'objectif
    objective.progress = calculate_objective_progress(objective)
    db.commit()
    
    return {
        "id": kr.id,
        "objective_id": kr.objective_id,
        "title": kr.title,
        "description": kr.description,
        "target": kr.target,
        "current": kr.current,
        "unit": kr.unit,
        "weight": kr.weight,
        "progress": round(min(kr.current / kr.target * 100, 100), 1) if kr.target > 0 else 0,
        "created_at": kr.created_at,
        "updated_at": kr.updated_at
    }


@router.put("/key-results/{kr_id}", response_model=KeyResultResponse)
async def update_key_result(
    kr_id: int,
    data: KeyResultUpdate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Modifier un Key Result"""
    kr = db.query(KeyResult).join(Objective).filter(
        KeyResult.id == kr_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not kr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Key Result non trouvé"
        )
    
    # Mettre à jour les champs fournis
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kr, field, value)
    
    db.commit()
    db.refresh(kr)
    
    # Mettre à jour la progression de l'objectif parent
    objective = db.query(Objective).filter(Objective.id == kr.objective_id).first()
    if objective:
        objective.progress = calculate_objective_progress(objective)
        db.commit()
    
    return {
        "id": kr.id,
        "objective_id": kr.objective_id,
        "title": kr.title,
        "description": kr.description,
        "target": kr.target,
        "current": kr.current,
        "unit": kr.unit,
        "weight": kr.weight,
        "progress": round(min(kr.current / kr.target * 100, 100), 1) if kr.target > 0 else 0,
        "created_at": kr.created_at,
        "updated_at": kr.updated_at
    }


@router.delete("/key-results/{kr_id}")
async def delete_key_result(
    kr_id: int,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Supprimer un Key Result"""
    kr = db.query(KeyResult).join(Objective).filter(
        KeyResult.id == kr_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not kr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Key Result non trouvé"
        )
    
    objective_id = kr.objective_id
    db.delete(kr)
    db.commit()
    
    # Mettre à jour la progression de l'objectif parent
    objective = db.query(Objective).filter(Objective.id == objective_id).first()
    if objective:
        objective.progress = calculate_objective_progress(objective)
        db.commit()
    
    return {"message": "Key Result supprimé avec succès"}


# ============================================
# INITIATIVES ENDPOINTS
# ============================================

@router.post("/objectives/{objective_id}/initiatives", response_model=InitiativeResponse)
async def add_initiative(
    objective_id: int,
    data: InitiativeCreate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Ajouter une initiative à un objectif"""
    objective = db.query(Objective).filter(
        Objective.id == objective_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not objective:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Objectif non trouvé"
        )
    
    from app.models.okr import InitiativeSource as InitSourceModel, InitiativeStatus as InitStatusModel
    
    initiative = Initiative(
        objective_id=objective_id,
        title=data.title,
        description=data.description,
        source=InitSourceModel(data.source.value) if data.source else InitSourceModel.MANUAL,
        external_id=data.external_id,
        external_url=data.external_url,
        progress=data.progress,
        status=InitStatusModel(data.status.value) if data.status else InitStatusModel.NOT_STARTED,
        due_date=data.due_date
    )
    
    db.add(initiative)
    db.commit()
    db.refresh(initiative)
    
    return {
        "id": initiative.id,
        "objective_id": initiative.objective_id,
        "title": initiative.title,
        "description": initiative.description,
        "source": initiative.source.value if initiative.source else "manual",
        "external_id": initiative.external_id,
        "external_url": initiative.external_url,
        "progress": initiative.progress,
        "status": initiative.status.value if initiative.status else "not_started",
        "due_date": initiative.due_date,
        "created_at": initiative.created_at,
        "updated_at": initiative.updated_at
    }


@router.put("/initiatives/{initiative_id}", response_model=InitiativeResponse)
async def update_initiative(
    initiative_id: int,
    data: InitiativeUpdate,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Modifier une initiative"""
    initiative = db.query(Initiative).join(Objective).filter(
        Initiative.id == initiative_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not initiative:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Initiative non trouvée"
        )
    
    from app.models.okr import InitiativeSource as InitSourceModel, InitiativeStatus as InitStatusModel
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "source" and value:
            setattr(initiative, field, InitSourceModel(value.value))
        elif field == "status" and value:
            setattr(initiative, field, InitStatusModel(value.value))
        else:
            setattr(initiative, field, value)
    
    db.commit()
    db.refresh(initiative)
    
    return {
        "id": initiative.id,
        "objective_id": initiative.objective_id,
        "title": initiative.title,
        "description": initiative.description,
        "source": initiative.source.value if initiative.source else "manual",
        "external_id": initiative.external_id,
        "external_url": initiative.external_url,
        "progress": initiative.progress,
        "status": initiative.status.value if initiative.status else "not_started",
        "due_date": initiative.due_date,
        "created_at": initiative.created_at,
        "updated_at": initiative.updated_at
    }


@router.delete("/initiatives/{initiative_id}")
async def delete_initiative(
    initiative_id: int,
    current_user: User = Depends(require_manager),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Supprimer une initiative"""
    initiative = db.query(Initiative).join(Objective).filter(
        Initiative.id == initiative_id,
        Objective.tenant_id == tenant.id
    ).first()
    
    if not initiative:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Initiative non trouvée"
        )
    
    db.delete(initiative)
    db.commit()
    
    return {"message": "Initiative supprimée avec succès"}


# ============================================
# STATS ENDPOINT (avec filtres)
# ============================================

@router.get("/stats", response_model=OKRStats)
async def get_okr_stats(
    level: Optional[str] = None,
    period: Optional[str] = None,
    department_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Statistiques OKR pour le dashboard (avec filtres)"""
    query = db.query(Objective).filter(
        Objective.tenant_id == tenant.id,
        Objective.is_active == True
    )
    
    # Appliquer les filtres
    if level:
        try:
            level_enum = ObjectiveLevel(level.lower())
            query = query.filter(Objective.level == level_enum)
        except ValueError:
            pass
    
    if period:
        query = query.filter(Objective.period == period)
    
    if department_id:
        query = query.filter(Objective.department_id == department_id)
    
    objectives = query.all()
    
    if not objectives:
        return {
            "total": 0,
            "by_level": {},
            "by_status": {},
            "avg_progress": 0,
            "completed": 0,
            "in_progress": 0,
            "not_started": 0,
            "overdue": 0,
            "by_department": {}
        }
    
    # Stats par niveau
    by_level = {}
    for obj in objectives:
        level_val = obj.level.value if obj.level else "individual"
        by_level[level_val] = by_level.get(level_val, 0) + 1
    
    # Stats par statut
    by_status = {}
    for obj in objectives:
        status_val = obj.status.value if obj.status else "draft"
        by_status[status_val] = by_status.get(status_val, 0) + 1
    
    # Progression moyenne
    total_progress = sum(calculate_objective_progress(obj) for obj in objectives)
    avg_progress = round(total_progress / len(objectives), 1)
    
    # Compteurs
    completed = len([o for o in objectives if o.status and o.status.value in ["completed", "exceeded"]])
    in_progress = len([o for o in objectives if o.status and o.status.value in ["active", "on_track", "at_risk"]])
    not_started = len([o for o in objectives if o.status and o.status.value == "draft"])
    
    # En retard
    today = date.today()
    overdue = len([o for o in objectives if o.end_date and o.end_date < today and o.status and o.status.value not in ["completed", "exceeded", "cancelled"]])
    
    # Par département
    by_department = {}
    for obj in objectives:
        if obj.department_id:
            dept = db.query(Department).filter(Department.id == obj.department_id).first()
            dept_name = dept.name if dept else "Inconnu"
            if dept_name not in by_department:
                by_department[dept_name] = {"count": 0, "total_progress": 0}
            by_department[dept_name]["count"] += 1
            by_department[dept_name]["total_progress"] += calculate_objective_progress(obj)
    
    # Calculer la moyenne par département
    for dept_name in by_department:
        count = by_department[dept_name]["count"]
        by_department[dept_name]["avg_progress"] = round(by_department[dept_name]["total_progress"] / count, 1) if count > 0 else 0
        del by_department[dept_name]["total_progress"]
    
    return {
        "total": len(objectives),
        "by_level": by_level,
        "by_status": by_status,
        "avg_progress": avg_progress,
        "completed": completed,
        "in_progress": in_progress,
        "not_started": not_started,
        "overdue": overdue,
        "by_department": by_department
    }