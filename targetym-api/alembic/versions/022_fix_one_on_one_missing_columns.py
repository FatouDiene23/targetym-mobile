"""022 - Fix missing columns on one_on_ones (idempotent safety migration)

Adds evaluation_score, evaluation_comment, tasks, topics using IF NOT EXISTS
so this migration is safe to run even if migration 021 already applied some of
them.

Revision ID: 022
Revises: 021
Create Date: 2026-03-23
"""
from alembic import op

revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS evaluation_score INTEGER;
        ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS evaluation_comment TEXT;
        ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS tasks JSONB;
        ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS topics JSONB;
    """)


def downgrade():
    pass
