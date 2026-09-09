#!/usr/bin/env node
// Phase 1 — Build the resolution input.
//
// Joins the untouched scrape (scratch/extracted_restaurants.json: name,
// rating, type — no coordinates) against the id-bearing seed
// (src/data/mockRestaurants.ts: id, name, ...fabricated fields) on array
// index, asserts name equality at every index, and writes
// tools/geocode/input.json.
//
// This assertion is load-bearing: ids are keyed to live users' IndexedDB
// saveState. If the join is wrong, everything downstream is corrupt.
//
// NOTE: this script already ran, its output was verified, and
// tools/geocode/input.json is committed — it is now the durable record of
// that join. scratch/ and src/data/mockRestaurants.ts were deleted after
// this ran (see docs/data-pipeline-plan.md, item 14), so this script is not
// re-runnable as-is; it's kept for history and as a template if a future
// scrape needs the same index-join treatment against a fresh id-bearing
// seed.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const scraped = JSON.parse(
  readFileSync(join(ROOT, "scratch/extracted_restaurants.json"), "utf8")
);

const seedSrc = readFileSync(join(ROOT, "src/data/mockRestaurants.ts"), "utf8");

// The seed file is a static TS array literal (id then name, in that field
// order, on consecutive lines) — extract with a regex rather than adding a
// TS-eval dependency to the pipeline.
const idNameRe = /id:\s*"(r\d+)",\s*\n\s*name:\s*"([^"]*)"/g;
const seedEntries = [];
let match;
while ((match = idNameRe.exec(seedSrc))) {
  seedEntries.push({ id: match[1], name: match[2] });
}

if (seedEntries.length !== scraped.length) {
  console.error(
    `FATAL: length mismatch — scraped has ${scraped.length} entries, ` +
      `seed has ${seedEntries.length}. Refusing to join on index.`
  );
  process.exit(1);
}

const mismatches = [];
for (let i = 0; i < seedEntries.length; i++) {
  if (seedEntries[i].name !== scraped[i].name) {
    mismatches.push({
      index: i,
      id: seedEntries[i].id,
      seedName: seedEntries[i].name,
      scrapedName: scraped[i].name,
    });
  }
}

if (mismatches.length > 0) {
  console.error(
    `FATAL: ${mismatches.length} name mismatch(es) between seed and scrape ` +
      `at the same index. The index-based join is not valid. First 10:`
  );
  console.error(JSON.stringify(mismatches.slice(0, 10), null, 2));
  process.exit(1);
}

const input = seedEntries.map((entry, i) => ({
  id: entry.id,
  name: entry.name,
  scrapedRating: scraped[i].rating ? Number(scraped[i].rating) : null,
  scrapedType: scraped[i].type ?? null,
}));

writeFileSync(
  join(__dirname, "input.json"),
  JSON.stringify(input, null, 2) + "\n"
);

console.log(
  `OK: joined ${input.length} records with zero name mismatches. ` +
    `Wrote tools/geocode/input.json`
);
