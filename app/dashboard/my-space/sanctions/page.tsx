'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  AlertTriangle, Calendar, Loader2, Shield, FileText
} from 'lucide-react';

const API_URL = 'https://api.targetym.ai';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}
function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return { Authorization: token ? `Bearer ${token}` : '' };
}
async function apiFetch(url: string) {
  const res = await fetch(`${API_URL}${url}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

interface SanctionItem {
  id: number;
  type: string;
  date: string;
  reason: string;
  notes: string | null;
  status: string;
  issued_by: string | null;
  created_at: string | null;
}

const SANCTION_TYPES: Record<string, { icon: string; color: string }> = {
  'Avertissement':    { icon: '\u26a0\ufe0f', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'Bl\u00e2me':              { icon: '\ud83d\udccb', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'Mise \u00e0 pied':       { icon: '\ud83d\udeab', color: 'bg-red-100 text-red-800 border-red-200' },
  'R\u00e9trogradation':    { icon: '\u2b07\ufe0f', color: 'bg-red-100 text-red-800 border-red-200' },
  'Licenciement':     { icon: '\u274c', color: 'bg-red-200 text-red-900 border-red-300' },
  'Rappel \u00e0 l\'ordre': { icon: '\ud83d\udcdd', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Autre':            { icon: '\ud83d\udcc4', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

export default function MySanctionsPage() {
  const [sanctions, setSanctions] = useState<SanctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSanctions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/sanctions');
      setSanctions(data.items || []);
    } catch {
      setSanctions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSanctions(); }, [loadSanctions]);

  return (
    <>
      <Header title="Mes Sanctions" />
      <main className="p-6 max-w-4xl mx-auto">
        {/* Info banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-3">
          <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Dossier disciplinaire</p>
            <p className="mt-1 text-blue-600">
              Cette page affiche l&apos;historique de vos sanctions disciplinaires.
              Si vous souhaitez contester une sanction, veuillez contacter le service RH.
            </p>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : sanctions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700">Aucune sanction</h3>
            <p className="text-sm text-gray-400 mt-1">Votre dossier disciplinaire est vierge.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <span className="text-2xl font-bold text-gray-900">{sanctions.length}</span>
                <span className="text-sm text-gray-500 ml-2">sanction{sanctions.length > 1 ? 's' : ''} enregistrée{sanctions.length > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* List */}
            {sanctions.map((s) => {
              const typeInfo = SANCTION_TYPES[s.type] || SANCTION_TYPES['Autre'];
              return (
                <div key={s.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${typeInfo.color}`}>
                          <span>{typeInfo.icon}</span>
                          {s.type}
                        </span>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 font-medium">{s.reason}</p>
                      {s.notes && (
                        <p className="text-xs text-gray-500 mt-2 italic">{s.notes}</p>
                      )}
                    </div>
                  </div>
                  {s.issued_by && (
                    <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                      Émise par : {s.issued_by}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
