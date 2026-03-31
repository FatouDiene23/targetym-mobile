"""add group and subsidiary fields to tenants

Revision ID: 006
Revises: 005
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer l'enum PostgreSQL
    group_type_enum = postgresql.ENUM(
        'standalone', 'group', 'subsidiary',
        name='grouptype',
        create_type=True
    )
    group_type_enum.create(op.get_bind(), checkfirst=True)

    # Ajouter les colonnes groupe sur la table tenants
    op.add_column('tenants', sa.Column(
        'group_type',
        sa.Enum('standalone', 'group', 'subsidiary', name='grouptype'),
        nullable=False,
        server_default='standalone'
    ))
    op.add_column('tenants', sa.Column(
        'is_group',
        sa.Boolean(),
        nullable=False,
        server_default='false'
    ))
    op.add_column('tenants', sa.Column(
        'parent_tenant_id',
        sa.Integer(),
        sa.ForeignKey('tenants.id', ondelete='SET NULL'),
        nullable=True
    ))
    op.create_index('ix_tenants_parent_tenant_id', 'tenants', ['parent_tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_tenants_parent_tenant_id', table_name='tenants')
    op.drop_column('tenants', 'parent_tenant_id')
    op.drop_column('tenants', 'is_group')
    op.drop_column('tenants', 'group_type')
    op.execute("DROP TYPE IF EXISTS grouptype")
