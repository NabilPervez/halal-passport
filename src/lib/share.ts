import type { Restaurant, Review } from "../types";
import { RATING_LABELS } from "../components/GemRating";

const GEM_FILLED = "💎";
const GEM_EMPTY = "🤍";

export function formatShareText(restaurant: Restaurant, review: Review): string {
  const gems = GEM_FILLED.repeat(review.rating) + GEM_EMPTY.repeat(5 - review.rating);
  const ratingLabel = RATING_LABELS[review.rating];
  const lines = [
    `🍽️ ${restaurant.name} — ${gems} (${review.rating}/5 ${ratingLabel})`,
    `📍 ${restaurant.address}`,
    `🏙️ ${restaurant.neighborhood} · 💰 ${review.pricePoint}`,
  ];
  if (review.whatToGet.trim()) lines.push(`✅ Get: ${review.whatToGet.trim()}`);
  if (review.whatToAvoid.trim()) lines.push(`🛑 Avoid: ${review.whatToAvoid.trim()}`);
  if (review.dietaryTags.length) lines.push(`✨ ${review.dietaryTags.join(" · ")}`);
  lines.push("");
  lines.push("🕌 Tracked on Halal Passport");
  lines.push("🔗 https://halal-passport.netlify.app/");
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
