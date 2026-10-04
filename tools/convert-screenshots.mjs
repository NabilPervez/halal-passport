#!/usr/bin/env node
// One-off: converts captured browser screenshots into the PNG assets the
// web manifest's `screenshots` entries point at (Chrome uses these for the
// richer Android install dialog, and they double as Play listing assets).
// Usage: node tools/convert-screenshots.mjs <narrow1.jpg> <narrow2.jpg> <wide.jpg>

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "screenshots");
mkdirSync(OUT, { recursive: true });

const [narrow1, narrow2, wide] = process.argv.slice(2);
if (!narrow1 || !narrow2 || !wide) {
  console.error("usage: convert-screenshots.mjs <narrow1> <narrow2> <wide>");
  process.exit(1);
}

const JOBS = [
  { src: narrow1, out: "discover-narrow.png", w: 540, h: 1170 },
  { src: narrow2, out: "passport-narrow.png", w: 540, h: 1170 },
  { src: wide, out: "discover-wide.png", w: 1280, h: 800 },
];

for (const { src, out, w, h } of JOBS) {
  const buf = await sharp(src).resize(w, h, { fit: "cover" }).png().toBuffer();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(OUT, out), buf);
  console.log(`${out} (${w}x${h}, ${buf.length} bytes)`);
}
