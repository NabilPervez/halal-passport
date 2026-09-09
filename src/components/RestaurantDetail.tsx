import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HalalStatus, RestaurantWithSaveState, Review } from "../types";
import { Badge } from "./Badge";
import { GemRating } from "./GemRating";
import { ReviewForm } from "./ReviewForm";
import { ShareSheet } from "./ShareSheet";
import { describeHalalStatus } from "../lib/halal";

interface RestaurantDetailProps {
  restaurant: RestaurantWithSaveState;
  review?: Review;
  onClose: () => void;
  onSaveReview: (review: Review) => void;
  onSetSaveState: (id: string, next: RestaurantWithSaveState["saveState"]) => void;
  onSetHalalStatus: (id: string, next: HalalStatus) => void;
}

export function RestaurantDetail({
  restaurant,
  review,
  onClose,
  onSaveReview,
  onSetSaveState,
  onSetHalalStatus,
}: RestaurantDetailProps) {
  const [editing, setEditing] = useState(!review);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        layoutId={`card-${restaurant.id}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="w-full sm:max-w-md sm:rounded-xl2 rounded-t-xl2 bg-base-elevated border border-base-border max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-base-elevated border-b border-base-border px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-cream">{restaurant.name}</h2>
            <p className="text-sm text-muted font-body">
              {[restaurant.cuisine, restaurant.city].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full w-8 h-8 flex items-center justify-center border border-base-border text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div className="flex flex-wrap gap-1.5">
            {restaurant.isMosque ? (
              <Badge tone="topaz">🕌 Mosque</Badge>
            ) : (
              <>
                {restaurant.pricePoint && <Badge tone="emerald">{restaurant.pricePoint}</Badge>}
                {restaurant.scrapedRating != null && (
                  <Badge tone="topaz">★ {restaurant.scrapedRating.toFixed(1)}</Badge>
                )}
                {(() => {
                  const { label, tone } = describeHalalStatus(restaurant.halalStatus, restaurant.heroColor);
                  return (
                    <Badge tone={tone}>
                      {label}
                      {restaurant.halalStatus === "unverified" && " — help confirm below"}
                    </Badge>
                  );
                })()}
                {restaurant.dietaryTags.map((tag) => (
                  <Badge key={tag} tone={restaurant.heroColor}>
                    {tag}
                  </Badge>
                ))}
              </>
            )}
          </div>

          {!restaurant.isMosque && <HalalStatusControl restaurant={restaurant} onSetHalalStatus={onSetHalalStatus} />}

          <div className="flex flex-col gap-2.5 p-3.5 bg-base-elevated2 rounded-xl border border-base-border">
            <div className="flex items-start gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <p className="text-sm text-cream font-body leading-relaxed">{restaurant.address}</p>
            </div>
            <div className="flex gap-2">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name}, ${restaurant.address}`)}`} target="_blank" rel="noreferrer" className="flex-1 flex justify-center items-center gap-1.5 px-2 py-2 rounded-lg bg-base-elevated border border-base-border text-xs text-muted hover:text-emerald transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
                Google Maps
              </a>
              <a href={`http://maps.apple.com/?q=${encodeURIComponent(`${restaurant.name}, ${restaurant.address}`)}`} target="_blank" rel="noreferrer" className="flex-1 flex justify-center items-center gap-1.5 px-2 py-2 rounded-lg bg-base-elevated border border-base-border text-xs text-muted hover:text-emerald transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
                Apple Maps
              </a>
              <a href={`https://waze.com/ul?q=${encodeURIComponent(`${restaurant.name}, ${restaurant.address}`)}&navigate=yes`} target="_blank" rel="noreferrer" className="flex-1 flex justify-center items-center gap-1.5 px-2 py-2 rounded-lg bg-base-elevated border border-base-border text-xs text-muted hover:text-emerald transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
                Waze
              </a>
            </div>
          </div>

          <div className="flex gap-2">
            <SaveButton
              label="Wishlist"
              tone="sapphire"
              active={restaurant.saveState === "wishlist"}
              onClick={() => onSetSaveState(restaurant.id, restaurant.saveState === "wishlist" ? "none" : "wishlist")}
            />
            <SaveButton
              label="Eaten"
              tone="ruby"
              active={restaurant.saveState === "eaten"}
              onClick={() => onSetSaveState(restaurant.id, restaurant.saveState === "eaten" ? "none" : "eaten")}
            />
          </div>

          <div className="h-px bg-base-border" />

          <AnimatePresence mode="wait">
            {editing ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ReviewForm
                  restaurantId={restaurant.id}
                  existing={review}
                  onCancel={() => setEditing(false)}
                  onSubmit={(r) => {
                    onSaveReview(r);
                    setEditing(false);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                {review && (
                  <>
                    <div className="flex items-center justify-between">
                      <GemRating value={review.rating} readOnly />
                      <button
                        onClick={() => setEditing(true)}
                        className="text-xs font-body text-emerald font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald rounded"
                      >
                        Edit review
                      </button>
                    </div>
                    {review.whatToGet && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted font-body mb-1">What to get</p>
                        <p className="text-sm font-body text-cream">{review.whatToGet}</p>
                      </div>
                    )}
                    {review.whatToAvoid && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted font-body mb-1">What to avoid</p>
                        <p className="text-sm font-body text-cream">{review.whatToAvoid}</p>
                      </div>
                    )}
                    <ShareSheet restaurant={restaurant} review={review} />
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Lets a viewer update a listing's halal status. There's no backend, so
 * this is recorded locally on this device only — not a shared community
 * verification other users would see. The copy says so explicitly rather
 * than implying a claim it can't back up.
 */
function HalalStatusControl({
  restaurant,
  onSetHalalStatus,
}: {
  restaurant: RestaurantWithSaveState;
  onSetHalalStatus: (id: string, next: HalalStatus) => void;
}) {
  const status = restaurant.halalStatus;

  if (status === "verified-zabihah" || status === "self-reported") {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-soft border border-emerald-deep/40">
        <p className="text-xs font-body text-emerald leading-snug">
          Marked fully halal (Zabihah) on this device. Not a shared
          verification — other users won't see this.
        </p>
        <button
          onClick={() => onSetHalalStatus(restaurant.id, "unverified")}
          className="shrink-0 text-xs font-body font-semibold text-emerald underline decoration-emerald/40 hover:decoration-emerald focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald rounded"
        >
          Undo
        </button>
      </div>
    );
  }

  if (status === "halal-options") {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amethyst-soft border border-amethyst-deep/40">
        <p className="text-xs font-body text-amethyst leading-snug">
          Marked "has halal options" on this device — not the whole menu.
          Not a shared verification.
        </p>
        <button
          onClick={() => onSetHalalStatus(restaurant.id, "unverified")}
          className="shrink-0 text-xs font-body font-semibold text-amethyst underline decoration-amethyst/40 hover:decoration-amethyst focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald rounded"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-base-elevated2 border border-base-border">
      <p className="text-xs font-body text-muted leading-snug">
        This listing hasn't been confirmed halal — it was matched from a
        directory, not verified. If you know this spot, you can mark its
        halal level here (recorded on this device only, not shared with
        other users).
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onSetHalalStatus(restaurant.id, "verified-zabihah")}
          className="flex-1 rounded-full bg-emerald text-base px-3.5 py-1.5 text-xs font-semibold font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
        >
          ✓ Fully halal
        </button>
        <button
          onClick={() => onSetHalalStatus(restaurant.id, "halal-options")}
          className="flex-1 rounded-full bg-amethyst-soft text-amethyst border border-amethyst-deep/60 px-3.5 py-1.5 text-xs font-semibold font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-amethyst"
        >
          Has halal options
        </button>
      </div>
    </div>
  );
}

function SaveButton({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone: "sapphire" | "ruby";
  active: boolean;
  onClick: () => void;
}) {
  const toneClasses = {
    sapphire: active ? "bg-sapphire-soft border-sapphire-deep text-sapphire" : "bg-base-elevated2 border-base-border text-muted",
    ruby: active ? "bg-ruby-soft border-ruby-deep text-ruby" : "bg-base-elevated2 border-base-border text-muted",
  };
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-full border py-2 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${toneClasses[tone]}`}
    >
      {active ? `✓ ${label}` : `+ ${label}`}
    </button>
  );
}
