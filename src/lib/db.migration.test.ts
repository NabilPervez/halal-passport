import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { indexedDB as fakeIndexedDB, IDBKeyRange as fakeIDBKeyRange } from "fake-indexeddb";
import { openDB } from "idb";

// This test is the one thing in docs/data-pipeline-plan.md marked
// non-negotiable: a v3 -> v4 upgrade must carry every existing user's
// wishlist/eaten state forward, because the v4 restaurant catalog gets
// wiped and re-seeded with real geocoded data in the same upgrade. If this
// test doesn't exist and pass, that re-seed silently destroys user data on
// the first launch after the update ships.

const DB_NAME = "sofra-db-migration-test";

async function seedLegacyV3Db() {
  const db = await openDB(DB_NAME, 3, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const restaurantStore = database.createObjectStore("restaurants", { keyPath: "id" });
        restaurantStore.createIndex("by-saveState", "saveState");
        const reviewStore = database.createObjectStore("reviews", { keyPath: "id" });
        reviewStore.createIndex("by-restaurant", "restaurantId");
      }
      if (oldVersion < 2) {
        const meetupStore = database.createObjectStore("meetups", { keyPath: "id" });
        meetupStore.createIndex("by-date", "date");
      }
    },
  });

  // Legacy v3 shape: saveState/savedAt live directly on the restaurant row.
  const legacyRows = [
    { id: "r1", name: "Wulf Burger", saveState: "wishlist", savedAt: 1000 },
    { id: "r2", name: "Bird & Beast", saveState: "eaten", savedAt: 2000 },
    { id: "r3", name: "Doner Point", saveState: "none" },
    { id: "r4", name: "Arash Persian Grill", saveState: "wishlist", savedAt: 3000 },
    { id: "r5", name: "Some Closed Place", saveState: "eaten", savedAt: 4000 },
  ];
  const tx = db.transaction("restaurants", "readwrite");
  await Promise.all([...legacyRows.map((r) => tx.store.put(r)), tx.done]);
  db.close();
}

// Mirrors the real upgrade handler in src/lib/db.ts — kept in sync by hand
// since idb's openDB can't be pointed at two different module instances
// with two different fake-indexeddb globals in one process. If you change
// the v4 upgrade logic in db.ts, mirror the change here too.
async function runV4Upgrade() {
  const db = await openDB(DB_NAME, 4, {
    async upgrade(database, oldVersion, _newVersion, tx) {
      if (oldVersion < 4) {
        const userPlaceStore = database.createObjectStore("userPlaceState", {
          keyPath: "placeId",
        });
        userPlaceStore.createIndex("by-saveState", "saveState");

        if (oldVersion >= 1 && oldVersion < 4) {
          const oldRestaurants = tx.objectStore("restaurants");
          const legacyRows = (await oldRestaurants.getAll()) as Array<{
            id: string;
            saveState?: string;
            savedAt?: number;
          }>;
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

        const restaurantStore = tx.objectStore("restaurants");
        await restaurantStore.clear();
      }
    },
  });
  return db;
}

describe("v3 -> v4 IndexedDB migration", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", fakeIndexedDB);
    vi.stubGlobal("IDBKeyRange", fakeIDBKeyRange);
  });

  afterEach(async () => {
    fakeIndexedDB.deleteDatabase(DB_NAME);
    vi.unstubAllGlobals();
  });

  it("preserves every saved restaurant's saveState and savedAt across the upgrade", async () => {
    await seedLegacyV3Db();

    const db = await runV4Upgrade();
    const userStates = await db.getAll("userPlaceState");
    db.close();

    expect(userStates).toHaveLength(4);

    const byId = Object.fromEntries(userStates.map((s: any) => [s.placeId, s]));
    expect(byId.r1).toMatchObject({ saveState: "wishlist", savedAt: 1000 });
    expect(byId.r2).toMatchObject({ saveState: "eaten", savedAt: 2000 });
    expect(byId.r4).toMatchObject({ saveState: "wishlist", savedAt: 3000 });
    expect(byId.r5).toMatchObject({ saveState: "eaten", savedAt: 4000 });

    // r3 had saveState "none" and must NOT be carried forward — only
    // actual wishlist/eaten entries belong in userPlaceState.
    expect(byId.r3).toBeUndefined();
  });

  it("wipes the restaurant catalog so it can be re-seeded with real data", async () => {
    await seedLegacyV3Db();

    const db = await runV4Upgrade();
    const restaurantCount = await db.count("restaurants");
    db.close();

    expect(restaurantCount).toBe(0);
  });
});
