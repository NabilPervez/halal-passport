import { motion } from "framer-motion";
import type { RestaurantWithSaveState, JewelTone } from "../types";
import { Badge } from "./Badge";

const HERO_BG: Record<JewelTone, string> = {
  emerald: "bg-emerald-soft",
  ruby: "bg-ruby-soft",
  sapphire: "bg-sapphire-soft",
  amethyst: "bg-amethyst-soft",
  topaz: "bg-topaz-soft",
};

const HERO_TEXT: Record<JewelTone, string> = {
  emerald: "text-emerald",
  ruby: "text-ruby",
  sapphire: "text-sapphire",
  amethyst: "text-amethyst",
  topaz: "text-topaz",
};

interface RestaurantCardProps {
  restaurant: RestaurantWithSaveState;
  featured?: boolean;
  onOpen: (id: string) => void;
  onToggleSave: (id: string, next: "wishlist" | "eaten" | "none") => void;
}

// Mosques get the same gold used for their square map marker, regardless
// of the deterministic-by-id heroColor stored on the record — a mosque
// card and a mosque pin should read as the same visual category at a
// glance, distinct from any restaurant's jewel tone.
const MOSQUE_BG = "bg-topaz-soft";
const MOSQUE_TEXT = "text-topaz";

export function RestaurantCard({ restaurant, featured, onOpen, onToggleSave }: RestaurantCardProps) {
  const initials = restaurant.name
    .split(" ")
    .filter((w) => /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  const heroBg = restaurant.isMosque ? MOSQUE_BG : HERO_BG[restaurant.heroColor];
  const heroText = restaurant.isMosque ? MOSQUE_TEXT : HERO_TEXT[restaurant.heroColor];

  return (
    <motion.button
      layout
      layoutId={`card-${restaurant.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={() => onOpen(restaurant.id)}
      className={`group relative flex flex-col text-left rounded-xl2 border overflow-hidden h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${
        restaurant.isMosque ? "border-topaz/30 bg-base-elevated" : "border-base-border bg-base-elevated"
      } ${featured ? "row-span-2" : ""}`}
      aria-label={`Open ${restaurant.name}`}
    >
      <div
        className={`relative flex items-center justify-center ${heroBg} ${
          featured ? "aspect-square" : "aspect-[4/3]"
        }`}
      >
        {restaurant.isMosque ? (
          <svg viewBox="0 0 24 24" className={`${heroText} ${featured ? "w-12 h-12" : "w-8 h-8"}`} fill="currentColor">
            <path d="M12 2c-.6 1.6-1.8 2.7-3.2 3.5C7 6.6 6 8.2 6 10c0 1.3.5 2.4 1.3 3.3C5.9 14.4 5 16.1 5 18v2h2v-2c0-1.9 1.3-3.4 3-3.9V18H8v2h8v-2h-2v-3.9c1.7.5 3 2 3 3.9v2h2v-2c0-1.9-.9-3.6-2.3-4.7.8-.9 1.3-2 1.3-3.3 0-1.8-1-3.4-2.8-4.5C13.8 4.7 12.6 3.6 12 2zm0 4.2c.9.8 1.5 1.8 1.5 2.8 0 1.1-.7 2-1.5 2s-1.5-.9-1.5-2c0-1 .6-2 1.5-2.8z" />
          </svg>
        ) : (
          <span className={`font-display font-bold ${heroText} ${featured ? "text-5xl" : "text-3xl"}`}>
            {initials}
          </span>
        )}
        <SaveToggle
          restaurantId={restaurant.id}
          saveState={restaurant.saveState}
          onToggleSave={onToggleSave}
        />
      </div>
      <div className="flex-1 flex flex-col gap-2 p-3.5">
        <div>
          <h3 className="font-display font-semibold text-cream leading-tight truncate">{restaurant.name}</h3>
          <p className="text-xs text-muted font-body mt-0.5">
            {restaurant.isMosque
              ? [restaurant.address, restaurant.city].filter(Boolean).join(" · ")
              : [restaurant.cuisine, restaurant.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {restaurant.isMosque ? (
            <Badge tone="topaz">Mosque</Badge>
          ) : (
            <>
              {restaurant.pricePoint && <Badge tone="emerald">{restaurant.pricePoint}</Badge>}
              {restaurant.halalStatus === "unverified" ? (
                <Badge tone={restaurant.heroColor}>Unverified halal</Badge>
              ) : (
                <Badge tone="emerald">✓ Verified halal</Badge>
              )}
            </>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function SaveToggle({
  restaurantId,
  saveState,
  onToggleSave,
}: {
  restaurantId: string;
  saveState: RestaurantWithSaveState["saveState"];
  onToggleSave: (id: string, next: "wishlist" | "eaten" | "none") => void;
}) {
  const isSaved = saveState === "wishlist";
  return (
    <motion.span
      role="button"
      tabIndex={0}
      aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={isSaved}
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.stopPropagation();
        onToggleSave(restaurantId, isSaved ? "none" : "wishlist");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onToggleSave(restaurantId, isSaved ? "none" : "wishlist");
        }
      }}
      className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-base/70 backdrop-blur-sm border border-base-border cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4">
        <path
          d="M12 21s-7.5-4.6-10-9.2C.5 8.2 2.3 4.5 6 4.5c2 0 3.5 1 4.5 2.5 1-1.5 2.5-2.5 4.5-2.5 3.7 0 5.5 3.7 4 7.3C19.5 16.4 12 21 12 21z"
          className={isSaved ? "fill-ruby stroke-ruby" : "fill-transparent stroke-cream"}
          strokeWidth="1.5"
        />
      </svg>
    </motion.span>
  );
}
