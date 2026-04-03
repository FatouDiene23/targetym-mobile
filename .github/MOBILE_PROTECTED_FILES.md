# Fichiers protégés lors de la synchronisation web → mobile

Ces fichiers ne sont PAS écrasés par le workflow de sync automatique :

- `targetym-dashboard/capacitor.config.ts` — config Capacitor (mobile)
- `targetym-dashboard/next.config.mjs` — config Next.js (output: export pour mobile)
- `targetym-dashboard/components/BottomNav.tsx` — navigation mobile bottom bar
- `targetym-dashboard/android/` — projet Android natif
- Dépendances `@capacitor/*` et `cross-env` dans `package.json`
