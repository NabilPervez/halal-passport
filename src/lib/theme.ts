import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "hp:theme";

function readStoredPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode / blocked storage */
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

/** Applies a resolved theme to <html> and the PWA theme-color meta. */
function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#F7F4ED" : "#0E0E12");
}

// ─── Shared store ───────────────────────────────────────────────────────
// Every useTheme() consumer subscribes to the same state, so changing the
// theme in Settings restyles the whole app (including the map) at once.

let currentPref: ThemePref = readStoredPref();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setThemePref(pref: ThemePref) {
  currentPref = pref;
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  applyResolvedTheme(resolveTheme(pref));
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // While anyone is subscribed, keep "system" in sync with the OS.
  const mq = window.matchMedia?.("(prefers-color-scheme: light)");
  const onOsChange = () => {
    if (currentPref === "system") {
      applyResolvedTheme(resolveTheme("system"));
      emit();
    }
  };
  mq?.addEventListener("change", onOsChange);
  return () => {
    listeners.delete(cb);
    mq?.removeEventListener("change", onOsChange);
  };
}

// Snapshot must be referentially stable between renders when unchanged, or
// useSyncExternalStore loops — cache a {pref, resolved} object and only
// rebuild it when either value actually changes.
let snapshot = { pref: currentPref, resolved: resolveTheme(currentPref) };
function getSnapshot() {
  const resolved = resolveTheme(currentPref);
  if (snapshot.pref !== currentPref || snapshot.resolved !== resolved) {
    snapshot = { pref: currentPref, resolved };
  }
  return snapshot;
}

/** [pref, setPref, resolved] — shared across all consumers. */
export function useTheme(): [ThemePref, (p: ThemePref) => void, ResolvedTheme] {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [s.pref, setThemePref, s.resolved];
}
