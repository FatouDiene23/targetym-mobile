"""add tenant activation fields: trial_starts_at, activation_note, block_reason

Revision ID: 008
Revises: 007
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;"))
    conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS activation_note TEXT;"))
    conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS block_reason TEXT;"))


def downgrade():
    pass
