import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.devnoteshub.app',
  appName: 'DevNotes Hub',
  webDir: 'public',
  server: {
    url: 'https://devnotes-hub.vercel.app',
    cleartext: true
  }
};

export default config;
