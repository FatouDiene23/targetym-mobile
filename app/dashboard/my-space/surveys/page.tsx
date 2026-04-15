'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2, ChevronRight, CheckCircle, Clock,
  ThumbsUp, ThumbsDown, MessageSquare, Send, Lock, Edit3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth, API_URL } from '@/lib/api';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';

// ── Types ───────────────────────────────────────────────────────────────────

interface MySurvey {
  id: number;
  title: string;
  description?: string;
  survey_type: string;
  status: string;          // statut de l'enquête (active, cloturee…)
  is_anonymous: boolean;
  frequency: string;
  end_date?: string;
  created_at?: string;
  response_status: string; // statut de la réponse (en_attente, completee)
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
  const { t } = useI18n();
  const ts = t.mySpace.surveys;
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef(false);

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [allSurveys, setAllSurveys] = useState<MySurvey[]>([]);
  const [loading, setLoading] = useState(true);

  // Respond view
  const [activeSurvey, setActiveSurvey] = useState<MySurvey | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, { value?: string; text?: string }>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── API ─────────────────────────────────────────────────────────────────

  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetchWithAuth(`${API_URL}${path}`, options || {});
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `${t.common.error} ${res.status}` }));
      throw new Error(err.detail || `${t.common.error} ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }, []);

  // ── Load all surveys in one call ───────────────────────────────────────

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const data: MySurvey[] = await apiFetch('/api/surveys/my-surveys');
      setAllSurveys(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadSurveys(); }, [loadSurveys]);

  // Derived lists
  const pendingSurveys = allSurveys.filter(s => s.response_status === 'en_attente');
  const completedSurveys = allSurveys.filter(s => s.response_status === 'completee');

  // ── Open respond / edit view ───────────────────────────────────────────

  const openRespond = useCallback(async (survey: MySurvey, editMode = false) => {
    setActiveSurvey(survey);
    setIsEditing(editMode);
    setCurrentQ(0);
    setAnswers({});
    setSubmitted(false);

    try {
      // Load questions
      const qs = await apiFetch(`/api/surveys/${survey.id}/questions`);
      setQuestions(qs);

      // If editing, pre-fill answers
      if (editMode) {
        try {
          const myResp: MyResponseData = await apiFetch(`/api/surveys/${survey.id}/my-response`);
          if (myResp.answers) {
            const prefilled: Record<number, { value?: string; text?: string }> = {};
            for (const a of myResp.answers) {
              prefilled[a.question_id] = { value: a.answer_value || undefined, text: a.answer_text || undefined };
            }
            setAnswers(prefilled);
          }
        } catch {
          // no existing response
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [apiFetch]);

  // ── Deep-link: auto-open survey from ?survey_id= ──────────────────────
  useEffect(() => {
    if (loading || deepLinkHandled.current) return;
    const surveyIdParam = searchParams.get('survey_id');
    if (!surveyIdParam) return;
    const surveyId = Number(surveyIdParam);
    const survey = allSurveys.find(s => s.id === surveyId);
    if (survey) {
      deepLinkHandled.current = true;
      const isCompleted = survey.response_status === 'completee';
      if (isCompleted) setActiveTab('completed');
      openRespond(survey, false);
    }
  }, [loading, allSurveys, searchParams, openRespond]);

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!activeSurvey) return;

    // Validate required
    for (const q of questions) {
      if (q.is_required) {
        const a = answers[q.id];
        if (!a?.value && !a?.text) {
          toast.error(`"${q.question_text.substring(0, 50)}..." ${ts.requiredQuestion}`);
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
      loadSurveys();
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
              <ThumbsUp className="w-5 h-5" /> {ts.yes}
            </button>
            <button
              onClick={() => setAnswer(q.id, 'non')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                a.value === 'non' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ThumbsDown className="w-5 h-5" /> {ts.no}
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
              placeholder={ts.yourAnswer}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // ── Respond / Edit view ─────────────────────────────────────────────────

  if (activeSurvey) {
    const goBack = () => { setActiveSurvey(null); setSubmitted(false); setIsEditing(false); };

    // Thank you screen (after submission)
    if (submitted) {
      return (
        <div className="p-6 max-w-lg mx-auto text-center space-y-6 mt-16">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? ts.responsesUpdated : ts.thankYou}
          </h2>
          <p className="text-gray-500">
            {isEditing ? ts.changesRecorded : ts.contributionMessage}
          </p>
          {activeSurvey.is_anonymous && !isEditing && (
            <p className="text-sm text-purple-600 bg-purple-50 rounded-lg px-4 py-2 inline-block">{ts.anonymousResponses}</p>
          )}
          <button onClick={goBack} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium">
            {ts.backToSurveys}
          </button>
        </div>
      );
    }

    // Already completed — show appropriate message based on survey type
    if (activeSurvey.response_status === 'completee' && !isEditing) {
      // Enquête clôturée
      if (activeSurvey.status === 'cloturee' || activeSurvey.status === 'archivee') {
        return (
          <div className="p-6 max-w-lg mx-auto text-center space-y-6 mt-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{ts.surveyClosed}</h2>
            <p className="text-gray-500">{ts.thankYouParticipation}</p>
            <button onClick={goBack} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium">
              {ts.backToSurveys}
            </button>
          </div>
        );
      }
      // Enquête anonyme — pas de modification possible
      if (activeSurvey.is_anonymous) {
        return (
          <div className="p-6 max-w-lg mx-auto text-center space-y-6 mt-16">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{ts.alreadyAnsweredAnonymous}</h2>
            <p className="text-gray-500">{ts.thankYouParticipation}</p>
            <button onClick={goBack} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium">
              {ts.backToSurveys}
            </button>
          </div>
        );
      }
      // Non-anonyme, active → proposer la modification
      return (
        <div className="p-6 max-w-lg mx-auto text-center space-y-6 mt-16">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{ts.alreadyAnswered}</h2>
          <p className="text-gray-500">{ts.canModify}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={goBack} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              {ts.backToSurveysBtn}
            </button>
            <button onClick={() => openRespond(activeSurvey, true)} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1">
              <Edit3 className="w-4 h-4" /> {ts.editResponses}
            </button>
          </div>
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
          <button onClick={() => { setActiveSurvey(null); setIsEditing(false); }} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
            &larr; {ts.backToSurveys}
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{activeSurvey.title}</h1>
            {isEditing && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{ts.modification}</span>
            )}
          </div>
          {activeSurvey.is_anonymous && !isEditing && (
            <p className="text-sm text-purple-600 mt-1">{ts.anonymousSurveyNotice}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{ts.question} {currentQ + 1} / {questions.length}</span>
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
            {q.question_type === 'likert_5' && ts.likert5Hint}
            {q.question_type === 'likert_10' && ts.likert10Hint}
            {q.question_type === 'oui_non' && ts.yesNoHint}
            {q.question_type === 'choix_multiple' && ts.multipleChoiceHint}
            {q.question_type === 'texte_libre' && ts.freeTextHint}
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
            {ts.previous}
          </button>

          {currentQ < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(c => c + 1)}
              className="px-5 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1"
            >
              {ts.next} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> {isEditing ? ts.update : ts.submit}</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────

  const currentSurveys = activeTab === 'pending' ? pendingSurveys : completedSurveys;

  return (
    <>
    <Header title={ts.title} subtitle={ts.subtitle} />
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-1 border-b-2 text-sm font-medium flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            {ts.pending}
            {pendingSurveys.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingSurveys.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`py-3 px-1 border-b-2 text-sm font-medium flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {ts.completed}
            {completedSurveys.length > 0 && (
              <span className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {completedSurveys.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : currentSurveys.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-16">
          {activeTab === 'pending' ? (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p className="font-medium text-gray-700">{ts.noPending}</p>
              <p className="text-sm text-gray-400 mt-1">{ts.allAnswered}</p>
            </>
          ) : (
            <>
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-700">{ts.noCompleted}</p>
              <p className="text-sm text-gray-400 mt-1">{ts.completedWillAppear}</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentSurveys.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-primary-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900">{s.title}</h3>
                    {activeTab === 'completed' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {ts.completedBadge}
                      </span>
                    )}
                    {s.is_anonymous && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{ts.anonymous}</span>
                    )}
                  </div>
                  {s.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {activeTab === 'pending' && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {s.end_date ? `${ts.beforeDate} ${new Date(s.end_date).toLocaleDateString('fr-FR')}` : ts.noDeadline}
                      </span>
                    )}
                    {activeTab === 'completed' && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {ts.answered}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 ml-4">
                  {activeTab === 'pending' ? (
                    <button
                      onClick={() => openRespond(s)}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium flex items-center gap-1"
                    >
                      {ts.respond} <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    /* Completed tab actions */
                    s.is_anonymous ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-600 border border-green-200">
                        <CheckCircle className="w-3.5 h-3.5" /> {ts.completedAnonymous}
                      </span>
                    ) : s.status === 'cloturee' || s.status === 'archivee' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500">
                        <Lock className="w-3.5 h-3.5" /> {ts.closed}
                      </span>
                    ) : (
                      <button
                        onClick={() => openRespond(s, true)}
                        className="px-4 py-2 border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 text-sm font-medium flex items-center gap-1"
                      >
                        <Edit3 className="w-4 h-4" /> {ts.editResponses}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
