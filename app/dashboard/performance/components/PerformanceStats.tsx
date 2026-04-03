'use client';

import { useState, useEffect } from 'react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

interface MyStats {
  scope: string;
  avg_score: number;
  evaluations_total: number;
  evaluations_completed: number;
  completion_rate: number;
  feedbacks_received: number;
  feedbacks_given: number;
  one_on_ones_scheduled: number;
  one_on_ones_completed: number;
  okr_achievement: number;
}

export default function PerformanceStats() {
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch(`${API_URL}/api/performance/my-stats`, { headers: getAuthHeaders() });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch {
        // Silently fail
      }
    }
    loadStats();
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Score Moyen</p>
        <p className="text-2xl font-bold text-gray-900">{stats.avg_score > 0 ? `${stats.avg_score}/5` : '-'}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Évaluations</p>
        <p className="text-2xl font-bold text-green-600">{stats.evaluations_completed}/{stats.evaluations_total}</p>
        <p className="text-xs text-gray-400">{stats.evaluations_total > 0 ? `${Math.round(stats.completion_rate)}%` : ''}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Feedbacks Reçus</p>
        <p className="text-2xl font-bold text-purple-600">{stats.feedbacks_received}</p>
        <p className="text-xs text-gray-400">{stats.feedbacks_given} donnés</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">OKRs</p>
        <p className="text-2xl font-bold text-orange-600">{stats.okr_achievement}%</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">1-on-1</p>
        <p className="text-2xl font-bold text-primary-600">{stats.one_on_ones_scheduled}</p>
        <p className="text-xs text-gray-400">{stats.one_on_ones_completed} complétés</p>
      </div>
    </div>
  );
}
