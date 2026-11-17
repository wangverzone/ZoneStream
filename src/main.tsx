import { installCapacitorApiBridge, isNativeCapacitorRuntime } from './utils/apiBase';

installCapacitorApiBridge();

import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isNativeCapacitor = isNativeCapacitorRuntime();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isNativeCapacitor) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
