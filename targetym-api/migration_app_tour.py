"""
Migration: Ajout des champs pour le tour applicatif dans la table users
Date: 2026-03-02
Description: Ajoute has_completed_app_tour et app_tour_completed_at pour tracker le guide applicatif
"""

# Migration SQL à exécuter manuellement ou via Alembic

migration_sql = """
-- Ajout des colonnes pour le tour applicatif
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_completed_app_tour BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS app_tour_completed_at TIMESTAMP WITH TIME ZONE;

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_users_app_tour_completed 
ON users(has_completed_app_tour);

-- Mettre à jour les utilisateurs existants (optionnel: marquer comme complété pour éviter d'embêter les anciens users)
-- Décommentez la ligne suivante si vous voulez que seuls les NOUVEAUX utilisateurs voient le tour
-- UPDATE users SET has_completed_app_tour = TRUE WHERE created_at < NOW();

-- Vérification
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE has_completed_app_tour = TRUE) as users_completed_tour,
  COUNT(*) FILTER (WHERE has_completed_app_tour = FALSE) as users_not_completed_tour
FROM users;
"""

# Si vous utilisez Alembic, créez une révision avec cette commande:
# alembic revision -m "add_app_tour_fields_to_users"

# Puis dans le fichier de migration généré, utilisez:
alembic_upgrade = """
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # Ajouter les colonnes
    op.add_column('users', sa.Column('has_completed_app_tour', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('users', sa.Column('app_tour_completed_at', sa.DateTime(timezone=True), nullable=True))
    
    # Créer l'index
    op.create_index('idx_users_app_tour_completed', 'users', ['has_completed_app_tour'], unique=False)

def downgrade():
    # Supprimer l'index
    op.drop_index('idx_users_app_tour_completed', table_name='users')
    
    # Supprimer les colonnes
    op.drop_column('users', 'app_tour_completed_at')
    op.drop_column('users', 'has_completed_app_tour')
"""

if __name__ == "__main__":
    print("=" * 80)
    print("MIGRATION SQL - Tour Applicatif")
    print("=" * 80)
    print("\n📝 À exécuter dans votre base de données PostgreSQL:\n")
    print(migration_sql)
    print("\n" + "=" * 80)
    print("📚 Pour Alembic (si utilisé):")
    print("=" * 80)
    print(alembic_upgrade)
