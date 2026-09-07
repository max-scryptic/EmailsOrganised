#!/usr/bin/env node

/**
 * The app icons, rendered from the one piece of artwork.
 *
 *   node scripts/generate-icons.mjs
 *
 * `src/app/icon.svg` is the source: the same envelope mark `BrandMark` draws,
 * in the same brand orange. Everything else is derived from it, so the mark is
 * changed in one place and re-rendered here rather than redrawn per format.
 *
 * Next.js links `icon.svg` from every page, and a browser that understands an
 * SVG favicon uses it. The two files below cover what that does not reach:
 *
 *   src/app/favicon.ico   what a browser, crawler, or link unfurler asks for at
 *                         `/favicon.ico` without reading the page first. Three
 *                         sizes so a tab, a bookmark bar, and a desktop shortcut
 *                         each get one rendered for them.
 *   src/app/apple-icon.png  the iOS home screen. Flattened onto the brand orange
 *                           because iOS applies its own rounded mask, and a
 *                           transparent corner under it reads as a notch.
 *
 * `sharp` arrives with Next.js (it is what the image optimizer uses), which is
 * why it is not a dependency of its own. This script runs by hand after the
 * mark changes, not in the build.
 */

/**
 * The mark again, opened up for a 16 pixel grid, and the only artwork here that
 * is not `icon.svg`. At 16px the full mark's hairline stroke lands on about one
 * pixel and its envelope flap closes up against the box: the two read as a
 * smudge rather than an envelope. This is the same drawing with a heavier
 * stroke, a larger envelope, and slightly tighter corners, which is what it
 * takes for the shape to survive. Keep it in step with `icon.svg` by eye when
 * the mark changes; anything 32px and over renders from the source directly.
 */
const smallMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="EmailsOrganised">
  <rect width="24" height="24" rx="4" fill="BRAND" />
  <g fill="none" stroke="#fafafa" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="6.4" width="16" height="11.2" rx="1.6" />
    <path d="M4.75 7.85l6.3 4.5a1.55 1.55 0 0 0 1.9 0l6.3-4.5" />
  </g>
</svg>
`;

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repoRoot, "src/app/icon.svg");

/** The brand orange, read back off the artwork so the two cannot drift. */
function brandOrange(svg) {
  const match = svg.match(/fill="(#[0-9a-f]{6})"/i);
  if (!match) {
    throw new Error(`No fill colour found in ${source}`);
  }
  return match[1];
}

/**
 * A .ico is a small directory of independently encoded images. Each entry is 16
 * bytes; a width or height of 256 is written as 0. PNG payloads are what every
 * current browser reads, and are far smaller than the BMP form.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size, 0 for a truecolour image
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    throw new Error(
      "sharp is not installed. Run `npm ci` first; it comes with Next.js."
    );
  }
}

async function main() {
  const sharp = await loadSharp();
  const svg = readFileSync(source);
  const background = brandOrange(svg.toString("utf8"));
  const small = Buffer.from(smallMark.replace("BRAND", background), "utf8");

  // The artwork is a 24 unit square, so the density that renders it at `size`
  // pixels is the 72dpi default scaled by the same ratio. Rasterising at the
  // target size rather than shrinking a large render is what keeps the stroke
  // edges clean.
  const render = (artwork, size) =>
    sharp(artwork, { density: (72 * size) / 24 })
      .resize(size, size)
      .png()
      .toBuffer();

  const icoSizes = [16, 32, 48];
  const icoImages = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      data: await render(size === 16 ? small : svg, size),
    }))
  );

  const favicon = path.join(repoRoot, "src/app/favicon.ico");
  const appleIcon = path.join(repoRoot, "src/app/apple-icon.png");

  mkdirSync(path.dirname(favicon), { recursive: true });
  writeFileSync(favicon, buildIco(icoImages));

  await sharp(svg, { density: (72 * 180) / 24 })
    .resize(180, 180)
    .flatten({ background })
    .png()
    .toFile(appleIcon);

  for (const file of [favicon, appleIcon]) {
    console.log(`Wrote ${path.relative(repoRoot, file)}`);
  }
}

await main();
