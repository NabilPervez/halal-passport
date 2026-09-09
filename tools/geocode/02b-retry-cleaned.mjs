#!/usr/bin/env node
// Phase 2b — Retry non-auto rows with a cleaned query string.
//
// Many scraped names carry promotional/location suffixes that are not part
// of the actual business name — "Heritage Scoop - Plano",
// "FALAFEL AVE (COPPELL, TX 75019)", "DH Noodles & Grill 敦煌兰州牛肉面" —
// and these confuse the geocoder's name matching. This queries a cleaned
// variant for every row that did not auto-resolve on the first pass and
// keeps whichever attempt scores better. Separate cache namespace so the
// original resolved.json is untouched and reruns stay resumable.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "cache-cleaned");

const GEOAPIFY_KEY = process.env.VITE_GEOAPIFY_KEY || process.env.GEOAPIFY_KEY;
if (!GEOAPIFY_KEY) {
  console.error("FATAL: set GEOAPIFY_KEY in the environment before running this script.");
  process.exit(1);
}

const BBOX = { minLng: -97.7, minLat: 32.4, maxLng: -96.4, maxLat: 33.4 };
const BIAS = { lng: -96.797, lat: 32.777 };
const THROTTLE_MS = 200;
const MAX_RETRIES = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanName(raw) {
  let s = raw;
  // Drop parenthetical annotations: "(COPPELL, TX 75019)", "(HALAL Restaurant)"
  s = s.replace(/\([^)]*\)/g, "");
  // Drop trailing " - <City/qualifier>" (a single trailing hyphen segment,
  // typically a location or format qualifier appended by the directory).
  s = s.replace(/\s+-\s+[A-Za-z .]+$/, "");
  // Drop non-Latin script runs (transliterations/duplicate-language names)
  // that OSM's Latin-script `name` field won't match against.
  // eslint-disable-next-line no-control-regex -- \x7F is the ASCII bound, not a control-char match
  s = s.replace(/[^\x00-\x7F]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function cacheKey(name) {
  return createHash("sha1").update(name).digest("hex");
}

async function fetchWithRetry(url, attempt = 1) {
  const res = await fetch(url);
  if (res.ok) return res.json();
  if ((res.status === 429 || res.status >= 500) && attempt <= MAX_RETRIES) {
    const backoff = 500 * 2 ** (attempt - 1);
    await sleep(backoff);
    return fetchWithRetry(url, attempt + 1);
  }
  throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}

async function resolveOne(cleanedName) {
  const key = cacheKey(cleanedName);
  const cachePath = join(CACHE_DIR, `${key}.json`);
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, "utf8"));

  const params = new URLSearchParams({
    text: cleanedName,
    filter: `rect:${BBOX.minLng},${BBOX.minLat},${BBOX.maxLng},${BBOX.maxLat}`,
    bias: `proximity:${BIAS.lng},${BIAS.lat}`,
    format: "json",
    apiKey: GEOAPIFY_KEY,
  });
  const url = `https://api.geoapify.com/v1/geocode/search?${params}`;

  let raw;
  try {
    raw = await fetchWithRetry(url);
  } catch (err) {
    raw = { error: String(err.message), results: [] };
  }
  const entry = { queriedName: cleanedName, queriedAt: new Date().toISOString(), raw };
  writeFileSync(cachePath, JSON.stringify(entry, null, 2) + "\n");
  await sleep(THROTTLE_MS);
  return entry;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const resolved = JSON.parse(readFileSync(join(__dirname, "resolved.json"), "utf8"));
  const scored = JSON.parse(readFileSync(join(__dirname, "scored.json"), "utf8"));
  const scoredById = new Map(scored.map((s) => [s.id, s]));

  const toRetry = resolved.filter((r) => scoredById.get(r.id)?.status !== "auto");
  console.log(`Retrying ${toRetry.length} non-auto rows with cleaned query names...`);

  let changed = 0;
  for (let i = 0; i < toRetry.length; i++) {
    const record = toRetry[i];
    const cleaned = cleanName(record.name);
    if (cleaned && cleaned !== record.name) {
      const cleanedResult = await resolveOne(cleaned);
      record.geocodeCleaned = { queryUsed: cleaned, ...cleanedResult };
      changed++;
    }
    if ((i + 1) % 100 === 0 || i === toRetry.length - 1) {
      console.log(`  ${i + 1}/${toRetry.length}`);
    }
  }

  writeFileSync(join(__dirname, "resolved.json"), JSON.stringify(resolved, null, 2) + "\n");
  console.log(`OK: attempted ${changed} cleaned retries. Updated tools/geocode/resolved.json`);
}

main();
