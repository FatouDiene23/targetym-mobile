"""
API Groups - Gestion Groupes / Filiales (multi-tenant hiérarchique)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import hash_password
from app.api.deps import require_super_admin, get_current_user
from app.models.user import User, UserRole
from app.models.tenant import Tenant, GroupType, GroupConversionRequest, GroupConversionStatus
from app.models.employee import Employee, EmployeeRole
from app.models.leave import LeaveRequest

router = APIRouter(prefix="/platform/groups", tags=["groups"])

# ============================================
# TARIFICATION GROUPE
# ============================================
GROUP_BASE_PRICE = 100_000      # XOF/mois — forfait groupe de base
GROUP_PRICE_PER_SUBSIDIARY = 30_000  # XOF/mois — par filiale supplémentaire

def calculate_quote(nb_subsidiaries: int, include_base_fee: bool = True) -> int:
    """Calcule le montant mensuel du devis groupe en XOF."""
    n = max(1, nb_subsidiaries)  # minimum 1 filiale
    return (GROUP_BASE_PRICE if include_base_fee else 0) + n * GROUP_PRICE_PER_SUBSIDIARY


def get_group_subsidiary_quota(db: Session, tenant_id: int) -> int:
    """Quota total de filiales autorisées.
    Utilise max_subsidiaries du tenant (défini directement par SuperAdmin)
    additionné des demandes approuvées (flux demande client).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    direct_quota = int(getattr(tenant, 'max_subsidiaries', 0) or 0) if tenant else 0
    from_requests = db.query(func.coalesce(func.sum(GroupConversionRequest.nb_subsidiaries), 0)).filter(
        GroupConversionRequest.tenant_id == tenant_id,
        GroupConversionRequest.status == GroupConversionStatus.approved,
    ).scalar()
    from_requests = int(from_requests or 0)
    # Le quota effectif = max entre quota direct et quota via demandes
    # (évite les doublons si SuperAdmin a déjà inclus les demandes approuvées)
    return max(direct_quota, from_requests)


def get_group_subsidiary_usage(db: Session, tenant_id: int) -> int:
    """Nombre de filiales déjà créées pour un groupe."""
    used = db.query(func.count(Tenant.id)).filter(Tenant.parent_tenant_id == tenant_id).scalar()
    return int(used or 0)


def ensure_group_quota_available(db: Session, tenant_id: int, needed: int = 1) -> tuple[int, int, int]:
    """Vérifie que le groupe a encore du quota pour créer de nouvelles filiales."""
    allowed = get_group_subsidiary_quota(db, tenant_id)
    used = get_group_subsidiary_usage(db, tenant_id)
    remaining = max(0, allowed - used)

    if remaining < needed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Quota de filiales atteint ({used}/{allowed}). "
                "Faites une nouvelle demande pour ajouter des filiales."
            ),
        )

    return allowed, used, remaining


# ============================================
# SCHEMAS
# ============================================

class SubsidiaryItem(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: Optional[str] = None
    plan: Optional[str] = None
    is_active: bool
    is_trial: bool
    employee_count: int = 0
    
    class Config:
        from_attributes = True


class GroupDetailResponse(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: Optional[str] = None
    plan: Optional[str] = None
    is_active: bool
    is_group: bool
    group_type: str
    subsidiary_count: int = 0
    subsidiaries: List[SubsidiaryItem] = []

    class Config:
        from_attributes = True


class GroupStatsResponse(BaseModel):
    group_id: int
    group_name: str
    total_employees: int = 0
    total_subsidiaries: int = 0
    pending_leaves: int = 0
    subsidiaries: List[dict] = []


class ConvertToGroupRequest(BaseModel):
    """Convertir un tenant standalone en groupe"""
    confirm: bool = True
    nb_subsidiaries: int = Field(1, ge=1, description="Nombre de filiales autorisées")


class UpdateMaxSubsidiariesRequest(BaseModel):
    """Modifier le quota de filiales d'un groupe"""
    max_subsidiaries: int = Field(..., ge=0, description="Nouveau quota de filiales autorisées")


class AddSubsidiaryRequest(BaseModel):
    """Rattacher un tenant existant comme filiale OU créer une nouvelle filiale"""
    # Option A : rattacher un tenant existant par son slug
    existing_tenant_slug: Optional[str] = None
    # Option B : créer une nouvelle filiale
    name: Optional[str] = None
    slug: Optional[str] = None
    email: Optional[EmailStr] = None
    admin_email: Optional[EmailStr] = None
    admin_password: Optional[str] = Field(None, min_length=8)


class DetachSubsidiaryRequest(BaseModel):
    confirm: bool = True


class RequestGroupConversionBody(BaseModel):
    reason: Optional[str] = None
    nb_subsidiaries: int = 1           # Nombre de filiales souhaitées
    contact_phone: Optional[str] = None  # Téléphone de contact


class ReviewConversionRequest(BaseModel):
    approved: bool
    note: Optional[str] = None


class MarkPaidBody(BaseModel):
    payment_ref: Optional[str] = None  # Référence paiement (virement, chèque, etc.)


class ConversionRequestResponse(BaseModel):
    id: int
    tenant_id: int
    tenant_name: Optional[str] = None
    requested_by_email: Optional[str] = None
    reason: Optional[str] = None
    nb_subsidiaries: Optional[int] = None
    contact_phone: Optional[str] = None
    quote_amount: Optional[int] = None
    payment_status: str = 'unpaid'
    payment_ref: Optional[str] = None
    status: str
    reviewed_by_email: Optional[str] = None
    review_note: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MyGroupContextResponse(BaseModel):
    """Contexte groupe de l'utilisateur courant"""
    is_group: bool
    group_type: str
    tenant_id: int
    tenant_name: str
    subsidiaries: List[SubsidiaryItem] = []
    allowed_subsidiaries: int = 0
    used_subsidiaries: int = 0
    remaining_subsidiaries: int = 0
    parent_tenant_id: Optional[int] = None
    parent_tenant_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================
# ENDPOINTS UTILISATEUR (groupe courant)
# ============================================

# ============================================
# ENDPOINTS UTILISATEUR — demande de conversion
# ============================================

@router.post("/request-conversion", response_model=ConversionRequestResponse, summary="Demander à devenir un groupe ou ajouter des filiales")
def request_group_conversion(
    body: RequestGroupConversionBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permet à un admin de :
    - Demander la conversion en groupe (tenant standalone)
    - Demander un quota supplémentaire de filiales (tenant déjà groupe)
    """
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    if tenant.group_type == GroupType.subsidiary:
        raise HTTPException(status_code=400, detail="Une filiale ne peut pas devenir un groupe")

    # Vérifier si une demande en attente existe déjà
    existing = db.query(GroupConversionRequest).filter(
        GroupConversionRequest.tenant_id == tenant.id,
        GroupConversionRequest.status == GroupConversionStatus.pending,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Une demande est déjà en attente")

    nb = max(1, body.nb_subsidiaries or 1)
    is_extension_request = tenant.is_group or tenant.group_type == GroupType.group
    amount = calculate_quote(nb, include_base_fee=not is_extension_request)

    req = GroupConversionRequest(
        tenant_id=tenant.id,
        requested_by_user_id=current_user.id,
        requested_by_email=current_user.email,
        reason=body.reason,
        nb_subsidiaries=nb,
        contact_phone=body.contact_phone,
        quote_amount=amount,
        payment_status='unpaid',
        status=GroupConversionStatus.pending,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    _CONV_FIELDS = ['id','tenant_id','requested_by_email','reason','nb_subsidiaries','contact_phone','quote_amount','payment_status','payment_ref','status','reviewed_by_email','review_note','created_at','reviewed_at']
    return ConversionRequestResponse(
        **{c: getattr(req, c, None) for c in _CONV_FIELDS},
        tenant_name=tenant.name,
    )


@router.get("/request-conversion/status", response_model=Optional[ConversionRequestResponse], summary="Statut de la demande du tenant courant")
def get_my_conversion_request_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne la dernière demande de conversion du tenant courant (ou null)."""
    req = db.query(GroupConversionRequest).filter(
        GroupConversionRequest.tenant_id == current_user.tenant_id
    ).order_by(GroupConversionRequest.created_at.desc()).first()
    if not req:
        return None
    tenant = db.query(Tenant).filter(Tenant.id == req.tenant_id).first()
    _CONV_FIELDS = ['id','tenant_id','requested_by_email','reason','nb_subsidiaries','contact_phone','quote_amount','payment_status','payment_ref','status','reviewed_by_email','review_note','created_at','reviewed_at']
    return ConversionRequestResponse(
        **{c: getattr(req, c, None) for c in _CONV_FIELDS},
        tenant_name=tenant.name if tenant else None,
    )


@router.post("/my-group/subsidiaries", summary="Créer une filiale (admin du groupe)")
def create_my_subsidiary(
    body: AddSubsidiaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permet à l'admin d'un groupe de créer une nouvelle filiale directement,
    sans passer par le SuperAdmin.
    """
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    if not tenant.is_group:
        raise HTTPException(status_code=400, detail="Votre organisation n'est pas encore un groupe")

    # Vérifier quota de filiales autorisées (demandes approuvées)
    allowed_subs, used_subs, remaining_subs = ensure_group_quota_available(db, tenant.id, needed=1)

    if not body.name or not body.slug:
        raise HTTPException(status_code=400, detail="Le nom et l'identifiant (slug) sont requis")

    if not body.admin_email or not body.admin_password:
        raise HTTPException(status_code=400, detail="L'email admin et le mot de passe admin sont requis")

    existing = db.query(Tenant).filter(Tenant.slug == body.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"L'identifiant '{body.slug}' est déjà utilisé")

    admin_email = body.admin_email.lower().strip()
    existing_admin = db.query(User).filter(func.lower(User.email) == admin_email).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Cet email admin est déjà utilisé")

    if len(body.admin_password.strip()) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe admin doit contenir au moins 8 caractères")

    from app.core.tenant_admin import create_tenant_admin

    try:
        new_sub = Tenant(
            name=body.name,
            slug=body.slug,
            email=body.email or admin_email,
            parent_tenant_id=tenant.id,
            group_type=GroupType.subsidiary,
            is_group=False,
            plan=tenant.plan,
            max_employees=tenant.max_employees,
            is_active=True,
            is_trial=True,
        )
        db.add(new_sub)
        db.flush()

        _emp, new_admin, _pwd = create_tenant_admin(
            db, new_sub,
            first_name="Admin",
            last_name=new_sub.name,
            password=body.admin_password,
            send_email=False,
        )

        db.commit()
        db.refresh(new_sub)
    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "message": f"Filiale '{new_sub.name}' créée avec succès",
        "subsidiary_id": new_sub.id,
        "subsidiary_slug": new_sub.slug,
        "admin_email": new_admin.email if new_admin else admin_email,
        "admin_user_id": new_admin.id if new_admin else None,
        "quota_allowed": allowed_subs,
        "quota_used": used_subs + 1,
        "quota_remaining": max(0, remaining_subs - 1),
    }


@router.get("/conversion-requests", response_model=List[ConversionRequestResponse], summary="[SuperAdmin] Liste des demandes")
def list_conversion_requests(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """SuperAdminTech : liste toutes les demandes de conversion (filtre par status optionnel)."""
    q = db.query(GroupConversionRequest)
    if status_filter:
        q = q.filter(GroupConversionRequest.status == status_filter)
    requests = q.order_by(GroupConversionRequest.created_at.desc()).all()
    result = []
    for req in requests:
        tenant = db.query(Tenant).filter(Tenant.id == req.tenant_id).first()
        result.append(ConversionRequestResponse(
            **{c: getattr(req, c, None) for c in ['id','tenant_id','requested_by_email','reason','nb_subsidiaries','contact_phone','quote_amount','payment_status','payment_ref','status','reviewed_by_email','review_note','created_at','reviewed_at']},
            tenant_name=tenant.name if tenant else None,
        ))
    return result


@router.post("/conversion-requests/{request_id}/review", response_model=ConversionRequestResponse, summary="[SuperAdmin] Approuver ou rejeter")
def review_conversion_request(
    request_id: int,
    body: ReviewConversionRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Approuve ou rejette une demande. Si approuvé, convertit automatiquement le tenant."""
    req = db.query(GroupConversionRequest).filter(GroupConversionRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if req.status != GroupConversionStatus.pending:
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée")
    # Bloquer l'approbation si le paiement n'a pas été confirmé
    if body.approved and getattr(req, 'payment_status', 'unpaid') != 'paid':
        raise HTTPException(status_code=400, detail="Le paiement doit être confirmé avant d'approuver la demande")

    req.status = GroupConversionStatus.approved if body.approved else GroupConversionStatus.rejected
    req.reviewed_by_email = current_user.email
    req.review_note = body.note
    req.reviewed_at = datetime.now(timezone.utc)

    if body.approved:
        tenant = db.query(Tenant).filter(Tenant.id == req.tenant_id).first()
        if tenant:
            tenant.is_group = True
            tenant.group_type = GroupType.group
            # Incrémenter le quota de filiales du tenant
            nb = int(req.nb_subsidiaries or 1)
            current_quota = int(getattr(tenant, 'max_subsidiaries', 0) or 0)
            tenant.max_subsidiaries = current_quota + nb

    db.commit()
    db.refresh(req)
    tenant = db.query(Tenant).filter(Tenant.id == req.tenant_id).first()
    _CONV_FIELDS = ['id','tenant_id','requested_by_email','reason','nb_subsidiaries','contact_phone','quote_amount','payment_status','payment_ref','status','reviewed_by_email','review_note','created_at','reviewed_at']
    return ConversionRequestResponse(
        **{c: getattr(req, c, None) for c in _CONV_FIELDS},
        tenant_name=tenant.name if tenant else None,
    )


@router.post("/conversion-requests/{request_id}/mark-paid", response_model=ConversionRequestResponse, summary="[SuperAdmin] Confirmer le paiement")
def mark_conversion_paid(
    request_id: int,
    body: MarkPaidBody,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Marque le paiement d'une demande comme reçu (avant approbation)."""
    req = db.query(GroupConversionRequest).filter(GroupConversionRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if req.status != GroupConversionStatus.pending:
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée")

    req.payment_status = 'paid'  # type: ignore
    if body.payment_ref:
        req.payment_ref = body.payment_ref  # type: ignore
    db.commit()
    db.refresh(req)
    tenant = db.query(Tenant).filter(Tenant.id == req.tenant_id).first()
    _CONV_FIELDS = ['id','tenant_id','requested_by_email','reason','nb_subsidiaries','contact_phone','quote_amount','payment_status','payment_ref','status','reviewed_by_email','review_note','created_at','reviewed_at']
    return ConversionRequestResponse(
        **{c: getattr(req, c, None) for c in _CONV_FIELDS},
        tenant_name=tenant.name if tenant else None,
    )


@router.get("/my-context", response_model=MyGroupContextResponse, summary="Contexte groupe de l'utilisateur")
def get_my_group_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retourne les infos groupe/filiales du tenant de l'utilisateur connecté.
    Réservé aux rôles admin (DG), rh, et employés avec grade DG.
    """
    # Contrôle d'accès : admin, rh, ou employé DG
    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
        emp = db.query(Employee).filter(
            Employee.id == current_user.employee_id,
            Employee.tenant_id == current_user.tenant_id,
        ).first()
        if not emp or emp.role != EmployeeRole.dg:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        # SUPER_ADMIN sans tenant_id ou tenant supprimé — retourner un contexte vide non-groupe
        return MyGroupContextResponse(
            is_group=False,
            group_type="standalone",
            tenant_id=0,
            tenant_name="",
            subsidiaries=[],
            allowed_subsidiaries=0,
            used_subsidiaries=0,
            remaining_subsidiaries=0,
            parent_tenant_id=None,
            parent_tenant_name=None,
        )

    subsidiaries = []
    allowed_subsidiaries = 0
    used_subsidiaries = 0
    remaining_subsidiaries = 0
    if tenant.is_group:
        subs = db.query(Tenant).filter(Tenant.parent_tenant_id == tenant.id).all()
        allowed_subsidiaries = get_group_subsidiary_quota(db, tenant.id)
        used_subsidiaries = len(subs)
        remaining_subsidiaries = max(0, allowed_subsidiaries - used_subsidiaries)
        for sub in subs:
            count = db.query(func.count(Employee.id)).filter(
                Employee.tenant_id == sub.id,
                Employee.status == 'active'
            ).scalar() or 0
            subsidiaries.append(SubsidiaryItem(
                id=sub.id,
                name=sub.name,
                slug=sub.slug,
                logo_url=getattr(sub, 'logo_url', None),
                plan=sub.plan,
                is_active=sub.is_active,
                is_trial=sub.is_trial,
                employee_count=count,
            ))

    parent_tenant_id = None
    parent_tenant_name = None
    if tenant.group_type == GroupType.subsidiary and tenant.parent_tenant_id:
        parent = db.query(Tenant).filter(Tenant.id == tenant.parent_tenant_id).first()
        if parent:
            parent_tenant_id = parent.id
            parent_tenant_name = parent.name

    return MyGroupContextResponse(
        is_group=tenant.is_group,
        group_type=tenant.group_type.value,
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        subsidiaries=subsidiaries,
        allowed_subsidiaries=allowed_subsidiaries,
        used_subsidiaries=used_subsidiaries,
        remaining_subsidiaries=remaining_subsidiaries,
        parent_tenant_id=parent_tenant_id,
        parent_tenant_name=parent_tenant_name,
    )


@router.get("/my-subsidiary/{subsidiary_tenant_id}/stats", summary="Stats dashboard d'une filiale (pour groupe)")
def get_subsidiary_dashboard_stats(
    subsidiary_tenant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retourne les stats dashboard d'une filiale spécifique.
    Réservé aux rôles admin (DG), rh, et employés avec grade DG du groupe parent.
    """
    # Contrôle d'accès
    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
        emp = db.query(Employee).filter(
            Employee.id == current_user.employee_id,
            Employee.tenant_id == current_user.tenant_id,
        ).first()
        if not emp or emp.role != EmployeeRole.dg:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")

    # Vérifier que la filiale appartient bien au groupe de l'utilisateur
    sub = db.query(Tenant).filter(
        Tenant.id == subsidiary_tenant_id,
        Tenant.parent_tenant_id == current_user.tenant_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=403, detail="Filiale non autorisée ou introuvable")

    # Stats employés
    total_employees = db.query(func.count(Employee.id)).filter(
        Employee.tenant_id == subsidiary_tenant_id,
    ).scalar() or 0
    active_employees = db.query(func.count(Employee.id)).filter(
        Employee.tenant_id == subsidiary_tenant_id,
        Employee.status == "active",
    ).scalar() or 0

    # Stats congés
    pending_leaves = db.query(func.count(LeaveRequest.id)).filter(
        LeaveRequest.tenant_id == subsidiary_tenant_id,
        LeaveRequest.status == "pending",
    ).scalar() or 0

    # Stats départements
    from app.models.department import Department
    departments_count = db.query(func.count(Department.id)).filter(
        Department.tenant_id == subsidiary_tenant_id,
    ).scalar() or 0

    return {
        "subsidiary_id": subsidiary_tenant_id,
        "subsidiary_name": sub.name,
        "total_employees": total_employees,
        "active_employees": active_employees,
        "pending_leaves": pending_leaves,
        "departments_count": departments_count,
        "is_active": sub.is_active,
    }


@router.get("/my-stats", summary="Stats agrégées du groupe courant")
def get_my_group_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stats agrégées (employés, congés) pour le groupe de l'utilisateur courant.
    """
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant or not tenant.is_group:
        raise HTTPException(status_code=400, detail="Ce tenant n'est pas un groupe")

    subs = db.query(Tenant).filter(Tenant.parent_tenant_id == tenant.id).all()

    total_employees = 0
    pending_leaves = 0
    subsidiaries_stats = []

    for sub in subs:
        emp_count = db.query(func.count(Employee.id)).filter(
            Employee.tenant_id == sub.id,
            Employee.status == 'active'
        ).scalar() or 0

        pending = db.query(func.count(LeaveRequest.id)).filter(
            LeaveRequest.tenant_id == sub.id,
            LeaveRequest.status == 'pending'
        ).scalar() or 0

        total_employees += emp_count
        pending_leaves += pending

        subsidiaries_stats.append({
            "id": sub.id,
            "name": sub.name,
            "slug": sub.slug,
            "employee_count": emp_count,
            "pending_leaves": pending,
        })

    return {
        "group_id": tenant.id,
        "group_name": tenant.name,
        "total_employees": total_employees,
        "total_subsidiaries": len(subs),
        "pending_leaves": pending_leaves,
        "subsidiaries_stats": subsidiaries_stats,
    }


@router.get("/global-dashboard", summary="Dashboard global du groupe — données agrégées toutes filiales")
def get_group_global_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retourne les stats agrégées de TOUTES les filiales du groupe.
    Chaque filiale est détaillée + totaux consolidés.
    Réservé Admin, RH, DG.
    """
    # Vérification accès
    if current_user.role not in [UserRole.ADMIN, UserRole.RH, UserRole.SUPER_ADMIN]:
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
        emp = db.query(Employee).filter(
            Employee.id == current_user.employee_id,
            Employee.tenant_id == current_user.tenant_id,
        ).first()
        if not emp or emp.role != EmployeeRole.dg:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant or not tenant.is_group:
        raise HTTPException(status_code=400, detail="Ce tenant n'est pas un groupe")

    subs = db.query(Tenant).filter(Tenant.parent_tenant_id == tenant.id).all()

    from app.models.department import Department

    total_employees = 0
    active_employees = 0
    pending_leaves = 0
    departments_count = 0
    subsidiaries_details = []

    # 1. Inclure les employés du groupe lui-même (siège / HQ)
    grp_total = db.query(func.count(Employee.id)).filter(
        Employee.tenant_id == tenant.id,
    ).scalar() or 0
    grp_active = db.query(func.count(Employee.id)).filter(
        Employee.tenant_id == tenant.id,
        Employee.status == "active",
    ).scalar() or 0
    grp_pending = db.query(func.count(LeaveRequest.id)).filter(
        LeaveRequest.tenant_id == tenant.id,
        LeaveRequest.status == "pending",
    ).scalar() or 0
    grp_depts = db.query(func.count(Department.id)).filter(
        Department.tenant_id == tenant.id,
    ).scalar() or 0

    total_employees += grp_total
    active_employees += grp_active
    pending_leaves += grp_pending
    departments_count += grp_depts

    # Ajouter le groupe lui-même comme première entrée (siège) si il a des données
    if grp_total > 0 or grp_depts > 0:
        subsidiaries_details.append({
            "subsidiary_id": tenant.id,
            "subsidiary_name": f"{tenant.name} (Siège)",
            "total_employees": grp_total,
            "active_employees": grp_active,
            "pending_leaves": grp_pending,
            "departments_count": grp_depts,
            "is_active": tenant.is_active,
        })

    # 2. Ajouter chaque filiale
    for sub in subs:
        sub_total = db.query(func.count(Employee.id)).filter(
            Employee.tenant_id == sub.id,
        ).scalar() or 0
        sub_active = db.query(func.count(Employee.id)).filter(
            Employee.tenant_id == sub.id,
            Employee.status == "active",
        ).scalar() or 0
        sub_pending = db.query(func.count(LeaveRequest.id)).filter(
            LeaveRequest.tenant_id == sub.id,
            LeaveRequest.status == "pending",
        ).scalar() or 0
        sub_depts = db.query(func.count(Department.id)).filter(
            Department.tenant_id == sub.id,
        ).scalar() or 0

        total_employees += sub_total
        active_employees += sub_active
        pending_leaves += sub_pending
        departments_count += sub_depts

        subsidiaries_details.append({
            "subsidiary_id": sub.id,
            "subsidiary_name": sub.name,
            "total_employees": sub_total,
            "active_employees": sub_active,
            "pending_leaves": sub_pending,
            "departments_count": sub_depts,
            "is_active": sub.is_active,
        })

    return {
        "group_id": tenant.id,
        "group_name": tenant.name,
        "subsidiaries_count": len(subs),
        "total_employees": total_employees,
        "active_employees": active_employees,
        "pending_leaves": pending_leaves,
        "departments_count": departments_count,
        "subsidiaries": subsidiaries_details,
    }


# ============================================
# ENDPOINTS SUPER ADMIN (gestion plateforme)
# ============================================

@router.post("/tenants/{tenant_id}/convert-to-group", summary="Convertir un tenant en groupe")
def convert_to_group(
    tenant_id: int,
    body: ConvertToGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """
    Bascule un tenant standalone en mode Groupe.
    Il peut ensuite avoir des filiales rattachées.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    if tenant.group_type == GroupType.subsidiary:
        raise HTTPException(
            status_code=400,
            detail="Ce tenant est déjà une filiale, il ne peut pas devenir un groupe directement."
        )

    if tenant.group_type == GroupType.group:
        raise HTTPException(status_code=400, detail="Ce tenant est déjà un groupe")

    tenant.group_type = GroupType.group
    tenant.is_group = True
    tenant.max_subsidiaries = body.nb_subsidiaries
    db.commit()
    db.refresh(tenant)

    return {
        "success": True,
        "message": f"'{tenant.name}' est maintenant un groupe avec un quota de {body.nb_subsidiaries} filiale(s).",
        "tenant_id": tenant.id,
        "group_type": tenant.group_type.value,
        "max_subsidiaries": tenant.max_subsidiaries,
    }


@router.patch("/tenants/{tenant_id}/max-subsidiaries", summary="[SuperAdmin] Modifier le quota de filiales d'un groupe")
def update_max_subsidiaries(
    tenant_id: int,
    body: UpdateMaxSubsidiariesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """
    Permet au SuperAdmin de modifier directement le nombre de filiales autorisées
    pour un groupe, sans passer par le flux de demande/approbation.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")
    if not tenant.is_group:
        raise HTTPException(status_code=400, detail="Ce tenant n'est pas un groupe")

    # Vérifier que le nouveau quota ne descend pas en dessous du nombre actuel de filiales
    currently_used = get_group_subsidiary_usage(db, tenant_id)
    if body.max_subsidiaries < currently_used:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible : {currently_used} filiale(s) sont déjà rattachées. Le quota ne peut pas être inférieur."
        )

    old_quota = int(getattr(tenant, 'max_subsidiaries', 0) or 0)
    tenant.max_subsidiaries = body.max_subsidiaries
    db.commit()

    return {
        "success": True,
        "message": f"Quota de filiales mis à jour : {old_quota} → {body.max_subsidiaries}",
        "tenant_id": tenant_id,
        "max_subsidiaries": body.max_subsidiaries,
        "used_subsidiaries": currently_used,
        "remaining_subsidiaries": max(0, body.max_subsidiaries - currently_used),
    }


@router.post("/tenants/{tenant_id}/revert-to-standalone", summary="Repasser un groupe en standalone")
def revert_to_standalone(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """
    Repasse un groupe en standalone (uniquement si aucune filiale rattachée).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    if tenant.group_type != GroupType.group:
        raise HTTPException(status_code=400, detail="Ce tenant n'est pas un groupe")

    # Vérifier qu'il n'y a plus de filiales
    sub_count = db.query(func.count(Tenant.id)).filter(Tenant.parent_tenant_id == tenant_id).scalar()
    if sub_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible : {sub_count} filiale(s) sont encore rattachées. Détachez-les d'abord."
        )

    tenant.group_type = GroupType.standalone
    tenant.is_group = False
    db.commit()

    return {"success": True, "message": f"'{tenant.name}' est repassé en mode standalone."}


@router.post("/{group_id}/subsidiaries", summary="Rattacher ou créer une filiale")
def add_subsidiary(
    group_id: int,
    body: AddSubsidiaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """
    Deux modes :
    - Rattacher un tenant existant (par slug) comme filiale du groupe
    - Créer un nouveau tenant filiale
    """
    group = db.query(Tenant).filter(Tenant.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")
    if not group.is_group:
        raise HTTPException(status_code=400, detail="Ce tenant n'est pas un groupe")

    # Vérifier quota de filiales autorisées (demandes approuvées)
    ensure_group_quota_available(db, group_id, needed=1)

    # Option A : rattacher un tenant existant
    if body.existing_tenant_slug:
        subsidiary = db.query(Tenant).filter(Tenant.slug == body.existing_tenant_slug).first()
        if not subsidiary:
            raise HTTPException(status_code=404, detail=f"Tenant '{body.existing_tenant_slug}' non trouvé")
        if subsidiary.id == group_id:
            raise HTTPException(status_code=400, detail="Un groupe ne peut pas être sa propre filiale")
        if subsidiary.is_group:
            raise HTTPException(status_code=400, detail="Un groupe ne peut pas être filiale d'un autre groupe")
        if subsidiary.parent_tenant_id:
            raise HTTPException(status_code=400, detail="Ce tenant est déjà filiale d'un autre groupe")

        subsidiary.parent_tenant_id = group_id
        subsidiary.group_type = GroupType.subsidiary
        db.commit()
        db.refresh(subsidiary)
        return {
            "success": True,
            "message": f"'{subsidiary.name}' est maintenant filiale de '{group.name}'",
            "subsidiary_id": subsidiary.id,
        }

    # Option B : créer un nouveau tenant filiale
    if not body.name or not body.slug:
        raise HTTPException(status_code=400, detail="name et slug requis pour créer une nouvelle filiale")

    existing = db.query(Tenant).filter(Tenant.slug == body.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Le slug '{body.slug}' est déjà utilisé")

    from app.core.tenant_admin import create_tenant_admin

    new_sub = Tenant(
        name=body.name,
        slug=body.slug,
        email=body.email,
        parent_tenant_id=group_id,
        group_type=GroupType.subsidiary,
        is_group=False,
        plan=group.plan,
        max_employees=group.max_employees,
        is_active=True,
        is_trial=True,
    )
    db.add(new_sub)
    db.flush()

    # Créer l'admin (Employee + User) si un email est fourni
    if new_sub.email:
        password = body.admin_password if hasattr(body, 'admin_password') and body.admin_password else None
        create_tenant_admin(db, new_sub, password=password, send_email=password is None)

    db.commit()
    db.refresh(new_sub)

    return {
        "success": True,
        "message": f"Filiale '{new_sub.name}' créée et rattachée à '{group.name}'",
        "subsidiary_id": new_sub.id,
    }


@router.delete("/{group_id}/subsidiaries/{subsidiary_id}", summary="Détacher une filiale")
def detach_subsidiary(
    group_id: int,
    subsidiary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """
    Détache une filiale de son groupe (elle redevient standalone).
    Les données de la filiale sont conservées.
    """
    subsidiary = db.query(Tenant).filter(
        Tenant.id == subsidiary_id,
        Tenant.parent_tenant_id == group_id
    ).first()
    if not subsidiary:
        raise HTTPException(status_code=404, detail="Filiale non trouvée dans ce groupe")

    subsidiary.parent_tenant_id = None
    subsidiary.group_type = GroupType.standalone
    db.commit()

    return {
        "success": True,
        "message": f"'{subsidiary.name}' est détachée du groupe et redevient standalone.",
    }


@router.get("/{group_id}/subsidiaries", response_model=List[SubsidiaryItem], summary="Lister les filiales")
def list_subsidiaries(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Liste toutes les filiales d'un groupe avec leur nombre d'employés."""
    group = db.query(Tenant).filter(Tenant.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    subsidiaries = db.query(Tenant).filter(Tenant.parent_tenant_id == group_id).all()

    result = []
    for sub in subsidiaries:
        emp_count = db.query(func.count(Employee.id)).filter(Employee.tenant_id == sub.id).scalar() or 0
        result.append(SubsidiaryItem(
            id=sub.id,
            name=sub.name,
            slug=sub.slug,
            logo_url=sub.logo_url,
            plan=sub.plan,
            is_active=sub.is_active,
            is_trial=sub.is_trial,
            employee_count=emp_count,
        ))
    return result


@router.get("/{group_id}/stats", response_model=GroupStatsResponse, summary="Stats agrégées du groupe")
def get_group_stats(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """
    Retourne les stats agrégées de toutes les filiales d'un groupe :
    - Nombre total d'employés
    - Congés en attente
    - Détail par filiale
    """
    group = db.query(Tenant).filter(Tenant.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    subsidiaries = db.query(Tenant).filter(Tenant.parent_tenant_id == group_id).all()
    all_tenant_ids = [sub.id for sub in subsidiaries]

    total_employees = 0
    pending_leaves = 0
    subsidiaries_detail = []

    for sub in subsidiaries:
        emp_count = db.query(func.count(Employee.id)).filter(Employee.tenant_id == sub.id).scalar() or 0
        leaves_count = db.query(func.count(LeaveRequest.id)).filter(
            LeaveRequest.tenant_id == sub.id,
            LeaveRequest.status == "pending"
        ).scalar() or 0

        total_employees += emp_count
        pending_leaves += leaves_count
        subsidiaries_detail.append({
            "id": sub.id,
            "name": sub.name,
            "slug": sub.slug,
            "employee_count": emp_count,
            "pending_leaves": leaves_count,
            "is_active": sub.is_active,
        })

    return GroupStatsResponse(
        group_id=group_id,
        group_name=group.name,
        total_employees=total_employees,
        total_subsidiaries=len(subsidiaries),
        pending_leaves=pending_leaves,
        subsidiaries=subsidiaries_detail,
    )
