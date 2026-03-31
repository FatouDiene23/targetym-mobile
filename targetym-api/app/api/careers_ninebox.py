# ============================================
# API: Talents & Carrière — Bloc 3
# 9-Box Matrix + Plans de Succession
# Fichier: app/api/careers_ninebox.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_CAREERS

router = APIRouter(prefix="/api/careers", tags=["Talents & Carrière - 9-Box & Succession"], dependencies=[Depends(require_feature(FEATURE_CAREERS))])


# ============================================
# HELPERS
# ============================================

def get_tenant_id(user) -> int:
    if isinstance(user, dict):
        return user.get("tenant_id", 1)
    return getattr(user, "tenant_id", 1)

def get_user_id(user) -> int:
    if isinstance(user, dict):
        return user.get("user_id") or user.get("sub") or user.get("id")
    return getattr(user, "id", None) or getattr(user, "user_id", None)

def get_user_role(user) -> str:
    if isinstance(user, dict):
        return (user.get("role") or "employee").lower()
    return (getattr(user, "role", "employee") or "employee").lower()

def require_rh(user):
    role = get_user_role(user)
    if role not in ["rh", "admin", "directeur"]:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/Admin")

def require_rh_or_manager(user):
    role = get_user_role(user)
    if role not in ["rh", "admin", "directeur", "manager"]:
        raise HTTPException(status_code=403, detail="Accès réservé RH/Manager")


# ============================================
# SCHEMAS
# ============================================

# --- 9-Box ---
class NineBoxCreate(BaseModel):
    employee_id: int
    period: str                    # ex: "2025-annual", "2025-Q4"
    performance_score: float       # 1.0 à 5.0
    potential_score: float         # 1.0 à 5.0
    notes: Optional[str] = None

class NineBoxBulkItem(BaseModel):
    employee_id: int
    performance_score: float
    potential_score: float
    notes: Optional[str] = None

class NineBoxBulkRequest(BaseModel):
    period: str
    placements: List[NineBoxBulkItem]

# --- Succession ---
class SuccessionPlanCreate(BaseModel):
    position_title: str
    department: Optional[str] = None
    current_holder_id: Optional[int] = None
    criticality: str = "medium"     # critical | high | medium
    vacancy_risk: str = "low"       # low | medium | high
    notes: Optional[str] = None

class SuccessionPlanUpdate(BaseModel):
    position_title: Optional[str] = None
    department: Optional[str] = None
    current_holder_id: Optional[int] = None
    criticality: Optional[str] = None
    vacancy_risk: Optional[str] = None
    notes: Optional[str] = None

class SuccessionCandidateAdd(BaseModel):
    employee_id: int
    readiness: str = "3+ years"     # ready | 1-2 years | 3+ years
    preparation_score: int = 0      # 0-100
    rank_order: int = 1
    development_notes: Optional[str] = None

class SuccessionCandidateUpdate(BaseModel):
    readiness: Optional[str] = None
    preparation_score: Optional[int] = None
    rank_order: Optional[int] = None
    development_notes: Optional[str] = None


# ============================================
# QUADRANT CALCULATION
# ============================================

def calculate_quadrant(perf: float, pot: float) -> int:
    """
    9-Box quadrant (1-9) basé sur performance et potentiel.
    Grille 3x3 : Low(1-2) / Medium(3) / High(4-5)
    
    Quadrants:
    7 | 8 | 9    (High Potential)
    4 | 5 | 6    (Medium Potential)
    1 | 2 | 3    (Low Potential)
    LP  MP  HP   (Performance →)
    """
    def bucket(score: float) -> int:
        if score >= 4.0:
            return 3  # High
        elif score >= 3.0:
            return 2  # Medium
        else:
            return 1  # Low

    p_bucket = bucket(perf)
    pot_bucket = bucket(pot)

    return (pot_bucket - 1) * 3 + p_bucket


# ============================================
# 1. NINE-BOX PLACEMENTS
# ============================================

@router.post("/ninebox")
def create_ninebox_placement(
    data: NineBoxCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Créer/mettre à jour un placement 9-Box"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    if not (1.0 <= data.performance_score <= 5.0) or not (1.0 <= data.potential_score <= 5.0):
        raise HTTPException(status_code=400, detail="Scores doivent être entre 1.0 et 5.0")

    quadrant = calculate_quadrant(data.performance_score, data.potential_score)

    # Upsert (unique: employee_id + period)
    result = db.execute(text("""
        INSERT INTO nine_box_placements (tenant_id, employee_id, period, performance_score, potential_score, quadrant, notes)
        VALUES (:tid, :eid, :period, :perf, :pot, :quad, :notes)
        ON CONFLICT (employee_id, period) DO UPDATE SET
            performance_score = EXCLUDED.performance_score,
            potential_score = EXCLUDED.potential_score,
            quadrant = EXCLUDED.quadrant,
            notes = EXCLUDED.notes,
            computed_at = NOW()
        RETURNING id
    """), {
        "tid": tenant_id, "eid": data.employee_id, "period": data.period,
        "perf": data.performance_score, "pot": data.potential_score,
        "quad": quadrant, "notes": data.notes
    })
    db.commit()

    return {"id": result.fetchone()[0], "quadrant": quadrant, "message": "Placement 9-Box enregistré"}


@router.post("/ninebox/bulk")
def bulk_ninebox_placements(
    data: NineBoxBulkRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Placements 9-Box en masse pour une période"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)

    count = 0
    for item in data.placements:
        if not (1.0 <= item.performance_score <= 5.0) or not (1.0 <= item.potential_score <= 5.0):
            continue
        quadrant = calculate_quadrant(item.performance_score, item.potential_score)
        db.execute(text("""
            INSERT INTO nine_box_placements (tenant_id, employee_id, period, performance_score, potential_score, quadrant, notes)
            VALUES (:tid, :eid, :period, :perf, :pot, :quad, :notes)
            ON CONFLICT (employee_id, period) DO UPDATE SET
                performance_score = EXCLUDED.performance_score,
                potential_score = EXCLUDED.potential_score,
                quadrant = EXCLUDED.quadrant,
                notes = EXCLUDED.notes,
                computed_at = NOW()
        """), {
            "tid": tenant_id, "eid": item.employee_id, "period": data.period,
            "perf": item.performance_score, "pot": item.potential_score,
            "quad": quadrant, "notes": item.notes
        })
        count += 1

    db.commit()
    return {"count": count, "message": f"{count} placement(s) enregistré(s)"}


@router.get("/ninebox")
def get_ninebox_matrix(
    period: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Données complètes de la matrice 9-Box.
    Si pas de period, prend la plus récente.
    """
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    # Si pas de période, trouver la dernière
    if not period:
        latest = db.execute(text("""
            SELECT DISTINCT period FROM nine_box_placements
            WHERE tenant_id = :tid ORDER BY period DESC LIMIT 1
        """), {"tid": tenant_id}).fetchone()
        if not latest:
            # Générer les périodes auto même sans données
            cur_year = datetime.now().year
            auto_p = []
            for y in [cur_year, cur_year - 1]:
                for s in [f"{y}-annual", f"{y}-Q4", f"{y}-Q3", f"{y}-Q2", f"{y}-Q1"]:
                    auto_p.append(s)
            depts_empty = db.execute(text(
                "SELECT DISTINCT name FROM departments WHERE tenant_id = :tid AND name IS NOT NULL ORDER BY name"
            ), {"tid": tenant_id}).fetchall()
            return {
                "period": None,
                "available_periods": auto_p,
                "available_departments": [d[0] for d in depts_empty],
                "total": 0,
                "stats": {"stars": 0, "high_potentials": 0, "at_risk": 0},
                "summary": {},
                "placements": []
            }
        period = latest[0]

    where = ["nb.tenant_id = :tid", "nb.period = :period"]
    params = {"tid": tenant_id, "period": period}

    if department:
        where.append("d.name = :dept")
        params["dept"] = department

    rows = db.execute(text(f"""
        SELECT nb.*,
            e.first_name, e.last_name, e.job_title, e.photo_url,
            e.hire_date,
            d.name AS department_name
        FROM nine_box_placements nb
        JOIN employees e ON e.id = nb.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE {' AND '.join(where)}
        ORDER BY nb.quadrant DESC, nb.performance_score DESC
    """), params).fetchall()

    placements = [dict(r._mapping) for r in rows]

    # Summary par quadrant
    summary = {}
    for p in placements:
        q = p["quadrant"]
        if q not in summary:
            summary[q] = {"count": 0, "employees": []}
        summary[q]["count"] += 1
        summary[q]["employees"].append({
            "id": p["employee_id"],
            "name": f"{p['first_name']} {p['last_name']}",
            "job_title": p["job_title"],
            "photo_url": p.get("photo_url"),
            "performance": float(p["performance_score"]),
            "potential": float(p["potential_score"])
        })

    # Stats
    total = len(placements)
    stars = sum(1 for p in placements if p["quadrant"] == 9)
    high_pot = sum(1 for p in placements if p["quadrant"] in [7, 8, 9])
    at_risk = sum(1 for p in placements if p["quadrant"] in [1, 2])

    # Périodes disponibles : celles existantes + générer les périodes de l'année courante et précédente
    existing_periods = db.execute(text("""
        SELECT DISTINCT period FROM nine_box_placements
        WHERE tenant_id = :tid ORDER BY period DESC
    """), {"tid": tenant_id}).fetchall()
    existing_set = {p[0] for p in existing_periods}

    current_year = datetime.now().year
    auto_periods = []
    for y in [current_year, current_year - 1]:
        for suffix in [f"{y}-annual", f"{y}-Q4", f"{y}-Q3", f"{y}-Q2", f"{y}-Q1"]:
            auto_periods.append(suffix)
    all_periods = sorted(
        list(existing_set | set(auto_periods)),
        reverse=True
    )

    # Départements disponibles : tous les départements du tenant (pas seulement ceux avec des placements)
    depts = db.execute(text("""
        SELECT DISTINCT name FROM departments
        WHERE tenant_id = :tid AND name IS NOT NULL
        ORDER BY name
    """), {"tid": tenant_id}).fetchall()

    return {
        "period": period,
        "available_periods": all_periods,
        "available_departments": [d[0] for d in depts],
        "total": total,
        "stats": {
            "stars": stars,
            "high_potentials": high_pot,
            "at_risk": at_risk
        },
        "summary": summary,
        "placements": placements
    }


@router.get("/ninebox/history/{employee_id}")
def get_ninebox_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Historique 9-Box d'un employé"""
    tenant_id = get_tenant_id(current_user)

    rows = db.execute(text("""
        SELECT * FROM nine_box_placements
        WHERE employee_id = :eid AND tenant_id = :tid
        ORDER BY period DESC
    """), {"eid": employee_id, "tid": tenant_id}).fetchall()

    return [dict(r._mapping) for r in rows]


@router.delete("/ninebox/{placement_id}")
def delete_ninebox_placement(
    placement_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Supprimer un placement 9-Box"""
    require_rh(current_user)
    db.execute(text("DELETE FROM nine_box_placements WHERE id = :id"), {"id": placement_id})
    db.commit()
    return {"message": "Placement supprimé"}


# ============================================
# 2. PLANS DE SUCCESSION
# ============================================

@router.get("/succession")
def list_succession_plans(
    criticality: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des plans de succession"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    where = ["sp.tenant_id = :tid"]
    params = {"tid": tenant_id}

    if criticality:
        where.append("sp.criticality = :crit")
        params["crit"] = criticality

    rows = db.execute(text(f"""
        SELECT sp.*,
            e.first_name || ' ' || e.last_name AS current_holder_name,
            e.job_title AS current_holder_title,
            e.photo_url AS current_holder_photo,
            (SELECT COUNT(*) FROM succession_candidates sc WHERE sc.succession_plan_id = sp.id) AS candidate_count
        FROM succession_plans sp
        LEFT JOIN employees e ON e.id = sp.current_holder_id
        WHERE {' AND '.join(where)}
        ORDER BY
            CASE sp.criticality WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
            sp.position_title
    """), params).fetchall()

    return [dict(r._mapping) for r in rows]


@router.post("/succession")
def create_succession_plan(
    data: SuccessionPlanCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Créer un plan de succession"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)
    user_id = get_user_id(current_user)

    result = db.execute(text("""
        INSERT INTO succession_plans (tenant_id, position_title, department, current_holder_id, criticality, vacancy_risk, notes, created_by)
        VALUES (:tid, :title, :dept, :holder, :crit, :risk, :notes, :uid)
        RETURNING id
    """), {
        "tid": tenant_id, "title": data.position_title, "dept": data.department,
        "holder": data.current_holder_id, "crit": data.criticality,
        "risk": data.vacancy_risk, "notes": data.notes, "uid": user_id
    })
    db.commit()

    return {"id": result.fetchone()[0], "message": f"Plan de succession créé pour '{data.position_title}'"}


@router.get("/succession/{plan_id}")
def get_succession_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Détail d'un plan de succession avec candidats"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    plan = db.execute(text("""
        SELECT sp.*,
            e.first_name || ' ' || e.last_name AS current_holder_name,
            e.job_title AS current_holder_title,
            e.photo_url AS current_holder_photo
        FROM succession_plans sp
        LEFT JOIN employees e ON e.id = sp.current_holder_id
        WHERE sp.id = :id AND sp.tenant_id = :tid
    """), {"id": plan_id, "tid": tenant_id}).fetchone()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan non trouvé")

    result = dict(plan._mapping)

    # Candidats
    candidates = db.execute(text("""
        SELECT sc.*,
            e.first_name, e.last_name, e.job_title, e.photo_url, e.hire_date,
            d.name AS department_name,
            nb.performance_score AS latest_perf, nb.potential_score AS latest_pot, nb.quadrant
        FROM succession_candidates sc
        JOIN employees e ON e.id = sc.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN LATERAL (
            SELECT performance_score, potential_score, quadrant
            FROM nine_box_placements
            WHERE employee_id = sc.employee_id AND tenant_id = :tid
            ORDER BY period DESC LIMIT 1
        ) nb ON true
        WHERE sc.succession_plan_id = :plan_id
        ORDER BY sc.rank_order
    """), {"plan_id": plan_id, "tid": tenant_id}).fetchall()

    result["candidates"] = [dict(c._mapping) for c in candidates]

    return result


@router.put("/succession/{plan_id}")
def update_succession_plan(
    plan_id: int,
    data: SuccessionPlanUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Modifier un plan de succession"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)

    updates = []
    params = {"id": plan_id, "tid": tenant_id}

    if data.position_title is not None:
        updates.append("position_title = :title"); params["title"] = data.position_title
    if data.department is not None:
        updates.append("department = :dept"); params["dept"] = data.department
    if data.current_holder_id is not None:
        updates.append("current_holder_id = :holder"); params["holder"] = data.current_holder_id
    if data.criticality is not None:
        updates.append("criticality = :crit"); params["crit"] = data.criticality
    if data.vacancy_risk is not None:
        updates.append("vacancy_risk = :risk"); params["risk"] = data.vacancy_risk
    if data.notes is not None:
        updates.append("notes = :notes"); params["notes"] = data.notes

    if updates:
        updates.append("updated_at = NOW()")
        db.execute(text(f"""
            UPDATE succession_plans SET {', '.join(updates)}
            WHERE id = :id AND tenant_id = :tid
        """), params)
        db.commit()

    return {"message": "Plan mis à jour"}


@router.delete("/succession/{plan_id}")
def delete_succession_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Supprimer un plan de succession"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)

    db.execute(text(
        "DELETE FROM succession_plans WHERE id = :id AND tenant_id = :tid"
    ), {"id": plan_id, "tid": tenant_id})
    db.commit()

    return {"message": "Plan supprimé"}


# ============================================
# 3. CANDIDATS SUCCESSEURS
# ============================================

@router.post("/succession/{plan_id}/candidates")
def add_succession_candidate(
    plan_id: int,
    data: SuccessionCandidateAdd,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Ajouter un candidat successeur"""
    require_rh_or_manager(current_user)

    # Vérifier doublon
    existing = db.execute(text("""
        SELECT id FROM succession_candidates
        WHERE succession_plan_id = :pid AND employee_id = :eid
    """), {"pid": plan_id, "eid": data.employee_id}).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Candidat déjà dans ce plan")

    result = db.execute(text("""
        INSERT INTO succession_candidates (succession_plan_id, employee_id, readiness, preparation_score, rank_order, development_notes)
        VALUES (:pid, :eid, :ready, :score, :rank, :notes)
        RETURNING id
    """), {
        "pid": plan_id, "eid": data.employee_id, "ready": data.readiness,
        "score": data.preparation_score, "rank": data.rank_order, "notes": data.development_notes
    })
    db.commit()

    return {"id": result.fetchone()[0], "message": "Candidat ajouté"}


@router.put("/succession/candidates/{candidate_id}")
def update_succession_candidate(
    candidate_id: int,
    data: SuccessionCandidateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Modifier un candidat successeur"""
    require_rh_or_manager(current_user)

    updates = []
    params = {"id": candidate_id}

    if data.readiness is not None:
        updates.append("readiness = :ready"); params["ready"] = data.readiness
    if data.preparation_score is not None:
        updates.append("preparation_score = :score"); params["score"] = data.preparation_score
    if data.rank_order is not None:
        updates.append("rank_order = :rank"); params["rank"] = data.rank_order
    if data.development_notes is not None:
        updates.append("development_notes = :notes"); params["notes"] = data.development_notes

    if updates:
        db.execute(text(f"UPDATE succession_candidates SET {', '.join(updates)} WHERE id = :id"), params)
        db.commit()

    return {"message": "Candidat mis à jour"}


@router.delete("/succession/candidates/{candidate_id}")
def remove_succession_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Retirer un candidat"""
    require_rh(current_user)
    db.execute(text("DELETE FROM succession_candidates WHERE id = :id"), {"id": candidate_id})
    db.commit()
    return {"message": "Candidat retiré"}


# ============================================
# 4. DASHBOARD / STATS CONSOLIDÉES
# ============================================

@router.get("/dashboard")
def career_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Dashboard consolidé Talents & Carrière"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    dashboard = {}

    # 9-Box stats (dernière période)
    latest_period = db.execute(text("""
        SELECT period FROM nine_box_placements WHERE tenant_id = :tid ORDER BY period DESC LIMIT 1
    """), {"tid": tenant_id}).fetchone()

    if latest_period:
        period = latest_period[0]
        dashboard["ninebox_period"] = period

        box_stats = db.execute(text("""
            SELECT quadrant, COUNT(*) AS count
            FROM nine_box_placements
            WHERE tenant_id = :tid AND period = :period
            GROUP BY quadrant ORDER BY quadrant
        """), {"tid": tenant_id, "period": period}).fetchall()
        dashboard["ninebox_distribution"] = {r[0]: r[1] for r in box_stats}

        dashboard["total_evaluated"] = sum(r[1] for r in box_stats)
        dashboard["stars"] = dashboard["ninebox_distribution"].get(9, 0)
        dashboard["high_potentials"] = sum(dashboard["ninebox_distribution"].get(q, 0) for q in [7, 8, 9])
        dashboard["at_risk"] = sum(dashboard["ninebox_distribution"].get(q, 0) for q in [1, 2])
    else:
        dashboard["ninebox_period"] = None
        dashboard["total_evaluated"] = 0
        dashboard["stars"] = 0
        dashboard["high_potentials"] = 0
        dashboard["at_risk"] = 0

    # Carrière stats
    dashboard["total_paths"] = db.execute(text(
        "SELECT COUNT(*) FROM career_paths WHERE tenant_id = :tid AND is_active = true"
    ), {"tid": tenant_id}).scalar() or 0

    dashboard["employees_assigned"] = db.execute(text(
        "SELECT COUNT(DISTINCT employee_id) FROM employee_careers WHERE tenant_id = :tid"
    ), {"tid": tenant_id}).scalar() or 0

    dashboard["eligible_promotions"] = db.execute(text(
        "SELECT COUNT(*) FROM employee_careers WHERE tenant_id = :tid AND eligibility_status = 'eligible'"
    ), {"tid": tenant_id}).scalar() or 0

    dashboard["pending_promotions"] = db.execute(text(
        "SELECT COUNT(*) FROM promotion_requests WHERE tenant_id = :tid AND status = 'pending'"
    ), {"tid": tenant_id}).scalar() or 0

    # Succession stats
    dashboard["succession_plans"] = db.execute(text(
        "SELECT COUNT(*) FROM succession_plans WHERE tenant_id = :tid"
    ), {"tid": tenant_id}).scalar() or 0

    dashboard["critical_positions"] = db.execute(text(
        "SELECT COUNT(*) FROM succession_plans WHERE tenant_id = :tid AND criticality = 'critical'"
    ), {"tid": tenant_id}).scalar() or 0

    positions_without_successor = db.execute(text("""
        SELECT COUNT(*) FROM succession_plans sp
        WHERE sp.tenant_id = :tid
        AND NOT EXISTS (SELECT 1 FROM succession_candidates sc WHERE sc.succession_plan_id = sp.id)
    """), {"tid": tenant_id}).scalar() or 0
    dashboard["positions_without_successor"] = positions_without_successor

    # Top talents (stars + high potential du 9-Box)
    if latest_period:
        top = db.execute(text("""
            SELECT nb.employee_id, e.first_name, e.last_name, e.job_title, e.photo_url,
                nb.performance_score, nb.potential_score, nb.quadrant,
                d.name AS department
            FROM nine_box_placements nb
            JOIN employees e ON e.id = nb.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            WHERE nb.tenant_id = :tid AND nb.period = :period AND nb.quadrant >= 8
            ORDER BY nb.quadrant DESC, nb.performance_score DESC
            LIMIT 10
        """), {"tid": tenant_id, "period": latest_period[0]}).fetchall()
        dashboard["top_talents"] = [dict(r._mapping) for r in top]
    else:
        dashboard["top_talents"] = []

    # Promotions récentes (30 derniers jours)
    recent_promos = db.execute(text("""
        SELECT pr.decision_date,
            e.first_name, e.last_name,
            fl.title AS from_level, tl.title AS to_level,
            cp.name AS path_name
        FROM promotion_requests pr
        JOIN employee_careers ec ON ec.id = pr.employee_career_id
        JOIN employees e ON e.id = ec.employee_id
        JOIN career_levels fl ON fl.id = pr.from_level_id
        JOIN career_levels tl ON tl.id = pr.to_level_id
        JOIN career_paths cp ON cp.id = ec.career_path_id
        WHERE pr.tenant_id = :tid AND pr.status = 'approved'
            AND pr.decision_date >= NOW() - INTERVAL '30 days'
        ORDER BY pr.decision_date DESC
        LIMIT 5
    """), {"tid": tenant_id}).fetchall()
    dashboard["recent_promotions"] = [dict(r._mapping) for r in recent_promos]

    return dashboard


# ============================================
# 9-BOX AUTO-CALCULATION FROM REAL DATA
# ============================================

@router.post("/ninebox/auto-compute")
def auto_compute_ninebox(
    period: str,
    employee_ids: Optional[List[int]] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calcule automatiquement la 9-box depuis les données réelles :
    - performance_score : moyenne pondérée des évaluations + % OKR
    - potential_score   : score moyen des compétences + score attitude
    Crée/met à jour les placements 9-box pour la période donnée.
    """
    tenant_id = get_tenant_id(current_user)
    require_rh(current_user)

    # Si pas d'employee_ids fourni → tous les actifs du tenant
    if not employee_ids:
        rows = db.execute(text("""
            SELECT id FROM employees
            WHERE tenant_id = :tid AND status::text = 'active'
        """), {"tid": tenant_id}).fetchall()
        employee_ids = [r[0] for r in rows]

    results = []
    for emp_id in employee_ids:
        # ── Performance score ──────────────────────────────────────────
        # Moyenne des weighted_score sur les évaluations complétées
        eval_row = db.execute(text("""
            SELECT AVG(e.weighted_score) as avg_eval
            FROM evaluations e
            JOIN evaluation_campaigns ec ON e.campaign_id = ec.id
            WHERE e.employee_id = :eid AND ec.tenant_id = :tid
              AND e.status = 'completed'
        """), {"eid": emp_id, "tid": tenant_id}).fetchone()
        avg_eval = float(eval_row[0] or 0)  # 0-10

        # % réalisation OKR personnels
        okr_row = db.execute(text("""
            SELECT AVG(progress) FROM objectives
            WHERE owner_id = :eid AND tenant_id = :tid
              AND level = 'individual' AND status NOT IN ('draft','cancelled')
        """), {"eid": emp_id, "tid": tenant_id}).fetchone()
        okr_pct = float(okr_row[0] or 0)  # 0-100

        # Performance score final 1.0-5.0
        # eval 0-10 → 0-5 ; OKR 0-100 → 0-5 ; moyenne
        perf_from_eval = (avg_eval / 10) * 5
        perf_from_okr = (okr_pct / 100) * 5
        performance_score = round((perf_from_eval * 0.6 + perf_from_okr * 0.4), 2)
        if performance_score < 1.0:
            performance_score = 1.0
        elif performance_score > 5.0:
            performance_score = 5.0

        # ── Potential score ────────────────────────────────────────────
        # Score moyen des compétences (0-100 → 1-5)
        skills_row = db.execute(text("""
            SELECT AVG(current_level) FROM employee_skills
            WHERE employee_id = :eid AND tenant_id = :tid
        """), {"eid": emp_id, "tid": tenant_id}).fetchone()
        avg_skills = float(skills_row[0] or 0)  # 0-100

        # Score attitude depuis feedbacks
        att_row = db.execute(text("""
            SELECT
                SUM(CASE WHEN fa.sentiment = 'recognition' THEN 1 ELSE 0 END) AS rec,
                SUM(CASE WHEN fa.sentiment = 'improvement' THEN 1 ELSE 0 END) AS imp
            FROM feedback_attitudes fa
            JOIN feedbacks f ON fa.feedback_id = f.id
            WHERE f.to_employee_id = :eid AND f.tenant_id = :tid
        """), {"eid": emp_id, "tid": tenant_id}).fetchone()
        rec = int(att_row[0] or 0)
        imp = int(att_row[1] or 0)
        total_fb = rec + imp
        attitude_pct = (rec / total_fb * 100) if total_fb > 0 else 50.0

        # Potential = 70% compétences + 30% attitude → normalisé 1-5
        potential_raw = (avg_skills * 0.7 + attitude_pct * 0.3) / 100 * 5
        potential_score = round(max(1.0, min(5.0, potential_raw)), 2)
        if potential_score < 1.0:
            potential_score = 1.0

        if performance_score == 1.0 and potential_score == 1.0:
            # Pas assez de données
            continue

        # Upsert ninebox placement
        existing = db.execute(text("""
            SELECT id FROM ninebox_placements
            WHERE employee_id = :eid AND tenant_id = :tid AND period = :period
        """), {"eid": emp_id, "tid": tenant_id, "period": period}).fetchone()

        quadrant = calculate_quadrant(performance_score, potential_score)
        if existing:
            db.execute(text("""
                UPDATE ninebox_placements
                SET performance_score = :perf, potential_score = :pot,
                    quadrant = :q, notes = 'Auto-calculé depuis données réelles',
                    updated_at = NOW()
                WHERE id = :id
            """), {"perf": performance_score, "pot": potential_score, "q": quadrant, "id": existing[0]})
        else:
            db.execute(text("""
                INSERT INTO ninebox_placements
                (tenant_id, employee_id, period, performance_score, potential_score, quadrant, notes, placed_by, created_at)
                VALUES (:tid, :eid, :period, :perf, :pot, :q, 'Auto-calculé depuis données réelles', :by, NOW())
            """), {
                "tid": tenant_id, "eid": emp_id, "period": period,
                "perf": performance_score, "pot": potential_score, "q": quadrant,
                "by": get_user_id(current_user)
            })

        results.append({
            "employee_id": emp_id,
            "performance_score": performance_score,
            "potential_score": potential_score,
            "quadrant": quadrant,
        })

    db.commit()
    return {"computed": len(results), "period": period, "placements": results}


@router.get("/ninebox/auto-preview")
def preview_ninebox_auto(
    employee_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Prévisualise les scores 9-box calculés automatiquement pour un employé"""
    tenant_id = get_tenant_id(current_user)

    eval_row = db.execute(text("""
        SELECT AVG(e.weighted_score) FROM evaluations e
        JOIN evaluation_campaigns ec ON e.campaign_id = ec.id
        WHERE e.employee_id = :eid AND ec.tenant_id = :tid AND e.status = 'completed'
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()
    avg_eval = float(eval_row[0] or 0)

    okr_row = db.execute(text("""
        SELECT AVG(progress) FROM objectives
        WHERE owner_id = :eid AND tenant_id = :tid AND level = 'individual' AND status NOT IN ('draft','cancelled')
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()
    okr_pct = float(okr_row[0] or 0)

    skills_row = db.execute(text("""
        SELECT AVG(current_level) FROM employee_skills
        WHERE employee_id = :eid AND tenant_id = :tid
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()
    avg_skills = float(skills_row[0] or 0)

    att_row = db.execute(text("""
        SELECT
            SUM(CASE WHEN fa.sentiment = 'recognition' THEN 1 ELSE 0 END),
            SUM(CASE WHEN fa.sentiment = 'improvement' THEN 1 ELSE 0 END)
        FROM feedback_attitudes fa
        JOIN feedbacks f ON fa.feedback_id = f.id
        WHERE f.to_employee_id = :eid AND f.tenant_id = :tid
    """), {"eid": employee_id, "tid": tenant_id}).fetchone()
    rec, imp = int(att_row[0] or 0), int(att_row[1] or 0)
    attitude_pct = (rec / (rec + imp) * 100) if (rec + imp) > 0 else 50.0

    perf_score = round(max(1.0, min(5.0, ((avg_eval / 10) * 5 * 0.6 + (okr_pct / 100) * 5 * 0.4))), 2)
    pot_score = round(max(1.0, min(5.0, (avg_skills * 0.7 + attitude_pct * 0.3) / 100 * 5)), 2)

    return {
        "employee_id": employee_id,
        "performance_score": perf_score,
        "potential_score": pot_score,
        "quadrant": calculate_quadrant(perf_score, pot_score),
        "detail": {
            "avg_evaluation_score": avg_eval,
            "okr_achievement_pct": okr_pct,
            "avg_competency_level": avg_skills,
            "attitude_positive_pct": attitude_pct,
        }
    }

