# =============================================
# API ROUTES - Sanctions disciplinaires
# File: app/api/sanctions.py
# =============================================
"""
Endpoints pour la gestion des sanctions disciplinaires.
- Pas de modification après création (valeur juridique)
- Création : RH/Admin + Manager (pour son équipe)
- Suppression : RH/Admin uniquement (avant notification)
- Consultation : Employé (ses propres), Manager (son équipe), RH/Admin (toutes)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
import base64

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.sanction import Sanction
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/sanctions", tags=["Sanctions"])


# =============================================
# SCHEMAS
# =============================================

class SanctionCreate(BaseModel):
    employee_id: int
    type: str = Field(..., min_length=1, max_length=50)
    date: str  # ISO format
    reason: str = Field(..., min_length=1)
    notes: Optional[str] = None


class SanctionResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    type: str
    date: str
    reason: str
    notes: Optional[str] = None
    status: str
    issued_by: Optional[str] = None
    issued_by_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SanctionListResponse(BaseModel):
    items: List[SanctionResponse]
    total: int


# =============================================
# HELPERS
# =============================================

RH_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RH]
MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RH, UserRole.MANAGER]


def _sanction_to_response(s: Sanction, db: Session) -> SanctionResponse:
    """Convertit un Sanction ORM en SanctionResponse."""
    # Nom de l'employé
    emp = db.query(Employee).filter(Employee.id == s.employee_id).first()
    emp_name = f"{emp.first_name} {emp.last_name}" if emp else None

    # Nom de l'émetteur
    issuer = db.query(Employee).filter(Employee.id == s.issued_by_id).first()
    issuer_name = f"{issuer.first_name} {issuer.last_name}" if issuer else None

    return SanctionResponse(
        id=s.id,
        employee_id=s.employee_id,
        employee_name=emp_name,
        type=s.type,
        date=s.date.strftime("%Y-%m-%d") if s.date else "",
        reason=s.reason,
        notes=s.notes,
        status=s.status or "active",
        issued_by=issuer_name,
        issued_by_id=s.issued_by_id,
        created_at=s.created_at,
    )


# =============================================
# ROUTES
# =============================================

@router.get("", response_model=SanctionListResponse)
@router.get("/", response_model=SanctionListResponse, include_in_schema=False)
def list_sanctions(
    employee_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="active|cancelled"),
    search: Optional[str] = Query(None),
    mine: bool = Query(False, description="Si true, retourne uniquement mes propres sanctions"),
    team_only: bool = Query(False, description="Si true (manager), retourne uniquement l'équipe sans le manager"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste des sanctions (filtrable). RH/Admin voit tout, Manager voit son équipe."""
    query = db.query(Sanction).filter(Sanction.tenant_id == current_user.tenant_id)

    # Mode self-service : uniquement mes propres sanctions
    if mine:
        if not current_user.employee_id:
            return SanctionListResponse(items=[], total=0)
        query = query.filter(Sanction.employee_id == current_user.employee_id)
    # Filtrage par rôle
    elif current_user.role in RH_ROLES:
        pass  # RH/Admin/SuperAdmin : tout le tenant
    elif current_user.role == UserRole.MANAGER:
        # Manager : sanctions de son équipe directe (+ les siennes sauf si team_only)
        team_ids = db.query(Employee.id).filter(
            Employee.tenant_id == current_user.tenant_id,
            Employee.manager_id == current_user.employee_id
        ).all()
        team_ids = [t[0] for t in team_ids]
        if not team_only and current_user.employee_id:
            team_ids.append(current_user.employee_id)
        query = query.filter(Sanction.employee_id.in_(team_ids))
    else:
        # Employé (ou tout autre rôle) : ses propres sanctions uniquement
        if not current_user.employee_id:
            return SanctionListResponse(items=[], total=0)
        query = query.filter(Sanction.employee_id == current_user.employee_id)

    # Filtres optionnels
    if employee_id:
        query = query.filter(Sanction.employee_id == employee_id)
    if type:
        query = query.filter(Sanction.type == type)
    if status:
        query = query.filter(Sanction.status == status)
    if search:
        query = query.filter(Sanction.reason.ilike(f"%{search}%"))

    total = query.count()
    sanctions = query.order_by(desc(Sanction.date)).offset(skip).limit(limit).all()

    return SanctionListResponse(
        items=[_sanction_to_response(s, db) for s in sanctions],
        total=total,
    )


@router.get("/employee/{employee_id}", response_model=SanctionListResponse)
def get_employee_sanctions(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sanctions d'un employé spécifique (compatibilité avec EmployeeModal)."""
    # Vérifier accès
    if current_user.role == UserRole.EMPLOYEE:
        if current_user.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    elif current_user.role == UserRole.MANAGER:
        emp = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == current_user.tenant_id,
            Employee.manager_id == current_user.employee_id
        ).first()
        if not emp:
            raise HTTPException(status_code=403, detail="Cet employé n'est pas dans votre équipe")

    sanctions = db.query(Sanction).filter(
        Sanction.tenant_id == current_user.tenant_id,
        Sanction.employee_id == employee_id,
    ).order_by(desc(Sanction.date)).all()

    return SanctionListResponse(
        items=[_sanction_to_response(s, db) for s in sanctions],
        total=len(sanctions),
    )


@router.post("", response_model=SanctionResponse)
@router.post("/", response_model=SanctionResponse, include_in_schema=False)
async def create_sanction(
    employee_id: int = Form(...),
    type: str = Form(..., min_length=1, max_length=50),
    date: str = Form(...),
    reason: str = Form(..., min_length=1),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Créer une sanction. RH/Admin pour tout le monde, Manager pour son équipe."""
    # Vérifier permissions
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Permissions insuffisantes")

    # Vérifier que l'employé cible existe dans le même tenant
    target = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    # Manager : vérifier que c'est bien un membre de son équipe
    if current_user.role == UserRole.MANAGER:
        if target.manager_id != current_user.employee_id:
            raise HTTPException(status_code=403, detail="Cet employé n'est pas dans votre équipe")

    # Parser la date
    try:
        sanction_date = datetime.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide (ISO attendu)")

    # Lire le fichier joint si présent
    attachment_bytes: Optional[bytes] = None
    attachment_filename: Optional[str] = None
    if file and file.filename:
        MAX_SIZE = 10 * 1024 * 1024  # 10 MB
        attachment_bytes = await file.read(MAX_SIZE + 1)
        if len(attachment_bytes) > MAX_SIZE:
            raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")
        attachment_filename = file.filename

    sanction = Sanction(
        tenant_id=current_user.tenant_id,
        employee_id=employee_id,
        type=type,
        date=sanction_date,
        reason=reason,
        notes=notes,
        status="active",
        issued_by_id=current_user.employee_id,
    )
    db.add(sanction)
    db.commit()
    db.refresh(sanction)

    try:
        from app.services.email_service import send_sanction_notification_email
        if target.email:
            send_sanction_notification_email(
                to_email=target.email,
                first_name=target.first_name,
                sanction_type=type,
                sanction_date=sanction_date.strftime("%d/%m/%Y"),
                reason=reason,
                notes=notes,
                attachment_bytes=attachment_bytes,
                attachment_filename=attachment_filename,
            )
    except Exception as e:
        print(f"⚠️ Email sanction non envoyé: {e}")

    return _sanction_to_response(sanction, db)


@router.delete("/{sanction_id}")
def delete_sanction(
    sanction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprimer une sanction. RH/Admin uniquement."""
    if current_user.role not in RH_ROLES:
        raise HTTPException(status_code=403, detail="Seuls les RH/Admin peuvent supprimer une sanction")

    sanction = db.query(Sanction).filter(
        Sanction.id == sanction_id,
        Sanction.tenant_id == current_user.tenant_id,
    ).first()

    if not sanction:
        raise HTTPException(status_code=404, detail="Sanction non trouvée")

    db.delete(sanction)
    db.commit()

    return {"message": "Sanction supprimée", "id": sanction_id}


# =============================================
# POLITIQUE DES SANCTIONS (upload/download PDF)
# =============================================

MAX_POLICY_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_POLICY_EXTENSIONS = {'.pdf'}


@router.post("/policy/upload")
@router.post("/policy/upload/", include_in_schema=False)
async def upload_sanctions_policy(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload la politique des sanctions (PDF). RH/Admin uniquement. Remplace le document existant."""
    if current_user.role not in RH_ROLES:
        raise HTTPException(status_code=403, detail="Seuls les RH/Admin peuvent gérer la politique des sanctions")

    # Vérifier extension
    import os
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_POLICY_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")

    # Lire le contenu
    content = await file.read(MAX_POLICY_SIZE + 1)
    if len(content) > MAX_POLICY_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")

    file_b64 = base64.b64encode(content).decode('utf-8')

    # Créer la table si elle n'existe pas
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS sanctions_policy (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL UNIQUE,
            file_name VARCHAR(255) NOT NULL,
            file_data TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type VARCHAR(100) DEFAULT 'application/pdf',
            uploaded_by_id INTEGER,
            uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    db.commit()

    # Upsert: remplacer le document existant ou en créer un nouveau
    existing = db.execute(
        text("SELECT id FROM sanctions_policy WHERE tenant_id = :tid"),
        {"tid": current_user.tenant_id}
    ).fetchone()

    if existing:
        db.execute(text("""
            UPDATE sanctions_policy
            SET file_name = :fname, file_data = :fdata, file_size = :fsize,
                mime_type = :mime, uploaded_by_id = :uid, uploaded_at = NOW()
            WHERE tenant_id = :tid
        """), {
            "fname": file.filename,
            "fdata": file_b64,
            "fsize": len(content),
            "mime": file.content_type or "application/pdf",
            "uid": current_user.employee_id,
            "tid": current_user.tenant_id,
        })
    else:
        db.execute(text("""
            INSERT INTO sanctions_policy (tenant_id, file_name, file_data, file_size, mime_type, uploaded_by_id)
            VALUES (:tid, :fname, :fdata, :fsize, :mime, :uid)
        """), {
            "tid": current_user.tenant_id,
            "fname": file.filename,
            "fdata": file_b64,
            "fsize": len(content),
            "mime": file.content_type or "application/pdf",
            "uid": current_user.employee_id,
        })

    db.commit()
    return {"message": "Politique des sanctions mise à jour", "file_name": file.filename}


@router.get("/policy/download")
@router.get("/policy/download/", include_in_schema=False)
def download_sanctions_policy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Télécharger la politique des sanctions. Accessible à tous les employés du tenant."""
    # Vérifier que la table existe
    try:
        row = db.execute(
            text("SELECT file_name, file_data, file_size, mime_type, uploaded_at FROM sanctions_policy WHERE tenant_id = :tid"),
            {"tid": current_user.tenant_id}
        ).fetchone()
    except Exception:
        raise HTTPException(status_code=404, detail="Aucune politique des sanctions disponible")

    if not row:
        raise HTTPException(status_code=404, detail="Aucune politique des sanctions disponible")

    return {
        "file_name": row.file_name,
        "file_data": row.file_data,
        "file_size": row.file_size,
        "mime_type": row.mime_type,
        "uploaded_at": str(row.uploaded_at) if row.uploaded_at else None,
    }


@router.get("/policy/info")
@router.get("/policy/info/", include_in_schema=False)
def get_sanctions_policy_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Vérifier si une politique des sanctions existe (sans télécharger le contenu)."""
    try:
        row = db.execute(
            text("SELECT file_name, file_size, mime_type, uploaded_at FROM sanctions_policy WHERE tenant_id = :tid"),
            {"tid": current_user.tenant_id}
        ).fetchone()
    except Exception:
        return {"exists": False}

    if not row:
        return {"exists": False}

    return {
        "exists": True,
        "file_name": row.file_name,
        "file_size": row.file_size,
        "mime_type": row.mime_type,
        "uploaded_at": str(row.uploaded_at) if row.uploaded_at else None,
    }


@router.delete("/policy")
@router.delete("/policy/", include_in_schema=False)
def delete_sanctions_policy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprimer la politique des sanctions. RH/Admin uniquement."""
    if current_user.role not in RH_ROLES:
        raise HTTPException(status_code=403, detail="Seuls les RH/Admin peuvent supprimer la politique")

    try:
        result = db.execute(
            text("DELETE FROM sanctions_policy WHERE tenant_id = :tid"),
            {"tid": current_user.tenant_id}
        )
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Aucune politique à supprimer")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Aucune politique à supprimer")

    return {"message": "Politique des sanctions supprimée"}


# =============================================
# ROUTE LEGACY (compatibilité EmployeeModal)
# /api/employees/{id}/sanctions
# =============================================

legacy_router = APIRouter(prefix="/api/employees", tags=["Sanctions"])


@legacy_router.get("/{employee_id}/sanctions")
@legacy_router.get("/{employee_id}/sanctions/", include_in_schema=False)
def legacy_get_sanctions(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compatibilité avec le frontend EmployeeModal existant."""
    result = get_employee_sanctions(employee_id, db, current_user)
    # Le frontend attend un tableau ou {items: [...]}
    return result.items


@legacy_router.post("/{employee_id}/sanctions", response_model=SanctionResponse)
@legacy_router.post("/{employee_id}/sanctions/", response_model=SanctionResponse, include_in_schema=False)
def legacy_create_sanction(
    employee_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compatibilité avec le frontend EmployeeModal existant."""
    create_payload = SanctionCreate(
        employee_id=employee_id,
        type=payload.get("type", "Autre"),
        date=payload.get("date", datetime.now().isoformat()),
        reason=payload.get("reason", ""),
        notes=payload.get("notes"),
    )
    return create_sanction(create_payload, db, current_user)


@legacy_router.delete("/{employee_id}/sanctions/{sanction_id}")
@legacy_router.delete("/{employee_id}/sanctions/{sanction_id}/", include_in_schema=False)
def legacy_delete_sanction(
    employee_id: int,
    sanction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compatibilité avec le frontend EmployeeModal existant."""
    return delete_sanction(sanction_id, db, current_user)
