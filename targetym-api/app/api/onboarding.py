# ============================================
# API: Onboarding + Documents + Notifications
# Fichier: app/api/onboarding.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import date, time, datetime, timedelta
from pydantic import BaseModel
from enum import Enum
import logging

from app.api.deps import get_db, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Onboarding"])


# ============================================
# HELPERS
# ============================================

def get_user_role(current_user) -> str:
    role = getattr(current_user, 'role', None)
    if role:
        return role.lower() if isinstance(role, str) else role
    return "employee"

def is_hr_or_admin(role: str) -> bool:
    return role in ["rh", "admin", "dg", "superadmin"]

def create_notification(db: Session, tenant_id: int, user_id: int, employee_id: int,
                       title: str, message: str, notif_type: str,
                       reference_type: str = None, reference_id: int = None,
                       action_url: str = None, priority: str = 'normal'):
    try:
        db.execute(text("""
            INSERT INTO notifications (tenant_id, user_id, employee_id, title, message, 
                type, priority, reference_type, reference_id, action_url)
            VALUES (:tenant_id, :user_id, :employee_id, :title, :message, 
                :type, :priority, :reference_type, :reference_id, :action_url)
        """), {
            "tenant_id": tenant_id, "user_id": user_id, "employee_id": employee_id,
            "title": title, "message": message, "type": notif_type,
            "priority": priority, "reference_type": reference_type,
            "reference_id": reference_id, "action_url": action_url
        })
        db.commit()
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        db.rollback()


# ============================================
# SCHEMAS Pydantic
# ============================================

class DocumentCreate(BaseModel):
    employee_id: int
    document_type: str
    title: str
    description: Optional[str] = None
    file_name: str
    file_url: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    document_date: Optional[date] = None
    expiry_date: Optional[date] = None
    visible_to_employee: bool = True
    is_confidential: bool = False

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    document_date: Optional[date] = None
    expiry_date: Optional[date] = None
    visible_to_employee: Optional[bool] = None
    is_confidential: Optional[bool] = None

class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None
    department_id: Optional[int] = None
    job_title: Optional[str] = None
    duration_days: int = 90
    is_default: bool = False

class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[int] = None
    job_title: Optional[str] = None
    duration_days: Optional[int] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None

class TaskCreate(BaseModel):
    program_id: int
    title: str
    description: Optional[str] = None
    category: str = 'general'
    assigned_role: str = 'hr'
    due_day: int = 1
    sort_order: int = 0
    is_required: bool = True
    requires_document: bool = False
    document_type: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    assigned_role: Optional[str] = None
    due_day: Optional[int] = None
    sort_order: Optional[int] = None
    is_required: Optional[bool] = None
    requires_document: Optional[bool] = None
    document_type: Optional[str] = None

class AssignmentCreate(BaseModel):
    employee_id: int
    program_id: int
    manager_id: Optional[int] = None
    buddy_id: Optional[int] = None
    start_date: Optional[date] = None
    notes: Optional[str] = None

class AssignmentUpdate(BaseModel):
    manager_id: Optional[int] = None
    buddy_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class TaskProgressUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class GetToKnowCreate(BaseModel):
    assignment_id: Optional[int] = None
    new_employee_id: int
    meet_employee_id: int
    scheduled_date: date
    scheduled_time: str
    duration_minutes: int = 30
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    topic: Optional[str] = None
    notes: Optional[str] = None

class GetToKnowUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    status: Optional[str] = None
    topic: Optional[str] = None
    notes: Optional[str] = None

class GetToKnowFeedback(BaseModel):
    feedback: str
    rating: Optional[int] = None


# ============================================
# DOCUMENTS EMPLOYÉ
# ============================================

@router.get("/api/documents/employee/{employee_id}")
def get_employee_documents(
    employee_id: int,
    document_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = """
        SELECT d.*, u.first_name || ' ' || u.last_name AS uploaded_by_name
        FROM employee_documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.employee_id = :employee_id AND d.tenant_id = :tenant_id
    """
    params = {"employee_id": employee_id, "tenant_id": current_user.tenant_id}
    
    if document_type:
        query += " AND d.document_type = :document_type"
        params["document_type"] = document_type
    
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        query += " AND d.visible_to_employee = true AND d.is_confidential = false"
    
    query += " ORDER BY d.created_at DESC"
    
    rows = db.execute(text(query), params).fetchall()
    documents = []
    for row in rows:
        doc = dict(row._mapping)
        for k, v in doc.items():
            if isinstance(v, (datetime, date)):
                doc[k] = v.isoformat()
        documents.append(doc)
    return {"items": documents, "total": len(documents)}


@router.post("/api/documents/")
def create_document(
    data: DocumentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = db.execute(text("""
        INSERT INTO employee_documents 
            (tenant_id, employee_id, document_type, title, description,
             file_name, file_url, file_size, mime_type, 
             document_date, expiry_date, visible_to_employee, is_confidential, uploaded_by)
        VALUES (:tenant_id, :employee_id, :document_type, :title, :description,
             :file_name, :file_url, :file_size, :mime_type,
             :document_date, :expiry_date, :visible_to_employee, :is_confidential, :uploaded_by)
        RETURNING id
    """), {
        "tenant_id": current_user.tenant_id, "employee_id": data.employee_id,
        "document_type": data.document_type, "title": data.title, "description": data.description,
        "file_name": data.file_name, "file_url": data.file_url, "file_size": data.file_size,
        "mime_type": data.mime_type, "document_date": data.document_date,
        "expiry_date": data.expiry_date, "visible_to_employee": data.visible_to_employee,
        "is_confidential": data.is_confidential, "uploaded_by": current_user.id
    })
    doc_id = result.fetchone()[0]
    db.commit()
    
    if data.visible_to_employee:
        try:
            emp_user = db.execute(text(
                "SELECT u.id FROM users u JOIN employees e ON u.employee_id = e.id WHERE e.id = :eid LIMIT 1"
            ), {"eid": data.employee_id}).fetchone()
            if emp_user:
                create_notification(db, current_user.tenant_id, emp_user[0], data.employee_id,
                    "Nouveau document disponible",
                    f"Le document '{data.title}' a été ajouté à votre dossier.",
                    "document_uploaded", "document", doc_id, "/dashboard/myspace/documents")
        except Exception as e:
            logger.error(f"Notification error: {e}")
    
    return {"id": doc_id, "message": "Document ajouté avec succès"}


@router.put("/api/documents/{document_id}")
def update_document(document_id: int, data: DocumentUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    updates = []
    params = {"document_id": document_id}
    for field, value in data.dict(exclude_none=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = value
    if not updates:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    updates.append("updated_at = CURRENT_TIMESTAMP")
    db.execute(text(f"UPDATE employee_documents SET {', '.join(updates)} WHERE id = :document_id"), params)
    if db.execute(text("SELECT id FROM employee_documents WHERE id = :document_id"), {"document_id": document_id}).fetchone() is None:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    db.commit()
    return {"message": "Document mis à jour"}


@router.delete("/api/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(status_code=403, detail="Seul le RH peut supprimer des documents")
    result = db.execute(text("DELETE FROM employee_documents WHERE id = :id"), {"id": document_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    db.commit()
    return {"message": "Document supprimé"}


@router.get("/api/documents/me")
def get_my_documents(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    employee_id = getattr(current_user, 'employee_id', None) or getattr(current_user, 'id', None)
    rows = db.execute(text("""
        SELECT id, document_type, title, description, file_name, file_url,
               file_size, mime_type, document_date, expiry_date, created_at
        FROM employee_documents
        WHERE employee_id = :eid AND tenant_id = :tid AND visible_to_employee = true AND is_confidential = false
        ORDER BY created_at DESC
    """), {"eid": employee_id, "tid": current_user.tenant_id}).fetchall()
    documents = []
    for row in rows:
        doc = dict(row._mapping)
        for k, v in doc.items():
            if isinstance(v, (datetime, date)):
                doc[k] = v.isoformat()
        documents.append(doc)
    return {"items": documents, "total": len(documents)}


# ============================================
# HISTORIQUE TÉLÉCHARGEMENTS
# ============================================

@router.post("/api/downloads/track")
def track_download(
    document_type: str = Form(...),
    document_title: str = Form(...),
    document_id: Optional[int] = Form(None),
    employee_id: Optional[int] = Form(None),
    file_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    emp_id = employee_id or getattr(current_user, 'employee_id', None) or getattr(current_user, 'id', None)
    db.execute(text("""
        INSERT INTO download_history (tenant_id, user_id, employee_id, document_type, document_id, document_title, file_name)
        VALUES (:tid, :uid, :eid, :dtype, :did, :dtitle, :fname)
    """), {"tid": current_user.tenant_id, "uid": current_user.id, "eid": emp_id,
           "dtype": document_type, "did": document_id, "dtitle": document_title, "fname": file_name})
    db.commit()
    return {"success": True}


@router.get("/api/downloads/me")
def get_my_downloads(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = db.execute(text("""
        SELECT id, document_type, document_title, file_name, downloaded_at
        FROM download_history WHERE user_id = :uid ORDER BY downloaded_at DESC LIMIT :limit
    """), {"uid": current_user.id, "limit": limit}).fetchall()
    items = []
    for row in rows:
        item = dict(row._mapping)
        for k, v in item.items():
            if isinstance(v, (datetime, date)):
                item[k] = v.isoformat()
        items.append(item)
    return {"items": items, "total": len(items)}


# ============================================
# PROGRAMMES D'ONBOARDING
# ============================================

@router.get("/api/onboarding/programs")
def list_programs(is_active: Optional[bool] = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    query = """
        SELECT p.*, d.name AS department_name,
               (SELECT COUNT(*) FROM onboarding_tasks WHERE program_id = p.id) AS task_count,
               (SELECT COUNT(*) FROM onboarding_assignments WHERE program_id = p.id) AS usage_count
        FROM onboarding_programs p
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE p.tenant_id = :tid
    """
    params = {"tid": current_user.tenant_id}
    if is_active is not None:
        query += " AND p.is_active = :is_active"
        params["is_active"] = is_active
    query += " ORDER BY p.is_default DESC, p.name"
    rows = db.execute(text(query), params).fetchall()
    programs = []
    for row in rows:
        prog = dict(row._mapping)
        for k, v in prog.items():
            if isinstance(v, (datetime, date)):
                prog[k] = v.isoformat()
        programs.append(prog)
    return {"items": programs, "total": len(programs)}


@router.get("/api/onboarding/programs/{program_id}")
def get_program(program_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    row = db.execute(text("""
        SELECT p.*, d.name AS department_name FROM onboarding_programs p
        LEFT JOIN departments d ON p.department_id = d.id WHERE p.id = :pid
    """), {"pid": program_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Programme non trouvé")
    program = dict(row._mapping)
    for k, v in program.items():
        if isinstance(v, (datetime, date)):
            program[k] = v.isoformat()
    
    task_rows = db.execute(text("SELECT * FROM onboarding_tasks WHERE program_id = :pid ORDER BY due_day, sort_order"), {"pid": program_id}).fetchall()
    tasks = []
    for t in task_rows:
        task = dict(t._mapping)
        for k, v in task.items():
            if isinstance(v, (datetime, date)):
                task[k] = v.isoformat()
        tasks.append(task)
    program['tasks'] = tasks
    return program


@router.post("/api/onboarding/programs")
def create_program(data: ProgramCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if data.is_default:
        db.execute(text("UPDATE onboarding_programs SET is_default = false WHERE tenant_id = :tid"), {"tid": current_user.tenant_id})
    result = db.execute(text("""
        INSERT INTO onboarding_programs (tenant_id, name, description, department_id, job_title, duration_days, is_default, created_by)
        VALUES (:tid, :name, :desc, :did, :jt, :dd, :default, :cb) RETURNING id
    """), {"tid": current_user.tenant_id, "name": data.name, "desc": data.description,
           "did": data.department_id, "jt": data.job_title, "dd": data.duration_days,
           "default": data.is_default, "cb": current_user.id})
    prog_id = result.fetchone()[0]
    db.commit()
    return {"id": prog_id, "message": "Programme créé avec succès"}


@router.put("/api/onboarding/programs/{program_id}")
def update_program(program_id: int, data: ProgramUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    updates = []
    params = {"program_id": program_id}
    for field, value in data.dict(exclude_none=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = value
    if not updates:
        raise HTTPException(status_code=400, detail="Rien à mettre à jour")
    updates.append("updated_at = CURRENT_TIMESTAMP")
    db.execute(text(f"UPDATE onboarding_programs SET {', '.join(updates)} WHERE id = :program_id"), params)
    db.commit()
    return {"message": "Programme mis à jour"}


# ============================================
# TÂCHES D'ONBOARDING (template)
# ============================================

@router.post("/api/onboarding/tasks")
def create_task(data: TaskCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    result = db.execute(text("""
        INSERT INTO onboarding_tasks (program_id, title, description, category, assigned_role, due_day, sort_order, is_required, requires_document, document_type)
        VALUES (:pid, :title, :desc, :cat, :role, :day, :sort, :req, :rdoc, :dtype) RETURNING id
    """), {"pid": data.program_id, "title": data.title, "desc": data.description,
           "cat": data.category, "role": data.assigned_role, "day": data.due_day,
           "sort": data.sort_order, "req": data.is_required, "rdoc": data.requires_document, "dtype": data.document_type})
    task_id = result.fetchone()[0]
    db.commit()
    return {"id": task_id, "message": "Tâche ajoutée"}


@router.put("/api/onboarding/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    updates = []
    params = {"task_id": task_id}
    for field, value in data.dict(exclude_none=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = value
    if not updates:
        raise HTTPException(status_code=400, detail="Rien à mettre à jour")
    db.execute(text(f"UPDATE onboarding_tasks SET {', '.join(updates)} WHERE id = :task_id"), params)
    db.commit()
    return {"message": "Tâche mise à jour"}


@router.delete("/api/onboarding/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db.execute(text("DELETE FROM onboarding_tasks WHERE id = :id"), {"id": task_id})
    db.commit()
    return {"message": "Tâche supprimée"}


# ============================================
# ASSIGNATION D'ONBOARDING
# ============================================

@router.get("/api/onboarding/assignments")
def list_assignments(
    status: Optional[str] = None, employee_id: Optional[int] = None,
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    query = """
        SELECT a.*, e.first_name || ' ' || e.last_name AS employee_name,
               e.job_title AS employee_job_title, e.email AS employee_email,
               d.name AS department_name, p.name AS program_name,
               m.first_name || ' ' || m.last_name AS manager_name,
               b.first_name || ' ' || b.last_name AS buddy_name
        FROM onboarding_assignments a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        JOIN onboarding_programs p ON a.program_id = p.id
        LEFT JOIN employees m ON a.manager_id = m.id
        LEFT JOIN employees b ON a.buddy_id = b.id
        WHERE a.tenant_id = :tid
    """
    params = {"tid": current_user.tenant_id}
    if status:
        query += " AND a.status = :status"
        params["status"] = status
    if employee_id:
        query += " AND a.employee_id = :eid"
        params["eid"] = employee_id
    query += " ORDER BY a.created_at DESC"
    
    rows = db.execute(text(query), params).fetchall()
    items = []
    for row in rows:
        item = dict(row._mapping)
        for k, v in item.items():
            if isinstance(v, (datetime, date)):
                item[k] = v.isoformat()
            elif isinstance(v, timedelta):
                item[k] = str(v)
        items.append(item)
    return {"items": items, "total": len(items)}


@router.get("/api/onboarding/assignments/{assignment_id}")
def get_assignment_detail(assignment_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    row = db.execute(text("""
        SELECT a.*, e.first_name || ' ' || e.last_name AS employee_name,
               e.job_title AS employee_job_title, e.email AS employee_email,
               e.phone AS employee_phone, e.hire_date,
               d.name AS department_name, p.name AS program_name, p.description AS program_description,
               m.first_name || ' ' || m.last_name AS manager_name,
               b.first_name || ' ' || b.last_name AS buddy_name
        FROM onboarding_assignments a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        JOIN onboarding_programs p ON a.program_id = p.id
        LEFT JOIN employees m ON a.manager_id = m.id
        LEFT JOIN employees b ON a.buddy_id = b.id
        WHERE a.id = :aid
    """), {"aid": assignment_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Onboarding non trouvé")
    assignment = dict(row._mapping)
    for k, v in assignment.items():
        if isinstance(v, (datetime, date)):
            assignment[k] = v.isoformat()
        elif isinstance(v, timedelta):
            assignment[k] = str(v)
    
    task_rows = db.execute(text("""
        SELECT tp.*, t.title, t.description AS task_description, t.category, t.assigned_role,
               t.due_day, t.is_required, t.requires_document, t.document_type,
               u.first_name || ' ' || u.last_name AS completed_by_name
        FROM onboarding_task_progress tp
        JOIN onboarding_tasks t ON tp.task_id = t.id
        LEFT JOIN users u ON tp.completed_by = u.id
        WHERE tp.assignment_id = :aid ORDER BY t.due_day, t.sort_order
    """), {"aid": assignment_id}).fetchall()
    tasks = []
    for t in task_rows:
        task = dict(t._mapping)
        for k, v in task.items():
            if isinstance(v, (datetime, date)):
                task[k] = v.isoformat()
        tasks.append(task)
    assignment['tasks'] = tasks
    
    gtk_rows = db.execute(text("""
        SELECT g.*, me.first_name || ' ' || me.last_name AS meet_employee_name,
               me.job_title AS meet_job_title, md.name AS meet_department
        FROM get_to_know_meetings g
        JOIN employees me ON g.meet_employee_id = me.id
        LEFT JOIN departments md ON me.department_id = md.id
        WHERE g.assignment_id = :aid ORDER BY g.scheduled_date, g.scheduled_time
    """), {"aid": assignment_id}).fetchall()
    meetings = []
    for g in gtk_rows:
        m = dict(g._mapping)
        for k, v in m.items():
            if isinstance(v, (datetime, date, time)):
                m[k] = v.isoformat()
        meetings.append(m)
    assignment['get_to_know_meetings'] = meetings
    
    return assignment


@router.post("/api/onboarding/assignments")
def create_assignment(data: AssignmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    existing = db.execute(text("""
        SELECT id FROM onboarding_assignments WHERE employee_id = :eid AND status IN ('not_started', 'in_progress')
    """), {"eid": data.employee_id}).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Cet employé a déjà un onboarding en cours")
    
    manager_id = data.manager_id
    if not manager_id:
        mgr = db.execute(text("SELECT manager_id FROM employees WHERE id = :eid"), {"eid": data.employee_id}).fetchone()
        if mgr and mgr[0]:
            manager_id = mgr[0]
    
    start = data.start_date or date.today()
    result = db.execute(text("""
        INSERT INTO onboarding_assignments (tenant_id, employee_id, program_id, assigned_by, manager_id, buddy_id, start_date, notes, status)
        VALUES (:tid, :eid, :pid, :ab, :mid, :bid, :sd, :notes, 'not_started') RETURNING id
    """), {"tid": current_user.tenant_id, "eid": data.employee_id, "pid": data.program_id,
           "ab": current_user.id, "mid": manager_id, "bid": data.buddy_id, "sd": start, "notes": data.notes})
    assignment_id = result.fetchone()[0]
    db.commit()

    try:
        emp_user = db.execute(text("""
            SELECT u.id, e.first_name FROM users u JOIN employees e ON u.employee_id = e.id WHERE e.id = :eid LIMIT 1
        """), {"eid": data.employee_id}).fetchone()
        if emp_user:
            create_notification(db, current_user.tenant_id, emp_user[0], data.employee_id,
                "Bienvenue ! Votre programme d'intégration démarre",
                f"Bonjour {emp_user[1]}, votre programme d'onboarding a été activé.",
                "onboarding_task", "onboarding", assignment_id,
                f"/dashboard/onboarding/{assignment_id}")
    except Exception as e:
        logger.error(f"Notification error: {e}")

    # Email à l'employé
    try:
        from app.services.email_service import send_onboarding_email
        emp_row = db.execute(text("""
            SELECT e.email, e.first_name, t.name, p.name
            FROM employees e
            JOIN tenants t ON t.id = :tid
            LEFT JOIN onboarding_programs p ON p.id = :pid
            WHERE e.id = :eid
        """), {"tid": current_user.tenant_id, "pid": data.program_id, "eid": data.employee_id}).fetchone()
        if emp_row and emp_row[0]:
            send_onboarding_email(
                to_email=emp_row[0],
                first_name=emp_row[1],
                company_name=emp_row[2] or "votre entreprise",
                program_name=emp_row[3],
                start_date=str(start),
            )
    except Exception as e:
        logger.error(f"Email onboarding non envoyé: {e}")

    return {"id": assignment_id, "message": "Onboarding assigné avec succès"}


@router.put("/api/onboarding/assignments/{assignment_id}")
def update_assignment(assignment_id: int, data: AssignmentUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    updates = []
    params = {"assignment_id": assignment_id}
    for field, value in data.dict(exclude_none=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = value
    if not updates:
        raise HTTPException(status_code=400, detail="Rien à mettre à jour")
    updates.append("updated_at = CURRENT_TIMESTAMP")
    db.execute(text(f"UPDATE onboarding_assignments SET {', '.join(updates)} WHERE id = :assignment_id"), params)
    db.commit()
    return {"message": "Onboarding mis à jour"}


# ============================================
# PROGRESSION DES TÂCHES
# ============================================

@router.put("/api/onboarding/progress/{progress_id}")
def update_task_progress(progress_id: int, data: TaskProgressUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if data.status == 'completed':
        db.execute(text("""
            UPDATE onboarding_task_progress SET status = :status, notes = COALESCE(:notes, notes),
                completed_by = :uid, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = :pid
        """), {"status": data.status, "notes": data.notes, "uid": current_user.id, "pid": progress_id})
    else:
        db.execute(text("""
            UPDATE onboarding_task_progress SET status = :status, notes = COALESCE(:notes, notes),
                completed_by = NULL, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = :pid
        """), {"status": data.status, "notes": data.notes, "pid": progress_id})
    
    result = db.execute(text("SELECT assignment_id FROM onboarding_task_progress WHERE id = :pid"), {"pid": progress_id}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Tâche non trouvée")
    db.commit()
    return {"message": "Tâche mise à jour", "assignment_id": result[0]}


# ============================================
# DASHBOARD ONBOARDING
# ============================================

@router.get("/api/onboarding/dashboard")
def onboarding_dashboard(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tid = current_user.tenant_id
    
    row = db.execute(text("""
        SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'not_started') AS not_started,
            COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
            ROUND(AVG(progress_percentage)::numeric, 1) AS avg_progress,
            COUNT(*) FILTER (WHERE status IN ('not_started', 'in_progress') AND expected_end_date < CURRENT_DATE) AS overdue_count
        FROM onboarding_assignments WHERE tenant_id = :tid
    """), {"tid": tid}).fetchone()
    stats = {
        "total": row[0] or 0, "not_started": row[1] or 0, "in_progress": row[2] or 0,
        "completed": row[3] or 0, "cancelled": row[4] or 0,
        "avg_progress": float(row[5] or 0), "overdue_count": row[6] or 0
    }
    
    active_rows = db.execute(text("""
        SELECT a.id, a.employee_id, a.status, a.progress_percentage, a.start_date, a.expected_end_date,
               e.first_name || ' ' || e.last_name AS employee_name, e.job_title, d.name AS department_name, p.name AS program_name
        FROM onboarding_assignments a
        JOIN employees e ON a.employee_id = e.id LEFT JOIN departments d ON e.department_id = d.id
        JOIN onboarding_programs p ON a.program_id = p.id
        WHERE a.tenant_id = :tid AND a.status IN ('not_started', 'in_progress')
        ORDER BY a.start_date DESC LIMIT 10
    """), {"tid": tid}).fetchall()
    active = []
    for r in active_rows:
        item = dict(r._mapping)
        for k, v in item.items():
            if isinstance(v, (datetime, date)):
                item[k] = v.isoformat()
        active.append(item)
    
    overdue_rows = db.execute(text("""
        SELECT tp.id, tp.due_date, tp.status, t.title, t.category, t.assigned_role,
               e.first_name || ' ' || e.last_name AS employee_name, a.id AS assignment_id
        FROM onboarding_task_progress tp
        JOIN onboarding_tasks t ON tp.task_id = t.id
        JOIN onboarding_assignments a ON tp.assignment_id = a.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.tenant_id = :tid AND tp.status IN ('pending', 'in_progress')
          AND tp.due_date < CURRENT_DATE AND a.status IN ('not_started', 'in_progress')
        ORDER BY tp.due_date LIMIT 10
    """), {"tid": tid}).fetchall()
    overdue_tasks = []
    for r in overdue_rows:
        item = dict(r._mapping)
        for k, v in item.items():
            if isinstance(v, (datetime, date)):
                item[k] = v.isoformat()
        overdue_tasks.append(item)
    
    gtk_rows = db.execute(text("""
        SELECT g.id, g.scheduled_date, g.scheduled_time, g.duration_minutes, g.location, g.status, g.topic,
               ne.first_name || ' ' || ne.last_name AS new_employee_name,
               me.first_name || ' ' || me.last_name AS meet_employee_name
        FROM get_to_know_meetings g
        JOIN employees ne ON g.new_employee_id = ne.id JOIN employees me ON g.meet_employee_id = me.id
        WHERE g.tenant_id = :tid AND g.scheduled_date >= CURRENT_DATE AND g.status NOT IN ('cancelled')
        ORDER BY g.scheduled_date, g.scheduled_time LIMIT 10
    """), {"tid": tid}).fetchall()
    upcoming_gtk = []
    for r in gtk_rows:
        item = dict(r._mapping)
        for k, v in item.items():
            if isinstance(v, (datetime, date, time)):
                item[k] = v.isoformat()
        upcoming_gtk.append(item)
    
    return {"stats": stats, "active_onboardings": active, "overdue_tasks": overdue_tasks, "upcoming_get_to_know": upcoming_gtk}


# ============================================
# GET TO KNOW
# ============================================

@router.get("/api/onboarding/get-to-know")
def list_get_to_know(
    assignment_id: Optional[int] = None, employee_id: Optional[int] = None,
    status: Optional[str] = None, upcoming: Optional[bool] = None,
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    query = """
        SELECT g.*, ne.first_name || ' ' || ne.last_name AS new_employee_name, ne.job_title AS new_job_title, nd.name AS new_department,
               me.first_name || ' ' || me.last_name AS meet_employee_name, me.job_title AS meet_job_title, md.name AS meet_department
        FROM get_to_know_meetings g
        JOIN employees ne ON g.new_employee_id = ne.id JOIN employees me ON g.meet_employee_id = me.id
        LEFT JOIN departments nd ON ne.department_id = nd.id LEFT JOIN departments md ON me.department_id = md.id
        WHERE g.tenant_id = :tid
    """
    params = {"tid": current_user.tenant_id}
    if assignment_id:
        query += " AND g.assignment_id = :aid"; params["aid"] = assignment_id
    if employee_id:
        query += " AND (g.new_employee_id = :eid OR g.meet_employee_id = :eid)"; params["eid"] = employee_id
    if status:
        query += " AND g.status = :status"; params["status"] = status
    if upcoming:
        query += " AND g.scheduled_date >= CURRENT_DATE AND g.status NOT IN ('cancelled', 'completed')"
    query += " ORDER BY g.scheduled_date, g.scheduled_time"
    
    rows = db.execute(text(query), params).fetchall()
    items = []
    for row in rows:
        item = dict(row._mapping)
        for k, v in item.items():
            if isinstance(v, (datetime, date, time)):
                item[k] = v.isoformat()
        items.append(item)
    return {"items": items, "total": len(items)}


@router.post("/api/onboarding/get-to-know")
def create_get_to_know(data: GetToKnowCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    result = db.execute(text("""
        INSERT INTO get_to_know_meetings (tenant_id, assignment_id, new_employee_id, meet_employee_id,
            scheduled_date, scheduled_time, duration_minutes, location, meeting_link, topic, notes, organized_by)
        VALUES (:tid, :aid, :neid, :meid, :sd, :st, :dm, :loc, :ml, :topic, :notes, :ob) RETURNING id
    """), {"tid": current_user.tenant_id, "aid": data.assignment_id, "neid": data.new_employee_id,
           "meid": data.meet_employee_id, "sd": data.scheduled_date, "st": data.scheduled_time,
           "dm": data.duration_minutes, "loc": data.location, "ml": data.meeting_link,
           "topic": data.topic, "notes": data.notes, "ob": current_user.id})
    gtk_id = result.fetchone()[0]
    db.commit()
    
    for emp_id in [data.new_employee_id, data.meet_employee_id]:
        try:
            emp_user = db.execute(text("SELECT u.id, e.first_name FROM users u JOIN employees e ON u.employee_id = e.id WHERE e.id = :eid LIMIT 1"), {"eid": emp_id}).fetchone()
            other_id = data.meet_employee_id if emp_id == data.new_employee_id else data.new_employee_id
            other_name = db.execute(text("SELECT first_name || ' ' || last_name FROM employees WHERE id = :oid"), {"oid": other_id}).fetchone()
            if emp_user and other_name:
                date_str = data.scheduled_date.strftime('%d/%m/%Y')
                create_notification(db, current_user.tenant_id, emp_user[0], emp_id,
                    f"Get to Know avec {other_name[0]}",
                    f"Rencontre le {date_str} a {data.scheduled_time} ({data.duration_minutes} min). {data.topic or ''}",
                    "get_to_know_scheduled", "get_to_know", gtk_id, "/dashboard/myspace/calendar")
        except Exception as e:
            logger.error(f"GTK notification error: {e}")
    
    return {"id": gtk_id, "message": "Get to Know planifié"}


@router.put("/api/onboarding/get-to-know/{gtk_id}")
def update_get_to_know(gtk_id: int, data: GetToKnowUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    updates = []
    params = {"gtk_id": gtk_id}
    for field, value in data.dict(exclude_none=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = value
    if not updates:
        raise HTTPException(status_code=400, detail="Rien à mettre à jour")
    updates.append("updated_at = CURRENT_TIMESTAMP")
    db.execute(text(f"UPDATE get_to_know_meetings SET {', '.join(updates)} WHERE id = :gtk_id"), params)
    db.commit()
    return {"message": "Get to Know mis à jour"}


@router.post("/api/onboarding/get-to-know/{gtk_id}/confirm")
def confirm_get_to_know(gtk_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    employee_id = getattr(current_user, 'employee_id', None) or getattr(current_user, 'id', None)
    gtk = db.execute(text("SELECT new_employee_id, meet_employee_id FROM get_to_know_meetings WHERE id = :gid"), {"gid": gtk_id}).fetchone()
    if not gtk:
        raise HTTPException(status_code=404, detail="Get to Know non trouvé")
    if employee_id == gtk[0]:
        db.execute(text("UPDATE get_to_know_meetings SET new_employee_confirmed = true, updated_at = CURRENT_TIMESTAMP WHERE id = :gid"), {"gid": gtk_id})
    elif employee_id == gtk[1]:
        db.execute(text("UPDATE get_to_know_meetings SET meet_employee_confirmed = true, updated_at = CURRENT_TIMESTAMP WHERE id = :gid"), {"gid": gtk_id})
    else:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas participant")
    db.execute(text("""
        UPDATE get_to_know_meetings SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
        WHERE id = :gid AND new_employee_confirmed = true AND meet_employee_confirmed = true
    """), {"gid": gtk_id})
    db.commit()
    return {"message": "Participation confirmée"}


@router.post("/api/onboarding/get-to-know/{gtk_id}/feedback")
def submit_gtk_feedback(gtk_id: int, data: GetToKnowFeedback, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    employee_id = getattr(current_user, 'employee_id', None) or getattr(current_user, 'id', None)
    gtk = db.execute(text("SELECT new_employee_id, meet_employee_id FROM get_to_know_meetings WHERE id = :gid"), {"gid": gtk_id}).fetchone()
    if not gtk:
        raise HTTPException(status_code=404, detail="Get to Know non trouvé")
    if employee_id == gtk[0]:
        db.execute(text("UPDATE get_to_know_meetings SET feedback_new = :fb, rating = :r, status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = :gid"),
                   {"fb": data.feedback, "r": data.rating, "gid": gtk_id})
    elif employee_id == gtk[1]:
        db.execute(text("UPDATE get_to_know_meetings SET feedback_meet = :fb, updated_at = CURRENT_TIMESTAMP WHERE id = :gid"),
                   {"fb": data.feedback, "gid": gtk_id})
    else:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas participant")
    db.commit()
    return {"message": "Feedback enregistré"}


# ============================================
# CALENDRIER PERSONNEL
# ============================================

@router.get("/api/calendar/me")
def get_my_calendar(
    start_date: Optional[date] = None, end_date: Optional[date] = None,
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    employee_id = getattr(current_user, 'employee_id', None) or getattr(current_user, 'id', None)
    if not employee_id:
        return {"events": []}
    
    if not start_date:
        start_date = date.today() - timedelta(days=7)
    if not end_date:
        end_date = date.today() + timedelta(days=60)
    
    events = []
    
    gtk_rows = db.execute(text("""
        SELECT g.id, g.scheduled_date, g.scheduled_time, g.duration_minutes, g.location, g.status, g.topic, g.meeting_link,
            CASE WHEN g.new_employee_id = :eid THEN me.first_name || ' ' || me.last_name ELSE ne.first_name || ' ' || ne.last_name END AS with_name,
            CASE WHEN g.new_employee_id = :eid THEN me.job_title ELSE ne.job_title END AS with_job_title,
            CASE WHEN g.new_employee_id = :eid THEN md.name ELSE nd.name END AS with_department
        FROM get_to_know_meetings g
        JOIN employees ne ON g.new_employee_id = ne.id JOIN employees me ON g.meet_employee_id = me.id
        LEFT JOIN departments nd ON ne.department_id = nd.id LEFT JOIN departments md ON me.department_id = md.id
        WHERE (g.new_employee_id = :eid OR g.meet_employee_id = :eid)
          AND g.scheduled_date BETWEEN :sd AND :ed AND g.status NOT IN ('cancelled')
    """), {"eid": employee_id, "sd": start_date, "ed": end_date}).fetchall()
    
    for r in gtk_rows:
        events.append({
            "id": f"gtk-{r[0]}", "type": "get_to_know", "date": r[1].isoformat(),
            "time": r[2].isoformat() if r[2] else None, "duration_minutes": r[3],
            "title": f"Get to Know avec {r[8]}", "subtitle": f"{r[9] or ''} - {r[10] or ''}",
            "location": r[4], "status": r[5], "meeting_link": r[7], "color": "#f59e0b", "reference_id": r[0]
        })
    
    task_rows = db.execute(text("""
        SELECT tp.id, tp.due_date, tp.status, t.title, t.category, a.id AS assignment_id
        FROM onboarding_task_progress tp
        JOIN onboarding_tasks t ON tp.task_id = t.id
        JOIN onboarding_assignments a ON tp.assignment_id = a.id
        WHERE a.employee_id = :eid AND tp.due_date BETWEEN :sd AND :ed
          AND tp.status IN ('pending', 'in_progress') AND a.status IN ('not_started', 'in_progress')
    """), {"eid": employee_id, "sd": start_date, "ed": end_date}).fetchall()
    
    for r in task_rows:
        events.append({
            "id": f"task-{r[0]}", "type": "onboarding_task", "date": r[1].isoformat() if r[1] else None,
            "title": f"{r[3]}", "subtitle": f"Catégorie: {r[4]}", "status": r[2],
            "color": "#3b82f6", "reference_id": r[5]
        })
    
    try:
        leave_rows = db.execute(text("""
            SELECT lr.id, lr.start_date, lr.end_date, lr.status, lt.name AS leave_type
            FROM leave_requests lr LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.employee_id = :eid AND lr.status = 'approved' AND lr.start_date <= :ed AND lr.end_date >= :sd
        """), {"eid": employee_id, "sd": start_date, "ed": end_date}).fetchall()
        for r in leave_rows:
            events.append({
                "id": f"leave-{r[0]}", "type": "leave", "date": r[1].isoformat(),
                "end_date": r[2].isoformat(), "title": f"{r[4] or 'Congé'}", "status": r[3], "color": "#10b981"
            })
    except Exception:
        pass
    
    events.sort(key=lambda e: e.get('date', ''))
    return {"events": events, "total": len(events)}


# ============================================
# NOTIFICATIONS
# ============================================

@router.get("/api/notifications/me")
def get_my_notifications(unread_only: bool = False, limit: int = Query(20, ge=1, le=100),
                         db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    query = "SELECT id, title, message, type, priority, reference_type, reference_id, action_url, is_read, read_at, created_at FROM notifications WHERE user_id = :uid"
    params = {"uid": current_user.id, "limit": limit}
    if unread_only:
        query += " AND is_read = false"
    query += " ORDER BY created_at DESC LIMIT :limit"
    
    rows = db.execute(text(query), params).fetchall()
    items = []
    for row in rows:
        item = dict(row._mapping)
        for k, v in item.items():
            if isinstance(v, (datetime, date)):
                item[k] = v.isoformat()
        items.append(item)
    
    unread_count = db.execute(text("SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = false"), {"uid": current_user.id}).scalar()
    return {"items": items, "total": len(items), "unread_count": unread_count}


@router.get("/api/notifications/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    count = db.execute(text("SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = false"), {"uid": current_user.id}).scalar()
    return {"unread_count": count}


@router.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db.execute(text("UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = :nid"), {"nid": notification_id})
    db.commit()
    return {"message": "Notification lue"}


@router.put("/api/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    result = db.execute(text("UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = :uid AND is_read = false"), {"uid": current_user.id})
    db.commit()
    return {"message": f"{result.rowcount} notifications marquées comme lues"}


@router.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db.execute(text("DELETE FROM notifications WHERE id = :nid"), {"nid": notification_id})
    db.commit()
    return {"message": "Notification supprimée"}


# ============================================
# ONBOARDING QUEUE
# ============================================

@router.get("/api/onboarding/queue")
def get_onboarding_queue(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/Admin")

    rows = db.execute(text("""
        SELECT
            oq.id,
            oq.application_id,
            oq.hired_at,
            oq.status,
            c.first_name || ' ' || c.last_name AS candidate_name,
            c.email AS candidate_email,
            jp.title AS job_title,
            d.name AS department_name,
            emp.id AS employee_id,
            emp.first_name || ' ' || emp.last_name AS employee_name
        FROM onboarding_queue oq
        JOIN candidate_applications ca ON ca.id = oq.application_id
        JOIN candidates c ON c.id = oq.candidate_id
        JOIN job_postings jp ON jp.id = oq.job_posting_id
        LEFT JOIN departments d ON d.id = jp.department_id
        LEFT JOIN employees emp ON LOWER(emp.email) = LOWER(c.email) AND emp.tenant_id = oq.tenant_id
        WHERE oq.tenant_id = :tid AND oq.status = 'pending'
        ORDER BY oq.hired_at DESC
    """), {"tid": current_user.tenant_id}).fetchall()

    return [dict(r._mapping) for r in rows]


@router.post("/api/onboarding/queue/{queue_id}/start")
def start_onboarding_from_queue(queue_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    role = get_user_role(current_user)
    if not is_hr_or_admin(role):
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/Admin")

    result = db.execute(text("""
        UPDATE onboarding_queue SET status = 'started'
        WHERE id = :id AND tenant_id = :tid AND status = 'pending'
    """), {"id": queue_id, "tid": current_user.tenant_id})
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Entrée non trouvée ou déjà traitée")
    return {"message": "Onboarding démarré"}