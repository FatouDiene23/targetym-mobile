from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Import your models
from app.core.database import Base
from app.core.config import settings
from app.models.user import User
from app.models.employee import Employee
from app.models.tenant import Tenant
from app.models.support_audit_log import SupportAuditLog
from app.models.benefit import EmployeeBenefit
from app.models.sos_alert import SOSAlert
from app.models.absence_report import AbsenceReport
from app.models.signature import SignatureDocument, SignatureRequest
from app.models.training_provider import TrainingProvider
from app.models.training_plans import TrainingPlan
from app.models.training_needs import TrainingNeed
from app.models.training_plan_actions import TrainingPlanAction
from app.models.training_schedule import TrainingSchedule
from app.models.training_assignments import TrainingAssignment
from app.models.training_plan_subsidiaries import TrainingPlanSubsidiary
from app.models.learning import Course  # pour les nouvelles colonnes unit_cost, billing_mode
from app.models.blog import BlogPost
from app.models.resource import ResourceCategory, Resource
# Add all your models here

# this is the Alembic Config object
config = context.config

# Override sqlalchemy.url with the one from settings
config.set_main_option('sqlalchemy.url', settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
