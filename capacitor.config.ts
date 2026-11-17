import type { CapacitorConfig } from '@capacitor/cli';

const remoteServerUrl = String(process.env.ZONESTREAM_SERVER_URL || '').trim();

const config: CapacitorConfig = {
  appId: 'com.zonestream.app',
  appName: 'ZoneStream',
  webDir: 'dist',
  backgroundColor: '#090A0E',
  ...(remoteServerUrl
    ? {
        server: {
          url: remoteServerUrl,
          cleartext: remoteServerUrl.startsWith('http://'),
        },
      }
    : {}),
  android: {
    allowMixedContent: true,
    backgroundColor: '#090A0E',
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
