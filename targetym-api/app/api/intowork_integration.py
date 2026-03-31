"""
API Routes pour l'intégration IntoWork ↔ Targetym
Gestion de la liaison de comptes entre les deux plateformes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import os
import re
import logging

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.tenant import Tenant
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations/intowork", tags=["Intégration IntoWork"])

_raw_intowork_url = os.getenv("INTOWORK_API_URL", "") or ""
_url_match = re.search(r'https?://[^\s]+', _raw_intowork_url)
INTOWORK_API_BASE_URL = _url_match.group(0).rstrip('/') if _url_match else "https://intowork-dashboard-production-1ede.up.railway.app"


# ========================================
# Schemas
# ========================================

class IntoWorkLinkRequest(BaseModel):
    intowork_company_id: int
    intowork_api_key: str


class IntoWorkLinkResponse(BaseModel):
    linked: bool
    intowork_company_id: int
    linked_at: str
    message: str


class VerifyKeyRequest(BaseModel):
    """
    Appelé par IntoWork pour vérifier une clé API Targetym.
    Pas d'authentification requise — la clé elle-même est la preuve.
    """
    tenant_id: int
    api_key: str
    intowork_company_id: int  # Pour que Targetym enregistre la liaison côté retour


class VerifyKeyResponse(BaseModel):
    valid: bool
    tenant_name: Optional[str] = None


class ApiKeyResponse(BaseModel):
    api_key_preview: str  # Premiers 8 carac + ****
    has_key: bool


# ========================================
# Endpoints
# ========================================

@router.post("/api-key/generate")
def generate_targetym_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Génère (ou régénère) la clé API Targetym pour ce tenant.
    Cette clé est copiée dans IntoWork lors de la liaison.
    """
    import secrets
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    new_key = secrets.token_urlsafe(32)
    tenant.targetym_api_key = new_key
    db.commit()

    logger.info(f"Clé API Targetym générée pour le tenant {tenant.id}")
    return {"api_key": new_key, "message": "Clé générée. Copiez-la dans IntoWork lors de la liaison."}


@router.get("/api-key", response_model=ApiKeyResponse)
def get_targetym_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retourne un aperçu masqué de la clé API Targetym du tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    if not tenant.targetym_api_key:
        return ApiKeyResponse(api_key_preview="", has_key=False)

    preview = tenant.targetym_api_key[:8] + "****"
    return ApiKeyResponse(api_key_preview=preview, has_key=True)


@router.post("/verify-key", response_model=VerifyKeyResponse)
def verify_intowork_key(
    body: VerifyKeyRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint appelé par IntoWork pour vérifier la clé API d'un tenant Targetym.
    Vérifie contre `tenant.targetym_api_key` en base — plus d'env var nécessaire.
    Si la clé est valide, enregistre également la liaison côté Targetym.
    """
    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant or not tenant.is_active:
        return VerifyKeyResponse(valid=False)

    # Vérification en base de données (plus de variable d'env)
    if not tenant.targetym_api_key or body.api_key.strip() != tenant.targetym_api_key.strip():
        logger.warning(f"Clé API invalide pour le tenant {body.tenant_id}")
        return VerifyKeyResponse(valid=False)

    # Enregistrer la liaison côté Targetym
    tenant.intowork_company_id = body.intowork_company_id
    tenant.intowork_linked_at = datetime.utcnow()
    db.commit()

    logger.info(f"Tenant {tenant.id} lié à la Company IntoWork {body.intowork_company_id}")

    return VerifyKeyResponse(valid=True, tenant_name=tenant.name)


@router.post("/link", response_model=IntoWorkLinkResponse)
def link_intowork_account(
    body: IntoWorkLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lier le tenant Targetym à un compte entreprise IntoWork.
    """
    import httpx

    try:
        # Récupérer le tenant de l'utilisateur
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant introuvable")

        # Vérifier la clé API auprès d'IntoWork (best-effort)
        try:
            resp = httpx.post(
                f"{INTOWORK_API_BASE_URL}/api/integrations/targetym/verify-key",
                json={
                    "company_id": body.intowork_company_id,
                    "api_key": body.intowork_api_key,
                    "targetym_tenant_id": current_user.tenant_id,
                },
                timeout=10.0
            )
            if resp.status_code != 200 or not resp.json().get("valid"):
                raise HTTPException(
                    status_code=400,
                    detail="Clé API IntoWork invalide ou Company introuvable"
                )
        except httpx.RequestError as e:
            logger.warning(f"IntoWork injoignable pour verify-key: {e} — liaison sauvegardée quand même")
            # Si IntoWork injoignable mais clé déjà vérifiée (sens inverse déjà fait), on continue

        # Sauvegarder la liaison (idempotent)
        now = datetime.utcnow()
        tenant.intowork_company_id = body.intowork_company_id
        tenant.intowork_api_key = body.intowork_api_key
        tenant.intowork_linked_at = now
        db.commit()

        logger.info(f"Tenant {tenant.id} lié à la Company IntoWork {body.intowork_company_id}")

        return IntoWorkLinkResponse(
            linked=True,
            intowork_company_id=body.intowork_company_id,
            linked_at=now.isoformat(),
            message="Compte IntoWork lié avec succès"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Erreur inattendue dans link_intowork_account: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")


@router.delete("/unlink")
def unlink_intowork_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Délier le tenant Targetym du compte IntoWork."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    if not tenant.intowork_company_id:
        raise HTTPException(status_code=400, detail="Aucun compte IntoWork lié")

    tenant.intowork_company_id = None
    tenant.intowork_api_key = None
    tenant.intowork_linked_at = None
    db.commit()

    return {"message": "Compte IntoWork délié avec succès"}


@router.get("/status")
def get_intowork_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retourne le statut de la liaison avec IntoWork pour le tenant courant."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    if not tenant.intowork_company_id:
        return {"linked": False}

    return {
        "linked": True,
        "intowork_company_id": tenant.intowork_company_id,
        "linked_at": tenant.intowork_linked_at.isoformat() if tenant.intowork_linked_at else None,
    }


# ========================================
# Sync manuel : Pousser tous les jobs actifs vers IntoWork
# ========================================

@router.post("/sync-jobs")
def sync_jobs_to_intowork(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pousse tous les jobs actifs du tenant vers IntoWork (sync manuelle)."""
    from app.models.recruitment import JobPosting
    import requests as req

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    if not tenant.intowork_company_id or not tenant.intowork_api_key:
        raise HTTPException(status_code=400, detail="Compte IntoWork non lié")

    raw_url = os.getenv("INTOWORK_API_URL", "") or ""
    _m = re.search(r'https?://[^\s]+', raw_url)
    intowork_url = _m.group(0).rstrip('/') if _m else "https://intowork-dashboard-production-1ede.up.railway.app"

    jobs = db.query(JobPosting).filter(
        JobPosting.tenant_id == tenant.id,
        JobPosting.status == "active"
    ).all()

    remote_map = {"onsite": "on_site", "remote": "remote", "hybrid": "hybrid"}
    contract_map = {
        "cdi": "full_time", "cdd": "contract", "stage": "internship",
        "alternance": "contract", "freelance": "contract",
        "temps_partiel": "part_time", "interim": "temporary",
    }

    synced, failed = 0, 0
    for job in jobs:
        payload = {
            "company_id": tenant.intowork_company_id,
            "api_key": tenant.intowork_api_key,
            "targetym_tenant_id": tenant.id,
            "job": {
                "targetym_job_posting_id": job.id,
                "title": job.title,
                "description": job.description or "",
                "location": job.location or "",
                "location_type": remote_map.get((job.remote_policy or "onsite").lower(), "on_site"),
                "job_type": contract_map.get((job.contract_type or "cdi").lower(), "full_time"),
                "salary_min": float(job.salary_min) if job.salary_min else None,
                "salary_max": float(job.salary_max) if job.salary_max else None,
            },
        }
        try:
            r = req.post(
                f"{intowork_url}/api/integrations/targetym/webhook/sync-job",
                json=payload, timeout=10,
                headers={"Content-Type": "application/json"}
            )
            if r.ok:
                synced += 1
                logger.info(f"Job {job.id} '{job.title}' synchronisé vers IntoWork ({r.status_code})")
            else:
                failed += 1
                logger.warning(f"Job {job.id} — IntoWork répondu {r.status_code}: {r.text[:200]}")
        except Exception as e:
            failed += 1
            logger.error(f"Job {job.id} — Erreur sync: {e}")

    return {"synced": synced, "failed": failed, "total": len(jobs)}


# ========================================
# Webhook : Candidat IntoWork accepté → Employé Targetym
# ========================================

class NewEmployeeWebhookPayload(BaseModel):
    tenant_id: int
    api_key: str
    employee: dict  # first_name, last_name, email, phone, location, position, ...


@router.post("/webhook/new-employee")
def webhook_new_employee(
    body: NewEmployeeWebhookPayload,
    db: Session = Depends(get_db)
):
    """
    Webhook appelé par IntoWork quand un candidat est accepté (status = accepted).
    Crée automatiquement un employé dans le tenant Targetym correspondant.
    Authentification par clé API (même mécanisme que verify-key).
    """
    from app.models.employee import Employee, EmployeeStatus, ContractType
    import os

    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant or not tenant.is_active:
        return {"created": False, "reason": "tenant_not_found"}

    # Vérifier la clé API contre la base de données
    if not tenant.targetym_api_key or body.api_key.strip() != tenant.targetym_api_key.strip():
        logger.warning(f"Clé API invalide dans webhook new-employee pour tenant {body.tenant_id} — reçu: {body.api_key[:8] if body.api_key else 'None'}... stocké: {tenant.targetym_api_key[:8] if tenant.targetym_api_key else 'None'}...")
        return {"created": False, "reason": "invalid_key"}

    emp_data = body.employee
    email = emp_data.get("email", "")

    # Vérifier doublon par email dans le tenant
    existing = db.query(Employee).filter(
        Employee.email == email,
        Employee.tenant_id == tenant.id
    ).first()

    if existing:
        logger.info(f"Employé {email} déjà existant dans tenant {tenant.id} — mis à jour")
        existing.status = EmployeeStatus.ACTIVE
        db.commit()
        return {"created": False, "existing_employee_id": existing.id, "updated": True}

    # Créer l'employé
    new_employee = Employee(
        tenant_id=tenant.id,
        first_name=emp_data.get("first_name", ""),
        last_name=emp_data.get("last_name", ""),
        email=email,
        phone=emp_data.get("phone"),
        address=emp_data.get("location"),
        job_title=emp_data.get("position"),
        status=EmployeeStatus.ACTIVE,
        contract_type=ContractType.CDI,
        employee_id=f"IW-{emp_data.get('intowork_application_id', '')}",
    )
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)

    logger.info(
        f"✅ Employé créé depuis IntoWork : {email} dans tenant {tenant.id} (employee_id={new_employee.id})"
    )

    return {
        "created": True,
        "employee_id": new_employee.id,
        "employee_email": email,
    }


# ========================================
# Webhook : Candidature IntoWork → Candidature Targetym
# ========================================

class NewApplicationWebhookPayload(BaseModel):
    tenant_id: int
    api_key: str
    application: dict  # targetym_job_posting_id, first_name, last_name, email, phone, cover_letter, cv_url, source, intowork_application_id


@router.post("/webhook/new-application")
def webhook_new_application(
    body: NewApplicationWebhookPayload,
    db: Session = Depends(get_db)
):
    """
    Webhook appelé par IntoWork quand un candidat postule à une offre synchronisée.
    Crée (ou retrouve) le candidat et crée une candidature dans le pipeline Targetym.
    """
    from app.models.recruitment import JobPosting, Candidate, CandidateApplication

    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant or not tenant.is_active:
        return {"created": False, "reason": "tenant_not_found"}

    if not tenant.targetym_api_key or body.api_key.strip() != tenant.targetym_api_key.strip():
        logger.warning(
            f"Clé API invalide dans webhook new-application pour tenant {body.tenant_id} — "
            f"reçu: {body.api_key[:8] if body.api_key else 'None'}... "
            f"stocké: {tenant.targetym_api_key[:8] if tenant.targetym_api_key else 'None'}..."
        )
        return {"created": False, "reason": "invalid_key"}

    app_data = body.application
    targetym_job_id = app_data.get("targetym_job_posting_id")

    # Retrouver l'offre Targetym
    job_posting = db.query(JobPosting).filter(
        JobPosting.id == targetym_job_id,
        JobPosting.tenant_id == tenant.id
    ).first()
    if not job_posting:
        logger.warning(f"JobPosting {targetym_job_id} introuvable pour tenant {tenant.id}")
        return {"created": False, "reason": "job_posting_not_found"}

    email = app_data.get("email", "").lower().strip()

    # Retrouver ou créer le candidat (scope tenant)
    candidate = db.query(Candidate).filter(
        Candidate.email == email,
        Candidate.tenant_id == tenant.id
    ).first()

    if not candidate:
        candidate = Candidate(
            tenant_id=tenant.id,
            first_name=app_data.get("first_name", ""),
            last_name=app_data.get("last_name", ""),
            email=email,
            phone=app_data.get("phone"),
            cv_url=app_data.get("cv_url"),
            source="IntoWork",
            source_details=f"IntoWork application #{app_data.get('intowork_application_id', '')}",
        )
        db.add(candidate)
        db.flush()  # pour avoir candidate.id
        logger.info(f"Candidat créé depuis IntoWork : {email} dans tenant {tenant.id}")
    else:
        # Mettre à jour le CV si disponible
        if app_data.get("cv_url"):
            candidate.cv_url = app_data.get("cv_url")
        logger.info(f"Candidat existant retrouvé : {email} dans tenant {tenant.id}")

    # Vérifier doublon de candidature
    existing_app = db.query(CandidateApplication).filter(
        CandidateApplication.candidate_id == candidate.id,
        CandidateApplication.job_posting_id == job_posting.id
    ).first()

    if existing_app:
        db.commit()
        return {"created": False, "reason": "already_applied", "application_id": existing_app.id}

    # Créer la candidature dans le pipeline
    new_app = CandidateApplication(
        tenant_id=tenant.id,
        candidate_id=candidate.id,
        job_posting_id=job_posting.id,
        stage="new",
        intowork_application_id=app_data.get("intowork_application_id"),
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    logger.info(
        f"✅ Candidature créée depuis IntoWork : {email} → JobPosting #{targetym_job_id} "
        f"(application_id={new_app.id})"
    )

    # ── Scoring IA automatique ────────────────────────────────────────────
    # On score le candidat dès l'import IntoWork pour que le recruteur
    # voit directement le badge de score dans le kanban.
    try:
        from app.services.cv_scoring_service import cv_scoring_service, build_job_description_text
        if cv_scoring_service.is_enabled():
            job_desc = build_job_description_text(job_posting)
            # cv_text optionnel : on utilise l'URL du CV si disponible comme indicateur
            cv_text = None
            if app_data.get("cv_url"):
                cv_text = f"CV disponible : {app_data['cv_url']}"
            cv_scoring_service.score_and_save_candidate(
                candidate_id=candidate.id,
                job_description=job_desc,
                db=db,
                cv_text=cv_text,
            )
            logger.info(f"🤖 Score IA calculé pour candidat {candidate.id} (IntoWork import)")
    except Exception as e:
        logger.warning(f"Scoring IA IntoWork échoué (non bloquant) : {e}")
    # ─────────────────────────────────────────────────────────────────────

    return {
        "created": True,
        "application_id": new_app.id,
        "candidate_id": candidate.id,
        "candidate_email": email,
    }


# ── Mapping statuts IntoWork → stages Targetym ────────────────────────────────
INTOWORK_STATUS_TO_STAGE: dict = {
    "applied":     "new",
    "pending":     "new",
    "viewed":      "screening",
    "shortlisted": "screening",
    "interview":   "hr_interview",
    "accepted":    "hired",
    "rejected":    "rejected",
}


class UpdateApplicationStagePayload(BaseModel):
    tenant_id: int
    api_key: str
    intowork_application_id: int
    intowork_status: str  # le statut côté IntoWork


@router.put("/webhook/update-application-stage")
def webhook_update_application_stage(
    body: UpdateApplicationStagePayload,
    db: Session = Depends(get_db)
):
    """
    Reçoit une mise à jour de statut depuis IntoWork et met à jour
    le stage de la candidature dans le Kanban Targetym.
    """
    # Vérifier le tenant
    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        return {"updated": False, "reason": "tenant_not_found"}

    if not tenant.targetym_api_key or body.api_key.strip() != tenant.targetym_api_key.strip():
        logger.warning(
            f"Clé API invalide dans webhook update-stage pour tenant {body.tenant_id}"
        )
        return {"updated": False, "reason": "invalid_key"}

    # Retrouver la candidature par intowork_application_id + tenant
    application = db.query(CandidateApplication).filter(
        CandidateApplication.intowork_application_id == body.intowork_application_id,
        CandidateApplication.tenant_id == body.tenant_id,
    ).first()

    if not application:
        logger.warning(
            f"Candidature IntoWork #{body.intowork_application_id} introuvable "
            f"pour tenant {body.tenant_id}"
        )
        return {"updated": False, "reason": "application_not_found"}

    # Mapper le statut IntoWork vers le stage Targetym
    new_stage = INTOWORK_STATUS_TO_STAGE.get(body.intowork_status.lower())
    if not new_stage:
        return {"updated": False, "reason": f"unknown_status: {body.intowork_status}"}

    old_stage = application.stage
    application.stage = new_stage
    db.commit()

    logger.info(
        f"✅ Stage mis à jour depuis IntoWork : application #{application.id} "
        f"{old_stage} → {new_stage} (intowork_status={body.intowork_status})"
    )

    return {
        "updated": True,
        "application_id": application.id,
        "old_stage": old_stage,
        "new_stage": new_stage,
    }
