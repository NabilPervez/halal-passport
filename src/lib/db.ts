import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  Restaurant,
  Review,
  Meetup,
  UserPlaceState,
  RestaurantWithSaveState,
  SaveState,
  MeetupRsvp,
  HalalStatus,
  HalalStatusOverride,
} from "../types";
import restaurantsData from "../data/restaurants.json";

interface SofraDB extends DBSchema {
  restaurants: {
    key: string;
    value: Restaurant;
  };
  userPlaceState: {
    key: string;
    value: UserPlaceState;
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
  meetupRsvps: {
    key: string;
    value: MeetupRsvp;
  };
  halalStatusOverrides: {
    key: string;
    value: HalalStatusOverride;
  };
}

const DB_NAME = "sofra-db";
// v4: split per-user save state (wishlist/eaten) out of the restaurant
// catalog into its own store, so refreshing the catalog with real geocoded
// data never touches what a user has already saved. See docs/data-pipeline-plan.md.
// v5: local RSVP tracking for meetups (meetupRsvps store).
// v6: local halal-status overrides (halalStatusOverrides store) — lets a
// user mark a listing verified on their own device. Not a backend/synced
// verification; see the type's doc comment.
const DB_VERSION = 6;

let dbPromise: Promise<IDBPDatabase<SofraDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SofraDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("restaurants", { keyPath: "id" });
          const reviewStore = db.createObjectStore("reviews", { keyPath: "id" });
          reviewStore.createIndex("by-restaurant", "restaurantId");
        }
        if (oldVersion < 2) {
          const meetupStore = db.createObjectStore("meetups", { keyPath: "id" });
          meetupStore.createIndex("by-date", "date");
        }
        // v3 (legacy): no schema change, just re-seeded the restaurant list.
        // The v3 "restaurants" store also carried a "by-saveState" index and
        // saveState/savedAt fields directly on each restaurant record —
        // both are migrated away below.

        if (oldVersion < 4) {
          const userPlaceStore = db.createObjectStore("userPlaceState", {
            keyPath: "placeId",
          });
          userPlaceStore.createIndex("by-saveState", "saveState");

          // Preserve every existing user's wishlist/eaten state before the
          // restaurant store gets wiped and re-seeded with real data below.
          if (oldVersion >= 1 && oldVersion < 4) {
            const oldRestaurants = tx.objectStore("restaurants");
            // oldVersion < 4 store may still have the legacy "by-saveState"
            // index; getAll() works regardless of which indexes exist.
            const legacyRows = (await oldRestaurants.getAll()) as Array<
              Restaurant & { saveState?: SaveState; savedAt?: number }
            >;
            for (const row of legacyRows) {
              if (row.saveState && row.saveState !== "none") {
                await userPlaceStore.put({
                  placeId: row.id,
                  saveState: row.saveState,
                  savedAt: row.savedAt ?? Date.now(),
                });
              }
            }
          }

          // Wipe and let syncCatalog() below re-seed with real geocoded
          // data on next load — the old store may have a stale keyPath
          // ("by-saveState" index) we don't want to carry forward.
          const restaurantStore = tx.objectStore("restaurants");
          await restaurantStore.clear();
        }

        if (oldVersion < 5) {
          db.createObjectStore("meetupRsvps", { keyPath: "meetupId" });
        }

        if (oldVersion < 6) {
          db.createObjectStore("halalStatusOverrides", { keyPath: "placeId" });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Replaces the restaurant catalog wholesale with the bundled, geocoded
 * dataset. Safe to call on every launch — user save state lives in a
 * separate store this never touches.
 */
export async function syncCatalog(): Promise<void> {
  const db = await getDB();
  const catalog = restaurantsData as unknown as Restaurant[];

  const existingCount = await db.count("restaurants");
  if (existingCount === catalog.length) {
    // Cheap check to avoid rewriting all rows on every launch once seeded.
    // A real version bump (DB_VERSION) still forces a full re-seed via the
    // upgrade handler's store.clear() above.
    return;
  }

  const tx = db.transaction("restaurants", "readwrite");
  await Promise.all([...catalog.map((r) => tx.store.put(r)), tx.done]);

  const meetupCount = await db.count("meetups");
  if (meetupCount === 0) {
    const shami =
      catalog.find((r) => r.name.toLowerCase().includes("shami")) ?? catalog[0];
    if (shami) {
      await db.put("meetups", {
        id: "m1",
        title: "Shami's after Qalam Institute (mosque) after magrib",
        restaurantId: shami.id,
        date: new Date(Date.now() + 86400000 * 2).toISOString(),
        organizer: "Nabil",
        attendees: 12,
      });
    }
  }
}

export async function getAllRestaurantsWithState(): Promise<RestaurantWithSaveState[]> {
  const db = await getDB();
  const [restaurants, userStates, halalOverrides] = await Promise.all([
    db.getAll("restaurants"),
    db.getAll("userPlaceState"),
    db.getAll("halalStatusOverrides"),
  ]);
  const stateByPlace = new Map(userStates.map((s) => [s.placeId, s]));
  const halalByPlace = new Map(halalOverrides.map((o) => [o.placeId, o]));
  return restaurants.map((r) => {
    const state = stateByPlace.get(r.id);
    const halalOverride = halalByPlace.get(r.id);
    return {
      ...r,
      halalStatus: halalOverride?.halalStatus ?? r.halalStatus,
      saveState: state?.saveState ?? "none",
      savedAt: state?.savedAt,
    };
  });
}

/**
 * Marks a listing's halal status as this device sees it. There's no
 * backend here — this is a local claim recorded on this device, not a
 * shared/community-verified fact other users would see. Pass "unverified"
 * to clear a prior override and fall back to the catalog's default status.
 */
export async function setHalalStatus(placeId: string, halalStatus: HalalStatus): Promise<void> {
  const db = await getDB();
  if (halalStatus === "unverified") {
    await db.delete("halalStatusOverrides", placeId);
    return;
  }
  await db.put("halalStatusOverrides", { placeId, halalStatus, updatedAt: Date.now() });
}

export async function setUserPlaceState(
  placeId: string,
  saveState: SaveState
): Promise<void> {
  const db = await getDB();
  if (saveState === "none") {
    await db.delete("userPlaceState", placeId);
    return;
  }
  await db.put("userPlaceState", { placeId, saveState, savedAt: Date.now() });
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

/**
 * Local-only RSVP tracking — this app has no backend or user accounts, so
 * "attending" here means "this device's owner tapped RSVP", not a synced
 * headcount other attendees see. Meetup.attendees stays the seeded/organizer
 * count; the UI adds this device's own RSVP on top of it (see MeetupsView).
 */
export async function getAllRsvps(): Promise<MeetupRsvp[]> {
  const db = await getDB();
  return db.getAll("meetupRsvps");
}

export async function setRsvp(meetupId: string, attending: boolean): Promise<void> {
  const db = await getDB();
  if (!attending) {
    await db.delete("meetupRsvps", meetupId);
    return;
  }
  await db.put("meetupRsvps", { meetupId, attending: true, rsvpedAt: Date.now() });
}
