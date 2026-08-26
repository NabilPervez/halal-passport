import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type { Restaurant, Review, Meetup } from "../types";
import { SEED_RESTAURANTS } from "../data/mockRestaurants";
import mosques from "../data/mosques.json";

interface SofraDB extends DBSchema {
  restaurants: {
    key: string;
    value: Restaurant;
    indexes: { "by-saveState": string };
  };
  reviews: {
    key: string;
    value: Review;
    indexes: { "by-restaurant": string };
  };
  meetups: {
    key: string;
    value: Meetup;
    indexes: { "by-date": string };
  };
}

const DB_NAME = "sofra-db";
const DB_VERSION = 3; // Bumped to force re-seed of expanded restaurant list

let dbPromise: Promise<IDBPDatabase<SofraDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SofraDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const restaurantStore = db.createObjectStore("restaurants", { keyPath: "id" });
          restaurantStore.createIndex("by-saveState", "saveState");

          const reviewStore = db.createObjectStore("reviews", { keyPath: "id" });
          reviewStore.createIndex("by-restaurant", "restaurantId");
        }
        if (oldVersion < 2) {
          const meetupStore = db.createObjectStore("meetups", { keyPath: "id" });
          meetupStore.createIndex("by-date", "date");
        }
        // v3: no schema changes — just triggers re-seed of expanded restaurant list
      },
    });
  }
  return dbPromise;
}

export async function seedIfEmpty(): Promise<void> {
  const db = await getDB();

  // Upsert any SEED_RESTAURANTS that are not yet in the DB so newly added
  // restaurants always appear, while preserving save-state on existing ones.
  const existingKeys = new Set(await db.getAllKeys("restaurants"));
  const missing = SEED_RESTAURANTS.filter((r) => !existingKeys.has(r.id));
  if (missing.length > 0) {
    const tx = db.transaction("restaurants", "readwrite");
    await Promise.all([...missing.map((r) => tx.store.put(r)), tx.done]);
  }
  
  // Ensure mosques are seeded
  for (const m of mosques) {
    const existing = await db.get("restaurants", m.id);
    if (!existing) {
      await db.put("restaurants", m as Restaurant);
    }
  }
  
  const meetupCount = await db.count("meetups");
  if (meetupCount === 0) {
    // Find Shami's or just use r1 if not found
    const restaurants = await getAllRestaurants();
    const shami = restaurants.find(r => r.name.toLowerCase().includes("shami")) || restaurants[0];
    
    await db.put("meetups", {
      id: "m1",
      title: "Shami's after Qalam Institute (mosque) after magrib",
      restaurantId: shami.id,
      date: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
      organizer: "Nabil",
      attendees: 12,
    });
  }
}

export async function getAllRestaurants(): Promise<Restaurant[]> {
  const db = await getDB();
  return db.getAll("restaurants");
}

export async function putRestaurant(restaurant: Restaurant): Promise<void> {
  const db = await getDB();
  await db.put("restaurants", restaurant);
}

export async function getAllReviews(): Promise<Review[]> {
  const db = await getDB();
  return db.getAll("reviews");
}

export async function getReviewForRestaurant(restaurantId: string): Promise<Review | undefined> {
  const db = await getDB();
  const idx = db.transaction("reviews").store.index("by-restaurant");
  return idx.get(restaurantId);
}

export async function putReview(review: Review): Promise<void> {
  const db = await getDB();
  await db.put("reviews", review);
}

export async function getAllMeetups(): Promise<Meetup[]> {
  const db = await getDB();
  return db.getAll("meetups");
}
