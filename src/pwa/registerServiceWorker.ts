/**
 * Registers the offline service worker in production builds. `updateViaCache:
 * 'none'` makes the browser check sw.js past the HTTP cache on every visit, so
 * a new deploy is picked up on the next launch.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((err: unknown) => {
      console.warn('Offline play is unavailable:', err);
    });
  });
}
