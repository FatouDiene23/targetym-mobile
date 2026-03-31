"""add group_conversion_requests table

Revision ID: 007
Revises: 006
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Créer le type ENUM seulement s'il n'existe pas déjà
    conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE groupconversionstatus AS ENUM ('pending', 'approved', 'rejected');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    # Créer la table seulement si elle n'existe pas
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS group_conversion_requests (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            requested_by_email VARCHAR(255),
            reason TEXT,
            nb_subsidiaries INTEGER,
            contact_phone VARCHAR(50),
            quote_amount INTEGER,
            payment_status VARCHAR(20) DEFAULT 'unpaid',
            payment_ref VARCHAR(255),
            status groupconversionstatus NOT NULL DEFAULT 'pending',
            reviewed_by_email VARCHAR(255),
            review_note TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ
        );
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_group_conversion_requests_id ON group_conversion_requests(id);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_group_conversion_requests_tenant_id ON group_conversion_requests(tenant_id);"))


def downgrade() -> None:
    op.drop_table('group_conversion_requests')
    op.execute("DROP TYPE IF EXISTS groupconversionstatus")
