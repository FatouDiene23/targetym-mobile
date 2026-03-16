'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Briefcase, Target, BookOpen, Users, UserPlus } from 'lucide-react';

export interface ActionPreview {
  tool_name: string;         // generate_onboarding_program | generate_okr_objectives | ...
  data: Record<string, any>;
  display_label: string;
}

interface Props {
  preview: ActionPreview;
  onValidate: () => Promise<void>;
  onCancel: () => void;
}

// ============================================================
// Rendus spécialisés par type d'action
// ============================================================

function OnboardingPreview({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false);
  const tasks: any[] = data.tasks || [];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white rounded p-2 border">
          <span className="text-gray-500">Programme</span>
          <p className="font-semibold text-gray-800 truncate">{data.name}</p>
        </div>
        <div className="bg-white rounded p-2 border">
          <span className="text-gray-500">Durée</span>
          <p className="font-semibold text-gray-800">{data.duration_days} jours</p>
        </div>
        {data.job_title && (
          <div className="bg-white rounded p-2 border col-span-2">
            <span className="text-gray-500">Poste visé</span>
            <p className="font-semibold text-gray-800">{data.job_title}</p>
          </div>
        )}
      </div>

      {data.description && (
        <p className="text-xs text-gray-600 italic">{data.description}</p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {tasks.length} tâche{tasks.length > 1 ? 's' : ''} planifiée{tasks.length > 1 ? 's' : ''}
      </button>

      {expanded && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {tasks.map((task, i) => (
            <div key={i} className="bg-white border rounded p-2 text-xs flex items-start gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                task.category === 'administrative' ? 'bg-purple-100 text-purple-700' :
                task.category === 'technical' ? 'bg-blue-100 text-blue-700' :
                task.category === 'training' ? 'bg-green-100 text-green-700' :
                task.category === 'meeting' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                Jour {task.due_day}
              </span>
              <div>
                <p className="font-medium text-gray-800">{task.title}</p>
                {task.description && <p className="text-gray-500">{task.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OkrPreview({ data }: { data: any }) {
  const objectives: any[] = data.objectives || [];
  const [openObj, setOpenObj] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{objectives.length} objectif{objectives.length > 1 ? 's' : ''} OKR à créer</p>
      {objectives.map((obj, i) => (
        <div key={i} className="bg-white border rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenObj(openObj === i ? null : i)}
            className="w-full flex items-center justify-between p-2.5 text-left hover:bg-gray-50"
          >
            <div>
              <p className="text-xs font-semibold text-gray-800">{obj.title}</p>
              <p className="text-[10px] text-gray-400">Q{obj.quarter}-{obj.year} · {(obj.key_results || []).length} KR</p>
            </div>
            {openObj === i ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {openObj === i && (
            <div className="px-3 pb-2 space-y-1 border-t bg-gray-50">
              {(obj.key_results || []).map((kr: any, j: number) => (
                <div key={j} className="flex items-center gap-2 text-xs py-1">
                  <Target size={12} className="text-blue-500 flex-shrink-0" />
                  <span className="flex-1 text-gray-700">{kr.title}</span>
                  <span className="font-semibold text-blue-600">{kr.target_value}{kr.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TrainingPreview({ data }: { data: any }) {
  const courses: any[] = data.courses || [];

  return (
    <div className="space-y-2">
      <div className="bg-white border rounded p-2 text-xs">
        <p className="text-gray-500">Plan</p>
        <p className="font-semibold text-gray-800">{data.plan_title}</p>
        {data.target_profile && <p className="text-gray-500 mt-0.5">Pour : {data.target_profile}</p>}
      </div>
      <p className="text-xs text-gray-500">{courses.length} module{courses.length > 1 ? 's' : ''} de formation</p>
      <div className="space-y-1 max-h-44 overflow-y-auto">
        {courses.map((course, i) => (
          <div key={i} className="bg-white border rounded p-2 text-xs">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-800">{course.title}</p>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                course.format === 'e-learning' ? 'bg-blue-100 text-blue-700' :
                course.format === 'presentiel' ? 'bg-green-100 text-green-700' :
                course.format === 'coaching' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {course.format}
              </span>
            </div>
            <p className="text-gray-500">{course.duration_hours}h
              {course.week_start ? ` · Semaine ${course.week_start}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidatePreview({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      <div className="bg-white border rounded p-2 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800">{data.first_name} {data.last_name}</p>
          {data.source && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
              {data.source}
            </span>
          )}
        </div>
        <p className="text-gray-600">✉️ {data.email}</p>
        {data.phone && <p className="text-gray-500">📞 {data.phone}</p>}
        {data.current_position && <p className="text-gray-500">💼 {data.current_position}</p>}
      </div>
      {data.notes && (
        <div className="bg-white border rounded p-2 text-xs">
          <p className="text-gray-500 mb-0.5">Notes</p>
          <p className="text-gray-700">{data.notes}</p>
        </div>
      )}
    </div>
  );
}

function JobPostingPreview({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      <div className="bg-white border rounded p-2 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800">{data.title}</p>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
            {data.contract_type}
          </span>
        </div>
        {data.location && <p className="text-gray-500">📍 {data.location}</p>}
        {data.experience_years > 0 && (
          <p className="text-gray-500">🎯 {data.experience_years} an{data.experience_years > 1 ? 's' : ''} d'expérience</p>
        )}
      </div>
      {data.description && (
        <div className="bg-white border rounded p-2 text-xs">
          <p className="text-gray-500 mb-1">Description</p>
          <p className="text-gray-700 line-clamp-3">{data.description}</p>
        </div>
      )}
      {data.skills && data.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.skills.slice(0, 6).map((skill: string, i: number) => (
            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px]">
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

const ACTION_ICONS: Record<string, React.ComponentType<any>> = {
  generate_onboarding_program: Users,
  generate_okr_objectives: Target,
  generate_training_plan: BookOpen,
  generate_candidate: UserPlus,
  generate_job_posting: Briefcase,
};

const ACTION_COLORS: Record<string, string> = {
  generate_onboarding_program: 'from-indigo-500 to-indigo-700',
  generate_okr_objectives: 'from-blue-500 to-blue-700',
  generate_training_plan: 'from-emerald-500 to-emerald-700',
  generate_candidate: 'from-violet-500 to-violet-700',
  generate_job_posting: 'from-orange-500 to-orange-600',
};

export default function AgentActionPreview({ preview, onValidate, onCancel }: Props) {
  const [validating, setValidating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = ACTION_ICONS[preview.tool_name] || Target;
  const gradient = ACTION_COLORS[preview.tool_name] || 'from-blue-500 to-blue-700';

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    try {
      await onValidate();
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Une erreur est survenue lors de l\'insertion.');
    } finally {
      setValidating(false);
    }
  };

  if (done) {
    return (
      <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
        <CheckCircle size={24} className="text-green-600 mx-auto mb-1" />
        <p className="text-sm font-semibold text-green-800">Insertion réussie !</p>
        <p className="text-xs text-green-600 mt-0.5">Rafraîchissez la page pour voir les données.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-gray-50">
      {/* Header */}
      <div className={`bg-gradient-to-r ${gradient} text-white px-3 py-2 flex items-center gap-2`}>
        <Icon size={16} />
        <p className="text-sm font-semibold">{preview.display_label}</p>
        <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">Prévisualisation</span>
      </div>

      {/* Contenu selon le type */}
      <div className="p-3">
        {preview.tool_name === 'generate_onboarding_program' && <OnboardingPreview data={preview.data} />}
        {preview.tool_name === 'generate_okr_objectives' && <OkrPreview data={preview.data} />}
        {preview.tool_name === 'generate_training_plan' && <TrainingPreview data={preview.data} />}
        {preview.tool_name === 'generate_candidate' && <CandidatePreview data={preview.data} />}
        {preview.tool_name === 'generate_job_posting' && <JobPostingPreview data={preview.data} />}
      </div>

      {/* Erreur */}
      {error && (
        <div className="mx-3 mb-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={handleValidate}
          disabled={validating}
          className={`flex-1 flex items-center justify-center gap-2 bg-gradient-to-r ${gradient} text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60`}
        >
          {validating ? (
            <><Loader2 size={15} className="animate-spin" /> Insertion...</>
          ) : (
            <><CheckCircle size={15} /> Valider et insérer</>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={validating}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
        >
          <XCircle size={15} />
        </button>
      </div>
    </div>
  );
}
