import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.targetym.app',
  appName: 'Targetym AI',
  webDir: 'out',
  server: {},
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#4F46E5'
    },
    PushNotifications: {
      presentationOptions: [
        'badge',
        'sound',
        'alert'
      ]
    },
    StatusBar: {
      style: 'Default',
      backgroundColor: '#ffffff'
    },
    CapacitorUpdater: {
      autoUpdate: true,
      appReadyTimeout: 10000,
      defaultChannel: 'production',
      appId: 'com.targetym.app',
      version: '0.0.0',
      publicKey: '-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEA1Bztpp6QhsYHAR8doZCyhlS/cBMJNilO6nin8mC8PaCi0XV/HG1N\nLV/ujaL/HjLtreMlLG58IEY1CvykEpdcXSpz7S4WsvCSRQayI6CqxHwPYC9Cww5F\noOTy4+EEZrMGc8efBPNG4dVxXD8IrjgDrVRUUUXvBkVtTd0DnUMO5TokxDihySk2\n8scmWOueHvxoJMNwbs8N2CpR/F/JRTGs41nr62HmmCCNCUiAi0RGfRpmc0IeW+EB\nlwVJuWxR45J+0bX1u/mgg4EXkGHuWy5mPGozb5fTE9PsJDiAVWQGu6WCewuZzmF5\nzJMsa8ABcgKvcEmGpUzpMKNXWXFmL6TJiwIDAQAB\n-----END RSA PUBLIC KEY-----\n'
    }
  },
  android: {
    allowMixedContent: true,
    buildOptions: {}
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
