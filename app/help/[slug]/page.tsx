'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, Eye, ThumbsUp, ThumbsDown, CheckCircle, XCircle, ChevronRight, Home } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ArticleDetail {
  id: number;
  category_id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  video_url: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
  helpful_count: number;
  not_helpful_count: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface RelatedArticle {
  id: number;
  category_id: number;
  title: string;
  slug: string;
  excerpt: string | null;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

export default function ArticleDetailPageKartra() {
  const params = useParams();
  const slug = params?.slug as string;
  const contentRef = useRef<HTMLDivElement>(null);

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [allCategoryArticles, setAllCategoryArticles] = useState<RelatedArticle[]>([]);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'helpful' | 'not_helpful' | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');

  // Charger l'article
  useEffect(() => {
    if (!slug) return;

    fetch(`${API_URL}/api/help/articles/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Article non trouvé');
        return res.json();
      })
      .then(data => {
        setArticle(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erreur chargement article:', err);
        setLoading(false);
      });
  }, [slug]);

  // Charger la catégorie et articles liés
  useEffect(() => {
    if (!article) return;

    // Charger la catégorie
    fetch(`${API_URL}/api/help/categories`)
      .then(res => res.json())
      .then(categories => {
        const cat = categories.find((c: Category) => c.id === article.category_id);
        if (cat) setCategory(cat);

        // Charger les articles de la même catégorie
        if (cat) {
          fetch(`${API_URL}/api/help/articles`)
            .then(res => res.json())
            .then((articles: RelatedArticle[]) => {
              const sameCategory = articles.filter(a => a.category_id === article.category_id);
              
              // Tous les articles de la catégorie (pour navigation prev/next)
              setAllCategoryArticles(sameCategory);
              
              // Articles liés sans l'article actuel (pour sidebar)
              const relatedWithoutCurrent = sameCategory.filter(a => a.id !== article.id);
              setRelatedArticles(relatedWithoutCurrent.slice(0, 15));
            });
        }
      });
  }, [article]);

  // Générer la table des matières
  useEffect(() => {
    if (!article || !contentRef.current) return;

    const headings = contentRef.current.querySelectorAll('h2, h3');
    const tocItems: TocItem[] = [];

    headings.forEach((heading, index) => {
      const id = `heading-${index}`;
      heading.id = id;
      tocItems.push({
        id,
        text: heading.textContent || '',
        level: parseInt(heading.tagName.charAt(1))
      });
    });

    setToc(tocItems);
  }, [article]);

  // Observer pour l'active section
  useEffect(() => {
    if (toc.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    toc.forEach(item => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [toc]);

  const handleFeedback = async (isHelpful: boolean) => {
    if (!article || feedbackSent) return;

    try {
      const res = await fetch(`${API_URL}/api/help/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          is_helpful: isHelpful
        })
      });

      if (res.ok) {
        setFeedbackSent(true);
        setFeedbackType(isHelpful ? 'helpful' : 'not_helpful');
        
        setArticle(prev => prev ? {
          ...prev,
          helpful_count: isHelpful ? prev.helpful_count + 1 : prev.helpful_count,
          not_helpful_count: !isHelpful ? prev.not_helpful_count + 1 : prev.not_helpful_count
        } : null);
      }
    } catch (err) {
      console.error('Erreur envoi feedback:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de l'article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Article non trouvé</h1>
          <p className="text-gray-600 mb-6">Cet article n'existe pas ou a été supprimé.</p>
          <Link
            href="/help"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au centre d'aide
          </Link>
        </div>
      </div>
    );
  }

  // Calculer les articles précédent/suivant
  const currentIndex = allCategoryArticles.findIndex(a => a.id === article.id);
  const nextArticle = currentIndex !== -1 && currentIndex < allCategoryArticles.length - 1 ? allCategoryArticles[currentIndex + 1] : null;
  const prevArticle = currentIndex !== -1 && currentIndex > 0 ? allCategoryArticles[currentIndex - 1] : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header avec Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <Link href="/help" className="hover:text-primary-600 flex items-center">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-4 h-4" />
            {category && (
              <>
                <Link href="/help" className="hover:text-primary-600">
                  {category.name}
                </Link>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
            <span className="text-gray-900 font-medium truncate">{article.title}</span>
          </nav>
        </div>
      </div>

      {/* Layout 3 colonnes */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar gauche - Catégories et articles */}
          <aside className="lg:col-span-3">
            <div className="sticky top-4">
              <Link
                href="/help"
                className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Retour au centre d'aide
              </Link>

              {category && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{category.name}</h3>
                  <nav className="space-y-1">
                    {relatedArticles.map(relArticle => (
                      <Link
                        key={relArticle.id}
                        href={`/help/${relArticle.slug}`}
                        className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                          relArticle.slug === slug
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        {relArticle.title}
                      </Link>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </aside>

          {/* Contenu principal */}
          <main className="lg:col-span-6">
            <article>
              {/* Titre et métadonnées */}
              <header className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{article.title}</h1>
                <div className="flex items-center text-sm text-gray-500 space-x-4">
                  <span>Modifié le {new Date(article.updated_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
              </header>

              {/* Image de couverture */}
              {article.cover_image_url && (
                <img
                  src={article.cover_image_url}
                  alt={article.title}
                  className="w-full h-64 object-cover rounded-lg mb-8"
                />
              )}

              {/* Vidéo */}
              {article.video_url && (
                <div className="mb-8">
                  <div className="aspect-video">
                    <iframe
                      src={article.video_url}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                      title="Vidéo explicative"
                    />
                  </div>
                </div>
              )}

              {/* Contenu de l'article */}
              <div ref={contentRef} className="prose prose-lg max-w-none mb-12">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children, ...props }) => (
                      <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900" {...props}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children, ...props }) => (
                      <h3 className="text-xl font-semibold mt-6 mb-3 text-gray-900" {...props}>
                        {children}
                      </h3>
                    ),
                    p: ({ children, ...props }) => (
                      <p className="text-gray-700 leading-relaxed mb-4" {...props}>
                        {children}
                      </p>
                    ),
                    a: ({ children, ...props }) => (
                      <a className="text-primary-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props}>
                        {children}
                      </a>
                    ),
                    ul: ({ children, ...props }) => (
                      <ul className="list-disc list-inside space-y-2 mb-4" {...props}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }) => (
                      <ol className="list-decimal list-inside space-y-2 mb-4" {...props}>
                        {children}
                      </ol>
                    ),
                    code: ({ inline, ...props }: any) =>
                      inline ? (
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props} />
                      ) : (
                        <code className="block bg-gray-900 text-gray-100 p-4 rounded my-4 overflow-x-auto font-mono text-sm" {...props} />
                      ),
                  }}
                >
                  {article.content}
                </ReactMarkdown>
              </div>

              {/* Feedback */}
              <div className="border-t border-gray-200 pt-8 mb-8">
                {!feedbackSent ? (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Cet article vous a-t-il été utile ?
                    </h3>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handleFeedback(true)}
                        className="flex items-center px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
                      >
                        <ThumbsUp className="w-5 h-5 mr-2" />
                        Oui
                      </button>
                      <button
                        onClick={() => handleFeedback(false)}
                        className="flex items-center px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all"
                      >
                        <ThumbsDown className="w-5 h-5 mr-2" />
                        Non
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 text-green-700 bg-green-50 p-4 rounded-lg">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-medium">
                      Merci pour votre retour !
                    </span>
                  </div>
                )}
              </div>

              {/* Navigation suivant/précédent */}
              {(prevArticle || nextArticle) && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    {prevArticle ? (
                      <Link
                        href={`/help/${prevArticle.slug}`}
                        className="text-left p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all"
                      >
                        <div className="text-xs text-gray-500 mb-1">Précédent</div>
                        <div className="text-sm font-medium text-gray-900">{prevArticle.title}</div>
                      </Link>
                    ) : (
                      <div></div>
                    )}
                    {nextArticle && (
                      <Link
                        href={`/help/${nextArticle.slug}`}
                        className="text-right p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all"
                      >
                        <div className="text-xs text-gray-500 mb-1">Suivant</div>
                        <div className="text-sm font-medium text-gray-900">{nextArticle.title}</div>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </article>
          </main>

          {/* Sidebar droite - Table des matières */}
          <aside className="lg:col-span-3">
            {toc.length > 0 && (
              <div className="sticky top-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Table des matières</h3>
                <nav className="space-y-2">
                  {toc.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block text-sm transition-colors ${
                        item.level === 3 ? 'pl-4' : ''
                      } ${
                        activeSection === item.id
                          ? 'text-primary-600 font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
