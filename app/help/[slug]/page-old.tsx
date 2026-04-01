'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Eye, ThumbsUp, ThumbsDown, CheckCircle, XCircle } from 'lucide-react';
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
  helpful_count: number;
  not_helpful_count: number;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'helpful' | 'not_helpful' | null>(null);

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
        
        // Mettre à jour le compteur localement
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/help"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux articles
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>
          
          <div className="flex items-center text-sm text-gray-500 space-x-4">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {new Date(article.created_at).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            <span className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              {article.views_count} vues
            </span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Image de couverture */}
          {article.cover_image_url && (
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full h-64 object-cover rounded-lg mb-6"
            />
          )}

          {/* Vidéo */}
          {article.video_url && (
            <div className="mb-6">
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
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (props) => (
                  <a className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                ),
                img: (props) => (
                  <img className="rounded-lg shadow-sm" {...props} />
                ),
                h1: (props) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                h2: (props) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
                h3: (props) => <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                code: ({ inline, ...props }: any) =>
                  inline ? (
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono" {...props} />
                  ) : (
                    <code className="block bg-gray-100 p-4 rounded my-4 overflow-x-auto font-mono text-sm" {...props} />
                  ),
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          {/* Feedback */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            {!feedbackSent ? (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Cet article vous a-t-il été utile ?
                </h3>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleFeedback(true)}
                    className="flex items-center px-6 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <ThumbsUp className="w-5 h-5 mr-2" />
                    Oui, utile ({article.helpful_count})
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    className="flex items-center px-6 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <ThumbsDown className="w-5 h-5 mr-2" />
                    Non, pas utile ({article.not_helpful_count})
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3 text-green-700 bg-green-50 p-4 rounded-lg">
                <CheckCircle className="w-6 h-6" />
                <span className="font-medium">
                  {feedbackType === 'helpful'
                    ? 'Merci ! Nous sommes ravis que cet article vous ait aidé.'
                    : 'Merci pour votre retour. Nous allons améliorer cet article.'}
                </span>
              </div>
            )}
          </div>

          {/* Contact support si pas utile */}
          {feedbackType === 'not_helpful' && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                Besoin d'aide supplémentaire ?{' '}
                <Link href="/dashboard" className="font-semibold underline">
                  Contactez notre équipe support
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
