# Verification log

Tracks the manual checks called for in "Definition of Done" items 9-10 of
[`docs/data-pipeline-plan.md`](../../docs/data-pipeline-plan.md).

## Important caveat

Items 9-10 in the plan assume a human reviewer with local DFW knowledge.
This pass was done by an AI agent (no ability to physically visit a
location or hold independent knowledge of a business's real address) —
what follows is a **desk check on plausibility**, not ground-truth
verification. Treat this as a first pass, not a substitute for a human
(ideally someone who actually knows these restaurants) doing the real
review before any listing is presented to users as confidently correct.

## What was actually checked (this pass)

- Sampled ~20-23 auto-resolved records at even intervals across the shipped
  set and inspected: does the matched address's city agree with any city
  named in the record's own scraped name, and does the street address read
  as a real, specific location (not a bare street/city centroid)?
- This surfaced two real defects, both fixed in the pipeline before this
  file was written (not just filtered out of the sample):
  1. **Chain-branch collisions** — e.g. 5 separately scraped "Zio Al's
     Pizza & Pasta" locations (UTA, Richardson, Cedar Springs, Carrollton,
     Addison) all resolving to the single Richardson node OSM has mapped.
     Fixed by `04-emit-seed.mjs`'s same-`placeRef` dedup: only the
     best-similarity match per upstream place ships; the rest are demoted
     to `unresolved.json` for per-branch manual lookup. 19 records demoted
     by this check on the run that produced the current
     `src/data/restaurants.json`.
  2. **Name-declared-city conflicts** — e.g. "Heritage Scoop - Plano"
     resolving to a location in Frisco, "New York Eats (Irving)" resolving
     to Arlington. Fixed by `03-score.mjs`'s `extractDeclaredCity` check:
     a name that names a DFW city is never auto-accepted against a
     different matched city. This is a heuristic over a hardcoded city
     list (see `DFW_CITIES` in that file) — it catches a declared-city
     conflict but cannot catch every kind of wrong-branch match.
- After both fixes, a second sample of 23 records showed no further
  city/name inconsistencies.
- Ran a full "no housenumber" audit and confirmed the remaining cases (e.g.
  "Pizza Vibes" → a Colony Boulevard address with no house number) are
  shopping-center units OSM simply hasn't tagged a housenumber for — the
  underlying POI coordinate is still a real, specific point, not a street
  centroid. Not a defect; documented here so it isn't rediscovered as one.
- Verified all 15 mosque records by re-geocoding each mosque's own stored
  address (not just trusting the stored lat/lng — see `05-verify-mosques.mjs`
  and `mosque-verification.json`). 11 of 15 differed from the stored
  coordinate by 500m-3.5km; all 15 differences resolved to the geocoder
  finding the literal street address more precisely than the original
  hand-typed coordinate did, so the geocoded value was used. No mosque
  showed a wrong-city or wrong-name mismatch.

## What was NOT done (item 10 — not complete)

**Item 10 of the Definition of Done — every `review`-status row
dispositioned (accepted, overridden, or dropped) — is not met.** 458 rows
remain undispositioned in `tools/geocode/report.csv` /
`tools/geocode/unresolved.json`, none in `overrides.json`. This is real,
remaining work for a human reviewer with DFW knowledge (or access to
Google Maps for a manual per-row lookup, as the plan describes), not
something this pass could responsibly complete by proxy. See the README's
"Adding more restaurants" section for the mechanics.

## Retention

- 591 scraped names in
- 148 shipped to `src/data/restaurants.json` (133 restaurants, resolved
  automatically at high confidence + 15 verified mosques) — 25.0% of
  restaurant names resolved automatically
- 458 in `tools/geocode/unresolved.json`, awaiting human review
