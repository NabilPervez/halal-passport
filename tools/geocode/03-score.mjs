#!/usr/bin/env node
// Phase 3 — Score every resolved match.
//
// Geoapify's own confidence is not trusted alone. A composite of
// confidence, name similarity, result_type (POI vs street/city centroid),
// and bbox membership classifies every record as auto / review / unresolved.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BBOX = { minLng: -97.7, minLat: 32.4, maxLng: -96.4, maxLat: 33.4 };

const AUTO_CONFIDENCE = 0.9;
const AUTO_SIMILARITY = 0.85;

// Result types that count as a real place (a business/POI), not a street,
// city, or postcode centroid. A street-level match is a failure, not a weak
// success — it puts the marker at the wrong end of the block at best.
const POI_RESULT_TYPES = new Set(["amenity", "building"]);

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Token-set ratio: size of the token intersection over the size of the
// smaller token set. Handles "Wulf Burger" vs "Wulf Burger Restaurant"
// (high) while still penalizing "Wulf Burger" vs "Burger King" (low).
function tokenSetSimilarity(a, b) {
  const tokensA = new Set(normalize(a));
  const tokensB = new Set(normalize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  return intersection / Math.min(tokensA.size, tokensB.size);
}

// DFW-area cities that show up as explicit qualifiers in scraped names
// ("Heritage Scoop - Plano", "New York Eats (Irving)"). When a name declares
// a city and the geocoder's matched city disagrees, the match is almost
// always wrong — the geocoder found *a* place with that business name, just
// not the one in the city the listing itself names.
const DFW_CITIES = [
  "Dallas", "Fort Worth", "Arlington", "Plano", "Irving", "Garland",
  "McKinney", "Frisco", "Denton", "Mesquite", "Carrollton", "Richardson",
  "Lewisville", "Allen", "Flower Mound", "North Richland Hills", "Mansfield",
  "Euless", "DeSoto", "Grapevine", "Bedford", "Cedar Hill", "Wylie",
  "Keller", "Rowlett", "Coppell", "Burleson", "The Colony", "Little Elm",
  "Rockwall", "Southlake", "Colleyville", "Murphy", "Sachse", "Hurst",
  "Duncanville", "Lancaster", "Waxahachie", "Prosper", "Celina", "Anna",
  "Forney", "Royse City", "Farmers Branch", "Addison", "University Park",
  "Highland Park", "Watauga", "Haltom City", "Benbrook", "Weatherford",
];

function extractDeclaredCity(name) {
  for (const city of DFW_CITIES) {
    const re = new RegExp(`[(\\-–]\\s*${city}\\b|\\b${city}\\s*\\)`, "i");
    if (re.test(name)) return city;
  }
  return null;
}

function inBbox(lat, lng) {
  return (
    lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng
  );
}

function bestCandidate(results, queryName) {
  let best = null;
  let bestScore = -1;
  for (const r of results) {
    const isPoi = POI_RESULT_TYPES.has(r.result_type);
    const confidence = r.rank?.confidence ?? 0;
    const similarity = tokenSetSimilarity(queryName, r.name ?? r.address_line1 ?? "");
    const compositeScore = (isPoi ? 1 : 0) * 2 + confidence + similarity;
    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      best = { r, isPoi, confidence, similarity, compositeScore };
    }
  }
  return best;
}

function scoreRecord(record) {
  const originalResults = record.geocode?.raw?.results ?? [];
  const cleanedResults = record.geocodeCleaned?.raw?.results ?? [];

  if (originalResults.length === 0 && cleanedResults.length === 0) {
    return {
      id: record.id,
      name: record.name,
      status: "unresolved",
      reason: "no geocoder results",
    };
  }

  // Score candidates from the original query and (if attempted) the
  // suffix-stripped cleaned query against the true scraped name — a cleaned
  // query is only ever used to find a candidate, never to inflate the
  // similarity score, so a bad cleaned-query match still lands in review.
  const candidates = [];
  const original = bestCandidate(originalResults, record.name);
  if (original) candidates.push(original);
  if (cleanedResults.length > 0) {
    const cleaned = bestCandidate(cleanedResults, record.name);
    if (cleaned) candidates.push(cleaned);
  }

  const best = candidates.sort((a, b) => b.compositeScore - a.compositeScore)[0];
  const { r, isPoi, confidence, similarity } = best;
  const withinBbox = inBbox(r.lat, r.lon);
  const declaredCity = extractDeclaredCity(record.name);
  const cityConflict =
    declaredCity !== null &&
    r.city &&
    r.city.toLowerCase() !== declaredCity.toLowerCase();

  let status;
  let reason;
  if (!isPoi) {
    status = withinBbox ? "review" : "unresolved";
    reason = `result_type=${r.result_type} (not a POI)`;
  } else if (!withinBbox) {
    status = "unresolved";
    reason = "resolved coordinates outside DFW bbox";
  } else if (cityConflict) {
    // The listing's own name says one city, the geocoder matched a
    // same-named place in another — almost always the wrong branch of a
    // chain or an unrelated business. Never auto-accept this.
    status = "review";
    reason = `name declares "${declaredCity}" but matched city is "${r.city}"`;
  } else if (confidence >= AUTO_CONFIDENCE && similarity >= AUTO_SIMILARITY) {
    status = "auto";
    reason = "POI, high confidence, high name similarity";
  } else {
    status = "review";
    reason = `below threshold (confidence=${confidence.toFixed(2)}, similarity=${similarity.toFixed(2)})`;
  }

  return {
    id: record.id,
    name: record.name,
    matchedName: r.name ?? r.address_line1 ?? null,
    resultType: r.result_type ?? null,
    confidence: Number(confidence.toFixed(3)),
    similarity: Number(similarity.toFixed(3)),
    lat: r.lat,
    lng: r.lon,
    address: r.formatted ?? null,
    city: r.city ?? null,
    category: r.category ?? null,
    placeRef: r.place_id ?? null,
    scrapedRating: record.scrapedRating,
    scrapedType: record.scrapedType,
    status,
    reason,
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const resolved = JSON.parse(readFileSync(join(__dirname, "resolved.json"), "utf8"));
  const scored = resolved.map(scoreRecord);

  const counts = { auto: 0, review: 0, unresolved: 0 };
  for (const s of scored) counts[s.status]++;

  // Sort review rows by descending confidence so the easiest calls come first.
  const columns = [
    "id",
    "name",
    "matchedName",
    "resultType",
    "confidence",
    "similarity",
    "lat",
    "lng",
    "address",
    "status",
  ];
  const rows = [...scored].sort((a, b) => {
    const order = { review: 0, unresolved: 1, auto: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
  const csv = [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(",")),
  ].join("\n");

  writeFileSync(join(__dirname, "report.csv"), csv + "\n");
  writeFileSync(join(__dirname, "scored.json"), JSON.stringify(scored, null, 2) + "\n");

  console.log(
    `OK: scored ${scored.length} records — auto: ${counts.auto}, ` +
      `review: ${counts.review}, unresolved: ${counts.unresolved}`
  );
  console.log("Wrote tools/geocode/report.csv and tools/geocode/scored.json");
}

main();
