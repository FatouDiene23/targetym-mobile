"""021 - Add evaluation score and tasks to one_on_ones

Revision ID: 021
Revises: 020
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('one_on_ones',
        sa.Column('evaluation_score', sa.Integer(), nullable=True)
    )
    op.add_column('one_on_ones',
        sa.Column('evaluation_comment', sa.Text(), nullable=True)
    )
    op.add_column('one_on_ones',
        sa.Column('tasks', JSONB(), nullable=True)
    )
    op.add_column('one_on_ones',
        sa.Column('topics', JSONB(), nullable=True)
    )


def downgrade():
    op.drop_column('one_on_ones', 'topics')
    op.drop_column('one_on_ones', 'tasks')
    op.drop_column('one_on_ones', 'evaluation_comment')
    op.drop_column('one_on_ones', 'evaluation_score')
