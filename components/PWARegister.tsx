'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        registration.update().catch(() => undefined);
      } catch (error) {
        console.warn('MedIntel Pro service worker registration failed:', error);
      }
    };

    if (document.readyState === 'complete') {
      void registerServiceWorker();
      return;
    }

    window.addEventListener('load', registerServiceWorker);
    return () => window.removeEventListener('load', registerServiceWorker);
  }, []);

  return null;
}
