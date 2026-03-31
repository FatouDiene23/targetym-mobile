from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.deps import get_current_user
from app.core.currency import (
    SUPPORTED_CURRENCIES,
    get_supported_currencies,
    convert_amount,
    fetch_exchange_rates,
)

router = APIRouter(prefix="/api/currency", tags=["Currency"])


def _validate_currency(code: str) -> str:
    """Valide et normalise un code devise."""
    code = code.upper().strip()
    if code not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Devise non supportee: {code}")
    return code


@router.get("/supported")
async def list_supported_currencies():
    """Liste des devises supportees."""
    return get_supported_currencies()


@router.get("/rates")
async def get_rates(
    base: str = Query("XOF", description="Devise de base"),
    current_user=Depends(get_current_user),
):
    """Taux de change du jour pour une devise de base."""
    base = _validate_currency(base)
    rates = await fetch_exchange_rates(base)
    return {"base": base, "rates": rates}


@router.get("/convert")
async def convert(
    amount: float = Query(..., ge=0, le=999999999, description="Montant a convertir"),
    from_currency: str = Query("XOF", alias="from", description="Devise source"),
    to_currency: str = Query("EUR", alias="to", description="Devise cible"),
    current_user=Depends(get_current_user),
):
    """Convertit un montant entre deux devises."""
    from_currency = _validate_currency(from_currency)
    to_currency = _validate_currency(to_currency)
    result = await convert_amount(amount, from_currency, to_currency)
    return {
        "amount": amount,
        "from": from_currency,
        "to": to_currency,
        "result": result,
    }
