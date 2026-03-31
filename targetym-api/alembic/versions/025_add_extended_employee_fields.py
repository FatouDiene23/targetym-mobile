"""Add extended employee fields (family, medical, organisation, contract dates)

Revision ID: 025
Revises: 024
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = '025'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade():
    # employee_id string (matricule)
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);")

    # Informations personnelles étendues
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;")

    # Informations professionnelles étendues
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS classification VARCHAR(100);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS coefficient VARCHAR(50);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_end_date DATE;")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;")

    # Informations familiales
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(200);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS spouse_birth_date DATE;")

    # Adresse professionnelle
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_email VARCHAR(255);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_phone VARCHAR(50);")

    # Information médicale
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_disability BOOLEAN DEFAULT FALSE;")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS disability_description TEXT;")

    # Contact d'urgence
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);")

    # Organisation
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS comex_member VARCHAR(200);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS hrbp VARCHAR(200);")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_category VARCHAR(100);")


def downgrade():
    op.drop_column('employees', 'salary_category')
    op.drop_column('employees', 'hrbp')
    op.drop_column('employees', 'comex_member')
    op.drop_column('employees', 'emergency_contact_phone')
    op.drop_column('employees', 'emergency_contact_name')
    op.drop_column('employees', 'disability_description')
    op.drop_column('employees', 'has_disability')
    op.drop_column('employees', 'work_phone')
    op.drop_column('employees', 'work_email')
    op.drop_column('employees', 'spouse_birth_date')
    op.drop_column('employees', 'spouse_name')
    op.drop_column('employees', 'marital_status')
    op.drop_column('employees', 'contract_end_date')
    op.drop_column('employees', 'probation_end_date')
    op.drop_column('employees', 'coefficient')
    op.drop_column('employees', 'classification')
    op.drop_column('employees', 'address')
    op.drop_column('employees', 'nationality')
    op.drop_column('employees', 'employee_id')
