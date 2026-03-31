"""
Service de conversion de devises avec cache des taux de change.
Utilise l'API gratuite exchangerate-api.com (pas de clé requise).
"""
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

# Cache en mémoire des taux de change
_rates_cache: Dict[str, dict] = {}
_cache_expiry: Optional[datetime] = None
CACHE_DURATION = timedelta(hours=6)


SUPPORTED_CURRENCIES = [
    "XAF", "XOF", "GHS", "NGN", "CDF", "GNF", "EUR", "USD",
]

CURRENCY_LABELS = {
    "XAF": "Franc CFA (BEAC)",
    "XOF": "Franc CFA (BCEAO)",
    "GHS": "Cedi Ghanéen",
    "NGN": "Naira Nigérian",
    "CDF": "Franc Congolais",
    "GNF": "Franc Guinéen",
    "EUR": "Euro",
    "USD": "Dollar US",
}


async def fetch_exchange_rates(base: str = "USD") -> Dict[str, float]:
    """Récupère les taux de change depuis l'API externe."""
    global _rates_cache, _cache_expiry

    now = datetime.now(timezone.utc)
    if _cache_expiry and now < _cache_expiry and base in _rates_cache:
        return _rates_cache[base]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://open.er-api.com/v6/latest/{base}"
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("result") == "success":
                rates = data["rates"]
                _rates_cache[base] = rates
                _cache_expiry = now + CACHE_DURATION
                logger.info(f"Taux de change mis à jour (base={base}), {len(rates)} devises")
                return rates
    except Exception as e:
        logger.warning(f"Erreur récupération taux de change: {e}")
        if base in _rates_cache:
            return _rates_cache[base]

    # Fallback : taux fixes pour les devises CFA (parité fixe avec EUR)
    return _get_fallback_rates(base)


def _get_fallback_rates(base: str) -> Dict[str, float]:
    """Taux de secours basés sur les parités connues."""
    # Parités fixes connues
    EUR_TO_XOF = 655.957
    EUR_TO_XAF = 655.957
    EUR_TO_USD = 1.08  # approximatif

    # Construire les taux depuis EUR
    eur_rates = {
        "EUR": 1.0,
        "XAF": EUR_TO_XAF,
        "XOF": EUR_TO_XOF,
        "USD": EUR_TO_USD,
        "GHS": 15.5,
        "NGN": 1680.0,
        "CDF": 2750.0,
        "GNF": 9300.0,
    }

    if base == "EUR":
        return eur_rates

    # Convertir pour une autre base
    if base not in eur_rates:
        return eur_rates

    base_in_eur = eur_rates[base]
    return {k: v / base_in_eur for k, v in eur_rates.items()}


async def convert_amount(
    amount: float,
    from_currency: str,
    to_currency: str,
) -> float:
    """Convertit un montant d'une devise à une autre."""
    if from_currency == to_currency:
        return amount

    rates = await fetch_exchange_rates(from_currency)
    rate = rates.get(to_currency)

    if rate is None:
        # Essai indirect via USD
        usd_rates = await fetch_exchange_rates("USD")
        from_rate = usd_rates.get(from_currency, 1.0)
        to_rate = usd_rates.get(to_currency, 1.0)
        rate = to_rate / from_rate

    return round(amount * rate, 2)


def get_supported_currencies() -> list:
    """Retourne la liste des devises supportées avec labels."""
    return [
        {"code": code, "label": CURRENCY_LABELS.get(code, code)}
        for code in SUPPORTED_CURRENCIES
    ]
