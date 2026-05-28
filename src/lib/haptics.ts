/**
 * Thin wrapper around `@capacitor/haptics` (#49).
 *
 * On native (Android) this calls into the platform haptic engine and the
 * user feels a vibration. On web, the underlying plugin is a no-op — but
 * we additionally short-circuit at this layer so the `import()` cost is
 * minimal and the gate stays explicit. A user setting (haptics_enabled)
 * can disable the whole layer regardless of platform.
 *
 * The helpers all silently swallow errors. A haptic that fails (e.g.
 * because the device lacks a vibration motor) should never break the UI
 * flow it accompanies.
 */

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** Read once at module load — runtime platform doesn't change. */
const IS_NATIVE = Capacitor.isNativePlatform()

/**
 * Whether haptics should fire. Toggled by the in-app setting. Defaults to
 * true on first launch — the PRD explicitly asks for tactile feedback as
 * a baseline experience quality. We hold this as module-level state because
 * the haptic call sites are scattered and don't all have hook access.
 */
let enabled = true

/** Apply the persisted user preference (called once on app boot). */
export function setHapticsEnabled(value: boolean): void {
  enabled = value
}

/** Whether haptics are currently active. Used by UI to render the toggle. */
export function areHapticsEnabled(): boolean {
  return enabled
}

/** Light tap — pill toggles, +/- adjustments, dismissable feedback. */
export async function hapticLight(): Promise<void> {
  if (!IS_NATIVE || !enabled) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Device lacks haptic hardware or permissions — swallow silently.
  }
}

/** Medium thump — bank hand, undo, other "commit" actions. */
export async function hapticMedium(): Promise<void> {
  if (!IS_NATIVE || !enabled) return
  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    // ignore
  }
}

/** Success notification — winner overlay opens. */
export async function hapticSuccess(): Promise<void> {
  if (!IS_NATIVE || !enabled) return
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    // ignore
  }
}

/** Warning notification — tie overlay opens. */
export async function hapticWarning(): Promise<void> {
  if (!IS_NATIVE || !enabled) return
  try {
    await Haptics.notification({ type: NotificationType.Warning })
  } catch {
    // ignore
  }
}
