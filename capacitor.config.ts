import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.dooz.game',
  appName: 'دوز',
  webDir: 'dist/mobile/browser',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#0E0E0E' },
};

export default config;
