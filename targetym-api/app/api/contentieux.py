"""
Module Contentieux & Précontentieux — API endpoints.
"""

import uuid
from datetime import date
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_tenant
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.tenant import Tenant
from app.schemas.contentieux import (
    LaborDisputeCreate,
    LaborDisputeUpdate,
    LaborDisputeResponse,
    LaborDisputeDetailResponse,
    LaborDisputeListResponse,
    DisputeStageChangeRequest,
    DisputeStageHistoryResponse,
    DisputeAudienceCreate,
    DisputeAudienceUpdate,
    DisputeAudienceResponse,
    DisputeDocumentResponse,
    DisputeNotificationsConfigUpdate,
    DisputeNotificationsConfigResponse,
)

router = APIRouter(prefix="/api/contentieux", tags=["Contentieux"])

# ── S3 config ────────────────────────────────────────────────────────────────

AWS_S3_BUCKET_LEGAL = "targetym-legal-docs"
AWS_REGION = "eu-west-1"


def _get_s3_client():
    return boto3.client("s3", region_name=AWS_REGION)


# ── Accès helper ─────────────────────────────────────────────────────────────

CONTENTIEUX_ROLES = [UserRole.RH, UserRole.ADMIN, UserRole.DG, UserRole.SUPER_ADMIN]


def require_contentieux_access(current_user: User, db: Session) -> User:
    """Vérifie accès Contentieux : rôle RH/Admin/DG/Super ou is_juriste."""
    if current_user.role in CONTENTIEUX_ROLES:
        return current_user

    # Vérifier is_juriste sur l'employé lié
    if current_user.employee_id:
        employee = db.query(Employee).filter(
            Employee.id == current_user.employee_id
        ).first()
        if employee and employee.is_juriste:
            return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Accès réservé aux rôles RH, Admin, DG ou juristes",
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_name(db: Session, model, record_id: Optional[int]) -> Optional[str]:
    """Résout le nom complet depuis Employee ou User."""
    if not record_id:
        return None
    record = db.query(model).filter(model.id == record_id).first()
    if not record:
        return None
    if hasattr(record, "first_name"):
        return f"{record.first_name} {record.last_name}"
    return None


def _dispute_to_response(row, db: Session) -> dict:
    """Convertit un row SQL en dict pour LaborDisputeResponse."""
    data = {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "employee_id": row.employee_id,
        "reference_number": row.reference_number,
        "title": row.title,
        "description": row.description,
        "current_stage": row.current_stage,
        "status": row.status,
        "opened_date": row.opened_date,
        "closed_date": row.closed_date,
        "created_by_id": row.created_by_id,
        "assigned_to_id": row.assigned_to_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
    data["employee_name"] = _resolve_name(db, Employee, row.employee_id)
    data["created_by_name"] = _resolve_name(db, User, row.created_by_id)
    data["assigned_to_name"] = _resolve_name(db, Employee, row.assigned_to_id)
    return data


def _stage_history_to_response(row, db: Session) -> dict:
    return {
        "id": row.id,
        "stage": row.stage,
        "started_at": row.started_at,
        "notes": row.notes,
        "created_by_id": row.created_by_id,
        "created_by_name": _resolve_name(db, User, row.created_by_id),
        "created_at": row.created_at,
    }


def _audience_to_response(row, db: Session) -> dict:
    return {
        "id": row.id,
        "dispute_id": row.dispute_id,
        "audience_date": row.audience_date,
        "audience_type": row.audience_type,
        "location": row.location,
        "notes": row.notes,
        "result": row.result,
        "next_audience_date": row.next_audience_date,
        "created_by_id": row.created_by_id,
        "created_by_name": _resolve_name(db, User, row.created_by_id),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _document_to_response(row, db: Session) -> dict:
    return {
        "id": row.id,
        "dispute_id": row.dispute_id,
        "filename": row.filename,
        "file_size": row.file_size,
        "mime_type": row.mime_type,
        "uploaded_by_id": row.uploaded_by_id,
        "uploaded_by_name": _resolve_name(db, User, row.uploaded_by_id),
        "created_at": row.created_at,
    }


def _get_dispute_or_404(db: Session, dispute_id: int, tenant_id: int):
    """Récupère un dossier contentieux ou lève 404."""
    row = db.execute(
        text("SELECT * FROM labor_disputes WHERE id = :id AND tenant_id = :tid"),
        {"id": dispute_id, "tid": tenant_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Dossier contentieux introuvable")
    return row


# ══════════════════════════════════════════════════════════════════════════════
# DOSSIERS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/notifications-config", response_model=DisputeNotificationsConfigResponse)
def get_notifications_config(
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Config notifications du tenant (route statique AVANT /{id})."""
    require_contentieux_access(current_user, db)

    row = db.execute(
        text("SELECT * FROM dispute_notifications_config WHERE tenant_id = :tid"),
        {"tid": tenant.id},
    ).mappings().first()

    if not row:
        # Créer la config par défaut
        db.execute(
            text("""
                INSERT INTO dispute_notifications_config (tenant_id)
                VALUES (:tid)
            """),
            {"tid": tenant.id},
        )
        db.commit()
        row = db.execute(
            text("SELECT * FROM dispute_notifications_config WHERE tenant_id = :tid"),
            {"tid": tenant.id},
        ).mappings().first()

    return dict(row)


@router.put("/notifications-config", response_model=DisputeNotificationsConfigResponse)
def update_notifications_config(
    data: DisputeNotificationsConfigUpdate,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Mettre à jour la config notifications."""
    require_contentieux_access(current_user, db)

    # Upsert
    existing = db.execute(
        text("SELECT id FROM dispute_notifications_config WHERE tenant_id = :tid"),
        {"tid": tenant.id},
    ).first()

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    if not existing:
        db.execute(
            text("INSERT INTO dispute_notifications_config (tenant_id) VALUES (:tid)"),
            {"tid": tenant.id},
        )
        db.commit()

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["tid"] = tenant.id
    db.execute(
        text(f"UPDATE dispute_notifications_config SET {set_clauses}, updated_at = now() WHERE tenant_id = :tid"),
        updates,
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM dispute_notifications_config WHERE tenant_id = :tid"),
        {"tid": tenant.id},
    ).mappings().first()
    return dict(row)


@router.get("/", response_model=LaborDisputeListResponse)
def list_disputes(
    status_filter: Optional[str] = Query(None, alias="status"),
    stage: Optional[str] = None,
    employee_id: Optional[int] = None,
    assigned_to_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Liste des dossiers contentieux avec filtres et pagination."""
    require_contentieux_access(current_user, db)

    conditions = ["tenant_id = :tid"]
    params: dict = {"tid": tenant.id}

    if status_filter:
        conditions.append("status = :status")
        params["status"] = status_filter
    if stage:
        conditions.append("current_stage = :stage")
        params["stage"] = stage
    if employee_id:
        conditions.append("employee_id = :eid")
        params["eid"] = employee_id
    if assigned_to_id:
        conditions.append("assigned_to_id = :aid")
        params["aid"] = assigned_to_id
    if search:
        conditions.append("(title ILIKE :search OR reference_number ILIKE :search)")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)

    total = db.execute(
        text(f"SELECT COUNT(*) FROM labor_disputes WHERE {where}"), params
    ).scalar()

    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    rows = db.execute(
        text(f"""
            SELECT * FROM labor_disputes
            WHERE {where}
            ORDER BY opened_date DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).mappings().all()

    total_pages = (total + page_size - 1) // page_size
    items = [_dispute_to_response(r, db) for r in rows]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post("/", response_model=LaborDisputeResponse, status_code=201)
def create_dispute(
    data: LaborDisputeCreate,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Créer un nouveau dossier contentieux."""
    require_contentieux_access(current_user, db)

    # Vérifier que l'employé existe dans le tenant
    emp = db.query(Employee).filter(
        Employee.id == data.employee_id, Employee.tenant_id == tenant.id
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    # Vérifier unicité référence
    existing = db.execute(
        text("""
            SELECT id FROM labor_disputes
            WHERE tenant_id = :tid AND reference_number = :ref
        """),
        {"tid": tenant.id, "ref": data.reference_number},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Numéro de référence déjà utilisé")

    # Vérifier assigned_to si fourni
    if data.assigned_to_id:
        assigned = db.query(Employee).filter(
            Employee.id == data.assigned_to_id, Employee.tenant_id == tenant.id
        ).first()
        if not assigned:
            raise HTTPException(status_code=404, detail="Employé assigné introuvable")

    result = db.execute(
        text("""
            INSERT INTO labor_disputes
                (tenant_id, employee_id, reference_number, title, description,
                 opened_date, assigned_to_id, created_by_id)
            VALUES
                (:tid, :eid, :ref, :title, :desc, :opened, :aid, :cid)
            RETURNING *
        """),
        {
            "tid": tenant.id,
            "eid": data.employee_id,
            "ref": data.reference_number,
            "title": data.title,
            "desc": data.description,
            "opened": data.opened_date,
            "aid": data.assigned_to_id,
            "cid": current_user.id,
        },
    ).mappings().first()
    db.commit()

    # Créer l'entrée initiale dans l'historique
    db.execute(
        text("""
            INSERT INTO dispute_stages_history
                (tenant_id, dispute_id, stage, notes, created_by_id)
            VALUES
                (:tid, :did, 'convocation_it', 'Ouverture du dossier', :cid)
        """),
        {"tid": tenant.id, "did": result["id"], "cid": current_user.id},
    )
    db.commit()

    return _dispute_to_response(result, db)


@router.get("/{dispute_id}", response_model=LaborDisputeDetailResponse)
def get_dispute(
    dispute_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Détail complet d'un dossier (historique, audiences, documents)."""
    require_contentieux_access(current_user, db)
    row = _get_dispute_or_404(db, dispute_id, tenant.id)

    data = _dispute_to_response(row, db)

    # Historique
    stages = db.execute(
        text("""
            SELECT * FROM dispute_stages_history
            WHERE dispute_id = :did AND tenant_id = :tid
            ORDER BY started_at DESC
        """),
        {"did": dispute_id, "tid": tenant.id},
    ).mappings().all()
    data["stages_history"] = [_stage_history_to_response(s, db) for s in stages]

    # Audiences
    audiences = db.execute(
        text("""
            SELECT * FROM dispute_audiences
            WHERE dispute_id = :did AND tenant_id = :tid
            ORDER BY audience_date DESC
        """),
        {"did": dispute_id, "tid": tenant.id},
    ).mappings().all()
    data["audiences"] = [_audience_to_response(a, db) for a in audiences]

    # Documents
    docs = db.execute(
        text("""
            SELECT * FROM dispute_documents
            WHERE dispute_id = :did AND tenant_id = :tid
            ORDER BY created_at DESC
        """),
        {"did": dispute_id, "tid": tenant.id},
    ).mappings().all()
    data["documents"] = [_document_to_response(d, db) for d in docs]

    return data


@router.put("/{dispute_id}", response_model=LaborDisputeResponse)
def update_dispute(
    dispute_id: int,
    data: LaborDisputeUpdate,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Modifier un dossier (titre, description, assigned_to_id)."""
    require_contentieux_access(current_user, db)
    _get_dispute_or_404(db, dispute_id, tenant.id)

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    if "assigned_to_id" in updates and updates["assigned_to_id"]:
        assigned = db.query(Employee).filter(
            Employee.id == updates["assigned_to_id"], Employee.tenant_id == tenant.id
        ).first()
        if not assigned:
            raise HTTPException(status_code=404, detail="Employé assigné introuvable")

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["did"] = dispute_id
    updates["tid"] = tenant.id
    db.execute(
        text(f"UPDATE labor_disputes SET {set_clauses}, updated_at = now() WHERE id = :did AND tenant_id = :tid"),
        updates,
    )
    db.commit()

    row = _get_dispute_or_404(db, dispute_id, tenant.id)
    return _dispute_to_response(row, db)


@router.post("/{dispute_id}/change-stage", response_model=LaborDisputeResponse)
def change_stage(
    dispute_id: int,
    data: DisputeStageChangeRequest,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Changer l'étape d'un dossier + créer entrée historique."""
    require_contentieux_access(current_user, db)
    _get_dispute_or_404(db, dispute_id, tenant.id)

    new_stage = data.stage.value

    # Déterminer le nouveau status
    if new_stage == "accord_amiable":
        new_status = "clos_accord"
        closed = date.today()
    elif new_stage == "cloture":
        new_status = "clos_jugement"
        closed = date.today()
    else:
        new_status = "en_cours"
        closed = None

    db.execute(
        text("""
            UPDATE labor_disputes
            SET current_stage = :stage, status = :status, closed_date = :closed, updated_at = now()
            WHERE id = :did AND tenant_id = :tid
        """),
        {
            "stage": new_stage,
            "status": new_status,
            "closed": closed,
            "did": dispute_id,
            "tid": tenant.id,
        },
    )

    # Historique
    db.execute(
        text("""
            INSERT INTO dispute_stages_history
                (tenant_id, dispute_id, stage, notes, created_by_id)
            VALUES (:tid, :did, :stage, :notes, :cid)
        """),
        {
            "tid": tenant.id,
            "did": dispute_id,
            "stage": new_stage,
            "notes": data.notes,
            "cid": current_user.id,
        },
    )
    db.commit()

    row = _get_dispute_or_404(db, dispute_id, tenant.id)
    return _dispute_to_response(row, db)


# ══════════════════════════════════════════════════════════════════════════════
# AUDIENCES
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/{dispute_id}/audiences", response_model=list[DisputeAudienceResponse])
def list_audiences(
    dispute_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Liste des audiences d'un dossier."""
    require_contentieux_access(current_user, db)
    _get_dispute_or_404(db, dispute_id, tenant.id)

    rows = db.execute(
        text("""
            SELECT * FROM dispute_audiences
            WHERE dispute_id = :did AND tenant_id = :tid
            ORDER BY audience_date DESC
        """),
        {"did": dispute_id, "tid": tenant.id},
    ).mappings().all()

    return [_audience_to_response(r, db) for r in rows]


@router.post("/{dispute_id}/audiences", response_model=DisputeAudienceResponse, status_code=201)
def create_audience(
    dispute_id: int,
    data: DisputeAudienceCreate,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Planifier une audience."""
    require_contentieux_access(current_user, db)
    _get_dispute_or_404(db, dispute_id, tenant.id)

    row = db.execute(
        text("""
            INSERT INTO dispute_audiences
                (tenant_id, dispute_id, audience_date, audience_type,
                 location, notes, result, next_audience_date, created_by_id)
            VALUES
                (:tid, :did, :adate, :atype, :loc, :notes, :result, :next, :cid)
            RETURNING *
        """),
        {
            "tid": tenant.id,
            "did": dispute_id,
            "adate": data.audience_date,
            "atype": data.audience_type.value,
            "loc": data.location,
            "notes": data.notes,
            "result": data.result,
            "next": data.next_audience_date,
            "cid": current_user.id,
        },
    ).mappings().first()
    db.commit()

    return _audience_to_response(row, db)


@router.put("/{dispute_id}/audiences/{audience_id}", response_model=DisputeAudienceResponse)
def update_audience(
    dispute_id: int,
    audience_id: int,
    data: DisputeAudienceUpdate,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Modifier une audience."""
    require_contentieux_access(current_user, db)
    _get_dispute_or_404(db, dispute_id, tenant.id)

    existing = db.execute(
        text("""
            SELECT id FROM dispute_audiences
            WHERE id = :aid AND dispute_id = :did AND tenant_id = :tid
        """),
        {"aid": audience_id, "did": dispute_id, "tid": tenant.id},
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Audience introuvable")

    updates = {}
    dump = data.model_dump()
    for k, v in dump.items():
        if v is not None:
            if k == "audience_type":
                updates[k] = v.value if hasattr(v, "value") else v
            else:
                updates[k] = v

    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["aid"] = audience_id
    updates["did"] = dispute_id
    updates["tid"] = tenant.id
    db.execute(
        text(f"""
            UPDATE dispute_audiences
            SET {set_clauses}, updated_at = now()
            WHERE id = :aid AND dispute_id = :did AND tenant_id = :tid
        """),
        updates,
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM dispute_audiences WHERE id = :aid AND tenant_id = :tid"),
        {"aid": audience_id, "tid": tenant.id},
    ).mappings().first()
    return _audience_to_response(row, db)


@router.delete("/{dispute_id}/audiences/{audience_id}", status_code=204)
def delete_audience(
    dispute_id: int,
    audience_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Supprimer une audience."""
    require_contentieux_access(current_user, db)

    result = db.execute(
        text("""
            DELETE FROM dispute_audiences
            WHERE id = :aid AND dispute_id = :did AND tenant_id = :tid
        """),
        {"aid": audience_id, "did": dispute_id, "tid": tenant.id},
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Audience introuvable")


# ══════════════════════════════════════════════════════════════════════════════
# DOCUMENTS S3
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/{dispute_id}/documents", response_model=list[DisputeDocumentResponse])
def list_documents(
    dispute_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Liste des documents d'un dossier."""
    require_contentieux_access(current_user, db)
    _get_dispute_or_404(db, dispute_id, tenant.id)

    rows = db.execute(
        text("""
            SELECT * FROM dispute_documents
            WHERE dispute_id = :did AND tenant_id = :tid
            ORDER BY created_at DESC
        """),
        {"did": dispute_id, "tid": tenant.id},
    ).mappings().all()

    return [_document_to_response(r, db) for r in rows]


@router.post("/{dispute_id}/documents", response_model=DisputeDocumentResponse, status_code=201)
async def upload_document(
    dispute_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Upload un document vers S3 et enregistrer les métadonnées."""
    require_contentieux_access(current_user, db)
    _get_dispute_or_404(db, dispute_id, tenant.id)

    contents = await file.read()
    file_size = len(contents)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Le fichier est vide")

    # Clé S3 : {tenant_id}/{dispute_id}/{uuid}_{filename}
    s3_key = f"{tenant.id}/{dispute_id}/{uuid.uuid4()}_{file.filename}"

    try:
        s3 = _get_s3_client()
        s3.put_object(
            Bucket=AWS_S3_BUCKET_LEGAL,
            Key=s3_key,
            Body=contents,
            ContentType=file.content_type or "application/octet-stream",
        )
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur upload S3 : {e.response['Error']['Message']}",
        )

    row = db.execute(
        text("""
            INSERT INTO dispute_documents
                (tenant_id, dispute_id, filename, s3_key, file_size, mime_type, uploaded_by_id)
            VALUES
                (:tid, :did, :fname, :s3key, :fsize, :mime, :uid)
            RETURNING *
        """),
        {
            "tid": tenant.id,
            "did": dispute_id,
            "fname": file.filename,
            "s3key": s3_key,
            "fsize": file_size,
            "mime": file.content_type or "application/octet-stream",
            "uid": current_user.id,
        },
    ).mappings().first()
    db.commit()

    return _document_to_response(row, db)


@router.delete("/{dispute_id}/documents/{doc_id}", status_code=204)
def delete_document(
    dispute_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Supprimer un document (S3 + DB)."""
    require_contentieux_access(current_user, db)

    row = db.execute(
        text("""
            SELECT * FROM dispute_documents
            WHERE id = :doc_id AND dispute_id = :did AND tenant_id = :tid
        """),
        {"doc_id": doc_id, "did": dispute_id, "tid": tenant.id},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable")

    # Supprimer de S3
    try:
        s3 = _get_s3_client()
        s3.delete_object(Bucket=AWS_S3_BUCKET_LEGAL, Key=row["s3_key"])
    except ClientError:
        pass  # Continuer même si S3 échoue (le fichier peut déjà avoir été supprimé)

    db.execute(
        text("DELETE FROM dispute_documents WHERE id = :doc_id AND tenant_id = :tid"),
        {"doc_id": doc_id, "tid": tenant.id},
    )
    db.commit()


@router.get("/{dispute_id}/documents/{doc_id}/download")
def download_document(
    dispute_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Générer une presigned URL S3 (expire 1h)."""
    require_contentieux_access(current_user, db)

    row = db.execute(
        text("""
            SELECT * FROM dispute_documents
            WHERE id = :doc_id AND dispute_id = :did AND tenant_id = :tid
        """),
        {"doc_id": doc_id, "did": dispute_id, "tid": tenant.id},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable")

    try:
        s3 = _get_s3_client()
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": AWS_S3_BUCKET_LEGAL, "Key": row["s3_key"]},
            ExpiresIn=3600,  # 1 heure
        )
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur génération URL : {e.response['Error']['Message']}",
        )

    return {"download_url": url, "filename": row["filename"], "expires_in": 3600}
