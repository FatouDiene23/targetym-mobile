"""add salaire_brut and part_variable to employees

Revision ID: 014
Revises: 013
Create Date: 2026-03-17

"""
from alembic import op
import sqlalchemy as sa

revision = '014b'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('employees', sa.Column('salaire_brut', sa.Numeric(15, 2), nullable=True))
    op.add_column('employees', sa.Column('part_variable', sa.Numeric(15, 2), nullable=True))


def downgrade():
    op.drop_column('employees', 'part_variable')
    op.drop_column('employees', 'salaire_brut')
