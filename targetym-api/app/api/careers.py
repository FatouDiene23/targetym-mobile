# ============================================
# API: Talents & Carrière — Bloc 1
# Configuration des Parcours de Carrière (Admin RH)
# Fichier: app/api/careers.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_CAREERS

router = APIRouter(prefix="/api/careers", tags=["Talents & Carrière"], dependencies=[Depends(require_feature(FEATURE_CAREERS))])


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


def require_rh_or_dg(user):
    """RH, Admin, Directeur ou DG peuvent modifier les parcours"""
    role = get_user_role(user)
    if role not in ["rh", "admin", "directeur", "dg"]:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/Admin/DG")


# ============================================
# SCHEMAS
# ============================================

# --- CareerPath ---
class CareerPathCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CareerPathUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# --- CareerLevel ---
class CareerLevelCreate(BaseModel):
    title: str
    level_order: int
    description: Optional[str] = None
    min_tenure_months: int = 0
    is_entry_level: bool = False

class CareerLevelUpdate(BaseModel):
    title: Optional[str] = None
    level_order: Optional[int] = None
    description: Optional[str] = None
    min_tenure_months: Optional[int] = None
    is_entry_level: Optional[bool] = None

# --- LevelCompetency ---
class LevelCompetencyCreate(BaseModel):
    competency_name: str
    description: Optional[str] = None
    performance_threshold: float = 95.0
    attitude_threshold: float = 95.0
    post_training_threshold: float = 50.0
    is_mandatory: bool = True
    skill_id: Optional[int] = None   # lien vers la compétence Formation & Développement

class LevelCompetencyUpdate(BaseModel):
    competency_name: Optional[str] = None
    description: Optional[str] = None
    performance_threshold: Optional[float] = None
    attitude_threshold: Optional[float] = None
    post_training_threshold: Optional[float] = None
    is_mandatory: Optional[bool] = None

# --- PromotionFactor ---
class PromotionFactorCreate(BaseModel):
    factor_name: str
    factor_type: str = "auto"           # auto | committee | n_plus_1
    threshold_value: Optional[str] = None
    is_blocking: bool = True

class PromotionFactorUpdate(BaseModel):
    factor_name: Optional[str] = None
    factor_type: Optional[str] = None
    threshold_value: Optional[str] = None
    is_blocking: Optional[bool] = None

# --- Trainings & Attitudes (liens) ---
class LinkTrainingsRequest(BaseModel):
    course_ids: List[int]

class LinkAttitudesRequest(BaseModel):
    attitude_ids: List[int]
    threshold: float = 95.0


# ============================================
# 1. PARCOURS DE CARRIÈRE (CareerPath)
# ============================================

@router.get("/paths")
def list_career_paths(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des parcours de carrière"""
    tenant_id = get_tenant_id(current_user)
    
    where = "WHERE cp.tenant_id = :tenant_id"
    params = {"tenant_id": tenant_id}
    
    if is_active is not None:
        where += " AND cp.is_active = :is_active"
        params["is_active"] = is_active
    
    try:
        rows = db.execute(text(f"""
            SELECT cp.*,
                (SELECT COUNT(*) FROM career_levels cl WHERE cl.career_path_id = cp.id) AS level_count,
                (SELECT COUNT(*) FROM employee_careers ec WHERE ec.career_path_id = cp.id) AS employee_count
            FROM career_paths cp
            {where}
            ORDER BY cp.name
        """), params).fetchall()
    except Exception:
        db.rollback()
        # Fallback: liste sans sous-requêtes si les tables n'existent pas encore
        rows = db.execute(text(f"""
            SELECT cp.*, 0 AS level_count, 0 AS employee_count
            FROM career_paths cp
            {where}
            ORDER BY cp.name
        """), params).fetchall()

    return [dict(r._mapping) for r in rows]


@router.post("/paths")
def create_career_path(
    data: CareerPathCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Créer un parcours de carrière"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)
    user_id = get_user_id(current_user)
    
    result = db.execute(text("""
        INSERT INTO career_paths (tenant_id, name, description, created_by)
        VALUES (:tenant_id, :name, :description, :created_by)
        RETURNING id
    """), {
        "tenant_id": tenant_id,
        "name": data.name,
        "description": data.description,
        "created_by": user_id
    })
    db.commit()
    path_id = result.fetchone()[0]
    
    return {"id": path_id, "message": f"Parcours '{data.name}' créé"}


@router.get("/paths/{path_id}")
def get_career_path(
    path_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Détail d'un parcours avec ses niveaux, compétences, facteurs"""
    tenant_id = get_tenant_id(current_user)
    
    # Parcours
    path = db.execute(text("""
        SELECT cp.*, u.email AS created_by_email
        FROM career_paths cp
        LEFT JOIN users u ON u.id = cp.created_by
        WHERE cp.id = :id AND cp.tenant_id = :tenant_id
    """), {"id": path_id, "tenant_id": tenant_id}).fetchone()
    
    if not path:
        raise HTTPException(status_code=404, detail="Parcours non trouvé")
    
    result = dict(path._mapping)
    
    # Niveaux
    levels = db.execute(text("""
        SELECT cl.* FROM career_levels cl
        WHERE cl.career_path_id = :path_id
        ORDER BY cl.level_order
    """), {"path_id": path_id}).fetchall()
    
    levels_data = []
    for level in levels:
        level_dict = dict(level._mapping)

        # Compétences du niveau
        try:
            competencies = db.execute(text("""
                SELECT lc.*,
                    COALESCE(
                        (SELECT json_agg(json_build_object('id', c.id, 'title', c.title, 'emoji', c.image_emoji))
                         FROM level_competency_trainings lct
                         JOIN courses c ON c.id = lct.course_id
                         WHERE lct.level_competency_id = lc.id), '[]'::json
                    ) AS trainings
                FROM level_competencies lc
                WHERE lc.career_level_id = :level_id
                ORDER BY lc.id
            """), {"level_id": level_dict["id"]}).fetchall()
            level_dict["competencies"] = [dict(c._mapping) for c in competencies]
        except Exception:
            db.rollback()
            level_dict["competencies"] = []

        # Attitudes requises
        try:
            attitudes = db.execute(text("""
                SELECT lra.*, a.name AS attitude_name, a.code AS attitude_code, a.icon AS attitude_icon
                FROM level_required_attitudes lra
                JOIN attitudes a ON a.id = lra.attitude_id
                WHERE lra.career_level_id = :level_id
            """), {"level_id": level_dict["id"]}).fetchall()
            level_dict["required_attitudes"] = [dict(a._mapping) for a in attitudes]
        except Exception:
            db.rollback()
            level_dict["required_attitudes"] = []

        # Facteurs de promotion
        try:
            factors = db.execute(text("""
                SELECT * FROM promotion_factors
                WHERE career_level_id = :level_id
                ORDER BY id
            """), {"level_id": level_dict["id"]}).fetchall()
            level_dict["promotion_factors"] = [dict(f._mapping) for f in factors]
        except Exception:
            db.rollback()
            level_dict["promotion_factors"] = []

        # Nombre d'employés au niveau
        try:
            emp_count = db.execute(text("""
                SELECT COUNT(*) FROM employee_careers
                WHERE current_level_id = :level_id
            """), {"level_id": level_dict["id"]}).scalar()
            level_dict["employee_count"] = emp_count or 0
        except Exception:
            db.rollback()
            level_dict["employee_count"] = 0

        levels_data.append(level_dict)
    
    result["levels"] = levels_data
    
    # Nombre d'employés assignés
    try:
        count = db.execute(text("""
            SELECT COUNT(*) FROM employee_careers WHERE career_path_id = :path_id
        """), {"path_id": path_id}).scalar()
        result["employee_count"] = count
    except Exception:
        db.rollback()
        result["employee_count"] = 0

    return result


@router.put("/paths/{path_id}")
def update_career_path(
    path_id: int,
    data: CareerPathUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Modifier un parcours"""
    require_rh_or_dg(current_user)
    tenant_id = get_tenant_id(current_user)
    
    # Vérifier existence
    exists = db.execute(text(
        "SELECT id FROM career_paths WHERE id = :id AND tenant_id = :tid"
    ), {"id": path_id, "tid": tenant_id}).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Parcours non trouvé")
    
    updates = []
    params = {"id": path_id, "tid": tenant_id}
    
    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name
    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description
    if data.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = data.is_active
    
    if updates:
        updates.append("updated_at = NOW()")
        db.execute(text(f"""
            UPDATE career_paths SET {', '.join(updates)}
            WHERE id = :id AND tenant_id = :tid
        """), params)
        db.commit()
    
    return {"message": "Parcours mis à jour"}


@router.delete("/paths/{path_id}")
def delete_career_path(
    path_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Supprimer un parcours (seulement si aucun employé assigné)"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)
    
    count = db.execute(text("""
        SELECT COUNT(*) FROM employee_careers WHERE career_path_id = :id
    """), {"id": path_id}).scalar()
    
    if count > 0:
        raise HTTPException(status_code=400, detail=f"{count} employé(s) assigné(s) à ce parcours. Désactivez-le plutôt.")
    
    db.execute(text(
        "DELETE FROM career_paths WHERE id = :id AND tenant_id = :tid"
    ), {"id": path_id, "tid": tenant_id})
    db.commit()
    
    return {"message": "Parcours supprimé"}


@router.post("/paths/{path_id}/duplicate")
def duplicate_career_path(
    path_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Dupliquer un parcours complet (niveaux + compétences + facteurs)"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)
    user_id = get_user_id(current_user)
    
    # Source
    source = db.execute(text(
        "SELECT * FROM career_paths WHERE id = :id AND tenant_id = :tid"
    ), {"id": path_id, "tid": tenant_id}).fetchone()
    if not source:
        raise HTTPException(status_code=404, detail="Parcours non trouvé")
    
    src = dict(source._mapping)
    
    # Créer copie
    new_path = db.execute(text("""
        INSERT INTO career_paths (tenant_id, name, description, created_by)
        VALUES (:tid, :name, :desc, :uid)
        RETURNING id
    """), {
        "tid": tenant_id,
        "name": f"{src['name']} (copie)",
        "desc": src["description"],
        "uid": user_id
    })
    new_path_id = new_path.fetchone()[0]
    
    # Copier niveaux
    levels = db.execute(text(
        "SELECT * FROM career_levels WHERE career_path_id = :pid ORDER BY level_order"
    ), {"pid": path_id}).fetchall()
    
    for level in levels:
        lv = dict(level._mapping)
        new_level = db.execute(text("""
            INSERT INTO career_levels (career_path_id, level_order, title, description, min_tenure_months, is_entry_level)
            VALUES (:pid, :ord, :title, :desc, :tenure, :entry)
            RETURNING id
        """), {
            "pid": new_path_id, "ord": lv["level_order"], "title": lv["title"],
            "desc": lv["description"], "tenure": lv["min_tenure_months"], "entry": lv["is_entry_level"]
        })
        new_level_id = new_level.fetchone()[0]
        
        # Copier compétences
        comps = db.execute(text(
            "SELECT * FROM level_competencies WHERE career_level_id = :lid"
        ), {"lid": lv["id"]}).fetchall()
        
        for comp in comps:
            cv = dict(comp._mapping)
            new_comp = db.execute(text("""
                INSERT INTO level_competencies (career_level_id, competency_name, description, performance_threshold, attitude_threshold, post_training_threshold, is_mandatory)
                VALUES (:lid, :name, :desc, :perf, :att, :ptt, :mand)
                RETURNING id
            """), {
                "lid": new_level_id, "name": cv["competency_name"], "desc": cv["description"],
                "perf": cv["performance_threshold"], "att": cv["attitude_threshold"],
                "ptt": cv.get("post_training_threshold", 50), "mand": cv["is_mandatory"]
            })
            new_comp_id = new_comp.fetchone()[0]
            
            # Copier trainings liés
            db.execute(text("""
                INSERT INTO level_competency_trainings (level_competency_id, course_id, is_required)
                SELECT :new_id, course_id, is_required
                FROM level_competency_trainings WHERE level_competency_id = :old_id
            """), {"new_id": new_comp_id, "old_id": cv["id"]})
        
        # Copier attitudes requises
        db.execute(text("""
            INSERT INTO level_required_attitudes (career_level_id, attitude_id, threshold)
            SELECT :new_id, attitude_id, threshold
            FROM level_required_attitudes WHERE career_level_id = :old_id
        """), {"new_id": new_level_id, "old_id": lv["id"]})
        
        # Copier facteurs de promotion
        db.execute(text("""
            INSERT INTO promotion_factors (career_level_id, factor_name, factor_type, threshold_value, is_blocking)
            SELECT :new_id, factor_name, factor_type, threshold_value, is_blocking
            FROM promotion_factors WHERE career_level_id = :old_id
        """), {"new_id": new_level_id, "old_id": lv["id"]})
    
    db.commit()
    
    return {"id": new_path_id, "message": f"Parcours dupliqué : '{src['name']} (copie)'"}


# ============================================
# 2. NIVEAUX DE CARRIÈRE (CareerLevel)
# ============================================

@router.get("/paths/{path_id}/levels")
def list_levels(
    path_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des niveaux d'un parcours"""
    rows = db.execute(text("""
        SELECT cl.*,
            (SELECT COUNT(*) FROM level_competencies lc WHERE lc.career_level_id = cl.id) AS competency_count,
            (SELECT COUNT(*) FROM promotion_factors pf WHERE pf.career_level_id = cl.id) AS factor_count,
            (SELECT COUNT(*) FROM employee_careers ec WHERE ec.current_level_id = cl.id) AS employee_count
        FROM career_levels cl
        WHERE cl.career_path_id = :path_id
        ORDER BY cl.level_order
    """), {"path_id": path_id}).fetchall()
    
    return [dict(r._mapping) for r in rows]


@router.post("/paths/{path_id}/levels")
def create_level(
    path_id: int,
    data: CareerLevelCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Ajouter un niveau à un parcours"""
    require_rh(current_user)
    tenant_id = get_tenant_id(current_user)
    
    # Vérifier parcours
    exists = db.execute(text(
        "SELECT id FROM career_paths WHERE id = :id AND tenant_id = :tid"
    ), {"id": path_id, "tid": tenant_id}).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Parcours non trouvé")
    
    # Vérifier doublon level_order
    dup = db.execute(text(
        "SELECT id FROM career_levels WHERE career_path_id = :pid AND level_order = :ord"
    ), {"pid": path_id, "ord": data.level_order}).fetchone()
    if dup:
        raise HTTPException(status_code=400, detail=f"Un niveau avec l'ordre {data.level_order} existe déjà")
    
    result = db.execute(text("""
        INSERT INTO career_levels (career_path_id, level_order, title, description, min_tenure_months, is_entry_level)
        VALUES (:pid, :ord, :title, :desc, :tenure, :entry)
        RETURNING id
    """), {
        "pid": path_id, "ord": data.level_order, "title": data.title,
        "desc": data.description, "tenure": data.min_tenure_months, "entry": data.is_entry_level
    })
    db.commit()
    level_id = result.fetchone()[0]
    
    return {"id": level_id, "message": f"Niveau '{data.title}' ajouté"}


@router.put("/levels/{level_id}")
def update_level(
    level_id: int,
    data: CareerLevelUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Modifier un niveau"""
    require_rh(current_user)
    
    updates = []
    params = {"id": level_id}
    
    if data.title is not None:
        updates.append("title = :title"); params["title"] = data.title
    if data.level_order is not None:
        updates.append("level_order = :ord"); params["ord"] = data.level_order
    if data.description is not None:
        updates.append("description = :desc"); params["desc"] = data.description
    if data.min_tenure_months is not None:
        updates.append("min_tenure_months = :tenure"); params["tenure"] = data.min_tenure_months
    if data.is_entry_level is not None:
        updates.append("is_entry_level = :entry"); params["entry"] = data.is_entry_level
    
    if updates:
        db.execute(text(f"UPDATE career_levels SET {', '.join(updates)} WHERE id = :id"), params)
        db.commit()
    
    return {"message": "Niveau mis à jour"}


@router.delete("/levels/{level_id}")
def delete_level(
    level_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Supprimer un niveau (si aucun employé à ce niveau)"""
    require_rh(current_user)
    
    count = db.execute(text(
        "SELECT COUNT(*) FROM employee_careers WHERE current_level_id = :id"
    ), {"id": level_id}).scalar()
    if count > 0:
        raise HTTPException(status_code=400, detail=f"{count} employé(s) à ce niveau")
    
    db.execute(text("DELETE FROM career_levels WHERE id = :id"), {"id": level_id})
    db.commit()
    
    return {"message": "Niveau supprimé"}


@router.put("/paths/{path_id}/levels/reorder")
def reorder_levels(
    path_id: int,
    level_orders: List[dict],  # [{"id": 1, "level_order": 1}, {"id": 2, "level_order": 2}]
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Réordonner les niveaux (drag & drop)"""
    require_rh(current_user)
    
    # Passer par un order temporaire négatif pour éviter les conflits UNIQUE
    for i, item in enumerate(level_orders):
        db.execute(text(
            "UPDATE career_levels SET level_order = :ord WHERE id = :id AND career_path_id = :pid"
        ), {"ord": -(i + 1), "id": item["id"], "pid": path_id})
    
    for item in level_orders:
        db.execute(text(
            "UPDATE career_levels SET level_order = :ord WHERE id = :id AND career_path_id = :pid"
        ), {"ord": item["level_order"], "id": item["id"], "pid": path_id})
    
    db.commit()
    return {"message": "Niveaux réordonnés"}


# ============================================
# 3. COMPÉTENCES PAR NIVEAU (LevelCompetency)
# ============================================

@router.get("/levels/{level_id}/competencies")
def list_competencies(
    level_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des compétences d'un niveau"""
    rows = db.execute(text("""
        SELECT lc.*,
            COALESCE(
                (SELECT json_agg(json_build_object('id', c.id, 'title', c.title, 'emoji', c.image_emoji))
                 FROM level_competency_trainings lct
                 JOIN courses c ON c.id = lct.course_id
                 WHERE lct.level_competency_id = lc.id), '[]'
            ) AS trainings
        FROM level_competencies lc
        WHERE lc.career_level_id = :level_id
        ORDER BY lc.id
    """), {"level_id": level_id}).fetchall()
    
    return [dict(r._mapping) for r in rows]


@router.post("/levels/{level_id}/competencies")
def create_competency(
    level_id: int,
    data: LevelCompetencyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Ajouter une compétence à un niveau"""
    require_rh(current_user)
    
    result = db.execute(text("""
        INSERT INTO level_competencies (career_level_id, competency_name, description, performance_threshold, attitude_threshold, post_training_threshold, is_mandatory, skill_id)
        VALUES (:lid, :name, :desc, :perf, :att, :ptt, :mand, :skill_id)
        RETURNING id
    """), {
        "lid": level_id, "name": data.competency_name, "desc": data.description,
        "perf": data.performance_threshold, "att": data.attitude_threshold,
        "ptt": data.post_training_threshold, "mand": data.is_mandatory,
        "skill_id": data.skill_id
    })
    db.commit()
    comp_id = result.fetchone()[0]
    
    return {"id": comp_id, "message": f"Compétence '{data.competency_name}' ajoutée"}


@router.put("/competencies/{comp_id}")
def update_competency(
    comp_id: int,
    data: LevelCompetencyUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Modifier une compétence"""
    require_rh(current_user)
    
    updates = []
    params = {"id": comp_id}
    
    if data.competency_name is not None:
        updates.append("competency_name = :name"); params["name"] = data.competency_name
    if data.description is not None:
        updates.append("description = :desc"); params["desc"] = data.description
    if data.performance_threshold is not None:
        updates.append("performance_threshold = :perf"); params["perf"] = data.performance_threshold
    if data.attitude_threshold is not None:
        updates.append("attitude_threshold = :att"); params["att"] = data.attitude_threshold
    if data.post_training_threshold is not None:
        updates.append("post_training_threshold = :ptt"); params["ptt"] = data.post_training_threshold
    if data.is_mandatory is not None:
        updates.append("is_mandatory = :mand"); params["mand"] = data.is_mandatory
    
    if updates:
        db.execute(text(f"UPDATE level_competencies SET {', '.join(updates)} WHERE id = :id"), params)
        db.commit()
    
    return {"message": "Compétence mise à jour"}


@router.delete("/competencies/{comp_id}")
def delete_competency(
    comp_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Supprimer une compétence"""
    require_rh(current_user)
    db.execute(text("DELETE FROM level_competencies WHERE id = :id"), {"id": comp_id})
    db.commit()
    return {"message": "Compétence supprimée"}


# ============================================
# 4. FORMATIONS LIÉES À UNE COMPÉTENCE
# ============================================

@router.post("/competencies/{comp_id}/trainings")
def link_trainings(
    comp_id: int,
    data: LinkTrainingsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Lier des formations à une compétence"""
    require_rh(current_user)
    
    # Supprimer anciens liens
    db.execute(text("DELETE FROM level_competency_trainings WHERE level_competency_id = :id"), {"id": comp_id})
    
    # Insérer nouveaux
    for course_id in data.course_ids:
        db.execute(text("""
            INSERT INTO level_competency_trainings (level_competency_id, course_id) 
            VALUES (:cid, :tid)
            ON CONFLICT DO NOTHING
        """), {"cid": comp_id, "tid": course_id})
    
    db.commit()
    return {"message": f"{len(data.course_ids)} formation(s) liée(s)"}


# ============================================
# 5. ATTITUDES REQUISES PAR NIVEAU
# ============================================

@router.get("/levels/{level_id}/attitudes")
def list_required_attitudes(
    level_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des attitudes requises pour un niveau"""
    rows = db.execute(text("""
        SELECT lra.*, a.name AS attitude_name, a.code, a.icon, a.category
        FROM level_required_attitudes lra
        JOIN attitudes a ON a.id = lra.attitude_id
        WHERE lra.career_level_id = :level_id
    """), {"level_id": level_id}).fetchall()
    
    return [dict(r._mapping) for r in rows]


@router.post("/levels/{level_id}/attitudes")
def link_attitudes(
    level_id: int,
    data: LinkAttitudesRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Lier des attitudes requises à un niveau"""
    require_rh(current_user)
    
    # Supprimer anciens liens
    db.execute(text("DELETE FROM level_required_attitudes WHERE career_level_id = :id"), {"id": level_id})
    
    # Insérer nouveaux
    for att_id in data.attitude_ids:
        db.execute(text("""
            INSERT INTO level_required_attitudes (career_level_id, attitude_id, threshold)
            VALUES (:lid, :aid, :thr)
            ON CONFLICT DO NOTHING
        """), {"lid": level_id, "aid": att_id, "thr": data.threshold})
    
    db.commit()
    return {"message": f"{len(data.attitude_ids)} attitude(s) configurée(s)"}


# ============================================
# 6. FACTEURS DE PROMOTION
# ============================================

@router.get("/levels/{level_id}/factors")
def list_promotion_factors(
    level_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des facteurs de promotion d'un niveau"""
    rows = db.execute(text("""
        SELECT * FROM promotion_factors WHERE career_level_id = :level_id ORDER BY id
    """), {"level_id": level_id}).fetchall()
    
    return [dict(r._mapping) for r in rows]


@router.post("/levels/{level_id}/factors")
def create_promotion_factor(
    level_id: int,
    data: PromotionFactorCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Ajouter un facteur de promotion"""
    require_rh(current_user)
    
    result = db.execute(text("""
        INSERT INTO promotion_factors (career_level_id, factor_name, factor_type, threshold_value, is_blocking)
        VALUES (:lid, :name, :type, :val, :blocking)
        RETURNING id
    """), {
        "lid": level_id, "name": data.factor_name, "type": data.factor_type,
        "val": data.threshold_value, "blocking": data.is_blocking
    })
    db.commit()
    
    return {"id": result.fetchone()[0], "message": f"Facteur '{data.factor_name}' ajouté"}


@router.put("/factors/{factor_id}")
def update_promotion_factor(
    factor_id: int,
    data: PromotionFactorUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Modifier un facteur de promotion"""
    require_rh(current_user)

    updates = []
    params = {"id": factor_id}

    if data.factor_name is not None:
        updates.append("factor_name = :name"); params["name"] = data.factor_name
    if data.factor_type is not None:
        updates.append("factor_type = :type"); params["type"] = data.factor_type
    if data.threshold_value is not None:
        updates.append("threshold_value = :val"); params["val"] = data.threshold_value
    if data.is_blocking is not None:
        updates.append("is_blocking = :blocking"); params["blocking"] = data.is_blocking

    if updates:
        db.execute(text(f"UPDATE promotion_factors SET {', '.join(updates)} WHERE id = :id"), params)
        db.commit()

    return {"message": "Facteur mis à jour"}


@router.delete("/factors/{factor_id}")
def delete_promotion_factor(
    factor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Supprimer un facteur de promotion"""
    require_rh(current_user)
    db.execute(text("DELETE FROM promotion_factors WHERE id = :id"), {"id": factor_id})
    db.commit()
    return {"message": "Facteur supprimé"}


# ============================================
# 7. LISTE ATTITUDES DISPONIBLES (pour sélection)
# ============================================

@router.get("/attitudes")
def list_available_attitudes(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Liste des attitudes disponibles pour configuration"""
    tenant_id = get_tenant_id(current_user)
    
    rows = db.execute(text("""
        SELECT id, code, name, description, category, icon, is_active
        FROM attitudes
        WHERE tenant_id = :tid AND is_active = true
        ORDER BY display_order, name
    """), {"tid": tenant_id}).fetchall()
    
    return [dict(r._mapping) for r in rows]


# ============================================
# 8. STATS GLOBALES CARRIÈRE
# ============================================

@router.get("/stats")
def career_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Statistiques globales du module carrière"""
    tenant_id = get_tenant_id(current_user)
    
    stats = {}
    
    stats["total_paths"] = db.execute(text(
        "SELECT COUNT(*) FROM career_paths WHERE tenant_id = :tid AND is_active = true"
    ), {"tid": tenant_id}).scalar() or 0
    
    stats["total_employees_assigned"] = db.execute(text(
        "SELECT COUNT(DISTINCT employee_id) FROM employee_careers WHERE tenant_id = :tid"
    ), {"tid": tenant_id}).scalar() or 0
    
    stats["total_eligible"] = db.execute(text(
        "SELECT COUNT(*) FROM employee_careers WHERE tenant_id = :tid AND eligibility_status = 'eligible'"
    ), {"tid": tenant_id}).scalar() or 0
    
    stats["pending_promotions"] = db.execute(text(
        "SELECT COUNT(*) FROM promotion_requests WHERE tenant_id = :tid AND status = 'pending'"
    ), {"tid": tenant_id}).scalar() or 0
    
    stats["total_succession_plans"] = db.execute(text(
        "SELECT COUNT(*) FROM succession_plans WHERE tenant_id = :tid"
    ), {"tid": tenant_id}).scalar() or 0
    
    return stats
