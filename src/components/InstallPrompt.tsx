import { X, DeviceMobile, Export } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { useOnboardingFlag } from '@/hooks/use-onboarding'

/** Translation helper signature shared across the app. */
type Tr = (key: string, params?: Record<string, string>) => string

/**
 * In-app install affordance (#48).
 *
 * Renders one of three things depending on platform + state:
 *   1. Nothing — when the app is already installed, the user has
 *      dismissed the prompt, or we're not on a browser that supports it.
 *   2. On Chromium browsers: an "Install Scopa Score" card. Clicking the
 *      install button fires the captured `beforeinstallprompt` so the
 *      browser shows its native install dialog.
 *   3. On iOS Safari: a manual "tap Share, then Add to Home Screen"
 *      hint. Safari doesn't expose a programmatic install API so we
 *      teach the user the gesture instead.
 *
 * Either path can be dismissed via the X button; dismissal persists via
 * the existing `useOnboardingFlag` infrastructure so the hint doesn't
 * reappear on every launch for users who'd rather not install.
 */
export function InstallPrompt({ tr }: { tr: Tr }) {
  const { canInstall, promptInstall, isInstalled, isIOS } = useInstallPrompt()
  const [dismissed, markDismissed] = useOnboardingFlag('install-prompt')

  if (isInstalled || dismissed) return null

  // iOS Safari: render the manual hint. We don't gate on a separate flag
  // because the same "install-prompt" dismissal applies to both surfaces.
  if (isIOS) {
    return (
      <div
        role="note"
        className="relative rounded-md border border-accent/40 bg-accent/10 text-foreground px-3 py-2.5 pr-10 text-sm"
      >
        <div className="flex items-start gap-2">
          <DeviceMobile size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-0.5">{tr('install.ios.title')}</p>
            <p className="text-muted-foreground text-xs leading-snug">
              {tr('install.ios.body')}
              <span className="inline-flex items-center align-middle mx-1">
                <Export size={14} aria-hidden="true" />
              </span>
              {tr('install.ios.tail')}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={markDismissed}
          aria-label={tr('install.dismiss')}
          className="absolute top-1 right-1 h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
    )
  }

  if (!canInstall) return null

  return (
    <div
      role="note"
      className="relative rounded-md border border-primary/40 bg-primary/5 text-foreground px-3 py-2.5 pr-10"
    >
      <div className="flex items-center gap-3">
        <DeviceMobile size={20} aria-hidden="true" className="shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{tr('install.title')}</p>
          <p className="text-muted-foreground text-xs">{tr('install.body')}</p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            const outcome = await promptInstall()
            // Whether the user accepted or dismissed the browser dialog,
            // the prompt won't fire again this session — mark the hint
            // seen so we don't show a stale-looking CTA next render.
            if (outcome !== 'unavailable') markDismissed()
          }}
          className="shrink-0"
        >
          {tr('install.cta')}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={markDismissed}
        aria-label={tr('install.dismiss')}
        className="absolute top-1 right-1 h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}
