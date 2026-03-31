-- ============================================
-- MIGRATION: Tour Applicatif
-- Date: 2026-03-02
-- Description: Ajout des champs pour tracker le guide applicatif des utilisateurs
-- ============================================

-- 1. Ajout des colonnes
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_completed_app_tour BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS app_tour_completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_users_app_tour_completed 
ON users(has_completed_app_tour);

-- 3. Commentaires sur les colonnes (optionnel, pour documentation)
COMMENT ON COLUMN users.has_completed_app_tour IS 'Indique si l''utilisateur a terminé le tour applicatif guidé';
COMMENT ON COLUMN users.app_tour_completed_at IS 'Date et heure de complétion du tour applicatif';

-- 4. (OPTIONNEL) Marquer les utilisateurs existants comme ayant déjà vu le tour
--    Décommentez la ligne suivante si vous ne voulez pas montrer le tour aux utilisateurs actuels
--    (seulement aux NOUVEAUX utilisateurs créés après cette migration)
-- UPDATE users SET has_completed_app_tour = TRUE WHERE created_at < NOW();

-- 5. Vérification de la migration
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE has_completed_app_tour = TRUE) as users_completed_tour,
  COUNT(*) FILTER (WHERE has_completed_app_tour = FALSE OR has_completed_app_tour IS NULL) as users_not_completed_tour
FROM users;

-- ============================================
-- ROLLBACK (si besoin d'annuler la migration)
-- ============================================
-- DROP INDEX IF EXISTS idx_users_app_tour_completed;
-- ALTER TABLE users DROP COLUMN IF EXISTS app_tour_completed_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS has_completed_app_tour;
