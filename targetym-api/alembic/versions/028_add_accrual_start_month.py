"""add accrual_start_month to leave_balances

Revision ID: 028
Revises: 027
Create Date: 2026-01-01

"""
from alembic import op

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS accrual_start_month SMALLINT DEFAULT 1"
    )
    # Tous les soldes existants démarrent depuis janvier (employés déjà en poste)
    op.execute(
        "UPDATE leave_balances SET accrual_start_month = 1 WHERE accrual_start_month IS NULL"
    )


def downgrade():
    op.execute("ALTER TABLE leave_balances DROP COLUMN IF EXISTS accrual_start_month")
