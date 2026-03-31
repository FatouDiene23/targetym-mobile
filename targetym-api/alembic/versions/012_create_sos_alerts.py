"""create sos alerts table

Revision ID: 012_create_sos_alerts
Revises: 011_create_employee_benefits
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa

revision = '012_create_sos_alerts'
down_revision = '011_create_employee_benefits'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            category VARCHAR(50) NOT NULL DEFAULT 'general',
            message TEXT,
            is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            handled_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            handled_at TIMESTAMP WITH TIME ZONE,
            resolution_note TEXT,
            location_hint VARCHAR(200),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_sos_alerts_tenant_id ON sos_alerts(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sos_alerts_user_id ON sos_alerts(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sos_alerts_status ON sos_alerts(status);")


def downgrade():
    op.execute("DROP TABLE IF EXISTS sos_alerts;")
