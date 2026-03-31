from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case
from typing import Optional, List
from datetime import date, datetime, timezone, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_TASKS
from app.models import User, Employee, UserRole
from app.models.task import Task, DailyValidation
from app.models.okr import Objective, KeyResult
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskComplete,
    TaskResponse,
    TasksPageResponse,
    TaskStats,
    DailyValidationSubmit,
    DailyValidationAction,
    DailyValidationResponse,
    DailyValidationsPageResponse,
    PendingValidationResponse
)

router = APIRouter(prefix="/api/tasks", tags=["Tâches"], dependencies=[Depends(require_feature(FEATURE_TASKS))])

# Constantes pour les statuts (en minuscules pour PostgreSQL)
STATUS_PENDING = "pending"
STATUS_IN_PROGRESS = "in_progress"
STATUS_COMPLETED = "completed"
STATUS_CANCELLED = "cancelled"

VALIDATION_PENDING = "pending"
VALIDATION_APPROVED = "approved"
VALIDATION_REJECTED = "rejected"

PRIORITY_LOW = "low"
PRIORITY_MEDIUM = "medium"
PRIORITY_HIGH = "high"
PRIORITY_URGENT = "urgent"

# Rôles autorisés pour les fonctions manager (en minuscules)
MANAGER_ROLES = ['admin', 'rh', 'manager', 'dg']


def is_manager_role(role: str) -> bool:
    """Vérifie si le rôle est un rôle manager (insensible à la casse)"""
    if not role:
        return False
    return role.lower() in MANAGER_ROLES


def task_to_response(task: Task, db: Session) -> dict:
    """Convertir une tâche en dict avec noms"""
    data = {
        "id": task.id,
        "tenant_id": task.tenant_id,
        "title": task.title,
        "description": task.description,
        "assigned_to_id": task.assigned_to_id,
        "assigned_to_name": None,
        "created_by_id": task.created_by_id,
        "created_by_name": None,
        "due_date": task.due_date,
        "completed_at": task.completed_at,
        "status": task.status,
        "priority": task.priority,
        "completion_note": task.completion_note,
        "incomplete_reason": task.incomplete_reason,
        "is_overdue": task.status not in [STATUS_COMPLETED, STATUS_CANCELLED] and task.due_date < date.today(),
        # Source externe
        "source": task.source or "manual",
        "external_id": task.external_id,
        "external_url": task.external_url,
        # Lien OKR
        "objective_id": task.objective_id,
        "objective_title": None,
        "key_result_id": task.key_result_id,
        "key_result_title": None,
        # Tâche administrative
        "is_administrative": getattr(task, 'is_administrative', False) or False,
        # Daily checklist
        "checklist_item_id": getattr(task, 'checklist_item_id', None),
        # Timestamps
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }
    
    # Noms des employés
    if task.assigned_to_id:
        emp = db.query(Employee).filter(Employee.id == task.assigned_to_id).first()
        if emp:
            data["assigned_to_name"] = f"{emp.first_name} {emp.last_name}"
    
    if task.created_by_id:
        emp = db.query(Employee).filter(Employee.id == task.created_by_id).first()
        if emp:
            data["created_by_name"] = f"{emp.first_name} {emp.last_name}"
    
    # Infos OKR
    if task.objective_id:
        objective = db.query(Objective).filter(Objective.id == task.objective_id).first()
        if objective:
            data["objective_title"] = objective.title
    
    if task.key_result_id:
        key_result = db.query(KeyResult).filter(KeyResult.id == task.key_result_id).first()
        if key_result:
            data["key_result_title"] = key_result.title
    
    return data


def validation_to_response(validation: DailyValidation, db: Session) -> dict:
    """Convertir une validation en dict avec noms"""
    data = {
        "id": validation.id,
        "tenant_id": validation.tenant_id,
        "employee_id": validation.employee_id,
        "employee_name": None,
        "validation_date": validation.validation_date,
        "status": validation.status,
        "submitted_at": validation.submitted_at,
        "submission_note": validation.submission_note,
        "validated_by_id": validation.validated_by_id,
        "validated_by_name": None,
        "validated_at": validation.validated_at,
        "validation_comment": validation.validation_comment,
        "total_tasks": validation.total_tasks,
        "completed_tasks": validation.completed_tasks,
        "completion_rate": (validation.completed_tasks / validation.total_tasks * 100) if validation.total_tasks > 0 else 0,
        "created_at": validation.created_at,
    }
    
    if validation.employee_id:
        emp = db.query(Employee).filter(Employee.id == validation.employee_id).first()
        if emp:
            data["employee_name"] = f"{emp.first_name} {emp.last_name}"
    
    if validation.validated_by_id:
        emp = db.query(Employee).filter(Employee.id == validation.validated_by_id).first()
        if emp:
            data["validated_by_name"] = f"{emp.first_name} {emp.last_name}"
    
    return data


def get_employee_from_user(user: User, db: Session) -> Employee:
    """Récupérer l'employé associé à un user"""
    if not user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilisateur non associé à un employé"
        )
    
    employee = db.query(Employee).filter(Employee.id == user.employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employé non trouvé"
        )
    
    return employee


def get_team_members(manager_id: int, tenant_id: int, db: Session) -> List[Employee]:
    """Récupérer les membres de l'équipe d'un manager"""
    all_members = db.query(Employee).filter(
        Employee.tenant_id == tenant_id,
        Employee.manager_id == manager_id
    ).all()
    
    return [
        emp for emp in all_members 
        if not emp.status or emp.status.upper() not in ['TERMINATED', 'SUSPENDED']
    ]


def get_team_member_ids(manager_id: int, tenant_id: int, db: Session) -> List[int]:
    """Récupérer les IDs des membres de l'équipe"""
    team = get_team_members(manager_id, tenant_id, db)
    return [emp.id for emp in team]


# ============================================
# TASK ENDPOINTS
# ============================================

@router.get("", response_model=TasksPageResponse)
async def get_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    assigned_to_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    due_date: Optional[date] = None,
    overdue_only: bool = False,
    objective_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des tâches avec filtres"""
    query = db.query(Task).filter(Task.tenant_id == current_user.tenant_id)
    
    if assigned_to_id:
        query = query.filter(Task.assigned_to_id == assigned_to_id)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if priority:
        query = query.filter(Task.priority == priority)
    if due_date:
        query = query.filter(Task.due_date == due_date)
    if overdue_only:
        query = query.filter(
            Task.status.notin_([STATUS_COMPLETED, STATUS_CANCELLED]),
            Task.due_date < date.today()
        )
    if objective_id:
        query = query.filter(Task.objective_id == objective_id)
    
    total = query.count()
    query = query.order_by(Task.due_date.asc(), Task.priority.desc())
    offset = (page - 1) * page_size
    tasks = query.offset(offset).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": [task_to_response(t, db) for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/my-tasks", response_model=TasksPageResponse)
async def get_my_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    due_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mes tâches (assignées à moi)"""
    employee = get_employee_from_user(current_user, db)
    
    query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.assigned_to_id == employee.id
    )
    
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if due_date:
        query = query.filter(Task.due_date == due_date)
    
    total = query.count()
    query = query.order_by(Task.due_date.asc(), Task.priority.desc())
    offset = (page - 1) * page_size
    tasks = query.offset(offset).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": [task_to_response(t, db) for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/my-tasks/today", response_model=List[TaskResponse])
async def get_my_tasks_today(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mes tâches du jour (non encore soumises dans une validation)"""
    employee = get_employee_from_user(current_user, db)
    today = date.today()
    
    # Trouver la dernière validation soumise (pending ou approved)
    last_validation = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == current_user.tenant_id,
        DailyValidation.employee_id == employee.id,
        DailyValidation.status.in_([VALIDATION_PENDING, VALIDATION_APPROVED])
    ).order_by(DailyValidation.validation_date.desc()).first()
    
    # Récupérer les tâches non couvertes par une validation
    query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.assigned_to_id == employee.id,
        Task.status != STATUS_CANCELLED,
        Task.due_date <= today
    )
    
    # Exclure les tâches déjà soumises
    if last_validation:
        query = query.filter(
            or_(
                Task.created_at > last_validation.submitted_at,
                Task.due_date > last_validation.validation_date
            )
        )
    
    tasks = query.order_by(Task.due_date.asc(), Task.priority.desc()).all()
    
    return [task_to_response(t, db) for t in tasks]


@router.get("/my-stats", response_model=TaskStats)
async def get_my_task_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Statistiques de mes tâches"""
    employee = get_employee_from_user(current_user, db)
    today = date.today()
    
    base_query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.assigned_to_id == employee.id
    )
    
    total = base_query.count()
    pending = base_query.filter(Task.status == STATUS_PENDING).count()
    in_progress = base_query.filter(Task.status == STATUS_IN_PROGRESS).count()
    completed = base_query.filter(Task.status == STATUS_COMPLETED).count()
    
    overdue = base_query.filter(
        Task.status.in_([STATUS_PENDING, STATUS_IN_PROGRESS]),
        Task.due_date < today
    ).count()
    
    due_today = base_query.filter(
        Task.status.in_([STATUS_PENDING, STATUS_IN_PROGRESS]),
        Task.due_date == today
    ).count()
    
    return {
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "completed": completed,
        "overdue": overdue,
        "due_today": due_today
    }


@router.get("/team-members")
async def get_my_team_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des membres de mon équipe"""
    manager = get_employee_from_user(current_user, db)
    team = get_team_members(manager.id, current_user.tenant_id, db)
    
    return [
        {
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name}",
            "job_title": emp.job_title,
            "email": emp.email
        }
        for emp in team
    ]


@router.get("/team-tasks", response_model=TasksPageResponse)
async def get_team_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    employee_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tâches de mon équipe (mes N-1)"""
    if not is_manager_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux managers"
        )
    
    manager = get_employee_from_user(current_user, db)
    team_ids = get_team_member_ids(manager.id, current_user.tenant_id, db)
    
    if not team_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
    
    query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.assigned_to_id.in_(team_ids)
    )
    
    if employee_id and employee_id in team_ids:
        query = query.filter(Task.assigned_to_id == employee_id)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    
    total = query.count()
    query = query.order_by(Task.due_date.asc(), Task.priority.desc())
    offset = (page - 1) * page_size
    tasks = query.offset(offset).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": [task_to_response(t, db) for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/objectives-for-linking")
async def get_objectives_for_linking(
    employee_id: Optional[int] = Query(None, description="ID de l'employé cible (optionnel, défaut = utilisateur courant)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Liste des objectifs auxquels on peut lier une tâche.
    
    - Si employee_id est fourni: retourne les objectifs de cet employé
    - Sinon: retourne les objectifs de l'utilisateur courant
    
    Objectifs retournés (triés par niveau):
    1. Entreprise (enterprise)
    2. Département (department) - du département de l'employé cible
    3. Individuels (individual) - de l'employé cible
    """
    # Déterminer l'employé cible
    if employee_id:
        target_employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == current_user.tenant_id
        ).first()
        if not target_employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employé non trouvé"
            )
    else:
        target_employee = get_employee_from_user(current_user, db)
    
    # Construire les conditions OR pour les différents niveaux
    level_conditions = [
        # Objectifs entreprise (visibles par tous)
        Objective.level == "enterprise",
    ]
    
    # Objectifs du département de l'employé cible
    if target_employee.department_id:
        level_conditions.append(
            and_(
                Objective.level == "department",
                Objective.department_id == target_employee.department_id
            )
        )
    
    # Objectifs individuels de l'employé cible
    level_conditions.append(
        and_(
            Objective.level == "individual",
            Objective.owner_id == target_employee.id
        )
    )
    
    # Requête avec tri par niveau
    objectives = db.query(Objective).filter(
        Objective.tenant_id == current_user.tenant_id,
        Objective.is_active == True,
        or_(*level_conditions)
    ).order_by(
        # Trier: Enterprise (1) > Department (2) > Individual (3)
        case(
            (Objective.level == "enterprise", 1),
            (Objective.level == "department", 2),
            (Objective.level == "individual", 3),
            else_=4
        ),
        Objective.title
    ).all()
    
    result = []
    for obj in objectives:
        obj_data = {
            "id": obj.id,
            "title": obj.title,
            "level": obj.level.value if hasattr(obj.level, 'value') else obj.level,
            "progress": obj.progress or 0,
            "key_results": []
        }
        
        # Récupérer les key results (SANS filtre is_active car KeyResult n'a pas ce champ)
        key_results = db.query(KeyResult).filter(
            KeyResult.objective_id == obj.id
        ).all()
        
        for kr in key_results:
            obj_data["key_results"].append({
                "id": kr.id,
                "title": kr.title,
                "current": kr.current_value if hasattr(kr, 'current_value') else getattr(kr, 'current', 0),
                "target": kr.target_value if hasattr(kr, 'target_value') else getattr(kr, 'target', 100),
                "unit": kr.unit
            })
        
        result.append(obj_data)
    
    return result


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Détail d'une tâche"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.tenant_id == current_user.tenant_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tâche non trouvée")
    
    return task_to_response(task, db)


@router.post("", response_model=TaskResponse)
async def create_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Créer une tâche.
    
    Règles de liaison OKR:
    - Si is_administrative=True: pas besoin d'objective_id (tâche administrative)
    - Si is_administrative=False: objective_id est OBLIGATOIRE
    - key_result_id est toujours optionnel
    """
    creator = get_employee_from_user(current_user, db)
    
    # Récupérer is_administrative (défaut: False)
    is_administrative = getattr(data, 'is_administrative', False) or False
    
    # Validation: OKR obligatoire sauf tâche administrative
    if not is_administrative and not data.objective_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une tâche non-administrative doit être liée à un objectif. Cochez 'Tâche administrative' ou sélectionnez un objectif."
        )
    
    assignee = db.query(Employee).filter(
        Employee.id == data.assigned_to_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not assignee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé assigné non trouvé")
    
    # Vérification permission d'assignation :
    # - Self-assignment : toujours autorisé
    # - Collaborateur direct (manager_id match) : autorisé
    # - Tâche administrative créée par un rôle manager/rh/admin/dg : autorisé
    #   (ex: plan d'amélioration issu d'un entretien 1-on-1)
    is_direct_assign = data.assigned_to_id == creator.id
    is_direct_report = assignee.manager_id == creator.id
    is_admin_task = is_administrative and is_manager_role(current_user.role)
    if not (is_direct_assign or is_direct_report or is_admin_task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez assigner des tâches qu'à vous-même ou à vos collaborateurs directs"
        )
    
    # Déterminer objective_id et key_result_id
    objective_id = None
    key_result_id = None
    
    if not is_administrative:
        # Vérifier que l'objectif existe
        if data.objective_id:
            objective = db.query(Objective).filter(
                Objective.id == data.objective_id,
                Objective.tenant_id == current_user.tenant_id
            ).first()
            if not objective:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objectif non trouvé")
            objective_id = data.objective_id
        
        # Vérifier que le key result existe si fourni
        if data.key_result_id:
            key_result = db.query(KeyResult).filter(
                KeyResult.id == data.key_result_id
            ).first()
            if not key_result:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key Result non trouvé")
            # Vérifier que le KR appartient à l'objectif
            if objective_id and key_result.objective_id != objective_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le Key Result ne correspond pas à l'Objectif sélectionné"
                )
            key_result_id = data.key_result_id
    
    priority_value = data.priority.lower() if data.priority else PRIORITY_MEDIUM
    
    task = Task(
        tenant_id=current_user.tenant_id,
        title=data.title,
        description=data.description,
        assigned_to_id=data.assigned_to_id,
        created_by_id=creator.id,
        due_date=data.due_date,
        priority=priority_value,
        status=STATUS_PENDING,
        source="manual",
        objective_id=objective_id,
        key_result_id=key_result_id,
        is_administrative=is_administrative
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)

    # Sync vers Asana si intégration active
    try:
        from app.services.sync_hooks import sync_task_created
        sync_task_created(db, current_user.tenant_id, task)
    except Exception:
        pass

    # Email à l'employé assigné (seulement si différent du créateur)
    if data.assigned_to_id != creator.id:
        try:
            from app.services.email_service import send_task_assigned_email
            if assignee.email:
                due_str = str(data.due_date) if data.due_date else None
                send_task_assigned_email(
                    to_email=assignee.email,
                    first_name=assignee.first_name,
                    task_title=data.title,
                    due_date=due_str,
                    priority=data.priority,
                    assigned_by=f"{creator.first_name} {creator.last_name}",
                )
        except Exception as e:
            print(f"⚠️ Email tâche non envoyé: {e}")

    return task_to_response(task, db)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Modifier une tâche"""
    employee = get_employee_from_user(current_user, db)
    
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.tenant_id == current_user.tenant_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tâche non trouvée")
    
    assignee = db.query(Employee).filter(Employee.id == task.assigned_to_id).first()
    is_manager_of_assignee = assignee and assignee.manager_id == employee.id
    
    if task.created_by_id != employee.id and task.assigned_to_id != employee.id and not is_manager_of_assignee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas la permission de modifier cette tâche"
        )
    
    update_data = data.model_dump(exclude_unset=True)
    
    if 'status' in update_data and update_data['status']:
        update_data['status'] = update_data['status'].lower()
    if 'priority' in update_data and update_data['priority']:
        update_data['priority'] = update_data['priority'].lower()
    
    # Déterminer is_administrative après mise à jour
    new_is_administrative = update_data.get('is_administrative', getattr(task, 'is_administrative', False))
    new_objective_id = update_data.get('objective_id', task.objective_id)
    
    # Si on passe de administrative à non-administrative, vérifier qu'un objectif est fourni
    if not new_is_administrative and not new_objective_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une tâche non-administrative doit être liée à un objectif."
        )
    
    # Si tâche administrative, forcer objective_id et key_result_id à None
    if new_is_administrative:
        update_data['objective_id'] = None
        update_data['key_result_id'] = None
    
    # Vérifier l'objectif si modifié
    if 'objective_id' in update_data and update_data['objective_id']:
        objective = db.query(Objective).filter(
            Objective.id == update_data['objective_id'],
            Objective.tenant_id == current_user.tenant_id
        ).first()
        if not objective:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objectif non trouvé")
    
    # Vérifier le key result si modifié
    if 'key_result_id' in update_data and update_data['key_result_id']:
        key_result = db.query(KeyResult).filter(
            KeyResult.id == update_data['key_result_id']
        ).first()
        if not key_result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key Result non trouvé")
    
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    # Sync vers Asana si tâche liée
    try:
        from app.services.sync_hooks import sync_task_updated
        sync_task_updated(db, current_user.tenant_id, task)
    except Exception:
        pass

    return task_to_response(task, db)


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: int,
    data: TaskComplete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marquer une tâche comme terminée"""
    employee = get_employee_from_user(current_user, db)
    
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.tenant_id == current_user.tenant_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tâche non trouvée")
    
    if task.assigned_to_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'assigné peut marquer cette tâche comme terminée"
        )
    
    task.status = STATUS_COMPLETED
    task.completed_at = datetime.now(timezone.utc)
    task.completion_note = data.completion_note

    # Mise à jour automatique du KR si tâche issue de la daily checklist
    if task.source == "daily_checklist" and task.checklist_item_id and task.key_result_id:
        from app.models.daily_checklist import DailyChecklistItem
        checklist_item = db.query(DailyChecklistItem).filter(
            DailyChecklistItem.id == task.checklist_item_id
        ).first()
        if checklist_item and checklist_item.kr_contribution:
            kr = db.query(KeyResult).filter(KeyResult.id == task.key_result_id).first()
            if kr:
                kr.current = min(kr.current + checklist_item.kr_contribution, kr.target)
                # Recalculer la progression de l'objectif parent
                objective = db.query(Objective).filter(Objective.id == kr.objective_id).first()
                if objective and objective.key_results:
                    total_weight = sum(k.weight for k in objective.key_results)
                    if total_weight > 0:
                        weighted_progress = sum(
                            (min(k.current / k.target, 1.0) * 100 * k.weight)
                            for k in objective.key_results
                            if k.target > 0
                        )
                        objective.progress = round(weighted_progress / total_weight, 1)

    db.commit()
    db.refresh(task)

    return task_to_response(task, db)


@router.post("/{task_id}/start", response_model=TaskResponse)
async def start_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Démarrer une tâche"""
    employee = get_employee_from_user(current_user, db)
    
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.tenant_id == current_user.tenant_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tâche non trouvée")
    
    if task.assigned_to_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'assigné peut démarrer cette tâche"
        )
    
    task.status = STATUS_IN_PROGRESS
    db.commit()
    db.refresh(task)
    
    return task_to_response(task, db)


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Annuler une tâche"""
    employee = get_employee_from_user(current_user, db)
    
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.tenant_id == current_user.tenant_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tâche non trouvée")
    
    if task.created_by_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le créateur peut supprimer cette tâche"
        )
    
    task.status = STATUS_CANCELLED
    db.commit()
    
    return {"message": "Tâche annulée"}


# ============================================
# DAILY VALIDATION ENDPOINTS
# ============================================

@router.post("/daily-validation/submit", response_model=DailyValidationResponse)
async def submit_daily_validation(
    data: DailyValidationSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soumettre sa journée pour validation"""
    employee = get_employee_from_user(current_user, db)
    today = date.today()
    now = datetime.now(timezone.utc)
    
    # Vérifier l'heure - pas avant 16h30 (UTC+1 pour Afrique de l'Ouest)
    # 16h30 WAT = 15h30 UTC
    current_hour = now.hour
    current_minute = now.minute
    min_hour = 15  # 15h30 UTC = 16h30 WAT
    min_minute = 30
    
    if current_hour < min_hour or (current_hour == min_hour and current_minute < min_minute):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez soumettre votre journée qu'à partir de 16h30"
        )
    
    existing = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == current_user.tenant_id,
        DailyValidation.employee_id == employee.id,
        DailyValidation.validation_date == today
    ).first()
    
    if existing and existing.status != VALIDATION_REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous avez déjà soumis votre journée"
        )
    
    # Récupérer les tâches du jour (uniquement celles non encore soumises)
    last_validation = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == current_user.tenant_id,
        DailyValidation.employee_id == employee.id,
        DailyValidation.status.in_([VALIDATION_PENDING, VALIDATION_APPROVED]),
        DailyValidation.validation_date < today
    ).order_by(DailyValidation.validation_date.desc()).first()
    
    tasks_query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.assigned_to_id == employee.id,
        Task.due_date <= today,
        Task.status != STATUS_CANCELLED
    )
    
    if last_validation:
        tasks_query = tasks_query.filter(
            or_(
                Task.created_at > last_validation.submitted_at,
                Task.due_date > last_validation.validation_date
            )
        )
    
    tasks_today = tasks_query.all()
    total_tasks = len(tasks_today)
    completed_tasks = len([t for t in tasks_today if t.status == STATUS_COMPLETED])
    
    if data.incomplete_tasks:
        for item in data.incomplete_tasks:
            task = db.query(Task).filter(
                Task.id == item.get('task_id'),
                Task.assigned_to_id == employee.id
            ).first()
            if task:
                task.incomplete_reason = item.get('reason', '')
    
    if existing:
        existing.status = VALIDATION_PENDING
        existing.submitted_at = datetime.now(timezone.utc)
        existing.submission_note = data.submission_note
        existing.total_tasks = total_tasks
        existing.completed_tasks = completed_tasks
        existing.validated_by_id = None
        existing.validated_at = None
        existing.validation_comment = None
        db.commit()
        db.refresh(existing)
        return validation_to_response(existing, db)
    
    validation = DailyValidation(
        tenant_id=current_user.tenant_id,
        employee_id=employee.id,
        validation_date=today,
        status=VALIDATION_PENDING,
        submitted_at=datetime.now(timezone.utc),
        submission_note=data.submission_note,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks
    )
    
    db.add(validation)
    db.commit()
    db.refresh(validation)
    
    return validation_to_response(validation, db)


@router.get("/daily-validation/my-status")
async def get_my_daily_validation_status(
    validation_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Statut de ma validation journalière"""
    employee = get_employee_from_user(current_user, db)
    check_date = validation_date or date.today()
    now = datetime.now(timezone.utc)
    
    # Vérifier l'heure - pas avant 16h30 (UTC+1 pour Afrique de l'Ouest)
    # 16h30 WAT = 15h30 UTC
    current_hour = now.hour
    current_minute = now.minute
    min_hour = 15  # 15h30 UTC = 16h30 WAT
    min_minute = 30
    can_submit_time = current_hour > min_hour or (current_hour == min_hour and current_minute >= min_minute)
    
    validation = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == current_user.tenant_id,
        DailyValidation.employee_id == employee.id,
        DailyValidation.validation_date == check_date
    ).first()
    
    # Stats des tâches (uniquement non soumises)
    last_validation = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == current_user.tenant_id,
        DailyValidation.employee_id == employee.id,
        DailyValidation.status.in_([VALIDATION_PENDING, VALIDATION_APPROVED])
    ).order_by(DailyValidation.validation_date.desc()).first()
    
    tasks_query = db.query(Task).filter(
        Task.tenant_id == current_user.tenant_id,
        Task.assigned_to_id == employee.id,
        Task.due_date <= check_date,
        Task.status != STATUS_CANCELLED
    )
    
    if last_validation:
        tasks_query = tasks_query.filter(
            or_(
                Task.created_at > last_validation.submitted_at,
                Task.due_date > last_validation.validation_date
            )
        )
    
    tasks_today = tasks_query.all()
    total = len(tasks_today)
    completed = len([t for t in tasks_today if t.status == STATUS_COMPLETED])
    
    can_submit_status = validation is None or validation.status == VALIDATION_REJECTED
    
    return {
        "validation": validation_to_response(validation, db) if validation else None,
        "can_submit": can_submit_status and can_submit_time and total > 0,
        "can_submit_time": can_submit_time,
        "min_submit_time": "16:30",
        "tasks_total": total,
        "tasks_completed": completed,
        "all_completed": total > 0 and total == completed
    }


@router.get("/daily-validation/pending", response_model=List[PendingValidationResponse])
async def get_pending_validations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validations en attente de mon équipe"""
    if not is_manager_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux managers"
        )
    
    manager = get_employee_from_user(current_user, db)
    team_ids = get_team_member_ids(manager.id, current_user.tenant_id, db)
    
    if not team_ids:
        return []
    
    validations = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == current_user.tenant_id,
        DailyValidation.employee_id.in_(team_ids),
        DailyValidation.status == VALIDATION_PENDING
    ).order_by(DailyValidation.validation_date.desc()).all()
    
    result = []
    for v in validations:
        # Trouver la validation précédente pour cet employé
        prev_validation = db.query(DailyValidation).filter(
            DailyValidation.tenant_id == current_user.tenant_id,
            DailyValidation.employee_id == v.employee_id,
            DailyValidation.status.in_([VALIDATION_PENDING, VALIDATION_APPROVED]),
            DailyValidation.validation_date < v.validation_date
        ).order_by(DailyValidation.validation_date.desc()).first()
        
        tasks_query = db.query(Task).filter(
            Task.tenant_id == current_user.tenant_id,
            Task.assigned_to_id == v.employee_id,
            Task.due_date <= v.validation_date,
            Task.status != STATUS_CANCELLED
        )
        
        if prev_validation:
            tasks_query = tasks_query.filter(
                or_(
                    Task.created_at > prev_validation.submitted_at,
                    Task.due_date > prev_validation.validation_date
                )
            )
        
        tasks = tasks_query.all()
        
        result.append({
            "validation": validation_to_response(v, db),
            "tasks": [task_to_response(t, db) for t in tasks]
        })
    
    return result


@router.post("/daily-validation/{validation_id}/validate", response_model=DailyValidationResponse)
async def validate_daily(
    validation_id: int,
    data: DailyValidationAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Valider ou rejeter la journée d'un collaborateur"""
    if not is_manager_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux managers"
        )
    
    manager = get_employee_from_user(current_user, db)
    
    validation = db.query(DailyValidation).filter(
        DailyValidation.id == validation_id,
        DailyValidation.tenant_id == current_user.tenant_id
    ).first()
    
    if not validation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Validation non trouvée")
    
    employee = db.query(Employee).filter(Employee.id == validation.employee_id).first()
    if not employee or employee.manager_id != manager.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez valider que les journées de vos collaborateurs directs"
        )
    
    validation.status = VALIDATION_APPROVED if data.approved else VALIDATION_REJECTED
    validation.validated_by_id = manager.id
    validation.validated_at = datetime.now(timezone.utc)
    validation.validation_comment = data.comment
    
    if not data.approved:
        # Trouver la validation précédente
        prev_validation = db.query(DailyValidation).filter(
            DailyValidation.tenant_id == current_user.tenant_id,
            DailyValidation.employee_id == validation.employee_id,
            DailyValidation.status.in_([VALIDATION_PENDING, VALIDATION_APPROVED]),
            DailyValidation.validation_date < validation.validation_date
        ).order_by(DailyValidation.validation_date.desc()).first()
        
        incomplete_query = db.query(Task).filter(
            Task.tenant_id == current_user.tenant_id,
            Task.assigned_to_id == validation.employee_id,
            Task.due_date <= validation.validation_date,
            Task.status.in_([STATUS_PENDING, STATUS_IN_PROGRESS])
        )
        
        if prev_validation:
            incomplete_query = incomplete_query.filter(
                or_(
                    Task.created_at > prev_validation.submitted_at,
                    Task.due_date > prev_validation.validation_date
                )
            )
        
        incomplete_tasks = incomplete_query.all()
        
        tomorrow = validation.validation_date + timedelta(days=1)
        for task in incomplete_tasks:
            task.due_date = tomorrow
    
    db.commit()
    db.refresh(validation)
    
    return validation_to_response(validation, db)


@router.get("/daily-validation/history", response_model=DailyValidationsPageResponse)
async def get_validation_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    employee_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Historique des validations"""
    employee = get_employee_from_user(current_user, db)
    
    query = db.query(DailyValidation).filter(
        DailyValidation.tenant_id == current_user.tenant_id
    )
    
    if not is_manager_role(current_user.role):
        query = query.filter(DailyValidation.employee_id == employee.id)
    elif employee_id:
        query = query.filter(DailyValidation.employee_id == employee_id)
    
    if status_filter:
        query = query.filter(DailyValidation.status == status_filter)
    
    total = query.count()
    query = query.order_by(DailyValidation.validation_date.desc())
    offset = (page - 1) * page_size
    validations = query.offset(offset).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": [validation_to_response(v, db) for v in validations],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }