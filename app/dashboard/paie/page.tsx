'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Loader2, Users, Banknote, Calendar, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import {
  getRuns, formatXOF, MONTHS_FR,
  type PayrollRun,
} from '@/lib/payrollApi';
import { fetchWithAuth, API_URL } from '@/lib/api';

const PAIE_APP_URL = process.env.NEXT_PUBLIC_PAIE_URL ?? 'https://paie.targetym.ai';

export default function PaieIndexPage() {
  const [lastRun, setLastRun] = useState<PayrollRun | null>(null);
  const [loadingRun, setLoadingRun] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    getRuns()
      .then(({ items }) => {
        // Le backend renvoie les runs triés par date desc — on prend le premier
        setLastRun(items[0] ?? null);
      })
      .catch(() => setLastRun(null))
      .finally(() => setLoadingRun(false));
  }, []);

  const handleOpenPaie = async () => {
    setRedirecting(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/auth/paie-token`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Impossible de générer le token paie');
      const { token } = await res.json();
      window.location.href = `${PAIE_APP_URL}/auth/exchange?token=${encodeURIComponent(token)}`;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion au module paie');
      setRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Module Paie" />

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Carte résumé dernier run */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Dernier run de paie
          </h2>

          {loadingRun ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement…
            </div>
          ) : lastRun ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Période</p>
                  <p className="font-semibold text-gray-800">
                    {MONTHS_FR[lastRun.period_month - 1]} {lastRun.period_year}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-50 text-green-600">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Masse salariale nette</p>
                  <p className="font-semibold text-gray-800">
                    {formatXOF(lastRun.total_net)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Employés traités</p>
                  <p className="font-semibold text-gray-800">
                    {lastRun.employee_count ?? '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              Aucun run de paie trouvé.
            </div>
          )}
        </div>

        {/* Bouton d'accès */}
        <div className="text-center">
          <button
            onClick={handleOpenPaie}
            disabled={redirecting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 transition disabled:opacity-60"
          >
            {redirecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            {redirecting ? 'Connexion en cours…' : 'Accéder au module Paie'}
          </button>
          <p className="mt-2 text-xs text-gray-400">
            Vous serez redirigé vers <span className="font-mono">paie.targetym.ai</span>
          </p>
        </div>
      </div>
    </div>
  );
}

