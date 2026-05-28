/**
 * Export every required raster icon from the master SVG (#53).
 *
 * Reads `store/icons/master-v1.svg`, produces two SVG variants in memory
 * (full icon with blue background, and adaptive-foreground with the
 * background removed), then rasterizes each at the sizes required by:
 *   - web favicon (16/32/48)
 *   - apple-touch-icon (180)
 *   - PWA manifest (192, 512)
 *   - Android legacy launcher mipmaps (48/72/96/144/192)
 *   - Android adaptive foreground mipmaps (108/162/216/324/432)
 *
 * Outputs go to `store/icons/exports/` (committed as the source of truth)
 * AND are copied into the appropriate `android/app/src/main/res/mipmap-*`
 * and `public/` directories where the build picks them up.
 *
 * Run with: `node scripts/export-icons.mjs`
 */

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const MASTER = join(ROOT, 'store/icons/master-v1.svg')
const OUT = join(ROOT, 'store/icons/exports')

mkdirSync(OUT, { recursive: true })

const svgFull = readFileSync(MASTER, 'utf8')
// Strip the background rect for the adaptive foreground layer. The Android
// system composes this with a separate solid-color background drawable, so
// the foreground must be transparent outside the card.
const svgForeground = svgFull.replace(/<rect class="bg"[^/]*\/>/, '')

/**
 * Render an SVG string at the given pixel size and write it to `outPath`.
 * Uses headless Chromium for high-fidelity AA + emoji-clean rasterization.
 */
async function rasterize(page, svg, size, outPath) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px">${svg
        .replace(/\swidth="1024"/, ` width="${size}"`)
        .replace(/\sheight="1024"/, ` height="${size}"`)
      }</div>
    </body></html>`,
    { waitUntil: 'load' },
  )
  await page.screenshot({
    path: outPath,
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  })
}

// Legacy launcher densities (full icon, blue bg baked in).
const LEGACY_SIZES = [
  { dpi: 'mdpi', px: 48 },
  { dpi: 'hdpi', px: 72 },
  { dpi: 'xhdpi', px: 96 },
  { dpi: 'xxhdpi', px: 144 },
  { dpi: 'xxxhdpi', px: 192 },
]
// Adaptive foreground densities (transparent bg). Per Android docs:
// 108dp icon, foreground layer rendered at mdpi=108 → xxxhdpi=432.
const ADAPTIVE_SIZES = [
  { dpi: 'mdpi', px: 108 },
  { dpi: 'hdpi', px: 162 },
  { dpi: 'xhdpi', px: 216 },
  { dpi: 'xxhdpi', px: 324 },
  { dpi: 'xxxhdpi', px: 432 },
]

// Wrap the browser lifecycle in try/finally so a rasterize() failure
// (missing SVG, screenshot error, write failure) never leaks the
// Chromium process — leftover workers from a broken run otherwise
// have to be killed by hand.
const browser = await chromium.launch()
try {
  const page = await browser.newPage()

  // ── Web favicons ──────────────────────────────────────
  for (const size of [16, 32, 48]) {
    const path = join(OUT, `favicon-${size}.png`)
    await rasterize(page, svgFull, size, path)
    console.log(`  ${path}`)
  }

  // ── Apple touch icon ──────────────────────────────────
  await rasterize(page, svgFull, 180, join(OUT, 'apple-touch-icon-180.png'))
  console.log(`  ${join(OUT, 'apple-touch-icon-180.png')}`)

  // ── PWA manifest icons ────────────────────────────────
  for (const size of [192, 512]) {
    const path = join(OUT, `pwa-${size}.png`)
    await rasterize(page, svgFull, size, path)
    console.log(`  ${path}`)
  }

  // ── Android legacy launcher ───────────────────────────
  for (const { dpi, px } of LEGACY_SIZES) {
    const path = join(OUT, `legacy-${dpi}-${px}.png`)
    await rasterize(page, svgFull, px, path)
    console.log(`  ${path}`)
  }

  // ── Android adaptive foreground ───────────────────────
  for (const { dpi, px } of ADAPTIVE_SIZES) {
    const path = join(OUT, `adaptive-fg-${dpi}-${px}.png`)
    await rasterize(page, svgForeground, px, path)
    console.log(`  ${path}`)
  }
} finally {
  await browser.close()
}

// ── Copy into android/ + public/ destinations ───────────
console.log('\nCopying to destination paths…')

// Web favicons + apple-touch into public/
mkdirSync(join(ROOT, 'public'), { recursive: true })
for (const size of [16, 32, 48]) {
  copyFileSync(join(OUT, `favicon-${size}.png`), join(ROOT, `public/favicon-${size}.png`))
}
copyFileSync(join(OUT, 'apple-touch-icon-180.png'), join(ROOT, 'public/apple-touch-icon.png'))
copyFileSync(join(OUT, 'pwa-192.png'), join(ROOT, 'public/pwa-192.png'))
copyFileSync(join(OUT, 'pwa-512.png'), join(ROOT, 'public/pwa-512.png'))

// Android legacy + adaptive into mipmap-*/.
const RES = join(ROOT, 'android/app/src/main/res')
for (const { dpi, px } of LEGACY_SIZES) {
  copyFileSync(
    join(OUT, `legacy-${dpi}-${px}.png`),
    join(RES, `mipmap-${dpi}/ic_launcher.png`),
  )
  // ic_launcher_round.png reuses the same raster (Android composes it over
  // a circular mask itself for legacy round support).
  copyFileSync(
    join(OUT, `legacy-${dpi}-${px}.png`),
    join(RES, `mipmap-${dpi}/ic_launcher_round.png`),
  )
}
for (const { dpi, px } of ADAPTIVE_SIZES) {
  copyFileSync(
    join(OUT, `adaptive-fg-${dpi}-${px}.png`),
    join(RES, `mipmap-${dpi}/ic_launcher_foreground.png`),
  )
}

console.log('done.')
