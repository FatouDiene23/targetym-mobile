"""create signature tables

Revision ID: 014
Revises: 013
Create Date: 2026-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '014'
down_revision = '013_create_absence_reports'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUM types safely (idempotent)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE signaturedocumenttype AS ENUM (
                'contrat_travail', 'avenant', 'accord', 'nda',
                'fiche_paie', 'attestation', 'reglement_interieur', 'autre'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE signaturedocumentstatus AS ENUM (
                'draft', 'sent', 'partially_signed', 'fully_signed', 'expired', 'cancelled'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE signaturerequeststatus AS ENUM (
                'pending', 'viewed', 'signed', 'rejected', 'expired'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create signature_documents table
    op.create_table(
        'signature_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column(
            'document_type',
            sa.Enum(
                'contrat_travail', 'avenant', 'accord', 'nda',
                'fiche_paie', 'attestation', 'reglement_interieur', 'autre',
                name='signaturedocumenttype',
                create_type=False
            ),
            nullable=False,
        ),
        sa.Column(
            'status',
            sa.Enum(
                'draft', 'sent', 'partially_signed', 'fully_signed',
                'expired', 'cancelled',
                name='signaturedocumentstatus',
                create_type=False
            ),
            nullable=False,
            server_default='draft',
        ),
        sa.Column('file_data', sa.Text(), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('hash_sha256', sa.String(length=64), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_signature_documents_tenant_id', 'signature_documents', ['tenant_id'])
    op.create_index('ix_signature_documents_status', 'signature_documents', ['status'])
    op.create_index('ix_signature_documents_created_by', 'signature_documents', ['created_by_user_id'])

    # Create signature_requests table
    op.create_table(
        'signature_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column(
            'status',
            sa.Enum(
                'pending', 'viewed', 'signed', 'rejected', 'expired',
                name='signaturerequeststatus',
                create_type=False
            ),
            nullable=False,
            server_default='pending',
        ),
        sa.Column('signature_image_b64', sa.Text(), nullable=True),
        sa.Column('signed_at', sa.DateTime(), nullable=True),
        sa.Column('viewed_at', sa.DateTime(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['document_id'], ['signature_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_signature_requests_tenant_id', 'signature_requests', ['tenant_id'])
    op.create_index('ix_signature_requests_document_id', 'signature_requests', ['document_id'])
    op.create_index('ix_signature_requests_employee_id', 'signature_requests', ['employee_id'])
    op.create_index('ix_signature_requests_status', 'signature_requests', ['status'])


def downgrade() -> None:
    op.drop_index('ix_signature_requests_status', 'signature_requests')
    op.drop_index('ix_signature_requests_employee_id', 'signature_requests')
    op.drop_index('ix_signature_requests_document_id', 'signature_requests')
    op.drop_index('ix_signature_requests_tenant_id', 'signature_requests')
    op.drop_table('signature_requests')

    op.drop_index('ix_signature_documents_created_by', 'signature_documents')
    op.drop_index('ix_signature_documents_status', 'signature_documents')
    op.drop_index('ix_signature_documents_tenant_id', 'signature_documents')
    op.drop_table('signature_documents')

    op.execute('DROP TYPE IF EXISTS signaturerequeststatus')
    op.execute('DROP TYPE IF EXISTS signaturedocumentstatus')
    op.execute('DROP TYPE IF EXISTS signaturedocumenttype')
