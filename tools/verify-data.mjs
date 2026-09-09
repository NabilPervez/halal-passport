#!/usr/bin/env node
// Definition-of-Done assertions for src/data/restaurants.json — see the
// "Definition of Done" section of docs/data-pipeline-plan.md, items 1-8.
// Run via `npm run verify:data`. Exits non-zero on any failure.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BBOX = { minLng: -97.7, minLat: 32.4, maxLng: -96.4, maxLat: 33.4 };
const VALID_PRICE_POINTS = new Set(["$", "$$", "$$$"]);

const data = JSON.parse(readFileSync(join(ROOT, "src/data/restaurants.json"), "utf8"));

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
  } else {
    console.error(`FAIL  ${label}`);
    failures++;
  }
}

console.log(`Verifying ${data.length} records in src/data/restaurants.json\n`);

// 1. Every record has numeric lat/lng inside the DFW bbox. Zero exceptions.
const outOfBbox = data.filter(
  (r) =>
    typeof r.lat !== "number" ||
    typeof r.lng !== "number" ||
    r.lat < BBOX.minLat ||
    r.lat > BBOX.maxLat ||
    r.lng < BBOX.minLng ||
    r.lng > BBOX.maxLng
);
check(
  `1. All records have numeric lat/lng inside the DFW bbox (${outOfBbox.length} violations)`,
  outOfBbox.length === 0
);

// 2. Zero records with the old placeholder address/city.
const placeholder = data.filter(
  (r) => r.address === "DFW Area, TX" || r.city === "DFW Area"
);
check(
  `2. No placeholder "DFW Area, TX" address/city remains (${placeholder.length} violations)`,
  placeholder.length === 0
);

// 3. Every record has a non-empty placeRef OR is explicitly manual
// (mosques and human-reviewed overrides may not have an upstream id).
const noRef = data.filter(
  (r) => !r.placeRef && r.matchMethod !== "manual"
);
check(
  `3. Every non-manual record has a placeRef (${noRef.length} violations)`,
  noRef.length === 0
);

// 4. No record has cuisine matching /closed/i.
const closedCuisine = data.filter((r) => r.cuisine && /closed/i.test(r.cuisine));
check(
  `4. No record has "closed" leaking into cuisine (${closedCuisine.length} violations)`,
  closedCuisine.length === 0
);

// 5. No verified-zabihah halalStatus without a documented override.
const overrides = JSON.parse(
  readFileSync(join(ROOT, "tools/geocode/overrides.json"), "utf8")
);
const unauthorizedVerified = data.filter(
  (r) => r.halalStatus === "verified-zabihah" && !overrides[r.id]
);
check(
  `5. No "verified-zabihah" status without a matching overrides.json entry (${unauthorizedVerified.length} violations)`,
  unauthorizedVerified.length === 0
);

// 6. pricePoint is null or one of $/$$/$$$.
const badPrice = data.filter(
  (r) => r.pricePoint !== null && !VALID_PRICE_POINTS.has(r.pricePoint)
);
check(
  `6. pricePoint is null or a valid price tier (${badPrice.length} violations)`,
  badPrice.length === 0
);

// 7. No duplicate ids.
const idCounts = new Map();
for (const r of data) idCounts.set(r.id, (idCounts.get(r.id) ?? 0) + 1);
const dupIds = [...idCounts.entries()].filter(([, count]) => count > 1);
check(`7. No duplicate ids (${dupIds.length} duplicated)`, dupIds.length === 0);

console.log(
  `\n${failures === 0 ? "PASS" : "FAIL"}: ${failures} check(s) failed out of 7 (item 8, ` +
    `reproducibility, is verified by CI re-running the pipeline against the ` +
    `committed cache — not checked here).`
);

if (failures > 0) process.exit(1);
