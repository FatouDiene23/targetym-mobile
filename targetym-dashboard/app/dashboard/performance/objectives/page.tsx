'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Target, ChevronRight } from 'lucide-react';
import PerformanceStats from '../components/PerformanceStats';
import Header from '@/components/Header';

// =============================================
// API
// =============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

interface MyStats {
  okr_achievement: number;
}

async function fetchMyStats(): Promise<MyStats> {
  try {
    const response = await fetch(`${API_URL}/api/performance/my-stats`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    return response.json();
  } catch {
    return { okr_achievement: 0 };
  }
}

// =============================================
// MAIN PAGE
// =============================================

export default function ObjectivesPage() {
  const router = useRouter();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const statsData = await fetchMyStats();
    setStats(statsData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => router.push('/dashboard/okr');
    window.addEventListener('objectives-add', handler);
    return () => window.removeEventListener('objectives-add', handler);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title="Objectifs & OKRs" subtitle="Gérez vos objectifs et résultats clés" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
      {/* Stats KPIs */}
      <PerformanceStats />

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Link to OKR page */}
        <Link
          href="/dashboard/okr"
          className="flex items-center justify-between p-4 border rounded-xl hover:shadow-md hover:border-primary-300 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-xl group-hover:bg-primary-200 transition-colors">
              <Target className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">OKR & Objectifs</h3>
              <p className="text-sm text-gray-500">Gérer vos objectifs et résultats clés</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
        </Link>
        
        {/* Stats */}
        {stats && (
          <div className="mt-6 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taux d&apos;atteinte des OKRs</p>
                <p className="text-4xl font-bold text-orange-600 mt-1">{stats.okr_achievement}%</p>
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-orange-200 flex items-center justify-center bg-white">
                <span className="text-xl font-bold text-orange-600">{stats.okr_achievement}%</span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-3 bg-orange-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.okr_achievement}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="mt-6 bg-primary-50 border border-primary-200 rounded-lg p-4">
          <p className="text-sm text-primary-800">
            <strong>Conseil :</strong> Définissez des objectifs SMART (Spécifiques, Mesurables, Atteignables, Réalistes, Temporellement définis) pour maximiser vos chances de succès.
          </p>
        </div>
      </div>
      </main>
    </>
  );
}
