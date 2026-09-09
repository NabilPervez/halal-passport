# Halal Passport — DFW Halal Spots

A local-first PWA for discovering, tracking, and sharing halal restaurants
across the Dallas-Fort Worth metroplex. Built from the sprint PRD:
local-first storage, map discovery, wishlist/eaten lists, dish-level
reviews, and native SMS/WhatsApp sharing.

## Stack
React + TypeScript + Vite, Tailwind CSS, Framer Motion, IndexedDB (`idb`),
MapLibre GL + Geoapify (map tiles and geocoding), Web Share API,
`vite-plugin-pwa`.

## Getting started
```bash
npm install
cp .env.example .env
# add your Geoapify API key to .env (optional — see below)
npm run dev
```

## Map & geocoding
`VITE_GEOAPIFY_KEY` is optional for browsing the app — the bundled catalog
already has real coordinates. Without a key the map falls back to the
default MapLibre style with no tiles; add a free key from
[Geoapify](https://myprojects.geoapify.com/) to see the styled dark map.
Restrict the key to this app's origin(s) in the Geoapify dashboard once you
have one — a client-side key can't be kept secret, only scoped.

## Data
Restaurant, wishlist, eaten, and review data lives in IndexedDB on the
device — nothing is sent to a server. The catalog itself
(`src/data/restaurants.json`) is real, geocoded data produced by the
pipeline in `tools/geocode/` — see
[`docs/data-pipeline-plan.md`](docs/data-pipeline-plan.md) for the full
approach and rationale.

**Current coverage: 165 of 591 scraped names have been resolved to a real,
verified location (150 restaurants + 15 mosques).** The remaining 441 are
listed in `tools/geocode/unresolved.json` and `tools/geocode/report.csv` —
either the automated pipeline couldn't confidently match them to a real
place (common for small/independent restaurants not well mapped in
OpenStreetMap), or they were dropped because they'd have collided with
another record's location (a chain with only one branch mapped in OSM, or a
literal duplicate scrape). See `tools/geocode/VERIFICATION.md` for why this
doesn't get much higher without either a paid geocoding API or a human
working the review queue by hand. Resolving more of them is a manual task —
see
"Adding more restaurants" below. Shipping fewer real places was a deliberate
choice over shipping fabricated ones; see the plan doc for why.

Map data and location attribution: **© OpenStreetMap contributors**,
[ODbL](https://opendatacommons.org/licenses/odbl/), via
[Geoapify](https://www.geoapify.com/).

### Adding more restaurants
1. Work through `tools/geocode/report.csv` (sorted with `review`-status rows
   first, easiest matches at the top).
2. For each one you can confidently resolve, add an entry to
   `tools/geocode/overrides.json` — either a corrected location, or
   `{ "drop": true, "reason": "..." }` to explicitly exclude it.
3. Re-run `node tools/geocode/04-emit-seed.mjs` to regenerate
   `src/data/restaurants.json` — no need to re-run the geocoding phases,
   `overrides.json` applies on top of the cached results.
4. Run `npm run verify:data` before committing.

### Re-running the pipeline
`tools/geocode/input.json` (591 scraped names + ids) is committed and is now
the durable source of truth — `01-build-input.mjs` already ran against the
original scrape and `src/data/mockRestaurants.ts`, both since deleted (see
`docs/data-pipeline-plan.md`, item 14), so that step isn't re-runnable and
isn't part of the normal flow below. Steps 2 onward read only from
`input.json` and are fully reproducible:
```bash
export GEOAPIFY_KEY=your_key_here
node tools/geocode/02-resolve.mjs
node tools/geocode/03-score.mjs
node tools/geocode/02b-retry-cleaned.mjs   # improves match rate on non-auto rows
node tools/geocode/03-score.mjs            # re-score after the retry pass
node tools/geocode/04-emit-seed.mjs
node tools/geocode/05-verify-mosques.mjs   # optional, mosque coordinates only
npm run verify:data
```
Every geocoder response is cached under `tools/geocode/cache/` and
`tools/geocode/cache-cleaned/`, and both are committed — re-running the
pipeline against unchanged input costs zero API calls and is byte-for-byte
reproducible. If you're feeding in a fresh scrape, adapt `01-build-input.mjs`
to your new source and id scheme first.

### Halal verification status
Every seeded listing starts as `halalStatus: "unverified"` — being resolved
to a real address is not the same as being confirmed halal. The UI shows
this honestly rather than assuming every result is Zabihah. Promoting a
listing to a verified status is intentionally a manual, documented action
(via `overrides.json` for now; a future sprint should let users submit
verification from the app itself).

## Build
```bash
npm run build   # type-checks then builds to dist/
npm run preview # serve the production build locally
npm test        # migration + pipeline tests
npm run verify:data  # Definition-of-Done checks on the shipped catalog
```

## Design
Dark, jewel-toned "Spotify for halal food" visual system — no gradients,
flat jewel-tone fills (emerald, ruby, sapphire, amethyst, topaz) on a
near-black ground, Sora for display type and Inter for body/UI. The
rating control uses a cut-gem glyph instead of a generic star as the
app's signature visual element.
