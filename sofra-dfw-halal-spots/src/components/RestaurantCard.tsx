import { motion } from "framer-motion";
import type { Restaurant, JewelTone } from "../types";
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
  restaurant: Restaurant;
  featured?: boolean;
  onOpen: (id: string) => void;
  onToggleSave: (id: string, next: "wishlist" | "eaten" | "none") => void;
}

export function RestaurantCard({ restaurant, featured, onOpen, onToggleSave }: RestaurantCardProps) {
  const initials = restaurant.name
    .split(" ")
    .filter((w) => /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <motion.button
      layout
      layoutId={`card-${restaurant.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={() => onOpen(restaurant.id)}
      className={`group relative flex flex-col text-left rounded-xl2 border border-base-border bg-base-elevated overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${
        featured ? "row-span-2" : ""
      }`}
      aria-label={`Open ${restaurant.name}`}
    >
      <div
        className={`relative flex items-center justify-center ${HERO_BG[restaurant.heroColor]} ${
          featured ? "aspect-square" : "aspect-[4/3]"
        }`}
      >
        <span className={`font-display font-bold ${HERO_TEXT[restaurant.heroColor]} ${featured ? "text-5xl" : "text-3xl"}`}>
          {initials}
        </span>
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
            {restaurant.cuisine} · {restaurant.neighborhood}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          <Badge tone="emerald">{restaurant.pricePoint}</Badge>
          {restaurant.dietaryTags.slice(0, featured ? 3 : 1).map((tag) => (
            <Badge key={tag} tone={restaurant.heroColor}>
              {tag}
            </Badge>
          ))}
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
  saveState: Restaurant["saveState"];
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
