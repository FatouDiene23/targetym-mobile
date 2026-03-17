'use client';

import { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const CATEGORIES = [
  { value: 'general',    label: 'Situation générale',    emoji: '🆘' },
  { value: 'harassment', label: 'Harcèlement',           emoji: '🚫' },
  { value: 'burnout',    label: 'Épuisement (burnout)',  emoji: '😔' },
  { value: 'conflict',   label: 'Conflit',               emoji: '⚡' },
  { value: 'security',   label: 'Sécurité physique',     emoji: '🛡️' },
  { value: 'health',     label: 'Problème de santé',     emoji: '🏥' },
];

export default function SOSButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function handleOpen() {
    setStep('form');
    setCategory('general');
    setMessage('');
    setIsAnonymous(false);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleSubmit() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ category, message: message.trim() || null, is_anonymous: isAnonymous }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      setStep('done');
    } catch {
      toast.error("Impossible d'envoyer l'alerte. Réessayez.");
    } finally {
      setIsLoading(false);
    }
  }

  const selectedCat = CATEGORIES.find(c => c.value === category);

  return (
    <>
      {/* ======= BOUTON FLOTTANT SOS ======= */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold rounded-lg shadow transition-all"
        title="Déclencher une alerte de détresse"
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="hidden sm:inline">SOS</span>
      </button>

      {/* ======= MODAL ======= */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

            {/* Header */}
            <div className="bg-red-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Alerte SOS</h2>
                  <p className="text-xs text-red-100">Votre signal sera transmis immédiatement aux RH</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {step === 'form' && (
              <div className="p-6 space-y-5">
                {/* Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Type de situation</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                          category === cat.value
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <span className="text-base">{cat.emoji}</span>
                        <span className="text-xs font-medium leading-tight">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Message <span className="text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none resize-none"
                    placeholder="Décrivez brièvement la situation si vous le souhaitez…"
                    maxLength={500}
                  />
                  {message.length > 0 && (
                    <p className="text-right text-xs text-gray-400 mt-0.5">{message.length}/500</p>
                  )}
                </div>

                {/* Anonymat */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={e => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-500"
                  />
                  <span className="text-sm text-gray-700">Envoyer de façon anonyme</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={handleClose} className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
                    Annuler
                  </button>
                  <button onClick={() => setStep('confirm')} className="flex-1 px-4 py-2.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4" />Envoyer l&apos;alerte
                  </button>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <div className="p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Confirmer l&apos;alerte ?</h3>
                  <p className="text-sm text-gray-500">
                    L&apos;équipe RH et la direction vont être notifiées immédiatement.
                    {isAnonymous && ' Votre identité restera anonyme.'}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
                    <span>{selectedCat?.emoji}</span>
                    <span>{selectedCat?.label}</span>
                  </div>
                  {message && (
                    <p className="mt-2 text-xs text-gray-500 italic">&ldquo;{message.slice(0, 80)}{message.length > 80 ? '…' : ''}&rdquo;</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep('form')} className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium">
                    Modifier
                  </button>
                  <button onClick={handleSubmit} disabled={isLoading} className="flex-1 px-4 py-2.5 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    Confirmer
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <span className="text-3xl">✅</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Alerte envoyée</h3>
                  <p className="text-sm text-gray-500">
                    L&apos;équipe RH a été notifiée et traitera votre situation rapidement.
                    {isAnonymous && ' Votre anonymat est préservé.'}
                  </p>
                </div>
                <button onClick={handleClose} className="w-full px-4 py-2.5 text-sm text-white bg-primary-500 hover:bg-primary-600 rounded-xl font-medium">
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
