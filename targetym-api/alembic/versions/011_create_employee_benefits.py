"""create employee benefits table

Revision ID: 011_create_employee_benefits
Revises: 010_create_invoices
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa

revision = '011_create_employee_benefits'
down_revision = '010_create_invoices'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS employee_benefits (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            label VARCHAR(200) NOT NULL,
            category VARCHAR(50) NOT NULL DEFAULT 'autre',
            amount NUMERIC(12, 2),
            currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
            frequency VARCHAR(50) NOT NULL DEFAULT 'mensuel',
            start_date DATE,
            end_date DATE,
            status VARCHAR(20) NOT NULL DEFAULT 'actif',
            notes TEXT,
            created_by_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_employee_benefits_tenant_id ON employee_benefits(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_employee_benefits_employee_id ON employee_benefits(employee_id);")


def downgrade():
    op.execute("DROP TABLE IF EXISTS employee_benefits;")
