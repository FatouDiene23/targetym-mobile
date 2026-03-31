"""create support_audit_logs table

Revision ID: 005
Revises: 004
Create Date: 2025-08-01
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'support_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('agent_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('agent_email', sa.String(255), nullable=False),
        sa.Column('target_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('target_user_email', sa.String(255), nullable=True),
        sa.Column('target_tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='SET NULL'), nullable=True),
        sa.Column('target_tenant_name', sa.String(255), nullable=True),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('action_detail', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_support_audit_logs_id', 'support_audit_logs', ['id'], unique=False)
    op.create_index('ix_support_audit_logs_agent_id', 'support_audit_logs', ['agent_id'], unique=False)
    op.create_index('ix_support_audit_logs_target_user_id', 'support_audit_logs', ['target_user_id'], unique=False)
    op.create_index('ix_support_audit_logs_target_tenant_id', 'support_audit_logs', ['target_tenant_id'], unique=False)
    op.create_index('ix_support_audit_logs_created_at', 'support_audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('support_audit_logs')
