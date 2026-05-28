import { X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

/** Translation helper signature shared across the app. */
type Tr = (key: string, params?: Record<string, string>) => string

type Props = {
  /** Body text already translated by the caller. */
  body: string
  /** Invoked when the user dismisses the tip. */
  onDismiss: () => void
  /** Translation helper used for the dismiss button's aria-label. */
  tr: Tr
}

/**
 * Inline first-run onboarding hint (#51).
 *
 * Renders as a subtle accent-tinted card with body text and a close button.
 * Color tokens come from the existing theme so it works in both light and
 * dark modes without extra rules. The caller is responsible for gating
 * mount via {@link useOnboardingFlag} so the hint disappears the moment
 * the user dismisses it (and stays gone on the next launch).
 */
export function OnboardingTip({ body, onDismiss, tr }: Props) {
  return (
    <div
      className="relative rounded-md border border-accent/40 bg-accent/10 text-foreground px-3 py-2 pr-10 text-sm"
      role="note"
    >
      {body}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        aria-label={tr('onboarding.dismiss')}
        className="absolute top-1 right-1 h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}
