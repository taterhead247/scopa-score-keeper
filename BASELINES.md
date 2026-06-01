# Baselines

Pre-launch performance, accessibility, and bundle reference points. Captured for issue #52 so future regressions can be detected.

**Last measured**: 2026-06-01, branch `issue-52-prelaunch-audit` (the v1.0 cut).

---

## How to reproduce

```bash
npm run build           # production bundle
npm run preview         # serves dist/ on :4173

# In another shell:
npx lighthouse http://localhost:4173 --view --form-factor=mobile
# desktop:
npx lighthouse http://localhost:4173 --view --preset=desktop
```

If Chrome isn't installed, Playwright's bundled Chromium works:

```bash
CHROME_PATH=$(node -e "console.log(require('playwright').chromium.executablePath())") \
  npx lighthouse http://localhost:4173 --view --form-factor=mobile
```

---

## Lighthouse scores

Lighthouse 13.3.0, simulated throttling, production build served via `vite preview`.

| Category        | Mobile | Desktop | Target | Status |
| --------------- | -----: | ------: | -----: | :----- |
| Performance     |     71 |      97 |     90 | mobile under target — LCP gated by SQLite boot, see "known gaps" |
| Accessibility   |    100 |     100 |     95 | pass |
| Best Practices  |    100 |     100 |     90 | pass |
| SEO             |    100 |     100 |     90 | pass |

Lighthouse 12+ retired the PWA category. Install / offline behavior is verified manually via the Application panel — see PWA install (#48). Lighthouse 13's "Agentic Browsing" category (currently 67) is not a launch gate.

### Mobile Core Web Vitals (simulated 4× CPU, slow 4G)

| Metric                    | Value | Lighthouse score |
| ------------------------- | ----: | ---------------: |
| First Contentful Paint    | 2.9 s |               55 |
| Largest Contentful Paint  | 7.2 s |                5 |
| Total Blocking Time       |  20 ms |             100 |
| Cumulative Layout Shift   |     0 |             100 |
| Speed Index               | 2.9 s |               95 |
| Time to Interactive       | 7.2 s |               50 |

**Observed** (real, unthrottled) timings from the same trace:

| Metric | Observed |
| ------ | -------: |
| First Paint                 | 50 ms |
| First Contentful Paint      | 50 ms |
| Largest Contentful Paint    | 183 ms |
| Last visual change          | 171 ms |

Throttled LCP is heavily simulated (real LCP fires <200 ms on a fast machine). The simulator projects the LCP element's dependency chain onto slow 4G + 4× CPU; the dominant link in that chain is the React+SQLite mount path, not the bundle weight or fonts — those were the targets of #52's bundle work and font self-host. See [known gaps](#known-gaps).

---

## Bundle size

Production build via `npm run build`. Sizes are raw / gzipped.

### Initial download (first paint)

| Chunk                | Size     | Gzip     | Notes |
| -------------------- | -------: | -------: | :---- |
| `index-*.js` (app)   | 251.5 KB |  70.7 KB | App code |
| `react-vendor`       | 219.0 KB |  66.3 KB | react, react-dom, scheduler |
| `radix-vendor`       | 116.7 KB |  35.4 KB | @radix-ui/* |
| `query-vendor`       |  35.8 KB |  10.6 KB | @tanstack/react-query |
| `icon-vendor`        |   2.3 KB |   1.2 KB | phosphor / heroicons / lucide |
| `jeep-sqlite.entry`  | 292.0 KB |  79.2 KB | sql.js JS shell, eager on DB init |
| CSS                  | 217.1 KB |  39.8 KB | Tailwind output |
| Outfit (2 preloaded) |  27.4 KB |       — | 400 + 700 weights, woff2 |
| **Total initial JS** | **~916 KB** | **~263 KB** | |

### On-demand chunks (lazy)

| Chunk              |     Size |   Gzip | Trigger |
| ------------------ | -------: | -----: | :------ |
| `chart-vendor`     | 346.3 KB | 102.3 KB | recharts/d3 — loads with HandChart (after first hand banked) |
| `AboutDialog`      |  72.7 KB |  24.1 KB | About menu item |
| `HistoryScreen`    |   7.6 KB |   2.6 KB | History menu item |
| `StatisticsScreen` |   9.4 KB |   2.8 KB | Statistics menu item |
| `PlayersScreen`    |   4.3 KB |   1.6 KB | Players menu item |
| `HandChart`        |   1.9 KB |   1.0 KB | First-hand banked (pulls chart-vendor) |
| `PremieraCalc`     |   2.6 KB |   1.0 KB | "Calculate" button |
| `CardValuesLegend` |   2.7 KB |   1.0 KB | Card values info button |

### What #52 changed

Pre-#52 produced a single 940 KB / 278 KB-gzipped main chunk that tripped Vite's >500 KB warning. The split sends recharts behind `HandChart` (lazy) and lifts react/radix/query/icons into dedicated vendor chunks. The main app chunk is now 250 KB and the warning is gone. Total bytes are similar but the chunks parallel-load and cache per family.

`three` (declared but never imported) was removed.

Outfit is now self-hosted from `public/fonts/outfit/` with inline `@font-face` + a `<link rel="preload">` on 400 + 700. Google Fonts' runtime third-party request was previously ~600 ms render-blocking on slow 4G; eliminating it shaved FCP from 3.5 s → 2.9 s.

Static loading shell (cream background + brand mark + wordmark) now renders directly from `index.html` so the user sees a styled splash at HTML parse instead of a white flash followed by "Loading…". React mounts behind it. (LCP win was smaller than hoped — see known gaps.)

---

## Known gaps

Things the audit still surfaces that we are **not** fixing here. Each one is acceptable to ship with for v1.0; track as follow-ups.

### Mobile Performance 71 (target 90) — LCP gated by SQLite boot

- Simulated LCP is 7.2 s. The static loading shell paints at ~50 ms (observed FCP), but Lighthouse's LCP reflects the *last* largest content paint, and that lands once React + jeep-sqlite have finished mounting and the setup screen has rendered its player-seat cards.
- Root cause: `Bootstrap` in `src/main.tsx` waits on `initDatabase()` before rendering the setup screen. Even though SQLite init is fast locally, on simulated slow 4G + 4× CPU the dependency chain (HTML → JS bundle parse → SQLite init → setup-screen paint) projects out past 7 s.
- Follow-up: render the setup screen optimistically against empty-state defaults and hydrate when DB queries resolve, or move `createRoot()` inside the `initDatabase().then(...)` chain so the static shell isn't replaced until DB is ready *and* contains the same biggest element as the setup screen (so the browser doesn't reset the LCP candidate).
- This is the single architectural change that would land mobile Performance ≥ 90. It needs a careful pass on every screen that reads DB data — out of scope for #52.

### Best Practices: missing source maps

- Lighthouse flags missing source maps for first-party JS. We deliberately don't ship maps to public pages. Informational only — BP still 100. No action.

### Agentic Browsing 67

- Lighthouse 13's LLM-friendliness category (`llms.txt`). Not a launch gate. Add `public/llms.txt` if/when we want indexing by AI agents.

---

## Release build

### Web (PWA on GitHub Pages)

The `main` branch auto-deploys via GitHub Actions to `https://<user>.github.io/scopa-score-keeper/`.

Local equivalent:

```bash
npm install
npm run build           # tsc --noCheck + vite build → dist/
npm run preview         # local smoke test of the production bundle on :4173
```

Verify on the preview before tagging a release:

- App boots, no console errors, SQLite initializes (a profile can be created and persists across reload).
- Static shell paints immediately on cold load — no white flash before "Scopa Score" appears.
- Service worker registers (DevTools → Application → Service Workers shows `sw.js` "activated and is running").
- Install prompt is dismissable; reopen in fresh profile to re-trigger.
- Lighthouse: Performance ≥ 90 (desktop), A11y = 100, BP ≥ 90, SEO = 100.
- Bundle: no Vite ">500 kB" warning.

### Android (Capacitor)

Web → native sync, then build the AAB via Android Studio (or Gradle CLI). The web assets must be built **before** sync — Capacitor copies `dist/` into the Android project's `assets/public/`.

```bash
# Web build first — capacitor reads dist/
npm run build

# Sync web assets + plugin gradle deps into android/
npx cap sync android

# Open in Android Studio (recommended for signing/releasing)
npx cap open android

# Or build directly from the CLI
cd android
./gradlew bundleRelease       # → android/app/build/outputs/bundle/release/app-release.aab
```

Notes:

- Bump `versionCode` and `versionName` in `android/app/build.gradle` for each Play submission.
- Icon changes: edit `store/icons/master-v1.svg`, then `node scripts/export-icons.mjs` regenerates every raster (web favicons + PWA icons + Android adaptive foreground + legacy launcher mipmaps). Don't hand-edit the binary PNGs.
- `npx cap sync` is **not** run by CI — it's a manual post-merge step before any Android release.

### Store assets

- Listing copy: `store/listing/{en,it}/{short.txt,long.txt}`. Keep in sync with the in-app feature set.
- Screenshots: `npm run screenshots` (dev server running in another tab) → `store/screenshots/{en,it}/` at 1080 × 1920.

---

## Android device-testing checklist

Lighthouse only audits the web build. The Capacitor APK has to be smoke-tested on real hardware before shipping to the Play Store — emulator and dev mode hide several classes of bugs (haptics, real storage permissions, kill-on-OOM behavior, airplane-mode SQLite quirks).

Run this on at least one **mid-range** Android device, ideally also one older (Android 8–9 era) device:

- [ ] Install the release AAB / APK from a Play Store internal-test track.
- [ ] Open the app cold. Loading screen → setup screen appears within ~2 s. No white flash.
- [ ] Create two profiles, start a game, play all the way to a winner. No dropped touches, no jank in the score animations or confetti.
- [ ] Force-kill the app from recent-tasks. Reopen. The active game is restored (SQLite persistence works).
- [ ] Toggle airplane mode. Open the app cold. App should boot fully and gameplay should work — no network requests are required after the initial install.
- [ ] In settings, verify haptics fire on:
  - score bank (medium haptic)
  - undo (light haptic)
  - winner declared (success haptic)
- [ ] Open About → Support link. Browser opens correctly to Ko-fi.
- [ ] Stats / History dialogs open without lag from a long-completed-games list (test after seeding 10+ games).
- [ ] Rotate the device (if not locked to portrait). Layout doesn't break.
