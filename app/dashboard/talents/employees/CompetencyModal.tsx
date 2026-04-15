'use client';

// ============================================
// CompetencyModal — Profil compétences d'un employé
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  X, Brain, TrendingUp, Heart, BookOpen, RefreshCw,
  ChevronDown, ChevronUp, Lightbulb, AlertCircle,
} from 'lucide-react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const raw = document.cookie.split('; ').find(r => r.startsWith('auth_token='));
  const token = raw
    ? raw.split('=')[1]
    : (localStorage.getItem('access_token') ?? localStorage.getItem('auth_token') ?? '');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface SkillScore {
  skill_id: number;
  skill_name: string;
  skill_type: string;
  current_level: number;
  target_level: number;
  formations_score: number;
  performance_score: number;
  attitude_score: number;
  global_score: number;
  remaining_courses: string[];
  recommendation: string;
  last_computed_at: string | null;
}

interface CompetencyProfile {
  employee_id: number;
  overall_score: number;
  skills: SkillScore[];
  last_computed_at: string | null;
}

const SCORE_COLOR = (v: number) =>
  v >= 75 ? 'text-green-600' : v >= 45 ? 'text-amber-600' : 'text-red-500';

const BAR_COLOR = (v: number) =>
  v >= 75 ? 'bg-green-500' : v >= 45 ? 'bg-amber-500' : 'bg-red-400';

const SKILL_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  soft_skill:  { label: 'Soft Skill',  color: 'bg-purple-100 text-purple-700' },
  technical:   { label: 'Technique',   color: 'bg-blue-100 text-blue-700' },
  management:  { label: 'Management',  color: 'bg-green-100 text-green-700' },
};

function MiniBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${BAR_COLOR(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${SCORE_COLOR(pct)}`}>{pct}%</span>
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillScore }) {
  const [open, setOpen] = useState(false);
  const tc = SKILL_TYPE_LABEL[skill.skill_type ?? 'soft_skill'] ?? SKILL_TYPE_LABEL['soft_skill'];

  return (
    <div className="border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50/60 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        {/* Radial-like circle */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={skill.global_score >= 75 ? '#22c55e' : skill.global_score >= 45 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3"
              strokeDasharray={`${(skill.global_score / 100) * 94.2} 94.2`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
            {skill.global_score}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-medium text-gray-800 truncate">{skill.skill_name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${tc.color}`}>
              {tc.label}
            </span>
          </div>
          <MiniBar value={skill.global_score} />
        </div>

        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/40">
          {/* 3 sub-scores */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Formations', value: skill.formations_score, icon: BookOpen, color: 'text-primary-500' },
              { label: 'Performance', value: skill.performance_score, icon: TrendingUp, color: 'text-indigo-500' },
              { label: 'Attitude',  value: skill.attitude_score, icon: Heart, color: 'text-rose-500' },
            ].map(({ label, value, icon: Ic, color }) => (
              <div key={label} className="bg-white rounded-lg p-3 border border-gray-100 text-center">
                <Ic className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <p className={`text-lg font-bold ${SCORE_COLOR(value)}`}>{value}%</p>
                <p className="text-[10px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          {/* Weight explanation */}
          <p className="text-[10px] text-gray-400 text-center">
            Score global = 40% formations + 40% performance + 20% attitude
          </p>

          {/* Remaining courses */}
          {skill.remaining_courses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Formations restantes ({skill.remaining_courses.length})
              </p>
              <ul className="space-y-1">
                {skill.remaining_courses.map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {skill.recommendation && (
            <div className="flex gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
              <Lightbulb className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800">{skill.recommendation}</p>
            </div>
          )}

          {/* Level progress */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Niveau actuel: <b className="text-gray-700">{skill.current_level}%</b></span>
            <span>→</span>
            <span>Objectif: <b className="text-gray-700">{skill.target_level}%</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
}

export default function CompetencyModal({ employeeId, employeeName, onClose }: Props) {
  const [profile, setProfile] = useState<CompetencyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/learning/employees/${employeeId}/competency-profile`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) setProfile(await res.json());
      else if (res.status === 404) setProfile({ employee_id: employeeId, overall_score: 0, skills: [], last_computed_at: null });
      else setError('Impossible de charger le profil.');
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  }, [employeeId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      const res = await fetch(`${API_URL}/api/learning/employees/${employeeId}/skills/compute`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (res.ok) { await loadProfile(); }
      else setError('Erreur lors du calcul');
    } catch { setError('Erreur réseau'); }
    finally { setComputing(false); }
  };

  const overall = profile?.overall_score ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="font-semibold text-gray-900">Profil Compétences</h2>
              <p className="text-sm text-gray-500">{employeeName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <button
                onClick={handleCompute}
                disabled={computing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${computing ? 'animate-spin' : ''}`} />
                {computing ? 'Calcul…' : 'Recalculer'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 text-center py-12 text-gray-400">
              <AlertCircle className="w-10 h-10 text-gray-200" />
              <p className="text-sm">{error}</p>
            </div>
          ) : !profile?.skills.length ? (
            <div className="flex flex-col items-center gap-4 text-center py-12">
              <Brain className="w-12 h-12 text-gray-200" />
              <p className="text-gray-500 text-sm">Aucune compétence enregistrée.</p>
              <p className="text-gray-400 text-xs max-w-sm">
                Cliquez sur "Recalculer" pour initialiser les scores depuis les formations, évaluations et feedbacks.
              </p>
              <button onClick={handleCompute} disabled={computing}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${computing ? 'animate-spin' : ''}`} />
                {computing ? 'Calcul en cours…' : 'Calculer les scores'}
              </button>
            </div>
          ) : (
            <>
              {/* Overall */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 mb-5 flex items-center gap-5">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e0e7ff" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none"
                      stroke={overall >= 75 ? '#22c55e' : overall >= 45 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${(overall / 100) * 94.2} 94.2`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-indigo-700">
                    {overall}%
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Score moyen global</p>
                  <p className={`text-2xl font-bold ${SCORE_COLOR(overall)}`}>{overall}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {profile.skills.length} compétence{profile.skills.length > 1 ? 's' : ''}
                    {profile.last_computed_at ? ` · calculé ${new Date(profile.last_computed_at).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
              </div>

              {/* Skill cards */}
              <div className="space-y-3">
                {profile.skills.map(s => <SkillCard key={s.skill_id} skill={s} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
