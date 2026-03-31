"""
Service d'intégration IntoWork pour Targetym.
Gère les appels vers l'API IntoWork lors d'événements Targetym.
"""

import httpx
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

INTOWORK_API_URL = os.getenv("INTOWORK_API_URL", "https://intowork-api.railway.app")
TIMEOUT = 10.0


def sync_job_to_intowork(
    *,
    intowork_company_id: int,
    intowork_api_key: str,
    targetym_tenant_id: int,
    job_posting_id: int,
    title: str,
    description: Optional[str],
    location: Optional[str],
    contract_type: Optional[str],
    salary_min: Optional[float],
    salary_max: Optional[float],
    salary_currency: str = "XOF",
    remote_policy: Optional[str] = None,
) -> bool:
    """
    Synchronise une offre Targetym publiée vers IntoWork.
    Appel synchrone (Targetym utilise SQLAlchemy sync).

    Retourne True si l'appel a réussi, False sinon.
    """
    payload = {
        "company_id": intowork_company_id,
        "api_key": intowork_api_key,
        "targetym_tenant_id": targetym_tenant_id,
        "job": {
            "targetym_job_posting_id": job_posting_id,
            "title": title,
            "description": description or "",
            "location": location or "",
            "job_type": _map_contract_type(contract_type),
            "location_type": _map_remote_policy(remote_policy),
            "salary_min": int(salary_min) if salary_min else None,
            "salary_max": int(salary_max) if salary_max else None,
            "currency": salary_currency,
            "source": "targetym",
        }
    }

    try:
        resp = httpx.post(
            f"{INTOWORK_API_URL}/api/integrations/targetym/webhook/sync-job",
            json=payload,
            timeout=TIMEOUT,
        )
        if resp.status_code == 200:
            logger.info(f"✅ Offre '{title}' synchronisée vers IntoWork (company {intowork_company_id})")
            return True
        else:
            logger.warning(f"⚠️ IntoWork a répondu {resp.status_code} à la sync job: {resp.text[:200]}")
            return False
    except httpx.RequestError as e:
        logger.error(f"❌ Impossible de joindre IntoWork : {e}")
        return False


def _map_contract_type(ct: Optional[str]) -> str:
    mapping = {
        "CDI": "full_time",
        "CDD": "contract",
        "stage": "internship",
        "alternance": "internship",
        "consultant": "contract",
        "interim": "temporary",
    }
    return mapping.get(ct or "", "full_time")


def _map_remote_policy(rp: Optional[str]) -> str:
    mapping = {
        "remote": "remote",
        "hybrid": "hybrid",
        "onsite": "on_site",
    }
    return mapping.get(rp or "", "on_site")
