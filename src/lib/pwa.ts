// Called only in the production build. Updates require explicit user action.
export function registerPwa(onUpdate: () => void): () => Promise<void> {
  let registration: ServiceWorkerRegistration | undefined;
  let applying = false;
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (applying) window.location.reload();
    });
    void navigator.serviceWorker.register('/sw.js').then(result => {
      registration = result;
      if (result.waiting && navigator.serviceWorker.controller) onUpdate();
      result.addEventListener('updatefound', () => {
        const worker = result.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdate();
        });
      });
    }).catch(() => { /* A blocked service worker must not block the online workflow. */ });
  }
  return async () => {
    if (!registration?.waiting) return;
    applying = true;
    registration.waiting.postMessage('SKIP_WAITING');
  };
}
