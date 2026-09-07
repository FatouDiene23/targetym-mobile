'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, FileQuestion, Loader2, Pencil, Plus, Power, Star, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import Header from '@/components/Header';
import PageLoading from '@/components/PageLoading';
import { getToken } from '@/lib/api';
import { resolveApiUrl } from '@/lib/apiUrl';
import { useI18n } from '@/lib/i18n/I18nContext';

type EvaluatorType = 'self' | 'manager' | 'peer' | 'direct_report';
type QuestionType = 'rating_5' | 'text' | 'boolean' | 'single_choice';

interface QuestionnaireOption { id: string; label: string; score: number }
interface QuestionnaireQuestion {
  id: string; label: string; description?: string; type: QuestionType;
  required: boolean; weight: number; comment_required: boolean;
  evaluator_types: EvaluatorType[]; options: QuestionnaireOption[];
}
interface QuestionnaireCategory {
  id: string; name: string; description?: string; weight: number; questions: QuestionnaireQuestion[];
}
interface QuestionnaireTemplate {
  id: number; name: string; description?: string; version: number;
  is_active: boolean; is_default: boolean;
  definition: { categories: QuestionnaireCategory[] };
}

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);
const COPY = {
  fr: {
    title: "Modèles d'évaluation", subtitle: 'Configurez les questionnaires utilisés dans les campagnes.',
    starter: 'Installer le modèle Targetym', add: 'Nouveau modèle', empty: 'Aucun modèle configuré.',
    default: 'Par défaut', inactive: 'Inactif', version: 'Version', edit: 'Modifier', duplicate: 'Dupliquer',
    deactivate: 'Désactiver', activate: 'Activer', name: 'Nom du modèle', description: 'Description',
    category: 'Catégorie', question: 'Question', categoryName: 'Nom de la catégorie', questionLabel: 'Libellé de la question',
    weight: 'Poids (%)', type: 'Type de réponse', required: 'Réponse obligatoire', comment: 'Commentaire obligatoire',
    evaluators: "Types d'évaluateurs", options: 'Choix de réponse', option: 'Libellé du choix', score: 'Score /5',
    addCategory: 'Ajouter une catégorie', addQuestion: 'Ajouter une question', addOption: 'Ajouter un choix',
    makeDefault: 'Utiliser par défaut', cancel: 'Annuler', save: 'Enregistrer', invalidWeights: 'Les poids des catégories et des questions notées doivent totaliser 100%.',
    templateNameRequired: 'Renseignez le nom du modèle.', categoryNameRequired: 'Renseignez le nom de chaque catégorie.',
    questionLabelRequired: 'Renseignez le libellé de chaque question.', evaluatorRequired: "Sélectionnez au moins un type d'évaluateur pour chaque question.",
    saved: 'Modèle enregistré', error: "L'opération a échoué.", rating_5: 'Note de 1 à 5', text: 'Texte libre', boolean: 'Oui / Non', single_choice: 'Choix unique',
    self: 'Auto-évaluation', manager: 'Manager', peer: 'Pair', direct_report: 'Collaborateur',
  },
  en: {
    title: 'Evaluation templates', subtitle: 'Configure the questionnaires used in evaluation campaigns.',
    starter: 'Install Targetym template', add: 'New template', empty: 'No template configured.',
    default: 'Default', inactive: 'Inactive', version: 'Version', edit: 'Edit', duplicate: 'Duplicate',
    deactivate: 'Deactivate', activate: 'Activate', name: 'Template name', description: 'Description',
    category: 'Category', question: 'Question', categoryName: 'Category name', questionLabel: 'Question label',
    weight: 'Weight (%)', type: 'Answer type', required: 'Required answer', comment: 'Required comment',
    evaluators: 'Evaluator types', options: 'Answer choices', option: 'Choice label', score: 'Score /5',
    addCategory: 'Add category', addQuestion: 'Add question', addOption: 'Add choice',
    makeDefault: 'Use by default', cancel: 'Cancel', save: 'Save', invalidWeights: 'Category and scored-question weights must total 100%.',
    templateNameRequired: 'Enter the template name.', categoryNameRequired: 'Enter a name for each category.',
    questionLabelRequired: 'Enter a label for each question.', evaluatorRequired: 'Select at least one evaluator type for each question.',
    saved: 'Template saved', error: 'The operation failed.', rating_5: 'Rating from 1 to 5', text: 'Free text', boolean: 'Yes / No', single_choice: 'Single choice',
    self: 'Self-review', manager: 'Manager', peer: 'Peer', direct_report: 'Direct report',
  },
  pt: {
    title: 'Modelos de avaliação', subtitle: 'Configure os questionários usados nas campanhas de avaliação.',
    starter: 'Instalar o modelo Targetym', add: 'Novo modelo', empty: 'Nenhum modelo configurado.',
    default: 'Padrão', inactive: 'Inativo', version: 'Versão', edit: 'Editar', duplicate: 'Duplicar',
    deactivate: 'Desativar', activate: 'Ativar', name: 'Nome do modelo', description: 'Descrição',
    category: 'Categoria', question: 'Pergunta', categoryName: 'Nome da categoria', questionLabel: 'Texto da pergunta',
    weight: 'Peso (%)', type: 'Tipo de resposta', required: 'Resposta obrigatória', comment: 'Comentário obrigatório',
    evaluators: 'Tipos de avaliadores', options: 'Opções de resposta', option: 'Texto da opção', score: 'Nota /5',
    addCategory: 'Adicionar categoria', addQuestion: 'Adicionar pergunta', addOption: 'Adicionar opção',
    makeDefault: 'Usar como padrão', cancel: 'Cancelar', save: 'Guardar', invalidWeights: 'Os pesos das categorias e perguntas avaliadas devem totalizar 100%.',
    templateNameRequired: 'Indique o nome do modelo.', categoryNameRequired: 'Indique o nome de cada categoria.',
    questionLabelRequired: 'Indique o texto de cada pergunta.', evaluatorRequired: 'Selecione pelo menos um tipo de avaliador para cada pergunta.',
    saved: 'Modelo guardado', error: 'A operação falhou.', rating_5: 'Nota de 1 a 5', text: 'Texto livre', boolean: 'Sim / Não', single_choice: 'Escolha única',
    self: 'Autoavaliação', manager: 'Gestor', peer: 'Par', direct_report: 'Colaborador',
  },
};

const headers = (): HeadersInit => {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const newQuestion = (): QuestionnaireQuestion => ({
  id: uid('question'), label: '', type: 'rating_5', required: true, weight: 100,
  comment_required: false, evaluator_types: ['self', 'manager'], options: [],
});
const newCategory = (): QuestionnaireCategory => ({
  id: uid('category'), name: '', weight: 100, questions: [newQuestion()],
});

function TemplateEditor({ open, template, onClose, onSaved }: {
  open: boolean; template: QuestionnaireTemplate | null; onClose: () => void; onSaved: () => void;
}) {
  const { locale } = useI18n();
  const c = COPY[locale];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [categories, setCategories] = useState<QuestionnaireCategory[]>([newCategory()]);
  const [saving, setSaving] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.name || ''); setDescription(template?.description || '');
    setIsDefault(template?.is_default || false);
    setCategories(template ? structuredClone(template.definition.categories) : [newCategory()]);
    setAttemptedSave(false);
  }, [open, template]);

  const validWeights = useMemo(() => categories.reduce((sum, item) => sum + Number(item.weight), 0) === 100 && categories.every(category => {
    const scored = category.questions.filter(question => question.type !== 'text');
    return scored.length === 0 ? Number(category.weight) === 0 : scored.reduce((sum, question) => sum + Number(question.weight), 0) === 100;
  }), [categories]);

  const updateCategory = (index: number, value: Partial<QuestionnaireCategory>) => setCategories(current => current.map((item, i) => i === index ? { ...item, ...value } : item));
  const updateQuestion = (categoryIndex: number, questionIndex: number, value: Partial<QuestionnaireQuestion>) => setCategories(current => current.map((category, ci) => ci !== categoryIndex ? category : {
    ...category, questions: category.questions.map((question, qi) => qi === questionIndex ? { ...question, ...value } : question),
  }));

  const save = async () => {
    setAttemptedSave(true);
    if (!name.trim()) { toast.error(c.templateNameRequired); return; }
    if (categories.some(category => !category.name.trim())) { toast.error(c.categoryNameRequired); return; }
    if (categories.some(category => category.questions.some(question => !question.label.trim()))) { toast.error(c.questionLabelRequired); return; }
    if (categories.some(category => category.questions.some(question => question.evaluator_types.length === 0))) { toast.error(c.evaluatorRequired); return; }
    if (!validWeights) { toast.error(c.invalidWeights); return; }
    setSaving(true);
    const response = await fetch(`${API_URL}/api/performance/questionnaire-templates${template ? `/${template.id}` : ''}`, {
      method: template ? 'PUT' : 'POST', headers: headers(),
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, is_default: isDefault, definition: { categories } }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(typeof payload.detail === 'string' ? payload.detail : c.error); return;
    }
    toast.success(c.saved); onSaved(); onClose();
  };

  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white" onClick={event => event.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5">
        <h2 className="text-xl font-bold text-gray-900">{template ? c.edit : c.add}</h2>
        <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">{c.name}<input value={name} onChange={e => setName(e.target.value)} aria-invalid={attemptedSave && !name.trim()} className={`mt-1 w-full rounded-lg border px-3 py-2 ${attemptedSave && !name.trim() ? 'border-red-500' : ''}`} />{attemptedSave && !name.trim() && <span className="mt-1 block text-xs text-red-600">{c.templateNameRequired}</span>}</label>
          <label className="text-sm font-medium text-gray-700">{c.description}<input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />{c.makeDefault}</label>
        {categories.map((category, categoryIndex) => <section key={category.id} className="rounded-xl border bg-gray-50 p-4">
          <div className="mb-4 flex items-end gap-3">
            <label className="flex-1 text-sm font-medium">{c.categoryName}<input value={category.name} onChange={e => updateCategory(categoryIndex, { name: e.target.value })} aria-invalid={attemptedSave && !category.name.trim()} className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 ${attemptedSave && !category.name.trim() ? 'border-red-500' : ''}`} />{attemptedSave && !category.name.trim() && <span className="mt-1 block text-xs text-red-600">{c.categoryNameRequired}</span>}</label>
            <label className="w-28 text-sm font-medium">{c.weight}<input type="number" min={0} max={100} value={category.weight} onChange={e => updateCategory(categoryIndex, { weight: Number(e.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2" /></label>
            {categories.length > 1 && <button onClick={() => setCategories(items => items.filter((_, i) => i !== categoryIndex))} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-5 w-5" /></button>}
          </div>
          <div className="space-y-3">
            {category.questions.map((question, questionIndex) => <div key={question.id} className="rounded-xl border bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_190px_100px_auto]">
                <label className="text-xs font-medium">{c.questionLabel}<input value={question.label} onChange={e => updateQuestion(categoryIndex, questionIndex, { label: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium">{c.type}<select value={question.type} onChange={e => {
                  const type = e.target.value as QuestionType;
                  updateQuestion(categoryIndex, questionIndex, { type, weight: type === 'text' ? 0 : question.weight || 100, options: type === 'single_choice' ? (question.options.length >= 2 ? question.options : [{ id: uid('choice'), label: '', score: 0 }, { id: uid('choice'), label: '', score: 5 }]) : [] });
                }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">{(['rating_5', 'text', 'boolean', 'single_choice'] as QuestionType[]).map(type => <option key={type} value={type}>{c[type]}</option>)}</select></label>
                <label className="text-xs font-medium">{c.weight}<input type="number" min={0} max={100} disabled={question.type === 'text'} value={question.weight} onChange={e => updateQuestion(categoryIndex, questionIndex, { weight: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100" /></label>
                {category.questions.length > 1 && <button onClick={() => updateCategory(categoryIndex, { questions: category.questions.filter((_, i) => i !== questionIndex) })} className="mt-5 rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={question.required} onChange={e => updateQuestion(categoryIndex, questionIndex, { required: e.target.checked })} />{c.required}</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={question.comment_required} onChange={e => updateQuestion(categoryIndex, questionIndex, { comment_required: e.target.checked })} />{c.comment}</label>
              </div>
              <div className="mt-3"><p className="mb-1 text-xs font-medium">{c.evaluators}</p><div className="flex flex-wrap gap-3">{(['self', 'manager', 'peer', 'direct_report'] as EvaluatorType[]).map(type => <label key={type} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={question.evaluator_types.includes(type)} onChange={e => updateQuestion(categoryIndex, questionIndex, { evaluator_types: e.target.checked ? [...question.evaluator_types, type] : question.evaluator_types.filter(item => item !== type) })} />{c[type]}</label>)}</div></div>
              {question.type === 'single_choice' && <div className="mt-3 space-y-2"><p className="text-xs font-medium">{c.options}</p>{question.options.map((option, optionIndex) => <div key={option.id} className="flex gap-2"><input placeholder={c.option} value={option.label} onChange={e => updateQuestion(categoryIndex, questionIndex, { options: question.options.map((item, i) => i === optionIndex ? { ...item, label: e.target.value } : item) })} className="flex-1 rounded-lg border px-3 py-2 text-sm" /><input aria-label={c.score} type="number" min={0} max={5} step={0.5} value={option.score} onChange={e => updateQuestion(categoryIndex, questionIndex, { options: question.options.map((item, i) => i === optionIndex ? { ...item, score: Number(e.target.value) } : item) })} className="w-24 rounded-lg border px-3 py-2 text-sm" />{question.options.length > 2 && <button onClick={() => updateQuestion(categoryIndex, questionIndex, { options: question.options.filter((_, i) => i !== optionIndex) })}><Trash2 className="h-4 w-4 text-red-600" /></button>}</div>)}<button onClick={() => updateQuestion(categoryIndex, questionIndex, { options: [...question.options, { id: uid('choice'), label: '', score: 0 }] })} className="text-xs font-medium text-primary-600">+ {c.addOption}</button></div>}
            </div>)}
          </div>
          <button onClick={() => updateCategory(categoryIndex, { questions: [...category.questions, newQuestion()] })} className="mt-3 text-sm font-medium text-primary-600">+ {c.addQuestion}</button>
        </section>)}
        <button onClick={() => setCategories(items => [...items, { ...newCategory(), weight: 0 }])} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-primary-700"><Plus className="h-4 w-4" />{c.addCategory}</button>
        {!validWeights && <p className="text-sm text-orange-600">{c.invalidWeights}</p>}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white p-5"><button onClick={onClose} className="rounded-lg border px-4 py-2">{c.cancel}</button><button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{c.save}</button></div>
    </div>
  </div>;
}

export default function QuestionnairesPage() {
  const { locale } = useI18n(); const c = COPY[locale];
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [loading, setLoading] = useState(true); const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionnaireTemplate | null>(null);
  const load = useCallback(async () => { setLoading(true); const response = await fetch(`${API_URL}/api/performance/questionnaire-templates?include_inactive=true`, { headers: headers() }); setTemplates(response.ok ? await response.json() : []); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const action = async (path: string, method = 'POST', body?: unknown) => { const response = await fetch(`${API_URL}/api/performance/questionnaire-templates${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined }); if (!response.ok) toast.error(c.error); else await load(); };
  if (loading) return <PageLoading />;
  return <div className="min-h-screen bg-gray-50"><Header /><main className="mx-auto max-w-7xl p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">{c.title}</h1><p className="text-sm text-gray-500">{c.subtitle}</p></div><div className="flex gap-2">{templates.length === 0 && <button onClick={() => action('/seed-targetym')} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium">{c.starter}</button>}<button onClick={() => { setEditing(null); setEditorOpen(true); }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />{c.add}</button></div></div>
    {templates.length === 0 ? <div className="rounded-2xl border bg-white p-12 text-center"><FileQuestion className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="text-gray-500">{c.empty}</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map(template => <article key={template.id} className={`rounded-2xl border bg-white p-5 ${!template.is_active ? 'opacity-60' : ''}`}><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold text-gray-900">{template.name}</h2><p className="mt-1 text-xs text-gray-500">{c.version} {template.version} · {template.definition.categories.length} {c.category.toLowerCase()}(s)</p></div><div className="flex gap-1">{template.is_default && <span title={c.default} className="rounded-full bg-amber-50 p-1.5 text-amber-600"><Star className="h-4 w-4 fill-current" /></span>}{!template.is_active && <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{c.inactive}</span>}</div></div><p className="mt-3 min-h-10 text-sm text-gray-600">{template.description}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => { setEditing(template); setEditorOpen(true); }} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"><Pencil className="h-3.5 w-3.5" />{c.edit}</button><button onClick={() => action(`/${template.id}/duplicate`)} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"><Copy className="h-3.5 w-3.5" />{c.duplicate}</button><button onClick={() => action(`/${template.id}`, 'PUT', { is_active: !template.is_active })} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"><Power className="h-3.5 w-3.5" />{template.is_active ? c.deactivate : c.activate}</button></div></article>)}</div>}
    </main><TemplateEditor open={editorOpen} template={editing} onClose={() => setEditorOpen(false)} onSaved={load} /></div>;
}
