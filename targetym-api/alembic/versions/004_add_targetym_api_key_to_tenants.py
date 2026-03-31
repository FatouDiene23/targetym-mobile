"""add_targetym_api_key_to_tenants

Revision ID: 004
Revises: 003
Create Date: 2026-03-06

Ajoute le champ targetym_api_key sur le modèle Tenant :
- targetym_api_key : Clé API générée par Targetym, copiée dans IntoWork lors de la liaison.
  Remplace l'ancienne approche par variable d'environnement TARGETYM_API_KEY_{tenant_id}.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'tenants',
        sa.Column('targetym_api_key', sa.String(255), nullable=True)
    )
    op.create_index(
        'ix_tenants_targetym_api_key',
        'tenants',
        ['targetym_api_key'],
        unique=False
    )


def downgrade():
    op.drop_index('ix_tenants_targetym_api_key', table_name='tenants')
    op.drop_column('tenants', 'targetym_api_key')
