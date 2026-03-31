"""
Création des tables pour le centre d'aide

Revision ID: 002_create_help_center
Revises: 001_add_app_tour_fields
Create Date: 2026-03-04 12:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_create_help_center'
down_revision = '001_add_app_tour_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Créer la table help_categories
    op.create_table(
        'help_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_published', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_help_categories_slug'), 'help_categories', ['slug'], unique=True)
    
    # Créer la table help_articles
    op.create_table(
        'help_articles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('excerpt', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('cover_image_url', sa.String(length=500), nullable=True),
        sa.Column('video_url', sa.String(length=500), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('views_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['help_categories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_help_articles_category_id'), 'help_articles', ['category_id'], unique=False)
    op.create_index(op.f('ix_help_articles_slug'), 'help_articles', ['slug'], unique=True)
    
    # Créer la table article_feedbacks
    op.create_table(
        'article_feedbacks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('is_helpful', sa.Boolean(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('user_email', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['article_id'], ['help_articles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_article_feedbacks_article_id'), 'article_feedbacks', ['article_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_article_feedbacks_article_id'), table_name='article_feedbacks')
    op.drop_table('article_feedbacks')
    
    op.drop_index(op.f('ix_help_articles_slug'), table_name='help_articles')
    op.drop_index(op.f('ix_help_articles_category_id'), table_name='help_articles')
    op.drop_table('help_articles')
    
    op.drop_index(op.f('ix_help_categories_slug'), table_name='help_categories')
    op.drop_table('help_categories')
