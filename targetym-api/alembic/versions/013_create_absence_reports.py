"""create absence_reports table

Revision ID: 013_create_absence_reports
Revises: 012_create_sos_alerts
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '013_create_absence_reports'
down_revision = '012_create_sos_alerts'
branch_labels = None
depends_on = None


def upgrade():
    # Create ENUM types safely (idempotent)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE absencetype AS ENUM ('absence', 'tardiness', 'early_departure', 'unauthorized_absence');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE absencestatus AS ENUM ('pending', 'justified', 'unjustified', 'notified');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.create_table(
        'absence_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('employee_id', sa.Integer(), sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('type', sa.Enum('absence', 'tardiness', 'early_departure', 'unauthorized_absence', name='absencetype', create_type=False), nullable=False, server_default='absence'),
        sa.Column('status', sa.Enum('pending', 'justified', 'unjustified', 'notified', name='absencestatus', create_type=False), nullable=False, server_default='pending'),
        sa.Column('absence_date', sa.Date(), nullable=False),
        sa.Column('expected_start_time', sa.String(10), nullable=True),
        sa.Column('actual_start_time', sa.String(10), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('document', sa.Text(), nullable=True),
        sa.Column('notification_sent', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('reported_by_id', sa.Integer(), sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_absence_reports_tenant_id',   'absence_reports', ['tenant_id'])
    op.create_index('ix_absence_reports_employee_id', 'absence_reports', ['employee_id'])
    op.create_index('ix_absence_reports_absence_date', 'absence_reports', ['absence_date'])


def downgrade():
    op.drop_index('ix_absence_reports_absence_date', table_name='absence_reports')
    op.drop_index('ix_absence_reports_employee_id',  table_name='absence_reports')
    op.drop_index('ix_absence_reports_tenant_id',    table_name='absence_reports')
    op.drop_table('absence_reports')
    op.execute("DROP TYPE IF EXISTS absencetype")
    op.execute("DROP TYPE IF EXISTS absencestatus")
