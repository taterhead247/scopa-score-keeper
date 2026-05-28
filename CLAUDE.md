# Scopa Score Keeper

Cross-platform (web + Android via Capacitor) score tracker for the Italian card game Scopa.

## Stack

- React 19 + TypeScript, Vite build
- Capacitor 8 for Android
- SQLite (`@capacitor-community/sqlite`) for persistent storage — UI subscribes via TanStack Query (`@tanstack/react-query`)
- Tailwind v4 + Radix UI primitives via the `src/components/ui/` shadcn-style components
- Sonner for toasts
- zod for schema validation (data export/import, etc.)
- Vitest + Testing Library; sql.js drives an in-memory SQLite in tests (see `src/test/sqliteMock.ts`)

## Where things live

- `src/App.tsx` — the whole app shell (setup screen + gameplay screen)
- `src/components/` — feature components; UI primitives in `ui/`
- `src/lib/db/` — SQLite layer (schema, connection, per-entity modules, hooks bridging to React Query)
- `src/lib/db/migrations.ts` — one-shot data migrations run on boot
- `src/lib/db/portability.ts` — export/import (issue #45)
- `src/lib/profiles.ts` / `src/lib/groupings.ts` / `src/lib/game.ts` — core domain types
- `src/i18n.ts` — EN + IT translation table (both languages must stay in sync)
- `src/hooks/` — small React hooks (`use-mobile`, `use-reduced-motion`)
- `src/test/` — Vitest tests; `setup.ts` mocks Capacitor SQLite

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm run test:run` — vitest one-shot
- `npm run screenshots` — Playwright store-listing automation

## Conventions worth keeping

- **i18n is required on user-visible strings.** Every label/toast/aria-label has EN and IT entries in `src/i18n.ts`. The `tr()` helper inside App is `t(key, language, params)`.
- **All persistence goes through `src/lib/db/`.** No new `localStorage` keys. The DB hooks invalidate via TanStack Query — mutations call `useInvalidateAll()` or a specific key.
- **Game player metadata is snapshotted on game creation.** If you need to read a name/color/emoji from a historical game, use the row on `game_players`, not the live `profiles` row.
- **The unified `games` table** holds both active and completed games (`completed_at IS NULL` distinguishes them). Don't introduce a second table.

## WCAG 2.2 AA — the rules this project ships under

Issue #46 brought the app to Lighthouse a11y 100 / 100. **Future UI changes must not regress that.** Run the following checks any time you add or modify a UI component:

### Color & contrast

- **Text contrast ≥ 4.5 : 1** against its background (3 : 1 for ≥18 pt or ≥14 pt bold). The cream app background (`oklch(0.96 0.02 80)` ≈ `#f5edd6`) is light enough that **only `PROFILE_COLORS` (Tailwind 700/800-shade darks) and the foreground variable are AA-safe as text**. Tailwind 500-shade colors will fail.
- If you add a color to `PROFILE_COLORS`: verify ≥ 4.5 : 1 against `#f5edd6` *and* ≥ 4.5 : 1 against white text (so it works as a chip background). Use the helper in `/tmp/contrast.mjs` style snippet if needed, or `npx @adobe/leonardo-contrast-colors`.
- Don't introduce a new background color without rechecking every text color used on it.

### Touch targets

- Frequently tapped controls (in-game header buttons, scopa +/-, dropdown triggers): **44 × 44 CSS px minimum.** Use `className="h-11 w-11"` on icon `<Button>`s — Button's default `size="icon"` is `size-9` (36 px), too small.
- WCAG 2.5.8 strictly requires 24 × 24; we go above that for mobile usability.

### Semantics & ARIA

- **Icon-only buttons need `aria-label`.** No exceptions. The svg should also carry `aria-hidden="true"` so it isn't announced redundantly.
- **Toggle-state buttons need `aria-pressed`.** See `PlayerButton` in `App.tsx` — `aria-pressed={isSelected}`. Don't use color alone to signal state.
- **Live regions for important state changes.** The gameplay screen has an `aria-live="polite"` `role="status"` div that announces score updates after `bankHand`. If you add another high-signal event, route it through the same pattern.
- Wrap the page's primary content in a `<main>` element (Lighthouse `landmark-one-main` audit).
- `<html lang>` is set in `index.html`; if you ever generate localized HTML at runtime, update `document.documentElement.lang` too.

### Motion

- Honor `prefers-reduced-motion`. The codebase has both layers:
  1. `usePrefersReducedMotion()` in `src/hooks/use-reduced-motion.ts` — gate JSX that mounts many animated nodes (e.g. the 400-piece confetti).
  2. A global `@media (prefers-reduced-motion: reduce)` rule in `src/main.css` flattens animation/transition durations to 0.01ms. This is a safety net; don't rely on it in isolation for heavy animations.
- Never auto-play >5 s animations and never block input during animations.

### Forms & focus

- All inputs need an associated `<Label>`.
- Focus rings come from Radix + the Button variants — don't remove `outline-none focus-visible:ring-*`. If you write a non-Radix interactive, copy the focus styles from `src/components/ui/button.tsx`.

### Before opening a PR

- Add a `npm run build` step to confirm types.
- Add unit tests for behavior, not styling. Test that aria-pressed toggles (see `src/test/app.test.tsx` "Accessibility (#46)" describe block) — these guard against silent regressions.
- For UI changes, manually run Lighthouse against the production build (`npm run build && npm run preview` then `npx lighthouse http://localhost:4173 --only-categories=accessibility`). Target ≥95.

## Commit / branch conventions

- One branch per issue: `issue-<n>-<short-slug>`.
- Reference the issue in the commit message ("closes #N" / "refs #N").
- Single commit per logical unit; keep auto-generated files (capacitor gradle, lockfiles) in the same commit as the feature that introduced them.
- Don't include `Co-Authored-By` on commits in `/Users/evan-home/Dev/typesetting` (per global preference) but include it elsewhere.
