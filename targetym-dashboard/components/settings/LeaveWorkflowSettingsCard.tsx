'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import { getToken } from '@/lib/api';
import { resolveApiUrl } from '@/lib/apiUrl';
import { useI18n } from '@/lib/i18n/I18nContext';

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);
const STEP_ORDER = ['manager_n1', 'manager_n2', 'hr'] as const;
type StepType = (typeof STEP_ORDER)[number];
type WorkflowStep = { type: StepType; required: boolean };

const COPY = {
  fr: {
    title: 'Circuit de validation des congés',
    description: 'Choisissez les intervenants des nouvelles demandes. L’ordre sécurisé reste N+1, N+2, puis RH.',
    manager_n1: 'Manager N+1',
    manager_n2: 'Manager N+2',
    hr: 'Validation RH',
    required: 'Étape obligatoire ; relais RH si cet approbateur est absent',
    newOnly: 'Les changements s’appliquent uniquement aux nouvelles demandes. Les circuits déjà lancés restent inchangés.',
    fallback: 'Si aucun approbateur configuré n’est disponible, la demande est transmise aux RH et ne peut jamais être auto-approuvée.',
    save: 'Enregistrer le circuit',
    saved: 'Circuit de validation enregistré',
    loadError: 'Impossible de charger le circuit de validation',
    saveError: 'Impossible d’enregistrer le circuit de validation',
    oneStep: 'Sélectionnez au moins une étape.',
    oneRequired: 'Au moins une étape doit être obligatoire.',
  },
  en: {
    title: 'Leave approval workflow',
    description: 'Choose who approves new requests. The secured order remains N+1, N+2, then HR.',
    manager_n1: 'N+1 Manager',
    manager_n2: 'N+2 Manager',
    hr: 'HR approval',
    required: 'Required step; HR fallback if this approver is missing',
    newOnly: 'Changes apply only to new requests. Workflows already started remain unchanged.',
    fallback: 'If no configured approver is available, the request is sent to HR and can never be auto-approved.',
    save: 'Save workflow',
    saved: 'Approval workflow saved',
    loadError: 'Unable to load the approval workflow',
    saveError: 'Unable to save the approval workflow',
    oneStep: 'Select at least one step.',
    oneRequired: 'At least one step must be mandatory.',
  },
  pt: {
    title: 'Circuito de aprovação de férias',
    description: 'Escolha quem aprova os novos pedidos. A ordem segura continua N+1, N+2 e depois RH.',
    manager_n1: 'Gestor N+1',
    manager_n2: 'Gestor N+2',
    hr: 'Aprovação de RH',
    required: 'Etapa obrigatória; substituição por RH se este aprovador estiver ausente',
    newOnly: 'As alterações aplicam-se apenas aos novos pedidos. Os circuitos já iniciados permanecem inalterados.',
    fallback: 'Se nenhum aprovador configurado estiver disponível, o pedido é enviado ao RH e nunca é aprovado automaticamente.',
    save: 'Guardar circuito',
    saved: 'Circuito de aprovação guardado',
    loadError: 'Não foi possível carregar o circuito de aprovação',
    saveError: 'Não foi possível guardar o circuito de aprovação',
    oneStep: 'Selecione pelo menos uma etapa.',
    oneRequired: 'Pelo menos uma etapa deve ser obrigatória.',
  },
} as const;

export default function LeaveWorkflowSettingsCard() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedTypes = useMemo(() => new Set(steps.map((step) => step.type)), [steps]);

  useEffect(() => {
    fetch(`${API_URL}/api/leaves/approval-workflow`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : copy.loadError);
        const workflow = Array.isArray(data.validation_workflow) ? data.validation_workflow : [];
        setSteps(STEP_ORDER.flatMap((type) => {
          const step = workflow.find((item: WorkflowStep) => item.type === type);
          return step ? [{ type, required: step.required !== false }] : [];
        }));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : copy.loadError))
      .finally(() => setLoading(false));
  }, [copy.loadError]);

  const toggleStep = (type: StepType) => {
    setSteps((current) => current.some((step) => step.type === type)
      ? current.filter((step) => step.type !== type)
      : STEP_ORDER.flatMap((candidate) => {
          if (candidate === type) return [{ type, required: true }];
          const existing = current.find((step) => step.type === candidate);
          return existing ? [existing] : [];
        }));
  };

  const save = async () => {
    if (steps.length === 0) {
      toast.error(copy.oneStep);
      return;
    }
    if (!steps.some((step) => step.required)) {
      toast.error(copy.oneRequired);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/leaves/approval-workflow`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ validation_workflow: steps }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : copy.saveError);
      setSteps(data.validation_workflow || steps);
      toast.success(copy.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-primary-200 bg-white p-6 md:col-span-2">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary-50 p-2 text-primary-600"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{copy.title}</h3>
          <p className="mt-1 text-sm text-gray-500">{copy.description}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {STEP_ORDER.map((type, index) => {
              const selected = selectedTypes.has(type);
              const step = steps.find((item) => item.type === type);
              return (
                <div key={type} className={`rounded-xl border p-4 ${selected ? 'border-primary-300 bg-primary-50/40' : 'border-gray-200'}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={selected} onChange={() => toggleStep(type)} className="h-4 w-4 rounded text-primary-600" />
                    <span className="text-xs font-semibold text-gray-400">{index + 1}</span>
                    <span className="font-medium text-gray-900">{copy[type]}</span>
                  </label>
                  {selected && step && (
                    <label className="mt-4 flex cursor-pointer items-start gap-2 border-t border-primary-100 pt-3 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={step.required}
                        onChange={(event) => setSteps((current) => current.map((item) => item.type === type ? { ...item, required: event.target.checked } : item))}
                        className="mt-0.5 h-4 w-4 rounded text-primary-600"
                      />
                      {copy.required}
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 space-y-2 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            <p>{copy.newOnly}</p>
            <p>{copy.fallback}</p>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving || steps.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {copy.save}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
