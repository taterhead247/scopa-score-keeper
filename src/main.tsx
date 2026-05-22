import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from 'sonner'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { PROFILES_MIGRATED_FLAG } from './lib/profiles'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// One-time wipe when introducing Player Profiles (issue #23 Phase 1).
// Old game data isn't tied to profiles, so we discard it on first load.
try {
  if (typeof window !== 'undefined' && !window.localStorage.getItem(PROFILES_MIGRATED_FLAG)) {
    const keysToWipe = [
      'scopa-games',
      'scopa-active-game-id',
      'scopa-completed-games',
      'scopa-players',
      'scopa-hand-scopa',
      'scopa-hand-cards',
      'scopa-hand-coins',
      'scopa-hand-settebello',
      'scopa-hand-premiera',
      'scopa-hand-history',
      'scopa-player-count',
      'scopa-player-names',
      'scopa-premiera-open',
      'scopa-premiera-cards',
    ]
    keysToWipe.forEach(k => window.localStorage.removeItem(k))
    window.localStorage.setItem(PROFILES_MIGRATED_FLAG, '1')
  }
} catch {
  // ignore storage errors; the app will simply boot with whatever state localStorage had
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
    <Toaster />
   </ErrorBoundary>
)
