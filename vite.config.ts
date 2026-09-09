import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync, readFileSync } from "fs";
import { execSync } from "child_process";

// Copies netlify.toml into dist/ so manual Netlify drag-and-drop deploys
// include the redirects (e.g. /favicon.ico → /icon.svg) and security headers.
const copyNetlifyConfig = () => ({
  name: "copy-netlify-toml",
  closeBundle() {
    copyFileSync("netlify.toml", "dist/netlify.toml");
  },
});

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

function getCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  define: {
    // Surfaced in the UI (see src/App.tsx) so it's obvious which build is
    // running — package.json version plus the exact commit it was built
    // from, since this app doesn't yet have real release tagging.
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(getCommitHash()),
  },
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
