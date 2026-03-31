'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, ChevronRight, CheckCircle, Clock, AlertCircle,
  Star, ThumbsUp, ThumbsDown, MessageSquare, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth, API_URL } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

interface Survey {
  id: number;
  title: string;
  description?: string;
  survey_type: string;
  status: string;
  is_anonymous: boolean;
  frequency: string;
  end_date?: string;
  created_at?: string;
}

interface SurveyQuestion {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: string;
  options?: string[];
  is_required: boolean;
  order_index: number;
}

interface MyResponseData {
  response_id: number;
  status: string;
  answers: { question_id: number; answer_value?: string; answer_text?: string }[];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MySurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  // Respond view
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, { value?: string; text?: string }>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // ── API ─────────────────────────────────────────────────────────────────

  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetchWithAuth(`${API_URL}${path}`, options || {});
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Erreur ${res.status}` }));
      throw new Error(err.detail || `Erreur ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }, []);

  // ── Load my pending surveys ────────────────────────────────────────────

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/surveys/my-surveys');
      setSurveys(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadSurveys(); }, [loadSurveys]);

  // ── Open respond view ──────────────────────────────────────────────────

  const openRespond = useCallback(async (survey: Survey) => {
    setActiveSurvey(survey);
    setCurrentQ(0);
    setAnswers({});
    setSubmitted(false);
    setAlreadyCompleted(false);

    try {
      // Check if already answered
      try {
        const myResp: MyResponseData = await apiFetch(`/api/surveys/${survey.id}/my-response`);
        if (myResp.status === 'completee') {
          setAlreadyCompleted(true);
          return;
        }
      } catch {
        // no response yet, that's ok
      }

      // Load questions
      const qs = await apiFetch(`/api/surveys/${survey.id}/questions`);
      setQuestions(qs);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [apiFetch]);

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!activeSurvey) return;

    // Validate required
    for (const q of questions) {
      if (q.is_required) {
        const a = answers[q.id];
        if (!a?.value && !a?.text) {
          toast.error(`La question "${q.question_text.substring(0, 50)}..." est obligatoire`);
          setCurrentQ(questions.findIndex(qq => qq.id === q.id));
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/surveys/${activeSurvey.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          answers: questions.map(q => ({
            question_id: q.id,
            answer_value: answers[q.id]?.value || null,
            answer_text: answers[q.id]?.text || null,
          })),
        }),
      });
      setSubmitted(true);
      // Remove from list
      setSurveys(prev => prev.filter(s => s.id !== activeSurvey.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const setAnswer = (qId: number, value?: string, text?: string) => {
    setAnswers(prev => ({ ...prev, [qId]: { value: value ?? prev[qId]?.value, text: text ?? prev[qId]?.text } }));
  };

  const renderQuestionInput = (q: SurveyQuestion) => {
    const a = answers[q.id] || {};

    switch (q.question_type) {
      case 'likert_5':
        return (
          <div className="flex items-center gap-2 justify-center py-4">
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                onClick={() => setAnswer(q.id, String(v))}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                  a.value === String(v)
                    ? 'bg-primary-500 text-white scale-110 shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        );

      case 'likert_10':
        return (
          <div className="flex items-center gap-1.5 justify-center py-4 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
              <button
                key={v}
                onClick={() => setAnswer(q.id, String(v))}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  a.value === String(v)
                    ? 'bg-primary-500 text-white scale-110 shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        );

      case 'oui_non':
        return (
          <div className="flex items-center gap-4 justify-center py-4">
            <button
              onClick={() => setAnswer(q.id, 'oui')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                a.value === 'oui' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ThumbsUp className="w-5 h-5" /> Oui
            </button>
            <button
              onClick={() => setAnswer(q.id, 'non')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                a.value === 'non' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ThumbsDown className="w-5 h-5" /> Non
            </button>
          </div>
        );

      case 'choix_multiple':
        return (
          <div className="space-y-2 py-4">
            {(q.options || []).map((opt, i) => (
              <button
                key={i}
                onClick={() => setAnswer(q.id, opt)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                  a.value === opt ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case 'texte_libre':
        return (
          <div className="py-4">
            <textarea
              value={a.text || ''}
              onChange={e => setAnswer(q.id, undefined, e.target.value)}
              rows={4}
              placeholder="Votre réponse..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // ── Respond view ────────────────────────────────────────────────────────

  if (activeSurvey) {
    // Thank you screen
    if (submitted) {
      return (
        <div className="p-6 max-w-lg mx-auto text-center space-y-6 mt-16">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Merci pour votre réponse !</h2>
          <p className="text-gray-500">Votre participation contribue à améliorer l&apos;environnement de travail.</p>
          {activeSurvey.is_anonymous && (
            <p className="text-sm text-purple-600 bg-purple-50 rounded-lg px-4 py-2 inline-block">Vos réponses sont anonymes</p>
          )}
          <button onClick={() => { setActiveSurvey(null); setSubmitted(false); }} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium">
            Retour à mes enquêtes
          </button>
        </div>
      );
    }

    // Already completed
    if (alreadyCompleted) {
      return (
        <div className="p-6 max-w-lg mx-auto text-center space-y-6 mt-16">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Déjà complétée</h2>
          <p className="text-gray-500">Vous avez déjà répondu à cette enquête.</p>
          <button onClick={() => setActiveSurvey(null)} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium">
            Retour
          </button>
        </div>
      );
    }

    // Question by question
    if (questions.length === 0) {
      return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    }

    const q = questions[currentQ];
    const progress = ((currentQ + 1) / questions.length) * 100;

    return (
      <div className="p-6 max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button onClick={() => setActiveSurvey(null)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
            &larr; Retour aux enquêtes
          </button>
          <h1 className="text-xl font-bold text-gray-900">{activeSurvey.title}</h1>
          {activeSurvey.is_anonymous && (
            <p className="text-sm text-purple-600 mt-1">Enquête anonyme — vos réponses ne seront pas associées à votre nom</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Question {currentQ + 1} / {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-2 mb-2">
            <p className="text-lg font-medium text-gray-900">{q.question_text}</p>
            {q.is_required && <span className="text-red-500 text-sm mt-1">*</span>}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {q.question_type === 'likert_5' && 'Évaluez de 1 (pas du tout d\'accord) à 5 (tout à fait d\'accord)'}
            {q.question_type === 'likert_10' && 'Évaluez de 1 à 10'}
            {q.question_type === 'oui_non' && 'Répondez par Oui ou Non'}
            {q.question_type === 'choix_multiple' && 'Sélectionnez une option'}
            {q.question_type === 'texte_libre' && 'Répondez librement'}
          </p>

          {renderQuestionInput(q)}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQ(c => Math.max(0, c - 1))}
            disabled={currentQ === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm disabled:opacity-30"
          >
            Précédent
          </button>

          {currentQ < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(c => c + 1)}
              className="px-5 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Soumettre</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes Enquêtes</h1>
        <p className="text-gray-500 text-sm mt-1">Enquêtes en attente de votre réponse</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : surveys.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-16">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
          <p className="font-medium text-gray-700">Aucune enquête en attente</p>
          <p className="text-sm text-gray-400 mt-1">Vous avez répondu à toutes les enquêtes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-primary-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{s.title}</h3>
                    {s.is_anonymous && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Anonyme</span>
                    )}
                  </div>
                  {s.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {s.end_date ? `Avant le ${new Date(s.end_date).toLocaleDateString('fr-FR')}` : 'Pas de date limite'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openRespond(s)}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1 shrink-0 ml-4"
                >
                  Répondre <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
