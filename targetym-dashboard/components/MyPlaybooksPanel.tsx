'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpen, X, ChevronDown, ChevronRight, Pencil, Trash2, Globe, Building2, User,
  Plus, Lock,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/lib/i18n/I18nContext';
import {
  getMyPlaybooks, deleteMyPlaybook, getCopilotMe, type GlobalPlaybook,
} from '@/lib/api';
import NewPlaybookForm from '@/components/NewPlaybookForm';

/**
 * Règles affichables d'une procédure. La colonne est un JSONB qui porte soit une
 * liste (format historique), soit le contrat structuré : on rend les deux, et
 * pour le contrat on montre ce qui aide l'approbateur (pièges puis repli).
 */
function reglesAffichables(playbook: GlobalPlaybook): string[] {
  const rules = playbook.rules;
  if (!rules) return [];
  if (Array.isArray(rules)) return rules;
  return [
    ...(rules.forbidden_errors ?? []),
    ...(rules.rules ?? []),
    ...(rules.fallback ? [rules.fallback] : []),
  ];
}

/**
 * « Mes procédures » — les skills de l'agent, côté utilisateur.
 * Perso : modifiables/supprimables. Entreprise : RH+ (le backend tranche —
 * on tente et on affiche l'erreur). Boîte commune : lecture seule.
 */
interface MyPlaybooksPanelProps {
  /** Fermeture du modal. Inutile en mode `embedded`. */
  onClose?: () => void;
  /**
   * `true` : rendu INLINE, sans surcouche ni en-tête, pour être posé dans une
   * page de paramètres. `false` (défaut) : modal autonome.
   */
  embedded?: boolean;
}

export default function MyPlaybooksPanel({ onClose, embedded = false }: MyPlaybooksPanelProps) {
  const { t } = useI18n();
  const p = t.components.copilot.myPlaybooks;

  const [items, setItems] = useState<GlobalPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalPlaybook | null>(null);
  const [creating, setCreating] = useState(false);

  // Écrire pour toute l'entreprise est réservé à l'ADMIN du tenant et aux RH
  // (décision produit). Le serveur reste l'autorité : ce test ne fait que
  // masquer une option qui serait refusée en 403.
  const { user } = useAuth();
  const roleValue = String(user?.role ?? '').toLowerCase();
  const canWriteForCompany = roleValue === 'admin' || roleValue === 'rh';

  // Statut FORMATEUR lu sur le serveur, pas dans le profil stocké à la
  // connexion : ce statut est posé par l'équipe plateforme et peut changer après
  // que l'utilisateur s'est connecté. Le lire à chaud évite de lui demander de se
  // reconnecter pour voir l'option apparaître. Le serveur reste l'autorité
  // (`publish_global` revérifie) : ceci ne pilote que l'affichage.
  const [canPublishOfficial, setCanPublishOfficial] = useState(false);
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const moi = await getCopilotMe();
        if (!annule) setCanPublishOfficial(Boolean(moi.is_trainer));
      } catch {
        if (!annule) setCanPublishOfficial(false);
      }
    })();
    return () => { annule = true; };
  }, []);

  // Édition inline
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getMyPlaybooks());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const startEdit = (pb: GlobalPlaybook) => {
    setEditingId(pb.id);
    setExpanded(pb.id);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await deleteMyPlaybook(id);
      setItems(prev => prev.filter(x => x.id !== id));
      toast.success(p.deleted);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const groups: { key: string; label: string; icon: React.ReactNode; editable: boolean; items: GlobalPlaybook[] }[] = [
    { key: 'user', label: p.groupMine, icon: <User size={14} />, editable: true, items: items.filter(x => x.scope === 'user') },
    { key: 'tenant', label: p.groupCompany, icon: <Building2 size={14} />, editable: true, items: items.filter(x => x.scope === 'tenant') },
    { key: 'global', label: p.groupCommon, icon: <Globe size={14} />, editable: false, items: items.filter(x => x.scope === 'global') },
  ];

  const contenu = (
    <div className="space-y-5">
          {/* Rédaction explicite : l'auteur voit ses champs et relit avant
              d'enregistrer, au lieu de dicter la procédure dans la conversation. */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">{p.subtitle}</p>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 bg-primary-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-primary-700 transition flex-shrink-0"
              >
                <Plus size={14} /> {p.addButton}
              </button>
            )}
          </div>

          {creating && (
            <NewPlaybookForm
              canWriteForCompany={canWriteForCompany}
              canPublishOfficial={canPublishOfficial}
              onCancel={() => setCreating(false)}
              onCreated={(pb) => {
                setCreating(false);
                setItems((prev) => [pb, ...prev.filter((x) => x.id !== pb.id)]);
                setExpanded(pb.id);
              }}
            />
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 space-y-1">
              <p className="text-sm text-gray-500">{p.empty}</p>
              <p className="text-xs text-gray-400">{p.emptyHint}</p>
            </div>
          ) : (
            groups.filter(g => g.items.length > 0).map(group => (
              <div key={group.key}>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  {group.icon} {group.label} ({group.items.length})
                </p>
                <div className="space-y-2">
                  {group.items.map(pb => {
                    const isOpen = expanded === pb.id;
                    const isEditing = editingId === pb.id;
                    return (
                      <div key={pb.id} className="border border-gray-200 rounded-xl">
                        <div
                          onClick={() => !isEditing && setExpanded(isOpen ? null : pb.id)}
                          className="px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 rounded-xl"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isOpen ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
                            <p className="text-sm font-medium text-gray-900 truncate">{pb.title}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[11px] text-gray-400 mr-1">
                              {p.stepsCount.replace('{n}', String(pb.steps?.length ?? 0))}
                            </span>
                            {group.editable && !isEditing && (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); startEdit(pb); }}
                                  className="p-1.5 rounded hover:bg-gray-200 text-gray-400 transition"
                                  title={p.edit}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setDeleteTarget(pb); }}
                                  className="p-1.5 rounded hover:bg-red-100 text-red-500 transition"
                                  title={p.delete}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isOpen && !isEditing && (
                          <div className="px-4 pb-3 pt-1 border-t border-gray-100">
                            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                              {(pb.steps || []).map((s, i) => <li key={i}>{s}</li>)}
                            </ol>
                            {reglesAffichables(pb).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {reglesAffichables(pb).map((r, i) => (
                                  <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">⚠ {r}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {isEditing && (
                          <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                            {/* MÊME formulaire que la création : mêmes sections,
                                mêmes champs obligatoires signalés. */}
                            <NewPlaybookForm
                              mode="edit"
                              initial={pb}
                              onCancel={() => setEditingId(null)}
                              onCreated={(maj) => {
                                setEditingId(null);
                                setItems(prev => prev.map(x => (x.id === maj.id ? maj : x)));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
    </div>
  );

  const dialogue = (
    <ConfirmDialog
      isOpen={deleteTarget !== null}
      onClose={() => setDeleteTarget(null)}
      onConfirm={() => void handleDelete()}
      title={p.deleteConfirmTitle}
      message={`« ${deleteTarget?.title ?? ''} » — ${p.deleteConfirmMessage}`}
      confirmText={p.delete}
      cancelText={p.cancel}
      danger
    />
  );

  if (embedded) {
    return (
      <>
        {contenu}
        {dialogue}
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen size={18} />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight">{p.title}</h3>
              <p className="text-[11px] text-white/70 truncate">{p.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label={p.close}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{contenu}</div>
      </div>
      {dialogue}
    </div>
  );
}
