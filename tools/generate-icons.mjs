#!/usr/bin/env node
// Renders the PWA's PNG icons from their SVG sources so the two can't drift.
// Run with `npm run icons` after editing public/icon.svg or icon-maskable.svg.
//
// Two separate sources on purpose:
//   icon.svg          — rounded square, gem fills the frame. Used for
//                       purpose:"any" (home screen on iOS, favicons, Play
//                       listing), where nothing is cropped.
//   icon-maskable.svg — full-bleed background, gem shrunk into the centre
//                       80%-diameter safe circle. Used for purpose:"maskable",
//                       which Android crops to a device-specific shape.

import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const TARGETS = [
  { src: "icon.svg", out: "icon-192.png", size: 192 },
  { src: "icon.svg", out: "icon-512.png", size: 512 },
  // 1024 is what Play Console wants for the store listing (TWA).
  { src: "icon.svg", out: "icon-1024.png", size: 1024 },
  { src: "icon-maskable.svg", out: "icon-maskable-192.png", size: 192 },
  { src: "icon-maskable.svg", out: "icon-maskable-512.png", size: 512 },
];

for (const { src, out, size } of TARGETS) {
  const svg = readFileSync(join(PUBLIC, src));
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  writeFileSync(join(PUBLIC, out), png);
  console.log(`${src} -> ${out} (${size}x${size}, ${png.length} bytes)`);
}

console.log("done");
