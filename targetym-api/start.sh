#!/bin/sh
set -e

echo "🚀 === TARGETYM API STARTUP ==="
echo "📌 PORT: ${PORT:-8000}"
echo "📌 DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"
echo "📌 SECRET_KEY set: $([ -n "$SECRET_KEY" ] && echo YES || echo NO)"
echo "📌 SUPER_ADMIN_PASSWORD set: $([ -n "$SUPER_ADMIN_PASSWORD" ] && echo YES || echo NO)"
echo "📌 TECH_SUPER_ADMIN_PASSWORD set: $([ -n "$TECH_SUPER_ADMIN_PASSWORD" ] && echo YES || echo NO)"

echo ""
echo "📦 Step 0: Emergency direct SQL fixes (independent of Alembic)..."
python -c "
import os, sys
try:
    from sqlalchemy import create_engine, text
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        print('  ⚠️  No DATABASE_URL - skipping direct fixes')
        sys.exit(0)
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_subsidiaries INTEGER NOT NULL DEFAULT 0'))
        # Migration 020 — evaluation periods & weights
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS period VARCHAR(20) DEFAULT \'annual\''))
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS quarter INTEGER'))
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS weight_self INTEGER DEFAULT 25'))
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS weight_manager INTEGER DEFAULT 25'))
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS weight_peer INTEGER DEFAULT 25'))
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS weight_direct_report INTEGER DEFAULT 25'))
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS min_direct_report_evaluators INTEGER DEFAULT 1'))
        conn.execute(text('ALTER TABLE evaluation_campaigns ADD COLUMN IF NOT EXISTS max_direct_report_evaluators INTEGER DEFAULT 3'))
        conn.execute(text('ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS period VARCHAR(20)'))
        conn.execute(text('ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS weighted_score NUMERIC(5,2)'))
        # Migration 021 — one_on_one evaluation & tasks
        conn.execute(text('ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS evaluation_score INTEGER'))
        conn.execute(text('ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS evaluation_comment TEXT'))
        conn.execute(text('ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS tasks JSONB'))
        conn.execute(text('ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS topics JSONB'))
        # Migration 023 — competency framework enrichment
        conn.execute(text('ALTER TABLE skills ADD COLUMN IF NOT EXISTS skill_type VARCHAR(30) DEFAULT \'soft_skill\''))
        conn.execute(text('ALTER TABLE skills ADD COLUMN IF NOT EXISTS hierarchy_level VARCHAR(50)'))
        conn.execute(text('ALTER TABLE skills ADD COLUMN IF NOT EXISTS department VARCHAR(100)'))
        conn.execute(text('ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE'))
        conn.execute(text('ALTER TABLE level_competencies ADD COLUMN IF NOT EXISTS skill_id INTEGER REFERENCES skills(id) ON DELETE SET NULL'))
        conn.execute(text('ALTER TABLE employee_skills ADD COLUMN IF NOT EXISTS formations_score INTEGER DEFAULT 0'))
        conn.execute(text('ALTER TABLE employee_skills ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 0'))
        conn.execute(text('ALTER TABLE employee_skills ADD COLUMN IF NOT EXISTS attitude_score INTEGER DEFAULT 0'))
        conn.execute(text('ALTER TABLE employee_skills ADD COLUMN IF NOT EXISTS notes TEXT'))
        conn.execute(text('ALTER TABLE employee_skills ADD COLUMN IF NOT EXISTS last_computed_at TIMESTAMP WITH TIME ZONE'))
        # Migration 028 — leave balance accrual start month
        conn.execute(text('ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS accrual_start_month SMALLINT DEFAULT 1'))
        conn.execute(text('UPDATE leave_balances SET accrual_start_month = 1 WHERE accrual_start_month IS NULL'))
        # notification_preferences table (pas de migration Alembic — créée ici)
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS notification_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                category VARCHAR(100) NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                CONSTRAINT uq_notif_pref UNIQUE(user_id, tenant_id, category)
            )
        '''))
        conn.commit()
    print('  ✅ Column max_subsidiaries ensured')
    print('  ✅ Migration 020 columns ensured (evaluation periods & weights)')
    print('  ✅ Migration 021 columns ensured (one_on_one evaluation & tasks)')
    print('  ✅ Migration 023 columns ensured (competency framework)')
    print('  ✅ Migration 028 columns ensured (leave balance accrual_start_month)')
except Exception as e:
    print(f'  ⚠️  Direct fix error: {e}')
" || echo "  ⚠️  Direct fix script failed (continuing)"

echo ""
echo "� Emergency SQL fix: ensuring interaction_type column exists..."
python -c "
import os, psycopg2
try:
    conn = psycopg2.connect(os.environ.get('DATABASE_URL', ''))
    cur = conn.cursor()
    cur.execute('ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS interaction_type VARCHAR(20)')
    conn.commit()
    cur.close()
    conn.close()
    print('  ✅ interaction_type column OK')
except Exception as e:
    print(f'  ⚠️  Emergency fix warning: {e}')
" || true

echo ""
echo "�📦 Step 1: Running Alembic migrations..."
python migrate.py && echo "✅ Migrations OK" || echo "⚠️  Migrations warning (continuing)"

echo ""
echo "� Emergency SQL fix: ensuring missions table columns exist..."
python -c "
import os, psycopg2
try:
    conn = psycopg2.connect(os.environ.get('DATABASE_URL', ''))
    cur = conn.cursor()
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS trip_type VARCHAR(50)\")
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS departure_location VARCHAR(255)\")
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS destination_country VARCHAR(100)\")
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS transport_details TEXT\")
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS accommodation_type VARCHAR(50)\")
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS accommodation_details TEXT\")
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(12,2)\")
    cur.execute(\"ALTER TABLE missions ADD COLUMN IF NOT EXISTS initiated_by VARCHAR(50)\")
    conn.commit()
    cur.close()
    conn.close()
    print('  ✅ missions columns OK')
except Exception as e:
    print(f'  ⚠️  missions fix warning: {e}')
" || true

python3 -c "
import psycopg2, os, urllib.parse
url = os.environ.get('DATABASE_URL', '')
if url.startswith('postgresql+asyncpg://'):
    url = url.replace('postgresql+asyncpg://', 'postgresql://', 1)
p = urllib.parse.urlparse(url)
try:
    conn = psycopg2.connect(host=p.hostname, port=p.port or 5432, dbname=p.path.lstrip('/'), user=p.username, password=p.password)
    cur = conn.cursor()
    cur.execute(\"ALTER TABLE blog_posts ALTER COLUMN tenant_id DROP NOT NULL\")
    conn.commit()
    cur.close()
    conn.close()
    print('  ✅ blog_posts.tenant_id nullable OK')
except Exception as e:
    print(f'  ⚠️  blog_posts tenant_id fix warning: {e}')
" || true

python3 -c "
import psycopg2, os, urllib.parse
url = os.environ.get('DATABASE_URL', '')
if url.startswith('postgresql+asyncpg://'):
    url = url.replace('postgresql+asyncpg://', 'postgresql://', 1)
p = urllib.parse.urlparse(url)
try:
    conn = psycopg2.connect(host=p.hostname, port=p.port or 5432, dbname=p.path.lstrip('/'), user=p.username, password=p.password)
    cur = conn.cursor()
    cur.execute(\"ALTER TABLE resources ALTER COLUMN tenant_id DROP NOT NULL\")
    cur.execute(\"ALTER TABLE resource_categories ALTER COLUMN tenant_id DROP NOT NULL\")
    conn.commit()
    cur.close()
    conn.close()
    print('  ✅ resources/resource_categories tenant_id nullable OK')
except Exception as e:
    print(f'  ⚠️  resources tenant_id fix warning: {e}')
" || true

python3 -c "
import psycopg2, os, urllib.parse
url = os.environ.get('DATABASE_URL', '')
if url.startswith('postgresql+asyncpg://'):
    url = url.replace('postgresql+asyncpg://', 'postgresql://', 1)
p = urllib.parse.urlparse(url)
try:
    conn = psycopg2.connect(host=p.hostname, port=p.port or 5432, dbname=p.path.lstrip('/'), user=p.username, password=p.password)
    cur = conn.cursor()
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(200)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS spouse_birth_date DATE\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_email VARCHAR(255)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_phone VARCHAR(50)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_disability BOOLEAN DEFAULT FALSE\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS disability_description TEXT\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS comex_member VARCHAR(200)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS hrbp VARCHAR(200)\")
    cur.execute(\"ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_category VARCHAR(100)\")
    conn.commit()
    cur.close()
    conn.close()
    print('  ✅ employees new columns OK')
except Exception as e:
    print(f'  ⚠️  employees columns warning: {e}')
" || true

python3 -c "
import psycopg2, os, urllib.parse
url = os.environ.get('DATABASE_URL', '')
if url.startswith('postgresql+asyncpg://'):
    url = url.replace('postgresql+asyncpg://', 'postgresql://', 1)
p = urllib.parse.urlparse(url)
try:
    conn = psycopg2.connect(host=p.hostname, port=p.port or 5432, dbname=p.path.lstrip('/'), user=p.username, password=p.password)
    cur = conn.cursor()
    cur.execute(\"ALTER TABLE attitudes ALTER COLUMN icon TYPE VARCHAR(50)\")
    conn.commit()
    cur.close()
    conn.close()
    print('  ✅ attitudes.icon column widened to VARCHAR(50)')
except Exception as e:
    print(f'  ⚠️  attitudes icon fix warning: {e}')
" || true

echo ""
echo "�🔍 Step 2: Testing Python app import..."
python -c "
import sys
print('Python version:', sys.version)
try:
    print('  - Loading app.core.config...')
    from app.core.config import settings
    print('  ✅ config OK')
    print('  - Loading app.core.database...')
    from app.core.database import Base, engine
    print('  ✅ database OK')
    print('  - Loading app.api.platform_admin...')
    from app.api.platform_admin import router
    print('  ✅ platform_admin OK')
    print('  - Loading app.main...')
    import app.main
    print('  ✅ app.main OK')
except Exception as e:
    import traceback
    print('  ❌ IMPORT ERROR:', e)
    traceback.print_exc()
    sys.exit(1)
print('✅ All imports successful')
"

echo ""
echo "🌐 Step 3: Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
