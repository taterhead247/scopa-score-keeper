# Baselines

Pre-launch performance, accessibility, and bundle reference points. Captured for issue #52 so future regressions can be detected.

**Last measured**: 2026-06-01, commit `issue-52-prelaunch-audit` (immediately before the v1.0 cut).

---

## How to reproduce

```bash
npm run build           # production bundle
npm run preview         # serves dist/ on :4173

# In another shell:
CHROME_PATH="<path to a chromium binary>" \
  npx lighthouse http://localhost:4173 \
    --quiet \
    --chrome-flags='--headless=new --no-sandbox' \
    --output=json \
    --output-path=/tmp/lh-mobile.json \
    --form-factor=mobile \
    --throttling-method=simulate
```

For desktop, swap the last two flags for `--preset=desktop`.

If Chrome isn't installed, Playwright's bundled Chromium works:

```bash
CHROME_PATH=$(node -e "console.log(require('playwright').chromium.executablePath())")
```

---

## Lighthouse scores

Lighthouse 13.3.0, simulated throttling, production build served via `vite preview`.

| Category        | Mobile | Desktop | Target | Status |
| --------------- | -----: | ------: | -----: | :----- |
| Performance     |     70 |      96 |     90 | mobile under target — see "known gaps" |
| Accessibility   |     95 |      95 |     95 | meets target, regression from 100 — see "known gaps" |
| Best Practices  |    100 |     100 |     90 | pass |
| SEO             |    100 |     100 |     90 | pass |

Lighthouse 12+ retired the PWA category. Install / offline behavior is verified manually via the Application panel — see PWA install (#48). Lighthouse 13's "Agentic Browsing" category (currently 67) is not a launch gate.

### Mobile Core Web Vitals (simulated 4× CPU, slow 4G)

| Metric                    | Value | Lighthouse score |
| ------------------------- | ----: | ---------------: |
| First Contentful Paint    | 3.2 s |               44 |
| Largest Contentful Paint  | 7.1 s |                5 |
| Total Blocking Time       |  20 ms |             100 |
| Cumulative Layout Shift   |     0 |             100 |
| Speed Index               | 3.2 s |               92 |
| Time to Interactive       | 7.1 s |               52 |

LCP dominates the score. Root cause is the jeep-sqlite + sql.js wasm fetch on the boot path, not main-bundle size; see [known gaps](#known-gaps).

---

## Bundle size

Production build via `npm run build`. Sizes are raw / gzipped.

### Initial download (first paint)

| Chunk                | Size     | Gzip     | Notes |
| -------------------- | -------: | -------: | :---- |
| `index-*.js` (app)   | 250.6 KB |  70.3 KB | App code |
| `react-vendor`       | 219.0 KB |  66.3 KB | react, react-dom, scheduler |
| `radix-vendor`       | 116.7 KB |  35.4 KB | @radix-ui/* |
| `query-vendor`       |  35.8 KB |  10.6 KB | @tanstack/react-query |
| `icon-vendor`        |   2.3 KB |   1.2 KB | phosphor / heroicons / lucide |
| `jeep-sqlite.entry`  | 292.0 KB |  79.2 KB | sql.js JS shell, lazy on DB init |
| CSS                  | 217.1 KB |  39.8 KB | Tailwind output |
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

### Comparison vs. pre-#52

Single `index-*.js` was **940 KB / 278 KB gzipped** and tripped Vite's >500 KB warning. Splitting recharts behind `HandChart` (#52) plus `manualChunks` for react/radix/query/icons brings the main app chunk to 250 KB and silences the warning. Total bytes are similar but distributed across cacheable, parallel-loadable chunks.

---

## Known gaps

Things the audit surfaced that we are **not** fixing in #52. Each one is acceptable to ship with for v1.0; track as follow-ups.

### Mobile Performance 70 (target 90)

- LCP 7.1 s on simulated slow 4G. Bottleneck is the jeep-sqlite + sql.js wasm bootstrap (~292 KB JS + the wasm itself) blocking the first meaningful paint, which currently waits for SQLite to be ready before rendering anything past the loading state.
- Render-blocking Google Fonts stylesheet (Outfit family). Preconnect is already set; switching to `font-display: swap` or self-hosting would close most of the FCP gap.
- Follow-up: split the loading shell from DB init so the cream background + brand mark paint immediately, then hydrate once SQLite resolves. Self-host fonts.

### Accessibility 95 (was 100 at #46)

- One contrast violation: the Ko-fi support link in the setup footer (`src/App.tsx:790`) uses `text-accent` (`#fa6863`) at 12 px regular → 2.74 : 1 against the cream background. AA needs 4.5 : 1.
- Introduced in #72. CLAUDE.md's a11y rule already says "only `PROFILE_COLORS` and the foreground variable are AA-safe as text" — accent fails.
- Follow-up: swap to `text-foreground` with the heart icon doing the colored highlight, or use a 700-shade red. Re-run Lighthouse to confirm 100.

### Best Practices: source maps

- Lighthouse flags missing source maps for first-party JS. We deliberately don't ship maps to public pages. This is informational, not a category score deduction (BP still scores 100). No action.

### Agentic Browsing 67

- New Lighthouse 13 category (LLM-friendliness via `llms.txt`). Not a launch gate. Add `public/llms.txt` if/when we want indexing by AI agents.

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

Things to verify on the preview before tagging a release:

- App boots, no console errors, SQLite initializes (a profile can be created and persists across reload).
- Service worker registers (DevTools → Application → Service Workers shows `sw.js` "activated and is running").
- Install prompt is dismissable; reopen in fresh profile to re-trigger.
- Lighthouse: Performance ≥ 90 (desktop), A11y ≥ 95, BP ≥ 90, SEO ≥ 90.
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
