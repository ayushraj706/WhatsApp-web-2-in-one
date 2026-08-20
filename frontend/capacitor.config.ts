import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.whatsappsaas',
  appName: 'WA SaaS Clone',
  webDir: 'out',              // Next.js static export output (see next.config.js CAPACITOR_BUILD flag)
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
