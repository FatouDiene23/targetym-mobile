# app/api/compensation.py
"""
Endpoints API pour le module Compensation & Benefits
Préfixe : /api/cb
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_tenant
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.employee import Employee, EmployeeStatus
from app.models.compensation import (
    CbIpeCriteria, CbJobEvaluation, CbCollectiveAgreement, CbCcCategory,
    CbSalaryGrid, CbSimulation, CbSimulationLine, CbTenantConfig,
    IpeCriterion, CbConformityStatus, SimulationStatus, SimulationPolicy,
)
from app.schemas.compensation import (
    CbTenantConfigCreate, CbTenantConfigUpdate, CbTenantConfigResponse,
    CbIpeCriteriaCreate, CbIpeCriteriaUpdate, CbIpeCriteriaResponse,
    CbJobEvaluationCreate, CbJobEvaluationUpdate, CbJobEvaluationResponse,
    CbJobEvaluationListResponse,
    CbCollectiveAgreementCreate, CbCollectiveAgreementUpdate, CbCollectiveAgreementResponse,
    CbCcCategoryCreate, CbCcCategoryUpdate, CbCcCategoryResponse,
    CbSalaryGridResponse, CbSalaryGridListResponse,
    CbSimulationCreate, CbSimulationResponse, CbSimulationListResponse,
    CbSimulationLineResponse,
    ReconciliationResponse,
)

router = APIRouter(
    prefix="/api/cb",
    tags=["Compensation & Benefits"],
)

CB_ALLOWED_ROLES = ["admin", "rh", "dg", "super_admin"]

# Band ranges: total_score → mercer_band
MERCER_BAND_MAP = [
    (0,   100,  "Band 1"),
    (101, 200,  "Band 2"),
    (201, 300,  "Band 3"),
    (301, 400,  "Band 4"),
    (401, 500,  "Band 5"),
    (501, 600,  "Band 6"),
    (601, 700,  "Band 7"),
    (701, 800,  "Band 8"),
    (801, 900,  "Band 9"),
    (901, 9999, "Band 10"),
]


# ── Helpers ──────────────────────────────────────────────────

def _check_cb_access(current_user: User, tenant: Tenant):
    """Vérifie accès module C&B + rôle autorisé"""
    if not tenant.has_cb_module:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Module C&B non activé pour ce tenant",
        )
    if getattr(current_user, '_impersonating', False):
        return
    role = current_user.role.value.lower() if current_user.role else "employee"
    if role not in CB_ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux rôles Admin, RH et DG",
        )


def _score_to_band(total_score: int) -> str:
    for lo, hi, band in MERCER_BAND_MAP:
        if lo <= total_score <= hi:
            return band
    return "Band 10"


def _paginate(query, page: int, page_size: int):
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total, (total + page_size - 1) // page_size


# ═════════════════════════════════════════════════════════════
# CONFIGURATION TENANT
# ═════════════════════════════════════════════════════════════

@router.get("/config", response_model=CbTenantConfigResponse)
async def get_cb_config(
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    config = db.query(CbTenantConfig).filter(
        CbTenantConfig.tenant_id == current_tenant.id
    ).first()
    if not config:
        # Créer config par défaut
        config = CbTenantConfig(
            tenant_id=current_tenant.id,
            default_currency=current_tenant.currency or "XOF",
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.put("/config", response_model=CbTenantConfigResponse)
async def update_cb_config(
    data: CbTenantConfigUpdate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    config = db.query(CbTenantConfig).filter(
        CbTenantConfig.tenant_id == current_tenant.id
    ).first()
    if not config:
        config = CbTenantConfig(tenant_id=current_tenant.id)
        db.add(config)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    return config


# ═════════════════════════════════════════════════════════════
# CRITÈRES IPE
# ═════════════════════════════════════════════════════════════

@router.get("/ipe-criteria", response_model=list[CbIpeCriteriaResponse])
async def list_ipe_criteria(
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    criteria = db.query(CbIpeCriteria).filter(
        or_(
            CbIpeCriteria.tenant_id == current_tenant.id,
            CbIpeCriteria.tenant_id.is_(None),
        )
    ).order_by(CbIpeCriteria.criterion).all()
    return criteria


@router.post("/ipe-criteria", response_model=CbIpeCriteriaResponse, status_code=201)
async def create_ipe_criteria(
    data: CbIpeCriteriaCreate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    criteria = CbIpeCriteria(
        tenant_id=current_tenant.id,
        criterion=data.criterion.value,
        label=data.label,
        levels=data.levels,
        weight=data.weight,
        is_active=data.is_active,
    )
    db.add(criteria)
    db.commit()
    db.refresh(criteria)
    return criteria


@router.put("/ipe-criteria/{criteria_id}", response_model=CbIpeCriteriaResponse)
async def update_ipe_criteria(
    criteria_id: int,
    data: CbIpeCriteriaUpdate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    criteria = db.query(CbIpeCriteria).filter(
        CbIpeCriteria.id == criteria_id,
        CbIpeCriteria.tenant_id == current_tenant.id,
    ).first()
    if not criteria:
        raise HTTPException(status_code=404, detail="Critère non trouvé")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(criteria, field, value)
    db.commit()
    db.refresh(criteria)
    return criteria


@router.delete("/ipe-criteria/{criteria_id}", status_code=204)
async def delete_ipe_criteria(
    criteria_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    criteria = db.query(CbIpeCriteria).filter(
        CbIpeCriteria.id == criteria_id,
        CbIpeCriteria.tenant_id == current_tenant.id,
    ).first()
    if not criteria:
        raise HTTPException(status_code=404, detail="Critère non trouvé")
    db.delete(criteria)
    db.commit()


# ═════════════════════════════════════════════════════════════
# PESÉES IPE (JOB EVALUATIONS)
# ═════════════════════════════════════════════════════════════

@router.get("/evaluations", response_model=CbJobEvaluationListResponse)
async def list_evaluations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    country: Optional[str] = Query(None),
    conformity_status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    query = db.query(CbJobEvaluation).filter(
        CbJobEvaluation.tenant_id == current_tenant.id
    )
    if country:
        query = query.filter(CbJobEvaluation.country == country)
    if conformity_status:
        query = query.filter(CbJobEvaluation.conformity_status == conformity_status)
    query = query.order_by(CbJobEvaluation.created_at.desc())
    items, total, total_pages = _paginate(query, page, page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post("/evaluations", response_model=CbJobEvaluationResponse, status_code=201)
async def create_evaluation(
    data: CbJobEvaluationCreate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    # Calculer total_score à partir des scores
    total_score = sum(data.scores.values())
    # Déduire mercer_band si non fourni
    mercer_band = data.mercer_band or _score_to_band(total_score)

    evaluation = CbJobEvaluation(
        tenant_id=current_tenant.id,
        job_id=data.job_id,
        job_title=data.job_title,
        job_family=data.job_family,
        country=data.country,
        scores=data.scores,
        total_score=total_score,
        mercer_band=mercer_band,
        market_p25=data.market_p25,
        market_p50=data.market_p50,
        market_p75=data.market_p75,
        currency=data.currency,
        conformity_status=CbConformityStatus.NON_EVALUE,
        evaluated_by_id=current_user.id,
        evaluated_at=datetime.now(timezone.utc),
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation


@router.get("/evaluations/{evaluation_id}", response_model=CbJobEvaluationResponse)
async def get_evaluation(
    evaluation_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    evaluation = db.query(CbJobEvaluation).filter(
        CbJobEvaluation.id == evaluation_id,
        CbJobEvaluation.tenant_id == current_tenant.id,
    ).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Pesée non trouvée")
    # Enrichir avec la grille salariale
    grid = db.query(CbSalaryGrid).filter(
        CbSalaryGrid.evaluation_id == evaluation.id,
    ).order_by(CbSalaryGrid.generated_at.desc()).first()
    result = CbJobEvaluationResponse.model_validate(evaluation)
    if grid:
        result.salary_grid = CbSalaryGridResponse.model_validate(grid)
    return result


@router.put("/evaluations/{evaluation_id}", response_model=CbJobEvaluationResponse)
async def update_evaluation(
    evaluation_id: int,
    data: CbJobEvaluationUpdate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    evaluation = db.query(CbJobEvaluation).filter(
        CbJobEvaluation.id == evaluation_id,
        CbJobEvaluation.tenant_id == current_tenant.id,
    ).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Pesée non trouvée")
    updates = data.model_dump(exclude_unset=True)
    if "scores" in updates:
        updates["total_score"] = sum(updates["scores"].values())
        if "mercer_band" not in updates:
            updates["mercer_band"] = _score_to_band(updates["total_score"])
    for field, value in updates.items():
        setattr(evaluation, field, value)
    evaluation.evaluated_by_id = current_user.id
    evaluation.evaluated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(evaluation)
    return evaluation


# ── Réconciliation IPE × CC ─────────────────────────────────

@router.post("/evaluations/{evaluation_id}/reconcile", response_model=ReconciliationResponse)
async def reconcile_evaluation(
    evaluation_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """
    Réconcilier une pesée IPE avec la convention collective active du pays.
    1. Récupérer la CC active du pays
    2. Trouver la catégorie CC correspondant au mercer_band
    3. Comparer market_p25 avec cc_minimum
    4. Si market_p25 >= cc_minimum → conforme
    5. Si market_p25 < cc_minimum → a_reviser, ajuster au minimum CC
    6. Créer/mettre à jour cb_salary_grids
    """
    _check_cb_access(current_user, current_tenant)

    evaluation = db.query(CbJobEvaluation).filter(
        CbJobEvaluation.id == evaluation_id,
        CbJobEvaluation.tenant_id == current_tenant.id,
    ).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Pesée non trouvée")

    if not evaluation.country:
        raise HTTPException(status_code=400, detail="Pays non renseigné sur la pesée")
    if evaluation.market_p25 is None or evaluation.market_p50 is None or evaluation.market_p75 is None:
        raise HTTPException(status_code=400, detail="Données marché (P25/P50/P75) manquantes")

    # 1. CC active du pays (tenant-specific puis globale)
    agreement = db.query(CbCollectiveAgreement).filter(
        or_(
            CbCollectiveAgreement.tenant_id == current_tenant.id,
            CbCollectiveAgreement.tenant_id.is_(None),
        ),
        CbCollectiveAgreement.country == evaluation.country,
        CbCollectiveAgreement.is_active == True,
    ).order_by(
        CbCollectiveAgreement.tenant_id.desc().nullslast(),
        CbCollectiveAgreement.effective_date.desc(),
    ).first()

    cc_category = None
    cc_minimum = None
    notes_parts = []

    if agreement:
        # 2. Trouver la catégorie CC par mercer_band
        cc_category = db.query(CbCcCategory).filter(
            CbCcCategory.agreement_id == agreement.id,
            or_(
                CbCcCategory.mercer_band_min == evaluation.mercer_band,
                CbCcCategory.mercer_band_max == evaluation.mercer_band,
            ),
        ).first()
        # Fallback : chercher une catégorie dont le range inclut le band
        if not cc_category:
            all_cats = db.query(CbCcCategory).filter(
                CbCcCategory.agreement_id == agreement.id,
            ).all()
            for cat in all_cats:
                if cat.mercer_band_min and cat.mercer_band_max:
                    if cat.mercer_band_min <= evaluation.mercer_band <= cat.mercer_band_max:
                        cc_category = cat
                        break

        if cc_category:
            cc_minimum = float(cc_category.min_salary)
            notes_parts.append(
                f"CC: {agreement.name} — Catégorie {cc_category.category_code}"
            )
        else:
            notes_parts.append(
                f"CC: {agreement.name} — Aucune catégorie trouvée pour {evaluation.mercer_band}"
            )
    else:
        notes_parts.append(f"Aucune CC active trouvée pour le pays {evaluation.country}")

    # 3-5. Comparer et déterminer conformité
    market_p25 = float(evaluation.market_p25)
    market_p50 = float(evaluation.market_p50)
    market_p75 = float(evaluation.market_p75)

    if cc_minimum is not None and market_p25 < cc_minimum:
        conformity = CbConformityStatus.A_REVISER
        grid_min = cc_minimum
        grid_mid = max(market_p50, cc_minimum)
        grid_max = max(market_p75, cc_minimum)
        notes_parts.append(
            f"P25 ({market_p25:,.0f}) < minimum CC ({cc_minimum:,.0f}) → grille ajustée"
        )
    else:
        conformity = CbConformityStatus.CONFORME
        grid_min = market_p25
        grid_mid = market_p50
        grid_max = market_p75
        if cc_minimum is not None:
            notes_parts.append(
                f"P25 ({market_p25:,.0f}) >= minimum CC ({cc_minimum:,.0f}) → conforme"
            )

    # 6. Créer/mettre à jour la grille
    existing_grid = db.query(CbSalaryGrid).filter(
        CbSalaryGrid.evaluation_id == evaluation.id,
        CbSalaryGrid.tenant_id == current_tenant.id,
    ).first()

    notes_text = " | ".join(notes_parts)

    if existing_grid:
        existing_grid.cc_category_id = cc_category.id if cc_category else None
        existing_grid.min_salary = grid_min
        existing_grid.mid_salary = grid_mid
        existing_grid.max_salary = grid_max
        existing_grid.cc_minimum = cc_minimum
        existing_grid.conformity_status = conformity
        existing_grid.reconciliation_notes = notes_text
        existing_grid.generated_at = datetime.now(timezone.utc)
        existing_grid.generated_by_id = current_user.id
        grid = existing_grid
    else:
        grid = CbSalaryGrid(
            tenant_id=current_tenant.id,
            evaluation_id=evaluation.id,
            cc_category_id=cc_category.id if cc_category else None,
            country=evaluation.country,
            currency=evaluation.currency or "XOF",
            min_salary=grid_min,
            mid_salary=grid_mid,
            max_salary=grid_max,
            cc_minimum=cc_minimum,
            conformity_status=conformity,
            reconciliation_notes=notes_text,
            generated_by_id=current_user.id,
        )
        db.add(grid)

    # Mettre à jour le statut de conformité sur la pesée
    evaluation.conformity_status = conformity
    db.commit()
    db.refresh(grid)
    db.refresh(evaluation)

    return {
        "evaluation_id": evaluation.id,
        "conformity_status": conformity.value,
        "salary_grid": CbSalaryGridResponse.model_validate(grid),
        "cc_category": CbCcCategoryResponse.model_validate(cc_category) if cc_category else None,
        "notes": notes_text,
    }


# ═════════════════════════════════════════════════════════════
# CONVENTIONS COLLECTIVES
# ═════════════════════════════════════════════════════════════

@router.get("/agreements", response_model=list[CbCollectiveAgreementResponse])
async def list_agreements(
    country: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    query = db.query(CbCollectiveAgreement).filter(
        or_(
            CbCollectiveAgreement.tenant_id == current_tenant.id,
            CbCollectiveAgreement.tenant_id.is_(None),
        )
    )
    if country:
        query = query.filter(CbCollectiveAgreement.country == country)
    return query.order_by(CbCollectiveAgreement.effective_date.desc()).all()


@router.post("/agreements", response_model=CbCollectiveAgreementResponse, status_code=201)
async def create_agreement(
    data: CbCollectiveAgreementCreate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    agreement = CbCollectiveAgreement(
        tenant_id=current_tenant.id,
        **data.model_dump(),
    )
    db.add(agreement)
    db.commit()
    db.refresh(agreement)
    return agreement


@router.put("/agreements/{agreement_id}", response_model=CbCollectiveAgreementResponse)
async def update_agreement(
    agreement_id: int,
    data: CbCollectiveAgreementUpdate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    agreement = db.query(CbCollectiveAgreement).filter(
        CbCollectiveAgreement.id == agreement_id,
        CbCollectiveAgreement.tenant_id == current_tenant.id,
    ).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Convention collective non trouvée")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(agreement, field, value)
    db.commit()
    db.refresh(agreement)
    return agreement


# ── Catégories CC ────────────────────────────────────────────

@router.get("/agreements/{agreement_id}/categories", response_model=list[CbCcCategoryResponse])
async def list_cc_categories(
    agreement_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    # Vérifier accès à la CC
    agreement = db.query(CbCollectiveAgreement).filter(
        CbCollectiveAgreement.id == agreement_id,
        or_(
            CbCollectiveAgreement.tenant_id == current_tenant.id,
            CbCollectiveAgreement.tenant_id.is_(None),
        ),
    ).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Convention collective non trouvée")
    categories = db.query(CbCcCategory).filter(
        CbCcCategory.agreement_id == agreement_id,
    ).order_by(CbCcCategory.category_code).all()
    return categories


@router.post("/agreements/{agreement_id}/categories", response_model=CbCcCategoryResponse, status_code=201)
async def create_cc_category(
    agreement_id: int,
    data: CbCcCategoryCreate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    agreement = db.query(CbCollectiveAgreement).filter(
        CbCollectiveAgreement.id == agreement_id,
        CbCollectiveAgreement.tenant_id == current_tenant.id,
    ).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Convention collective non trouvée (ou globale, non modifiable)")
    category = CbCcCategory(
        agreement_id=agreement_id,
        **data.model_dump(),
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/agreements/{agreement_id}/categories/{category_id}", response_model=CbCcCategoryResponse)
async def update_cc_category(
    agreement_id: int,
    category_id: int,
    data: CbCcCategoryUpdate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    agreement = db.query(CbCollectiveAgreement).filter(
        CbCollectiveAgreement.id == agreement_id,
        CbCollectiveAgreement.tenant_id == current_tenant.id,
    ).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Convention collective non trouvée")
    category = db.query(CbCcCategory).filter(
        CbCcCategory.id == category_id,
        CbCcCategory.agreement_id == agreement_id,
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


# ═════════════════════════════════════════════════════════════
# GRILLES SALARIALES
# ═════════════════════════════════════════════════════════════

@router.get("/salary-grids", response_model=CbSalaryGridListResponse)
async def list_salary_grids(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    country: Optional[str] = Query(None),
    conformity_status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    query = db.query(CbSalaryGrid).filter(
        CbSalaryGrid.tenant_id == current_tenant.id
    )
    if country:
        query = query.filter(CbSalaryGrid.country == country)
    if conformity_status:
        query = query.filter(CbSalaryGrid.conformity_status == conformity_status)
    query = query.order_by(CbSalaryGrid.generated_at.desc())
    items, total, total_pages = _paginate(query, page, page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/salary-grids/{grid_id}", response_model=CbSalaryGridResponse)
async def get_salary_grid(
    grid_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    grid = db.query(CbSalaryGrid).filter(
        CbSalaryGrid.id == grid_id,
        CbSalaryGrid.tenant_id == current_tenant.id,
    ).first()
    if not grid:
        raise HTTPException(status_code=404, detail="Grille salariale non trouvée")
    return grid


# ═════════════════════════════════════════════════════════════
# SIMULATIONS
# ═════════════════════════════════════════════════════════════

@router.get("/simulations", response_model=CbSimulationListResponse)
async def list_simulations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    year: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    query = db.query(CbSimulation).filter(
        CbSimulation.tenant_id == current_tenant.id
    )
    if status_filter:
        query = query.filter(CbSimulation.status == status_filter)
    if year:
        query = query.filter(CbSimulation.year == year)
    query = query.order_by(CbSimulation.created_at.desc())
    items, total, total_pages = _paginate(query, page, page_size)
    # Enrichir avec lines_count
    results = []
    for sim in items:
        count = db.query(CbSimulationLine).filter(
            CbSimulationLine.simulation_id == sim.id
        ).count()
        resp = CbSimulationResponse.model_validate(sim)
        resp.lines_count = count
        results.append(resp)
    return {
        "items": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post("/simulations", response_model=CbSimulationResponse, status_code=201)
async def create_simulation(
    data: CbSimulationCreate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """
    Créer une simulation + générer les lignes automatiquement.
    - Récupère les employés selon scope
    - Calcule proposed_increase_pct selon policy
    - Vérifie conformité CC pour chaque ligne
    """
    _check_cb_access(current_user, current_tenant)

    simulation = CbSimulation(
        tenant_id=current_tenant.id,
        title=data.title,
        budget_type=data.budget_type,
        budget_value=data.budget_value,
        currency=data.currency,
        policy=data.policy.value,
        scope_type=data.scope_type,
        scope_id=data.scope_id,
        status=SimulationStatus.BROUILLON,
        year=data.year,
        created_by_id=current_user.id,
    )
    db.add(simulation)
    db.flush()

    # Récupérer les employés selon scope
    emp_query = db.query(Employee).filter(
        Employee.tenant_id == current_tenant.id,
        Employee.status == EmployeeStatus.ACTIVE,
    )
    if data.scope_type == "department" and data.scope_id:
        emp_query = emp_query.filter(Employee.department_id == data.scope_id)
    elif data.scope_type == "country" and data.scope_id:
        # scope_id non utilisé pour country, on pourrait utiliser un paramètre
        pass

    employees = emp_query.all()

    # Calculer l'augmentation selon la policy
    for emp in employees:
        current_salary = float(emp.salary or 0)
        if current_salary <= 0:
            continue

        if data.policy == SimulationPolicyEnum.uniforme:
            if data.budget_type == "percentage":
                increase_pct = float(data.budget_value)
            else:
                # Montant réparti uniformément
                total_salaries = sum(float(e.salary or 0) for e in employees if e.salary and float(e.salary) > 0)
                increase_pct = (float(data.budget_value) / total_salaries * 100) if total_salaries > 0 else 0
        elif data.policy == SimulationPolicyEnum.anciennete:
            # Plus d'ancienneté → plus d'augmentation (pondération linéaire)
            from datetime import date as _date
            hire_date = emp.hire_date or _date.today()
            years = (datetime.now(timezone.utc).date() - hire_date).days / 365.25
            base_pct = float(data.budget_value) if data.budget_type == "percentage" else 3.0
            increase_pct = min(base_pct * (1 + years * 0.1), base_pct * 2)
        elif data.policy == SimulationPolicyEnum.categorie:
            # Catégorie/classification → augmentation différenciée
            base_pct = float(data.budget_value) if data.budget_type == "percentage" else 3.0
            classification = (emp.classification or "").lower()
            if "cadre" in classification or "direction" in classification:
                increase_pct = base_pct * 0.8
            elif "maitrise" in classification or "technicien" in classification:
                increase_pct = base_pct * 1.0
            else:
                increase_pct = base_pct * 1.2
        else:
            increase_pct = float(data.budget_value) if data.budget_type == "percentage" else 3.0

        proposed_salary = current_salary * (1 + increase_pct / 100)

        # Vérifier conformité CC
        cc_min = None
        line_conformity = CbConformityStatus.NON_EVALUE
        emp_country = emp.nationality  # Employee uses 'nationality' not 'country'
        if emp_country:
            # Chercher le minimum CC applicable
            agreement = db.query(CbCollectiveAgreement).filter(
                or_(
                    CbCollectiveAgreement.tenant_id == current_tenant.id,
                    CbCollectiveAgreement.tenant_id.is_(None),
                ),
                CbCollectiveAgreement.country == emp_country,
                CbCollectiveAgreement.is_active == True,
            ).first()
            if agreement:
                cat = db.query(CbCcCategory).filter(
                    CbCcCategory.agreement_id == agreement.id,
                ).order_by(CbCcCategory.min_salary.asc()).first()
                if cat:
                    cc_min = float(cat.min_salary)
                    if proposed_salary >= cc_min:
                        line_conformity = CbConformityStatus.CONFORME
                    else:
                        line_conformity = CbConformityStatus.A_REVISER

        line = CbSimulationLine(
            tenant_id=current_tenant.id,
            simulation_id=simulation.id,
            employee_id=emp.id,
            current_salary=current_salary,
            proposed_increase_pct=round(increase_pct, 2),
            proposed_salary=round(proposed_salary, 2),
            cc_minimum=cc_min,
            conformity_status=line_conformity,
        )
        db.add(line)

    db.commit()
    db.refresh(simulation)

    lines_count = db.query(CbSimulationLine).filter(
        CbSimulationLine.simulation_id == simulation.id
    ).count()
    result = CbSimulationResponse.model_validate(simulation)
    result.lines_count = lines_count
    return result


@router.get("/simulations/{simulation_id}", response_model=CbSimulationResponse)
async def get_simulation(
    simulation_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    simulation = db.query(CbSimulation).filter(
        CbSimulation.id == simulation_id,
        CbSimulation.tenant_id == current_tenant.id,
    ).first()
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation non trouvée")

    lines = db.query(CbSimulationLine).filter(
        CbSimulationLine.simulation_id == simulation.id
    ).all()

    # Enrichir les lignes avec nom/poste employé
    enriched_lines = []
    for line in lines:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        resp = CbSimulationLineResponse.model_validate(line)
        if emp:
            resp.employee_name = f"{emp.first_name} {emp.last_name}"
            resp.employee_job_title = emp.job_title
        enriched_lines.append(resp)

    result = CbSimulationResponse.model_validate(simulation)
    result.lines = enriched_lines
    result.lines_count = len(lines)
    return result


# ── Workflow simulations ─────────────────────────────────────

@router.post("/simulations/{simulation_id}/submit", response_model=CbSimulationResponse)
async def submit_simulation(
    simulation_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    simulation = db.query(CbSimulation).filter(
        CbSimulation.id == simulation_id,
        CbSimulation.tenant_id == current_tenant.id,
    ).first()
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation non trouvée")
    if simulation.status != SimulationStatus.BROUILLON:
        raise HTTPException(status_code=400, detail="Seule une simulation en brouillon peut être soumise")
    simulation.status = SimulationStatus.SOUMIS
    db.commit()
    db.refresh(simulation)
    return simulation


@router.post("/simulations/{simulation_id}/approve", response_model=CbSimulationResponse)
async def approve_simulation(
    simulation_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    # Seul le DG peut approuver
    role = current_user.role.value.lower() if current_user.role else "employee"
    if role not in ["dg", "super_admin"] and not getattr(current_user, '_impersonating', False):
        raise HTTPException(status_code=403, detail="Seul le DG peut approuver une simulation")

    simulation = db.query(CbSimulation).filter(
        CbSimulation.id == simulation_id,
        CbSimulation.tenant_id == current_tenant.id,
    ).first()
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation non trouvée")
    if simulation.status != SimulationStatus.SOUMIS:
        raise HTTPException(status_code=400, detail="Seule une simulation soumise peut être approuvée")
    simulation.status = SimulationStatus.APPROUVE
    simulation.approved_by_id = current_user.id
    simulation.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(simulation)
    return simulation


@router.post("/simulations/{simulation_id}/reject", response_model=CbSimulationResponse)
async def reject_simulation(
    simulation_id: int,
    reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    _check_cb_access(current_user, current_tenant)
    role = current_user.role.value.lower() if current_user.role else "employee"
    if role not in ["dg", "super_admin"] and not getattr(current_user, '_impersonating', False):
        raise HTTPException(status_code=403, detail="Seul le DG peut rejeter une simulation")

    simulation = db.query(CbSimulation).filter(
        CbSimulation.id == simulation_id,
        CbSimulation.tenant_id == current_tenant.id,
    ).first()
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation non trouvée")
    if simulation.status != SimulationStatus.SOUMIS:
        raise HTTPException(status_code=400, detail="Seule une simulation soumise peut être rejetée")
    simulation.status = SimulationStatus.REJETE
    simulation.approved_by_id = current_user.id
    simulation.approved_at = datetime.now(timezone.utc)
    if reason:
        simulation.notes = reason
    db.commit()
    db.refresh(simulation)
    return simulation
