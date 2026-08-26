import { useState } from "react";

interface GemRatingProps {
  value: number;
  onChange?: (value: 1 | 2 | 3 | 4 | 5) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
}

const SIZES = { sm: "w-3.5 h-3.5", md: "w-5 h-5", lg: "w-7 h-7" };

export const RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Not good",
  2: "Passable",
  3: "Would go again",
  4: "Would take a friend",
  5: "Would post about it 📲",
};

export function GemRating({ value, onChange, size = "md", readOnly }: GemRatingProps) {
  const [hovered, setHovered] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const stars = [1, 2, 3, 4, 5] as const;
  const activeRating = hovered ?? (value as 1 | 2 | 3 | 4 | 5);
  const label = RATING_LABELS[activeRating];

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex items-center gap-1"
        role={readOnly ? "img" : "radiogroup"}
        aria-label={`Rating: ${value} out of 5 — ${RATING_LABELS[value as 1 | 2 | 3 | 4 | 5]}`}
      >
        {stars.map((n) => {
          const filled = n <= (hovered ?? value);
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              role={readOnly ? undefined : "radio"}
              aria-checked={readOnly ? undefined : n <= value}
              aria-label={`${n} — ${RATING_LABELS[n]}`}
              title={RATING_LABELS[n]}
              onClick={() => onChange?.(n)}
              onMouseEnter={() => !readOnly && setHovered(n)}
              onMouseLeave={() => !readOnly && setHovered(null)}
              onFocus={() => !readOnly && setHovered(n)}
              onBlur={() => !readOnly && setHovered(null)}
              className={`${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald focus-visible:outline-offset-2 rounded-sm disabled:cursor-default`}
            >
              <svg viewBox="0 0 24 24" className={SIZES[size]}>
                <polygon
                  points="12,2 19,8 22,10 17,22 7,22 2,10 5,8"
                  className={filled ? "fill-topaz stroke-topaz-deep" : "fill-transparent stroke-base-border"}
                  strokeWidth="1.2"
                />
              </svg>
            </button>
          );
        })}
      </div>
      {!readOnly && (
        <p className="text-xs font-body text-muted min-h-[1em] transition-all duration-150">
          {label}
        </p>
      )}
    </div>
  );
}
