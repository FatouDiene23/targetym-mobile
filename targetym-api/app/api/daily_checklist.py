# app/api/daily_checklist.py

import os
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Employee
from app.models.daily_checklist import DailyChecklistItem
from app.models.task import Task
from app.models.okr import KeyResult, Objective
from app.schemas.daily_checklist import (
    ChecklistItemCreate,
    ChecklistItemUpdate,
    ChecklistItemResponse,
    DailyChecklistTodayResponse,
    ChecklistTodayItem,
    InjectResult,
)

router = APIRouter(prefix="/api/daily-checklist", tags=["Daily Checklist"])

MANAGER_ROLES = ['admin', 'rh', 'manager', 'dg', 'dga', 'drh']
ADMIN_ROLES = ['admin', 'rh', 'dg', 'dga', 'drh']
ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


# ============================================
# HELPERS
# ============================================

def get_day_name(d: date) -> str:
    return ALL_DAYS[d.weekday()]


def days_list_to_str(days: List[str]) -> str:
    return ",".join(d.lower() for d in days if d.lower() in set(ALL_DAYS))


def days_str_to_list(days_str: str) -> List[str]:
    if not days_str:
        return []
    return [d.strip() for d in days_str.split(",") if d.strip() in set(ALL_DAYS)]


def item_to_response(item: DailyChecklistItem, db: Session) -> dict:
    data = {
        "id": item.id,
        "tenant_id": item.tenant_id,
        "employee_id": item.employee_id,
        "employee_name": None,
        "created_by_id": item.created_by_id,
        "created_by_name": None,
        "title": item.title,
        "description": item.description,
        "priority": item.priority,
        "days_of_week": days_str_to_list(item.days_of_week),
        "objective_id": item.objective_id,
        "objective_title": None,
        "key_result_id": item.key_result_id,
        "key_result_title": None,
        "kr_contribution": item.kr_contribution,
        "order": item.order,
        "is_active": item.is_active,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }

    emp = db.query(Employee).filter(Employee.id == item.employee_id).first()
    if emp:
        data["employee_name"] = f"{emp.first_name} {emp.last_name}"

    creator = db.query(Employee).filter(Employee.id == item.created_by_id).first()
    if creator:
        data["created_by_name"] = f"{creator.first_name} {creator.last_name}"

    if item.objective_id:
        obj = db.query(Objective).filter(Objective.id == item.objective_id).first()
        if obj:
            data["objective_title"] = obj.title

    if item.key_result_id:
        kr = db.query(KeyResult).filter(KeyResult.id == item.key_result_id).first()
        if kr:
            data["key_result_title"] = kr.title

    return data


def get_manager_employee(current_user: User, db: Session) -> Employee:
    if not current_user.role or current_user.role.lower() not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux managers")
    emp = db.query(Employee).filter(Employee.id == current_user.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    return emp


def assert_team_member(employee_id: int, manager: Employee, current_user: User, db: Session):
    """Vérifier que employee_id est dans l'équipe du manager (sauf admin/rh/dg)."""
    if current_user.role.lower() in ADMIN_ROLES:
        return
    target = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.manager_id == manager.id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not target:
        raise HTTPException(status_code=403, detail="Cet employé n'est pas dans votre équipe")


# ============================================
# MANAGER — Gestion des templates
# ============================================

@router.get("/team/{employee_id}", response_model=List[ChecklistItemResponse])
def get_employee_template(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Récupérer tous les items du template d'un employé (manager)."""
    manager = get_manager_employee(current_user, db)
    assert_team_member(employee_id, manager, current_user, db)

    items = (
        db.query(DailyChecklistItem)
        .filter(
            DailyChecklistItem.employee_id == employee_id,
            DailyChecklistItem.tenant_id == current_user.tenant_id,
        )
        .order_by(DailyChecklistItem.order, DailyChecklistItem.id)
        .all()
    )
    return [item_to_response(i, db) for i in items]


@router.post("/team/{employee_id}/items", response_model=ChecklistItemResponse, status_code=201)
def create_checklist_item(
    employee_id: int,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ajouter un item au template d'un employé (manager)."""
    manager = get_manager_employee(current_user, db)
    assert_team_member(employee_id, manager, current_user, db)

    if payload.key_result_id and not payload.objective_id:
        raise HTTPException(
            status_code=400,
            detail="objective_id requis si key_result_id est fourni"
        )

    item = DailyChecklistItem(
        tenant_id=current_user.tenant_id,
        employee_id=employee_id,
        created_by_id=manager.id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        days_of_week=days_list_to_str(payload.days_of_week),
        objective_id=payload.objective_id,
        key_result_id=payload.key_result_id,
        kr_contribution=payload.kr_contribution,
        order=payload.order,
        is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item_to_response(item, db)


@router.put("/items/{item_id}", response_model=ChecklistItemResponse)
def update_checklist_item(
    item_id: int,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Modifier un item du template (manager)."""
    get_manager_employee(current_user, db)

    item = db.query(DailyChecklistItem).filter(
        DailyChecklistItem.id == item_id,
        DailyChecklistItem.tenant_id == current_user.tenant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item non trouvé")

    if payload.title is not None:
        item.title = payload.title
    if payload.description is not None:
        item.description = payload.description
    if payload.priority is not None:
        item.priority = payload.priority
    if payload.days_of_week is not None:
        item.days_of_week = days_list_to_str(payload.days_of_week)
    if payload.objective_id is not None:
        item.objective_id = payload.objective_id
    if payload.key_result_id is not None:
        item.key_result_id = payload.key_result_id
    if payload.kr_contribution is not None:
        item.kr_contribution = payload.kr_contribution
    if payload.order is not None:
        item.order = payload.order
    if payload.is_active is not None:
        item.is_active = payload.is_active

    db.commit()
    db.refresh(item)
    return item_to_response(item, db)


@router.delete("/items/{item_id}", status_code=204)
def delete_checklist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprimer un item du template (manager)."""
    get_manager_employee(current_user, db)

    item = db.query(DailyChecklistItem).filter(
        DailyChecklistItem.id == item_id,
        DailyChecklistItem.tenant_id == current_user.tenant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item non trouvé")

    db.delete(item)
    db.commit()


@router.get("/team", response_model=List[dict])
def get_team_members_with_checklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste des membres de l'équipe avec le nombre d'items de leur checklist (manager)."""
    manager = get_manager_employee(current_user, db)

    members = db.query(Employee).filter(
        Employee.manager_id == manager.id,
        Employee.tenant_id == current_user.tenant_id,
    ).all()

    result = []
    for m in members:
        if m.status and m.status.upper() in ['TERMINATED', 'SUSPENDED']:
            continue
        count = db.query(DailyChecklistItem).filter(
            DailyChecklistItem.employee_id == m.id,
            DailyChecklistItem.tenant_id == current_user.tenant_id,
            DailyChecklistItem.is_active == True,
        ).count()
        result.append({
            "id": m.id,
            "name": f"{m.first_name} {m.last_name}",
            "job_title": m.job_title,
            "checklist_items_count": count,
        })
    return result


# ============================================
# EMPLOYEE — Vue du jour
# ============================================

@router.get("/today", response_model=DailyChecklistTodayResponse)
def get_today_checklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Checklist du jour pour l'employé connecté."""
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="Non associé à un employé")

    today = date.today()
    day_name = get_day_name(today)

    # Items du template actifs pour aujourd'hui
    items = (
        db.query(DailyChecklistItem)
        .filter(
            DailyChecklistItem.employee_id == current_user.employee_id,
            DailyChecklistItem.tenant_id == current_user.tenant_id,
            DailyChecklistItem.is_active == True,
        )
        .order_by(DailyChecklistItem.order, DailyChecklistItem.id)
        .all()
    )
    today_items = [i for i in items if day_name in days_str_to_list(i.days_of_week)]

    # Tâches injectées aujourd'hui
    tasks = db.query(Task).filter(
        Task.assigned_to_id == current_user.employee_id,
        Task.tenant_id == current_user.tenant_id,
        Task.source == "daily_checklist",
        Task.due_date == today,
    ).all()
    task_by_item = {t.checklist_item_id: t for t in tasks if t.checklist_item_id}

    result_items = []
    for item in today_items:
        task = task_by_item.get(item.id)
        result_items.append(ChecklistTodayItem(
            item_id=item.id,
            task_id=task.id if task else None,
            title=item.title,
            description=item.description,
            priority=item.priority,
            objective_id=item.objective_id,
            key_result_id=item.key_result_id,
            kr_contribution=item.kr_contribution,
            status=task.status if task else "pending",
            completed_at=task.completed_at if task else None,
        ))

    completed = sum(1 for i in result_items if i.status == "completed")
    total = len(result_items)

    return DailyChecklistTodayResponse(
        date=today.isoformat(),
        day_name=day_name,
        items=result_items,
        total=total,
        completed=completed,
        completion_rate=round(completed / total * 100, 1) if total > 0 else 0.0,
    )


# ============================================
# CRON — Injection quotidienne
# ============================================

@router.post("/inject", response_model=InjectResult)
def inject_daily_tasks(
    db: Session = Depends(get_db),
    x_cron_secret: Optional[str] = Header(None),
):
    """
    Injecter les tâches daily checklist pour aujourd'hui.
    Appelé par un cron externe à 7h WAT (6h UTC).
    Protégé par le header X-Cron-Secret.
    Idempotent : appels multiples ne créent pas de doublons.
    """
    cron_secret = os.environ.get("CRON_SECRET", "")
    if cron_secret and x_cron_secret != cron_secret:
        raise HTTPException(status_code=401, detail="Non autorisé")

    today = date.today()
    day_name = get_day_name(today)

    all_items = db.query(DailyChecklistItem).filter(
        DailyChecklistItem.is_active == True
    ).all()
    today_items = [i for i in all_items if day_name in days_str_to_list(i.days_of_week)]

    injected = 0
    skipped = 0
    errors = 0

    for item in today_items:
        try:
            already_exists = db.query(Task).filter(
                Task.checklist_item_id == item.id,
                Task.due_date == today,
                Task.tenant_id == item.tenant_id,
            ).first()

            if already_exists:
                skipped += 1
                continue

            task = Task(
                tenant_id=item.tenant_id,
                title=item.title,
                description=item.description,
                assigned_to_id=item.employee_id,
                created_by_id=item.created_by_id,
                due_date=today,
                status="pending",
                priority=item.priority,
                source="daily_checklist",
                objective_id=item.objective_id,
                key_result_id=item.key_result_id,
                is_administrative=(item.objective_id is None),
                checklist_item_id=item.id,
            )
            db.add(task)
            injected += 1
        except Exception:
            errors += 1

    db.commit()
    return InjectResult(injected=injected, skipped=skipped, errors=errors)
