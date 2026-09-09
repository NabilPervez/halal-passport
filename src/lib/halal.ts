import type { HalalStatus, JewelTone } from "../types";

/** Shared badge copy/tone for a halal status, used by both RestaurantCard
 * (compact) and RestaurantDetail (detail view) so the two never drift. */
export function describeHalalStatus(
  status: HalalStatus,
  heroColor: JewelTone
): { label: string; tone: JewelTone } {
  switch (status) {
    case "verified-zabihah":
    case "self-reported":
      return { label: "✓ Fully halal", tone: "emerald" };
    case "halal-options":
      return { label: "Has halal options", tone: "amethyst" };
    case "unverified":
      return { label: "Unverified halal", tone: heroColor };
  }
}
