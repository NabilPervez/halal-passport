export type Tab = "discover" | "wishlist" | "eaten" | "meetups";

export type DietaryTag =
  | "Zabihah Halal"
  | "Dairy-Free"
  | "Vegetarian Options"
  | "Vegan Options"
  | "Nut-Free"
  | "Gluten-Free Options";

export type PricePoint = "$" | "$$" | "$$$";

export type SaveState = "none" | "wishlist" | "eaten";

export type BusinessStatus = "operational" | "temporarily_closed" | "permanently_closed";

/**
 * How confident we are that this listing is actually halal. Every seeded
 * record starts "unverified" — a name resolved via a mapping directory is
 * not a religious determination. Only community submissions or hand-checked
 * overrides may claim "verified-zabihah".
 */
export type HalalStatus = "verified-zabihah" | "self-reported" | "halal-options" | "unverified";

export type MatchMethod = "auto" | "manual";

/**
 * Pure catalog data — sourced from the geocoding pipeline (see
 * tools/geocode/), replaceable wholesale on every data refresh. Never holds
 * per-user state; see UserPlaceState for that.
 */
export interface Restaurant {
  id: string;
  name: string;
  /** Upstream stable id (Geoapify place_id) for future re-syncs. */
  placeRef: string | null;
  cuisine: string | null;
  city: string;
  lat: number;
  lng: number;
  address: string;
  businessStatus: BusinessStatus;
  halalStatus: HalalStatus;
  dietaryTags: DietaryTag[];
  pricePoint: PricePoint | null;
  /** Rating collected from the original directory scrape, if any. */
  scrapedRating: number | null;
  heroColor: JewelTone;
  isMosque?: boolean;
  /** Provenance — how this record's coordinates were resolved. */
  matchConfidence: number;
  matchMethod: MatchMethod;
}

/** Per-user, per-place state — lives in its own IndexedDB store so a
 *  catalog refresh never touches what someone has saved. */
export interface UserPlaceState {
  placeId: string;
  saveState: SaveState;
  savedAt?: number;
}

/**
 * A local, per-device claim that overrides a catalog record's halalStatus.
 * There is no backend here, so this is NOT a shared/community
 * verification — it's this device's own submission, applied on top of the
 * catalog value on read. See setHalalStatus() in db.ts.
 */
export interface HalalStatusOverride {
  placeId: string;
  halalStatus: HalalStatus;
  updatedAt: number;
}

/** A Restaurant joined with the viewer's save state, for rendering. */
export type RestaurantWithSaveState = Restaurant & { saveState: SaveState; savedAt?: number };

export type JewelTone = "emerald" | "ruby" | "sapphire" | "amethyst" | "topaz";

export interface Review {
  id: string;
  restaurantId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  whatToGet: string;
  whatToAvoid: string;
  pricePoint: PricePoint;
  dietaryTags: DietaryTag[];
  createdAt: number;
}

export interface RestaurantWithReview extends RestaurantWithSaveState {
  review?: Review;
}

export interface Meetup {
  id: string;
  title: string;
  restaurantId: string; // The location
  date: string; // ISO String
  organizer: string;
  attendees: number;
}

/** This device's local RSVP to a meetup — see the note on setRsvp() in db.ts. */
export interface MeetupRsvp {
  meetupId: string;
  attending: true;
  rsvpedAt: number;
}
