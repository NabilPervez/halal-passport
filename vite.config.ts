import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync } from "fs";

// Copies netlify.toml into dist/ so manual Netlify drag-and-drop deploys
// include the redirects (e.g. /favicon.ico → /icon.svg) and security headers.
const copyNetlifyConfig = () => ({
  name: "copy-netlify-toml",
  closeBundle() {
    copyFileSync("netlify.toml", "dist/netlify.toml");
  },
});

export default defineConfig({
  plugins: [
    react(),
    copyNetlifyConfig(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Halal Passport — DFW Halal Spots",
        short_name: "Halal Passport",
        description: "Discover, track, and share the best halal restaurants across the DFW metroplex.",
        theme_color: "#0E0E12",
        background_color: "#0E0E12",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            // The app renders its map via Geoapify/MapLibre, not Google
            // Maps — this was stale from an earlier Google Maps JS API
            // build and meant map tiles were never actually cached, so the
            // "offline-capable" map silently wasn't.
            urlPattern: /^https:\/\/maps\.geoapify\.com\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "geoapify-map-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
