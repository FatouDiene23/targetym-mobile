"""Make blog_posts.tenant_id nullable for superadmin platform posts

Revision ID: 030
Revises: 029
Create Date: 2026-03-28

"""
from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "blog_posts",
        "tenant_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    # Set NULL rows to a default before restoring NOT NULL
    op.execute("UPDATE blog_posts SET tenant_id = 0 WHERE tenant_id IS NULL")
    op.alter_column(
        "blog_posts",
        "tenant_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
