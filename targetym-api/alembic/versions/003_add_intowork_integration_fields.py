"""add_intowork_integration_fields

Revision ID: 003
Revises: 002
Create Date: 2026-03-06

Ajoute les champs d'intégration IntoWork sur le modèle Tenant :
- intowork_company_id : ID de la Company liée sur IntoWork
- intowork_api_key    : Clé API IntoWork (stockée chiffrée)
- intowork_linked_at  : Date de liaison des deux comptes
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '003'
down_revision = '002_create_help_center'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('intowork_company_id', sa.Integer(), nullable=True)
    )
    op.add_column(
        'tenants',
        sa.Column('intowork_api_key', sa.String(255), nullable=True)
    )
    op.add_column(
        'tenants',
        sa.Column('intowork_linked_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        'ix_tenants_intowork_company_id',
        'tenants',
        ['intowork_company_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_tenants_intowork_company_id', table_name='tenants')
    op.drop_column('tenants', 'intowork_linked_at')
    op.drop_column('tenants', 'intowork_api_key')
    op.drop_column('tenants', 'intowork_company_id')
