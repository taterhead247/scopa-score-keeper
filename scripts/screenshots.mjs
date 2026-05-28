#!/usr/bin/env node
/**
 * Generate store-listing phone screenshots via Playwright.
 *
 * Workflow:
 *   1. Start the Vite dev server in one terminal: `npm run dev`
 *   2. Run this script in another: `npm run screenshots`
 *
 * The script drives the dev server with a `?seed=playwright` URL parameter
 * that triggers `src/lib/db/seedForScreenshots.ts` to wipe + populate the
 * SQLite database with a deterministic dataset before the app renders. Then
 * it captures the five shots called out in #57:
 *
 *     1. Setup screen showing Quick Start groupings
 *     2. Mid-game with hand history chart + category selections
 *     3. Primiera calculator open
 *     4. Statistics leaderboard
 *     5. History view with a participant filter applied
 *
 * Output: `store/screenshots/{en,it}/0N-name.png` at 1080x1920
 * (Play Store phone minimum).
 *
 * Skipping a language: pass `--lang en` (or `--lang it`) to capture only one.
 */

import { chromium, devices } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const DEV_URL = process.env.SCREENSHOTS_BASE_URL ?? 'http://localhost:5173'
const OUT_ROOT = join(process.cwd(), 'store', 'screenshots')

/**
 * We DON'T explicitly override the viewport — Playwright's `devices['Pixel 7']`
 * sets 412×915 logical with deviceScaleFactor 2.625, producing roughly
 * 1082×2402 actual-pixel screenshots after the DPR is applied. That comfortably
 * clears Play Store's 1080-wide minimum without overriding the mobile-first
 * CSS breakpoints (the app's `max-w-md` container looks correct at phone
 * widths but leaves huge margins on a 1080-wide logical viewport).
 *
 * If a future capture pass needs an explicit size (e.g. Apple's 6.5" display
 * at 1242×2688), set viewport here AND drop deviceScaleFactor to 1 so the
 * output isn't multiplied.
 */

/** Languages to capture. CLI override via `--lang en|it` selects one. */
const requestedLang = process.argv.includes('--lang')
  ? process.argv[process.argv.indexOf('--lang') + 1]
  : null
const LANGUAGES = requestedLang ? [requestedLang] : ['en', 'it']

/**
 * Strings the script clicks on, per language. Centralizing here keeps the
 * navigation code language-agnostic — if a translation changes, only this
 * map needs to update.
 */
const T = {
  en: {
    appTitle: 'Scopa Score Tracker',
    bankHand: 'Bank Hand',
    calculate: 'Calculate',
    closePrimiera: 'Close',
    statisticsMenu: 'Statistics',
    historyMenu: 'Game History',
    primieraDialogTitle: 'Primiera Calculator',
    statisticsTitle: 'Statistics',
    historyTitle: 'Game History',
    primieraScoreLabel: 'Primiera Score',
  },
  it: {
    appTitle: 'Scopa — Segnapunti',
    bankHand: 'Registra Mano',
    calculate: 'Calcola',
    closePrimiera: 'Chiudi',
    statisticsMenu: 'Statistiche',
    historyMenu: 'Storico Partite',
    primieraDialogTitle: 'Calcolatrice Primiera',
    statisticsTitle: 'Statistiche',
    historyTitle: 'Storico Partite',
    primieraScoreLabel: 'Punteggio Primiera',
  },
}

/** Sleep helper — used between UI mutations to let React commit the next render. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Capture all five screenshots for one language. Each call gets a fresh
 * browser context so the seeded DB state from the previous run can't bleed
 * across.
 */
async function captureLanguage(browser, lang) {
  const strings = T[lang]
  if (!strings) throw new Error(`No string map for language "${lang}"`)

  const outDir = join(OUT_ROOT, lang)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const context = await browser.newContext({
    ...devices['Pixel 7'],
    // Force the locale Playwright reports to the page; doesn't affect our
    // app's i18n (we drive that via the `lang` URL param) but keeps tooltips
    // / dates / etc. consistent.
    locale: lang === 'it' ? 'it-IT' : 'en-US',
  })
  const page = await context.newPage()

  console.log(`[${lang}] Loading dev server with seed flag…`)
  await page.goto(`${DEV_URL}/?seed=playwright&lang=${lang}`, { waitUntil: 'networkidle' })
  await page.waitForSelector(`text=${strings.appTitle}`, { timeout: 15_000 })
  // The setup screen renders once the DB queries settle; small extra wait
  // lets the Quick Start section animate in.
  await sleep(400)

  // Shot 1 — setup screen with Quick Start.
  console.log(`[${lang}] Shot 1 — setup`)
  await page.screenshot({ path: join(outDir, '01-setup.png') })

  // The seeded active game is in `games`; the setup screen's "Open Games"
  // list links into it. Click that to reach the gameplay screen.
  await page.click(`text=${strings.appTitle}`, { force: true }).catch(() => {})
  // Click the seeded vs-list entry — its label is the player names joined
  // by " vs ". Marco appears first; targeting his name finds the link.
  await page.locator('button:has-text("Marco")').first().click()
  await page.waitForSelector(`text=${strings.bankHand}`, { timeout: 10_000 })
  await sleep(400)

  // Shot 2 — mid-game.
  console.log(`[${lang}] Shot 2 — gameplay`)
  await page.screenshot({ path: join(outDir, '02-gameplay.png') })

  // Shot 3 — Primiera calculator open.
  console.log(`[${lang}] Shot 3 — primiera`)
  await page.click(`button:has-text("${strings.calculate}")`)
  await page.waitForSelector(`text=${strings.primieraDialogTitle}`, { timeout: 5_000 })
  await sleep(400)
  await page.screenshot({ path: join(outDir, '03-primiera.png') })
  // Close the calculator before opening the menu.
  await page.keyboard.press('Escape')
  await sleep(200)

  // Shot 4 — Statistics leaderboard.
  console.log(`[${lang}] Shot 4 — statistics`)
  // Open the in-game dropdown menu (the hamburger icon button).
  // It's the second icon button in the header (Card Values is first).
  const headerButtons = page.locator('header button, .max-w-lg > div:first-child button')
  // Click the List/hamburger icon. We target it by its sibling — it's the
  // button without the Key icon's title.
  await page.locator('button[aria-haspopup="menu"]').first().click()
  await page.waitForSelector(`role=menuitem[name="${strings.statisticsMenu}"]`, { timeout: 5_000 })
  await page.click(`role=menuitem[name="${strings.statisticsMenu}"]`)
  await page.waitForSelector(`text=${strings.statisticsTitle}`, { timeout: 5_000 })
  await sleep(400)
  await page.screenshot({ path: join(outDir, '04-statistics.png') })
  await page.keyboard.press('Escape')
  await sleep(200)

  // Shot 5 — History with a participant filter applied.
  console.log(`[${lang}] Shot 5 — history`)
  await page.locator('button[aria-haspopup="menu"]').first().click()
  await page.click(`role=menuitem[name="${strings.historyMenu}"]`)
  await page.waitForSelector(`text=${strings.historyTitle}`, { timeout: 5_000 })
  // Activate the Marco chip in the participants filter row.
  await page.locator('button[aria-pressed]:has-text("Marco")').first().click()
  await sleep(400)
  await page.screenshot({ path: join(outDir, '05-history.png') })

  await context.close()
  console.log(`[${lang}] ✅ Captured 5 shots to ${outDir}`)
}

async function main() {
  console.log(`Capturing screenshots from ${DEV_URL} for: ${LANGUAGES.join(', ')}`)
  const browser = await chromium.launch()
  try {
    for (const lang of LANGUAGES) {
      await captureLanguage(browser, lang)
    }
  } finally {
    await browser.close()
  }
  console.log('Done. Output: store/screenshots/')
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
