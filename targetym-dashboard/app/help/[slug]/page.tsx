// Server component — exporte generateStaticParams pour l'export statique (Capacitor)
// La logique UI est dans ArticleDetailClient.tsx
import ArticleDetailClient from './ArticleDetailClient';

// Ne pas générer d'erreur 404 pour les slugs non pré-générés
export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';
    const res = await fetch(`${API_URL}/api/help/articles`);
    if (!res.ok) return [{ slug: 'placeholder' }];
    const articles = await res.json();
    if (!articles.length) return [{ slug: 'placeholder' }];
    return articles.map((article: { slug: string }) => ({ slug: article.slug }));
  } catch {
    // API inaccessible au moment du build → générer un slug placeholder
    return [{ slug: 'placeholder' }];
  }
}

export default function Page() {
  return <ArticleDetailClient />;
}
