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
 * Upserts the bundled, geocoded catalog into the restaurants store. Safe
 * to call on every launch — it only ever `put`s rows the app ships (by
 * id), so it never touches user save state (separate store) and never
 * deletes anything, including restaurants a user has added locally (see
 * addUserRestaurant). Cheap enough (a few hundred puts) to just always run
 * rather than trying to detect "is this already seeded", which broke once
 * the store could hold more rows than the catalog ships (a user-added
 * restaurant made the old row-count check permanently wrong).
 */
export async function syncCatalog(): Promise<void> {
  const db = await getDB();
  const catalog = restaurantsData as unknown as Restaurant[];

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

/**
 * Adds a restaurant a user found and typed in themselves. Local to this
 * device only — there is no backend, so it is not shared with other
 * users. Stored in the same "restaurants" store as the bundled catalog,
 * under a "user-" id prefix that syncCatalog() never touches, so it
 * survives every future catalog refresh.
 */
export async function addUserRestaurant(input: {
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  cuisine: string | null;
  halalStatus: HalalStatus;
}): Promise<Restaurant> {
  const db = await getDB();
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const restaurant: Restaurant = {
    id,
    name: input.name,
    placeRef: null,
    cuisine: input.cuisine,
    city: input.city,
    lat: input.lat,
    lng: input.lng,
    address: input.address,
    businessStatus: "operational",
    halalStatus: input.halalStatus,
    dietaryTags: [],
    pricePoint: null,
    scrapedRating: null,
    heroColor: "emerald",
    matchConfidence: 1,
    matchMethod: "manual",
    isUserSubmitted: true,
  };
  await db.put("restaurants", restaurant);
  return restaurant;
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

// ─── Data management (Settings) ──────────────────────────────────────────

export interface UserDataStats {
  saved: number;
  reviews: number;
  addedRestaurants: number;
  halalMarks: number;
  rsvps: number;
}

export async function getUserDataStats(): Promise<UserDataStats> {
  const db = await getDB();
  const [userStates, reviews, restaurants, halalOverrides, rsvps] = await Promise.all([
    db.getAll("userPlaceState"),
    db.count("reviews"),
    db.getAll("restaurants"),
    db.count("halalStatusOverrides"),
    db.count("meetupRsvps"),
  ]);
  return {
    saved: userStates.length,
    reviews,
    addedRestaurants: restaurants.filter((r) => r.isUserSubmitted).length,
    halalMarks: halalOverrides,
    rsvps,
  };
}

/**
 * Everything this device has created — safe to hand to the user as a JSON
 * download. Catalog restaurants and seeded meetups are excluded (they ship
 * with the app); only user-submitted restaurants are included.
 */
export async function exportUserData(): Promise<Record<string, unknown>> {
  const db = await getDB();
  const [userPlaceState, reviews, restaurants, halalStatusOverrides, meetupRsvps] =
    await Promise.all([
      db.getAll("userPlaceState"),
      db.getAll("reviews"),
      db.getAll("restaurants"),
      db.getAll("halalStatusOverrides"),
      db.getAll("meetupRsvps"),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    schema: DB_VERSION,
    app: { version: __APP_VERSION__, commit: __APP_COMMIT__ },
    userPlaceState,
    reviews,
    addedRestaurants: restaurants.filter((r) => r.isUserSubmitted),
    halalStatusOverrides,
    meetupRsvps,
  };
}

/**
 * Wipes everything this device created — wishlist/eaten, reviews, halal
 * marks, RSVPs, and user-added restaurants — and leaves the bundled
 * catalog and seeded meetups intact (syncCatalog re-puts the catalog on
 * next launch regardless).
 */
export async function clearUserData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["userPlaceState", "reviews", "halalStatusOverrides", "meetupRsvps", "restaurants"],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore("userPlaceState").clear(),
    tx.objectStore("reviews").clear(),
    tx.objectStore("halalStatusOverrides").clear(),
    tx.objectStore("meetupRsvps").clear(),
    (async () => {
      const store = tx.objectStore("restaurants");
      const all = await store.getAll();
      await Promise.all(all.filter((r) => r.isUserSubmitted).map((r) => store.delete(r.id)));
    })(),
  ]);
  await tx.done;
}
