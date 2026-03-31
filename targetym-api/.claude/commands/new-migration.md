Créer une nouvelle migration Alembic en respectant :
1. Lire CLAUDE.md pour connaître les règles du projet
2. Vérifier le modèle SQLAlchemy concerné dans app/models/
3. Créer la migration avec : alembic revision --autogenerate -m "description"
4. Vérifier le fichier généré dans alembic/versions/
5. S'assurer que upgrade() et downgrade() sont corrects
6. Ne jamais modifier une migration déjà appliquée en production

Migration à créer : $ARGUMENTS
