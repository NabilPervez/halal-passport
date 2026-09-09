import { useState } from "react";
import { motion } from "framer-motion";
import type { HalalStatus, Restaurant } from "../types";
import { geocodeAddress, type GeocodeCandidate } from "../lib/geocode";
import { addUserRestaurant } from "../lib/db";

interface AddRestaurantFormProps {
  onClose: () => void;
  onAdded: (restaurant: Restaurant) => void;
}

type Step = "details" | "picking" | "confirm";

const HALAL_LEVEL_OPTIONS: { value: HalalStatus; label: string; help: string }[] = [
  {
    value: "verified-zabihah",
    label: "Fully halal (Zabihah)",
    help: "The whole menu/kitchen is halal.",
  },
  {
    value: "halal-options",
    label: "Has halal options",
    help: "Some menu items are halal, not the whole place.",
  },
  { value: "unverified", label: "Not sure yet", help: "Someone can confirm this later." },
];

export function AddRestaurantForm({ onClose, onAdded }: AddRestaurantFormProps) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [halalStatus, setHalalStatusValue] = useState<HalalStatus>("unverified");
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [selected, setSelected] = useState<GeocodeCandidate | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFindLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setError(null);
    setSearching(true);
    try {
      const results = await geocodeAddress(address.trim());
      if (results.length === 0) {
        setError(
          "Couldn't find that address in the DFW area. Try adding a street number, city, or zip code."
        );
        setSearching(false);
        return;
      }
      setCandidates(results);
      setStep("picking");
    } catch {
      setError("Couldn't reach the map service. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  function handlePick(candidate: GeocodeCandidate) {
    setSelected(candidate);
    setStep("confirm");
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const restaurant = await addUserRestaurant({
        name: name.trim(),
        address: selected.address,
        city: selected.city,
        lat: selected.lat,
        lng: selected.lng,
        cuisine: cuisine.trim() || null,
        halalStatus,
      });
      onAdded(restaurant);
      onClose();
    } catch {
      setError("Couldn't save this restaurant. Try again.");
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="w-full sm:max-w-md sm:rounded-xl2 rounded-t-xl2 bg-base-elevated border border-base-border max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-base-elevated border-b border-base-border px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-cream">Add a halal spot</h2>
            <p className="text-sm text-muted font-body">Found somewhere that's not on here yet?</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full w-8 h-8 flex items-center justify-center border border-base-border text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {step === "details" && (
            <form onSubmit={handleFindLocation} className="flex flex-col gap-4">
              <div>
                <label htmlFor="add-name" className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">
                  Name
                </label>
                <input
                  id="add-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wulf Burger"
                  required
                  className="w-full rounded-lg bg-base-elevated2 border border-base-border px-3 py-2.5 text-sm font-body text-cream placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>

              <div>
                <label htmlFor="add-address" className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">
                  Address
                </label>
                <input
                  id="add-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, city, zip"
                  required
                  className="w-full rounded-lg bg-base-elevated2 border border-base-border px-3 py-2.5 text-sm font-body text-cream placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emerald"
                />
                <p className="text-xs text-muted font-body mt-1">
                  We'll look this up to get a real pin on the map — vague addresses won't be accepted.
                </p>
              </div>

              <div>
                <label htmlFor="add-cuisine" className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">
                  Cuisine <span className="normal-case text-muted/70">(optional)</span>
                </label>
                <input
                  id="add-cuisine"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  placeholder="e.g. Pakistani, Pizza, Coffee shop"
                  className="w-full rounded-lg bg-base-elevated2 border border-base-border px-3 py-2.5 text-sm font-body text-cream placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">Halal level</label>
                <div className="flex flex-col gap-2">
                  {HALAL_LEVEL_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        halalStatus === opt.value
                          ? "bg-emerald-soft border-emerald-deep/60"
                          : "bg-base-elevated2 border-base-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="halal-level"
                        value={opt.value}
                        checked={halalStatus === opt.value}
                        onChange={() => setHalalStatusValue(opt.value)}
                        className="mt-0.5 accent-emerald"
                      />
                      <span>
                        <span className="block text-sm font-body font-semibold text-cream">{opt.label}</span>
                        <span className="block text-xs font-body text-muted">{opt.help}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted font-body mt-2">
                  This is recorded on your device only — it isn't shared with other users, the same as marking an
                  existing listing verified.
                </p>
              </div>

              {error && <p className="text-xs font-body text-ruby">{error}</p>}

              <button
                type="submit"
                disabled={searching}
                className="rounded-full bg-emerald text-base px-4 py-2.5 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream disabled:opacity-60"
              >
                {searching ? "Looking up address…" : "Find location"}
              </button>
            </form>
          )}

          {step === "picking" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-body text-muted">
                Found {candidates.length} match{candidates.length !== 1 ? "es" : ""} — pick the right one:
              </p>
              {candidates.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handlePick(c)}
                  className="text-left p-3 rounded-lg border border-base-border bg-base-elevated2 hover:border-emerald/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"
                >
                  <span className="block text-sm font-body text-cream">{c.address}</span>
                  {!c.isPoi && (
                    <span className="block text-xs font-body text-topaz mt-1">
                      ⚠ This is a street-level match, not an exact business — double check it's right.
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setStep("details")}
                className="text-xs font-body text-muted underline self-start"
              >
                ← Back
              </button>
            </div>
          )}

          {step === "confirm" && selected && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 bg-base-elevated2 rounded-xl border border-base-border">
                <p className="font-display font-semibold text-cream">{name}</p>
                <p className="text-sm text-muted font-body mt-1">{selected.address}</p>
              </div>
              {error && <p className="text-xs font-body text-ruby">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("picking")}
                  className="flex-1 rounded-full border border-base-border py-2.5 text-sm font-display font-semibold text-muted"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-[2] rounded-full bg-emerald text-base py-2.5 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Add this spot"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
