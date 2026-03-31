"""add training_providers table

Revision ID: 015
Revises: 014
Create Date: 2026-03-18

NOTE: Cette migration sera appliquée manuellement via CloudShell RDS.
      Ne pas exécuter `alembic upgrade head` automatiquement.
"""
from alembic import op
import sqlalchemy as sa

revision = '015'
down_revision = '014b'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Créer la table training_providers
    op.create_table(
        'training_providers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('contact_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('type', sa.String(length=20), nullable=False, server_default='externe'),
        sa.Column('specialties', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("type IN ('interne', 'externe')", name='training_providers_type_check'),
    )
    op.create_index(op.f('ix_training_providers_id'), 'training_providers', ['id'], unique=False)

    # 2. Ajouter provider_id sur la table courses
    op.add_column('courses', sa.Column('provider_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_courses_provider_id', 'courses', 'training_providers',
        ['provider_id'], ['id'], ondelete='SET NULL'
    )


def downgrade():
    op.drop_constraint('fk_courses_provider_id', 'courses', type_='foreignkey')
    op.drop_column('courses', 'provider_id')
    op.drop_index(op.f('ix_training_providers_id'), table_name='training_providers')
    op.drop_table('training_providers')
