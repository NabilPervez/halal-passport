# Halal Passport — DFW Halal Spots

A local-first PWA for discovering, tracking, and sharing halal restaurants
across the Dallas-Fort Worth metroplex. Built from the sprint PRD:
local-first storage, map discovery, wishlist/eaten lists, dish-level
reviews, and native SMS/WhatsApp sharing.

## Stack
React + TypeScript + Vite, Tailwind CSS, Framer Motion, IndexedDB (`idb`),
Google Maps JavaScript API, Web Share API, `vite-plugin-pwa`.

## Getting started
```bash
npm install
cp .env.example .env
# add your Google Maps API key to .env (optional — see below)
npm run dev
```

## Google Maps
`VITE_GOOGLE_MAPS_API_KEY` is optional. Without it, Discover falls back to
a neighborhood-grouped list so the app is fully usable out of the box. Add
a key from the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
to enable the live jewel-toned map with markers and info cards.

## Data
All restaurant, wishlist, eaten, and review data lives in IndexedDB on the
device — nothing is sent to a server. Eight demo DFW restaurants are
seeded on first launch so the app isn't empty; replace `src/data/mockRestaurants.ts`
with real data whenever you're ready.

## Sprints implemented
1. **Local data + map** — IndexedDB schema (`restaurants`, `reviews`), Google
   Map centered on DFW with jewel-toned markers and styled info cards.
2. **Lists** — Wishlist/Eaten states with a Bento-grid layout and Framer
   Motion spring transitions on save/state changes.
3. **Reviews** — 1–5 gem rating, "what to get" / "what to avoid" notes,
   price point, and dietary-tag badges.
4. **Sharing + PWA** — Web Share API with SMS/WhatsApp deep-link fallback,
   installable manifest, offline-capable service worker via Workbox.

## Build
```bash
npm run build   # type-checks then builds to dist/
npm run preview # serve the production build locally
```

## Design
Dark, jewel-toned "Spotify for halal food" visual system — no gradients,
flat jewel-tone fills (emerald, ruby, sapphire, amethyst, topaz) on a
near-black ground, Sora for display type and Inter for body/UI. The
rating control uses a cut-gem glyph instead of a generic star as the
app's signature visual element.
