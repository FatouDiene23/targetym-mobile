"""ensure absence_reports table exists (repair migration)

Revision ID: 016_ensure_absence_reports
Revises: 015_add_training_providers
Create Date: 2026-03-20 00:00:00.000000
"""
from alembic import op
from sqlalchemy import text

revision = '016_ensure_absence_reports'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    # Create enums if they don't already exist
    op.execute(text("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'absencetype') THEN
                CREATE TYPE absencetype AS ENUM (
                    'absence', 'tardiness', 'early_departure', 'unauthorized_absence'
                );
            END IF;
        END $$
    """))
    op.execute(text("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'absencestatus') THEN
                CREATE TYPE absencestatus AS ENUM (
                    'pending', 'justified', 'unjustified', 'notified'
                );
            END IF;
        END $$
    """))

    # Create table if it doesn't already exist
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS absence_reports (
            id               SERIAL PRIMARY KEY,
            tenant_id        INTEGER NOT NULL REFERENCES tenants(id),
            employee_id      INTEGER NOT NULL REFERENCES employees(id),
            type             absencetype NOT NULL DEFAULT 'absence',
            status           absencestatus NOT NULL DEFAULT 'pending',
            absence_date     DATE NOT NULL,
            expected_start_time VARCHAR(10),
            actual_start_time   VARCHAR(10),
            duration_minutes    INTEGER,
            reason           TEXT,
            notes            TEXT,
            document         TEXT,
            notification_sent BOOLEAN NOT NULL DEFAULT false,
            reported_by_id   INTEGER NOT NULL REFERENCES employees(id),
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ DEFAULT now()
        )
    """))

    # Create indexes if they don't exist
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_absence_reports_tenant_id
            ON absence_reports (tenant_id)
    """))
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_absence_reports_employee_id
            ON absence_reports (employee_id)
    """))
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_absence_reports_absence_date
            ON absence_reports (absence_date)
    """))


def downgrade():
    pass  # repair migration — no downgrade needed
