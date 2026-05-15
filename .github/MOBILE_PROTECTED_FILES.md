# Synchronisation web → mobile (mode additif)

Le workflow `.github/workflows/sync-web.yml` s'exécute **chaque jour à 8h UTC**.

## Mode additif uniquement

Le workflow **n'écrase JAMAIS** un fichier existant côté mobile.
Il **ajoute uniquement** les **nouveaux fichiers** créés sur le repo web qui n'existent pas encore côté mobile.

### Concrètement

| Cas | Comportement |
|-----|-------------|
| Fichier nouveau sur le web (n'existe pas en mobile) | ✅ Ajouté |
| Fichier existant en mobile, modifié sur le web | ⏭️ Ignoré (préservé tel quel) |
| Fichier supprimé sur le web | ⏭️ Ignoré |
| Fichier modifié seulement en mobile | ⏭️ Ignoré |

## Pourquoi ce mode ?

Le mobile contient :
- Des composants mobile-only (`CustomSelect`, `CustomDatePicker`, `CustomTimePicker`, `BottomNav`, drawer Sidebar, etc.)
- Des modifications de pages pour la responsivité
- Des champs API étendus (NIR, HR Programs, AI Scoring, Webinars, Backup, Addon Gate)
- Des dépendances Capacitor

Ces modifs ne doivent **jamais** être écrasées par une sync automatique.

## Que faire pour récupérer une mise à jour d'un fichier existant ?

La sync ne le fait pas automatiquement. Procédure manuelle :

1. Identifier le fichier modifié sur le web :
   ```bash
   git -C "/c/Users/USER/Targetym AI/targetym-dashboard" diff --name-only HEAD upstream/main
   ```
2. Comparer / merger manuellement
3. Tester `npm run mobile:build`
4. Commit

## Sortie du workflow

À chaque run, le workflow log :
- Nombre de **nouveaux fichiers ajoutés**
- Liste des **fichiers existants ignorés** (avec rappel de faire un merge manuel si besoin)

Cela permet de voir d'un coup d'œil quels fichiers du web ont changé sans être synchronisés.
