import type { Restaurant, Review } from "../types";

const STAR_FILLED = "\u2726"; // jewel-styled star glyph
const STAR_EMPTY = "\u2727";

export function formatShareText(restaurant: Restaurant, review: Review): string {
  const stars = STAR_FILLED.repeat(review.rating) + STAR_EMPTY.repeat(5 - review.rating);
  const lines = [
    `${restaurant.name} — ${stars} (${review.rating}/5)`,
    `${restaurant.neighborhood} · ${review.pricePoint}`,
  ];
  if (review.whatToGet.trim()) lines.push(`Get: ${review.whatToGet.trim()}`);
  if (review.whatToAvoid.trim()) lines.push(`Avoid: ${review.whatToAvoid.trim()}`);
  if (review.dietaryTags.length) lines.push(review.dietaryTags.join(" · "));
  lines.push("Tracked on Halal Passport 🕌");
  lines.push("https://halal-passport.netlify.app/");
  return lines.join("\n");
}

export interface ShareResult {
  method: "native" | "clipboard" | "none";
}

export async function shareReview(restaurant: Restaurant, review: Review): Promise<ShareResult> {
  const text = formatShareText(restaurant, review);
  const shareData = { title: restaurant.name, text };

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(shareData);
      return { method: "native" };
    } catch (err) {
      // User cancelled the native share sheet — treat as a no-op, not an error.
      if (err instanceof DOMException && err.name === "AbortError") {
        return { method: "none" };
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return { method: "clipboard" };
  }

  return { method: "none" };
}

export function smsHref(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
