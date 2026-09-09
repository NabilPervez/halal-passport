#!/usr/bin/env node
// Verifies the 15 hand-curated mosque records against Geoapify's geocoder
// rather than assuming their existing coordinates are correct (per Phase 6
// of docs/data-pipeline-plan.md). Named, real-address entries — unlike the
// bulk-fabricated restaurant seed — so this is a spot-check, not a rebuild:
// flag anything more than ~1km off for a human to double-check, but don't
// silently overwrite hand-entered data with a geocoder guess.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const GEOAPIFY_KEY = process.env.VITE_GEOAPIFY_KEY || process.env.GEOAPIFY_KEY;
if (!GEOAPIFY_KEY) {
  console.error("FATAL: set GEOAPIFY_KEY in the environment.");
  process.exit(1);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const mosques = JSON.parse(readFileSync(join(ROOT, "src/data/mosques.json"), "utf8"));
  const results = [];

  for (const m of mosques) {
    const params = new URLSearchParams({
      text: `${m.address}`,
      format: "json",
      apiKey: GEOAPIFY_KEY,
    });
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`);
    const data = await res.json();
    const top = data.results?.[0];
    const distance = top ? haversineMeters(m.lat, m.lng, top.lat, top.lon) : null;
    results.push({
      id: m.id,
      name: m.name,
      existing: { lat: m.lat, lng: m.lng },
      geocoded: top ? { lat: top.lat, lng: top.lon, formatted: top.formatted } : null,
      distanceMeters: distance !== null ? Math.round(distance) : null,
      flag: distance !== null && distance > 1000,
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  writeFileSync(join(__dirname, "mosque-verification.json"), JSON.stringify(results, null, 2) + "\n");
  const flagged = results.filter((r) => r.flag || r.geocoded === null);
  console.log(`Checked ${results.length} mosques. ${flagged.length} need review:`);
  for (const f of flagged) {
    console.log(`  ${f.id} (${f.name}): ${f.geocoded ? `${f.distanceMeters}m off` : "no geocoder match"}`);
  }
  console.log("Wrote tools/geocode/mosque-verification.json");
}

main();
