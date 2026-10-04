import { useSyncExternalStore } from "react";

/**
 * Chrome fires `beforeinstallprompt` once, early — usually before any
 * component that wants to offer an install button has mounted. So the event
 * is captured at module load and parked here; Settings reads it through
 * useInstallPrompt() whenever it happens to render.
 *
 * Browsers that don't support programmatic install (notably iOS Safari)
 * never fire the event, so `canInstall` stays false and the UI falls back to
 * telling the user how to do it by hand.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the browser's own mini-infobar from appearing so the app can
    // offer installation at a sensible moment instead.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

/** True when the app is already running as an installed app. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's non-standard flag.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  // The event can only be used once; Chrome re-fires it if still eligible.
  deferredPrompt = null;
  emit();
  return outcome;
}

let snapshot = { canInstall: false, installed: false };
function getSnapshot() {
  const canInstall = deferredPrompt !== null;
  if (snapshot.canInstall !== canInstall || snapshot.installed !== installed) {
    snapshot = { canInstall, installed };
  }
  return snapshot;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstallPrompt() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
