"""add interaction_type to feedbacks

Revision ID: 024
Revises: 023
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = '024'
down_revision = '023'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'feedbacks',
        sa.Column('interaction_type', sa.String(20), nullable=True)
    )


def downgrade():
    op.drop_column('feedbacks', 'interaction_type')
