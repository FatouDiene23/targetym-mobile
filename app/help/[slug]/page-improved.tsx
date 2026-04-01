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

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

export default function ArticleDetailPage() {
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

  useEffect(() => {
    if (!article) return;

    fetch(`${API_URL}/api/help/categories`)
      .then(res => res.json())
      .then(categories => {
        const cat = categories.find((c: Category) => c.id === article.category_id);
        if (cat) setCategory(cat);

        if (cat) {
          fetch(`${API_URL}/api/help/articles`)
            .then(res => res.json())
            .then((articles: RelatedArticle[]) => {
              const sameCategory = articles.filter(a => a.category_id === article.category_id);
              setAllCategoryArticles(sameCategory);
              const relatedWithoutCurrent = sameCategory.filter(a => a.id !== article.id);
              setRelatedArticles(relatedWithoutCurrent.slice(0, 15));
            });
        }
      });
  }, [article]);

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

  const currentIndex = allCategoryArticles.findIndex(a => a.id === article.id);
  const nextArticle = currentIndex !== -1 && currentIndex < allCategoryArticles.length - 1 ? allCategoryArticles[currentIndex + 1] : null;
  const prevArticle = currentIndex !== -1 && currentIndex > 0 ? allCategoryArticles[currentIndex - 1] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header avec Breadcrumb */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <nav className="flex items-center space-x-2 text-sm">
            <Link href="/help" className="text-gray-500 hover:text-primary-600 transition-colors flex items-center">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            {category && (
              <>
                <Link href="/help" className="text-gray-600 hover:text-primary-600 transition-colors font-medium">
                  {category.name}
                </Link>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </>
            )}
            <span className="text-gray-900 font-semibold truncate max-w-sm">{article.title}</span>
          </nav>
        </div>
      </div>

      {/* Layout 3 colonnes */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar gauche - Articles liés */}
          <aside className="lg:col-span-3">
            <div className="sticky top-4 space-y-4">
              <Link
                href="/help"
                className="inline-flex items-center text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Retour au centre d'aide
              </Link>

              {category && category.name && relatedArticles.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">{category.name}</h3>
                  </div>
                  <nav className="p-3 space-y-0.5">
                    {relatedArticles.map(relArticle => (
                      <Link
                        key={relArticle.id}
                        href={`/help/${relArticle.slug}`}
                        className={`block px-3 py-2.5 text-sm rounded-lg transition-all ${
                          relArticle.slug === slug
                            ? 'bg-primary-600 text-white font-semibold shadow-md'
                            : 'text-gray-700 hover:bg-gray-100 font-medium'
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
            <article className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              {/* En-tête de l'article */}
              <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-indigo-600 px-8 py-10">
                <h1 className="text-4xl font-extrabold text-white mb-4 leading-tight">{article.title}</h1>
                <div className="flex items-center text-sm text-primary-100 space-x-4">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1.5" />
                    <span>Modifié le {new Date(article.updated_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 mr-1.5" />
                    <span>{article.views_count} vues</span>
                  </div>
                </div>
              </div>

              {/* Image de couverture */}
              {article.cover_image_url && (
                <div className="px-8 pt-8">
                  <img
                    src={article.cover_image_url}
                    alt={article.title}
                    className="w-full h-72 object-cover rounded-lg shadow-md"
                  />
                </div>
              )}

              {/* Vidéo */}
              {article.video_url && (
                <div className="px-8 pt-8">
                  <div className="aspect-video">
                    <iframe
                      src={article.video_url}
                      className="w-full h-full rounded-lg shadow-md"
                      allowFullScreen
                      title="Vidéo explicative"
                    />
                  </div>
                </div>
              )}

              {/* Contenu markdown */}
              <div ref={contentRef} className="prose prose-lg max-w-none px-8 py-8">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children, ...props }) => (
                      <h2 className="text-3xl font-bold mt-10 mb-5 text-gray-900 border-b-2 border-gray-200 pb-3" {...props}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children, ...props }) => (
                      <h3 className="text-2xl font-semibold mt-8 mb-4 text-gray-800" {...props}>
                        {children}
                      </h3>
                    ),
                    p: ({ children, ...props }) => (
                      <p className="text-gray-700 leading-relaxed mb-5 text-lg" {...props}>
                        {children}
                      </p>
                    ),
                    a: ({ children, ...props }) => (
                      <a className="text-primary-600 hover:text-primary-700 underline font-medium" target="_blank" rel="noopener noreferrer" {...props}>
                        {children}
                      </a>
                    ),
                    ul: ({ children, ...props }) => (
                      <ul className="list-disc ml-6 space-y-2 mb-5 text-gray-700" {...props}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }) => (
                      <ol className="list-decimal ml-6 space-y-2 mb-5 text-gray-700" {...props}>
                        {children}
                      </ol>
                    ),
                    li: ({ children, ...props }) => (
                      <li className="leading-relaxed" {...props}>
                        {children}
                      </li>
                    ),
                    code: ({ inline, ...props }: any) =>
                      inline ? (
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono text-red-600 font-semibold" {...props} />
                      ) : (
                        <code className="block bg-gray-900 text-gray-100 p-5 rounded-lg my-6 overflow-x-auto font-mono text-sm shadow-inner" {...props} />
                      ),
                    blockquote: ({ children, ...props }) => (
                      <blockquote className="border-l-4 border-primary-500 bg-primary-50 pl-6 py-4 my-6 italic text-gray-700" {...props}>
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {article.content}
                </ReactMarkdown>
              </div>

              {/* Feedback */}
              <div className="border-t-2 border-gray-100 px-8 py-6 bg-gradient-to-r from-gray-50 to-white">
                {!feedbackSent ? (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      Cet article vous a-t-il été utile ?
                    </h3>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handleFeedback(true)}
                        className="flex items-center px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-green-500 hover:bg-green-50 hover:text-green-700 transition-all shadow-sm font-semibold"
                      >
                        <ThumbsUp className="w-5 h-5 mr-2" />
                        Oui
                      </button>
                      <button
                        onClick={() => handleFeedback(false)}
                        className="flex items-center px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-red-500 hover:bg-red-50 hover:text-red-700 transition-all shadow-sm font-semibold"
                      >
                        <ThumbsDown className="w-5 h-5 mr-2" />
                        Non
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 text-green-700 bg-green-100 border border-green-200 p-4 rounded-lg">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-semibold text-lg">
                      Merci pour votre retour !
                    </span>
                  </div>
                )}
              </div>

              {/* Navigation suivant/précédent */}
              {(prevArticle || nextArticle) && (
                <div className="border-t border-gray-200 px-8 py-6 bg-white">
                  <div className="grid grid-cols-2 gap-4">
                    {prevArticle ? (
                      <Link
                        href={`/help/${prevArticle.slug}`}
                        className="group text-left p-5 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all shadow-sm"
                      >
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Précédent</div>
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 line-clamp-2">{prevArticle.title}</div>
                      </Link>
                    ) : (
                      <div></div>
                    )}
                    {nextArticle && (
                      <Link
                        href={`/help/${nextArticle.slug}`}
                        className="group text-right p-5 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all shadow-sm"
                      >
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Suivant</div>
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 line-clamp-2">{nextArticle.title}</div>
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
              <div className="sticky top-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-4 py-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">Table des matières</h3>
                </div>
                <nav className="p-4 space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {toc.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block text-sm py-2 px-3 rounded-lg transition-all ${
                        item.level === 3 ? 'ml-4 text-xs' : 'font-medium'
                      } ${
                        activeSection === item.id
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
