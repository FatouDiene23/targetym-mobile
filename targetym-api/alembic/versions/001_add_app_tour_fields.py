"""add app tour tracking fields to users

Revision ID: 001
Revises: 
Create Date: 2026-03-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_add_app_tour_fields'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add app tour tracking fields to users table"""
    # Add columns
    op.add_column('users', 
        sa.Column('has_completed_app_tour', sa.Boolean(), nullable=True, server_default='false')
    )
    op.add_column('users', 
        sa.Column('app_tour_completed_at', sa.DateTime(timezone=True), nullable=True)
    )
    
    # Create index for performance
    op.create_index(
        'idx_users_app_tour_completed', 
        'users', 
        ['has_completed_app_tour'], 
        unique=False
    )


def downgrade() -> None:
    """Remove app tour tracking fields from users table"""
    # Drop index
    op.drop_index('idx_users_app_tour_completed', table_name='users')
    
    # Drop columns
    op.drop_column('users', 'app_tour_completed_at')
    op.drop_column('users', 'has_completed_app_tour')
