'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  GraduationCap, X, ChevronDown, ChevronRight, Lock, CheckCircle2, Maximize2, Download,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';
import { getAgentSkills, downloadAgentSkill, type AgentSkill } from '@/lib/api';

/**
 * « Savoir-faire du copilote » — les procédures officielles que l'agent applique.
 *
 * Volontairement en LECTURE SEULE : ces procédures sont livrées avec le produit
 * et versionnées avec le code, l'utilisateur ne les modifie pas. Ce qui est à lui
 * vit dans « Mes procédures ».
 *
 * Le but est la transparence : voir ce que l'agent sait faire, et pouvoir lire la
 * marche à suivre qu'il appliquera en son nom.
 *
 * DEUX NIVEAUX, comme le runtime. En dépliant, on ne montre que ce que le
 * savoir-faire APPREND à l'agent (`mode_operatoire`, extrait côté serveur). Le
 * document complet — avec les preuves à produire, les interdits et les renvois
 * techniques — n'apparaît que si l'utilisateur le demande, dans une fenêtre
 * dédiée. Avant, on déversait le corps entier dans la vue dépliée : c'était du
 * texte écrit pour le modèle, encombrant et illisible pour un client.
 */
interface AgentSkillsPanelProps {
  /** Fermeture du modal. Inutile en mode `embedded`. */
  onClose?: () => void;
  /**
   * `true` : rendu INLINE, sans surcouche ni en-tête, pour être posé dans une
   * page de paramètres. `false` (défaut) : modal autonome.
   */
  embedded?: boolean;
}

export default function AgentSkillsPanel({ onClose, embedded = false }: AgentSkillsPanelProps) {
  const { t } = useI18n();
  const s = t.components.copilot.agentSkills;

  const [items, setItems] = useState<AgentSkill[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Savoir-faire dont le document COMPLET est ouvert en fenêtre. */
  const [complet, setComplet] = useState<AgentSkill | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const reponse = await getAgentSkills();
        if (annule) return;
        setEnabled(reponse.enabled);
        setItems(reponse.skills);
      } catch (err: unknown) {
        if (!annule) toast.error(err instanceof Error ? err.message : 'Erreur');
      } finally {
        if (!annule) setLoading(false);
      }
    })();
    return () => { annule = true; };
  }, []);

  const modules = Array.from(new Set(items.map((x) => x.module)));

  const contenu = (
    <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : !enabled ? (
            <p className="text-center text-sm text-gray-500 py-10">{s.disabled}</p>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-10">{s.empty}</p>
          ) : (
            <>
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Lock size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {s.readOnly} · {s.countLabel.replace('{n}', String(items.length))}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.readOnlyHint}</p>
                </div>
              </div>

              {modules.map((module) => (
                <div key={module}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    {module}
                  </p>
                  <div className="space-y-2">
                    {items.filter((x) => x.module === module).map((skill) => {
                      const isOpen = expanded === skill.identifiant;
                      return (
                        <div key={skill.identifiant} className="border border-gray-200 rounded-xl">
                          <div
                            onClick={() => setExpanded(isOpen ? null : skill.identifiant)}
                            className="px-3 py-2.5 flex items-start justify-between gap-2 cursor-pointer hover:bg-gray-50 rounded-xl"
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              {isOpen
                                ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                : <ChevronRight size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />}
                              <p className="text-sm font-medium text-gray-900">{skill.titre}</p>
                            </div>
                            {/* Ouverture du document complet, sur la ligne du titre :
                                accessible SANS déplier, et assez visible pour être
                                trouvée. `stopPropagation` sinon le clic replierait
                                la ligne en même temps qu'il ouvre la fenêtre. */}
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {/* Telechargement du fichier `.md`. Genere par le
                                  serveur, donc REIMPORTABLE tel quel : il peut
                                  servir de sauvegarde ou de base a une nouvelle
                                  procedure. */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void downloadAgentSkill(skill.identifiant).catch((err) =>
                                    toast.error(err instanceof Error ? err.message : 'Erreur'),
                                  );
                                }}
                                className="p-1 -m-0.5 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition"
                                aria-label={s.download}
                                title={s.download}
                              >
                                <Download size={15} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setComplet(skill); }}
                                className="p-1 -m-0.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition"
                                aria-label={s.openFull}
                                title={s.openFull}
                              >
                                <Maximize2 size={16} />
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                  {s.appliedWhen}
                                </p>
                                <p className="text-xs text-gray-600">{skill.description}</p>
                              </div>

                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                  {s.learned}
                                </p>
                                <SkillMarkdown texte={skill.mode_operatoire} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Document complet, sur demande. Rendu ici (et non au niveau de la
              page) pour être disponible aussi bien en mode intégré qu'en modal. */}
          {complet && (
            <FullSkillModal skill={complet} onClose={() => setComplet(null)} />
          )}
    </div>
  );

  if (embedded) return contenu;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap size={18} />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight">{s.title}</h3>
              <p className="text-[11px] text-white/70 truncate">{s.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label={s.close}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{contenu}</div>
      </div>
    </div>
  );
}

/**
 * Rendu markdown SOBRE d'un extrait de procédure.
 *
 * Le texte vient d'un document rédigé : il contient des listes numérotées et des
 * passages en gras. Le rendre en `<pre>` (ce qu'on faisait) affichait les
 * astérisques brutes et cassait la lecture. On rend donc le markdown, avec des
 * marges resserrées pour rester dans un panneau de réglages.
 */
function SkillMarkdown({ texte }: { texte: string }) {
  if (!texte.trim()) return null;
  return (
    <div className="text-xs text-gray-600 leading-relaxed space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mt-0.5 [&_strong]:text-gray-900 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_p]:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{texte}</ReactMarkdown>
    </div>
  );
}

/**
 * Le savoir-faire EN ENTIER, dans une fenêtre dédiée.
 *
 * C'est le niveau de transparence maximal : la même chose que l'agent lit.
 * Volontairement séparé de la vue dépliée, pour que la consultation courante
 * reste légère.
 */
function FullSkillModal({ skill, onClose }: { skill: AgentSkill; onClose: () => void }) {
  const { t } = useI18n();
  const s = t.components.copilot.agentSkills;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <GraduationCap size={17} className="text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{skill.titre}</p>
            <p className="text-[11px] text-gray-400">
              {s.fullTitle} · v{skill.version}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
            aria-label={s.close}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <SkillMarkdown texte={skill.procedure} />

          {skill.preuves_attendues.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                {s.checks}
              </p>
              <ul className="space-y-1">
                {skill.preuves_attendues.map((preuve) => (
                  <li key={preuve} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <CheckCircle2 size={13} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{preuve}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
