# Plan: Replace fabricated location data with real place data

## The decision that shapes everything: data licensing

The 591 coordinates must come from somewhere, and the two candidate sources have
incompatible storage terms. This determines the whole architecture, so settle it
first.

**Google Places API (New) — Text Search** is the most accurate at resolving
business names, and returns every field currently fabricated in one call. But
Google's Maps Platform terms let you cache `place_id` indefinitely and other
Places content only for a limited window (historically 30 days), with
attribution requirements. A permanently committed `restaurants.json` containing
Google-sourced coordinates and addresses does not comply. That would force
runtime fetching plus a server-side cache — a large change to a local-first app
with no backend.

**OSM-derived sources (Geoapify, which you already have a key for; or Overture
Maps)** are ODbL-licensed. You may store and redistribute the data permanently,
and the only obligation is attribution. Coverage of chain and long-tail small
businesses is weaker than Google's, so more rows land in manual review.

**Recommendation: build on Geoapify/OSM.** It preserves the local-first,
no-backend architecture that is the app's main asset, the key is already in
hand, and the cost is a longer human-review pass — which you want anyway,
because a hand-curated halal directory is more defensible than a scraped one.
Use Google only as a manual lookup aid for unresolved rows, where a human reads
the result and types the address into the overrides file by hand. Data a
person transcribes into your own file is your data.

> Verify current Geoapify endpoint shapes, rate limits, and free-tier quotas
> against live docs before starting — my knowledge of these may be stale. Same
> for Google's caching terms if you overrule the recommendation above.

## Architectural changes to bundle into this work

Three schema problems make the data unfixable-in-place. Fix them now, in the
same pass, or you will redo this work.

**1. Split catalog data from user data.** Today `saveState` and `savedAt` live
on the restaurant record, so the catalog cannot be refreshed without
destroying wishlists. Split into two IndexedDB stores:

- `restaurants` — pure catalog, fully replaceable on every data refresh
- `userPlaceState` — `{ placeId, saveState, savedAt }`, never touched by
  seeding

This is what makes every future data update safe. It is the highest-value
change in the plan.

**2. Stop overloading `cuisine`.** 143 records have
`cuisine: "Permanently closed"` / `"Temporarily closed"` because the scraper
wrote Google's status badge into the cuisine slot. `businessStatus` becomes
its own field.

**3. Stop asserting facts you don't have.** `pricePoint` becomes nullable and
is rendered only when sourced. The blanket `dietaryTags: ["Zabihah Halal"]`
becomes `halalStatus: "unverified"`. The UI shows unverified state honestly.

Target record shape:

```ts
interface Place {
  id: string;              // PRESERVE existing r1..r591 — see Phase 1
  name: string;
  placeRef: string;        // upstream stable id, for future refreshes
  lat: number;
  lng: number;
  address: string;         // real formatted address
  city: string;            // replaces the "DFW Area" neighborhood placeholder
  cuisine: string | null;
  businessStatus: "operational" | "temporarily_closed" | "permanently_closed";
  halalStatus: "verified-zabihah" | "self-reported" | "halal-options" | "unverified";
  pricePoint: "$" | "$$" | "$$$" | null;
  scrapedRating: number | null;   // from the original scrape — real signal, currently discarded
  heroColor: JewelTone;    // derived deterministically from id hash, not random
  isMosque?: boolean;
  matchConfidence: number; // provenance, retained in the shipped data
  matchMethod: "auto" | "manual";
}
```

## Phase 1 — Build the resolution input

Create `tools/geocode/` (a real committed directory — `scratch/` gets
deleted).

`scratch/extracted_restaurants.json` holds the untouched scrape: `name`,
`rating`, `type`, 591 entries. `src/data/mockRestaurants.ts` holds the same
591 with assigned ids `r1`…`r591`.

**Join them on array index, then assert `name` equality at every index and
abort loudly on any mismatch.** Do not fuzzy-match here. If the assertion
fails the ordering assumption is wrong and everything downstream is corrupt.

Preserving these ids is mandatory: live users have `saveState` in IndexedDB
keyed by them. New ids orphan every existing wishlist.

Output `tools/geocode/input.json` — `{ id, name, scrapedRating, scrapedType }`.

## Phase 2 — Resolve names to real places

For each record, query Geoapify with:

- `text` = `"<name>, Dallas-Fort Worth, TX"`
- `filter=rect:-97.7,32.4,-96.4,33.4` (DFW bounding box)
- `bias=proximity:-96.797,32.777`

**Cache every raw response to `tools/geocode/cache/<sha1(name)>.json` and
commit the cache.** Never re-request a cached name. This makes the pipeline
resumable, reruns free, and the whole thing reproducible by someone without a
key.

Throttle to ~5 req/s. Retry 429/5xx with exponential backoff, max 5 attempts.
Log failures; never let one bad row kill the run.

## Phase 3 — Score every match

Do not trust the geocoder's own confidence alone. Compute a composite:

- Geoapify `rank.confidence` and `rank.match_type`
- Name similarity between query and returned name — normalized token-set
  ratio, so `"Wulf Burger"` vs `"Wulf Burger Restaurant"` scores high but
  `"Wulf Burger"` vs `"Burger King"` does not
- `result_type` is a POI/amenity, not a street or city centroid — a
  street-level match is a **failure**, not a weak success, and must not
  auto-accept
- Coordinates fall inside the DFW bbox

Classify:

| Status | Rule |
|---|---|
| `auto` | POI result **and** confidence ≥ 0.9 **and** similarity ≥ 0.85 **and** in bbox |
| `review` | anything resolved that misses a threshold |
| `unresolved` | no result, non-POI result, or outside bbox |

Emit `tools/geocode/report.csv`:
`id, name, matched_name, result_type, confidence, similarity, lat, lng, address, status`.
Sort `review` rows by descending confidence so the human works the easy ones
first.

## Phase 4 — Human review gate

This phase is not optional and is where the real quality comes from.

A reviewer works `report.csv` and records decisions in
`tools/geocode/overrides.json` — **hand-maintained, committed, and never
written by the script.** This file is the durable human knowledge and must
survive every rerun.

```json
{
  "r47": { "lat": 32.9481, "lng": -96.7297, "address": "1900 Preston Rd, Plano, TX 75093", "city": "Plano", "matchMethod": "manual" },
  "r112": { "drop": true, "reason": "permanently closed, no successor location" }
}
```

Overrides apply last and win over everything. For a stubborn row, look the
business up in Google Maps by hand and type the address in — a person
transcribing a fact into your own file carries none of the API's storage
restrictions.

## Phase 5 — Emit the seed

Merge scrape + resolved matches + overrides into `src/data/restaurants.json`.

- Map Geoapify categories to your `cuisine` vocabulary via an explicit
  committed lookup table. Unmapped category → `cuisine: null`, never a guess.
- Derive `businessStatus` from the scraped `type` field
  (`"Permanently closed"` / `"Temporarily closed"`), then never let those
  strings reach `cuisine`.
- `halalStatus: "unverified"` for all 591. No exceptions in this pass.
- `pricePoint: null` unless the source supplies one. Delete the random
  assignment.
- `heroColor` from a hash of `id`, so it is stable across rebuilds.
- **Drop every row still `unresolved` after review**, into
  `tools/geocode/unresolved.json` for a later pass. Shipping 480 real places
  beats 591 with 111 fictions.

Load this JSON at runtime rather than importing it into the module graph — it
also takes ~200KB out of the 1.27MB bundle.

## Phase 6 — DB migration to v4

The riskiest step. Existing users have real wishlists in `sofra-db` v3.

In the `upgrade` handler:

1. Create the `userPlaceState` store.
2. Read every existing `restaurants` row; for each with
   `saveState !== "none"`, write `{ placeId: id, saveState, savedAt }` into
   `userPlaceState`.
3. Clear `restaurants` entirely and re-seed from the new JSON.
4. Rewrite `seedIfEmpty` as `syncCatalog` — it replaces the catalog wholesale
   and never touches user state. The current mosque loop's 15 sequential
   awaits per launch goes away with it.

Reads then join catalog + user state at load. Run the 15 mosques through the
same pipeline to validate their existing coordinates rather than assuming
them.

## Definition of Done

Automated — write `tools/verify-data.mjs`, wire it to `npm run verify:data`,
and run it in CI. These are assertions, not judgment calls:

1. Every record has numeric `lat`/`lng` inside the DFW bbox. Zero exceptions.
2. Zero records where `address === "DFW Area, TX"` or `city === "DFW Area"`.
3. Every record has a non-empty `placeRef`.
4. No record has `cuisine` matching `/closed/i`.
5. No record has `halalStatus === "verified-zabihah"` without a corresponding
   `overrides.json` entry.
6. `pricePoint` is `null` or one of `$`/`$$`/`$$$` — and null unless sourced.
7. No duplicate ids; every retained id existed in the v3 dataset.
8. Rerunning the pipeline against the committed cache produces byte-identical
   `restaurants.json`.

Manual — record results in `tools/geocode/VERIFICATION.md`:

9. Sample 20 records at random. Each coordinate is within ~150m of the real
   business, checked by hand. **All 20 must pass**; a single failure means the
   confidence thresholds are too loose — retune and resample.
10. Every `review`-status row has been dispositioned: accepted, overridden, or
    dropped. Zero rows left in limbo.

Migration:

11. A test seeds a v3-shaped DB with 3 wishlist and 2 eaten entries, upgrades
    to v4, and asserts all 5 survive with correct `saveState` and `savedAt`.
    This test must exist and pass — it is the one thing that can silently
    destroy user data.

Housekeeping:

12. `npm run build` passes; `npm run lint` shows no new warnings.
13. OSM/ODbL attribution visible in the UI and in the README.
14. README documents how to rerun the pipeline; `tools/` committed with its
    cache; `scratch/` and the two 216KB Google Maps HTML dumps removed from
    the repo.
15. Retention count stated explicitly in the PR description ("resolved 512 of
    591; 79 dropped, listed in unresolved.json").

---

Two notes for whoever picks this up. The name-equality assertion in Phase 1
and the migration test in item 11 are the two places where a silent failure
corrupts everything downstream — treat them as blocking. And resist the
temptation to widen the Phase 3 thresholds to get the review queue down; a
low-confidence auto-accept reintroduces exactly the problem this work exists
to eliminate, only now it looks verified.
