import { AnimatePresence, motion } from "framer-motion";
import type { RestaurantWithSaveState } from "../types";
import { RestaurantCard } from "./RestaurantCard";

interface BentoGridProps {
  restaurants: RestaurantWithSaveState[];
  onOpen: (id: string) => void;
  onToggleSave: (id: string, next: "wishlist" | "eaten" | "none") => void;
  emptyTitle: string;
  emptyBody: string;
}

export function BentoGrid({ restaurants, onOpen, onToggleSave, emptyTitle, emptyBody }: BentoGridProps) {
  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl2 border border-dashed border-base-border">
        <p className="font-display font-semibold text-cream mb-1">{emptyTitle}</p>
        <p className="text-sm text-muted font-body max-w-xs">{emptyBody}</p>
      </div>
    );
  }

  return (
    <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-[minmax(0,1fr)]">
      <AnimatePresence>
        {restaurants.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} onOpen={onOpen} onToggleSave={onToggleSave} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
