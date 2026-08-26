import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Restaurant } from "../types";
import { RestaurantCard } from "./RestaurantCard";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Cuisines excluded from all sections (not actionable for users). */
const EXCLUDED_CUISINES = new Set([
  "Permanently closed",
  "Temporarily closed",
]);

/**
 * Pre-arranged popular categories shown at the top in priority order.
 * Remaining categories are appended after these, sorted by count.
 */
const PINNED_CATEGORIES = [
  "Mediterranean",
  "Indian",
  "Halal",
  "Pizza",
  "Coffee shop",
  "Chicken",
  "Pakistani",
  "Hamburger",
];

/** How many category sections to render on initial load. */
const INITIAL_SECTIONS = 5;

/** How many additional sections to reveal per scroll batch. */
const BATCH_SIZE = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoverFeedProps {
  restaurants: Restaurant[];
  onOpen: (id: string) => void;
  onToggleSave: (id: string, next: "wishlist" | "eaten" | "none") => void;
  emptyTitle: string;
  emptyBody: string;
}

interface CategorySection {
  name: string;
  items: Restaurant[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSections(restaurants: Restaurant[]): CategorySection[] {
  // Filter out non-actionable entries
  const actionable = restaurants.filter(
    (r) => !EXCLUDED_CUISINES.has(r.cuisine)
  );

  // Group by cuisine
  const map = new Map<string, Restaurant[]>();
  for (const r of actionable) {
    const key = r.cuisine || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  // Build ordered sections: pinned first (in priority order), then the rest
  // sorted by descending count.
  const sections: CategorySection[] = [];
  const seen = new Set<string>();

  for (const name of PINNED_CATEGORIES) {
    const items = map.get(name);
    if (items && items.length > 0) {
      sections.push({ name, items });
      seen.add(name);
    }
  }

  const remaining = [...map.entries()]
    .filter(([name]) => !seen.has(name))
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([name, items]) => ({ name, items }));

  sections.push(...remaining);
  return sections;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionRow({
  section,
  onOpen,
  onToggleSave,
}: {
  section: CategorySection;
  onOpen: (id: string) => void;
  onToggleSave: (id: string, next: "wishlist" | "eaten" | "none") => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <h3 className="font-display font-semibold text-cream text-sm leading-none">
          {section.name}
        </h3>
        <span className="text-[10px] font-body font-semibold text-muted bg-base-elevated border border-base-border px-2 py-0.5 rounded-full leading-none">
          {section.items.length}
        </span>
      </div>

      {/* Horizontal scroll row */}
      <div
        className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {section.items.map((r) => (
          <div
            key={r.id}
            className="snap-start shrink-0 w-40"
          >
            <RestaurantCard
              restaurant={r}
              featured={false}
              onOpen={onOpen}
              onToggleSave={onToggleSave}
            />
          </div>
        ))}
        {/* Trailing spacer so last card doesn't sit flush against the edge */}
        <div className="shrink-0 w-1" aria-hidden="true" />
      </div>
    </div>
  );
}

function LoadingSentinel() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-6" aria-label="Loading more">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-emerald/40 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiscoverFeed({
  restaurants,
  onOpen,
  onToggleSave,
  emptyTitle,
  emptyBody,
}: DiscoverFeedProps) {
  const sections = useMemo(() => buildSections(restaurants), [restaurants]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SECTIONS);

  // Reset visible count when the restaurant list changes (e.g. filter applied)
  useEffect(() => {
    setVisibleCount(INITIAL_SECTIONS);
  }, [restaurants]);

  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver({
    rootMargin: "200px",
  });

  // Load next batch when sentinel is visible
  useEffect(() => {
    if (isIntersecting && visibleCount < sections.length) {
      setVisibleCount((c) => Math.min(c + BATCH_SIZE, sections.length));
    }
  }, [isIntersecting, sections.length, visibleCount]);

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl2 border border-dashed border-base-border">
        <p className="font-display font-semibold text-cream mb-1">{emptyTitle}</p>
        <p className="text-sm text-muted font-body max-w-xs">{emptyBody}</p>
      </div>
    );
  }

  const visibleSections = sections.slice(0, visibleCount);
  const hasMore = visibleCount < sections.length;

  return (
    <motion.div
      layout
      className="flex flex-col gap-7"
    >
      {visibleSections.map((section) => (
        <SectionRow
          key={section.name}
          section={section}
          onOpen={onOpen}
          onToggleSave={onToggleSave}
        />
      ))}

      {/* Lazy-load sentinel */}
      <div ref={sentinelRef}>
        {hasMore && <LoadingSentinel />}
      </div>
    </motion.div>
  );
}
