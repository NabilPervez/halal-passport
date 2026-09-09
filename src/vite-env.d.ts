/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEOAPIFY_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config.ts's `define` — package.json version and the
// short commit hash the build was made from.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
