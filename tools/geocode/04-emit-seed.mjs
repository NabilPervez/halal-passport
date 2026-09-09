#!/usr/bin/env node
// Phase 5 — Emit the real seed data.
//
// Only "auto" status records ship with resolved coordinates — see
// docs/data-pipeline-plan.md and the note at the top of overrides.json for
// why "review" rows are NOT auto-promoted here. "review" and "unresolved"
// rows are written to unresolved.json for a human to work through
// tools/geocode/report.csv and add entries to overrides.json (applied last,
// wins over everything). Re-run this script after adding overrides.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const BBOX = { minLng: -97.7, minLat: 32.4, maxLng: -96.4, maxLat: 33.4 };

// Explicit, committed mapping from Geoapify/OSM categories to this app's
// cuisine vocabulary. An unmapped category becomes cuisine: null — never a
// guess. Extend this table rather than inferring from the scraped `type`
// string, which is a Google UI label, not a stable taxonomy.
const CATEGORY_TO_CUISINE = {
  "catering.restaurant": null, // too generic to imply a cuisine on its own
  "catering.fast_food": "Fast food",
  "catering.cafe": "Coffee shop",
  "catering.ice_cream": "Ice cream shop",
  "commercial.food_and_drink.bakery": "Bakery",
  "commercial.supermarket": "Grocery store",
};

// Fallback: derive a cuisine label from the scraped Google "type" string
// (e.g. "Turkish restaurant" -> "Turkish") when the geocoder category is too
// generic (or absent) to be useful on its own. This is real, scraped signal
// — not a guess — so it takes priority over the coarse category map above.
function cuisineFromScrapedType(scrapedType) {
  if (!scrapedType) return null;
  if (/closed/i.test(scrapedType)) return null;
  const cleaned = scrapedType
    .replace(/\brestaurant\b/gi, "")
    .replace(/\bstore\b/gi, "")
    .trim();
  return cleaned || null;
}

function businessStatusFromScrapedType(scrapedType) {
  if (!scrapedType) return "operational";
  if (/permanently closed/i.test(scrapedType)) return "permanently_closed";
  if (/temporarily closed/i.test(scrapedType)) return "temporarily_closed";
  return "operational";
}

// Deterministic hero color from the id, so it stays stable across rebuilds
// instead of being randomly reassigned.
const JEWEL_TONES = ["emerald", "ruby", "sapphire", "amethyst", "topaz"];
function heroColorFromId(id) {
  const hash = createHash("sha1").update(id).digest();
  return JEWEL_TONES[hash[0] % JEWEL_TONES.length];
}

// Strip the "<Name>, " prefix Geoapify's `formatted` field repeats at the
// front of the address string.
function cleanAddress(formatted, name) {
  if (!formatted) return "";
  const prefix = `${name}, `;
  return formatted.startsWith(prefix) ? formatted.slice(prefix.length) : formatted;
}

function inBbox(lat, lng) {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
}

function emitMosques() {
  const mosques = JSON.parse(readFileSync(join(ROOT, "src/data/mosques.json"), "utf8"));
  const verification = JSON.parse(
    readFileSync(join(__dirname, "mosque-verification.json"), "utf8")
  );
  const verificationById = new Map(verification.map((v) => [v.id, v]));

  return mosques.map((m) => {
    const v = verificationById.get(m.id);
    // The existing hand-typed coordinates are rounded/approximate; the
    // address string is real and specific, so prefer geocoding it fresh
    // over trusting the stored lat/lng. Fall back to the stored value only
    // if the verification pass found nothing.
    const lat = v?.geocoded?.lat ?? m.lat;
    const lng = v?.geocoded?.lng ?? m.lng;
    return {
      id: m.id,
      name: m.name,
      placeRef: null,
      cuisine: null,
      city: m.neighborhood,
      lat,
      lng,
      address: m.address,
      businessStatus: "operational",
      halalStatus: "unverified",
      dietaryTags: [],
      pricePoint: null,
      scrapedRating: null,
      heroColor: heroColorFromId(m.id),
      isMosque: true,
      matchConfidence: v?.geocoded ? 1 : 0.5,
      matchMethod: "manual",
    };
  });
}

function main() {
  const scored = JSON.parse(readFileSync(join(__dirname, "scored.json"), "utf8"));
  const overrides = JSON.parse(readFileSync(join(__dirname, "overrides.json"), "utf8"));

  const shipped = [...emitMosques()];
  const unresolved = [];

  for (const record of scored) {
    const override = overrides[record.id];

    if (override?.drop) {
      unresolved.push({ ...record, droppedReason: override.reason ?? "manual drop" });
      continue;
    }

    // Only "auto" rows (or rows with an explicit manual override) ship with
    // real coordinates. "review" and plain "unresolved" rows are NOT
    // promoted here — see the header comment.
    const usable = record.status === "auto" || override;
    if (!usable) {
      unresolved.push(record);
      continue;
    }

    const lat = override?.lat ?? record.lat;
    const lng = override?.lng ?? record.lng;
    if (typeof lat !== "number" || typeof lng !== "number" || !inBbox(lat, lng)) {
      unresolved.push({ ...record, droppedReason: "no usable in-bbox coordinates" });
      continue;
    }

    const address = override?.address ?? cleanAddress(record.address, record.name);
    const city = override?.city ?? record.city ?? "";
    const cuisine =
      cuisineFromScrapedType(record.scrapedType) ??
      (record.category ? CATEGORY_TO_CUISINE[record.category] ?? null : null);

    shipped.push({
      id: record.id,
      name: record.name,
      placeRef: record.placeRef ?? null,
      cuisine,
      city,
      lat,
      lng,
      address,
      businessStatus: businessStatusFromScrapedType(record.scrapedType),
      halalStatus: "unverified",
      dietaryTags: [],
      pricePoint: null,
      scrapedRating: record.scrapedRating ?? null,
      heroColor: heroColorFromId(record.id),
      matchConfidence: override?.matchMethod === "manual" ? 1 : record.confidence ?? 0,
      matchMethod: override ? "manual" : "auto",
    });
  }

  // Same-node dedup. Multiple distinct scraped names can resolve to the
  // same upstream placeRef — most often a chain where OSM only has one
  // branch mapped (5 "Zio Al's" locations collapsing onto 1 Richardson
  // node), occasionally a literal duplicate scrape of one place under two
  // name spellings. Either way, shipping every one of them plants several
  // catalog entries on the identical coordinate, which is wrong for all but
  // at most one of them and we cannot tell algorithmically which. Keep the
  // single best name-similarity match per placeRef; demote the rest to
  // unresolved for a human to locate the correct branch individually.
  const byRef = new Map();
  for (const record of shipped) {
    if (!record.placeRef) continue;
    if (!byRef.has(record.placeRef)) byRef.set(record.placeRef, []);
    byRef.get(record.placeRef).push(record);
  }
  const demoted = new Set();
  for (const [, group] of byRef) {
    if (group.length <= 1) continue;
    const scoredById = new Map(scored.map((s) => [s.id, s]));
    const [, ...rest] = [...group].sort(
      (a, b) => (scoredById.get(b.id)?.similarity ?? 0) - (scoredById.get(a.id)?.similarity ?? 0)
    );
    for (const loser of rest) demoted.add(loser.id);
  }
  const finalShipped = shipped.filter((r) => !demoted.has(r.id));
  for (const record of shipped) {
    if (demoted.has(record.id)) {
      unresolved.push({
        id: record.id,
        name: record.name,
        status: "review",
        reason: `shares an upstream place with another record (placeRef ${record.placeRef}) — likely a chain branch OSM hasn't mapped separately; needs a per-branch manual lookup`,
      });
    }
  }

  writeFileSync(
    join(ROOT, "src/data/restaurants.json"),
    JSON.stringify(finalShipped, null, 2) + "\n"
  );
  writeFileSync(
    join(__dirname, "unresolved.json"),
    JSON.stringify(unresolved, null, 2) + "\n"
  );

  console.log(
    `OK: shipped ${finalShipped.length}/${scored.length} records to src/data/restaurants.json ` +
      `(${((finalShipped.length / scored.length) * 100).toFixed(1)}% retention, ` +
      `${demoted.size} demoted for sharing an upstream place with another record).`
  );
  console.log(
    `${unresolved.length} records need human review — see tools/geocode/report.csv ` +
      `and tools/geocode/unresolved.json.`
  );
}

main();
