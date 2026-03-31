# app/api/learning.py
"""
API pour le module Formation & Développement
TARGETYM AI - SIRH
VERSION CORRIGÉE - Auto-assignation + requires_certificate + re-soumission
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
import os
import uuid

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.employee import Employee
from app.models.learning import (
    Course, LearningPath, LearningPathCourse, CourseAssignment,
    CertificationType, EmployeeCertification,
    Skill, EmployeeSkill, CourseSkill,
    DevelopmentPlan, DevelopmentPlanSkill, DevelopmentPlanCourse,
    CourseRequest
)
from app.models.training_provider import TrainingProvider
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_LEARNING

router = APIRouter(prefix="/api/learning", tags=["Formation & Développement"], dependencies=[Depends(require_feature(FEATURE_LEARNING))])


# ============================================
# HELPER: Filtrage par rôle
# ============================================

def get_accessible_employee_ids(current_user: User, db: Session) -> List[int]:
    """
    Retourne la liste des employee_ids accessibles selon le rôle:
    - Admin/RH/DG/DGA: tous les employés du tenant
    - Manager: lui-même + son équipe (ceux qui ont manager_id = son employee_id)
    - Employee: seulement lui-même
    """
    full_access_roles = ['admin', 'dg', 'dga', 'rh']
    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    
    if user_role in full_access_roles:
        employees = db.query(Employee.id).filter(
            Employee.tenant_id == current_user.tenant_id
        ).all()
        return [e.id for e in employees]
    elif user_role == 'manager':
        team = db.query(Employee.id).filter(
            Employee.tenant_id == current_user.tenant_id,
            Employee.manager_id == current_user.employee_id
        ).all()
        team_ids = [e.id for e in team]
        if current_user.employee_id:
            team_ids.append(current_user.employee_id)
        return team_ids
    else:
        return [current_user.employee_id] if current_user.employee_id else []


def get_team_employee_ids(current_user: User, db: Session) -> List[int]:
    """Retourne uniquement les IDs des membres de l'équipe (N-1) du manager"""
    if not current_user.employee_id:
        return []
    
    team = db.query(Employee.id).filter(
        Employee.tenant_id == current_user.tenant_id,
        Employee.manager_id == current_user.employee_id
    ).all()
    return [e.id for e in team]


def has_full_access(current_user: User) -> bool:
    """Vérifie si l'utilisateur a accès à toutes les données"""
    full_access_roles = ['admin', 'dg', 'dga', 'rh']
    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    return user_role in full_access_roles


def is_manager(current_user: User) -> bool:
    """Vérifie si l'utilisateur est manager"""
    user_role = current_user.role.value.lower() if current_user.role else 'employee'
    return user_role == 'manager'


# ============================================
# SCHEMAS PYDANTIC
# ============================================

class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    provider: Optional[str] = None
    provider_id: Optional[int] = None
    external_url: Optional[str] = None
    duration_hours: Optional[float] = None
    level: Optional[str] = "beginner"
    image_emoji: Optional[str] = "📚"
    is_mandatory: Optional[bool] = False
    requires_certificate: Optional[bool] = False
    skill_ids: Optional[List[int]] = []

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    provider: Optional[str] = None
    provider_id: Optional[int] = None
    external_url: Optional[str] = None
    duration_hours: Optional[float] = None
    level: Optional[str] = None
    image_emoji: Optional[str] = None
    is_mandatory: Optional[bool] = None
    is_active: Optional[bool] = None
    requires_certificate: Optional[bool] = None
    skill_ids: Optional[List[int]] = None

class LearningPathCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    course_ids: Optional[List[int]] = []

class AssignmentCreate(BaseModel):
    employee_id: int
    course_id: Optional[int] = None
    learning_path_id: Optional[int] = None
    deadline: Optional[date] = None

class AssignmentBulkCreate(BaseModel):
    employee_ids: List[int]
    course_id: Optional[int] = None
    learning_path_id: Optional[int] = None
    deadline: Optional[date] = None

class CompleteAssignment(BaseModel):
    completion_note: Optional[str] = None

class ValidateAssignment(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None

class CertificationTypeCreate(BaseModel):
    name: str
    provider: Optional[str] = None
    description: Optional[str] = None
    validity_months: Optional[int] = None

class EmployeeCertificationCreate(BaseModel):
    employee_id: int
    certification_type_id: int
    obtained_date: date
    expiry_date: Optional[date] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None

class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    skill_type: str = 'soft_skill'       # soft_skill | technical | management
    hierarchy_level: Optional[str] = None  # stagiaire|assistant|manager|senior_manager|executive|top_executive
    department: Optional[str] = None    # operations|finance|rh|admin|it|commercial|direction|all
    is_global: bool = False

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    skill_type: Optional[str] = None
    hierarchy_level: Optional[str] = None
    department: Optional[str] = None
    is_global: Optional[bool] = None
    is_active: Optional[bool] = None

class EmployeeSkillCreate(BaseModel):
    employee_id: int
    skill_id: int
    current_level: int = 0
    target_level: Optional[int] = None
    notes: Optional[str] = None

class EmployeeSkillUpdate(BaseModel):
    current_level: Optional[int] = None
    target_level: Optional[int] = None
    notes: Optional[str] = None

class DevelopmentPlanCreate(BaseModel):
    employee_id: int
    title: Optional[str] = None
    current_role: Optional[str] = None
    target_role: Optional[str] = None
    target_date: Optional[date] = None
    notes: Optional[str] = None
    skill_ids: Optional[List[int]] = []
    skill_targets: Optional[dict] = {}
    course_ids: Optional[List[int]] = []

class DevelopmentPlanUpdate(BaseModel):
    target_role: Optional[str] = None
    target_date: Optional[date] = None
    notes: Optional[str] = None
    skill_ids: Optional[List[int]] = None
    course_ids: Optional[List[int]] = None

class DevelopmentPlanCancel(BaseModel):
    reason: str

class CourseRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    reason: Optional[str] = None
    external_url: Optional[str] = None
    provider: Optional[str] = None
    for_employee_id: Optional[int] = None

class CourseRequestReview(BaseModel):
    approved: bool
    comment: Optional[str] = None


# ============================================
# HELPERS
# ============================================

def get_employee_name(employee):
    return f"{employee.first_name} {employee.last_name}" if employee else ""

def get_employee_initials(employee):
    if employee:
        first = employee.first_name[0] if employee.first_name else ""
        last = employee.last_name[0] if employee.last_name else ""
        return f"{first}{last}".upper()
    return ""

def get_course_skills(course_id: int, db: Session) -> list:
    """Retourne les skills associés à une formation"""
    links = db.query(CourseSkill).filter(CourseSkill.course_id == course_id).all()
    result = []
    for link in links:
        skill = db.query(Skill).filter(Skill.id == link.skill_id).first()
        if skill:
            result.append({"id": skill.id, "name": skill.name, "category": skill.category})
    return result

def sync_course_skills(course_id: int, skill_ids: List[int], db: Session):
    """Remplace les skills d'une formation par la nouvelle liste"""
    db.query(CourseSkill).filter(CourseSkill.course_id == course_id).delete()
    for skill_id in skill_ids:
        db.add(CourseSkill(course_id=course_id, skill_id=skill_id))



# ============================================
# COURSES API
# ============================================

@router.get("/courses/")
async def get_courses(
    category: Optional[str] = None,
    level: Optional[str] = None,
    search: Optional[str] = None,
    is_mandatory: Optional[bool] = None,
    is_active: bool = True,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des formations du catalogue"""
    query = db.query(Course).filter(Course.tenant_id == current_user.tenant_id)
    
    if is_active is not None:
        query = query.filter(Course.is_active == is_active)
    if category:
        query = query.filter(Course.category == category)
    if level:
        query = query.filter(Course.level == level)
    if is_mandatory is not None:
        query = query.filter(Course.is_mandatory == is_mandatory)
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(
            Course.title.ilike(search_term),
            Course.description.ilike(search_term),
            Course.provider.ilike(search_term)
        ))
    
    total = query.count()
    courses = query.order_by(Course.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    result = []
    for course in courses:
        assignments = db.query(CourseAssignment).filter(CourseAssignment.course_id == course.id).all()
        enrolled = len(assignments)
        completed = len([a for a in assignments if a.status == "completed"])
        
        provider = db.query(TrainingProvider).filter(TrainingProvider.id == course.provider_id).first() if getattr(course, 'provider_id', None) else None
        result.append({
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "category": course.category,
            "provider": course.provider,
            "provider_id": getattr(course, 'provider_id', None),
            "provider_name": provider.name if provider else None,
            "external_url": course.external_url,
            "duration_hours": float(course.duration_hours) if course.duration_hours else None,
            "level": course.level,
            "image_emoji": course.image_emoji or "📚",
            "is_mandatory": course.is_mandatory,
            "is_active": course.is_active,
            "requires_certificate": getattr(course, 'requires_certificate', False),
            "enrolled": enrolled,
            "completed": completed,
            "completion_rate": round((completed / enrolled * 100) if enrolled > 0 else 0),
            "created_at": course.created_at.isoformat() if course.created_at else None,
            "skills": get_course_skills(course.id, db)
        })
    
    return {"items": result, "total": total, "page": page, "page_size": page_size}


@router.get("/courses/{course_id}")
async def get_course(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Détail d'une formation"""
    course = db.query(Course).filter(Course.id == course_id, Course.tenant_id == current_user.tenant_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Formation non trouvée")
    
    assignments = db.query(CourseAssignment).filter(CourseAssignment.course_id == course_id).all()
    provider = db.query(TrainingProvider).filter(TrainingProvider.id == course.provider_id).first() if getattr(course, 'provider_id', None) else None
    return {
        "id": course.id, "title": course.title, "description": course.description,
        "category": course.category, "provider": course.provider,
        "provider_id": getattr(course, 'provider_id', None),
        "provider_name": provider.name if provider else None,
        "external_url": course.external_url,
        "duration_hours": float(course.duration_hours) if course.duration_hours else None,
        "level": course.level, "image_emoji": course.image_emoji or "📚",
        "is_mandatory": course.is_mandatory, "is_active": course.is_active,
        "requires_certificate": getattr(course, 'requires_certificate', False),
        "enrolled": len(assignments),
        "completed": len([a for a in assignments if a.status == "completed"]),
        "in_progress": len([a for a in assignments if a.status in ["assigned", "in_progress"]]),
        "pending_validation": len([a for a in assignments if a.status == "pending_validation"]),
        "skills": get_course_skills(course_id, db)
    }


@router.post("/courses/")
async def create_course(data: CourseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Créer une formation"""
    course = Course(
        tenant_id=current_user.tenant_id, title=data.title, description=data.description,
        category=data.category, provider=data.provider, provider_id=data.provider_id,
        external_url=data.external_url, duration_hours=data.duration_hours,
        level=data.level, image_emoji=data.image_emoji or "📚",
        is_mandatory=data.is_mandatory, requires_certificate=data.requires_certificate or False,
        created_by_id=current_user.id
    )
    db.add(course)
    db.flush()
    if data.skill_ids:
        sync_course_skills(course.id, data.skill_ids, db)
    db.commit()
    db.refresh(course)
    return {"id": course.id, "message": "Formation créée avec succès"}


@router.put("/courses/{course_id}")
async def update_course(course_id: int, data: CourseUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Modifier une formation"""
    course = db.query(Course).filter(Course.id == course_id, Course.tenant_id == current_user.tenant_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Formation non trouvée")
    for field, value in data.dict(exclude_unset=True).items():
        if field == "skill_ids":
            continue
        if hasattr(course, field):
            setattr(course, field, value)
    if data.skill_ids is not None:
        sync_course_skills(course_id, data.skill_ids, db)
    db.commit()
    return {"message": "Formation mise à jour"}


@router.delete("/courses/{course_id}")
async def delete_course(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Désactiver une formation"""
    course = db.query(Course).filter(Course.id == course_id, Course.tenant_id == current_user.tenant_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Formation non trouvée")
    course.is_active = False
    db.commit()
    return {"message": "Formation désactivée"}


# ============================================
# LEARNING PATHS API
# ============================================

@router.get("/paths/")
async def get_learning_paths(is_active: bool = True, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Liste des parcours"""
    query = db.query(LearningPath).filter(LearningPath.tenant_id == current_user.tenant_id)
    if is_active is not None:
        query = query.filter(LearningPath.is_active == is_active)
    paths = query.order_by(LearningPath.created_at.desc()).all()
    
    result = []
    for path in paths:
        path_courses = db.query(LearningPathCourse).filter(LearningPathCourse.learning_path_id == path.id).all()
        total_duration = sum([float(db.query(Course).filter(Course.id == pc.course_id).first().duration_hours or 0) for pc in path_courses])
        assigned_count = db.query(CourseAssignment.employee_id).filter(CourseAssignment.learning_path_id == path.id).distinct().count()
        assignments = db.query(CourseAssignment).filter(CourseAssignment.learning_path_id == path.id).all()
        avg_progress = int((len([a for a in assignments if a.status == "completed"]) / len(assignments)) * 100) if assignments else 0
        
        result.append({
            "id": path.id, "title": path.title, "description": path.description, "category": path.category,
            "courses_count": len(path_courses), "duration_hours": round(total_duration, 1),
            "assigned_count": assigned_count, "progress": avg_progress, "is_active": path.is_active
        })
    return result


@router.post("/paths/")
async def create_learning_path(data: LearningPathCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Créer un parcours"""
    path = LearningPath(tenant_id=current_user.tenant_id, title=data.title, description=data.description, category=data.category, created_by_id=current_user.id)
    db.add(path)
    db.flush()
    for i, course_id in enumerate(data.course_ids):
        db.add(LearningPathCourse(learning_path_id=path.id, course_id=course_id, order_index=i))
    db.commit()
    return {"id": path.id, "message": "Parcours créé"}


@router.get("/paths/{path_id}")
async def get_learning_path(path_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Détail d'un parcours avec ses cours"""
    path = db.query(LearningPath).filter(LearningPath.id == path_id, LearningPath.tenant_id == current_user.tenant_id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Parcours non trouvé")
    path_courses = db.query(LearningPathCourse).filter(LearningPathCourse.learning_path_id == path.id).order_by(LearningPathCourse.order_index).all()
    courses = []
    for pc in path_courses:
        c = db.query(Course).filter(Course.id == pc.course_id).first()
        if c:
            courses.append({"id": c.id, "title": c.title, "duration_hours": float(c.duration_hours or 0), "category": c.category, "image_emoji": c.image_emoji})
    assigned_count = db.query(CourseAssignment.employee_id).filter(CourseAssignment.learning_path_id == path.id).distinct().count()
    assignments = db.query(CourseAssignment).filter(CourseAssignment.learning_path_id == path.id).all()
    avg_progress = int((len([a for a in assignments if a.status == "completed"]) / len(assignments)) * 100) if assignments else 0
    return {
        "id": path.id, "title": path.title, "description": path.description,
        "category": path.category, "is_active": path.is_active,
        "courses": courses, "assigned_count": assigned_count, "progress": avg_progress,
    }


@router.put("/paths/{path_id}")
async def update_learning_path(path_id: int, data: LearningPathCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Modifier un parcours"""
    path = db.query(LearningPath).filter(LearningPath.id == path_id, LearningPath.tenant_id == current_user.tenant_id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Parcours non trouvé")
    if data.title: path.title = data.title
    if data.description is not None: path.description = data.description
    if data.category: path.category = data.category
    if data.course_ids is not None:
        db.query(LearningPathCourse).filter(LearningPathCourse.learning_path_id == path.id).delete()
        for i, course_id in enumerate(data.course_ids):
            db.add(LearningPathCourse(learning_path_id=path.id, course_id=course_id, order_index=i))
    db.commit()
    return {"message": "Parcours mis à jour"}


@router.delete("/paths/{path_id}")
async def archive_learning_path(path_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Archiver un parcours"""
    path = db.query(LearningPath).filter(LearningPath.id == path_id, LearningPath.tenant_id == current_user.tenant_id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Parcours non trouvé")
    path.is_active = False
    db.commit()
    return {"message": "Parcours archivé"}


# ============================================
# ASSIGNMENTS API
# ============================================

@router.get("/assignments/")
async def get_assignments(
    employee_id: Optional[int] = None, course_id: Optional[int] = None, status: Optional[str] = None,
    my_assignments: bool = False, pending_validation: bool = False, 
    team_assignments: bool = False,  # NOUVEAU: pour voir les formations de l'équipe
    page: int = 1, page_size: int = 20,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Liste des assignations"""
    query = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == current_user.tenant_id)
    
    if my_assignments and current_user.employee_id:
        query = query.filter(CourseAssignment.employee_id == current_user.employee_id)
    elif team_assignments:
        # NOUVEAU: Formations de l'équipe du manager
        team_ids = get_team_employee_ids(current_user, db)
        if team_ids:
            query = query.filter(CourseAssignment.employee_id.in_(team_ids))
        else:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
    elif employee_id:
        query = query.filter(CourseAssignment.employee_id == employee_id)
    
    if course_id:
        query = query.filter(CourseAssignment.course_id == course_id)
    if status:
        query = query.filter(CourseAssignment.status == status)
    if pending_validation:
        # Filtrer aussi par équipe si c'est un manager
        if is_manager(current_user) and not has_full_access(current_user):
            team_ids = get_team_employee_ids(current_user, db)
            query = query.filter(
                CourseAssignment.status == "pending_validation",
                CourseAssignment.employee_id.in_(team_ids)
            )
        else:
            query = query.filter(CourseAssignment.status == "pending_validation")
    
    total = query.count()
    assignments = query.order_by(CourseAssignment.assigned_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    result = []
    for a in assignments:
        employee = db.query(Employee).filter(Employee.id == a.employee_id).first()
        course = db.query(Course).filter(Course.id == a.course_id).first()
        # CORRECTION: Récupérer requires_certificate de manière robuste
        requires_cert = False
        if course:
            requires_cert = getattr(course, 'requires_certificate', None)
            if requires_cert is None:
                # Fallback SQL direct si l'attribut ORM n'existe pas
                try:
                    from sqlalchemy import text
                    cert_result = db.execute(text("SELECT requires_certificate FROM courses WHERE id = :cid"), {"cid": a.course_id}).fetchone()
                    requires_cert = cert_result[0] if cert_result and cert_result[0] else False
                except:
                    requires_cert = False
        
        result.append({
            "id": a.id, "employee_id": a.employee_id, "employee_name": get_employee_name(employee),
            "employee_initials": get_employee_initials(employee), 
            "employee_job_title": employee.job_title if employee else None,
            "course_id": a.course_id,
            "course_title": course.title if course else None, "course_image": course.image_emoji if course else "📚",
            "course_duration": float(course.duration_hours) if course and course.duration_hours else None,
            "course_external_url": course.external_url if course else None,
            "requires_certificate": requires_cert,
            "status": a.status, "deadline": a.deadline.isoformat() if a.deadline else None,
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "completion_note": a.completion_note, "certificate_file": a.certificate_file,
            "certificate_filename": a.certificate_filename, "rejection_reason": a.rejection_reason
        })
    return {"items": result, "total": total, "page": page, "page_size": page_size}


@router.post("/assignments/")
async def create_assignment(data: AssignmentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Assigner une formation"""
    if not data.course_id and not data.learning_path_id:
        raise HTTPException(status_code=400, detail="Spécifiez un cours ou un parcours")
    
    count = 0
    course_title_for_email = None
    if data.course_id:
        existing = db.query(CourseAssignment).filter(
            CourseAssignment.employee_id == data.employee_id, CourseAssignment.course_id == data.course_id,
            CourseAssignment.status.notin_(["completed", "rejected"])
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Formation déjà assignée")
        course_obj = db.query(Course).filter(Course.id == data.course_id).first()
        course_title_for_email = course_obj.title if course_obj else None
        db.add(CourseAssignment(tenant_id=current_user.tenant_id, employee_id=data.employee_id, course_id=data.course_id, assigned_by_id=current_user.id, deadline=data.deadline))
        count = 1
    elif data.learning_path_id:
        path_courses = db.query(LearningPathCourse).filter(LearningPathCourse.learning_path_id == data.learning_path_id).all()
        for pc in path_courses:
            existing = db.query(CourseAssignment).filter(
                CourseAssignment.employee_id == data.employee_id, CourseAssignment.course_id == pc.course_id,
                CourseAssignment.status.notin_(["completed", "rejected"])
            ).first()
            if not existing:
                db.add(CourseAssignment(tenant_id=current_user.tenant_id, employee_id=data.employee_id, course_id=pc.course_id, learning_path_id=data.learning_path_id, assigned_by_id=current_user.id, deadline=data.deadline))
                count += 1
    db.commit()

    # Email à l'employé
    try:
        from app.services.email_service import send_training_assigned_email
        emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
        assigner = db.query(Employee).filter(Employee.id == current_user.employee_id).first() if current_user.employee_id else None
        title = course_title_for_email or (f"Parcours #{data.learning_path_id}" if data.learning_path_id else None)
        if emp and emp.email and title:
            send_training_assigned_email(
                to_email=emp.email,
                first_name=emp.first_name,
                course_title=title,
                deadline=str(data.deadline) if data.deadline else None,
                assigned_by=f"{assigner.first_name} {assigner.last_name}" if assigner else None,
            )
    except Exception as e:
        print(f"⚠️ Email formation non envoyé: {e}")

    return {"message": f"{count} formation(s) assignée(s)"}


@router.post("/assignments/bulk")
async def create_bulk_assignments(data: AssignmentBulkCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Assigner à plusieurs employés"""
    count = 0
    for employee_id in data.employee_ids:
        if data.course_id:
            existing = db.query(CourseAssignment).filter(
                CourseAssignment.employee_id == employee_id, CourseAssignment.course_id == data.course_id,
                CourseAssignment.status.notin_(["completed", "rejected"])
            ).first()
            if not existing:
                db.add(CourseAssignment(tenant_id=current_user.tenant_id, employee_id=employee_id, course_id=data.course_id, assigned_by_id=current_user.id, deadline=data.deadline))
                count += 1
    db.commit()
    return {"message": f"{count} assignation(s) créée(s)"}


@router.post("/assignments/{assignment_id}/start")
async def start_assignment(assignment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Commencer une formation"""
    a = db.query(CourseAssignment).filter(CourseAssignment.id == assignment_id, CourseAssignment.tenant_id == current_user.tenant_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignation non trouvée")
    a.status = "in_progress"
    a.started_at = datetime.utcnow()
    db.commit()
    return {"message": "Formation commencée"}


@router.post("/assignments/{assignment_id}/complete")
async def complete_assignment(assignment_id: int, data: CompleteAssignment, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Soumettre comme terminée (ou re-soumettre si rejetée/en attente)"""
    a = db.query(CourseAssignment).filter(CourseAssignment.id == assignment_id, CourseAssignment.tenant_id == current_user.tenant_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignation non trouvée")
    
    # MODIFIÉ: Permettre re-soumission si rejeté ou en attente de validation
    allowed_statuses = ["in_progress", "rejected", "pending_validation"]
    if a.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Cette formation ne peut pas être soumise dans son état actuel")
    
    # CORRECTION: Vérifier si certificat requis de manière robuste
    course = db.query(Course).filter(Course.id == a.course_id).first()
    requires_cert = False
    if course:
        # Essayer d'abord via l'attribut ORM
        requires_cert = getattr(course, 'requires_certificate', None)
        # Si None, faire une requête SQL directe (au cas où le modèle n'est pas synchronisé)
        if requires_cert is None:
            from sqlalchemy import text
            result = db.execute(text("SELECT requires_certificate FROM courses WHERE id = :cid"), {"cid": a.course_id}).fetchone()
            requires_cert = result[0] if result and result[0] else False
    
    if requires_cert and not a.certificate_file:
        raise HTTPException(status_code=400, detail="Un certificat/justificatif est requis pour cette formation. Veuillez uploader un document avant de soumettre.")
    
    a.status = "pending_validation"
    a.completion_note = data.completion_note
    a.completed_at = datetime.utcnow()
    # Réinitialiser le rejet précédent si re-soumission
    a.rejection_reason = None
    db.commit()
    return {"message": "Formation soumise pour validation"}


@router.post("/assignments/{assignment_id}/upload-certificate")
async def upload_certificate(assignment_id: int, file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Upload justificatif"""
    a = db.query(CourseAssignment).filter(CourseAssignment.id == assignment_id, CourseAssignment.tenant_id == current_user.tenant_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignation non trouvée")
    
    # MODIFIÉ: Permettre upload tant que pas validé
    if a.status == "completed":
        raise HTTPException(status_code=400, detail="Formation déjà validée, modification impossible")
    
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"cert_{assignment_id}_{uuid.uuid4().hex}{ext}"
    upload_dir = "/app/uploads/certificates"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    a.certificate_file = f"/uploads/certificates/{unique_filename}"
    a.certificate_filename = file.filename
    db.commit()
    return {"message": "Justificatif uploadé", "filename": file.filename}


@router.post("/assignments/{assignment_id}/validate")
async def validate_assignment(assignment_id: int, data: ValidateAssignment, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Valider ou rejeter"""
    a = db.query(CourseAssignment).filter(CourseAssignment.id == assignment_id, CourseAssignment.tenant_id == current_user.tenant_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignation non trouvée")
    if a.status != "pending_validation":
        raise HTTPException(status_code=400, detail="Pas en attente de validation")
    
    a.status = "completed" if data.approved else "rejected"
    if not data.approved:
        a.rejection_reason = data.rejection_reason
    a.validated_by_id = current_user.id
    a.validated_at = datetime.utcnow()
    db.commit()

    # === EPF: Auto-déclenchement évaluation post-formation ===
    if data.approved:
        try:
            from app.api.learning_patch_epf import trigger_post_training_evaluation
            pte = trigger_post_training_evaluation(
                assignment_id=a.id,
                tenant_id=current_user.tenant_id,
                db=db,
                evaluator_id=None
            )
            if pte:
                db.commit()
        except Exception as e:
            print(f"[EPF] Erreur création évaluation post-formation: {e}")

    return {"message": "Validation enregistrée"}


# ============================================
# CERTIFICATIONS API
# ============================================

@router.get("/certifications/")
async def get_certifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Types de certifications"""
    certs = db.query(CertificationType).filter(CertificationType.tenant_id == current_user.tenant_id, CertificationType.is_active == True).all()
    today = date.today()
    three_months = today + timedelta(days=90)
    
    result = []
    for cert in certs:
        holders = db.query(EmployeeCertification).filter(EmployeeCertification.certification_type_id == cert.id).all()
        expiring = len([h for h in holders if h.expiry_date and today <= h.expiry_date <= three_months])
        result.append({"id": cert.id, "name": cert.name, "provider": cert.provider, "description": cert.description, "validity_months": cert.validity_months, "total_holders": len(holders), "expiring_soon": expiring})
    return result


@router.get("/certifications/{cert_id}/holders")
async def get_certification_holders(cert_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Titulaires d'une certification"""
    holders = db.query(EmployeeCertification).filter(EmployeeCertification.certification_type_id == cert_id, EmployeeCertification.tenant_id == current_user.tenant_id).all()
    today = date.today()
    three_months = today + timedelta(days=90)
    
    result = []
    for h in holders:
        employee = db.query(Employee).filter(Employee.id == h.employee_id).first()
        status = "valid"
        if h.expiry_date:
            if h.expiry_date < today:
                status = "expired"
            elif h.expiry_date <= three_months:
                status = "expiring"
        result.append({
            "id": h.id, "employee_id": h.employee_id, "employee_name": get_employee_name(employee),
            "employee_initials": get_employee_initials(employee),
            "obtained_date": h.obtained_date.isoformat() if h.obtained_date else None,
            "expiry_date": h.expiry_date.isoformat() if h.expiry_date else "Permanent",
            "status": status, "credential_id": h.credential_id
        })
    return result


@router.post("/certifications/")
async def create_certification_type(data: CertificationTypeCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Créer un type de certification"""
    cert = CertificationType(tenant_id=current_user.tenant_id, name=data.name, provider=data.provider, description=data.description, validity_months=data.validity_months)
    db.add(cert)
    db.commit()
    return {"id": cert.id, "message": "Certification créée"}


@router.post("/employee-certifications/")
async def add_employee_certification(data: EmployeeCertificationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ajouter certification à un employé"""
    ec = EmployeeCertification(tenant_id=current_user.tenant_id, employee_id=data.employee_id, certification_type_id=data.certification_type_id, obtained_date=data.obtained_date, expiry_date=data.expiry_date, credential_id=data.credential_id, credential_url=data.credential_url)
    db.add(ec)
    db.commit()
    return {"id": ec.id, "message": "Certification ajoutée"}


# ============================================
# SKILLS API
# ============================================

def _skill_to_dict(s):
    return {
        "id": s.id, "name": s.name, "category": s.category,
        "description": s.description, "skill_type": getattr(s, "skill_type", "soft_skill"),
        "hierarchy_level": getattr(s, "hierarchy_level", None),
        "department": getattr(s, "department", None),
        "is_global": getattr(s, "is_global", False),
    }


@router.get("/skills/")
async def get_skills(
    category: Optional[str] = None,
    skill_type: Optional[str] = None,
    hierarchy_level: Optional[str] = None,
    department: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste du référentiel de compétences avec filtres"""
    query = db.query(Skill).filter(Skill.tenant_id == current_user.tenant_id, Skill.is_active == True)
    if category:
        query = query.filter(Skill.category == category)
    if skill_type:
        query = query.filter(Skill.skill_type == skill_type)
    if hierarchy_level:
        query = query.filter(Skill.hierarchy_level == hierarchy_level)
    if department:
        query = query.filter((Skill.department == department) | (Skill.is_global == True))
    skills = query.order_by(Skill.hierarchy_level, Skill.name).all()
    return [_skill_to_dict(s) for s in skills]


@router.post("/skills/")
async def create_skill(data: SkillCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Créer une compétence dans le référentiel"""
    skill = Skill(
        tenant_id=current_user.tenant_id,
        name=data.name,
        category=data.category,
        description=data.description,
        skill_type=data.skill_type,
        hierarchy_level=data.hierarchy_level,
        department=data.department,
        is_global=data.is_global,
    )
    db.add(skill)
    db.commit()
    return {"id": skill.id, "message": "Compétence créée", **_skill_to_dict(skill)}


@router.put("/skills/{skill_id}")
async def update_skill(skill_id: int, data: SkillUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Modifier une compétence"""
    skill = db.query(Skill).filter(Skill.id == skill_id, Skill.tenant_id == current_user.tenant_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Compétence non trouvée")
    for field, value in data.dict(exclude_none=True).items():
        setattr(skill, field, value)
    db.commit()
    return {"message": "Mis à jour", **_skill_to_dict(skill)}


@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Désactiver une compétence"""
    skill = db.query(Skill).filter(Skill.id == skill_id, Skill.tenant_id == current_user.tenant_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Compétence non trouvée")
    skill.is_active = False
    db.commit()
    return {"message": "Supprimé"}


@router.get("/employees/{employee_id}/skills")
async def get_employee_skills(employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Compétences d'un employé avec détail scores"""
    emp_skills = db.query(EmployeeSkill).filter(
        EmployeeSkill.employee_id == employee_id,
        EmployeeSkill.tenant_id == current_user.tenant_id
    ).all()
    result = []
    for es in emp_skills:
        skill = db.query(Skill).filter(Skill.id == es.skill_id).first()
        result.append({
            "id": es.id, "skill_id": es.skill_id,
            "skill_name": skill.name if skill else None,
            "skill_category": skill.category if skill else None,
            "skill_type": getattr(skill, "skill_type", None) if skill else None,
            "hierarchy_level": getattr(skill, "hierarchy_level", None) if skill else None,
            "department": getattr(skill, "department", None) if skill else None,
            "current_level": es.current_level,
            "target_level": es.target_level,
            "formations_score": getattr(es, "formations_score", 0),
            "performance_score": getattr(es, "performance_score", 0),
            "attitude_score": getattr(es, "attitude_score", 0),
            "notes": getattr(es, "notes", None),
            "last_computed_at": es.last_computed_at.isoformat() if getattr(es, "last_computed_at", None) else None,
        })
    return result


@router.post("/employee-skills/")
async def add_employee_skill(data: EmployeeSkillCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ajouter ou mettre à jour une compétence pour un employé"""
    existing = db.query(EmployeeSkill).filter(
        EmployeeSkill.employee_id == data.employee_id,
        EmployeeSkill.skill_id == data.skill_id
    ).first()
    if existing:
        existing.current_level = data.current_level
        if data.target_level is not None:
            existing.target_level = data.target_level
        if data.notes is not None:
            existing.notes = data.notes
        existing.assessed_by_id = current_user.id
        existing.assessed_at = datetime.utcnow()
        db.commit()
        return {"id": existing.id, "message": "Compétence mise à jour"}
    es = EmployeeSkill(
        tenant_id=current_user.tenant_id,
        employee_id=data.employee_id,
        skill_id=data.skill_id,
        current_level=data.current_level,
        target_level=data.target_level,
        notes=data.notes,
        assessed_by_id=current_user.id,
        assessed_at=datetime.utcnow()
    )
    db.add(es)
    db.commit()
    return {"id": es.id, "message": "Compétence ajoutée"}


@router.put("/employee-skills/{es_id}")
async def update_employee_skill(es_id: int, data: EmployeeSkillUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mettre à jour le niveau d'une compétence"""
    es = db.query(EmployeeSkill).filter(EmployeeSkill.id == es_id, EmployeeSkill.tenant_id == current_user.tenant_id).first()
    if not es:
        raise HTTPException(status_code=404, detail="Non trouvé")
    if data.current_level is not None:
        es.current_level = data.current_level
    if data.target_level is not None:
        es.target_level = data.target_level
    if data.notes is not None:
        es.notes = data.notes
    es.assessed_by_id = current_user.id
    es.assessed_at = datetime.utcnow()
    db.commit()
    return {"message": "Mis à jour"}


@router.delete("/employee-skills/{es_id}")
async def delete_employee_skill(es_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Supprimer une compétence d'un employé"""
    es = db.query(EmployeeSkill).filter(EmployeeSkill.id == es_id, EmployeeSkill.tenant_id == current_user.tenant_id).first()
    if not es:
        raise HTTPException(status_code=404, detail="Non trouvé")
    db.delete(es)
    db.commit()
    return {"message": "Supprimé"}


@router.get("/skills/{skill_id}/recommended-courses")
async def get_recommended_courses_for_skill(
    skill_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Formations recommandées pour développer une compétence donnée"""
    skill = db.query(Skill).filter(Skill.id == skill_id, Skill.tenant_id == current_user.tenant_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Compétence non trouvée")

    links = db.query(CourseSkill).filter(CourseSkill.skill_id == skill_id).all()
    course_ids = [link.course_id for link in links]

    courses = db.query(Course).filter(
        Course.id.in_(course_ids),
        Course.tenant_id == current_user.tenant_id,
        Course.is_active == True
    ).all()

    return [
        {
            "id": c.id,
            "title": c.title,
            "category": c.category,
            "level": c.level,
            "duration_hours": float(c.duration_hours) if c.duration_hours else None,
            "image_emoji": c.image_emoji or "📚",
            "provider": c.provider,
        }
        for c in courses
    ]


# ============================================
# DEVELOPMENT PLANS API
# ============================================

@router.get("/development-plans/")
async def get_development_plans(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    include_inactive: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Plans de développement - filtrés selon le rôle"""
    accessible_ids = get_accessible_employee_ids(current_user, db)
    
    query = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.tenant_id == current_user.tenant_id,
        DevelopmentPlan.employee_id.in_(accessible_ids)
    )
    
    if employee_id:
        if employee_id not in accessible_ids:
            return []
        query = query.filter(DevelopmentPlan.employee_id == employee_id)
    
    if status:
        query = query.filter(DevelopmentPlan.status == status)
    elif not include_inactive:
        query = query.filter(DevelopmentPlan.status.notin_(["cancelled", "archived"]))
    
    plans = query.order_by(DevelopmentPlan.created_at.desc()).all()
    
    result = []
    for plan in plans:
        employee = db.query(Employee).filter(Employee.id == plan.employee_id).first()
        plan_skills = db.query(DevelopmentPlanSkill).filter(DevelopmentPlanSkill.development_plan_id == plan.id).all()
        skills = []
        for ps in plan_skills:
            skill = db.query(Skill).filter(Skill.id == ps.skill_id).first()
            es = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == plan.employee_id, EmployeeSkill.skill_id == ps.skill_id).first()
            skills.append({
                "id": ps.skill_id,
                "name": skill.name if skill else None,
                "current": es.current_level if es else ps.current_level,
                "target": ps.target_level
            })
        
        plan_courses = db.query(DevelopmentPlanCourse).filter(DevelopmentPlanCourse.development_plan_id == plan.id).order_by(DevelopmentPlanCourse.order_index).all()
        courses = []
        for pc in plan_courses:
            course = db.query(Course).filter(Course.id == pc.course_id).first()
            assignment = db.query(CourseAssignment).filter(CourseAssignment.employee_id == plan.employee_id, CourseAssignment.course_id == pc.course_id).first()
            course_status = "planned"
            if assignment:
                if assignment.status == "completed":
                    course_status = "completed"
                elif assignment.status in ["in_progress", "pending_validation"]:
                    course_status = "in-progress"
                elif assignment.status == "assigned":
                    course_status = "assigned"
            courses.append({
                "id": pc.course_id,
                "title": course.title if course else None,
                "status": course_status
            })
        
        # CORRECTION: Calculer la progression DYNAMIQUEMENT basée sur les formations complétées
        completed_courses = len([c for c in courses if c["status"] == "completed"])
        total_courses = len(courses)
        calculated_progress = int((completed_courses / total_courses) * 100) if total_courses > 0 else 0
        
        result.append({
            "id": plan.id,
            "employee_id": plan.employee_id,
            "employee": get_employee_name(employee),
            "initials": get_employee_initials(employee),
            "role": plan.employee_current_role,
            "targetRole": plan.target_role,
            "progress": calculated_progress,  # Utiliser la valeur calculée
            "status": plan.status,
            "cancellation_reason": getattr(plan, 'cancellation_reason', None),
            "skills": skills,
            "courses": courses,
            "target_date": plan.target_date.isoformat() if plan.target_date else None
        })
    return result


@router.post("/development-plans/")
async def create_development_plan(data: DevelopmentPlanCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Créer un plan et AUTO-ASSIGNER les formations à l'employé"""
    employee = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    plan = DevelopmentPlan(
        tenant_id=current_user.tenant_id, employee_id=data.employee_id,
        title=data.title or f"Plan - {get_employee_name(employee)}",
        employee_current_role=data.current_role or employee.job_title, target_role=data.target_role,
        target_date=data.target_date, notes=data.notes, status="active", created_by_id=current_user.id
    )
    db.add(plan)
    db.flush()
    
    # Ajouter les compétences au plan
    for skill_id in data.skill_ids:
        target = data.skill_targets.get(str(skill_id), 80) if data.skill_targets else 80
        es = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == data.employee_id, EmployeeSkill.skill_id == skill_id).first()
        db.add(DevelopmentPlanSkill(development_plan_id=plan.id, skill_id=skill_id, current_level=es.current_level if es else 0, target_level=target))
    
    # Ajouter les formations au plan ET les assigner automatiquement à l'employé
    assigned_count = 0
    for i, course_id in enumerate(data.course_ids):
        # Ajouter au plan de développement
        db.add(DevelopmentPlanCourse(development_plan_id=plan.id, course_id=course_id, order_index=i))
        
        # AUTO-ASSIGNER: Vérifier si pas déjà assigné
        existing_assignment = db.query(CourseAssignment).filter(
            CourseAssignment.employee_id == data.employee_id,
            CourseAssignment.course_id == course_id,
            CourseAssignment.status.notin_(["completed", "rejected"])
        ).first()
        
        if not existing_assignment:
            new_assignment = CourseAssignment(
                tenant_id=current_user.tenant_id,
                employee_id=data.employee_id,
                course_id=course_id,
                assigned_by_id=current_user.id,
                deadline=data.target_date,  # Utiliser la date cible du plan comme deadline
                status="assigned"
            )
            db.add(new_assignment)
            assigned_count += 1
    
    db.commit()
    return {"id": plan.id, "message": f"Plan créé avec {assigned_count} formation(s) assignée(s)"}


@router.put("/development-plans/{plan_id}")
async def update_development_plan(
    plan_id: int,
    data: DevelopmentPlanUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Modifier un plan et auto-assigner les nouvelles formations"""
    plan = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.id == plan_id,
        DevelopmentPlan.tenant_id == current_user.tenant_id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan non trouvé")
    
    if plan.status in ["cancelled", "archived"]:
        raise HTTPException(status_code=400, detail="Impossible de modifier un plan annulé ou archivé")
    
    # Mettre à jour les champs simples
    if data.target_role is not None:
        plan.target_role = data.target_role
    if data.target_date is not None:
        plan.target_date = data.target_date
    if data.notes is not None:
        plan.notes = data.notes
    
    # Mettre à jour les compétences si fournies
    if data.skill_ids is not None:
        db.query(DevelopmentPlanSkill).filter(
            DevelopmentPlanSkill.development_plan_id == plan_id
        ).delete()
        
        for skill_id in data.skill_ids:
            es = db.query(EmployeeSkill).filter(
                EmployeeSkill.employee_id == plan.employee_id,
                EmployeeSkill.skill_id == skill_id
            ).first()
            db.add(DevelopmentPlanSkill(
                development_plan_id=plan.id,
                skill_id=skill_id,
                current_level=es.current_level if es else 0,
                target_level=80
            ))
    
    # Mettre à jour les formations si fournies
    if data.course_ids is not None:
        # Récupérer les anciens course_ids
        old_course_ids = [pc.course_id for pc in db.query(DevelopmentPlanCourse).filter(
            DevelopmentPlanCourse.development_plan_id == plan_id
        ).all()]
        
        # Supprimer les anciennes liaisons
        db.query(DevelopmentPlanCourse).filter(
            DevelopmentPlanCourse.development_plan_id == plan_id
        ).delete()
        
        # Ajouter les nouvelles et AUTO-ASSIGNER
        for i, course_id in enumerate(data.course_ids):
            db.add(DevelopmentPlanCourse(
                development_plan_id=plan.id,
                course_id=course_id,
                order_index=i
            ))
            
            # Si c'est un nouveau cours, l'assigner
            if course_id not in old_course_ids:
                existing = db.query(CourseAssignment).filter(
                    CourseAssignment.employee_id == plan.employee_id,
                    CourseAssignment.course_id == course_id,
                    CourseAssignment.status.notin_(["completed", "rejected"])
                ).first()
                
                if not existing:
                    db.add(CourseAssignment(
                        tenant_id=current_user.tenant_id,
                        employee_id=plan.employee_id,
                        course_id=course_id,
                        assigned_by_id=current_user.id,
                        deadline=plan.target_date,
                        status="assigned"
                    ))
    
    db.commit()
    return {"message": "Plan mis à jour"}


@router.post("/development-plans/{plan_id}/cancel")
async def cancel_development_plan(
    plan_id: int,
    data: DevelopmentPlanCancel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Annuler un plan de développement avec motif"""
    plan = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.id == plan_id,
        DevelopmentPlan.tenant_id == current_user.tenant_id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan non trouvé")
    
    if plan.status in ["cancelled", "archived"]:
        raise HTTPException(status_code=400, detail="Plan déjà annulé ou archivé")
    
    if not data.reason or not data.reason.strip():
        raise HTTPException(status_code=400, detail="Le motif d'annulation est obligatoire")
    
    plan.status = "cancelled"
    plan.cancellation_reason = data.reason.strip()
    
    db.commit()
    return {"message": "Plan annulé"}


@router.post("/development-plans/{plan_id}/archive")
async def archive_development_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Archiver un plan de développement"""
    plan = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.id == plan_id,
        DevelopmentPlan.tenant_id == current_user.tenant_id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan non trouvé")
    
    if plan.status == "cancelled":
        raise HTTPException(status_code=400, detail="Impossible d'archiver un plan annulé")
    
    if plan.status == "archived":
        raise HTTPException(status_code=400, detail="Plan déjà archivé")
    
    plan.status = "archived"
    db.commit()
    return {"message": "Plan archivé"}


# ============================================
# STATS API
# ============================================

@router.get("/stats/")
async def get_learning_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Statistiques globales"""
    tid = current_user.tenant_id
    today = date.today()
    first_day = today.replace(day=1)
    three_months = today + timedelta(days=90)
    
    total_courses = db.query(Course).filter(Course.tenant_id == tid, Course.is_active == True).count()
    completed_month = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == tid, CourseAssignment.status == "completed", CourseAssignment.completed_at >= first_day).count()
    
    completed_assignments = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == tid, CourseAssignment.status == "completed", CourseAssignment.completed_at >= first_day).all()
    total_hours = sum([float(db.query(Course).filter(Course.id == a.course_id).first().duration_hours or 0) for a in completed_assignments])
    
    total_certs = db.query(EmployeeCertification).filter(EmployeeCertification.tenant_id == tid).count()
    total_assign = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == tid).count()
    total_completed = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == tid, CourseAssignment.status == "completed").count()
    completion_rate = int((total_completed / total_assign) * 100) if total_assign > 0 else 0
    
    # Pending validation - filtré par équipe si manager
    if is_manager(current_user) and not has_full_access(current_user):
        team_ids = get_team_employee_ids(current_user, db)
        pending = db.query(CourseAssignment).filter(
            CourseAssignment.tenant_id == tid,
            CourseAssignment.status == "pending_validation",
            CourseAssignment.employee_id.in_(team_ids)
        ).count()
    else:
        pending = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == tid, CourseAssignment.status == "pending_validation").count()
    
    expiring = db.query(EmployeeCertification).filter(EmployeeCertification.tenant_id == tid, EmployeeCertification.expiry_date <= three_months, EmployeeCertification.expiry_date >= today).count()
    
    return {"total_courses": total_courses, "completed_this_month": completed_month, "hours_this_month": round(total_hours, 1), "total_certifications": total_certs, "completion_rate": completion_rate, "pending_validation": pending, "expiring_certifications": expiring}


@router.get("/stats/monthly")
async def get_monthly_stats(months: int = 6, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Stats mensuelles"""
    tid = current_user.tenant_id
    result = []
    today = date.today()
    month_names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    
    for i in range(months - 1, -1, -1):
        target_month = today.month - i
        target_year = today.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        
        month_start = date(target_year, target_month, 1)
        month_end = date(target_year + 1, 1, 1) if target_month == 12 else date(target_year, target_month + 1, 1)
        
        completions = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == tid, CourseAssignment.status == "completed", CourseAssignment.completed_at >= month_start, CourseAssignment.completed_at < month_end).count()
        completed = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == tid, CourseAssignment.status == "completed", CourseAssignment.completed_at >= month_start, CourseAssignment.completed_at < month_end).all()
        hours = sum([float(db.query(Course).filter(Course.id == a.course_id).first().duration_hours or 0) for a in completed])
        
        result.append({"month": month_names[target_month - 1], "completions": completions, "hours": int(hours)})
    return result


@router.get("/stats/by-category")
async def get_stats_by_category(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Par catégorie"""
    assignments = db.query(CourseAssignment).filter(CourseAssignment.tenant_id == current_user.tenant_id).all()
    counts = {}
    for a in assignments:
        course = db.query(Course).filter(Course.id == a.course_id).first()
        cat = course.category or "Autres" if course else "Autres"
        counts[cat] = counts.get(cat, 0) + 1
    
    total = sum(counts.values()) or 1
    colors = {"Soft Skills": "#8B5CF6", "Technique": "#3B82F6", "Management": "#10B981", "Commercial": "#F59E0B", "Innovation": "#EC4899", "Juridique": "#6366F1", "Autres": "#6B7280"}
    return [{"name": cat, "value": int((cnt / total) * 100), "color": colors.get(cat, "#6B7280")} for cat, cnt in counts.items()]


@router.get("/stats/top-learners")
async def get_top_learners(limit: int = 5, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Top apprenants"""
    learners = db.query(CourseAssignment.employee_id, func.count(CourseAssignment.id).label("cnt")).filter(
        CourseAssignment.tenant_id == current_user.tenant_id, CourseAssignment.status == "completed"
    ).group_by(CourseAssignment.employee_id).order_by(func.count(CourseAssignment.id).desc()).limit(limit).all()
    
    result = []
    for emp_id, courses_cnt in learners:
        employee = db.query(Employee).filter(Employee.id == emp_id).first()
        assignments = db.query(CourseAssignment).filter(CourseAssignment.employee_id == emp_id, CourseAssignment.status == "completed").all()
        hours = sum([float(db.query(Course).filter(Course.id == a.course_id).first().duration_hours or 0) for a in assignments])
        result.append({"name": get_employee_name(employee), "hours": int(hours), "courses": courses_cnt})
    return result


# ============================================
# COURSE REQUESTS API
# ============================================

@router.get("/requests/")
async def get_course_requests(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des demandes de formation"""
    query = db.query(CourseRequest).filter(CourseRequest.tenant_id == current_user.tenant_id)
    
    if status:
        query = query.filter(CourseRequest.status == status)
    
    requests = query.order_by(CourseRequest.requested_at.desc()).all()
    
    result = []
    for r in requests:
        requested_by = db.query(User).filter(User.id == r.requested_by_id).first()
        requested_by_emp = None
        if requested_by and requested_by.employee_id:
            requested_by_emp = db.query(Employee).filter(Employee.id == requested_by.employee_id).first()
        
        for_employee = None
        if r.for_employee_id:
            for_employee = db.query(Employee).filter(Employee.id == r.for_employee_id).first()
        
        result.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "reason": r.reason,
            "external_url": r.external_url,
            "provider": r.provider,
            "status": r.status,
            "requested_by_name": get_employee_name(requested_by_emp) if requested_by_emp else "Inconnu",
            "requested_by_initials": get_employee_initials(requested_by_emp) if requested_by_emp else "?",
            "for_employee_name": get_employee_name(for_employee) if for_employee else None,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "review_comment": r.review_comment
        })
    
    return result


@router.post("/requests/")
async def create_course_request(
    data: CourseRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer une demande de formation"""
    request = CourseRequest(
        tenant_id=current_user.tenant_id,
        requested_by_id=current_user.id,
        title=data.title,
        description=data.description,
        reason=data.reason,
        external_url=data.external_url,
        provider=data.provider,
        for_employee_id=data.for_employee_id
    )
    
    db.add(request)
    db.commit()
    
    return {"id": request.id, "message": "Demande envoyée"}


@router.post("/requests/{request_id}/review")
async def review_course_request(
    request_id: int,
    data: CourseRequestReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approuver ou rejeter une demande"""
    request = db.query(CourseRequest).filter(
        CourseRequest.id == request_id,
        CourseRequest.tenant_id == current_user.tenant_id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    request.status = "approved" if data.approved else "rejected"
    request.reviewed_by_id = current_user.id
    request.reviewed_at = datetime.utcnow()
    request.review_comment = data.comment
    
    db.commit()


# ============================================
# COMPETENCY SCORE ENGINE
# ============================================

def _compute_employee_competency_scores(employee_id: int, tenant_id: int, db: Session) -> list:
    """
    Calcule les scores de compétences d'un employé depuis 3 sources :
    - formations_score  : % des formations requises pour chaque compétence complétées
    - performance_score : note globale des évaluations (normalisée 0-100)
    - attitude_score    : score attitude depuis les feedbacks (normalisée 0-100)
    Score final = 40% formations + 40% performance + 20% attitude
    """
    from sqlalchemy import text as sql_text

    # ── Performance score ─────────────────────────────────────────────────
    perf_row = db.execute(sql_text("""
        SELECT AVG(e.weighted_score) as avg_score
        FROM evaluations e
        JOIN evaluation_campaigns ec ON e.campaign_id = ec.id
        WHERE e.employee_id = :eid AND ec.tenant_id = :tid
          AND e.status = 'completed' AND e.weighted_score IS NOT NULL
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()
    raw_perf = float(perf_row[0] or 0)
    # weighted_score est sur 10 → normaliser 0-100
    performance_score = min(int((raw_perf / 10) * 100), 100)

    # ── Attitude score ────────────────────────────────────────────────────
    att_row = db.execute(sql_text("""
        SELECT
            SUM(CASE WHEN fa.sentiment = 'recognition' THEN 1 ELSE 0 END) AS rec,
            SUM(CASE WHEN fa.sentiment = 'improvement' THEN 1 ELSE 0 END) AS imp
        FROM feedback_attitudes fa
        JOIN feedbacks f ON fa.feedback_id = f.id
        WHERE f.to_employee_id = :eid AND f.tenant_id = :tid
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()
    rec = int(att_row[0] or 0)
    imp = int(att_row[1] or 0)
    total = rec + imp
    attitude_score = int((rec / total) * 100) if total > 0 else 50  # 50 = neutre

    # ── Per-skill formations score ────────────────────────────────────────
    emp_skills = db.query(EmployeeSkill).filter(
        EmployeeSkill.employee_id == employee_id,
        EmployeeSkill.tenant_id == tenant_id
    ).all()

    results = []
    for es in emp_skills:
        skill = db.query(Skill).filter(Skill.id == es.skill_id).first()
        if not skill:
            continue

        # Formations liées à cette compétence
        req_courses = db.execute(sql_text("""
            SELECT cs.course_id FROM course_skills cs WHERE cs.skill_id = :sid
        """), {"sid": es.skill_id}).fetchall()
        req_course_ids = [r[0] for r in req_courses]

        formations_score = 0
        remaining_courses = []
        if req_course_ids:
            completed = db.execute(sql_text("""
                SELECT course_id FROM course_assignments
                WHERE employee_id = :eid AND course_id = ANY(:cids)
                  AND status IN ('completed', 'validated')
            """), {"eid": employee_id, "cids": req_course_ids}).fetchall()
            completed_ids = {r[0] for r in completed}
            formations_score = int((len(completed_ids) / len(req_course_ids)) * 100)

            # Formations restantes
            missing_ids = [c for c in req_course_ids if c not in completed_ids]
            if missing_ids:
                courses = db.execute(sql_text("""
                    SELECT id, title, duration_hours, category FROM courses
                    WHERE id = ANY(:cids) AND is_active = true
                """), {"cids": missing_ids}).fetchall()
                remaining_courses = [
                    {"id": r[0], "title": r[1], "duration_hours": float(r[2] or 0), "category": r[3]}
                    for r in courses
                ]

        # Score global = 40% formations + 40% performance + 20% attitude
        global_score = int(formations_score * 0.4 + performance_score * 0.4 + attitude_score * 0.2)

        # Recommandation IA simple : gap analysis
        gap = (es.target_level or 100) - global_score
        recommendation = _ai_recommendation(skill, gap, remaining_courses, performance_score, attitude_score)

        results.append({
            "employee_skill_id": es.id,
            "skill_id": es.skill_id,
            "skill_name": skill.name,
            "skill_type": getattr(skill, "skill_type", "soft_skill"),
            "hierarchy_level": getattr(skill, "hierarchy_level", None),
            "department": getattr(skill, "department", None),
            "current_level": es.current_level,
            "target_level": es.target_level or 100,
            "global_score": global_score,
            "formations_score": formations_score,
            "performance_score": performance_score,
            "attitude_score": attitude_score,
            "remaining_courses": remaining_courses,
            "gap": gap,
            "recommendation": recommendation,
        })
    return results


def _ai_recommendation(skill, gap: int, remaining_courses: list, performance_score: int, attitude_score: int) -> str:
    """Génère une recommandation simple basée sur le gap analysis"""
    if gap <= 0:
        return f"✅ Compétence {skill.name} maîtrisée à 100% pour ce niveau."
    if remaining_courses:
        top_course = remaining_courses[0]["title"]
        return (
            f"📚 {len(remaining_courses)} formation(s) à compléter — priorité : « {top_course} ». "
            f"Score formations : {100 - gap}%. "
            + (f"⚠️ Performance à renforcer ({performance_score}%)." if performance_score < 60 else "")
            + (f" 💬 Améliorer l'attitude ({attitude_score}%)." if attitude_score < 60 else "")
        )
    if performance_score < 60:
        return f"📈 Améliorer les performances (score actuel {performance_score}/100) pour progresser en {skill.name}."
    return f"🎯 Objectifs proches — encore {gap}% d'écart pour maîtriser {skill.name} à ce niveau."


@router.post("/employees/{employee_id}/skills/compute")
async def compute_employee_competency_scores(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calcule et sauvegarde les scores de compétences d'un employé.
    Retourne le profil complet avec recommandations IA.
    """
    tid = current_user.tenant_id
    results = _compute_employee_competency_scores(employee_id, tid, db)

    # Persister les scores calculés
    from datetime import datetime as dt
    for r in results:
        es = db.query(EmployeeSkill).filter(EmployeeSkill.id == r["employee_skill_id"]).first()
        if es:
            es.formations_score = r["formations_score"]
            es.performance_score = r["performance_score"]
            es.attitude_score = r["attitude_score"]
            es.current_level = r["global_score"]
            es.last_computed_at = dt.utcnow()
    db.commit()

    return {"employee_id": employee_id, "skills": results, "computed_at": dt.utcnow().isoformat()}


@router.get("/employees/{employee_id}/competency-profile")
async def get_competency_profile(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Profil de compétences complet d'un employé :
    scores actuels, formations restantes, recommandations IA.
    Utilise les scores en base (dernière computation) sans recalculer.
    """
    emp_skills = db.query(EmployeeSkill).filter(
        EmployeeSkill.employee_id == employee_id,
        EmployeeSkill.tenant_id == current_user.tenant_id
    ).all()

    if not emp_skills:
        return {"employee_id": employee_id, "skills": [], "overall_score": 0, "last_computed_at": None}

    profile = []
    last_computed = None
    for es in emp_skills:
        skill = db.query(Skill).filter(Skill.id == es.skill_id).first()
        if not skill:
            continue
        if es.last_computed_at and (not last_computed or es.last_computed_at > last_computed):
            last_computed = es.last_computed_at

        # Formations restantes
        from sqlalchemy import text as sql_text
        req_rows = db.execute(sql_text("SELECT cs.course_id FROM course_skills cs WHERE cs.skill_id = :sid"), {"sid": es.skill_id}).fetchall()
        req_ids = [r[0] for r in req_rows]
        remaining = []
        if req_ids:
            done = db.execute(sql_text("""
                SELECT course_id FROM course_assignments
                WHERE employee_id = :eid AND course_id = ANY(:cids) AND status IN ('completed','validated')
            """), {"eid": employee_id, "cids": req_ids}).fetchall()
            done_ids = {r[0] for r in done}
            missing = [c for c in req_ids if c not in done_ids]
            if missing:
                rows = db.execute(sql_text("SELECT id, title, duration_hours, category FROM courses WHERE id = ANY(:cids)"), {"cids": missing}).fetchall()
                remaining = [{"id": r[0], "title": r[1], "duration_hours": float(r[2] or 0), "category": r[3]} for r in rows]

        profile.append({
            "skill_id": es.skill_id,
            "skill_name": skill.name,
            "skill_type": getattr(skill, "skill_type", "soft_skill"),
            "hierarchy_level": getattr(skill, "hierarchy_level", None),
            "department": getattr(skill, "department", None),
            "current_level": es.current_level,
            "target_level": es.target_level or 100,
            "formations_score": getattr(es, "formations_score", 0),
            "performance_score": getattr(es, "performance_score", 0),
            "attitude_score": getattr(es, "attitude_score", 0),
            "remaining_courses": remaining,
            "recommendation": _ai_recommendation(
                skill, (es.target_level or 100) - es.current_level,
                remaining,
                getattr(es, "performance_score", 0),
                getattr(es, "attitude_score", 0)
            ),
        })

    overall = int(sum(s["current_level"] for s in profile) / len(profile)) if profile else 0
    return {
        "employee_id": employee_id,
        "overall_score": overall,
        "skills": profile,
        "last_computed_at": last_computed.isoformat() if last_computed else None,
    }


@router.post("/employees/{employee_id}/skills/bulk-init")
async def bulk_init_employee_skills(
    employee_id: int,
    skills: List[EmployeeSkillCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initialise en masse les compétences d'un employé (à l'ajout ou depuis scoring CV).
    Upsert : crée les manquants, met à jour les existants.
    """
    created, updated = 0, 0
    for item in skills:
        existing = db.query(EmployeeSkill).filter(
            EmployeeSkill.employee_id == employee_id,
            EmployeeSkill.skill_id == item.skill_id
        ).first()
        if existing:
            existing.current_level = item.current_level
            if item.target_level is not None:
                existing.target_level = item.target_level
            if item.notes is not None:
                existing.notes = item.notes
            updated += 1
        else:
            db.add(EmployeeSkill(
                tenant_id=current_user.tenant_id,
                employee_id=employee_id,
                skill_id=item.skill_id,
                current_level=item.current_level,
                target_level=item.target_level,
                notes=item.notes,
                assessed_by_id=current_user.id,
                assessed_at=datetime.utcnow()
            ))
            created += 1
    db.commit()
    return {"created": created, "updated": updated, "total": created + updated}


@router.post("/employees/{employee_id}/skills/from-career-level")
async def init_skills_from_career_level(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initialise les compétences de l'employé depuis son niveau de carrière actuel.
    Lit les level_competencies liées au current_level_id dans employee_careers
    et crée les employee_skills manquants (target_level = 100).
    """
    # Récupère le niveau de carrière actuel
    career_row = db.execute(text("""
        SELECT current_level_id FROM employee_careers
        WHERE employee_id = :eid AND tenant_id = :tid
        ORDER BY id DESC LIMIT 1
    """), {"eid": employee_id, "tid": current_user.tenant_id}).fetchone()

    if not career_row:
        raise HTTPException(status_code=404, detail="Aucun parcours carrière assigné à cet employé.")

    level_id = career_row[0]

    # Compétences liées à ce niveau qui ont un skill_id renseigné
    lc_rows = db.execute(text("""
        SELECT DISTINCT lc.skill_id, lc.name
        FROM level_competencies lc
        WHERE lc.career_level_id = :lid AND lc.skill_id IS NOT NULL
    """), {"lid": level_id}).fetchall()

    if not lc_rows:
        return {"created": 0, "updated": 0, "message": "Aucune compétence liée à ce niveau de carrière."}

    created, skipped = 0, 0
    for row in lc_rows:
        skill_id = row[0]
        existing = db.execute(text("""
            SELECT id FROM employee_skills
            WHERE employee_id = :eid AND skill_id = :sid AND tenant_id = :tid
        """), {"eid": employee_id, "sid": skill_id, "tid": current_user.tenant_id}).fetchone()

        if not existing:
            db.execute(text("""
                INSERT INTO employee_skills
                (tenant_id, employee_id, skill_id, current_level, target_level, assessed_at)
                VALUES (:tid, :eid, :sid, 0, 100, NOW())
            """), {"tid": current_user.tenant_id, "eid": employee_id, "sid": skill_id})
            created += 1
        else:
            skipped += 1

    db.commit()
    return {
        "created": created,
        "skipped_existing": skipped,
        "total_from_level": len(lc_rows),
        "career_level_id": level_id,
    }

    return {"message": "Demande traitée"}