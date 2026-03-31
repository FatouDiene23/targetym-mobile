"""023 - Enrich skills table + link level_competencies to skills + employee competency progress

- skills: add skill_type, hierarchy_level, department
- level_competencies: add skill_id FK (optional, migration preserves existing rows)
- employee_skills: add notes, last_computed_at (for auto-computed scores)

Revision ID: 023
Revises: 022
"""

from alembic import op
import sqlalchemy as sa

revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None


def upgrade():
    # ── skills: add classification fields ──────────────────────────────────
    op.execute("""
        ALTER TABLE skills
            ADD COLUMN IF NOT EXISTS skill_type VARCHAR(30) DEFAULT 'soft_skill',
            ADD COLUMN IF NOT EXISTS hierarchy_level VARCHAR(50) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE
    """)

    # ── level_competencies: add optional FK to skills table ────────────────
    op.execute("""
        ALTER TABLE level_competencies
            ADD COLUMN IF NOT EXISTS skill_id INTEGER REFERENCES skills(id) ON DELETE SET NULL
    """)

    # ── employee_skills: add computed score fields ─────────────────────────
    op.execute("""
        ALTER TABLE employee_skills
            ADD COLUMN IF NOT EXISTS formations_score INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS attitude_score INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS last_computed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
    """)


def downgrade():
    op.execute("ALTER TABLE employee_skills DROP COLUMN IF EXISTS last_computed_at")
    op.execute("ALTER TABLE employee_skills DROP COLUMN IF EXISTS notes")
    op.execute("ALTER TABLE employee_skills DROP COLUMN IF EXISTS attitude_score")
    op.execute("ALTER TABLE employee_skills DROP COLUMN IF EXISTS performance_score")
    op.execute("ALTER TABLE employee_skills DROP COLUMN IF EXISTS formations_score")
    op.execute("ALTER TABLE level_competencies DROP COLUMN IF EXISTS skill_id")
    op.execute("ALTER TABLE skills DROP COLUMN IF EXISTS is_global")
    op.execute("ALTER TABLE skills DROP COLUMN IF EXISTS department")
    op.execute("ALTER TABLE skills DROP COLUMN IF EXISTS hierarchy_level")
    op.execute("ALTER TABLE skills DROP COLUMN IF EXISTS skill_type")
