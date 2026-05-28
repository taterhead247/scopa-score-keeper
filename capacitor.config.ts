import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vin.evan.scopa',
  appName: 'Scopa Score',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Matches @drawable/splash background — keeps the launcher splash and
      // any Capacitor-managed splash visually identical.
      backgroundColor: '#2563eb',
      // Don't show the legacy spinner; the splash is brief enough that
      // adding a spinner reads as "loading", not "branded launch".
      showSpinner: false,
      // Brief launch flash — the React app hydrates fast over local SQLite,
      // so 1.5s is enough to register without feeling sluggish.
      launchShowDuration: 1500,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
