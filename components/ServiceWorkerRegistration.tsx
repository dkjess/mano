'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Temporarily disable service worker to fix deployment issues
    if ('serviceWorker' in navigator) {
      // Unregister existing service worker
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      
      console.log('Service Worker disabled temporarily for deployment fixes');
    }
  }, []);

  return null;
} 