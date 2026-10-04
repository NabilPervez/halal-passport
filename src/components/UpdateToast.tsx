import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// How often an already-open app re-checks for a new deploy. A PWA that's
// been left open (or an installed app resumed from background) otherwise
// only looks for a new service worker on a cold navigation, which is how a
// stale build can keep serving itself for days.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Surfaces service-worker lifecycle to the user: a toast when a new build
 * is waiting (with the reload that activates it) and a one-off confirmation
 * the first time the app is cached for offline use.
 */
export function UpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        // Don't bother the network while the app is backgrounded or offline.
        if (document.visibilityState !== "visible" || !navigator.onLine) return;
        registration.update().catch(() => {
          /* transient — the next check will retry */
        });
      };
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", check);
    },
  });

  // Auto-dismiss the offline-ready note; the update one stays until acted on.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-[70] mx-auto max-w-sm rounded-xl2 border border-base-border bg-base-elevated2 p-4 shadow-card"
    >
      {needRefresh ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-body text-cream">A new version is available.</p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setNeedRefresh(false)}
              className="rounded-full px-3 py-1.5 text-xs font-body font-medium text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"
            >
              Later
            </button>
            <button
              onClick={() => updateServiceWorker(true)}
              className="rounded-full bg-emerald px-3.5 py-1.5 text-xs font-display font-semibold text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
            >
              Reload
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-body text-cream">✓ Ready to use offline.</p>
      )}
    </div>
  );
}
