"""
Employee Documents API Router
==============================
Gestion des documents employés : upload, liste, téléchargement, suppression.
Stockage en base64 dans la colonne file_data de la table employee_documents.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import base64
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_DOCUMENTS

router = APIRouter(prefix="/api/documents", tags=["documents"], dependencies=[Depends(require_feature(FEATURE_DOCUMENTS))])

MANAGER_ROLES = ['admin', 'rh', 'manager', 'dg']

# Types que l'employé peut uploader lui-même
EMPLOYEE_UPLOAD_TYPES = ['cni', 'passeport', 'diplome', 'cv', 'photo_identite', 'rib', 'certificat_residence']

# Types réservés à la RH
HR_ONLY_TYPES = ['contrat_travail', 'avenant', 'fiche_paie', 'certificat_travail', 'attestation_employeur', 'lettre_motivation', 'carte_vitale', 'permis_conduire', 'autre']

# Sécurité upload
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx', '.odt', '.ods'}

def is_hr_or_admin(role: str) -> bool:
    return role and role.lower() in ['admin', 'rh', 'dg']

def get_employee_id_from_user(user_id: int, db: Session) -> Optional[int]:
    row = db.execute(
        text("SELECT e.id FROM employees e JOIN users u ON LOWER(e.email) = LOWER(u.email) WHERE u.id = :uid"),
        {"uid": user_id}
    ).fetchone()
    return row[0] if row else None


# ============================================
# GET /api/documents/employee/{employee_id} — Documents d'un employé (vue RH)
# ============================================
@router.get("/employee/{employee_id}")
async def get_employee_documents(
    employee_id: int,
    document_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Liste des documents d'un employé (vue RH/Manager)."""
    user_id = current_user.id
    tenant_id = current_user.tenant_id
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()

    # Vérifier que l'employé appartient au même tenant
    emp_check = db.execute(text(
        "SELECT id FROM employees WHERE id = :eid AND tenant_id = :tid"
    ), {"eid": employee_id, "tid": tenant_id}).fetchone()
    if not emp_check:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    # Vérifier les droits : RH/Admin ou manager de l'employé
    if not is_hr_or_admin(role):
        my_emp_id = get_employee_id_from_user(int(user_id), db)
        if my_emp_id:
            is_manager = db.execute(text(
                "SELECT 1 FROM employees WHERE id = :eid AND manager_id = :mid AND tenant_id = :tid"
            ), {"eid": employee_id, "mid": my_emp_id, "tid": tenant_id}).fetchone()
            if not is_manager:
                raise HTTPException(status_code=403, detail="Accès non autorisé")
        else:
            raise HTTPException(status_code=403, detail="Accès non autorisé")

    conditions = ["ed.employee_id = :employee_id", "ed.tenant_id = :tenant_id"]
    params: dict = {"employee_id": employee_id, "tenant_id": tenant_id}

    if document_type:
        conditions.append("ed.document_type = :doc_type")
        params["doc_type"] = document_type

    where = " AND ".join(conditions)

    rows = db.execute(text(f"""
        SELECT ed.id, ed.document_type, ed.title, ed.description,
               ed.file_name, ed.file_size, ed.mime_type,
               ed.document_date, ed.expiry_date,
               ed.visible_to_employee, ed.is_confidential,
               ed.uploaded_by, ed.created_at,
               u.email as uploaded_by_email
        FROM employee_documents ed
        LEFT JOIN users u ON u.id = ed.uploaded_by
        WHERE {where}
        ORDER BY ed.created_at DESC
    """), params).fetchall()

    return [
        {
            "id": r.id,
            "document_type": r.document_type,
            "title": r.title,
            "description": r.description,
            "file_name": r.file_name,
            "file_size": r.file_size,
            "mime_type": r.mime_type,
            "document_date": r.document_date.isoformat() if r.document_date else None,
            "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
            "visible_to_employee": r.visible_to_employee,
            "is_confidential": r.is_confidential,
            "uploaded_by_email": r.uploaded_by_email,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ============================================
# GET /api/documents/my-documents — Mes documents (vue employé)
# ============================================
@router.get("/my-documents")
async def get_my_documents(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Liste des documents visibles par l'employé connecté."""
    user_id = current_user.id
    emp_id = get_employee_id_from_user(int(user_id), db)
    if not emp_id:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    rows = db.execute(text("""
        SELECT ed.id, ed.document_type, ed.title, ed.description,
               ed.file_name, ed.file_size, ed.mime_type,
               ed.document_date, ed.expiry_date, ed.created_at
        FROM employee_documents ed
        WHERE ed.employee_id = :eid 
        AND ed.visible_to_employee = true
        ORDER BY ed.created_at DESC
    """), {"eid": emp_id}).fetchall()

    return [
        {
            "id": r.id,
            "document_type": r.document_type,
            "title": r.title,
            "description": r.description,
            "file_name": r.file_name,
            "file_size": r.file_size,
            "mime_type": r.mime_type,
            "document_date": r.document_date.isoformat() if r.document_date else None,
            "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ============================================
# POST /api/documents/upload — Upload un document
# ============================================
@router.post("/upload")
async def upload_document(
    employee_id: int = Form(...),
    document_type: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    document_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    visible_to_employee: bool = Form(True),
    is_confidential: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Upload un document pour un employé."""
    user_id = current_user.id
    tenant_id = current_user.tenant_id
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()
    my_emp_id = get_employee_id_from_user(int(user_id), db)

    # Vérifier que l'employee_id cible appartient au même tenant
    emp_check = db.execute(text(
        "SELECT id FROM employees WHERE id = :eid AND tenant_id = :tid"
    ), {"eid": employee_id, "tid": tenant_id}).fetchone()
    if not emp_check:
        raise HTTPException(status_code=403, detail="Employé non trouvé dans votre organisation")

    # Permissions:
    # - RH/Admin: peut uploader tous types pour tout employé
    # - Employé: peut uploader uniquement EMPLOYEE_UPLOAD_TYPES pour lui-même
    if not is_hr_or_admin(role):
        if document_type not in EMPLOYEE_UPLOAD_TYPES:
            raise HTTPException(status_code=403, detail=f"Vous ne pouvez pas uploader ce type de document. Types autorisés: {', '.join(EMPLOYEE_UPLOAD_TYPES)}")
        if my_emp_id != employee_id:
            raise HTTPException(status_code=403, detail="Vous ne pouvez uploader des documents que pour vous-même")

    # Validation extension fichier
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Extension non autorisée ({ext}). Formats acceptés : PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, ODT, ODS")

    # Lire le fichier avec limite de taille
    content = await file.read(MAX_FILE_SIZE_BYTES + 1)
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (maximum 10 MB)")
    file_b64 = base64.b64encode(content).decode('utf-8')
    file_size = len(content)
    mime_type = file.content_type or 'application/octet-stream'

    result = db.execute(text("""
        INSERT INTO employee_documents (
            tenant_id, employee_id, document_type, title, description,
            file_name, file_url, file_data, file_size, mime_type,
            document_date, expiry_date, visible_to_employee, is_confidential,
            uploaded_by, created_at
        ) VALUES (
            :tenant_id, :employee_id, :document_type, :title, :description,
            :file_name, :file_url, :file_data, :file_size, :mime_type,
            :document_date, :expiry_date, :visible_to_employee, :is_confidential,
            :uploaded_by, NOW()
        )
        RETURNING id
    """), {
        "tenant_id": tenant_id,
        "employee_id": employee_id,
        "document_type": document_type,
        "title": title,
        "description": description,
        "file_name": file.filename,
        "file_url": f"/api/documents/download/{employee_id}",
        "file_data": file_b64,
        "file_size": file_size,
        "mime_type": mime_type,
        "document_date": document_date if document_date else None,
        "expiry_date": expiry_date if expiry_date else None,
        "visible_to_employee": visible_to_employee,
        "is_confidential": is_confidential,
        "uploaded_by": int(user_id),
    }).fetchone()

    db.commit()
    doc_id = result.id

    # Mettre à jour file_url avec l'ID correct
    db.execute(text(
        "UPDATE employee_documents SET file_url = :url WHERE id = :id AND tenant_id = :tid"
    ), {"url": f"/api/documents/download/{doc_id}", "id": doc_id, "tid": tenant_id})
    db.commit()

    # --- Notifications ---
    try:
        emp_row = db.execute(text(
            "SELECT u.id as user_id, e.first_name, e.last_name FROM employees e LEFT JOIN users u ON LOWER(e.email) = LOWER(u.email) WHERE e.id = :eid AND e.tenant_id = :tid"
        ), {"eid": employee_id, "tid": tenant_id}).fetchone()

        doc_type_labels = {
            'contrat_travail': 'Contrat de travail', 'avenant': 'Avenant',
            'cni': 'Carte d\'identité', 'passeport': 'Passeport',
            'diplome': 'Diplôme', 'cv': 'CV', 'attestation_employeur': 'Attestation',
            'fiche_paie': 'Fiche de paie', 'certificat_travail': 'Certificat de travail',
            'rib': 'RIB', 'photo_identite': 'Photo d\'identité',
            'certificat_residence': 'Certificat de résidence', 'autre': 'Document'
        }
        label = doc_type_labels.get(document_type, 'Document')
        emp_name = f"{emp_row.first_name} {emp_row.last_name}" if emp_row else "Employé"

        if is_hr_or_admin(role):
            # RH a uploadé → notifier l'employé
            if emp_row and emp_row.user_id:
                db.execute(text("""
                    INSERT INTO notifications (tenant_id, user_id, employee_id, title, message, type, priority, reference_type, reference_id, action_url)
                    VALUES (:tid, :uid, :eid, :title, :message, 'document_uploaded', 'normal', 'document', :doc_id, '/dashboard/my-space/documents')
                """), {
                    "tid": tenant_id, "uid": emp_row.user_id, "eid": employee_id,
                    "title": "📄 Nouveau document ajouté",
                    "message": f"{label} : {title}",
                    "doc_id": doc_id,
                })
                db.commit()
        else:
            # Employé a uploadé → notifier les RH du même tenant
            hr_users = db.execute(text("""
                SELECT id FROM users WHERE tenant_id = :tid AND LOWER(role::text) IN ('admin', 'rh', 'dg') AND is_active = true
            """), {"tid": tenant_id}).fetchall()
            for hr in hr_users:
                db.execute(text("""
                    INSERT INTO notifications (tenant_id, user_id, employee_id, title, message, type, priority, reference_type, reference_id, action_url)
                    VALUES (:tid, :uid, :eid, :title, :message, 'document_uploaded', 'normal', 'document', :doc_id, '/dashboard/employees')
                """), {
                    "tid": tenant_id, "uid": hr.id, "eid": employee_id,
                    "title": "📄 Document uploadé par un employé",
                    "message": f"{emp_name} a ajouté : {label} - {title}",
                    "doc_id": doc_id,
                })
            db.commit()
    except Exception as e:
        print(f"[WARN] Notification failed: {e}")

    return {"success": True, "id": doc_id, "file_name": file.filename}


# ============================================
# GET /api/documents/download/{doc_id} — Télécharger un document
# ============================================
@router.get("/download/{doc_id}")
async def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Télécharger un document (retourne base64)."""
    user_id = current_user.id
    tenant_id = current_user.tenant_id
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()

    row = db.execute(text("""
        SELECT ed.*, u.id as emp_user_id
        FROM employee_documents ed
        JOIN employees e ON e.id = ed.employee_id
        LEFT JOIN users u ON LOWER(e.email) = LOWER(u.email)
        WHERE ed.id = :doc_id AND ed.tenant_id = :tid
    """), {"doc_id": doc_id, "tid": tenant_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Accès : RH/Admin ou l'employé lui-même (si visible)
    if not is_hr_or_admin(role):
        if str(row.emp_user_id) != str(user_id):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
        if not row.visible_to_employee:
            raise HTTPException(status_code=403, detail="Document non accessible")

    # Log download
    try:
        emp_id = get_employee_id_from_user(int(user_id), db)
        db.execute(text("""
            INSERT INTO download_history (tenant_id, user_id, employee_id, document_type, document_id, document_title, file_name)
            VALUES (:tid, :uid, :eid, 'employee_document', :doc_id, :title, :fname)
        """), {
            "tid": tenant_id, "uid": int(user_id), "eid": emp_id,
            "doc_id": doc_id, "title": row.title, "fname": row.file_name
        })
        db.commit()
    except Exception:
        pass

    return {
        "id": row.id,
        "file_name": row.file_name,
        "mime_type": row.mime_type,
        "file_size": row.file_size,
        "file_data": row.file_data,  # base64
    }


# ============================================
# DELETE /api/documents/{doc_id} — Supprimer un document
# ============================================
@router.delete("/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Supprimer un document (RH/Admin ou employé propriétaire pour docs personnels)."""
    user_id = current_user.id
    tenant_id = current_user.tenant_id
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()

    # Vérifier que le document existe et appartient au tenant
    doc = db.execute(text("""
        SELECT ed.id, ed.employee_id, ed.document_type, ed.uploaded_by
        FROM employee_documents ed
        WHERE ed.id = :doc_id AND ed.tenant_id = :tid
    """), {"doc_id": doc_id, "tid": tenant_id}).fetchone()

    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if not is_hr_or_admin(role):
        # Employé : peut supprimer uniquement ses propres documents personnels
        my_emp_id = get_employee_id_from_user(int(user_id), db)
        if doc.employee_id != my_emp_id:
            raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres documents")
        if doc.document_type not in EMPLOYEE_UPLOAD_TYPES:
            raise HTTPException(status_code=403, detail="Vous ne pouvez pas supprimer ce type de document")

    db.execute(text("DELETE FROM employee_documents WHERE id = :doc_id AND tenant_id = :tid"), {"doc_id": doc_id, "tid": tenant_id})
    db.commit()
    return {"success": True, "deleted": doc_id}


# ============================================
# GET /api/documents/download-history — Historique des téléchargements
# ============================================
@router.get("/download-history")
async def get_download_history(
    employee_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Historique des téléchargements."""
    user_id = current_user.id
    tenant_id = current_user.tenant_id
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()

    conditions = ["dh.tenant_id = :tid"]
    params: dict = {"tid": tenant_id}

    if not is_hr_or_admin(role):
        conditions.append("dh.user_id = :uid")
        params["uid"] = int(user_id)
    elif employee_id:
        conditions.append("dh.employee_id = :eid")
        params["eid"] = employee_id

    where = "WHERE " + " AND ".join(conditions)
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    total = db.execute(text(f"SELECT COUNT(*) FROM download_history dh {where}"), params).scalar()

    rows = db.execute(text(f"""
        SELECT dh.*, u.email as user_email
        FROM download_history dh
        LEFT JOIN users u ON u.id = dh.user_id
        {where}
        ORDER BY dh.downloaded_at DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    return {
        "items": [
            {
                "id": r.id,
                "document_type": r.document_type,
                "document_title": r.document_title,
                "file_name": r.file_name,
                "user_email": r.user_email,
                "downloaded_at": r.downloaded_at.isoformat() if r.downloaded_at else None,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ============================================
# GET /api/documents/all — Tous les documents (vue RH globale)
# ============================================
@router.get("/all")
async def get_all_documents(
    document_type: Optional[str] = None,
    employee_id: Optional[int] = None,
    search: Optional[str] = None,
    expired_only: bool = False,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Liste de tous les documents (RH/Admin uniquement)."""
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()
    if not is_hr_or_admin(role):
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/Admin")

    tenant_id = current_user.tenant_id
    conditions = ["ed.tenant_id = :tenant_id"]
    params: dict = {"tenant_id": tenant_id}

    if document_type:
        conditions.append("ed.document_type = :doc_type")
        params["doc_type"] = document_type
    if employee_id:
        conditions.append("ed.employee_id = :emp_id")
        params["emp_id"] = employee_id
    if search:
        conditions.append("(LOWER(ed.title) LIKE :search OR LOWER(e.first_name || ' ' || e.last_name) LIKE :search OR LOWER(ed.file_name) LIKE :search)")
        params["search"] = f"%{search.lower()}%"
    if expired_only:
        conditions.append("ed.expiry_date IS NOT NULL AND ed.expiry_date < CURRENT_DATE")

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    # Count
    count_row = db.execute(text(f"""
        SELECT COUNT(*) FROM employee_documents ed
        JOIN employees e ON e.id = ed.employee_id
        WHERE {where}
    """), params).fetchone()
    total = count_row[0] if count_row else 0

    # Data
    rows = db.execute(text(f"""
        SELECT ed.id, ed.document_type, ed.title, ed.description,
               ed.file_name, ed.file_size, ed.mime_type,
               ed.document_date, ed.expiry_date,
               ed.visible_to_employee, ed.is_confidential,
               ed.uploaded_by, ed.created_at,
               ed.employee_id,
               e.first_name as emp_first_name, e.last_name as emp_last_name,
               e.job_title as emp_job_title, e.department_id,
               u.email as uploaded_by_email
        FROM employee_documents ed
        JOIN employees e ON e.id = ed.employee_id
        LEFT JOIN users u ON u.id = ed.uploaded_by
        WHERE {where}
        ORDER BY ed.created_at DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": page_size, "offset": offset}).fetchall()

    return {
        "items": [
            {
                "id": r.id, "document_type": r.document_type, "title": r.title,
                "description": r.description, "file_name": r.file_name,
                "file_size": r.file_size, "mime_type": r.mime_type,
                "document_date": str(r.document_date) if r.document_date else None,
                "expiry_date": str(r.expiry_date) if r.expiry_date else None,
                "visible_to_employee": r.visible_to_employee, "is_confidential": r.is_confidential,
                "created_at": str(r.created_at) if r.created_at else None,
                "uploaded_by_email": r.uploaded_by_email,
                "employee_id": r.employee_id,
                "employee_name": f"{r.emp_first_name} {r.emp_last_name}",
                "employee_job_title": r.emp_job_title,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }


# ============================================
# GET /api/documents/stats — Statistiques documents (vue RH)
# ============================================
@router.get("/stats")
async def get_document_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Statistiques globales des documents (RH/Admin)."""
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()
    if not is_hr_or_admin(role):
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/Admin")

    tid = current_user.tenant_id

    # Total documents
    total = db.execute(text("SELECT COUNT(*) FROM employee_documents WHERE tenant_id = :tid"), {"tid": tid}).fetchone()[0]

    # Par type
    by_type = db.execute(text("""
        SELECT document_type, COUNT(*) as count
        FROM employee_documents
        WHERE tenant_id = :tid
        GROUP BY document_type
        ORDER BY count DESC
    """), {"tid": tid}).fetchall()

    # Documents expirés
    expired = db.execute(text("""
        SELECT COUNT(*) FROM employee_documents
        WHERE tenant_id = :tid AND expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE
    """), {"tid": tid}).fetchone()[0]

    # Expirent dans 30 jours
    expiring_soon = db.execute(text("""
        SELECT COUNT(*) FROM employee_documents
        WHERE tenant_id = :tid AND expiry_date IS NOT NULL
        AND expiry_date >= CURRENT_DATE
        AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    """), {"tid": tid}).fetchone()[0]

    # Total employés actifs
    total_employees = db.execute(text("""
        SELECT COUNT(*) FROM employees WHERE tenant_id = :tid AND LOWER(status) = 'active'
    """), {"tid": tid}).fetchone()[0]

    # Employés sans aucun document
    employees_no_docs = db.execute(text("""
        SELECT COUNT(*) FROM employees e
        WHERE e.tenant_id = :tid AND LOWER(e.status) = 'active'
        AND NOT EXISTS (SELECT 1 FROM employee_documents ed WHERE ed.employee_id = e.id AND ed.tenant_id = :tid)
    """), {"tid": tid}).fetchone()[0]

    # Employés sans contrat
    employees_no_contract = db.execute(text("""
        SELECT COUNT(*) FROM employees e
        WHERE e.tenant_id = :tid AND LOWER(e.status) = 'active'
        AND NOT EXISTS (
            SELECT 1 FROM employee_documents ed
            WHERE ed.employee_id = e.id AND ed.tenant_id = :tid AND ed.document_type = 'contrat_travail'
        )
    """), {"tid": tid}).fetchone()[0]

    # Uploadés ce mois
    this_month = db.execute(text("""
        SELECT COUNT(*) FROM employee_documents
        WHERE tenant_id = :tid AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    """), {"tid": tid}).fetchone()[0]

    return {
        "total_documents": total,
        "by_type": [{"type": r.document_type, "count": r.count} for r in by_type],
        "expired": expired,
        "expiring_soon": expiring_soon,
        "total_employees": total_employees,
        "employees_no_docs": employees_no_docs,
        "employees_no_contract": employees_no_contract,
        "uploaded_this_month": this_month,
    }


# ============================================
# GET /api/documents/alerts — Alertes documents (vue RH)
# ============================================
@router.get("/alerts")
async def get_document_alerts(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Alertes : documents expirés, expirant bientôt, dossiers incomplets."""
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role or "").lower()
    if not is_hr_or_admin(role):
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/Admin")

    tid = current_user.tenant_id
    alerts = []

    # Documents expirés
    expired_rows = db.execute(text("""
        SELECT ed.id, ed.document_type, ed.title, ed.expiry_date,
               ed.employee_id, e.first_name, e.last_name
        FROM employee_documents ed
        JOIN employees e ON e.id = ed.employee_id
        WHERE ed.tenant_id = :tid AND ed.expiry_date IS NOT NULL AND ed.expiry_date < CURRENT_DATE
        ORDER BY ed.expiry_date ASC
        LIMIT 20
    """), {"tid": tid}).fetchall()
    for r in expired_rows:
        alerts.append({
            "type": "expired", "severity": "high",
            "title": f"{r.title} expiré",
            "message": f"Document de {r.first_name} {r.last_name} expiré le {r.expiry_date}",
            "employee_id": r.employee_id, "employee_name": f"{r.first_name} {r.last_name}",
            "document_id": r.id, "document_type": r.document_type,
            "date": str(r.expiry_date),
        })

    # Documents expirant dans 30 jours
    expiring_rows = db.execute(text("""
        SELECT ed.id, ed.document_type, ed.title, ed.expiry_date,
               ed.employee_id, e.first_name, e.last_name
        FROM employee_documents ed
        JOIN employees e ON e.id = ed.employee_id
        WHERE ed.tenant_id = :tid AND ed.expiry_date IS NOT NULL
        AND ed.expiry_date >= CURRENT_DATE
        AND ed.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY ed.expiry_date ASC
        LIMIT 20
    """), {"tid": tid}).fetchall()
    for r in expiring_rows:
        alerts.append({
            "type": "expiring_soon", "severity": "medium",
            "title": f"{r.title} expire bientôt",
            "message": f"Document de {r.first_name} {r.last_name} expire le {r.expiry_date}",
            "employee_id": r.employee_id, "employee_name": f"{r.first_name} {r.last_name}",
            "document_id": r.id, "document_type": r.document_type,
            "date": str(r.expiry_date),
        })

    # Employés sans contrat
    no_contract = db.execute(text("""
        SELECT e.id, e.first_name, e.last_name, e.job_title
        FROM employees e
        WHERE e.tenant_id = :tid AND LOWER(e.status) = 'active'
        AND NOT EXISTS (
            SELECT 1 FROM employee_documents ed
            WHERE ed.employee_id = e.id AND ed.tenant_id = :tid AND ed.document_type = 'contrat_travail'
        )
        LIMIT 20
    """), {"tid": tid}).fetchall()
    for r in no_contract:
        alerts.append({
            "type": "missing_contract", "severity": "high",
            "title": "Contrat manquant",
            "message": f"{r.first_name} {r.last_name} ({r.job_title or 'N/A'}) n'a pas de contrat",
            "employee_id": r.id, "employee_name": f"{r.first_name} {r.last_name}",
            "document_id": None, "document_type": "contrat_travail",
            "date": None,
        })

    # Employés sans aucun document
    no_docs = db.execute(text("""
        SELECT e.id, e.first_name, e.last_name, e.job_title
        FROM employees e
        WHERE e.tenant_id = :tid AND LOWER(e.status) = 'active'
        AND NOT EXISTS (SELECT 1 FROM employee_documents ed WHERE ed.employee_id = e.id AND ed.tenant_id = :tid)
        LIMIT 20
    """), {"tid": tid}).fetchall()
    for r in no_docs:
        alerts.append({
            "type": "no_documents", "severity": "medium",
            "title": "Dossier vide",
            "message": f"{r.first_name} {r.last_name} n'a aucun document",
            "employee_id": r.id, "employee_name": f"{r.first_name} {r.last_name}",
            "document_id": None, "document_type": None,
            "date": None,
        })

    return {"alerts": alerts, "total": len(alerts)}


# ============================================
# GET /api/documents/types — Liste des types de documents
# ============================================
@router.get("/types")
async def get_document_types():
    """Retourne la liste des types de documents disponibles avec flag employee_uploadable."""
    return [
        {"value": "contrat_travail", "label": "Contrat de travail", "icon": "📝", "employee_uploadable": False},
        {"value": "avenant", "label": "Avenant", "icon": "📋", "employee_uploadable": False},
        {"value": "cni", "label": "Carte nationale d'identité", "icon": "🪪", "employee_uploadable": True},
        {"value": "passeport", "label": "Passeport", "icon": "🛂", "employee_uploadable": True},
        {"value": "diplome", "label": "Diplôme", "icon": "🎓", "employee_uploadable": True},
        {"value": "cv", "label": "CV", "icon": "📄", "employee_uploadable": True},
        {"value": "lettre_motivation", "label": "Lettre de motivation", "icon": "✉️", "employee_uploadable": False},
        {"value": "attestation_employeur", "label": "Attestation employeur", "icon": "📑", "employee_uploadable": False},
        {"value": "fiche_paie", "label": "Fiche de paie", "icon": "💰", "employee_uploadable": False},
        {"value": "certificat_travail", "label": "Certificat de travail", "icon": "🏅", "employee_uploadable": False},
        {"value": "rib", "label": "RIB", "icon": "🏦", "employee_uploadable": True},
        {"value": "carte_vitale", "label": "Carte vitale / Assurance", "icon": "🏥", "employee_uploadable": False},
        {"value": "permis_conduire", "label": "Permis de conduire", "icon": "🚗", "employee_uploadable": False},
        {"value": "photo_identite", "label": "Photo d'identité", "icon": "📸", "employee_uploadable": True},
        {"value": "certificat_residence", "label": "Certificat de résidence", "icon": "🏠", "employee_uploadable": True},
        {"value": "autre", "label": "Autre document", "icon": "📁", "employee_uploadable": False},
    ]