import { useEffect, useState } from "react";
import { useTheme, type ThemePref } from "../lib/theme";
import { exportUserData, clearUserData, getUserDataStats, type UserDataStats } from "../lib/db";

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsView({ onClose }: { onClose: () => void }) {
  const [themePref, setThemePref] = useTheme();
  const [stats, setStats] = useState<UserDataStats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getUserDataStats().then(setStats);
  }, []);

  async function handleExport() {
    setBusy(true);
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `halal-passport-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    await clearUserData();
    // Simplest reliable way to reset all in-memory state.
    window.location.reload();
  }

  function replayOnboarding() {
    try {
      localStorage.removeItem("hp:onboarded");
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-50 bg-base overflow-y-auto">
      <header className="sticky top-0 bg-base border-b border-base-border px-5 py-4 flex items-center gap-3 max-w-md mx-auto sm:max-w-3xl">
        <button
          onClick={onClose}
          aria-label="Back"
          className="rounded-full w-8 h-8 flex items-center justify-center border border-base-border text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"
        >
          ←
        </button>
        <h1 className="font-display font-extrabold text-xl text-cream">Settings</h1>
      </header>

      <main className="px-5 py-6 max-w-md mx-auto sm:max-w-3xl flex flex-col gap-8 pb-24">
        {/* Appearance */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wider text-muted font-body font-semibold">Appearance</h2>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThemePref(opt.value)}
                aria-pressed={themePref === opt.value}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${
                  themePref === opt.value
                    ? "bg-emerald-soft border-emerald-deep text-emerald"
                    : "bg-base-elevated border-base-border text-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Your data */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wider text-muted font-body font-semibold">Your data</h2>
          <p className="text-xs font-body text-muted leading-relaxed">
            Everything below lives only in this browser — there's no account and nothing syncs to other
            devices. Clearing your browser data, or switching devices, loses it unless you export first.
          </p>

          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Saved" value={stats.saved} />
              <Stat label="Reviews" value={stats.reviews} />
              <Stat label="Added spots" value={stats.addedRestaurants} />
              <Stat label="Halal marks" value={stats.halalMarks} />
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={busy}
            className="rounded-lg bg-base-elevated border border-base-border text-cream py-2.5 text-sm font-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald disabled:opacity-60"
          >
            Export my data (.json)
          </button>

          {confirmClear ? (
            <div className="flex flex-col gap-2 p-3 rounded-lg border border-ruby-deep/60 bg-ruby-soft">
              <p className="text-xs font-body text-ruby leading-snug">
                This permanently deletes your wishlist, reviews, halal marks, RSVPs, and any spots you
                added. The restaurant catalog stays. This can't be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 rounded-full border border-base-border py-2 text-sm font-body font-medium text-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClear}
                  disabled={busy}
                  className="flex-1 rounded-full bg-ruby text-base py-2 text-sm font-display font-semibold disabled:opacity-60"
                >
                  {busy ? "Clearing…" : "Delete everything"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="rounded-lg border border-ruby-deep/50 text-ruby py-2.5 text-sm font-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ruby"
            >
              Clear all local data
            </button>
          )}
        </section>

        {/* About */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wider text-muted font-body font-semibold">About</h2>
          <p className="text-xs font-body text-muted">
            Version {__APP_VERSION__} · build {__APP_COMMIT__}
          </p>
          <p className="text-xs font-body text-muted leading-relaxed">
            Map &amp; location data © OpenStreetMap contributors,{" "}
            <a
              href="https://opendatacommons.org/licenses/odbl/"
              target="_blank"
              rel="noreferrer"
              className="text-emerald underline"
            >
              ODbL
            </a>
            , via Geoapify.
          </p>
          <button
            onClick={replayOnboarding}
            className="self-start text-xs font-body text-emerald underline mt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald rounded"
          >
            Replay the intro
          </button>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-base-elevated border border-base-border p-3">
      <p className="font-display font-bold text-xl text-cream">{value}</p>
      <p className="text-xs font-body text-muted">{label}</p>
    </div>
  );
}
