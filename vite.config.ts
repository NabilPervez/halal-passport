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
      // "prompt", not "autoUpdate": the app asks before swapping builds via
      // the toast in src/components/UpdateToast.tsx. autoUpdate had no
      // user-visible signal at all, so a stale cached build could sit there
      // looking current (which is exactly what happened twice in testing).
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-maskable.svg"],
      manifest: {
        // Stable identity for the installed app — without an explicit id the
        // browser derives one from start_url, so changing start_url later
        // would orphan existing installs.
        id: "/?source=pwa",
        name: "Halal Passport — DFW Halal Spots",
        short_name: "Halal Passport",
        description:
          "Discover, track, and share halal restaurants and mosques across the Dallas–Fort Worth metroplex. Works offline; your data stays on your device.",
        theme_color: "#0E0E12",
        background_color: "#0E0E12",
        display: "standalone",
        start_url: "/?source=pwa",
        scope: "/",
        lang: "en-US",
        dir: "ltr",
        orientation: "any",
        categories: ["food", "travel", "lifestyle"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Separate maskable source — the "any" icon fills its frame and
          // would get its corners cropped by Android's mask.
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        screenshots: [
          {
            src: "/screenshots/discover-narrow.png",
            sizes: "540x1170",
            type: "image/png",
            form_factor: "narrow",
            label: "Browse halal spots on the map",
          },
          {
            src: "/screenshots/passport-narrow.png",
            sizes: "540x1170",
            type: "image/png",
            form_factor: "narrow",
            label: "Filter by cuisine, distance, and halal level",
          },
          {
            src: "/screenshots/discover-wide.png",
            sizes: "1280x800",
            type: "image/png",
            form_factor: "wide",
            label: "Halal Passport on a larger screen",
          },
        ],
        // These deep-link into a tab via ?tab=, which App.tsx reads on load.
        shortcuts: [
          { name: "Discover", short_name: "Discover", url: "/?tab=discover&source=shortcut" },
          { name: "Wishlist", short_name: "Wishlist", url: "/?tab=wishlist&source=shortcut" },
          { name: "My Passport", short_name: "Passport", url: "/?tab=eaten&source=shortcut" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        // Any in-scope navigation resolves to the app shell, so a deep link
        // or a reload while offline still boots the app instead of failing.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
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
          {
            // Google Fonts: the stylesheet changes rarely, the font files
            // never — cache both so the app isn't unstyled offline.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
