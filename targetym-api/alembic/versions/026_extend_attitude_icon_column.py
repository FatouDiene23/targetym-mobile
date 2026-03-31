"""Extend attitude icon column from VARCHAR(10) to VARCHAR(50)

Revision ID: 026
Revises: 025
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa

revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'attitudes',
        'icon',
        existing_type=sa.String(10),
        type_=sa.String(50),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        'attitudes',
        'icon',
        existing_type=sa.String(50),
        type_=sa.String(10),
        existing_nullable=True,
    )
