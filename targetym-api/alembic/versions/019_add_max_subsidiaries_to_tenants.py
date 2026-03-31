"""add max_subsidiaries to tenants

Revision ID: 019
Revises: 018
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # Ajouter la colonne max_subsidiaries avec valeur par défaut 0
    conn.execute(text("""
        ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS max_subsidiaries INTEGER NOT NULL DEFAULT 0;
    """))
    # Pour les groupes existants : initialiser max_subsidiaries à partir des demandes approuvées
    conn.execute(text("""
        UPDATE tenants t
        SET max_subsidiaries = COALESCE((
            SELECT SUM(gcr.nb_subsidiaries)
            FROM group_conversion_requests gcr
            WHERE gcr.tenant_id = t.id
              AND gcr.status = 'approved'
        ), 0)
        WHERE t.is_group = true;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("ALTER TABLE tenants DROP COLUMN IF EXISTS max_subsidiaries;"))
