"""create invoices table

Revision ID: 010_create_invoices
Revises: 009_fix_tenant_activation_fields_idempotent
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = '010_create_invoices'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE invoicestatus AS ENUM ('pending', 'paid', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
            description TEXT,
            status invoicestatus NOT NULL DEFAULT 'pending',
            payment_provider VARCHAR(50) NOT NULL DEFAULT 'manual',
            payment_ref VARCHAR(255),
            invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            due_date TIMESTAMP WITH TIME ZONE,
            pdf_url VARCHAR(500),
            created_by_email VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_tenant_id ON invoices(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_status ON invoices(status);")


def downgrade():
    op.execute("DROP TABLE IF EXISTS invoices;")
    op.execute("DROP TYPE IF EXISTS invoicestatus;")
