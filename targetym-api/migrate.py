#!/usr/bin/env python3
"""
Script pour appliquer les migrations Alembic facilement
Usage: python migrate.py
"""

import sys
import os
from alembic.config import Config
from alembic import command
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

def run_migrations():
    """Execute all pending migrations, stamping any that fail due to objects
    already existing (e.g. ENUMs / tables created by Base.metadata.create_all)."""
    # Change to script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    try:
        alembic_cfg = Config("alembic.ini")

        print("🔍 Vérification des migrations en attente...")
        print("⬆️  Application des migrations...")

        _upgrade_with_stamp_on_duplicate(alembic_cfg)

        print("✅ Migrations appliquées avec succès!")
        return 0

    except Exception as e:
        print(f"❌ Erreur lors de l'application des migrations: {e}")
        print("\n💡 Assurez-vous que:")
        print("   1. La variable DATABASE_URL est définie dans .env")
        print("   2. La base de données est accessible")
        print("   3. Vous êtes dans le bon répertoire")
        return 1


def _upgrade_with_stamp_on_duplicate(alembic_cfg):
    """Run migrations one by one; if a migration fails because an object
    already exists (PostgreSQL error code 42710 / DuplicateObject or 42P07 /
    DuplicateTable), stamp it as applied and continue."""
    import psycopg2

    db_url = alembic_cfg.get_main_option("sqlalchemy.url") or os.environ.get("DATABASE_URL", "")
    engine = create_engine(db_url)

    script = ScriptDirectory.from_config(alembic_cfg)

    with engine.connect() as conn:
        context = MigrationContext.configure(conn)
        current_heads = set(context.get_current_heads())

    # Collect ordered revisions that still need to be applied
    revisions = []
    for rev in script.walk_revisions(base="base", head="heads"):
        revisions.append(rev)
    revisions.reverse()  # oldest first

    for rev in revisions:
        if rev.revision in current_heads:
            continue  # already applied
        # Check if this revision's down_revision is the current head
        # (simple linear chain — good enough for this project)
        try:
            command.upgrade(alembic_cfg, rev.revision)
            print(f"  ✅ Migration {rev.revision} appliquée")
        except Exception as exc:
            # psycopg2 wraps the PG error; check for duplicate_object (42710)
            # or duplicate_table (42P07)
            pg_error = _find_psycopg2_error(exc)
            if pg_error and pg_error.pgcode in ("42710", "42P07", "42701"):
                print(f"  ⚠️  Migration {rev.revision}: objets déjà existants (ENUM/table/colonne), marquée comme appliquée")
                # Stamp this revision so Alembic records it as done
                with engine.connect() as conn:
                    conn.execute(
                        text("INSERT INTO alembic_version (version_num) VALUES (:v) ON CONFLICT DO NOTHING"),
                        {"v": rev.revision}
                    )
                    conn.commit()
                # Update our local set so next revision can depend on this one
                current_heads.add(rev.revision)
            else:
                raise


def _find_psycopg2_error(exc):
    """Walk the exception chain looking for a psycopg2.Error with a pgcode."""
    import psycopg2
    cause = exc
    while cause is not None:
        if isinstance(cause, psycopg2.Error) and getattr(cause, 'pgcode', None):
            return cause
        cause = getattr(cause, '__cause__', None) or getattr(cause, '__context__', None)
        if cause is exc:
            break
    return None

def show_current():
    """Show current migration version"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    try:
        alembic_cfg = Config("alembic.ini")
        command.current(alembic_cfg)
    except Exception as e:
        print(f"❌ Erreur: {e}")

def show_history():
    """Show migration history"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    try:
        alembic_cfg = Config("alembic.ini")
        command.history(alembic_cfg)
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "current":
            show_current()
        elif cmd == "history":
            show_history()
        elif cmd == "upgrade":
            sys.exit(run_migrations())
        else:
            print(f"Commande inconnue: {cmd}")
            print("Usage: python migrate.py [upgrade|current|history]")
            sys.exit(1)
    else:
        # Par défaut, applique les migrations
        sys.exit(run_migrations())
