/**
 * Registers the offline service worker in production builds. `updateViaCache:
 * 'none'` makes update checks skip the HTTP cache. Checks run on every launch
 * and whenever the game comes back to the foreground, because a Home Screen
 * app on iPad often resumes without reloading, which would never check.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => void register());
}

async function register(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    const checkForUpdate = () => registration.update().catch(() => {}); // offline: try again next time
    void checkForUpdate();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    });
  } catch (err) {
    console.warn('Offline play is unavailable:', err);
  }
}
