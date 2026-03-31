/**
 * Capacitor Native Plugins
 * Utilitaires pour accéder aux fonctionnalités natives du téléphone
 * Utiliser ces fonctions à la place des APIs web standard pour compatibilité mobile
 */

import { Capacitor } from '@capacitor/core';

// Vérifier si l'app tourne sur un vrai appareil natif (Android/iOS)
export const isNative = () => Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// ─── NOTIFICATIONS PUSH ────────────────────────────────────────────────────────
export async function registerPushNotifications() {
  if (!isNative()) return null;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  // Demander la permission
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    console.warn('Permission notifications refusée');
    return null;
  }

  // S'enregistrer auprès du service de notifications
  await PushNotifications.register();

  // Écouter le token FCM (Firebase) / APNs
  PushNotifications.addListener('registration', (token) => {
    console.log('Push token:', token.value);
    // TODO: Envoyer ce token à l'API Targetym pour les notifications ciblées
  });

  // Écouter les notifications reçues en foreground
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Notification reçue:', notification);
  });

  // Écouter les clics sur notifications
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Notification cliquée:', action);
  });

  return PushNotifications;
}

// ─── CAMÉRA ────────────────────────────────────────────────────────────────────
export async function takePhoto() {
  if (!isNative()) {
    console.warn('Caméra native non disponible sur web');
    return null;
  }

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
  });

  return photo.dataUrl; // base64 image
}

export async function pickFromGallery() {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
  });

  return photo.dataUrl;
}

// ─── STOCKAGE LOCAL (remplacement de localStorage) ────────────────────────────
export async function setPreference(key: string, value: string) {
  if (!isNative()) {
    localStorage.setItem(key, value);
    return;
  }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key, value });
}

export async function getPreference(key: string): Promise<string | null> {
  if (!isNative()) {
    return localStorage.getItem(key);
  }
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key });
  return value;
}

export async function removePreference(key: string) {
  if (!isNative()) {
    localStorage.removeItem(key);
    return;
  }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key });
}

// ─── RETOUR HAPTIQUE ───────────────────────────────────────────────────────────
export async function vibrate(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isNative()) return;

  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  const styleMap = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  };
  await Haptics.impact({ style: styleMap[style] });
}

// ─── RÉSEAU ────────────────────────────────────────────────────────────────────
export async function getNetworkStatus() {
  const { Network } = await import('@capacitor/network');
  return Network.getStatus();
}

export async function onNetworkChange(
  callback: (connected: boolean) => void
) {
  const { Network } = await import('@capacitor/network');
  Network.addListener('networkStatusChange', (status) => {
    callback(status.connected);
  });
}
