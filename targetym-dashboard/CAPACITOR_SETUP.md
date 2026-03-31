# Guide d'installation Capacitor — Targetym Mobile

## Prérequis

- Node.js >= 18
- Android Studio (pour Android)
- Xcode >= 14 + macOS (pour iOS)
- Un appareil Android/iOS ou un émulateur

---

## 1. Installer les dépendances

```bash
cd targetym-dashboard
npm install
```

---

## 2. Initialiser Capacitor (première fois uniquement)

```bash
npx cap init
```

Répondre aux questions :
- App name: `Targetym`
- App ID: `com.targetym.app`
- Web dir: `out`

---

## 3. Ajouter les plateformes

```bash
# Android
npx cap add android

# iOS (Mac uniquement)
npx cap add ios
```

---

## 4. Builder et synchroniser

```bash
# Build Next.js en export statique + sync Capacitor
npm run mobile:build
```

Cette commande effectue :
1. `next build` → génère le dossier `out/`
2. `npx cap sync` → copie `out/` dans les projets Android/iOS

---

## 5. Ouvrir dans Android Studio / Xcode

```bash
# Android
npm run mobile:android

# iOS
npm run mobile:ios
```

---

## 6. Workflow de développement

### Développement rapide avec live reload

Dans `capacitor.config.ts`, décommenter la ligne `url` avec votre IP locale :

```ts
server: {
  url: 'http://192.168.1.XXX:3000',  // Remplacer par votre IP
  cleartext: true,
}
```

Puis lancer :

```bash
# Terminal 1 - Serveur Next.js
npm run dev

# Terminal 2 - Sync et ouvrir Android
npx cap sync && npx cap open android
```

### Build de production

```bash
npm run mobile:build
```

---

## Plugins natifs disponibles

| Plugin | Usage |
|--------|-------|
| `@capacitor/push-notifications` | Notifications push (FCM/APNs) |
| `@capacitor/camera` | Photo / galerie |
| `@capacitor/filesystem` | Accès fichiers locaux |
| `@capacitor/preferences` | Stockage local persistant |
| `@capacitor/status-bar` | Couleur barre de statut |
| `@capacitor/splash-screen` | Écran de démarrage |
| `@capacitor/haptics` | Retour vibratoire |
| `@capacitor/network` | Détection connexion réseau |

Utiliser les fonctions depuis `lib/capacitor-plugins.ts` :

```ts
import { takePhoto, registerPushNotifications, isNative } from '@/lib/capacitor-plugins';

// Vérifier si on est sur mobile
if (isNative()) {
  await registerPushNotifications();
}

// Prendre une photo
const imageDataUrl = await takePhoto();
```

---

## Points importants

### Export statique Next.js
- `output: 'export'` dans `next.config.mjs` est requis
- Les **Server Components** qui font des appels serveur ne fonctionnent pas
- Les **Server Actions** ne sont pas supportées
- Utiliser `fetch()` côté client vers l'API Targetym à la place

### Gestion des routes
- `trailingSlash: true` est activé pour la compatibilité fichiers statiques
- La navigation fonctionne via le router Next.js (client-side)

### Images
- `images.unoptimized: true` est activé
- Les images distantes sont chargées normalement via `<img>` ou `next/image`

---

## Dépannage

### "Cannot find module '@capacitor/core'"
```bash
npm install
```

### Build Android échoue
- Vérifier que Android Studio est installé
- Accepter les licences SDK : `sdkmanager --licenses`

### App blanche au démarrage
- Vérifier que le dossier `out/` existe : `npm run build`
- Vérifier que `webDir: 'out'` dans `capacitor.config.ts`

### Requêtes API bloquées sur Android
- Ajouter `allowMixedContent: true` dans `capacitor.config.ts` (déjà fait)
- En production, utiliser HTTPS pour l'API
