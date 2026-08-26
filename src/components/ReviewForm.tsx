import { useState } from "react";
import type { DietaryTag, PricePoint, Review } from "../types";
import { GemRating } from "./GemRating";

const ALL_TAGS: DietaryTag[] = [
  "Zabihah Halal",
  "Dairy-Free",
  "Vegetarian Options",
  "Vegan Options",
  "Nut-Free",
  "Gluten-Free Options",
];
const ALL_PRICES: PricePoint[] = ["$", "$$", "$$$"];

interface ReviewFormProps {
  restaurantId: string;
  existing?: Review;
  onSubmit: (review: Review) => void;
  onCancel: () => void;
}

export function ReviewForm({ restaurantId, existing, onSubmit, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(existing?.rating ?? 5);
  const [whatToGet, setWhatToGet] = useState(existing?.whatToGet ?? "");
  const [whatToAvoid, setWhatToAvoid] = useState(existing?.whatToAvoid ?? "");
  const [pricePoint, setPricePoint] = useState<PricePoint>(existing?.pricePoint ?? "$$");
  const [tags, setTags] = useState<DietaryTag[]>(existing?.dietaryTags ?? ["Zabihah Halal"]);

  function toggleTag(tag: DietaryTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      id: existing?.id ?? `review-${restaurantId}-${Date.now()}`,
      restaurantId,
      rating,
      whatToGet,
      whatToAvoid,
      pricePoint,
      dietaryTags: tags,
      createdAt: existing?.createdAt ?? Date.now(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted font-body mb-2">Rating</label>
        <GemRating value={rating} onChange={setRating} size="lg" />
      </div>

      <div>
        <label htmlFor="whatToGet" className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">
          What to get
        </label>
        <textarea
          id="whatToGet"
          value={whatToGet}
          onChange={(e) => setWhatToGet(e.target.value)}
          placeholder="The dish worth ordering again"
          rows={2}
          className="w-full rounded-lg bg-base-elevated2 border border-base-border px-3 py-2 text-sm font-body text-cream placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emerald resize-none"
        />
      </div>

      <div>
        <label htmlFor="whatToAvoid" className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">
          What to avoid
        </label>
        <textarea
          id="whatToAvoid"
          value={whatToAvoid}
          onChange={(e) => setWhatToAvoid(e.target.value)}
          placeholder="Skip this one next time"
          rows={2}
          className="w-full rounded-lg bg-base-elevated2 border border-base-border px-3 py-2 text-sm font-body text-cream placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emerald resize-none"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">Price point</label>
        <div className="flex gap-2" role="radiogroup" aria-label="Price point">
          {ALL_PRICES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={pricePoint === p}
              onClick={() => setPricePoint(p)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${
                pricePoint === p
                  ? "bg-emerald-soft border-emerald-deep text-emerald"
                  : "bg-base-elevated2 border-base-border text-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted font-body mb-1.5">Dietary tags</label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Dietary tags">
          {ALL_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1.5 text-xs font-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${
                  active
                    ? "bg-amethyst-soft border-amethyst-deep text-amethyst"
                    : "bg-base-elevated2 border-base-border text-muted"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-base-border py-2.5 text-sm font-display font-semibold text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 rounded-full bg-emerald text-base py-2.5 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
        >
          Save review
        </button>
      </div>
    </form>
  );
}
