"""
Service de scoring IA pour les CVs et candidatures.
Utilise Claude pour évaluer le matching candidat ↔ offre d'emploi.
"""
import json
import logging
from typing import Optional, List, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


SCORING_SYSTEM_PROMPT = """Tu es un expert RH senior spécialisé dans l'évaluation de candidatures.
Tu analyses des CVs / profils candidats par rapport à des offres d'emploi et des critères de sélection.
Tu es objectif, rigoureux et adapté au contexte des entreprises africaines (Sénégal, Côte d'Ivoire, etc.).
Tu ne dois JAMAIS discriminer sur des critères non professionnels (genre, origine, etc.).
Tu dois toujours répondre en JSON valide, sans commentaires ni balises markdown.
"""


def build_scoring_prompt(
    job_description: str,
    candidate_text: str,
    criteria: Optional[List[str]] = None,
) -> str:
    criteria_block = ""
    if criteria:
        criteria_block = "\nCRITÈRES SPÉCIFIQUES DU RECRUTEUR :\n" + "\n".join(f"- {c}" for c in criteria)

    return f"""Évalue la compatibilité de ce candidat avec l'offre d'emploi ci-dessous.

=== OFFRE D'EMPLOI ===
{job_description}
{criteria_block}

=== PROFIL CANDIDAT / CV ===
{candidate_text}

=== INSTRUCTIONS ===
Retourne UNIQUEMENT un objet JSON (sans markdown, sans commentaire) avec exactement cette structure :
{{
  "overall_score": <entier 0-100>,
  "score_details": [
    {{"category": "Compétences techniques", "score": <0-100>}},
    {{"category": "Expérience professionnelle", "score": <0-100>}},
    {{"category": "Formation / Diplômes", "score": <0-100>}},
    {{"category": "Disponibilité & Conditions", "score": <0-100>}}
  ],
  "analysis": "<paragraphe concis : points forts du profil par rapport au poste, lacunes éventuelles>",
  "recommendation": "shortlist" | "to_review" | "reject",
  "recommendation_reason": "<phrase courte expliquant la recommandation>",
  "conditions_to_verify": ["<condition 1 à confirmer en entretien>", ...]
}}

Règles de scoring :
- 85-100 : excellent match → shortlist
- 65-84  : bon match avec quelques réserves → to_review
- < 65   : match insuffisant → reject
"""


class CVScoringService:
    """Service IA pour scorer des CVs."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not settings.ANTHROPIC_API_KEY:
                raise RuntimeError("ANTHROPIC_API_KEY non configurée")
            from anthropic import Anthropic
            self._client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._client

    def is_enabled(self) -> bool:
        return bool(settings.ANTHROPIC_API_KEY)

    # ------------------------------------------------------------------
    # Scoring d'un seul CV/profil
    # ------------------------------------------------------------------
    def score_one(
        self,
        job_description: str,
        candidate_text: str,
        criteria: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Score un CV/profil par rapport à une offre.
        Retourne: {overall_score, score_details, analysis, recommendation,
                   recommendation_reason, conditions_to_verify}
        """
        client = self._get_client()
        prompt = build_scoring_prompt(job_description, candidate_text, criteria)

        try:
            response = client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=1000,
                system=SCORING_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            # Nettoyer les éventuels blocs markdown
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            result = json.loads(raw)

            # Valider les champs minimaux
            result.setdefault("overall_score", 50)
            result.setdefault("score_details", [])
            result.setdefault("analysis", "")
            result.setdefault("recommendation", "to_review")
            result.setdefault("recommendation_reason", "")
            result.setdefault("conditions_to_verify", [])

            # Clamp score
            result["overall_score"] = max(0, min(100, int(result["overall_score"])))
            return result

        except json.JSONDecodeError as e:
            logger.error(f"CVScoringService JSON invalide: {e} — réponse: {raw[:300]}")
            return {
                "overall_score": 50,
                "score_details": [],
                "analysis": "Impossible d'analyser automatiquement ce profil.",
                "recommendation": "to_review",
                "recommendation_reason": "Analyse IA indisponible",
                "conditions_to_verify": [],
            }
        except Exception as e:
            logger.error(f"CVScoringService erreur: {e}")
            return {
                "overall_score": 50,
                "score_details": [],
                "analysis": f"Erreur lors du scoring : {str(e)}",
                "recommendation": "to_review",
                "recommendation_reason": "Erreur IA",
                "conditions_to_verify": [],
            }

    # ------------------------------------------------------------------
    # Scoring et sauvegarde en DB pour un candidat existant
    # ------------------------------------------------------------------
    def score_and_save_candidate(
        self,
        candidate_id: int,
        job_description: str,
        db,
        criteria: Optional[List[str]] = None,
        cv_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Score le candidat candidate_id et sauvegarde le résultat dans la table candidates.
        Si cv_text est fourni, l'utilise ; sinon construit un profil textuel depuis les colonnes DB.
        """
        from sqlalchemy import text

        # Récupérer le profil candidat
        row = db.execute(
            text("""
                SELECT first_name, last_name, current_position, current_company,
                       experience_years, education, skills, expected_salary,
                       salary_currency, notice_period, location, source, notes
                FROM candidates WHERE id = :cid
            """),
            {"cid": candidate_id},
        ).fetchone()

        if not row:
            return {"error": "Candidat introuvable"}

        candidate_profile = _build_profile_text(dict(row._mapping), cv_text)
        result = self.score_one(job_description, candidate_profile, criteria)

        # Sauvegarder en base
        try:
            db.execute(
                text("""
                    UPDATE candidates
                    SET ai_score = :score,
                        ai_score_details = :details,
                        ai_analysis = :analysis,
                        updated_at = NOW()
                    WHERE id = :cid
                """),
                {
                    "score": result["overall_score"],
                    "details": json.dumps(result["score_details"]),
                    "analysis": result["analysis"],
                    "cid": candidate_id,
                },
            )
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Erreur sauvegarde score candidat {candidate_id}: {e}")

        return result

    # ------------------------------------------------------------------
    # Scoring en masse (sans DB write — mode preview)
    # ------------------------------------------------------------------
    def score_batch(
        self,
        job_description: str,
        candidates: List[Dict[str, Any]],
        criteria: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Score une liste de candidats/CVs.
        candidates = [{cv_text, filename, candidate_name, candidate_id?}, ...]
        Retourne la liste triée par score décroissant.
        """
        results = []
        for item in candidates:
            cv_text = item.get("cv_text", "")
            filename = item.get("filename", "CV")
            name = item.get("candidate_name", filename)

            scored = self.score_one(job_description, cv_text, criteria)
            results.append({
                "filename": filename,
                "candidate_name": name,
                "candidate_id": item.get("candidate_id"),
                **scored,
            })

        # Trier par score décroissant
        results.sort(key=lambda x: x.get("overall_score", 0), reverse=True)
        return results


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _build_profile_text(profile: Dict[str, Any], cv_text: Optional[str] = None) -> str:
    """Construit un texte de profil exploitable depuis les colonnes DB."""
    lines = []
    name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
    if name:
        lines.append(f"Nom : {name}")
    if profile.get("current_position"):
        lines.append(f"Poste actuel : {profile['current_position']}")
    if profile.get("current_company"):
        lines.append(f"Entreprise : {profile['current_company']}")
    if profile.get("experience_years"):
        lines.append(f"Années d'expérience : {profile['experience_years']} ans")
    if profile.get("education"):
        lines.append(f"Formation : {profile['education']}")
    if profile.get("location"):
        lines.append(f"Localisation : {profile['location']}")
    if profile.get("notice_period"):
        lines.append(f"Préavis : {profile['notice_period']}")
    if profile.get("expected_salary"):
        currency = profile.get("salary_currency", "XOF")
        lines.append(f"Prétentions salariales : {profile['expected_salary']} {currency}")
    if profile.get("skills"):
        skills = profile["skills"]
        if isinstance(skills, list):
            lines.append(f"Compétences : {', '.join(skills)}")
    if profile.get("notes"):
        lines.append(f"Notes RH : {profile['notes']}")
    if cv_text:
        lines.append("\n--- CV TEXTE COMPLET ---\n" + cv_text[:4000])
    return "\n".join(lines) if lines else "(Profil vide)"


def build_job_description_text(job: Any) -> str:
    """Construit le texte de l'offre pour le scoring."""
    parts = []
    if hasattr(job, "title"):
        parts.append(f"Poste : {job.title}")
    if hasattr(job, "description") and job.description:
        parts.append(f"Description :\n{job.description}")
    if hasattr(job, "requirements") and job.requirements:
        reqs = job.requirements
        if isinstance(reqs, list):
            reqs = "\n".join(f"- {r}" for r in reqs)
        parts.append(f"Profil requis :\n{reqs}")
    if hasattr(job, "contract_type") and job.contract_type:
        parts.append(f"Type de contrat : {job.contract_type}")
    if hasattr(job, "location") and job.location:
        parts.append(f"Lieu : {job.location}")
    if hasattr(job, "experience_years") and job.experience_years:
        parts.append(f"Expérience requise : {job.experience_years} ans minimum")
    return "\n\n".join(parts) if parts else "Offre sans description"


cv_scoring_service = CVScoringService()
