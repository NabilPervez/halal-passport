#!/usr/bin/env node
// Phase 2 — Resolve names to real places via Geoapify's Geocoding API,
// biased and clipped to the DFW metroplex.
//
// Every raw response is cached to tools/geocode/cache/<sha1(name)>.json and
// committed. A cached name is never re-requested — this makes the pipeline
// resumable, reruns free, and reproducible without a key.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "cache");

const GEOAPIFY_KEY = process.env.VITE_GEOAPIFY_KEY || process.env.GEOAPIFY_KEY;
if (!GEOAPIFY_KEY) {
  console.error(
    "FATAL: set GEOAPIFY_KEY (or VITE_GEOAPIFY_KEY) in the environment before running this script."
  );
  process.exit(1);
}

// DFW metroplex bounding box (roughly Denton to Waxahachie, Fort Worth to Rockwall).
const BBOX = { minLng: -97.7, minLat: 32.4, maxLng: -96.4, maxLat: 33.4 };
const BIAS = { lng: -96.797, lat: 32.777 }; // downtown Dallas

const THROTTLE_MS = 200; // ~5 req/s
const MAX_RETRIES = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(name) {
  return createHash("sha1").update(name).digest("hex");
}

async function fetchWithRetry(url, attempt = 1) {
  const res = await fetch(url);
  if (res.ok) return res.json();

  if ((res.status === 429 || res.status >= 500) && attempt <= MAX_RETRIES) {
    const backoff = 500 * 2 ** (attempt - 1);
    console.warn(`  HTTP ${res.status}, retrying in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`);
    await sleep(backoff);
    return fetchWithRetry(url, attempt + 1);
  }

  throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}

async function resolveOne(record) {
  const key = cacheKey(record.name);
  const cachePath = join(CACHE_DIR, `${key}.json`);

  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }

  // Geoapify's /geocode/search parses commas as address components, so a
  // suffixed "<name>, Dallas-Fort Worth, TX" query gets misread as a street
  // address search and returns nothing for a bare business name. The bbox
  // filter + proximity bias already constrain results to the metroplex, so
  // query on the raw name only.
  const params = new URLSearchParams({
    text: record.name,
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
    console.warn(`  FAILED "${record.name}": ${err.message}`);
    raw = { error: String(err.message), results: [] };
  }

  const cacheEntry = { queriedName: record.name, queriedAt: new Date().toISOString(), raw };
  writeFileSync(cachePath, JSON.stringify(cacheEntry, null, 2) + "\n");
  await sleep(THROTTLE_MS);
  return cacheEntry;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const input = JSON.parse(readFileSync(join(__dirname, "input.json"), "utf8"));

  let fromCache = 0;
  let fetched = 0;
  const resolved = [];

  for (let i = 0; i < input.length; i++) {
    const record = input[i];
    const hadCache = existsSync(join(CACHE_DIR, `${cacheKey(record.name)}.json`));
    const result = await resolveOne(record);
    if (hadCache) fromCache++;
    else fetched++;

    resolved.push({ ...record, geocode: result });

    if ((i + 1) % 50 === 0 || i === input.length - 1) {
      console.log(`  ${i + 1}/${input.length} (cache hits: ${fromCache}, fetched: ${fetched})`);
    }
  }

  writeFileSync(
    join(__dirname, "resolved.json"),
    JSON.stringify(resolved, null, 2) + "\n"
  );

  console.log(
    `OK: resolved ${resolved.length} records (${fromCache} from cache, ${fetched} fetched). ` +
      `Wrote tools/geocode/resolved.json`
  );
}

main();
