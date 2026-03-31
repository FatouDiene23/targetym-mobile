"""
Service d'analyse d'impact congé / OKR.

Fonctions :
  - get_employee_okrs_for_period   : retourne les OKRs actifs d'un employé sur une période
  - analyze_leave_impact_employee  : alerte rapide (sans IA) pour le formulaire employé
  - get_manager_suggestion         : recommandation IA via Claude pour le manager
"""
import datetime
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.okr import Objective, KeyResult
from app.models.leave import LeaveRequest

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _calc_progress(objective: Objective) -> float:
    """Average progress across key results (0-100)."""
    krs = objective.key_results
    if not krs:
        return 0.0
    pcts = []
    for kr in krs:
        if kr.target and kr.target > 0:
            pcts.append(min(float(kr.current or 0) / float(kr.target) * 100, 100))
        else:
            pcts.append(0.0)
    return round(sum(pcts) / len(pcts), 1)


def get_employee_okrs_for_period(
    employee_id: int,
    start_date: datetime.date,
    end_date: datetime.date,
    db: Session,
    tenant_id: int,
) -> list:
    """
    Retourne les OKRs actifs de l'employé dont la deadline n'est pas encore passée
    à la date de début du congé (ou dont la deadline tombe pendant le congé).
    Filtre : progress < 80 % (= non terminé, à risque).
    """
    objectives = (
        db.query(Objective)
        .filter(
            Objective.owner_id == employee_id,
            Objective.tenant_id == tenant_id,
            Objective.status != "closed",
        )
        .all()
    )

    at_risk = []
    today = datetime.date.today()

    for obj in objectives:
        # Ignorer les objectifs dont la deadline est passée avant le début du congé
        if obj.end_date and obj.end_date < start_date:
            continue

        progress = _calc_progress(obj)

        # Garder uniquement les objectifs pas encore terminés
        if progress >= 100:
            continue

        kr_details = []
        for kr in (obj.key_results or []):
            t = float(kr.target or 0)
            c = float(kr.current or 0)
            pct = round(min(c / t * 100, 100), 1) if t > 0 else 0.0
            kr_details.append(
                {
                    "title": kr.title,
                    "progress": pct,
                    "current": c,
                    "target": t,
                }
            )

        days_until_deadline = (
            (obj.end_date - today).days if obj.end_date else None
        )
        deadline_during_leave = bool(
            obj.end_date and start_date <= obj.end_date <= end_date
        )

        at_risk.append(
            {
                "id": obj.id,
                "title": obj.title,
                "period": obj.period,
                "end_date": obj.end_date.isoformat() if obj.end_date else None,
                "progress": progress,
                "deadline_during_leave": deadline_during_leave,
                "days_until_deadline": days_until_deadline,
                "key_results": kr_details,
            }
        )

    return at_risk


def analyze_leave_impact_employee(
    employee_id: int,
    start_date: datetime.date,
    end_date: datetime.date,
    db: Session,
    tenant_id: int,
) -> dict:
    """
    Analyse rapide (sans appel IA) pour l'alerte côté employé.
    Retournée dès que les dates sont saisies dans le formulaire de demande.
    """
    at_risk = get_employee_okrs_for_period(
        employee_id, start_date, end_date, db, tenant_id
    )

    if not at_risk:
        return {
            "has_okrs": False,
            "okrs_at_risk": [],
            "warning_level": "none",
            "message": None,
        }

    critical = [o for o in at_risk if o["deadline_during_leave"]]

    if critical:
        warning_level = "high"
        msg = (
            f"⚠️ {len(critical)} objectif(s) arrive(nt) à échéance "
            f"pendant votre congé. Pensez à avancer ces travaux ou à "
            f"déléguer avant votre départ."
        )
    elif len(at_risk) >= 2:
        warning_level = "medium"
        msg = (
            f"Vous avez {len(at_risk)} OKR(s) en cours (avancement < 100 %). "
            f"Anticipez leur progression avant votre absence."
        )
    else:
        warning_level = "low"
        msg = (
            "Vous avez 1 OKR en cours. Votre absence pourrait légèrement "
            "retarder sa progression."
        )

    return {
        "has_okrs": True,
        "okrs_at_risk": at_risk,
        "warning_level": warning_level,
        "message": msg,
    }


def get_manager_suggestion(
    leave_request_id: int,
    db: Session,
    tenant_id: int,
) -> Optional[dict]:
    """
    Appel Claude : recommandation manager pour valider / refuser / examiner
    une demande de congé en tenant compte des OKRs de l'employé.
    """
    from app.core.config import settings

    request = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.id == leave_request_id,
            LeaveRequest.tenant_id == tenant_id,
        )
        .first()
    )
    if not request:
        return None

    employee = None
    if request.employee:
        employee = request.employee

    at_risk = get_employee_okrs_for_period(
        request.employee_id,
        request.start_date,
        request.end_date,
        db,
        tenant_id,
    )

    leave_duration = (request.end_date - request.start_date).days + 1

    # ---- build OKR context block ----
    if at_risk:
        lines = []
        for o in at_risk:
            kr_lines = "\n".join(
                f"    • {kr['title']}: {kr['progress']:.0f}%"
                for kr in o["key_results"]
            )
            deadline_flag = " ⚠️ DEADLINE PENDANT LE CONGÉ" if o["deadline_during_leave"] else ""
            lines.append(
                f"  - OKR « {o['title']} » (période {o['period']}, "
                f"avancement: {o['progress']:.0f}%"
                + (f", deadline: {o['end_date']}" if o["end_date"] else "")
                + deadline_flag
                + ")\n"
                + kr_lines
            )
        okr_context = "OKRs en cours de l'employé :\n" + "\n".join(lines)
    else:
        okr_context = "Aucun OKR actif identifié pour cet employé sur cette période."

    first_name = getattr(employee, "first_name", "") if employee else ""
    last_name = getattr(employee, "last_name", "") if employee else ""
    employee_name = f"{first_name} {last_name}".strip() or "l'employé"

    prompt = f"""Tu es un assistant RH expert. Un manager doit valider ou refuser une demande de congé.

Informations sur la demande :
- Employé : {employee_name}
- Période : du {request.start_date} au {request.end_date} ({leave_duration} jour(s))
- Motif déclaré : {request.reason or 'Non précisé'}

{okr_context}

Donne une recommandation claire pour le manager (4-6 phrases maximum).
Commence ta réponse par l'une de ces trois mentions sur la première ligne :
  RECOMMANDATION : APPROUVER
  RECOMMANDATION : APPROUVER AVEC PRÉCAUTIONS
  RECOMMANDATION : EXAMINER AVEC ATTENTION

Puis explique brièvement les points clés à vérifier ou à communiquer à l'employé.
Sois factuel, bienveillant et synthétique. Réponds en français, sans introduction."""

    if not getattr(settings, "ANTHROPIC_API_KEY", None):
        # Dégradé : réponse sans IA
        recommendation = "approve" if not at_risk else "caution"
        return {
            "recommendation": recommendation,
            "color": "green" if recommendation == "approve" else "yellow",
            "ai_text": (
                "RECOMMANDATION : APPROUVER\n\n"
                "La clé API Anthropic n'est pas configurée. Aucune analyse IA disponible."
                if recommendation == "approve"
                else "RECOMMANDATION : APPROUVER AVEC PRÉCAUTIONS\n\n"
                "La clé API Anthropic n'est pas configurée. Des OKRs sont en cours ; "
                "vérifiez manuellement l'impact avant de valider."
            ),
            "okrs_at_risk": at_risk,
            "has_okr_issues": len(at_risk) > 0,
        }

    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        ai_text = response.content[0].text.strip()
    except Exception as exc:
        logger.error("Erreur appel Claude pour suggestion manager : %s", exc)
        return {
            "recommendation": "approve",
            "color": "gray",
            "ai_text": "Erreur lors de l'analyse IA. Veuillez décider manuellement.",
            "okrs_at_risk": at_risk,
            "has_okr_issues": len(at_risk) > 0,
        }

    # Parse recommendation tag
    upper = ai_text.upper()
    if "EXAMINER AVEC ATTENTION" in upper:
        recommendation = "review"
        color = "orange"
    elif "PRÉCAUTIONS" in upper or "PRECAUTIONS" in upper:
        recommendation = "caution"
        color = "yellow"
    else:
        recommendation = "approve"
        color = "green"

    return {
        "recommendation": recommendation,
        "color": color,
        "ai_text": ai_text,
        "okrs_at_risk": at_risk,
        "has_okr_issues": len(at_risk) > 0,
    }
