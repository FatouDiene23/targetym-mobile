"""
API Platform Admin - Gestion plateforme pour SUPER_ADMIN tech
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.api.deps import require_super_admin
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.chat import ChatMessage
from app.models.support_audit_log import SupportAuditLog
from app.core.security import hash_password, create_access_token
from app.services.email_service import send_tenant_welcome_email

router = APIRouter()


# ============================================
# HELPER: audit logging
# ============================================

def log_audit(
    db: Session,
    agent: User,
    action_type: str,
    action_detail: Optional[dict] = None,
    target_user: Optional[User] = None,
    target_tenant: Optional[Tenant] = None,
    ip_address: Optional[str] = None,
) -> SupportAuditLog:
    """Enregistre une action dans support_audit_logs."""
    log = SupportAuditLog(
        agent_id=agent.id,
        agent_email=agent.email,
        target_user_id=target_user.id if target_user else None,
        target_user_email=target_user.email if target_user else None,
        target_tenant_id=target_tenant.id if target_tenant else None,
        target_tenant_name=target_tenant.name if target_tenant else None,
        action_type=action_type,
        action_detail=action_detail,
        ip_address=ip_address,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ============================================
# SCHEMAS
# ============================================

class PlatformStats(BaseModel):
    """Statistiques globales de la plateforme"""
    total_tenants: int = 0
    active_tenants: int = 0
    trial_tenants: int = 0
    total_users: int = 0
    active_users: int = 0
    total_employees: int = 0
    total_messages_today: int = 0
    total_leave_requests_pending: int = 0
    
    # Évolution
    new_tenants_this_month: int = 0
    new_users_this_month: int = 0
    
    class Config:
        from_attributes = True


class TenantListItem(BaseModel):
    """Item dans la liste des tenants"""
    id: int
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    plan: Optional[str] = "trial"
    is_trial: Optional[bool] = True
    is_active: Optional[bool] = False
    trial_starts_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    activation_note: Optional[str] = None
    block_reason: Optional[str] = None
    max_employees: Optional[int] = 10
    created_at: Optional[datetime] = None
    # Statut calculé : pending | trial_active | trial_expired | subscribed | blocked
    computed_status: Optional[str] = "pending"
    trial_days_remaining: Optional[int] = 0

    # Stats calculées
    users_count: int = 0
    employees_count: int = 0
    is_group: bool = False
    group_type: str = "standalone"
    parent_tenant_id: Optional[int] = None

    class Config:
        from_attributes = True


class UserListItem(BaseModel):
    """Item dans la liste des users"""
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.EMPLOYEE
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    employee_id: Optional[int] = None
    is_active: Optional[bool] = True
    is_verified: Optional[bool] = False
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Création d'un user"""
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE
    tenant_id: Optional[int] = None
    employee_id: Optional[int] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    """Mise à jour d'un user"""
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    tenant_id: Optional[int] = None
    employee_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class TenantDetail(BaseModel):
    """Détail complet d'un tenant pour le back-office"""
    id: int
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    plan: Optional[str] = "trial"
    is_trial: Optional[bool] = True
    is_active: Optional[bool] = True
    trial_ends_at: Optional[datetime] = None
    max_employees: Optional[int] = 10
    currency: Optional[str] = "XOF"
    timezone: Optional[str] = "Africa/Dakar"
    require_2fa: Optional[bool] = False
    intowork_company_id: Optional[int] = None
    intowork_linked_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    users_count: int = 0
    employees_count: int = 0
    trial_days_remaining: int = 0
    is_group: bool = False
    group_type: str = "standalone"
    parent_tenant_id: Optional[int] = None

    class Config:
        from_attributes = True


class TenantUpdate(BaseModel):
    """Champs modifiables par le SUPER_ADMIN"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    plan: Optional[str] = None
    max_employees: Optional[int] = None
    is_active: Optional[bool] = None
    is_trial: Optional[bool] = None
    trial_ends_at: Optional[datetime] = None
    require_2fa: Optional[bool] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None


class ImpersonationResponse(BaseModel):
    """Token d'impersonation limité à 30 minutes"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 1800
    impersonated_user_id: int
    impersonated_user_email: str
    impersonated_tenant_id: Optional[int] = None
    # Données profil pour mettre à jour le sidebar
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    employee_id: Optional[int] = None
    employee_role: Optional[str] = "employee"  # 'employee'|'manager'|'rh'|'admin'|'dg'
    user_role: Optional[str] = "employee"      # Rôle système User (source de vérité pour le sidebar)
    is_manager: Optional[bool] = False
    tenant_slug: Optional[str] = None
    warning: str = "Ce token expire dans 30 minutes. Usage loggué."


class AuditLogItem(BaseModel):
    id: int
    agent_email: str
    target_user_email: Optional[str] = None
    target_tenant_name: Optional[str] = None
    action_type: str
    action_detail: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SearchResult(BaseModel):
    tenants: List[TenantListItem] = []
    users: List[UserListItem] = []
    query: str
    total_tenants: int = 0
    total_users: int = 0


# ============================================
# ENDPOINTS - RECHERCHE UNIFIÉE
# ============================================

@router.get("/search", response_model=SearchResult)
async def unified_search(
    q: str = Query(..., min_length=1, description="Email, nom, ID ou slug"),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Recherche cross-tables: tenants + users par email, nom, ID ou slug."""
    search = q.strip().lower()
    is_id = search.isdigit()
    id_val = int(search) if is_id else None

    tenant_query = db.query(Tenant)
    if is_id:
        tenant_query = tenant_query.filter(Tenant.id == id_val)
    else:
        tenant_query = tenant_query.filter(
            or_(Tenant.name.ilike(f"%{search}%"), Tenant.email.ilike(f"%{search}%"), Tenant.slug.ilike(f"%{search}%"))
        )
    tenants_raw = tenant_query.limit(20).all()
    tenant_results = []
    for t in tenants_raw:
        uc = db.query(func.count(User.id)).filter(User.tenant_id == t.id).scalar() or 0
        ec = db.query(func.count(Employee.id)).filter(Employee.tenant_id == t.id).scalar() or 0
        tenant_results.append(TenantListItem(
            id=t.id, name=t.name, slug=t.slug, email=t.email, plan=t.plan or "trial",
            is_trial=t.is_trial, is_active=t.is_active, trial_ends_at=t.trial_ends_at,
            max_employees=t.max_employees or 10, created_at=t.created_at, users_count=uc, employees_count=ec,
        ))

    user_query = db.query(User)
    if is_id:
        user_query = user_query.filter(User.id == id_val)
    else:
        user_query = user_query.filter(
            or_(User.email.ilike(f"%{search}%"), User.first_name.ilike(f"%{search}%"), User.last_name.ilike(f"%{search}%"))
        )
    users_raw = user_query.limit(20).all()
    user_results = []
    for u in users_raw:
        tname = None
        if u.tenant_id:
            t = db.query(Tenant).filter(Tenant.id == u.tenant_id).first()
            if t:
                tname = t.name
        user_results.append(UserListItem(
            id=u.id, email=u.email, first_name=u.first_name, last_name=u.last_name,
            role=u.role or UserRole.EMPLOYEE, tenant_id=u.tenant_id, tenant_name=tname,
            employee_id=u.employee_id, is_active=u.is_active, is_verified=u.is_verified,
            created_at=u.created_at, last_login=u.last_login,
        ))

    log_audit(db, agent=current_user, action_type="VIEW_SEARCH",
              action_detail={"query": q, "tenants_found": len(tenant_results), "users_found": len(user_results)},
              ip_address=request.client.host if request else None)

    return SearchResult(query=q, tenants=tenant_results, users=user_results,
                        total_tenants=len(tenant_results), total_users=len(user_results))


# ============================================
# ENDPOINTS - STATS PLATEFORME
# ============================================

@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Statistiques globales de la plateforme
    Accessible uniquement aux SUPER_ADMIN
    """
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Tenants
    total_tenants = db.query(func.count(Tenant.id)).scalar() or 0
    active_tenants = db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar() or 0
    trial_tenants = db.query(func.count(Tenant.id)).filter(Tenant.is_trial == True).scalar() or 0
    new_tenants = db.query(func.count(Tenant.id)).filter(Tenant.created_at >= month_ago).scalar() or 0
    
    # Users
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    new_users = db.query(func.count(User.id)).filter(User.created_at >= month_ago).scalar() or 0
    
    # Employees
    total_employees = db.query(func.count(Employee.id)).scalar() or 0
    
    # Messages AI aujourd'hui
    total_messages = db.query(func.count(ChatMessage.id)).filter(
        ChatMessage.created_at >= today_start
    ).scalar() or 0
    
    # Demandes de congé en attente
    pending_leaves = db.query(func.count(LeaveRequest.id)).filter(
        LeaveRequest.status == "pending"
    ).scalar() or 0
    
    return PlatformStats(
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        trial_tenants=trial_tenants,
        total_users=total_users,
        active_users=active_users,
        total_employees=total_employees,
        total_messages_today=total_messages,
        total_leave_requests_pending=pending_leaves,
        new_tenants_this_month=new_tenants,
        new_users_this_month=new_users
    )


# ============================================
# ENDPOINTS - TENANTS
# ============================================

@router.get("/tenants", response_model=List[TenantListItem])
async def get_all_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    plan: Optional[str] = None,
    is_active: Optional[bool] = None,
    status: Optional[str] = Query(None, description="pending|active|expired|subscribed|all"),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Liste tous les tenants avec filtres (dont status back-office)
    """
    now = datetime.now(timezone.utc)
    query = db.query(Tenant)

    # Filtre status back-office
    if status == "pending":
        # En attente = pas encore activé (is_active=False) et non bloqué (block_reason IS NULL)
        query = query.filter(Tenant.is_active == False, Tenant.block_reason == None)  # noqa
    elif status == "active":
        query = query.filter(
            Tenant.is_active == True,
            Tenant.is_trial == True,
            Tenant.trial_ends_at != None,
            Tenant.trial_ends_at > now
        )
    elif status == "expired":
        query = query.filter(
            Tenant.is_active == True,
            Tenant.is_trial == True,
            Tenant.trial_ends_at != None,
            Tenant.trial_ends_at <= now
        )
    elif status == "subscribed":
        query = query.filter(Tenant.is_active == True, Tenant.is_trial == False)
    # status == "all" ou None → pas de filtre status

    # Filtres classiques
    if search:
        query = query.filter(
            or_(
                Tenant.name.ilike(f"%{search}%"),
                Tenant.email.ilike(f"%{search}%"),
                Tenant.slug.ilike(f"%{search}%")
            )
        )

    if plan:
        query = query.filter(Tenant.plan == plan)

    if is_active is not None and status is None:
        query = query.filter(Tenant.is_active == is_active)

    # Trier par création (plus récents en premier)
    query = query.order_by(Tenant.created_at.desc())

    tenants = query.offset(skip).limit(limit).all()

    # Enrichir avec stats et statut calculé
    result = []
    for tenant in tenants:
        users_count = db.query(func.count(User.id)).filter(User.tenant_id == tenant.id).scalar() or 0
        employees_count = db.query(func.count(Employee.id)).filter(Employee.tenant_id == tenant.id).scalar() or 0

        # Calculer le statut
        # "pending" = pas encore activé (is_active=False) et non bloqué (block_reason IS NULL)
        # "blocked" = explicitement bloqué par l'admin (block_reason est renseigné)
        if not tenant.is_active and tenant.block_reason is None:
            computed_status = "pending"
        elif not tenant.is_active:
            computed_status = "blocked"
        elif tenant.is_trial and tenant.trial_ends_at and tenant.trial_ends_at > now:
            computed_status = "trial_active"
        elif tenant.is_trial and tenant.trial_ends_at and tenant.trial_ends_at <= now:
            computed_status = "trial_expired"
        elif not tenant.is_trial:
            computed_status = "subscribed"
        else:
            computed_status = "pending"

        days_remaining = 0
        if tenant.is_trial and tenant.trial_ends_at and tenant.trial_ends_at > now:
            days_remaining = (tenant.trial_ends_at - now).days

        result.append(TenantListItem(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            email=tenant.email,
            phone=tenant.phone,
            plan=tenant.plan if tenant.plan is not None else "trial",
            is_trial=tenant.is_trial if tenant.is_trial is not None else True,
            is_active=tenant.is_active if tenant.is_active is not None else False,
            trial_starts_at=tenant.trial_starts_at,
            trial_ends_at=tenant.trial_ends_at,
            activation_note=tenant.activation_note,
            block_reason=tenant.block_reason,
            max_employees=tenant.max_employees if tenant.max_employees is not None else 10,
            created_at=tenant.created_at,
            computed_status=computed_status,
            trial_days_remaining=days_remaining,
            users_count=users_count,
            employees_count=employees_count,
            is_group=tenant.is_group or False,
            group_type=tenant.group_type.value if tenant.group_type else "standalone",
            parent_tenant_id=tenant.parent_tenant_id,
        ))

    return result


@router.get("/tenants/{tenant_id}", response_model=TenantDetail)
async def get_tenant_detail(
    tenant_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Détail complet d'un tenant (plan, statut, stats). Action loggée."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    uc = db.query(func.count(User.id)).filter(User.tenant_id == tenant.id).scalar() or 0
    ec = db.query(func.count(Employee.id)).filter(Employee.tenant_id == tenant.id).scalar() or 0

    log_audit(db, agent=current_user, action_type="VIEW",
              action_detail={"target": f"tenant:{tenant.id}:{tenant.name}"},
              target_tenant=tenant, ip_address=request.client.host if request else None)

    return TenantDetail(
        id=tenant.id, name=tenant.name, slug=tenant.slug, email=tenant.email,
        phone=tenant.phone, address=tenant.address, logo_url=tenant.logo_url,
        plan=tenant.plan or "trial", is_trial=tenant.is_trial, is_active=tenant.is_active,
        trial_ends_at=tenant.trial_ends_at, max_employees=tenant.max_employees or 10,
        currency=tenant.currency or "XOF", timezone=tenant.timezone or "Africa/Dakar",
        require_2fa=tenant.require_2fa or False,
        intowork_company_id=tenant.intowork_company_id,
        intowork_linked_at=tenant.intowork_linked_at,
        created_at=tenant.created_at, updated_at=tenant.updated_at,
        users_count=uc, employees_count=ec,
        trial_days_remaining=tenant.trial_days_remaining,
        is_group=tenant.is_group or False,
        group_type=tenant.group_type.value if tenant.group_type else "standalone",
        parent_tenant_id=tenant.parent_tenant_id,
    )


@router.put("/tenants/{tenant_id}", response_model=TenantDetail)
async def update_tenant(
    tenant_id: int,
    data: TenantUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Met à jour la config d'un tenant (plan, max_employees, statut, trial). Action loggée."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    changed_fields = {}
    for field in ["name", "email", "phone", "plan", "max_employees", "is_active", "is_trial",
                  "trial_ends_at", "require_2fa", "currency", "timezone"]:
        val = getattr(data, field)
        if val is not None:
            old_val = getattr(tenant, field)
            if old_val != val:
                changed_fields[field] = {"from": str(old_val), "to": str(val)}
                setattr(tenant, field, val)

    db.commit()
    db.refresh(tenant)

    uc = db.query(func.count(User.id)).filter(User.tenant_id == tenant.id).scalar() or 0
    ec = db.query(func.count(Employee.id)).filter(Employee.tenant_id == tenant.id).scalar() or 0

    log_audit(db, agent=current_user, action_type="EDIT",
              action_detail={"target": f"tenant:{tenant.id}", "changes": changed_fields},
              target_tenant=tenant, ip_address=request.client.host if request else None)

    return TenantDetail(
        id=tenant.id, name=tenant.name, slug=tenant.slug, email=tenant.email,
        phone=tenant.phone, address=tenant.address, logo_url=tenant.logo_url,
        plan=tenant.plan or "trial", is_trial=tenant.is_trial, is_active=tenant.is_active,
        trial_ends_at=tenant.trial_ends_at, max_employees=tenant.max_employees or 10,
        currency=tenant.currency or "XOF", timezone=tenant.timezone or "Africa/Dakar",
        require_2fa=tenant.require_2fa or False,
        intowork_company_id=tenant.intowork_company_id,
        intowork_linked_at=tenant.intowork_linked_at,
        created_at=tenant.created_at, updated_at=tenant.updated_at,
        users_count=uc, employees_count=ec,
        trial_days_remaining=tenant.trial_days_remaining,
        is_group=tenant.is_group or False,
        group_type=tenant.group_type.value if tenant.group_type else "standalone",
        parent_tenant_id=tenant.parent_tenant_id,
    )


# ============================================
# ENDPOINTS - TRIAL ACTIVATION
# ============================================

TRIAL_DAYS = 30  # Durée de l'essai gratuit après activation

@router.patch("/tenants/{tenant_id}/activate")
async def activate_tenant_trial(
    tenant_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Active manuellement un tenant en trial.
    - is_active = True
    - trial_ends_at = now() + 30 jours
    - Envoie un email de bienvenue au tenant admin
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    if tenant.is_active:
        raise HTTPException(status_code=400, detail="Ce tenant est déjà actif")

    now = datetime.now(timezone.utc)
    tenant.is_active = True
    tenant.trial_ends_at = now + timedelta(days=TRIAL_DAYS)
    db.commit()
    db.refresh(tenant)

    # Envoyer email de bienvenue au premier admin du tenant
    email_result = None
    admin_user = (
        db.query(User)
        .filter(User.tenant_id == tenant.id, User.role == UserRole.ADMIN)
        .first()
    )
    if admin_user:
        try:
            from app.services.email_service import send_trial_activation_email
            email_result = send_trial_activation_email(
                to_email=admin_user.email,
                first_name=admin_user.first_name or "Admin",
                company_name=tenant.name,
                trial_days=TRIAL_DAYS,
            )
        except Exception as e:
            email_result = {"sent": False, "error": str(e)}

    # Audit log
    log_audit(
        db,
        agent=current_user,
        action_type="ACTIVATE_TRIAL",
        action_detail={
            "target": f"tenant:{tenant.id}",
            "trial_ends_at": tenant.trial_ends_at.isoformat(),
            "email_sent": email_result.get("sent") if email_result else False,
        },
        target_tenant=tenant,
        ip_address=request.client.host if request else None,
    )

    uc = db.query(func.count(User.id)).filter(User.tenant_id == tenant.id).scalar() or 0
    ec = db.query(func.count(Employee.id)).filter(Employee.tenant_id == tenant.id).scalar() or 0

    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "is_active": tenant.is_active,
        "is_trial": tenant.is_trial,
        "trial_ends_at": tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
        "trial_days_remaining": tenant.trial_days_remaining,
        "max_employees": tenant.max_employees,
        "plan": tenant.plan,
        "users_count": uc,
        "employees_count": ec,
        "email_sent": email_result.get("sent") if email_result else False,
        "email_to": admin_user.email if admin_user else None,
    }


# ============================================
# ENDPOINTS - IMPERSONATION JWT
# ============================================

@router.post("/impersonate/{user_id}", response_model=ImpersonationResponse)
async def impersonate_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Génère un JWT temporaire (30 min) pour accéder au dashboard d'un user client.
    Interdit sur les SUPER_ADMIN. Action IMPERSONATE loggée obligatoirement.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if target.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Impossible d'impersonner un SUPER_ADMIN")

    token_data = {
        "sub": str(target.id),
        "email": target.email,
        "role": target.role.value if target.role else "EMPLOYEE",
        "tenant_id": target.tenant_id,
        "impersonated_by": current_user.email,
        "impersonation": True,
    }
    token = create_access_token(data=token_data, expires_delta=timedelta(minutes=30))

    log_audit(db, agent=current_user, action_type="IMPERSONATE",
              action_detail={"target_user_id": target.id, "target_email": target.email,
                             "target_tenant_id": target.tenant_id, "token_ttl": "30min"},
              target_user=target,
              ip_address=request.client.host if request else None)

    # Récupérer le profil employé pour les données sidebar
    employee = db.query(Employee).filter(
        Employee.email == target.email,
        Employee.tenant_id == target.tenant_id
    ).first()

    # Récupérer le slug du tenant
    tenant_slug = None
    if target.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == target.tenant_id).first()
        if tenant:
            tenant_slug = tenant.slug

    return ImpersonationResponse(
        access_token=token,
        impersonated_user_id=target.id,
        impersonated_user_email=target.email,
        impersonated_tenant_id=target.tenant_id,
        first_name=employee.first_name if employee else target.first_name,
        last_name=employee.last_name if employee else target.last_name,
        employee_id=employee.id if employee else None,
        employee_role=employee.role.value if employee and employee.role else "employee",
        user_role=target.role.value.lower() if target.role else "employee",
        is_manager=employee.is_manager if employee else False,
        tenant_slug=tenant_slug,
    )


# ============================================
# ENDPOINTS - USERS MANAGEMENT
# ============================================

@router.get("/users", response_model=List[UserListItem])
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    tenant_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Liste tous les users (cross-tenant) avec filtres
    """
    query = db.query(User)
    
    # Filtres
    if search:
        query = query.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%")
            )
        )
    
    if role:
        query = query.filter(User.role == role)
    
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # Trier par création (plus récents en premier)
    query = query.order_by(User.created_at.desc())
    
    # Pagination
    users = query.offset(skip).limit(limit).all()
    
    # Enrichir avec tenant_name
    result = []
    for user in users:
        tenant_name = None
        if user.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
            if tenant:
                tenant_name = tenant.name
        
        result.append(UserListItem(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role if user.role is not None else UserRole.EMPLOYEE,
            tenant_id=user.tenant_id,
            tenant_name=tenant_name,
            employee_id=user.employee_id,
            is_active=user.is_active if user.is_active is not None else True,
            is_verified=user.is_verified if user.is_verified is not None else False,
            created_at=user.created_at,
            last_login=user.last_login
        ))
    
    return result


@router.get("/users/{user_id}", response_model=UserListItem)
async def get_user_by_id(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Récupère un user par son ID. Action loggée."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    tenant_name = None
    if user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant:
            tenant_name = tenant.name

    log_audit(db, agent=current_user, action_type="VIEW",
              action_detail={"target": f"user:{user.id}:{user.email}"},
              target_user=user, ip_address=request.client.host if request else None)

    return UserListItem(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role if user.role is not None else UserRole.EMPLOYEE,
        tenant_id=user.tenant_id,
        tenant_name=tenant_name,
        employee_id=user.employee_id,
        is_active=user.is_active if user.is_active is not None else True,
        is_verified=user.is_verified if user.is_verified is not None else False,
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.post("/users", response_model=UserListItem)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Crée un nouveau user. Action loggée."""
    # Vérifier si email existe déjà
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )
    
    # Vérifier que le tenant existe si spécifié
    if data.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == data.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant non trouvé"
            )
    
    # Créer l'utilisateur
    new_user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        tenant_id=data.tenant_id,
        employee_id=data.employee_id,
        is_active=data.is_active,
        is_verified=True  # Vérifié par défaut quand créé par admin
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    tenant_name = None
    if new_user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == new_user.tenant_id).first()
        if tenant:
            tenant_name = tenant.name

    log_audit(db, agent=current_user, action_type="CREATE_USER",
              action_detail={"new_user_id": new_user.id, "email": new_user.email, "role": str(new_user.role)},
              target_user=new_user, ip_address=request.client.host if request else None)

    return UserListItem(
        id=new_user.id,
        email=new_user.email,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        role=new_user.role if new_user.role is not None else UserRole.EMPLOYEE,
        tenant_id=new_user.tenant_id,
        tenant_name=tenant_name,
        employee_id=new_user.employee_id,
        is_active=new_user.is_active if new_user.is_active is not None else True,
        is_verified=new_user.is_verified if new_user.is_verified is not None else False,
        created_at=new_user.created_at,
        last_login=new_user.last_login
    )


@router.put("/users/{user_id}", response_model=UserListItem)
async def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Met à jour un user. Action EDIT ou RESET loggée."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    # Vérifier email unique si changé
    if data.email and data.email != user.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un utilisateur avec cet email existe déjà"
            )
    
    # Mettre à jour les champs
    if data.email:
        user.email = data.email
    if data.password:
        user.hashed_password = hash_password(data.password)
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.role:
        user.role = data.role
    if data.tenant_id is not None:
        user.tenant_id = data.tenant_id
    if data.employee_id is not None:
        user.employee_id = data.employee_id
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_verified is not None:
        user.is_verified = data.is_verified
    
    db.commit()
    db.refresh(user)
    
    tenant_name = None
    if user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant:
            tenant_name = tenant.name

    action = "RESET" if data.password else "EDIT"
    log_audit(db, agent=current_user, action_type=action,
              action_detail={"target_user_id": user.id, "fields_updated": [k for k in vars(data) if getattr(data, k) is not None]},
              target_user=user, ip_address=request.client.host if request else None)

    return UserListItem(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role if user.role is not None else UserRole.EMPLOYEE,
        tenant_id=user.tenant_id,
        tenant_name=tenant_name,
        employee_id=user.employee_id,
        is_active=user.is_active if user.is_active is not None else True,
        is_verified=user.is_verified if user.is_verified is not None else False,
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Supprime un user. Action DELETE loggée avant suppression."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte"
        )

    # Log avant suppression pour conserver l'email dans l'historique
    log_audit(db, agent=current_user, action_type="DELETE",
              action_detail={"deleted_user_id": user.id, "deleted_email": user.email, "tenant_id": user.tenant_id},
              target_user=user, ip_address=request.client.host if request else None)

    db.delete(user)
    db.commit()

    return {"message": "Utilisateur supprimé avec succès"}


# ============================================
# ENDPOINTS - CREATE TENANT
# ============================================

class TenantCreateBody(BaseModel):
    company_name: str
    email: str
    first_name: str
    last_name: str
    password: str
    plan: str = "trial"
    max_employees: int = 10
    is_trial: bool = True


@router.post("/tenants", status_code=201)
async def create_tenant(
    data: TenantCreateBody,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """SuperAdminTech : crée un nouveau tenant + admin user + employee."""
    import re as _re

    # Vérifier unicité email
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email")

    # Générer slug unique
    base_slug = _re.sub(r'[^a-z0-9]+', '-', data.company_name.lower().strip()).strip('-')
    slug = base_slug
    counter = 1
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Créer Tenant
    trial_end = datetime.now(timezone.utc) + timedelta(days=30) if data.is_trial else None
    new_tenant = Tenant(
        name=data.company_name,
        slug=slug,
        email=data.email,
        plan=data.plan,
        max_employees=data.max_employees,
        is_trial=data.is_trial,
        trial_ends_at=trial_end,
        is_active=True,
    )
    db.add(new_tenant)
    db.flush()

    # Créer Employee + User admin via helper
    from app.core.tenant_admin import create_tenant_admin
    _emp, _user, _pwd = create_tenant_admin(
        db, new_tenant,
        first_name=data.first_name,
        last_name=data.last_name,
        password=data.password,
        send_email=False,
    )
    db.commit()
    db.refresh(new_tenant)

    log_audit(
        db, current_user,
        action_type="CREATE_TENANT",
        action_detail={"tenant_name": data.company_name, "slug": slug, "plan": data.plan},
        target_tenant=new_tenant,
        ip_address=request.client.host if request.client else None,
    )

    return {"id": new_tenant.id, "name": new_tenant.name, "slug": new_tenant.slug, "email": new_tenant.email}


# ============================================
# ENDPOINTS - AUDIT LOGS
# ============================================

@router.get("/audit-logs", response_model=List[AuditLogItem])
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action_type: Optional[str] = None,
    tenant_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Historique complet des actions SUPER_ADMIN.
    Filtrable par action_type (VIEW|IMPERSONATE|EDIT|RESET|DELETE|CREATE_USER|VIEW_SEARCH),
    tenant_id ou target_user_id.
    """
    query = db.query(SupportAuditLog)

    if action_type:
        query = query.filter(SupportAuditLog.action_type == action_type.upper())
    if tenant_id:
        query = query.filter(SupportAuditLog.target_tenant_id == tenant_id)
    if target_user_id:
        query = query.filter(SupportAuditLog.target_user_id == target_user_id)

    logs = query.order_by(SupportAuditLog.created_at.desc()).offset(skip).limit(limit).all()

    return [
        AuditLogItem(
            id=log.id,
            agent_email=log.agent_email,
            target_user_email=log.target_user_email,
            target_tenant_name=log.target_tenant_name,
            action_type=log.action_type,
            action_detail=log.action_detail,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]


# ============================================
# ACTIVATION / BLOCAGE DES TENANTS
# ============================================

class TenantActivateRequest(BaseModel):
    activation_note: Optional[str] = None


class TenantBlockRequest(BaseModel):
    reason: str


@router.patch("/tenants/{tenant_id}/activate")
async def activate_tenant(
    tenant_id: int,
    body: TenantActivateRequest,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Active un tenant en attente :
    - is_active = True
    - trial_starts_at = now()
    - trial_ends_at = now() + 30 jours
    - is_trial = True
    - Enregistre la note d'activation
    - Envoie l'email de bienvenue à l'admin du tenant
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    if tenant.is_active and tenant.trial_starts_at is not None:
        raise HTTPException(status_code=400, detail="Ce tenant est déjà actif")

    now = datetime.now(timezone.utc)
    tenant.is_active = True
    tenant.trial_starts_at = now
    tenant.trial_ends_at = now + timedelta(days=30)
    tenant.is_trial = True
    tenant.block_reason = None
    if body.activation_note:
        tenant.activation_note = body.activation_note

    db.commit()
    db.refresh(tenant)

    # Récupérer l'admin principal du tenant pour lui envoyer l'email
    admin_user = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.role == UserRole.ADMIN
    ).order_by(User.created_at.asc()).first()

    if admin_user and admin_user.email:
        send_tenant_welcome_email(
            to_email=admin_user.email,
            company_name=tenant.name,
            admin_first_name=admin_user.first_name or admin_user.email.split("@")[0],
            trial_ends_at=tenant.trial_ends_at,
        )

    log_audit(
        db, current_user,
        action_type="ACTIVATE_TENANT",
        action_detail={"note": body.activation_note, "trial_ends_at": tenant.trial_ends_at.isoformat()},
        target_tenant=tenant,
        ip_address=request.client.host if request.client else None,
    )

    return {
        "success": True,
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
        "trial_ends_at": tenant.trial_ends_at.isoformat(),
    }


@router.patch("/tenants/{tenant_id}/block")
async def block_tenant(
    tenant_id: int,
    body: TenantBlockRequest,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Bloque un tenant : is_active = False avec motif obligatoire
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    tenant.is_active = False
    tenant.block_reason = body.reason
    db.commit()

    log_audit(
        db, current_user,
        action_type="BLOCK_TENANT",
        action_detail={"reason": body.reason},
        target_tenant=tenant,
        ip_address=request.client.host if request.client else None,
    )

    return {"success": True, "tenant_id": tenant.id, "reason": body.reason}
