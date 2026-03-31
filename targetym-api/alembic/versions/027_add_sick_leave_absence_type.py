"""add sick_leave to absencetype enum

Revision ID: 027
Revises: 026
Create Date: 2026-03-26
"""
from alembic import op

revision = '027'
down_revision = '026'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE absencetype ADD VALUE IF NOT EXISTS 'sick_leave'")


def downgrade():
    # PostgreSQL ne supporte pas la suppression d'une valeur d'enum
    pass
