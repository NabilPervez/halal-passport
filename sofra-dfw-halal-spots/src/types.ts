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

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  lat: number;
  lng: number;
  address: string;
  dietaryTags: DietaryTag[];
  pricePoint: PricePoint;
  heroColor: JewelTone;
  saveState: SaveState;
  savedAt?: number;
  isMosque?: boolean;
}

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

export interface RestaurantWithReview extends Restaurant {
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
