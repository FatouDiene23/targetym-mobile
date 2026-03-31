"""fix: add tenant activation fields with IF NOT EXISTS (idempotent)

Revision ID: 009
Revises: 008
Create Date: 2026-03-13

Sécurise l'ajout des colonnes trial_starts_at, activation_note, block_reason
en cas d'échec silencieux de la migration 008 sur la base de production.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Utiliser IF NOT EXISTS pour une migration idempotente
    conn.execute(text("""
        ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;
    """))
    conn.execute(text("""
        ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS activation_note TEXT;
    """))
    conn.execute(text("""
        ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS block_reason TEXT;
    """))


def downgrade():
    # On ne supprime pas — downgrade no-op pour éviter la perte de données
    pass
