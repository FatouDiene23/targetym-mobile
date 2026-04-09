'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChatMessageContentProps {
  content: string;
  isUser: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ChatMessageContent({ content, isUser }: Readonly<ChatMessageContentProps>) {
  // Parser le contenu pour détecter les blocs spéciaux
  const { textContent, charts } = useMemo(() => {
    let text = content;
    const detectedCharts: Array<{ type: string; data: any; title?: string }> = [];

    // Détecter les blocs de graphiques: ```chart-bar ou ```chart-line ou ```chart-pie
    const chartRegex = /```chart-(bar|line|pie)\n([\s\S]*?)```/g;
    text = text.replaceAll(chartRegex, (match, chartType, chartData) => {
      try {
        const data = JSON.parse(chartData.trim());
        // Vérifier que les données sont valides (array non vide)
        if (Array.isArray(data) && data.length > 0) {
          detectedCharts.push({ type: chartType, data });
          // Marque invisible pour savoir où afficher le graphique
          return `%%CHART_${detectedCharts.length - 1}%%`;
        }
        // Si données invalides/vides, supprimer complètement le bloc
        return '';
      } catch {
        // Si parsing échoue, supprimer le bloc (ne pas laisser le code raw)
        return '';
      }
    });

    return { textContent: text, charts: detectedCharts };
  }, [content]);

  const renderChart = (chart: { type: string; data: any; title?: string }, index: number) => {
    const { type, data } = chart;

    if (!Array.isArray(data) || data.length === 0) return null;

    return (
      <div key={index} className="my-4 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        {chart.title && (
          <h4 className="text-sm font-semibold text-gray-900 mb-3">{chart.title}</h4>
        )}
        <ResponsiveContainer width="100%" height={300}>
          {type === 'bar' && (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {Object.keys(data[0] || {})
                .filter(key => key !== 'name')
                .map((key, i) => (
                  <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
                ))}
            </BarChart>
          )}
          {type === 'line' && (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {Object.keys(data[0] || {})
                .filter(key => key !== 'name')
                .map((key, i) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} />
                ))}
            </LineChart>
          )}
          {type === 'pie' && (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${entry.name || entry.value || index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  if (isUser) {
    // Messages utilisateur: texte simple
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className="text-sm">
      {/* Contenu markdown avec placeholders de graphiques */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Personnaliser le style des tableaux
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 border border-gray-300 rounded-lg" {...props} />
            </div>
          ),
          thead: (props) => (
            <thead className="bg-gray-50" {...props} />
          ),
          th: (props) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-b border-gray-300" {...props} />
          ),
          td: (props) => (
            <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-200" {...props} />
          ),
          // Listes
          ul: (props) => (
            <ul className="list-disc list-inside my-2 space-y-1" {...props} />
          ),
          ol: (props) => (
            <ol className="list-decimal list-inside my-2 space-y-1" {...props} />
          ),
          // Titres
          h1: (props) => (
            <h1 className="text-lg font-bold mt-4 mb-2 text-gray-900" {...props} />
          ),
          h2: (props) => (
            <h2 className="text-base font-bold mt-3 mb-2 text-gray-900" {...props} />
          ),
          h3: (props) => (
            <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-900" {...props} />
          ),
          // Paragraphes - Injecter les graphiques inline quand placeholder détecté
          p: ({ children, ...props }: any) => {
            const text = String(children || '');
            const chartMatch = text.match(/%%CHART_(\d+)%%/);
            if (chartMatch) {
              const chartIndex = parseInt(chartMatch[1]);
              const chart = charts[chartIndex];
              if (chart) {
                return renderChart(chart, chartIndex);
              }
              // Si chart introuvable, ne rien afficher
              return null;
            }
            return <p className="my-1.5 leading-relaxed" {...props}>{children}</p>;
          },
          // Code blocks
          code: ({ inline, ...props }: any) =>
            inline ? (
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800" {...props} />
            ) : (
              <code className="block bg-gray-100 p-3 rounded my-2 text-xs font-mono overflow-x-auto" {...props} />
            ),
          // Liens
          a: (props) => (
            <a className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          // Blocs de citation
          blockquote: (props) => (
            <blockquote className="border-l-4 border-primary-500 pl-4 my-2 italic text-gray-700" {...props} />
          ),
          // Strong/Bold
          strong: (props) => (
            <strong className="font-semibold text-gray-900" {...props} />
          ),
          // Emphasis/Italic
          em: (props) => (
            <em className="italic" {...props} />
          )
        }}
      >
        {textContent}
      </ReactMarkdown>
    </div>
  );
}
