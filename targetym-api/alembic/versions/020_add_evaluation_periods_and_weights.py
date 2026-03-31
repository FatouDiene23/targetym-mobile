"""add evaluation periods and weights

Revision ID: 020
Revises: 019
Create Date: 2026-04-01

Ajoute sur EvaluationCampaign :
  - period (quarterly / semester / annual)
  - quarter (1-4)
  - weight_self, weight_manager, weight_peer, weight_direct_report (pondérations)
  - min_direct_report_evaluators, max_direct_report_evaluators
  - change defaults for min/max_peer_evaluators

Ajoute sur Evaluation :
  - period
  - weighted_score
"""
from alembic import op
import sqlalchemy as sa

revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    # =============================================
    # evaluation_campaigns — nouveaux champs
    # =============================================
    op.add_column('evaluation_campaigns',
        sa.Column('period', sa.String(20), nullable=True, server_default='annual'))
    op.add_column('evaluation_campaigns',
        sa.Column('quarter', sa.Integer(), nullable=True))
    op.add_column('evaluation_campaigns',
        sa.Column('weight_self', sa.Integer(), nullable=True, server_default='25'))
    op.add_column('evaluation_campaigns',
        sa.Column('weight_manager', sa.Integer(), nullable=True, server_default='25'))
    op.add_column('evaluation_campaigns',
        sa.Column('weight_peer', sa.Integer(), nullable=True, server_default='25'))
    op.add_column('evaluation_campaigns',
        sa.Column('weight_direct_report', sa.Integer(), nullable=True, server_default='25'))
    op.add_column('evaluation_campaigns',
        sa.Column('min_direct_report_evaluators', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('evaluation_campaigns',
        sa.Column('max_direct_report_evaluators', sa.Integer(), nullable=True, server_default='3'))

    # Mettre à jour les valeurs par défaut de min/max_peer_evaluators existants
    op.execute(
        "UPDATE evaluation_campaigns SET min_peer_evaluators = 1 WHERE min_peer_evaluators = 3"
    )
    op.execute(
        "UPDATE evaluation_campaigns SET max_peer_evaluators = 2 WHERE max_peer_evaluators = 5"
    )

    # =============================================
    # evaluations — nouveaux champs
    # =============================================
    op.add_column('evaluations',
        sa.Column('period', sa.String(20), nullable=True))
    op.add_column('evaluations',
        sa.Column('weighted_score', sa.Numeric(5, 2), nullable=True))


def downgrade():
    op.drop_column('evaluations', 'weighted_score')
    op.drop_column('evaluations', 'period')

    op.drop_column('evaluation_campaigns', 'max_direct_report_evaluators')
    op.drop_column('evaluation_campaigns', 'min_direct_report_evaluators')
    op.drop_column('evaluation_campaigns', 'weight_direct_report')
    op.drop_column('evaluation_campaigns', 'weight_peer')
    op.drop_column('evaluation_campaigns', 'weight_manager')
    op.drop_column('evaluation_campaigns', 'weight_self')
    op.drop_column('evaluation_campaigns', 'quarter')
    op.drop_column('evaluation_campaigns', 'period')
