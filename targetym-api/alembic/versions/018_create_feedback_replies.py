"""create feedback_replies table

Revision ID: 018
Revises: 017_expand_notifications_type_check
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = '018'
down_revision = '017_expand_notifications_type_check'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS feedback_replies (
            id SERIAL PRIMARY KEY,
            feedback_id INTEGER NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
            employee_id INTEGER NOT NULL REFERENCES employees(id),
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_feedback_replies_feedback_id
        ON feedback_replies (feedback_id);
    """))


def downgrade():
    op.drop_index('ix_feedback_replies_feedback_id', 'feedback_replies')
    op.drop_table('feedback_replies')
