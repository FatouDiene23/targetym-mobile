"""
Endpoints IA pour le scoring de CVs et candidatures.
- POST /api/ai/score-cvs            : scoring en masse (preview, sans DB write)
- POST /api/ai/score-candidate/{id} : scorer + sauvegarder un candidat existant
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.cv_scoring_service import cv_scoring_service, build_job_description_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["IA Scoring"])


# ============================================================
# SCHEMAS
# ============================================================

class CVItem(BaseModel):
    cv_text: str
    filename: str = "CV"
    candidate_name: Optional[str] = None
    candidate_id: Optional[int] = None  # si déjà en DB


class BatchScoringRequest(BaseModel):
    job_posting_id: int
    candidates: List[CVItem]
    criteria: Optional[List[str]] = None  # critères personnalisés du recruteur


class SingleScoringRequest(BaseModel):
    cv_text: Optional[str] = None          # texte du CV si disponible
    criteria: Optional[List[str]] = None


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/score-cvs")
def score_cvs_batch(
    data: BatchScoringRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Scoring en masse : envoie une liste de CVs texte + une offre → retourne shortlist scorée.
    Ne sauvegarde PAS en DB (mode preview).
    Les candidat_id fournis permettront de lier aux candidatures via "Ajouter au Screening".
    """
    if not cv_scoring_service.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service de scoring IA non configuré (ANTHROPIC_API_KEY manquante).",
        )

    if not data.candidates:
        raise HTTPException(status_code=400, detail="Aucun CV fourni.")
    if len(data.candidates) > 30:
        raise HTTPException(status_code=400, detail="Maximum 30 CVs par lot.")

    # Récupérer l'offre d'emploi
    from app.models.recruitment import JobPosting
    job = db.query(JobPosting).filter(
        JobPosting.id == data.job_posting_id,
        JobPosting.tenant_id == current_user.tenant_id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre d'emploi introuvable.")

    job_description = build_job_description_text(job)

    candidates_input = [
        {
            "cv_text": item.cv_text,
            "filename": item.filename,
            "candidate_name": item.candidate_name or item.filename,
            "candidate_id": item.candidate_id,
        }
        for item in data.candidates
    ]

    results = cv_scoring_service.score_batch(
        job_description=job_description,
        candidates=candidates_input,
        criteria=data.criteria,
    )

    shortlist = [r for r in results if r.get("recommendation") == "shortlist"]
    to_review = [r for r in results if r.get("recommendation") == "to_review"]
    rejected = [r for r in results if r.get("recommendation") == "reject"]

    return {
        "job_title": job.title,
        "job_id": job.id,
        "total_scored": len(results),
        "shortlist_count": len(shortlist),
        "results": results,
        "summary": {
            "shortlist": len(shortlist),
            "to_review": len(to_review),
            "rejected": len(rejected),
        },
    }


@router.post("/score-candidate/{candidate_id}")
def score_candidate(
    candidate_id: int,
    data: SingleScoringRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Score un candidat existant par rapport à son offre liée (ou la première candidature active).
    Sauvegarde le résultat dans candidates.ai_score / ai_score_details / ai_analysis.
    """
    if not cv_scoring_service.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service de scoring IA non configuré (ANTHROPIC_API_KEY manquante).",
        )

    from sqlalchemy import text
    from app.models.recruitment import Candidate, CandidateApplication, JobPosting

    # Vérifier que le candidat appartient au tenant
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.tenant_id == current_user.tenant_id,
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidat introuvable.")

    # Trouver l'offre liée (première candidature active)
    app = db.query(CandidateApplication).filter(
        CandidateApplication.candidate_id == candidate_id,
        CandidateApplication.tenant_id == current_user.tenant_id,
    ).first()

    if not app:
        raise HTTPException(
            status_code=400,
            detail="Ce candidat n'est lié à aucune offre — impossible de scorer sans offre de référence.",
        )

    job = db.query(JobPosting).filter(JobPosting.id == app.job_posting_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Offre d'emploi liée introuvable.")

    job_description = build_job_description_text(job)

    result = cv_scoring_service.score_and_save_candidate(
        candidate_id=candidate_id,
        job_description=job_description,
        db=db,
        criteria=data.criteria,
        cv_text=data.cv_text,
    )

    return {
        "candidate_id": candidate_id,
        "job_title": job.title,
        "saved": True,
        **result,
    }


@router.post("/add-to-screening")
def add_scored_candidates_to_screening(
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ajoute les candidats sélectionnés depuis le batch scoring dans le pipeline (stage=screening).
    data = {job_posting_id: int, candidate_ids: [int]}
    """
    job_posting_id = data.get("job_posting_id")
    candidate_ids = data.get("candidate_ids", [])

    if not job_posting_id or not candidate_ids:
        raise HTTPException(status_code=400, detail="job_posting_id et candidate_ids requis.")

    from sqlalchemy import text
    from app.models.recruitment import CandidateApplication

    added, skipped = 0, 0
    for cid in candidate_ids:
        existing = db.query(CandidateApplication).filter(
            CandidateApplication.candidate_id == cid,
            CandidateApplication.job_posting_id == job_posting_id,
        ).first()
        if existing:
            # Passer en screening si c'est encore "new"
            if existing.stage == "new":
                existing.stage = "screening"
                added += 1
            else:
                skipped += 1
        else:
            new_app = CandidateApplication(
                tenant_id=current_user.tenant_id,
                candidate_id=cid,
                job_posting_id=job_posting_id,
                stage="screening",
            )
            db.add(new_app)
            added += 1

    db.commit()
    return {"added": added, "skipped": skipped, "total": len(candidate_ids)}


# ============================================================
# LEAVE / OKR ENDPOINTS
# ============================================================

@router.get("/leave-okr-impact")
def get_leave_okr_impact(
    employee_id: int,
    start_date: str,
    end_date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyse rapide (sans appel IA) des OKRs à risque pendant une période de congé.
    Appelé côté employé dès que les dates sont saisies dans le formulaire.

    Paramètres : employee_id, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
    """
    import datetime
    from app.services.leave_okr_service import analyze_leave_impact_employee

    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Utilisateur non associé à une entreprise.")

    try:
        start = datetime.date.fromisoformat(start_date)
        end = datetime.date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide (attendu YYYY-MM-DD).")

    if end < start:
        raise HTTPException(status_code=400, detail="La date de fin doit être après la date de début.")

    result = analyze_leave_impact_employee(
        employee_id=employee_id,
        start_date=start,
        end_date=end,
        db=db,
        tenant_id=current_user.tenant_id,
    )
    return result


@router.get("/leave-manager-suggestion/{leave_request_id}")
def get_leave_manager_suggestion(
    leave_request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Recommandation IA (Claude) pour le manager avant de valider / refuser un congé.
    Analyse les OKRs de l'employé sur la période demandée.
    """
    from app.services.leave_okr_service import get_manager_suggestion

    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Utilisateur non associé à une entreprise.")

    result = get_manager_suggestion(
        leave_request_id=leave_request_id,
        db=db,
        tenant_id=current_user.tenant_id,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Demande de congé introuvable.")

    return result
