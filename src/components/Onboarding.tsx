import { useState } from "react";

const STORAGE_KEY = "hp:onboarded";

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // storage blocked — don't nag on every launch
  }
}

function markOnboarded() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

const STEPS = [
  {
    icon: "🕌",
    title: "Halal spots across DFW",
    body: "Browse real, geocoded halal restaurants and mosques on the map — filter by cuisine, distance, and halal level.",
  },
  {
    icon: "🔒",
    title: "Everything stays on your device",
    body: "Your wishlist, reviews, and anything you add live only in this browser. Nothing is sent to a server, and nothing syncs between devices.",
  },
  {
    icon: "✓",
    title: "Help confirm what's halal",
    body: "Most listings start \"unverified\" — matched from a directory, not confirmed. If you know a spot, mark its halal level. You can also add spots that aren't here yet.",
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  function finish() {
    markOnboarded();
    onDone();
  }

  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center bg-base">
      <div className="w-full sm:max-w-md sm:rounded-xl2 bg-base-elevated sm:border border-base-border p-8 flex flex-col min-h-[70vh] sm:min-h-0">
        <p className="text-xs uppercase tracking-widest text-emerald font-body font-semibold">
          Halal Passport · DFW
        </p>

        <div className="flex-1 flex flex-col justify-center py-10">
          <div key={step}>
            <div className="text-5xl mb-5">{s.icon}</div>
            <h2 className="font-display font-extrabold text-2xl text-cream mb-3">{s.title}</h2>
            <p className="text-sm font-body text-muted leading-relaxed">{s.body}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? "w-6 bg-emerald" : "w-1.5 bg-base-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-sm font-body text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald rounded"
          >
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep((n) => n + 1))}
            className="rounded-full bg-emerald text-base px-6 py-2.5 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
