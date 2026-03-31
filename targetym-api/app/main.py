from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import Base, engine
from app.api import auth, employees, departments, leaves, okr, performance, recruitment
from app.api.tasks import router as tasks_router
from app.api.performance_score import router as performance_score_router  
from app.api.invitations import router as invitations_router
from app.api.learning import router as learning_router
from app.api.post_training_eval_api import router as post_training_eval_router
from app.api.certificate import router as certificate_router
from app.api.certificate_settings import router as certificate_settings_router
from app.api.missions import router as missions_router
from app.api.analytics import router as analytics_router
from app.api.onboarding import router as onboarding_router
from app.api.notifications import router as notifications_router
from app.api.documents import router as documents_router
from app.api.attitudes import router as attitudes_router
from app.api.careers import router as careers_router
from app.api.careers_employee import router as careers_employee_router
from app.api.careers_ninebox import router as careers_ninebox_router
from app.api.app_tour import router as app_tour_router
from app.api.daily_checklist import router as daily_checklist_router
from app.api.ai_chat import router as ai_chat_router
from app.api.ai_scoring import router as ai_scoring_router
from app.api.help_center import router as help_center_router
from app.api.help_center_admin import router as help_center_admin_router
from app.api.help_center_seed import router as help_center_seed_router
from app.api.platform_admin import router as platform_admin_router
from app.api.departures import router as departures_router
from app.api.integrations import router as integrations_router
from app.api.intowork_integration import router as intowork_integration_router
from app.api.currency import router as currency_router
from app.api.groups import router as groups_router
from app.api.sanctions import router as sanctions_router, legacy_router as sanctions_legacy_router
from app.api.benefits import router as benefits_router
from app.api.sos import router as sos_router
from app.api.blog import router as blog_router
from app.api.resources import router as resources_router
from app.api.media_upload import router as media_upload_router
from app.api.public_content import router as public_content_router
from app.api.absences import router as absences_router
from app.api.billing import router as billing_router
from app.api.signatures import router as signatures_router
from app.api.training_providers import router as training_providers_router
from app.api.training_plans import router as training_plans_router
from app.api.contentieux import router as contentieux_router
from app.api.compensation import router as compensation_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup et shutdown events"""
    # Startup: Créer les tables SQLAlchemy
    import traceback
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created")
    except Exception as e:
        print(f"⚠️  create_all warning (alembic handles schema): {e}")
        traceback.print_exc()

    # ── Migrations incrémentales (idempotentes) ──────────────────────────
    from app.core.database import SessionLocal as _SL
    _db_m = _SL()
    try:
        _db_m.execute(__import__('sqlalchemy').text(
            "ALTER TABLE candidate_applications "
            "ADD COLUMN IF NOT EXISTS intowork_application_id INTEGER"
        ))
        _db_m.commit()
        print("✅ Migration: intowork_application_id column ensured")
    except Exception as _e:
        _db_m.rollback()
        print(f"⚠️  Migration intowork_application_id: {_e}")
    finally:
        _db_m.close()
    # ─────────────────────────────────────────────────────────────────────

    # ── Migration: groupe / filiales (006 + 007) ─────────────────────────
    try:
        from sqlalchemy import text as _text
        from app.core.database import engine as _engine
        with _engine.execution_options(isolation_level="AUTOCOMMIT").connect() as _conn:
            # 1. Enum grouptype
            _conn.execute(_text("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='grouptype') THEN CREATE TYPE grouptype AS ENUM ('standalone','group','subsidiary'); END IF; END $$"))
            # 2. Colonnes tenants
            _conn.execute(_text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) NOT NULL DEFAULT 'standalone'"))
            _conn.execute(_text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE"))
            _conn.execute(_text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL"))
            # 3. Enum groupconversionstatus
            _conn.execute(_text("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='groupconversionstatus') THEN CREATE TYPE groupconversionstatus AS ENUM ('pending','approved','rejected'); END IF; END $$"))
            # 4. Table group_conversion_requests
            _conn.execute(_text("""CREATE TABLE IF NOT EXISTS group_conversion_requests (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                requested_by_email VARCHAR(255),
                reason TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                reviewed_by_email VARCHAR(255),
                review_note TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                reviewed_at TIMESTAMP WITH TIME ZONE
            )"""))
            _conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_gcr_tenant_id ON group_conversion_requests(tenant_id)"))
            # Nouvelles colonnes commerciales (ajout sans casser l'existant)
            for _col, _def in [
                ("nb_subsidiaries", "INTEGER"),
                ("contact_phone", "VARCHAR(50)"),
                ("quote_amount", "INTEGER"),
                ("payment_status", "VARCHAR(20) DEFAULT 'unpaid'"),
                ("payment_ref", "VARCHAR(255)"),
            ]:
                try:
                    _conn.execute(_text(f"ALTER TABLE group_conversion_requests ADD COLUMN IF NOT EXISTS {_col} {_def}"))
                except Exception:
                    pass
        print("✅ Migration: group/subsidiary tables and columns ensured")
    except Exception as _e:
        print(f"⚠️  Migration group tables (non-fatal): {_e}")
    # ─────────────────────────────────────────────────────────────────────
    
    # Créer le dossier pour les uploads du centre d'aide
    from pathlib import Path
    upload_dir = Path("/app/public/help-uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    print("✅ Help center upload directory created")
    
    # Créer le SUPER_ADMIN tech (équipe Targetym) si n'existe pas
    from app.core.database import SessionLocal
    from app.models.user import User, UserRole
    from app.core.security import hash_password
    
    db_tech = SessionLocal()
    try:
        tech_admin = db_tech.query(User).filter(
            User.email == settings.TECH_SUPER_ADMIN_EMAIL
        ).first()
        
        if not tech_admin:
            tech_admin = User(
                email=settings.TECH_SUPER_ADMIN_EMAIL,
                hashed_password=hash_password(settings.TECH_SUPER_ADMIN_PASSWORD),
                first_name="Tech",
                last_name="Team",
                role=UserRole.SUPER_ADMIN,
                tenant_id=None,  # Pas de tenant = accès cross-tenant
                is_active=True,
                is_verified=True
            )
            db_tech.add(tech_admin)
            db_tech.commit()
            print(f"✅ Tech SUPER_ADMIN created: {settings.TECH_SUPER_ADMIN_EMAIL}")
        else:
            print(f"✅ Tech SUPER_ADMIN already exists: {settings.TECH_SUPER_ADMIN_EMAIL}")
    except Exception as e:
        print(f"⚠️  Tech SUPER_ADMIN creation error: {e}")
        db_tech.rollback()
    finally:
        db_tech.close()

    # Créer les tables career (raw SQL, pas de modèle SQLAlchemy)
    from app.core.database import SessionLocal
    from sqlalchemy import text as sql_text
    db = SessionLocal()
    try:
        db.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS career_paths (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS career_levels (
                id SERIAL PRIMARY KEY,
                career_path_id INTEGER NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
                level_order INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                min_tenure_months INTEGER DEFAULT 0,
                is_entry_level BOOLEAN DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS level_competencies (
                id SERIAL PRIMARY KEY,
                career_level_id INTEGER NOT NULL REFERENCES career_levels(id) ON DELETE CASCADE,
                competency_name VARCHAR(200) NOT NULL,
                description TEXT,
                performance_threshold NUMERIC(5,2) DEFAULT 75,
                attitude_threshold NUMERIC(5,2) DEFAULT 75,
                post_training_threshold NUMERIC(5,2) DEFAULT 50,
                is_mandatory BOOLEAN DEFAULT TRUE
            );

            ALTER TABLE level_competencies
                ADD COLUMN IF NOT EXISTS post_training_threshold NUMERIC(5,2) DEFAULT 50;

            CREATE TABLE IF NOT EXISTS level_competency_trainings (
                id SERIAL PRIMARY KEY,
                level_competency_id INTEGER NOT NULL REFERENCES level_competencies(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL,
                UNIQUE(level_competency_id, course_id)
            );

            CREATE TABLE IF NOT EXISTS level_required_attitudes (
                id SERIAL PRIMARY KEY,
                career_level_id INTEGER NOT NULL REFERENCES career_levels(id) ON DELETE CASCADE,
                attitude_id INTEGER NOT NULL,
                threshold NUMERIC(5,2) DEFAULT 95,
                UNIQUE(career_level_id, attitude_id)
            );

            CREATE TABLE IF NOT EXISTS promotion_factors (
                id SERIAL PRIMARY KEY,
                career_level_id INTEGER NOT NULL REFERENCES career_levels(id) ON DELETE CASCADE,
                factor_name VARCHAR(200) NOT NULL,
                factor_type VARCHAR(50) DEFAULT 'auto',
                threshold_value TEXT,
                is_blocking BOOLEAN DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS employee_careers (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                career_path_id INTEGER NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
                current_level_id INTEGER NOT NULL REFERENCES career_levels(id),
                next_level_id INTEGER REFERENCES career_levels(id),
                level_start_date DATE DEFAULT CURRENT_DATE,
                eligibility_status VARCHAR(50) DEFAULT 'not_eligible',
                estimated_promotion_date DATE,
                UNIQUE(employee_id, career_path_id)
            );

            CREATE TABLE IF NOT EXISTS competency_progress (
                id SERIAL PRIMARY KEY,
                employee_career_id INTEGER NOT NULL REFERENCES employee_careers(id) ON DELETE CASCADE,
                level_competency_id INTEGER NOT NULL REFERENCES level_competencies(id) ON DELETE CASCADE,
                training_completed BOOLEAN DEFAULT FALSE,
                post_training_score NUMERIC(5,2),
                theoretical_status VARCHAR(50) DEFAULT 'pending',
                performance_score NUMERIC(5,2),
                attitude_score NUMERIC(5,2),
                effective_status VARCHAR(50) DEFAULT 'pending',
                UNIQUE(employee_career_id, level_competency_id)
            );

            CREATE TABLE IF NOT EXISTS promotion_requests (
                id SERIAL PRIMARY KEY,
                employee_career_id INTEGER NOT NULL REFERENCES employee_careers(id) ON DELETE CASCADE,
                from_level_id INTEGER NOT NULL REFERENCES career_levels(id),
                to_level_id INTEGER NOT NULL REFERENCES career_levels(id),
                status VARCHAR(50) DEFAULT 'pending',
                requested_by INTEGER,
                approved_by INTEGER,
                committee_decision TEXT,
                decision_date DATE,
                comments TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS nine_box_placements (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                period VARCHAR(20) NOT NULL,
                performance_score NUMERIC(3,1) NOT NULL,
                potential_score NUMERIC(3,1) NOT NULL,
                quadrant INTEGER NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(employee_id, period)
            );

            CREATE TABLE IF NOT EXISTS succession_plans (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                position_title VARCHAR(200) NOT NULL,
                department VARCHAR(100),
                current_holder_id INTEGER,
                criticality VARCHAR(50) DEFAULT 'medium',
                vacancy_risk VARCHAR(50) DEFAULT 'medium',
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS succession_candidates (
                id SERIAL PRIMARY KEY,
                succession_plan_id INTEGER NOT NULL REFERENCES succession_plans(id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL,
                readiness VARCHAR(50) DEFAULT '3+ years',
                preparation_score NUMERIC(5,2) DEFAULT 0,
                rank_order INTEGER DEFAULT 1,
                development_notes TEXT,
                UNIQUE(succession_plan_id, employee_id)
            );
        """))
        db.commit()
        print("✅ Career tables ready")
    except Exception as e:
        print(f"⚠️  Career tables init warning: {e}")
        db.rollback()
    finally:
        db.close()

    # Créer les tables Départs (offboarding)
    db_dep = SessionLocal()
    try:
        db_dep.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS departures (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                departure_type VARCHAR(50) NOT NULL,
                reason VARCHAR(500),
                detailed_reason TEXT,
                legal_reason VARCHAR(500),
                notification_date DATE NOT NULL,
                requested_departure_date DATE NOT NULL,
                notice_period_days INTEGER DEFAULT 0,
                notice_end_date DATE,
                effective_date DATE,
                last_working_day DATE,
                status VARCHAR(30) DEFAULT 'draft',
                manager_validated_by INTEGER,
                manager_validated_at TIMESTAMP WITH TIME ZONE,
                manager_comment TEXT,
                rh_validated_by INTEGER,
                rh_validated_at TIMESTAMP WITH TIME ZONE,
                rh_comment TEXT,
                direction_validated_by INTEGER,
                direction_validated_at TIMESTAMP WITH TIME ZONE,
                direction_comment TEXT,
                leave_balance_days NUMERIC(5,2) DEFAULT 0,
                leave_compensation_amount NUMERIC(12,2) DEFAULT 0,
                initiated_by INTEGER NOT NULL,
                initiated_by_role VARCHAR(30),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS offboarding_checklist_items (
                id SERIAL PRIMARY KEY,
                departure_id INTEGER NOT NULL REFERENCES departures(id) ON DELETE CASCADE,
                title VARCHAR(300) NOT NULL,
                description TEXT,
                category VARCHAR(50) DEFAULT 'general',
                assigned_to VARCHAR(50) DEFAULT 'rh',
                is_completed BOOLEAN DEFAULT FALSE,
                completed_by INTEGER,
                completed_at TIMESTAMP WITH TIME ZONE,
                sort_order INTEGER DEFAULT 0,
                is_required BOOLEAN DEFAULT TRUE
            );

            CREATE TABLE IF NOT EXISTS exit_interviews (
                id SERIAL PRIMARY KEY,
                departure_id INTEGER NOT NULL REFERENCES departures(id) ON DELETE CASCADE,
                scheduled_date DATE,
                scheduled_time VARCHAR(10),
                interviewer_id INTEGER,
                location VARCHAR(200),
                status VARCHAR(30) DEFAULT 'planned',
                departure_reason_rating INTEGER,
                management_rating INTEGER,
                work_environment_rating INTEGER,
                career_growth_rating INTEGER,
                compensation_rating INTEGER,
                primary_departure_reason VARCHAR(100),
                would_recommend BOOLEAN,
                would_return BOOLEAN,
                suggestions TEXT,
                positive_aspects TEXT,
                improvement_areas TEXT,
                additional_notes TEXT,
                completed_at TIMESTAMP WITH TIME ZONE
            );
        """))
        db_dep.commit()
        print("✅ Departure tables ready")
    except Exception as e:
        print(f"⚠️  Departure tables init warning: {e}")
        db_dep.rollback()
    finally:
        db_dep.close()

    # Table notification_preferences
    db_notif_pref = SessionLocal()
    try:
        db_notif_pref.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS notification_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                tenant_id INTEGER NOT NULL,
                category VARCHAR(50) NOT NULL,
                enabled BOOLEAN DEFAULT true,
                UNIQUE(user_id, tenant_id, category)
            );
        """))
        db_notif_pref.commit()
        print("✅ Notification preferences table ready")
    except Exception as e:
        print(f"⚠️  Notification preferences table warning: {e}")
        db_notif_pref.rollback()
    finally:
        db_notif_pref.close()

    # Migration: colonnes 2FA TOTP
    db_2fa = SessionLocal()
    try:
        db_2fa.execute(sql_text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN DEFAULT false;"))
        db_2fa.execute(sql_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);"))
        db_2fa.execute(sql_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;"))
        db_2fa.execute(sql_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);"))
        db_2fa.execute(sql_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;"))
        db_2fa.commit()
        print("✅ 2FA columns ready")
        print("✅ Password reset columns ready")
    except Exception as e:
        print(f"⚠️  2FA migration warning: {e}")
        db_2fa.rollback()
    finally:
        db_2fa.close()

    # Migration: ajouter visibility sur job_postings si absent
    db_vis = SessionLocal()
    try:
        db_vis.execute(sql_text("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'internal';"))
        db_vis.commit()
        print("✅ job_postings.visibility column ready")
    except Exception as e:
        print(f"⚠️  visibility migration warning: {e}")
        db_vis.rollback()
    finally:
        db_vis.close()

    # Migration: ajouter net_salary sur employees si absent
    db_ns = SessionLocal()
    try:
        db_ns.execute(sql_text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS net_salary NUMERIC(15,2);"))
        db_ns.commit()
        print("✅ net_salary column ready")
    except Exception as e:
        print(f"⚠️  net_salary migration warning: {e}")
        db_ns.rollback()
    finally:
        db_ns.close()

    # Migration: signature_url VARCHAR(500) → TEXT (pour stocker les data URL base64)
    db_sig = SessionLocal()
    try:
        db_sig.execute(sql_text("""
            ALTER TABLE employees
            ALTER COLUMN signature_url TYPE TEXT;
        """))
        db_sig.commit()
        print("✅ signature_url column type upgraded to TEXT")
    except Exception as e:
        print(f"⚠️  signature_url migration warning: {e}")
        db_sig.rollback()
    finally:
        db_sig.close()

    # Migration: photo_url VARCHAR(500) → TEXT (pour stocker les data URL base64)
    db_photo = SessionLocal()
    try:
        db_photo.execute(sql_text("""
            ALTER TABLE employees
            ALTER COLUMN photo_url TYPE TEXT;
        """))
        db_photo.commit()
        print("✅ photo_url column type upgraded to TEXT")
    except Exception as e:
        print(f"⚠️  photo_url migration warning: {e}")
        db_photo.rollback()
    finally:
        db_photo.close()

    # Migration: colonnes étendues employé (famille, médical, organisation)
    db_ext = SessionLocal()
    try:
        db_ext.execute(sql_text("""
            ALTER TABLE employees
                ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
                ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
                ADD COLUMN IF NOT EXISTS address TEXT,
                ADD COLUMN IF NOT EXISTS classification VARCHAR(100),
                ADD COLUMN IF NOT EXISTS coefficient VARCHAR(50),
                ADD COLUMN IF NOT EXISTS probation_end_date DATE,
                ADD COLUMN IF NOT EXISTS contract_end_date DATE,
                ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50),
                ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(200),
                ADD COLUMN IF NOT EXISTS spouse_birth_date DATE,
                ADD COLUMN IF NOT EXISTS work_email VARCHAR(200),
                ADD COLUMN IF NOT EXISTS work_phone VARCHAR(50),
                ADD COLUMN IF NOT EXISTS has_disability BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS disability_description TEXT,
                ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200),
                ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
                ADD COLUMN IF NOT EXISTS comex_member BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS hrbp VARCHAR(200),
                ADD COLUMN IF NOT EXISTS salary_category VARCHAR(100);
        """))
        db_ext.commit()
        print("✅ extended employee columns ready")
    except Exception as e:
        print(f"⚠️  extended employee columns warning: {e}")
        db_ext.rollback()
    finally:
        db_ext.close()

    # Migration: ajouter checklist_item_id sur tasks si absent
    db2 = SessionLocal()
    try:
        db2.execute(sql_text("""
            ALTER TABLE tasks
                ADD COLUMN IF NOT EXISTS checklist_item_id INTEGER
                REFERENCES daily_checklist_items(id) ON DELETE SET NULL;
        """))
        db2.commit()
        print("✅ Migration daily_checklist done")
    except Exception as e:
        print(f"⚠️  Migration daily_checklist warning: {e}")
        db2.rollback()
    finally:
        db2.close()

    # Migration: table course_skills (liaison formation ↔ compétence)
    db_cs = SessionLocal()
    try:
        db_cs.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS course_skills (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
                UNIQUE(course_id, skill_id)
            );
        """))
        db_cs.commit()
        print("✅ Migration course_skills done")
    except Exception as e:
        print(f"⚠️  Migration course_skills warning: {e}")
        db_cs.rollback()
    finally:
        db_cs.close()

    # Tables intégrations (OAuth tokens, sync logs)
    db_integ = SessionLocal()
    try:
        db_integ.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS tenant_integrations (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                provider VARCHAR(50) NOT NULL,
                access_token_encrypted TEXT,
                refresh_token_encrypted TEXT,
                expires_at TIMESTAMP WITH TIME ZONE,
                provider_metadata JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                connected_by INTEGER REFERENCES users(id),
                connected_at TIMESTAMP WITH TIME ZONE,
                last_synced_at TIMESTAMP WITH TIME ZONE,
                last_sync_status VARCHAR(50),
                last_sync_error TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(tenant_id, provider)
            );

            CREATE TABLE IF NOT EXISTS integration_sync_logs (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                provider VARCHAR(50) NOT NULL,
                sync_type VARCHAR(50) NOT NULL,
                direction VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL,
                items_synced INTEGER DEFAULT 0,
                items_failed INTEGER DEFAULT 0,
                error_details TEXT,
                started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                completed_at TIMESTAMP WITH TIME ZONE
            );
        """))
        db_integ.commit()
        print("✅ Integration tables ready")
    except Exception as e:
        print(f"⚠️  Integration tables warning: {e}")
        db_integ.rollback()
    finally:
        db_integ.close()

    # Migration: table onboarding_queue
    db_oq = SessionLocal()
    try:
        db_oq.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS onboarding_queue (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                application_id INTEGER NOT NULL UNIQUE,
                candidate_id INTEGER NOT NULL,
                job_posting_id INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                hired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ix_onboarding_queue_tenant ON onboarding_queue(tenant_id);
        """))
        db_oq.commit()
        print("✅ Onboarding queue table ready")
    except Exception as e:
        print(f"⚠️  Onboarding queue table warning: {e}")
        db_oq.rollback()
    finally:
        db_oq.close()

    # ── Migration: widen attitudes.icon VARCHAR(10) → VARCHAR(50) ─────────
    _db_att = _SL()
    try:
        _db_att.execute(__import__('sqlalchemy').text(
            "ALTER TABLE attitudes ALTER COLUMN icon TYPE VARCHAR(50)"
        ))
        _db_att.commit()
        print("✅ Migration: attitudes.icon widened to VARCHAR(50)")
    except Exception as _e:
        _db_att.rollback()
        print(f"⚠️  Migration attitudes.icon (non-fatal): {_e}")
    finally:
        _db_att.close()
    # ─────────────────────────────────────────────────────────────────────

    yield
    # Shutdown
    print("👋 Shutting down...")


app = FastAPI(
    title="TARGETYM AI API",
    description="Backend API pour la plateforme RH TARGETYM AI",
    version="1.0.0",
    lifespan=lifespan
)


# ── Global exception handler ─────────────────────────────────────────────────
# Ensures CORS headers are present even on unhandled 500 errors.
# Without this, DB crashes (e.g. RDS connection failure) propagate to Uvicorn
# which returns a raw 500 without CORS headers → frontend sees "CORS error".
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )
# ─────────────────────────────────────────────────────────────────────────────


# CORS - Configuration production AWS + Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://localhost",
        "capacitor://localhost",
        "http://localhost",
        "https://targetym.ai",
        "https://www.targetym.ai",
        "https://dashboard.targetym.ai",
        "https://targetym-dashboard.vercel.app",
        "https://targetym.vercel.app",
        "https://targetym-website.vercel.app",
        "https://app.targetym.ai",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Monter le dossier des uploads du centre d'aide comme fichiers statiques
from pathlib import Path
help_uploads_dir = Path("/app/public/help-uploads")
if help_uploads_dir.exists():
    app.mount("/help-uploads", StaticFiles(directory=str(help_uploads_dir)), name="help-uploads")

# Monter le dossier des médias (images blog, ressources…)
media_uploads_dir = Path("/app/public/media-uploads")
media_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media-uploads", StaticFiles(directory=str(media_uploads_dir)), name="media-uploads")

# Routes
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(departments.router)
app.include_router(leaves.router)
app.include_router(okr.router)
app.include_router(performance.router)
app.include_router(recruitment.router)
app.include_router(tasks_router)
app.include_router(performance_score_router)  
app.include_router(invitations_router)
app.include_router(learning_router)
app.include_router(post_training_eval_router)
app.include_router(certificate_router)
app.include_router(certificate_settings_router)
app.include_router(missions_router)
app.include_router(analytics_router)
app.include_router(onboarding_router)
app.include_router(notifications_router)
app.include_router(documents_router)
app.include_router(attitudes_router)
app.include_router(careers_router)
app.include_router(careers_employee_router)
app.include_router(careers_ninebox_router)
app.include_router(app_tour_router)
app.include_router(daily_checklist_router)
app.include_router(ai_chat_router, prefix="/api/ai-chat", tags=["AI Chat"])
app.include_router(ai_scoring_router)
app.include_router(help_center_router, prefix="/api/help", tags=["Help Center - Public"])
app.include_router(help_center_admin_router, prefix="/api/help/admin", tags=["Help Center - Admin"])
app.include_router(help_center_seed_router, prefix="/api/help/admin", tags=["Help Center - Seed"])
app.include_router(platform_admin_router, prefix="/api/platform", tags=["Platform Admin - SUPER_ADMIN"])
app.include_router(departures_router)
app.include_router(integrations_router)
app.include_router(intowork_integration_router)
app.include_router(currency_router)
app.include_router(groups_router, prefix="/api", tags=["Groups - Groupes & Filiales"])
app.include_router(sanctions_router)
app.include_router(sanctions_legacy_router)
app.include_router(benefits_router)
app.include_router(sos_router)
app.include_router(absences_router)
app.include_router(billing_router, prefix="/api", tags=["Billing - Facturation"])
app.include_router(signatures_router)
app.include_router(training_providers_router)
app.include_router(training_plans_router)
app.include_router(contentieux_router)
app.include_router(compensation_router)
app.include_router(blog_router)
app.include_router(resources_router)
app.include_router(media_upload_router)
app.include_router(public_content_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Bienvenue sur l'API TARGETYM AI",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health_check():
    """Health check AWS ECS"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }

