# ============================================
# API: Talents & Carrière — Bloc 2
# Carrière Employé, Progression, Promotions
# Fichier: app/api/careers_employee.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_CAREERS

router = APIRouter(prefix="/api/careers", tags=["Talents & Carrière - Employé"], dependencies=[Depends(require_feature(FEATURE_CAREERS))])


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

def get_employee_id_from_user(user, db) -> Optional[int]:
    """Retrouver l'employee_id via l'email du user"""
    if isinstance(user, dict):
        email = user.get("email")
        tenant_id = user.get("tenant_id", 1)
    else:
        email = getattr(user, "email", None)
        tenant_id = getattr(user, "tenant_id", 1)
    if not email:
        return None
    row = db.execute(text(
        "SELECT id FROM employees WHERE email = :email AND tenant_id = :tid LIMIT 1"
    ), {"email": email, "tid": tenant_id}).fetchone()
    return row[0] if row else None

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

class AssignCareerRequest(BaseModel):
    employee_id: int
    career_path_id: int
    level_id: int  # niveau de départ

class AssignBulkRequest(BaseModel):
    employee_ids: List[int]
    career_path_id: int
    level_id: int

class PromotionRequestCreate(BaseModel):
    employee_career_id: int
    comments: Optional[str] = None

class PromotionDecision(BaseModel):
    status: str  # approved | rejected
    committee_decision: Optional[str] = None
    comments: Optional[str] = None


# ============================================
# 1. ASSIGNATION EMPLOYÉ → PARCOURS
# ============================================

@router.post("/employees/assign")
def assign_employee_to_path(
    data: AssignCareerRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Assigner un employé à un parcours de carrière"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    # Vérifier que l'employé n'est pas déjà sur ce parcours
    existing = db.execute(text("""
        SELECT id FROM employee_careers
        WHERE employee_id = :eid AND career_path_id = :pid
    """), {"eid": data.employee_id, "pid": data.career_path_id}).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Employé déjà assigné à ce parcours")

    # Vérifier que le niveau appartient au parcours
    level = db.execute(text("""
        SELECT id, level_order FROM career_levels
        WHERE id = :lid AND career_path_id = :pid
    """), {"lid": data.level_id, "pid": data.career_path_id}).fetchone()
    if not level:
        raise HTTPException(status_code=400, detail="Niveau invalide pour ce parcours")

    # Trouver le niveau suivant
    next_level = db.execute(text("""
        SELECT id FROM career_levels
        WHERE career_path_id = :pid AND level_order = :next_ord
    """), {"pid": data.career_path_id, "next_ord": level[1] + 1}).fetchone()

    # Créer la carrière
    result = db.execute(text("""
        INSERT INTO employee_careers (tenant_id, employee_id, career_path_id, current_level_id, next_level_id, level_start_date)
        VALUES (:tid, :eid, :pid, :lid, :nlid, CURRENT_DATE)
        RETURNING id
    """), {
        "tid": tenant_id, "eid": data.employee_id, "pid": data.career_path_id,
        "lid": data.level_id, "nlid": next_level[0] if next_level else None
    })

    ec_id = result.fetchone()[0]

    # Auto-créer les entrées CompetencyProgress pour le niveau suivant (si existe)
    target_level_id = next_level[0] if next_level else data.level_id
    competencies = db.execute(text("""
        SELECT id FROM level_competencies WHERE career_level_id = :lid
    """), {"lid": target_level_id}).fetchall()

    for comp in competencies:
        db.execute(text("""
            INSERT INTO competency_progress (employee_career_id, level_competency_id)
            VALUES (:ec_id, :lc_id)
            ON CONFLICT DO NOTHING
        """), {"ec_id": ec_id, "lc_id": comp[0]})

    db.commit()
    return {"id": ec_id, "message": "Employé assigné au parcours"}


@router.post("/employees/assign-bulk")
def assign_bulk(
    data: AssignBulkRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Assignation en masse de collaborateurs à un parcours"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)

    assigned = 0
    skipped = 0

    for emp_id in data.employee_ids:
        # Vérifier doublon
        existing = db.execute(text("""
            SELECT id FROM employee_careers WHERE employee_id = :eid AND career_path_id = :pid
        """), {"eid": emp_id, "pid": data.career_path_id}).fetchone()
        if existing:
            skipped += 1
            continue

        # Niveau suivant
        level = db.execute(text(
            "SELECT level_order FROM career_levels WHERE id = :lid"
        ), {"lid": data.level_id}).fetchone()
        next_level = db.execute(text("""
            SELECT id FROM career_levels WHERE career_path_id = :pid AND level_order = :next_ord
        """), {"pid": data.career_path_id, "next_ord": level[0] + 1}).fetchone() if level else None

        result = db.execute(text("""
            INSERT INTO employee_careers (tenant_id, employee_id, career_path_id, current_level_id, next_level_id, level_start_date)
            VALUES (:tid, :eid, :pid, :lid, :nlid, CURRENT_DATE)
            RETURNING id
        """), {
            "tid": tenant_id, "eid": emp_id, "pid": data.career_path_id,
            "lid": data.level_id, "nlid": next_level[0] if next_level else None
        })

        ec_id = result.fetchone()[0]

        # Auto-créer CompetencyProgress
        target_lid = next_level[0] if next_level else data.level_id
        comps = db.execute(text(
            "SELECT id FROM level_competencies WHERE career_level_id = :lid"
        ), {"lid": target_lid}).fetchall()
        for c in comps:
            db.execute(text("""
                INSERT INTO competency_progress (employee_career_id, level_competency_id)
                VALUES (:ec_id, :lc_id) ON CONFLICT DO NOTHING
            """), {"ec_id": ec_id, "lc_id": c[0]})

        assigned += 1

    db.commit()
    return {"assigned": assigned, "skipped": skipped, "message": f"{assigned} employé(s) assigné(s), {skipped} ignoré(s)"}


# ============================================
# 2. CONSULTER LA CARRIÈRE
# ============================================

@router.get("/employees/my-career")
def get_my_career(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Mon parcours de carrière (vue employé)"""
    employee_id = get_employee_id_from_user(current_user, db)
    if not employee_id:
        raise HTTPException(status_code=404, detail="Profil employé non trouvé")

    return _get_employee_career_detail(employee_id, db)


@router.get("/employees/{employee_id}/career")
def get_employee_career(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Parcours de carrière d'un employé (vue RH/Manager)"""
    require_rh_or_manager(current_user)
    return _get_employee_career_detail(employee_id, db)


def _get_employee_career_detail(employee_id: int, db: Session):
    """Détail complet de la carrière d'un employé"""

    # Carrière(s)
    careers = db.execute(text("""
        SELECT ec.*,
            cp.name AS path_name, cp.description AS path_description,
            cl.title AS current_level_title, cl.level_order AS current_level_order,
            nl.title AS next_level_title, nl.level_order AS next_level_order,
            e.first_name, e.last_name, e.job_title, e.hire_date
        FROM employee_careers ec
        JOIN career_paths cp ON cp.id = ec.career_path_id
        JOIN career_levels cl ON cl.id = ec.current_level_id
        LEFT JOIN career_levels nl ON nl.id = ec.next_level_id
        JOIN employees e ON e.id = ec.employee_id
        WHERE ec.employee_id = :eid
        ORDER BY ec.created_at DESC
    """), {"eid": employee_id}).fetchall()

    if not careers:
        return {"employee_id": employee_id, "careers": [], "message": "Aucun parcours assigné"}

    result = []
    for career in careers:
        c = dict(career._mapping)
        ec_id = c["id"]

        # Tous les niveaux du parcours (pour la timeline)
        all_levels = db.execute(text("""
            SELECT id, level_order, title, is_entry_level
            FROM career_levels WHERE career_path_id = :pid ORDER BY level_order
        """), {"pid": c["career_path_id"]}).fetchall()
        c["all_levels"] = [dict(l._mapping) for l in all_levels]

        # Progression des compétences pour le niveau suivant
        progress = db.execute(text("""
            SELECT cp.*, lc.competency_name, lc.performance_threshold, lc.attitude_threshold, lc.is_mandatory,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', co.id, 'title', co.title))
                     FROM level_competency_trainings lct
                     JOIN courses co ON co.id = lct.course_id
                     WHERE lct.level_competency_id = cp.level_competency_id), '[]'
                ) AS required_trainings
            FROM competency_progress cp
            JOIN level_competencies lc ON lc.id = cp.level_competency_id
            WHERE cp.employee_career_id = :ec_id
            ORDER BY lc.id
        """), {"ec_id": ec_id}).fetchall()
        c["competency_progress"] = [dict(p._mapping) for p in progress]

        # Calculer pourcentage global
        total = len(progress)
        validated = sum(1 for p in progress if dict(p._mapping).get("effective_status") == "validated")
        c["overall_progress"] = round((validated / total * 100) if total > 0 else 0, 1)

        # Facteurs de promotion du niveau suivant
        if c.get("next_level_id"):
            factors = db.execute(text("""
                SELECT * FROM promotion_factors WHERE career_level_id = :lid ORDER BY id
            """), {"lid": c["next_level_id"]}).fetchall()
            c["promotion_factors"] = [dict(f._mapping) for f in factors]
        else:
            c["promotion_factors"] = []

        # Historique promotions
        promotions = db.execute(text("""
            SELECT pr.*,
                fl.title AS from_level_title, tl.title AS to_level_title,
                u.email AS requested_by_email
            FROM promotion_requests pr
            JOIN career_levels fl ON fl.id = pr.from_level_id
            JOIN career_levels tl ON tl.id = pr.to_level_id
            LEFT JOIN users u ON u.id = pr.requested_by
            WHERE pr.employee_career_id = :ec_id
            ORDER BY pr.created_at DESC
        """), {"ec_id": ec_id}).fetchall()
        c["promotion_history"] = [dict(p._mapping) for p in promotions]

        result.append(c)

    return {"employee_id": employee_id, "careers": result}


@router.get("/employees/all")
def list_all_employee_careers(
    path_id: Optional[int] = None,
    eligibility: Optional[str] = None,
    search: Optional[str] = None,
    manager_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste les employés assignés à des parcours (vue RH/Manager)"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    where = ["ec.tenant_id = :tid"]
    params = {"tid": tenant_id}

    if path_id:
        where.append("ec.career_path_id = :pid")
        params["pid"] = path_id
    if eligibility:
        where.append("ec.eligibility_status = :elig")
        params["elig"] = eligibility
    if search:
        where.append("(e.first_name ILIKE :q OR e.last_name ILIKE :q)")
        params["q"] = f"%{search}%"
    if manager_id:
        where.append("e.manager_id = :mid")
        params["mid"] = manager_id

    rows = db.execute(text(f"""
        SELECT ec.id, ec.employee_id, ec.eligibility_status, ec.level_start_date,
            ec.estimated_promotion_date,
            e.first_name, e.last_name, e.job_title, e.photo_url,
            cp.name AS path_name,
            cl.title AS current_level_title, cl.level_order,
            nl.title AS next_level_title,
            (SELECT COUNT(*) FROM competency_progress p
             WHERE p.employee_career_id = ec.id AND p.effective_status = 'validated') AS validated_count,
            (SELECT COUNT(*) FROM competency_progress p
             WHERE p.employee_career_id = ec.id) AS total_count
        FROM employee_careers ec
        JOIN employees e ON e.id = ec.employee_id
        JOIN career_paths cp ON cp.id = ec.career_path_id
        JOIN career_levels cl ON cl.id = ec.current_level_id
        LEFT JOIN career_levels nl ON nl.id = ec.next_level_id
        WHERE {' AND '.join(where)}
        ORDER BY cp.name, cl.level_order, e.last_name
    """), params).fetchall()

    return [dict(r._mapping) for r in rows]


# ============================================
# 3. SYNCHRONISER PROGRESSION (depuis autres modules)
# ============================================

@router.post("/employees/{employee_id}/sync-progress")
def sync_employee_progress(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Synchroniser la progression d'un employé :
    - Vérifie formations complétées (Learning)
    - Vérifie scores post-formation (EPF)
    - Vérifie score performance (Performance)
    - Vérifie scores attitudes (Attitudes/Feedback 360°)
    - Met à jour theoretical_status + effective_status
    - Met à jour eligibility_status
    """
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    # Toutes les carrières de l'employé
    careers = db.execute(text("""
        SELECT ec.id AS ec_id, ec.next_level_id, ec.current_level_id, ec.career_path_id
        FROM employee_careers ec
        WHERE ec.employee_id = :eid AND ec.tenant_id = :tid
    """), {"eid": employee_id, "tid": tenant_id}).fetchall()

    updated_count = 0

    for career in careers:
        c = dict(career._mapping)
        ec_id = c["ec_id"]
        target_level_id = c["next_level_id"] or c["current_level_id"]

        # Toutes les progressions de compétences
        progress_rows = db.execute(text("""
            SELECT cp.id AS cp_id, cp.level_competency_id,
                lc.performance_threshold, lc.attitude_threshold,
                COALESCE(lc.post_training_threshold, 50) AS post_training_threshold
            FROM competency_progress cp
            JOIN level_competencies lc ON lc.id = cp.level_competency_id
            WHERE cp.employee_career_id = :ec_id
        """), {"ec_id": ec_id}).fetchall()

        # ── Pré-calcul attitudes au niveau du parcours (commun à toutes les compétences) ──
        required_attitudes = db.execute(text("""
            SELECT lra.attitude_id, lra.threshold
            FROM level_required_attitudes lra
            WHERE lra.career_level_id = :lid
        """), {"lid": target_level_id}).fetchall()

        if required_attitudes:
            att_checks = []
            att_score_values = []
            for ra in required_attitudes:
                ra_d = dict(ra._mapping)
                score = db.execute(text("""
                    SELECT COALESCE(avg_score_pct, 0)
                    FROM attitude_scores
                    WHERE employee_id = :eid AND attitude_id = :aid
                    ORDER BY computed_at DESC LIMIT 1
                """), {"eid": employee_id, "aid": ra_d["attitude_id"]}).scalar() or 0.0
                att_checks.append(float(score) >= float(ra_d["threshold"]))
                att_score_values.append(float(score))
            level_att_ok = all(att_checks)
            level_att_score = sum(att_score_values) / len(att_score_values)
        else:
            # Aucune attitude requise configurée : fallback sur moyenne globale
            level_att_score = db.execute(text("""
                SELECT COALESCE(AVG(avg_score_pct), 0)
                FROM attitude_scores
                WHERE employee_id = :eid
            """), {"eid": employee_id}).scalar() or 0.0
            level_att_ok = None  # déterminé par seuil de compétence

        # ── Score performance (dernier score annuel, commun à toutes les compétences) ──
        perf_score = db.execute(text("""
            SELECT AVG(e.weighted_score) * 10
            FROM evaluations e
            JOIN evaluation_campaigns ec ON e.campaign_id = ec.id
            WHERE e.employee_id = :eid AND ec.tenant_id = :tid
              AND e.status = 'completed' AND e.weighted_score IS NOT NULL
        """), {"eid": employee_id, "tid": tenant_id}).scalar()

        for prog in progress_rows:
            p = dict(prog._mapping)
            cp_id = p["cp_id"]
            lc_id = p["level_competency_id"]

            # 1. Formations complétées pour cette compétence
            training_done = db.execute(text("""
                SELECT COUNT(*) = (
                    SELECT COUNT(*) FROM level_competency_trainings WHERE level_competency_id = :lc_id AND is_required = true
                )
                FROM level_competency_trainings lct
                JOIN course_assignments ca ON ca.course_id = lct.course_id AND ca.employee_id = :eid
                WHERE lct.level_competency_id = :lc_id AND lct.is_required = true AND ca.status = 'completed'
            """), {"lc_id": lc_id, "eid": employee_id}).scalar() or False

            # 2. Score post-formation moyen
            post_score = db.execute(text("""
                SELECT AVG(pte.score)
                FROM post_training_evaluations pte
                JOIN level_competency_trainings lct ON lct.course_id = pte.course_id
                WHERE lct.level_competency_id = :lc_id AND pte.employee_id = :eid AND pte.status = 'completed'
            """), {"lc_id": lc_id, "eid": employee_id}).scalar()

            # Théorique = formations complétées + score EPF >= seuil configurable
            post_threshold = float(p.get("post_training_threshold") or 50)
            theoretical = "validated" if (training_done and post_score and float(post_score) >= post_threshold) else "pending"

            # 3. Effective = théorique + performance >= seuil + attitudes requises ok
            perf_threshold = float(p["performance_threshold"] or 95)
            att_threshold = float(p["attitude_threshold"] or 95)
            perf_ok = perf_score is not None and float(perf_score) >= perf_threshold

            if level_att_ok is not None:
                att_ok = level_att_ok
                att_score = level_att_score
            else:
                att_score = level_att_score
                att_ok = float(att_score) >= att_threshold

            effective = "validated" if (theoretical == "validated" and perf_ok and att_ok) else "pending"

            # Mise à jour
            db.execute(text("""
                UPDATE competency_progress SET
                    training_completed = :tc,
                    post_training_score = :pts,
                    performance_score = :ps,
                    attitude_score = :as,
                    theoretical_status = :ts,
                    effective_status = :es,
                    updated_at = NOW()
                WHERE id = :id
            """), {
                "tc": training_done, "pts": post_score,
                "ps": perf_score, "as": att_score,
                "ts": theoretical, "es": effective,
                "id": cp_id
            })
            updated_count += 1

        # Mettre à jour eligibility_status
        total = db.execute(text(
            "SELECT COUNT(*) FROM competency_progress WHERE employee_career_id = :ec_id"
        ), {"ec_id": ec_id}).scalar() or 0

        validated = db.execute(text("""
            SELECT COUNT(*) FROM competency_progress
            WHERE employee_career_id = :ec_id AND effective_status = 'validated'
        """), {"ec_id": ec_id}).scalar() or 0

        if total > 0 and validated == total:
            new_status = "eligible"
        elif validated > 0:
            new_status = "in_progress"
        else:
            new_status = "not_eligible"

        db.execute(text("""
            UPDATE employee_careers SET eligibility_status = :status, updated_at = NOW()
            WHERE id = :ec_id
        """), {"status": new_status, "ec_id": ec_id})

    db.commit()
    return {"message": f"Progression synchronisée ({updated_count} compétences mises à jour)"}


@router.post("/employees/sync-all")
def sync_all_progress(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Synchroniser la progression de TOUS les employés (batch RH)"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)

    employees = db.execute(text("""
        SELECT DISTINCT employee_id FROM employee_careers WHERE tenant_id = :tid
    """), {"tid": tenant_id}).fetchall()

    count = 0
    for emp in employees:
        try:
            sync_employee_progress(emp[0], db=db, current_user=current_user)
            count += 1
        except Exception as e:
            print(f"[sync-all] Error for employee {emp[0]}: {e}")
            continue

    return {"message": f"{count} employé(s) synchronisé(s)"}


# ============================================
# 4. DEMANDES DE PROMOTION
# ============================================

@router.post("/promotions/request")
def create_promotion_request(
    data: PromotionRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Créer une demande de promotion"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)
    user_id = get_user_id(current_user)

    # Vérifier carrière et éligibilité
    ec = db.execute(text("""
        SELECT ec.*, cl.title AS current_title, nl.title AS next_title
        FROM employee_careers ec
        JOIN career_levels cl ON cl.id = ec.current_level_id
        LEFT JOIN career_levels nl ON nl.id = ec.next_level_id
        WHERE ec.id = :ec_id AND ec.tenant_id = :tid
    """), {"ec_id": data.employee_career_id, "tid": tenant_id}).fetchone()

    if not ec:
        raise HTTPException(status_code=404, detail="Carrière non trouvée")

    ec_dict = dict(ec._mapping)
    if not ec_dict.get("next_level_id"):
        raise HTTPException(status_code=400, detail="Employé déjà au niveau maximum")

    if ec_dict["eligibility_status"] != "eligible":
        raise HTTPException(status_code=400, detail=f"Employé non éligible (statut: {ec_dict['eligibility_status']})")

    # Vérifier pas de demande pending
    pending = db.execute(text("""
        SELECT id FROM promotion_requests
        WHERE employee_career_id = :ec_id AND status = 'pending'
    """), {"ec_id": data.employee_career_id}).fetchone()
    if pending:
        raise HTTPException(status_code=400, detail="Une demande est déjà en cours")

    result = db.execute(text("""
        INSERT INTO promotion_requests (tenant_id, employee_career_id, from_level_id, to_level_id, requested_by, comments)
        VALUES (:tid, :ec_id, :from_id, :to_id, :uid, :comments)
        RETURNING id
    """), {
        "tid": tenant_id, "ec_id": data.employee_career_id,
        "from_id": ec_dict["current_level_id"], "to_id": ec_dict["next_level_id"],
        "uid": user_id, "comments": data.comments
    })
    db.commit()

    return {"id": result.fetchone()[0], "message": f"Demande de promotion créée : {ec_dict['current_title']} → {ec_dict['next_title']}"}


@router.get("/promotions")
def list_promotion_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des demandes de promotion"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    where = ["pr.tenant_id = :tid"]
    params = {"tid": tenant_id}

    if status:
        where.append("pr.status = :status")
        params["status"] = status

    rows = db.execute(text(f"""
        SELECT pr.*,
            e.first_name, e.last_name, e.job_title, e.photo_url,
            fl.title AS from_level, tl.title AS to_level,
            cp.name AS path_name,
            u.email AS requested_by_email
        FROM promotion_requests pr
        JOIN employee_careers ec ON ec.id = pr.employee_career_id
        JOIN employees e ON e.id = ec.employee_id
        JOIN career_levels fl ON fl.id = pr.from_level_id
        JOIN career_levels tl ON tl.id = pr.to_level_id
        JOIN career_paths cp ON cp.id = ec.career_path_id
        LEFT JOIN users u ON u.id = pr.requested_by
        WHERE {' AND '.join(where)}
        ORDER BY pr.created_at DESC
    """), params).fetchall()

    return [dict(r._mapping) for r in rows]


@router.put("/promotions/{request_id}/decide")
def decide_promotion(
    request_id: int,
    data: PromotionDecision,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Approuver ou rejeter une demande de promotion"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)
    user_id = get_user_id(current_user)

    # Vérifier la demande
    req = db.execute(text("""
        SELECT pr.*, ec.employee_id, ec.career_path_id
        FROM promotion_requests pr
        JOIN employee_careers ec ON ec.id = pr.employee_career_id
        WHERE pr.id = :id AND pr.tenant_id = :tid AND pr.status = 'pending'
    """), {"id": request_id, "tid": tenant_id}).fetchone()

    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvée ou déjà traitée")

    r = dict(req._mapping)

    if data.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Statut invalide (approved/rejected)")

    # Mettre à jour la demande
    db.execute(text("""
        UPDATE promotion_requests SET
            status = :status, approved_by = :uid, committee_decision = :committee,
            comments = :comments, decision_date = NOW()
        WHERE id = :id
    """), {
        "status": data.status, "uid": user_id, "committee": data.committee_decision,
        "comments": data.comments, "id": request_id
    })

    # Si approuvé : effectuer la promotion
    if data.status == "approved":
        to_level_id = r["to_level_id"]

        # Trouver le prochain niveau après la promotion
        new_next = db.execute(text("""
            SELECT cl2.id FROM career_levels cl1
            JOIN career_levels cl2 ON cl2.career_path_id = cl1.career_path_id AND cl2.level_order = cl1.level_order + 1
            WHERE cl1.id = :lid
        """), {"lid": to_level_id}).fetchone()

        # Promouvoir
        db.execute(text("""
            UPDATE employee_careers SET
                current_level_id = :new_lid,
                next_level_id = :next_lid,
                level_start_date = CURRENT_DATE,
                eligibility_status = 'not_eligible',
                updated_at = NOW()
            WHERE id = :ec_id
        """), {
            "new_lid": to_level_id,
            "next_lid": new_next[0] if new_next else None,
            "ec_id": r["employee_career_id"]
        })

        # Supprimer anciennes progressions et créer les nouvelles
        db.execute(text(
            "DELETE FROM competency_progress WHERE employee_career_id = :ec_id"
        ), {"ec_id": r["employee_career_id"]})

        if new_next:
            comps = db.execute(text(
                "SELECT id FROM level_competencies WHERE career_level_id = :lid"
            ), {"lid": new_next[0]}).fetchall()
            for c in comps:
                db.execute(text("""
                    INSERT INTO competency_progress (employee_career_id, level_competency_id)
                    VALUES (:ec_id, :lc_id)
                """), {"ec_id": r["employee_career_id"], "lc_id": c[0]})

    db.commit()

    action = "approuvée (promotion effectuée)" if data.status == "approved" else "rejetée"
    return {"message": f"Demande {action}"}


@router.delete("/promotions/{request_id}")
def cancel_promotion_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Annuler une demande de promotion en attente"""
    require_rh_or_manager(current_user)
    tenant_id = get_tenant_id(current_user)

    req = db.execute(text("""
        SELECT id FROM promotion_requests
        WHERE id = :id AND tenant_id = :tid AND status = 'pending'
    """), {"id": request_id, "tid": tenant_id}).fetchone()

    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvée ou déjà traitée")

    db.execute(text("DELETE FROM promotion_requests WHERE id = :id"), {"id": request_id})
    db.commit()
    return {"message": "Demande annulée"}


# ============================================
# 5. DÉSASSIGNER / MODIFIER NIVEAU MANUELLEMENT
# ============================================

@router.delete("/employees/{employee_id}/career/{path_id}")
def unassign_career(
    employee_id: int,
    path_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Retirer un employé d'un parcours"""
    require_rh(current_user)

    db.execute(text("""
        DELETE FROM employee_careers WHERE employee_id = :eid AND career_path_id = :pid
    """), {"eid": employee_id, "pid": path_id})
    db.commit()

    return {"message": "Employé retiré du parcours"}
