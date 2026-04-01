import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Identifiant unique de l'application (format: com.entreprise.app)
  appId: 'com.targetym.app',

  // Nom affiché sur l'écran d'accueil du téléphone
  appName: 'Targetym',

  // Dossier de sortie du build Next.js (output: 'export')
  webDir: 'out',

  server: {
    // En développement, décommenter pour tester avec hot-reload :
    // url: 'http://192.168.1.5:3000',
    // cleartext: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#4F46E5',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'Default',
      backgroundColor: '#ffffff',
    },
  },

  android: {
    // Autoriser les requêtes HTTP vers l'API en développement
    allowMixedContent: true,
    // Activer le build en mode debug
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },

  ios: {
    contentInset: 'automatic',
  },
};

export default config;
