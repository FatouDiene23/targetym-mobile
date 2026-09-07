'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, User, Building2, Globe, Upload, FileDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';
import {
  createMyPlaybook, publishGlobalPlaybook, updateMyPlaybook,
  downloadPlaybookTemplate, parsePlaybookMarkdown,
  type GlobalPlaybook, type PlaybookContract,
} from '@/lib/api';

/**
 * Formulaire de rédaction d'une procédure — en langage MÉTIER.
 *
 * Chaque champ correspond à une section du format de procédure, posée sous forme
 * de QUESTION plutôt que de nom technique. Volontairement, aucun champ
 * d'implémentation (pas de route, pas d'identifiant d'opération, pas de nom
 * d'outil) : l'auteur décrit un procédé, le serveur garde la main sur ce qui est
 * réellement exécutable.
 *
 * Les listes se saisissent une entrée par ligne, c'est ce que les utilisateurs
 * font spontanément et ça évite un éditeur de liste à boutons.
 */

interface NewPlaybookFormProps {
  /** L'utilisateur peut-il écrire pour toute l'entreprise ? (admin ou RH) */
  canWriteForCompany?: boolean;
  /**
   * Compte FORMATEUR : peut publier dans les procédures officielles, servies à
   * tous les clients. Permet de publier depuis son propre espace, sans passer
   * par le back office plateforme auquel il n'a pas forcément accès.
   */
  canPublishOfficial?: boolean;
  /**
   * `local` (défaut) : création d'une procédure personnelle ou d'entreprise.
   * `global` : publication dans les procédures officielles (back office).
   * `edit` : modification d'une procédure existante.
   *
   * MÊME formulaire, MÊMES champs dans les trois cas. C'est le point : créer,
   * publier et modifier ne doivent pas offrir trois vocabulaires différents.
   */
  mode?: 'local' | 'global' | 'edit';
  /** Procédure à modifier — requis en mode `edit`. */
  initial?: GlobalPlaybook;
  onCreated: (playbook: GlobalPlaybook) => void;
  onCancel: () => void;
}

/** Lit le contrat quelle que soit sa forme (liste historique ou objet). */
function contratDe(playbook?: GlobalPlaybook): PlaybookContract {
  const rules = playbook?.rules;
  if (!rules) return {};
  if (Array.isArray(rules)) return { rules };
  return rules;
}

const MIN_STEPS = 2;
const MAX_STEPS = 16;

function enLignes(valeur: string): string[] {
  return valeur.split('\n').map((l) => l.trim()).filter(Boolean);
}

export default function NewPlaybookForm({
  canWriteForCompany = false, canPublishOfficial = false,
  mode = 'local', initial, onCreated, onCancel,
}: NewPlaybookFormProps) {
  const { t } = useI18n();
  const f = t.components.copilot.newPlaybook;
  /** Marque visuelle des champs obligatoires : sans elle, l'auteur découvre la
   *  contrainte au moment du refus. */
  const obligatoire = <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>;

  const contrat = contratDe(initial);
  const [scope, setScope] = useState<'user' | 'tenant' | 'global'>(
    initial?.scope === 'tenant' ? 'tenant'
      : initial?.scope === 'global' ? 'global'
      : 'user',
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [triggers, setTriggers] = useState((contrat.triggers ?? []).join('\n'));
  const [preconditions, setPreconditions] = useState((contrat.preconditions ?? []).join('\n'));
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'));
  const [forbidden, setForbidden] = useState((contrat.forbidden_errors ?? []).join('\n'));
  const [evidence, setEvidence] = useState((contrat.expected_evidence ?? []).join('\n'));
  const [fallback, setFallback] = useState(contrat.fallback ?? '');
  const [saving, setSaving] = useState(false);

  // IMPORT d'un fichier `.md` : l'analyse est faite par le SERVEUR (les titres de
  // sections y sont imposes), puis les champs sont preremplis. Rien n'est
  // enregistre : l'utilisateur relit et corrige avant de valider.
  const fichierRef = useRef<HTMLInputElement>(null);
  const [important, setImportant] = useState(false);

  const importerFichier = async (fichier?: File) => {
    if (!fichier) return;
    setImportant(true);
    try {
      const contenu = await fichier.text();
      const vu = await parsePlaybookMarkdown(contenu);
      // On ne remplace un champ que si le fichier apporte quelque chose : un
      // import partiel ne doit pas EFFACER ce que l'utilisateur avait deja saisi.
      if (vu.titre) setTitle(vu.titre);
      const c = vu.champs || {};
      if (c.steps?.length) setSteps(c.steps.join('\n'));
      if (c.triggers?.length) setTriggers(c.triggers.join('\n'));
      if (c.preconditions?.length) setPreconditions(c.preconditions.join('\n'));
      if (c.forbidden_errors?.length) setForbidden(c.forbidden_errors.join('\n'));
      if (c.expected_evidence?.length) setEvidence(c.expected_evidence.join('\n'));
      if (c.fallback) setFallback(c.fallback);

      const reconnues = vu.sections_reconnues?.length ?? 0;
      if (reconnues === 0) {
        // Cas le plus trompeur : le fichier est lu, mais rien n'est reconnu. Le
        // dire clairement vaut mieux qu'un formulaire qui semble avoir bouge.
        toast.error(f.importNothing);
      } else {
        toast.success(f.importDone.replace('{n}', String(reconnues)));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setImportant(false);
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  const listeEtapes = enLignes(steps);
  /**
   * Ce qui manque pour pouvoir enregistrer, en clair. Un bouton grisé sans motif
   * laisse l'auteur deviner : ici la raison est affichée à côté du bouton.
   */
  const manques: string[] = [];
  if (!title.trim()) manques.push(f.missingTitle);
  if (listeEtapes.length < MIN_STEPS) {
    manques.push(f.missingSteps.replace('{min}', String(MIN_STEPS)));
  } else if (listeEtapes.length > MAX_STEPS) {
    manques.push(f.tooManySteps.replace('{max}', String(MAX_STEPS)));
  }
  const valide = manques.length === 0;

  const enregistrer = async () => {
    if (!valide) {
      toast.error(f.invalid.replace('{min}', String(MIN_STEPS)).replace('{max}', String(MAX_STEPS)));
      return;
    }
    setSaving(true);
    try {
      // Sections facultatives : on OMET celles qui sont vides plutôt que
      // d'envoyer une liste vide. « Non rempli » et « rempli avec rien » ne
      // doivent pas se ressembler côté serveur.
      const ouRien = (valeurs: string[]) => (valeurs.length ? valeurs : undefined);
      const commun = {
        title: title.trim(),
        steps: listeEtapes,
        triggers: ouRien(enLignes(triggers)),
        preconditions: ouRien(enLignes(preconditions)),
        forbidden_errors: ouRien(enLignes(forbidden)),
        expected_evidence: ouRien(enLignes(evidence)),
        fallback: fallback.trim() || undefined,
      };
      let resultat: GlobalPlaybook;
      // Publication officielle : soit le mode dédié (back office), soit la portée
      // choisie par un formateur depuis son propre espace. Même endpoint, même
      // contrôle serveur (`publish_global` revérifie le statut formateur).
      if (mode === 'global' || (mode === 'local' && scope === 'global')) {
        resultat = await publishGlobalPlaybook(commun);
      } else if (mode === 'edit' && initial) {
        // La mise à jour attend le contrat dans `rules` (colonne JSONB) : on y
        // repose les mêmes sections que celles saisies ici.
        const { title: titre, steps: etapes, ...contratSaisi } = commun;
        resultat = await updateMyPlaybook(initial.id, {
          title: titre,
          steps: etapes,
          rules: contratSaisi,
        });
      } else {
        resultat = await createMyPlaybook({
          ...commun,
          scope: scope === 'global' ? 'user' : scope,
        });
      }
      const officielle = mode === 'global' || (mode === 'local' && scope === 'global');
      toast.success(
        officielle ? f.published : mode === 'edit' ? f.updated : f.created,
      );
      onCreated(resultat);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const champ = (
    label: string,
    aide: string,
    valeur: string,
    setValeur: (v: string) => void,
    lignes = 3,
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <p className="text-[11px] text-gray-400 mb-1">{aide}</p>
      <textarea
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        rows={lignes}
        className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );

  return (
    <div className="border border-primary-200 bg-primary-50/40 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-primary-200/60">
        <input
          ref={fichierRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          className="hidden"
          onChange={(e) => void importerFichier(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fichierRef.current?.click()}
          disabled={important}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 bg-white border border-primary-300 rounded-lg px-2.5 py-1.5 hover:bg-primary-50 disabled:opacity-50 transition"
        >
          {important ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {f.importLabel}
        </button>
        <button
          type="button"
          onClick={() => void downloadPlaybookTemplate().catch((err) =>
            toast.error(err instanceof Error ? err.message : 'Erreur'),
          )}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary-700 px-2 py-1.5 rounded-lg hover:bg-white transition"
        >
          <FileDown size={13} /> {f.templateLabel}
        </button>
        <p className="text-[11px] text-gray-400 basis-full">{f.importHint}</p>
      </div>

      <p className="text-[11px] text-gray-400">
        {f.requiredLegend} <span className="text-red-500">*</span>
      </p>

      <div>
        <label className="block text-xs font-medium text-gray-700">
          {f.titleLabel}{obligatoire}
        </label>
        <p className="text-[11px] text-gray-400 mb-1">{f.titleHint}</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder={f.titlePlaceholder}
          className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {champ(f.triggersLabel, f.triggersHint, triggers, setTriggers, 2)}
      {champ(f.preconditionsLabel, f.preconditionsHint, preconditions, setPreconditions, 2)}

      <div>
        <label className="block text-xs font-medium text-gray-700">
          {f.stepsLabel}{obligatoire}
          <span className="ml-1 font-normal text-gray-400">
            ({listeEtapes.length}/{MAX_STEPS})
          </span>
        </label>
        <p className="text-[11px] text-gray-400 mb-1">{f.stepsHint}</p>
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={5}
          className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {champ(f.forbiddenLabel, f.forbiddenHint, forbidden, setForbidden, 2)}
      {champ(f.evidenceLabel, f.evidenceHint, evidence, setEvidence, 2)}
      {champ(f.fallbackLabel, f.fallbackHint, fallback, setFallback, 2)}

      {mode === 'local' && (canWriteForCompany || canPublishOfficial) && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{f.scopeLabel}</label>
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'user' as const, label: f.scopeMine, icon: <User size={13} />, visible: true },
              { key: 'tenant' as const, label: f.scopeCompany, icon: <Building2 size={13} />, visible: canWriteForCompany },
              { key: 'global' as const, label: f.scopeOfficial, icon: <Globe size={13} />, visible: canPublishOfficial },
            ]).filter((o) => o.visible).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setScope(option.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition ${
                  scope === option.key
                    ? 'border-primary-500 bg-white text-primary-700 font-medium'
                    : 'border-gray-300 text-gray-500 hover:bg-white'
                }`}
              >
                {option.icon} {option.label}
              </button>
            ))}
          </div>
          {scope === 'tenant' && (
            <p className="text-[11px] text-amber-700 mt-1.5">{f.scopeCompanyWarning}</p>
          )}
          {scope === 'global' && (
            <p className="text-[11px] text-red-700 mt-1.5">{f.scopeOfficialWarning}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => void enregistrer()}
          disabled={saving || !valide}
          className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary-700 transition disabled:opacity-50"
        >
          {saving ? <><Loader2 size={13} className="animate-spin" /> {f.saving}</> : f.save}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-white transition disabled:opacity-50"
        >
          {f.cancel}
        </button>
        {!valide && (
          <p className="text-[11px] text-amber-700">{manques.join(' · ')}</p>
        )}
      </div>
    </div>
  );
}
