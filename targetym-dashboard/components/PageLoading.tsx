'use client';

/**
 * PageLoading — spinner léger affiché pendant le chargement des données d'une page.
 * Remplace les `if (loading) return null` qui causaient un flash blanc sur chaque navigation.
 */
export default function PageLoading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
