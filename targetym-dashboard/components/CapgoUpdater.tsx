'use client';

import { useEffect } from 'react';

export default function CapgoUpdater() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

        // Indique au plugin que l'app a bien démarré (évite le rollback auto)
        await CapacitorUpdater.notifyAppReady();

        if (cancelled) return;

        // Écoute la fin de téléchargement d'une nouvelle version
        CapacitorUpdater.addListener('updateAvailable', async (info) => {
          console.log('Capgo: nouvelle version téléchargée', info);
          try {
            // Applique la mise à jour immédiatement (reload)
            await CapacitorUpdater.set(info.bundle);
          } catch (e) {
            console.error('Capgo: erreur application update', e);
          }
        });

        // Force une vérification immédiate au démarrage
        try {
          const latest = await CapacitorUpdater.getLatest();
          console.log('Capgo: dernière version disponible', latest);
        } catch (e) {
          console.warn('Capgo: getLatest indisponible', e);
        }
      } catch (e) {
        console.warn('Capgo: plugin non initialisé', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
