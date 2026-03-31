"""expand notifications_type_check to include absence_report and other types

Revision ID: 017_expand_notifications_type_check
Revises: 016_ensure_absence_reports
Create Date: 2026-03-20 00:00:00.000000
"""
from alembic import op
from sqlalchemy import text

revision = '017_expand_notifications_type_check'
down_revision = '016_ensure_absence_reports'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the existing type check constraint (may not exist in all envs)
    op.execute(text("""
        ALTER TABLE notifications
        DROP CONSTRAINT IF EXISTS notifications_type_check
    """))

    # Recreate with all known types including absence_report
    op.execute(text("""
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_type_check CHECK (type IN (
            'leave_request',
            'leave_approved',
            'leave_rejected',
            'signature_request',
            'signature_signed',
            'signature_rejected',
            'document_uploaded',
            'sos_alert',
            'departure',
            'onboarding_task',
            'get_to_know_scheduled',
            'absence_report',
            'absence'
        ))
    """))


def downgrade():
    op.execute(text("""
        ALTER TABLE notifications
        DROP CONSTRAINT IF EXISTS notifications_type_check
    """))
    op.execute(text("""
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_type_check CHECK (type IN (
            'leave_request',
            'leave_approved',
            'leave_rejected',
            'signature_request',
            'signature_signed',
            'signature_rejected',
            'document_uploaded',
            'sos_alert',
            'departure',
            'onboarding_task',
            'get_to_know_scheduled'
        ))
    """))
