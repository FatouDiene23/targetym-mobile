# ============================================
# API: People Analytics - CORRECTED VERSION
# Fichier: app/api/analytics.py
# ============================================
# FIXES APPLIED:
# 1. e.department → JOIN departments d ON e.department_id = d.id + d.name
# 2. e.status = 'active' → LOWER(e.status::text) = 'active' (enum case-sensitive)
# 3. :start_date::date → CAST(:start_date AS date) (SQLAlchemy bind param fix)
# 4. nbp.created_at → nbp.computed_at (correct column name)
# 5. m.per_diem_total → m.per_diem_amount (correct column name)
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import date, datetime, timedelta
from pydantic import BaseModel
import statistics

from app.api.deps import get_db, get_current_user
from app.models.user import UserRole
from app.models.tenant import Tenant
from app.models.employee import Employee, EmployeeRole
from app.core.currency import fetch_exchange_rates
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_ANALYTICS

router = APIRouter(prefix="/api/analytics", tags=["People Analytics"], dependencies=[Depends(require_feature(FEATURE_ANALYTICS))])


# ============================================
# HELPERS
# ============================================

def get_date_range(period: str) -> tuple:
    """Retourne (date_debut, date_fin) selon la période sélectionnée"""
    today = date.today()
    if period == "1M":
        start = today - timedelta(days=30)
    elif period == "3M":
        start = today - timedelta(days=90)
    elif period == "6M":
        start = today - timedelta(days=180)
    elif period == "1A":
        start = today - timedelta(days=365)
    else:
        start = today - timedelta(days=365)
    return start, today


def get_tenant_id(user) -> int:
    """Extrait le tenant_id de l'utilisateur (objet SQLAlchemy)"""
    return user.tenant_id


def resolve_tenant_id(user, subsidiary_tenant_id, db: Session) -> int:
    """
    Retourne le tenant_id effectif.
    - Par défaut : tenant de l'utilisateur
    - Si subsidiary_tenant_id fourni : vérifie accès (admin/rh/dg) et appartenance au groupe
    """
    if not subsidiary_tenant_id:
        return user.tenant_id
    # Vérifier le rôle
    if user.role not in [UserRole.ADMIN, UserRole.RH]:
        if not user.employee_id:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
        emp = db.query(Employee).filter(
            Employee.id == user.employee_id,
            Employee.tenant_id == user.tenant_id,
        ).first()
        if not emp or emp.role != EmployeeRole.dg:
            raise HTTPException(status_code=403, detail="Accès réservé Admin/RH/DG")
    # Vérifier que la filiale appartient bien au groupe de l'utilisateur
    sub = db.query(Tenant).filter(
        Tenant.id == subsidiary_tenant_id,
        Tenant.parent_tenant_id == user.tenant_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=403, detail="Filiale non autorisée ou introuvable")
    return subsidiary_tenant_id


def require_rh_or_manager(user):
    """Vérifie que l'utilisateur est RH, Admin, Manager ou DG"""
    allowed = [UserRole.RH, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.DG]
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="Accès réservé RH/Manager/Admin/DG")


def get_tenant_currency(db: Session, tenant_id: int) -> str:
    """Récupère la devise par défaut du tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return (tenant.currency if tenant and tenant.currency else "XOF")


async def convert_salaries_to_default(
    rows: list,
    tenant_currency: str,
    salary_field: str = "salary",
    currency_field: str = "currency",
) -> List[float]:
    """
    Prend une liste de rows (avec salary + currency) et retourne
    les salaires convertis dans la devise du tenant.
    """
    # Identifier les devises uniques à convertir
    unique_currencies = set()
    for row in rows:
        emp_currency = getattr(row, currency_field, None) or tenant_currency
        if emp_currency != tenant_currency:
            unique_currencies.add(emp_currency)

    # Pré-charger les taux pour chaque devise étrangère
    rates_map = {}
    for cur in unique_currencies:
        rates = await fetch_exchange_rates(cur)
        rate = rates.get(tenant_currency)
        if rate:
            rates_map[cur] = rate

    # Convertir chaque salaire
    converted = []
    for row in rows:
        salary = getattr(row, salary_field, None)
        if salary is None:
            continue
        emp_currency = getattr(row, currency_field, None) or tenant_currency
        if emp_currency == tenant_currency:
            converted.append(float(salary))
        elif emp_currency in rates_map:
            converted.append(round(float(salary) * rates_map[emp_currency], 2))
        else:
            converted.append(float(salary))
    return converted


# ============================================
# 1. OVERVIEW - Vue d'ensemble KPIs
# ============================================

@router.get("/overview")
def get_overview(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """KPIs globaux pour la vue d'ensemble"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join = "LEFT JOIN departments d ON e.department_id = d.id" if department else ""
    params = {"start_date": start_date, "end_date": end_date, "tenant_id": tenant_id}
    if department:
        params["department"] = department

    # --- Effectif total actif ---
    total_q = db.execute(text(f"""
        SELECT COUNT(*) as total
        FROM employees e
        {dept_join}
        WHERE LOWER(e.status::text) = 'active'
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchone()
    total_employees = total_q.total if total_q else 0

    # --- Entrées sur la période ---
    entries_q = db.execute(text(f"""
        SELECT COUNT(*) as total
        FROM employees e
        {dept_join}
        WHERE e.hire_date BETWEEN :start_date AND :end_date
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchone()
    entries = entries_q.total if entries_q else 0

    # --- Sorties sur la période ---
    # On inclut les employés terminated/inactive sans end_date (COALESCE → today)
    exits_q = db.execute(text(f"""
        SELECT COUNT(*) as total
        FROM employees e
        {dept_join}
        WHERE LOWER(e.status::text) IN ('terminated', 'inactive')
        AND COALESCE(e.end_date, CURRENT_DATE) BETWEEN :start_date AND :end_date
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchone()
    exits = exits_q.total if exits_q else 0

    # --- Turnover ---
    avg_headcount = total_employees if total_employees > 0 else 1
    turnover = round((exits / avg_headcount) * 100, 1)

    # --- Taux de rétention ---
    retention = round(100 - turnover, 1)

    # --- Ancienneté moyenne (en années) ---
    tenure_q = db.execute(text(f"""
        SELECT AVG(
            EXTRACT(YEAR FROM AGE(COALESCE(e.end_date, CURRENT_DATE), e.hire_date))
        ) as avg_tenure
        FROM employees e
        {dept_join}
        WHERE LOWER(e.status::text) = 'active'
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchone()
    avg_tenure = round(tenure_q.avg_tenure, 1) if tenure_q and tenure_q.avg_tenure else 0

    # --- Parité H/F ---
    gender_q = db.execute(text(f"""
        SELECT
            COUNT(*) FILTER (WHERE LOWER(e.gender::text) = 'male') as hommes,
            COUNT(*) FILTER (WHERE LOWER(e.gender::text) = 'female') as femmes
        FROM employees e
        {dept_join}
        WHERE LOWER(e.status::text) = 'active'
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchone()
    hommes = gender_q.hommes if gender_q else 0
    femmes = gender_q.femmes if gender_q else 0
    total_genre = hommes + femmes
    pct_hommes = round((hommes / total_genre) * 100) if total_genre > 0 else 50
    pct_femmes = round((femmes / total_genre) * 100) if total_genre > 0 else 50

    # --- Absentéisme ---
    try:
        abs_q = db.execute(text(f"""
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN lr.end_date > CAST(:end_date AS date) THEN
                            (CAST(:end_date AS date) - lr.start_date::date) + 1
                        ELSE
                            (lr.end_date::date - lr.start_date::date) + 1
                    END
                ), 0) as total_days
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            {dept_join.replace('e.department_id', 'e.department_id') if dept_join else ''}
            WHERE lr.status = 'approved'
            AND lr.start_date <= CAST(:end_date AS date)
            AND lr.end_date >= CAST(:start_date AS date)
            AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            {dept_filter}
        """), params).fetchone()
        total_absence_days = abs_q.total_days if abs_q else 0
    except Exception:
        total_absence_days = 0

    working_days = max((end_date - start_date).days * 5 / 7, 1)
    total_working_days = total_employees * working_days
    absenteeism = round((total_absence_days / total_working_days) * 100, 1) if total_working_days > 0 else 0

    # --- Missions actives ---
    try:
        missions_q = db.execute(text(f"""
            SELECT
                COUNT(*) FILTER (WHERE m.status = 'en_cours') as en_cours,
                COALESCE(SUM(m.estimated_budget) FILTER (WHERE m.start_date >= CAST(:start_date AS date)), 0) as budget_total
            FROM missions m
            JOIN employees e ON m.employee_id = e.id
            {dept_join.replace('LEFT ', '') if dept_join else ''}
            WHERE e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            {dept_filter}
        """), params).fetchone()
    except Exception:
        missions_q = None

    return {
        "total_employees": total_employees,
        "entries": entries,
        "exits": exits,
        "turnover": turnover,
        "retention": retention,
        "avg_tenure": avg_tenure,
        "pct_hommes": pct_hommes,
        "pct_femmes": pct_femmes,
        "absenteeism": absenteeism,
        "missions_en_cours": missions_q.en_cours if missions_q else 0,
        "missions_budget": float(missions_q.budget_total) if missions_q else 0,
        "period": period,
        "department": department
    }


# ============================================
# 2. EFFECTIFS - Données détaillées
# ============================================

@router.get("/effectifs/evolution")
def get_effectifs_evolution(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Évolution des effectifs mois par mois"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join_sub = "LEFT JOIN departments d ON e.department_id = d.id" if department else ""
    params = {"tenant_id": tenant_id}
    if department:
        params["department"] = department

    # Use f-string for dates in generate_series (avoid ::date bind param conflict)
    result = db.execute(text(f"""
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', '{start_date}'::date),
                date_trunc('month', '{end_date}'::date),
                '1 month'::interval
            )::date as month_start
        ),
        monthly_data AS (
            SELECT
                m.month_start,
                TO_CHAR(m.month_start, 'Mon YYYY') as label,
                (
                    SELECT COUNT(*) FROM employees e
                    {dept_join_sub}
                    WHERE e.hire_date <= (m.month_start + INTERVAL '1 month' - INTERVAL '1 day')
                    AND (e.end_date IS NULL OR e.end_date >= m.month_start)
                    AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
                    {dept_filter}
                ) as effectif,
                (
                    SELECT COUNT(*) FROM employees e
                    {dept_join_sub}
                    WHERE e.hire_date BETWEEN m.month_start AND (m.month_start + INTERVAL '1 month' - INTERVAL '1 day')
                    AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
                    {dept_filter}
                ) as entrees,
                (
                    SELECT COUNT(*) FROM employees e
                    {dept_join_sub}
                    WHERE LOWER(e.status::text) IN ('terminated', 'inactive')
                    AND COALESCE(e.end_date, CURRENT_DATE) BETWEEN m.month_start AND (m.month_start + INTERVAL '1 month' - INTERVAL '1 day')
                    AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
                    {dept_filter}
                ) as sorties
            FROM months m
        )
        SELECT * FROM monthly_data ORDER BY month_start
    """), params).fetchall()

    return [
        {
            "name": row.label,
            "effectif": row.effectif,
            "entrees": row.entrees,
            "sorties": row.sorties
        }
        for row in result
    ]


@router.get("/effectifs/by-department")
def get_effectifs_by_department(
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Répartition des effectifs par département"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    # Recursive CTE : remonte dans la hiérarchie jusqu'au niveau 'departement'
    result = db.execute(text("""
        WITH RECURSIVE dept_ancestor AS (
            -- Base : département directement assigné à l'employé actif
            SELECT
                e.id AS employee_id,
                d.id AS dept_id,
                d.name,
                d.level,
                d.parent_id
            FROM employees e
            JOIN departments d ON e.department_id = d.id
            WHERE LOWER(e.status::text) = 'active'
              AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
              AND e.department_id IS NOT NULL

            UNION ALL

            -- Remonte vers le parent si on n'est pas encore au niveau 'departement'
            SELECT
                da.employee_id,
                p.id,
                p.name,
                p.level,
                p.parent_id
            FROM dept_ancestor da
            JOIN departments p ON da.parent_id = p.id
            WHERE da.level != 'departement'
              AND da.parent_id IS NOT NULL
        ),
        resolved AS (
            -- Pour chaque employé, prendre le niveau 'departement' en priorité,
            -- sinon la racine (parent_id IS NULL)
            SELECT DISTINCT ON (employee_id)
                employee_id, name
            FROM dept_ancestor
            ORDER BY employee_id,
                     (CASE WHEN level = 'departement' THEN 0 ELSE 1 END) ASC,
                     parent_id NULLS LAST
        )
        SELECT name, COUNT(*) AS value
        FROM resolved
        GROUP BY name
        ORDER BY COUNT(*) DESC
    """), {"tenant_id": tenant_id}).fetchall()

    colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
    return [
        {"name": row.name, "value": row.value, "color": colors[i % len(colors)]}
        for i, row in enumerate(result)
    ]


@router.get("/effectifs/pyramide-ages")
def get_pyramide_ages(
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Pyramide des âges par genre"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join = "LEFT JOIN departments d ON e.department_id = d.id" if department else ""
    params = {"tenant_id": tenant_id}
    if department:
        params["department"] = department

    result = db.execute(text(f"""
        WITH age_groups AS (
            SELECT
                CASE
                    WHEN EXTRACT(YEAR FROM AGE(e.date_of_birth)) < 25 THEN '< 25 ans'
                    WHEN EXTRACT(YEAR FROM AGE(e.date_of_birth)) BETWEEN 25 AND 34 THEN '25-34 ans'
                    WHEN EXTRACT(YEAR FROM AGE(e.date_of_birth)) BETWEEN 35 AND 44 THEN '35-44 ans'
                    WHEN EXTRACT(YEAR FROM AGE(e.date_of_birth)) BETWEEN 45 AND 54 THEN '45-54 ans'
                    ELSE '55+ ans'
                END as tranche,
                CASE
                    WHEN LOWER(e.gender::text) = 'male' THEN 'homme'
                    WHEN LOWER(e.gender::text) = 'female' THEN 'femme'
                    ELSE 'autre'
                END as genre
            FROM employees e
            {dept_join}
            WHERE LOWER(e.status::text) = 'active'
            AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            AND e.date_of_birth IS NOT NULL
            {dept_filter}
        )
        SELECT
            tranche,
            COUNT(*) FILTER (WHERE genre = 'homme') as hommes,
            COUNT(*) FILTER (WHERE genre = 'femme') as femmes
        FROM age_groups
        GROUP BY tranche
        ORDER BY
            CASE tranche
                WHEN '< 25 ans' THEN 1
                WHEN '25-34 ans' THEN 2
                WHEN '35-44 ans' THEN 3
                WHEN '45-54 ans' THEN 4
                WHEN '55+ ans' THEN 5
            END
    """), params).fetchall()

    return [
        {"tranche": row.tranche, "hommes": row.hommes, "femmes": row.femmes}
        for row in result
    ]


@router.get("/effectifs/turnover-by-department")
def get_turnover_by_department(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Taux de turnover par département"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    result = db.execute(text("""
        WITH dept_stats AS (
            SELECT
                d.name as department,
                COUNT(*) FILTER (WHERE LOWER(e.status::text) = 'active') as actifs,
                COUNT(*) FILTER (
                    WHERE LOWER(e.status::text) IN ('terminated', 'inactive')
                    AND COALESCE(e.end_date, CURRENT_DATE) BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
                ) as sorties
            FROM employees e
            JOIN departments d ON e.department_id = d.id
            WHERE e.department_id IS NOT NULL
            AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            GROUP BY d.name
        )
        SELECT
            department,
            CASE WHEN actifs > 0
                THEN ROUND((sorties::numeric / actifs) * 100, 1)
                ELSE 0
            END as taux
        FROM dept_stats
        WHERE actifs > 0
        ORDER BY taux DESC
    """), {"start_date": start_date, "end_date": end_date, "tenant_id": tenant_id}).fetchall()

    return [
        {"department": row.department, "taux": float(row.taux)}
        for row in result
    ]


# ============================================
# 3. ABSENTÉISME
# ============================================

@router.get("/absenteisme/by-department")
def get_absenteisme_by_department(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Taux d'absentéisme par département"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    # Compter les jours ouvrés réels (lun-ven) dans la période
    working_days = sum(
        1 for i in range((end_date - start_date).days + 1)
        if (start_date + timedelta(days=i)).weekday() < 5
    )
    working_days = max(working_days, 1)

    result = db.execute(text("""
        WITH dept_absence AS (
            SELECT
                d.name as department,
                COUNT(DISTINCT e.id) as nb_employes,
                COALESCE(SUM(
                    -- Compter uniquement les jours ouvrés (lun-ven) dans la période de congé
                    (
                        SELECT COUNT(*) FROM generate_series(
                            GREATEST(lr.start_date, CAST(:start_date AS date)),
                            LEAST(lr.end_date, CAST(:end_date AS date)),
                            '1 day'::interval
                        ) gs(d)
                        WHERE EXTRACT(DOW FROM gs.d) NOT IN (0, 6)
                    )
                ), 0) as jours_absence
            FROM employees e
            JOIN departments d ON e.department_id = d.id
            LEFT JOIN leave_requests lr ON lr.employee_id = e.id
                AND lr.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
                AND lr.status = 'approved'
                AND lr.start_date <= CAST(:end_date AS date)
                AND lr.end_date >= CAST(:start_date AS date)
            WHERE LOWER(e.status::text) = 'active'
            AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            AND e.department_id IS NOT NULL
            GROUP BY d.name
        )
        SELECT
            department,
            nb_employes,
            jours_absence,
            CASE WHEN nb_employes > 0 AND :working_days > 0
                THEN ROUND(LEAST((jours_absence::numeric / (nb_employes * :working_days)) * 100, 100), 1)
                ELSE 0
            END as taux
        FROM dept_absence
        ORDER BY taux DESC
    """), {
        "start_date": start_date,
        "end_date": end_date,
        "working_days": working_days,
        "tenant_id": tenant_id
    }).fetchall()

    return [
        {
            "department": row.department,
            "taux": float(row.taux),
            "jours": row.jours_absence,
            "employes": row.nb_employes
        }
        for row in result
    ]


@router.get("/absenteisme/by-type")
def get_absenteisme_by_type(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Répartition des absences par type de congé"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join = "JOIN departments d ON e.department_id = d.id" if department else ""
    params = {"start_date": start_date, "end_date": end_date, "tenant_id": tenant_id}
    if department:
        params["department"] = department

    result = db.execute(text(f"""
        SELECT
            lr.leave_type as type,
            COUNT(*) as nombre,
            COALESCE(SUM(
                GREATEST(0,
                    LEAST(lr.end_date, CAST(:end_date AS date))::date -
                    GREATEST(lr.start_date, CAST(:start_date AS date))::date + 1
                )
            ), 0) as jours
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        {dept_join}
        WHERE lr.status = 'approved'
        AND lr.start_date <= CAST(:end_date AS date)
        AND lr.end_date >= CAST(:start_date AS date)
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
        GROUP BY lr.leave_type
        ORDER BY jours DESC
    """), params).fetchall()

    return [
        {"type": row.type, "nombre": row.nombre, "jours": row.jours}
        for row in result
    ]


# ============================================
# 4. MISSIONS - Stats
# ============================================

@router.get("/missions/stats")
def get_missions_stats(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Statistiques des missions"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join = "JOIN departments d ON e.department_id = d.id" if department else ""
    params = {"start_date": start_date, "end_date": end_date, "tenant_id": tenant_id}
    if department:
        params["department"] = department

    result = db.execute(text(f"""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE m.status = 'en_cours') as en_cours,
            COUNT(*) FILTER (WHERE m.status = 'terminee') as terminees,
            COUNT(*) FILTER (WHERE m.status IN ('en_attente_manager', 'en_attente_rh')) as en_attente,
            COALESCE(SUM(m.estimated_budget), 0) as budget_total,
            COALESCE(SUM(m.per_diem_amount), 0) as per_diem_total,
            COALESCE(AVG(
                (m.end_date::date - m.start_date::date) + 1
            ), 0) as duree_moyenne
        FROM missions m
        JOIN employees e ON m.employee_id = e.id
        {dept_join}
        WHERE m.created_at >= CAST(:start_date AS date)
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchone()

    # Missions par département
    by_dept = db.execute(text(f"""
        SELECT
            d.name as department,
            COUNT(*) as nombre,
            COALESCE(SUM(m.estimated_budget), 0) as budget
        FROM missions m
        JOIN employees e ON m.employee_id = e.id
        JOIN departments d ON e.department_id = d.id
        WHERE m.created_at >= CAST(:start_date AS date)
        AND e.department_id IS NOT NULL
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
        GROUP BY d.name
        ORDER BY nombre DESC
    """), params).fetchall()

    return {
        "total": result.total if result else 0,
        "en_cours": result.en_cours if result else 0,
        "terminees": result.terminees if result else 0,
        "en_attente": result.en_attente if result else 0,
        "budget_total": float(result.budget_total) if result else 0,
        "per_diem_total": float(result.per_diem_total) if result else 0,
        "duree_moyenne": round(float(result.duree_moyenne), 1) if result else 0,
        "by_department": [
            {"department": row.department, "nombre": row.nombre, "budget": float(row.budget)}
            for row in by_dept
        ]
    }


# ============================================
# 5. PERFORMANCE
# ============================================

@router.get("/performance/overview")
def get_performance_overview(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Performance globale : score, distribution, par département, OKR"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join = "JOIN departments d ON e.department_id = d.id" if department else "LEFT JOIN departments d ON e.department_id = d.id"
    params = {"start_date": start_date, "tenant_id": tenant_id}
    if department:
        params["department"] = department

    # 1. Score moyen global + total évals + top performers
    ov_q = db.execute(text(f"""
        SELECT
            ROUND(AVG(ev.overall_score)::numeric, 2) as avg_score,
            COUNT(*) as total_evals,
            COUNT(*) FILTER (WHERE ev.overall_score >= 4) as top_performers
        FROM evaluations ev
        JOIN employees e ON ev.employee_id = e.id
        {dept_join}
        WHERE ev.type = 'manager'
        AND ev.status = 'submitted'
        AND ev.overall_score IS NOT NULL
        AND ev.created_at >= CAST(:start_date AS date)
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchone()

    avg_score = float(ov_q.avg_score) if ov_q and ov_q.avg_score else None
    total_evals = ov_q.total_evals if ov_q else 0
    top_performers = ov_q.top_performers if ov_q else 0

    # 2. Score par département
    dept_q = db.execute(text(f"""
        SELECT
            d.name as name,
            ROUND(AVG(ev.overall_score)::numeric, 2) as score,
            COUNT(*) as nb_evals
        FROM evaluations ev
        JOIN employees e ON ev.employee_id = e.id
        {dept_join}
        WHERE ev.type = 'manager'
        AND ev.status = 'submitted'
        AND ev.overall_score IS NOT NULL
        AND ev.created_at >= CAST(:start_date AS date)
        AND e.department_id IS NOT NULL
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
        GROUP BY d.name
        ORDER BY score DESC
    """), params).fetchall()

    by_department = [
        {"name": row.name, "score": float(row.score), "nb_evals": row.nb_evals}
        for row in dept_q
    ]

    # 3. Distribution des scores (1–5)
    dist_labels = ["Insuffisant (1)", "À améliorer (2)", "Bien (3)", "Très bien (4)", "Exceptionnel (5)"]
    dist_colors = ["#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#10b981"]
    dist_q = db.execute(text(f"""
        SELECT
            ROUND(ev.overall_score)::int as note,
            COUNT(*) as count
        FROM evaluations ev
        JOIN employees e ON ev.employee_id = e.id
        {dept_join}
        WHERE ev.type = 'manager'
        AND ev.status = 'submitted'
        AND ev.overall_score IS NOT NULL
        AND ev.created_at >= CAST(:start_date AS date)
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
        GROUP BY ROUND(ev.overall_score)::int
        ORDER BY note
    """), params).fetchall()

    dist_map = {row.note: row.count for row in dist_q}
    score_distribution = [
        {"note": dist_labels[i], "count": dist_map.get(i + 1, 0), "color": dist_colors[i]}
        for i in range(5)
    ]

    # 4. OKR stats (toutes périodes, tenant)
    okr_q = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE o.status::text IN ('active', 'on_track')) as total,
            COUNT(*) FILTER (WHERE o.status::text = 'on_track') as on_track,
            COUNT(*) FILTER (WHERE o.status::text IN ('at_risk', 'behind')) as at_risk,
            COUNT(*) FILTER (WHERE o.status::text = 'completed') as completed,
            ROUND(AVG(o.progress)::numeric, 1) as avg_progress
        FROM objectives o
        WHERE o.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        AND o.is_active = true
    """), {"tenant_id": tenant_id}).fetchone()

    okr = None
    if okr_q and okr_q.total > 0:
        okr = {
            "total": okr_q.total,
            "on_track": okr_q.on_track,
            "at_risk": okr_q.at_risk,
            "completed": okr_q.completed,
            "avg_progress": float(okr_q.avg_progress) if okr_q.avg_progress else 0,
        }

    return {
        "avg_score": avg_score,
        "total_evals": total_evals,
        "top_performers": top_performers,
        "by_department": by_department,
        "score_distribution": score_distribution,
        "okr": okr,
    }


@router.get("/performance/by-manager")
def get_performance_by_manager(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Top managers par score d'évaluation"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d_mgr.name = :department" if department else ""
    params = {"start_date": start_date, "tenant_id": tenant_id}
    if department:
        params["department"] = department

    result = db.execute(text(f"""
        SELECT
            CONCAT(m.first_name, ' ', m.last_name) as manager,
            d_mgr.name as equipe,
            COUNT(DISTINCT ev.employee_id) as taille,
            ROUND(AVG(ev.overall_score)::numeric, 2) as score
        FROM evaluations ev
        JOIN employees e ON ev.employee_id = e.id
        JOIN employees m ON ev.evaluator_id = m.id
        LEFT JOIN departments d_mgr ON m.department_id = d_mgr.id
        WHERE ev.type = 'manager'
        AND ev.status = 'submitted'
        AND ev.overall_score IS NOT NULL
        AND ev.created_at >= CAST(:start_date AS date)
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        AND d_mgr.name IS NOT NULL
        {dept_filter}
        GROUP BY m.id, m.first_name, m.last_name, d_mgr.name
        ORDER BY score DESC
        LIMIT 10
    """), params).fetchall()

    return [
        {"manager": row.manager, "equipe": row.equipe, "taille": row.taille, "score": float(row.score)}
        for row in result
    ]


# ============================================
# 6. TALENTS (9-Box + Succession)
# ============================================

@router.get("/talents/ninebox")
def get_ninebox_distribution(
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Distribution 9-Box"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    result = db.execute(text("""
        WITH latest AS (
            SELECT DISTINCT ON (nbp.employee_id)
                nbp.employee_id,
                nbp.quadrant,
                nbp.performance_score,
                nbp.potential_score
            FROM nine_box_placements nbp
            WHERE nbp.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            ORDER BY nbp.employee_id, nbp.id DESC
        )
        SELECT
            l.quadrant,
            COUNT(*) as nb
        FROM latest l
        GROUP BY l.quadrant
        ORDER BY l.quadrant
    """), {"tenant_id": tenant_id}).fetchall()

    QUADRANT_META = {
        9: {"name": "Stars",            "color": "#10b981"},
        8: {"name": "Hauts Potentiels", "color": "#3b82f6"},
        7: {"name": "Futurs Leaders",   "color": "#8b5cf6"},
        6: {"name": "Performeurs",      "color": "#06b6d4"},
        5: {"name": "Piliers",          "color": "#f59e0b"},
        4: {"name": "À développer",     "color": "#f97316"},
        3: {"name": "Experts",          "color": "#64748b"},
        2: {"name": "En progression",   "color": "#94a3b8"},
        1: {"name": "À risque",         "color": "#ef4444"},
    }
    return [
        {
            "quadrant": row.quadrant,
            "value": row.nb,
            "name": QUADRANT_META.get(row.quadrant, {}).get("name", f"Q{row.quadrant}"),
            "color": QUADRANT_META.get(row.quadrant, {}).get("color", "#6b7280"),
        }
        for row in result
    ]


@router.get("/talents/succession")
def get_succession_overview(
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Vue d'ensemble des plans de succession"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    result = db.execute(text("""
        SELECT
            sp.id,
            sp.position_title,
            sp.department,
            sp.criticality,
            sp.vacancy_risk,
            CONCAT(e.first_name, ' ', e.last_name) as current_holder,
            (SELECT COUNT(*) FROM succession_candidates sc WHERE sc.succession_plan_id = sp.id) as nb_candidates,
            (SELECT COUNT(*) FROM succession_candidates sc WHERE sc.succession_plan_id = sp.id AND sc.readiness = 'ready') as ready_candidates
        FROM succession_plans sp
        LEFT JOIN employees e ON sp.current_holder_id = e.id
        WHERE sp.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        ORDER BY
            CASE sp.criticality
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                ELSE 3
            END,
            sp.position_title
    """), {"tenant_id": tenant_id}).fetchall()

    plans = [
        {
            "poste": row.position_title,
            "titulaire": row.current_holder or "—",
            "successeurs": row.nb_candidates,
            "pret": row.ready_candidates,
            "couverture": round((row.ready_candidates / row.nb_candidates) * 100) if row.nb_candidates > 0 else 0,
        }
        for row in result
    ]

    total = len(plans)
    covered = sum(1 for p in plans if p["couverture"] >= 50)
    covered_pct = round((covered / total) * 100) if total > 0 else 0

    return {
        "total_plans": total,
        "covered_pct": covered_pct,
        "plans": plans,
    }


# ============================================
# 7. FORMATION
# ============================================

@router.get("/formation/overview")
def get_formation_overview(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Statistiques formation"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    try:
        result = db.execute(text("""
            SELECT
                COUNT(DISTINCT c.id) as total_courses,
                COUNT(DISTINCT ca.id) as total_assignments,
                COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'completed') as completed,
                COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'in_progress') as in_progress,
                CASE WHEN COUNT(DISTINCT ca.id) > 0
                    THEN ROUND((COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'completed')::numeric / COUNT(DISTINCT ca.id)) * 100, 1)
                    ELSE 0
                END as completion_rate
            FROM courses c
            LEFT JOIN course_assignments ca ON ca.course_id = c.id
                AND ca.assigned_at >= CAST(:start_date AS date)
            WHERE c.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        """), {"start_date": start_date, "tenant_id": tenant_id}).fetchone()

        return {
            "total_courses": result.total_courses if result else 0,
            "total_assignments": result.total_assignments if result else 0,
            "completed": result.completed if result else 0,
            "in_progress": result.in_progress if result else 0,
            "completion_rate": float(result.completion_rate) if result else 0
        }
    except Exception:
        return {
            "total_courses": 0,
            "total_assignments": 0,
            "completed": 0,
            "in_progress": 0,
            "completion_rate": 0
        }


@router.get("/formation/by-category")
def get_formation_by_category(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Formations par catégorie"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    try:
        result = db.execute(text("""
            SELECT
                COALESCE(c.category, 'Non catégorisé') as category,
                COUNT(DISTINCT c.id) as nb_courses,
                COUNT(ca.id) as nb_assignments,
                COUNT(ca.id) FILTER (WHERE ca.status = 'completed') as nb_completed
            FROM courses c
            LEFT JOIN course_assignments ca ON ca.course_id = c.id
                AND ca.assigned_at >= CAST(:start_date AS date)
            WHERE c.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            GROUP BY c.category
            ORDER BY nb_assignments DESC
        """), {"start_date": start_date, "tenant_id": tenant_id}).fetchall()

        return [
            {
                "category": row.category,
                "nb_courses": row.nb_courses,
                "nb_assignments": row.nb_assignments,
                "nb_completed": row.nb_completed
            }
            for row in result
        ]
    except Exception:
        return []


@router.get("/formation/evolution")
def get_formation_evolution(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Évolution des formations"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    try:
        result = db.execute(text(f"""
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', '{start_date}'::date),
                    date_trunc('month', '{end_date}'::date),
                    '1 month'::interval
                )::date as month_start
            )
            SELECT
                TO_CHAR(m.month_start, 'Mon YYYY') as label,
                COUNT(ca.id) FILTER (WHERE ca.assigned_at >= m.month_start
                    AND ca.assigned_at < m.month_start + INTERVAL '1 month') as assignees,
                COUNT(ca.id) FILTER (WHERE ca.completed_at >= m.month_start
                    AND ca.completed_at < m.month_start + INTERVAL '1 month') as completes
            FROM months m
            LEFT JOIN course_assignments ca ON TRUE AND ca.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            GROUP BY m.month_start
            ORDER BY m.month_start
        """), {"tenant_id": tenant_id}).fetchall()

        return [
            {"name": row.label, "assignees": row.assignees, "completes": row.completes}
            for row in result
        ]
    except Exception:
        return []


# ============================================
# 8. SALAIRES
# ============================================

@router.get("/salaires/overview")
async def get_salaires_overview(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Vue d'ensemble masse salariale (avec conversion multi-devises)"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    tenant_currency = get_tenant_currency(db, tenant_id)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join = "LEFT JOIN departments d ON e.department_id = d.id" if department else ""
    params = {"tenant_id": tenant_id}
    if department:
        params["department"] = department

    # Récupérer les salaires individuels avec leur devise et genre
    rows = db.execute(text(f"""
        SELECT e.salary, e.currency, LOWER(e.gender::text) as gender
        FROM employees e
        {dept_join}
        WHERE LOWER(e.status::text) = 'active'
        AND e.salary IS NOT NULL
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
    """), params).fetchall()

    # Convertir tous les salaires dans la devise du tenant
    converted = await convert_salaries_to_default(rows, tenant_currency)

    # Séparer par genre pour les stats H/F
    salaires_h = []
    salaires_f = []
    for i, row in enumerate(rows):
        if i < len(converted):
            if row.gender == 'male':
                salaires_h.append(converted[i])
            elif row.gender == 'female':
                salaires_f.append(converted[i])

    masse_mensuelle = sum(converted) if converted else 0
    salaire_moyen = statistics.mean(converted) if converted else 0
    salaire_median = statistics.median(converted) if converted else 0
    salaire_moy_h = statistics.mean(salaires_h) if salaires_h else 0
    salaire_moy_f = statistics.mean(salaires_f) if salaires_f else 0

    # Count salary increases from salary_history in the period
    nb_augmentations = 0
    pct_augmentation_moy = 0
    try:
        aug_dept_join = "LEFT JOIN departments d ON e.department_id = d.id" if department else ""
        aug_result = db.execute(text(f"""
            SELECT COUNT(*) as nb_aug,
                   COALESCE(AVG(sh.change_percentage), 0) as pct_moy
            FROM salary_history sh
            JOIN employees e ON sh.employee_id = e.id
            {aug_dept_join}
            WHERE sh.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            AND sh.previous_amount IS NOT NULL
            AND sh.amount > sh.previous_amount
            AND sh.effective_date BETWEEN :start_date AND :end_date
            {dept_filter}
        """), {**params, "start_date": start_date, "end_date": end_date}).fetchone()
        if aug_result:
            nb_augmentations = aug_result.nb_aug or 0
            pct_augmentation_moy = round(float(aug_result.pct_moy or 0), 1)
    except Exception:
        pass

    return {
        "devise": tenant_currency,
        "masse_mensuelle": masse_mensuelle,
        "masse_annuelle": masse_mensuelle * 12,
        "salaire_moyen": round(salaire_moyen, 2),
        "salaire_median": round(salaire_median, 2),
        "nb_avec_salaire": len(converted),
        "salaire_moy_hommes": round(salaire_moy_h, 2),
        "salaire_moy_femmes": round(salaire_moy_f, 2),
        "ecart_salarial_hf": round(
            ((salaire_moy_h - salaire_moy_f) / salaire_moy_h) * 100, 1
        ) if salaire_moy_h > 0 else 0,
        "nb_augmentations": nb_augmentations,
        "pct_augmentation_moy": pct_augmentation_moy,
    }


@router.get("/salaires/evolution")
async def get_salaires_evolution(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Évolution de la masse salariale (avec conversion multi-devises)"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    tenant_currency = get_tenant_currency(db, tenant_id)
    dept_filter = "AND d.name = :department" if department else ""
    dept_join = "LEFT JOIN departments d ON e.department_id = d.id" if department else ""
    params = {"tenant_id": tenant_id}
    if department:
        params["department"] = department

    # Récupérer salaire + devise + mois pour chaque employé actif par mois
    rows = db.execute(text(f"""
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', '{start_date}'::date),
                date_trunc('month', '{end_date}'::date),
                '1 month'::interval
            )::date as month_start
        )
        SELECT
            TO_CHAR(m.month_start, 'Mon YYYY') as label,
            m.month_start,
            e.salary, e.currency
        FROM months m
        LEFT JOIN employees e ON
            e.hire_date <= (m.month_start + INTERVAL '1 month' - INTERVAL '1 day')
            AND (e.end_date IS NULL OR e.end_date >= m.month_start)
            AND LOWER(e.status::text) = 'active'
            AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
            AND e.salary IS NOT NULL
        {dept_join.replace('e.department_id', 'e.department_id') if dept_join else ''}
        WHERE 1=1
        {dept_filter if department else ''}
        ORDER BY m.month_start
    """), params).fetchall()

    # Pré-charger les taux de conversion
    unique_currencies = set()
    for row in rows:
        if row.currency and row.currency != tenant_currency:
            unique_currencies.add(row.currency)
    rates_map = {}
    for cur in unique_currencies:
        rates = await fetch_exchange_rates(cur)
        rate = rates.get(tenant_currency)
        if rate:
            rates_map[cur] = rate

    # Agréger par mois avec conversion
    month_data: dict = {}
    for row in rows:
        label = row.label
        if label not in month_data:
            month_data[label] = {"salaires": [], "month_start": row.month_start}
        if row.salary is not None:
            emp_cur = row.currency or tenant_currency
            sal = float(row.salary)
            if emp_cur != tenant_currency and emp_cur in rates_map:
                sal = round(sal * rates_map[emp_cur], 2)
            month_data[label]["salaires"].append(sal)

    return [
        {
            "name": label,
            "masse_salariale": round(sum(data["salaires"]), 2),
            "salaire_moyen": round(statistics.mean(data["salaires"]), 2) if data["salaires"] else 0,
            "effectif": len(data["salaires"]),
        }
        for label, data in month_data.items()
    ]


@router.get("/salaires/by-department")
async def get_salaires_by_department(
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Masse salariale par département (avec conversion multi-devises)"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    tenant_currency = get_tenant_currency(db, tenant_id)

    rows = db.execute(text("""
        SELECT d.name as department, e.salary, e.currency
        FROM employees e
        JOIN departments d ON e.department_id = d.id
        WHERE LOWER(e.status::text) = 'active'
        AND e.department_id IS NOT NULL
        AND e.salary IS NOT NULL
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
    """), {"tenant_id": tenant_id}).fetchall()

    converted = await convert_salaries_to_default(rows, tenant_currency)

    # Agréger par département
    dept_data: dict = {}
    for i, row in enumerate(rows):
        if i >= len(converted):
            break
        dept = row.department
        if dept not in dept_data:
            dept_data[dept] = {"salaires": [], "effectif": 0}
        dept_data[dept]["salaires"].append(converted[i])
        dept_data[dept]["effectif"] += 1

    total_masse = sum(converted) if converted else 0

    result = []
    for dept, data in dept_data.items():
        masse = sum(data["salaires"])
        result.append({
            "department": dept,
            "effectif": data["effectif"],
            "masse_salariale": round(masse, 2),
            "salaire_moyen": round(statistics.mean(data["salaires"]), 2) if data["salaires"] else 0,
            "pct_total": round((masse / total_masse) * 100, 1) if total_masse > 0 else 0,
        })
    result.sort(key=lambda x: x["masse_salariale"], reverse=True)
    return result


@router.get("/salaires/distribution")
async def get_salaires_distribution(
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Distribution des salaires par tranche (avec conversion multi-devises)"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    tenant_currency = get_tenant_currency(db, tenant_id)

    rows = db.execute(text("""
        SELECT e.salary, e.currency
        FROM employees e
        WHERE LOWER(e.status::text) = 'active'
        AND e.salary IS NOT NULL
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
    """), {"tenant_id": tenant_id}).fetchall()

    converted = await convert_salaries_to_default(rows, tenant_currency)

    # Classer par tranche
    tranches_def = [
        ("< 200K", 0, 200000, 1),
        ("200K\u2013500K", 200000, 500000, 2),
        ("500K\u20131M", 500000, 1000000, 3),
        ("1M\u20132M", 1000000, 2000000, 4),
        ("> 2M", 2000000, float("inf"), 5),
    ]
    tranche_data = {t[0]: [] for t in tranches_def}
    for sal in converted:
        for label, low, high, _ in tranches_def:
            if low <= sal < high:
                tranche_data[label].append(sal)
                break

    return [
        {
            "tranche": label,
            "nb_employes": len(salaires),
            "salaire_moyen": round(statistics.mean(salaires), 2) if salaires else 0,
        }
        for label, _, _, _ in tranches_def
        for salaires in [tranche_data[label]]
        if salaires
    ]


@router.get("/salaires/by-contract")
async def get_salaires_by_contract(
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Masse salariale par type de contrat (avec conversion multi-devises)"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    tenant_currency = get_tenant_currency(db, tenant_id)

    rows = db.execute(text("""
        SELECT COALESCE(e.contract_type::text, 'Non défini') as contract_type,
               e.salary, e.currency
        FROM employees e
        WHERE LOWER(e.status::text) = 'active'
        AND e.salary IS NOT NULL
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
    """), {"tenant_id": tenant_id}).fetchall()

    converted = await convert_salaries_to_default(rows, tenant_currency)

    contract_data: dict = {}
    for i, row in enumerate(rows):
        if i >= len(converted):
            break
        ct = row.contract_type
        if ct not in contract_data:
            contract_data[ct] = []
        contract_data[ct].append(converted[i])

    result = []
    for ct, salaires in contract_data.items():
        result.append({
            "contract_type": ct,
            "effectif": len(salaires),
            "masse_salariale": round(sum(salaires), 2),
            "salaire_moyen": round(statistics.mean(salaires), 2) if salaires else 0,
        })
    result.sort(key=lambda x: x["masse_salariale"], reverse=True)
    return result


# ============================================
# 9. DÉPARTEMENTS - Liste pour filtres
# ============================================

@router.get("/departments")
def get_departments(
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Liste des départements (pour les filtres)"""
    require_rh_or_manager(current_user)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)

    result = db.execute(text("""
        SELECT DISTINCT d.name as department
        FROM employees e
        JOIN departments d ON e.department_id = d.id
        WHERE e.department_id IS NOT NULL
        AND LOWER(e.status::text) = 'active'
        AND e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        ORDER BY d.name
    """), {"tenant_id": tenant_id}).fetchall()

    return [row.department for row in result]


# ============================================
# 10. EXPORT DATA
# ============================================

@router.get("/export")
def get_export_data(
    period: str = Query("1A", regex="^(1M|3M|6M|1A)$"),
    department: Optional[str] = None,
    subsidiary_tenant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Données complètes pour export Excel/PDF"""
    require_rh_or_manager(current_user)
    start_date, end_date = get_date_range(period)
    tenant_id = resolve_tenant_id(current_user, subsidiary_tenant_id, db)
    dept_filter = "AND d.name = :department" if department else ""
    params = {"start_date": start_date, "end_date": end_date, "tenant_id": tenant_id}
    if department:
        params["department"] = department

    employees = db.execute(text(f"""
        SELECT
            e.employee_id as matricule,
            e.first_name || ' ' || e.last_name as nom_complet,
            d.name as department,
            e.job_title,
            e.gender,
            e.hire_date,
            EXTRACT(YEAR FROM AGE(COALESCE(e.end_date, CURRENT_DATE), e.hire_date)) as anciennete,
            e.status,
            (
                SELECT COALESCE(SUM(
                    GREATEST(0, LEAST(lr.end_date, CAST(:end_date AS date))::date - GREATEST(lr.start_date, CAST(:start_date AS date))::date + 1)
                ), 0)
                FROM leave_requests lr
                WHERE lr.employee_id = e.id
                AND lr.status = 'approved'
                AND lr.start_date <= CAST(:end_date AS date)
                AND lr.end_date >= CAST(:start_date AS date)
            ) as jours_absence,
            (
                SELECT COUNT(*)
                FROM missions m
                WHERE m.employee_id = e.id
                AND m.created_at >= CAST(:start_date AS date)
            ) as nb_missions
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.tenant_id IN (SELECT id FROM tenants WHERE id = :tenant_id OR parent_tenant_id = :tenant_id)
        {dept_filter}
        ORDER BY d.name, e.last_name
    """), params).fetchall()

    return {
        "period": {"start": str(start_date), "end": str(end_date)},
        "department": department,
        "employees": [
            {
                "matricule": row.matricule,
                "nom": row.nom_complet,
                "department": row.department,
                "poste": row.job_title,
                "genre": row.gender,
                "date_embauche": str(row.hire_date) if row.hire_date else None,
                "anciennete": float(row.anciennete) if row.anciennete else 0,
                "statut": row.status,
                "jours_absence": row.jours_absence,
                "nb_missions": row.nb_missions
            }
            for row in employees
        ]
    }