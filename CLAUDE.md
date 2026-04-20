# Targetym Dashboard — Claude Code Guide

Dashboard RH (Ressources Humaines) Next.js 16 / React 18 / TypeScript 5.
Déployé sur Vercel. Multilingue FR / EN / PT.

## Stack

- **Framework** : Next.js 16 (App Router) + React 18
- **Langage** : TypeScript strict
- **Styles** : Tailwind CSS 3.4 + PostCSS
- **Icônes** : lucide-react
- **Charts** : recharts
- **PDF / Excel** : jspdf, xlsx
- **Markdown** : react-markdown + remark-gfm
- **Notifications** : react-hot-toast
- **Lint** : eslint 9 + eslint-config-next
- **i18n** : `lib/i18n/` (FR / EN / PT) via hook `useI18n()`

## Arborescence

```
app/             → routes App Router (dashboard, help, page.tsx, layout.tsx)
components/      → composants React (Modals, Tabs, Header, AI, Forms…)
lib/             → api.ts, payrollApi.ts, generateEmployeePDF.ts, i18n/
hooks/           → hooks custom
context/         → providers React (auth, groupe, i18n…)
config/          → config applicative
data/            → données statiques / mocks
public/          → assets
```

## Conventions

### i18n (CRITIQUE)
- **Tout texte UI passe par `t('clé')`** — jamais de littéraux FR/EN/PT en dur
- Ajouter une clé dans les **trois** fichiers : `lib/i18n/fr.ts`, `en.ts`, `pt.ts`
- Appeler `const { t } = useI18n()` en haut de chaque composant qui affiche du texte
- Bug récurrent : oublier `useI18n()` dans un Modal casse le build Vercel (voir commits récents)

### Composants
- PascalCase, un composant par fichier
- Modals : suffixe `Modal` (ex : `EditCandidateModal.tsx`)
- Tabs : suffixe `Tab` (ex : `AbsencesTab.tsx`)
- Préférer composition à duplication

### TypeScript
- `any` interdit sans justification en commentaire
- Types explicites pour props de composants (pas d'inférence implicite)
- Pas de `as` cast sauf après validation runtime

### Code style
- Immutable par défaut (spread, map, filter)
- Early returns pour éviter la nidification
- Fonctions < 50 lignes, fichiers < 800 lignes
- Pas de `console.log` committé

## Workflow Vercel

1. Build Vercel échoue fréquemment sur erreurs TypeScript / imports i18n manquants
2. **Avant push** : toujours `npm run build` localement
3. Si build casse → utiliser l'agent `build-error-resolver` ou la commande `/build-fix`
4. Vérifier que `useI18n()` est bien appelé dans tout composant qui utilise `t()`

## Commandes slash (.claude/commands)

- `/feature-dev` — développement guidé d'une nouvelle fonctionnalité
- `/code-review` — revue du diff local ou d'une PR
- `/review-pr` — revue PR multi-agents
- `/build-fix` — correction incrémentale d'erreurs de build
- `/fix-bug` — workflow de debug frontend
- `/new-component` — scaffold composant Next.js
- `/test-page` — test d'une page sur dashboard.targetym.ai

## Agents disponibles (.claude/agents)

| Agent | Usage |
|-------|-------|
| `typescript-reviewer` | Revue type-safety, async, sécurité web |
| `build-error-resolver` | Corrige build Vercel / TS errors (priorité) |
| `code-reviewer` | Revue qualité / sécurité généraliste |
| `security-reviewer` | OWASP, secrets, auth, input validation |
| `planner` | Plan d'implémentation pour features complexes |
| `refactor-cleaner` | Nettoyage de code mort |
| `doc-updater` | Mise à jour README / docs |
| `e2e-runner` | Tests E2E Playwright |

## Checklist avant commit

- [ ] `npm run build` passe localement
- [ ] Textes UI traduits dans FR / EN / PT
- [ ] `useI18n()` appelé dans chaque composant qui utilise `t()`
- [ ] Pas de secret hard-codé (clés API, tokens)
- [ ] Pas de `console.log` résiduel
- [ ] Types explicites (pas de `any` non justifié)

## Hook actif

`.claude/hooks/check_sensitive.py` — bloque les Read/Write/Edit sur fichiers sensibles (`.env`, credentials…).

## Langue

Répondre à l'utilisateur en **français**. Les identifiants de code, commits et logs restent en anglais.
