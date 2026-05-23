import { useState } from 'react'
import { Plus, UserCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  PROFILE_COLORS,
  PROFILE_EMOJIS,
  type PlayerProfile,
  makeProfileId,
  pickDefaultColor,
  pickDefaultEmoji,
} from '@/lib/profiles'

/** Props for {@link ProfilePicker}. */
type Props = {
  /** Whether the picker dialog is open. */
  open: boolean
  /** Called when the dialog requests to open or close. */
  onOpenChange: (open: boolean) => void
  /** All profiles available to pick from. */
  profiles: PlayerProfile[]
  /** Setter for the profiles list, used when inline-creating a new profile. */
  setProfiles: React.Dispatch<React.SetStateAction<PlayerProfile[]>>
  /** Ids already assigned to other seats; shown disabled in the list. */
  takenIds: Set<string>
  /** Called with the chosen profile's id once a selection is made. */
  onPick: (profileId: string) => void
  /** Translation helper. */
  tr: (key: string, params?: Record<string, string>) => string
}

/** Local state for the inline "create new player" pane inside the picker. */
type CreateState = {
  name: string
  color: string
  emoji: string
}

/**
 * Per-seat profile picker.
 *
 * Renders a dialog listing every profile so the user can assign one to the
 * current seat. Profiles already taken by other seats are shown disabled.
 * Also offers an inline "New player" pane so the user can create and assign
 * a profile in one flow without leaving the setup screen.
 */
export function ProfilePicker({
  open,
  onOpenChange,
  profiles,
  setProfiles,
  takenIds,
  onPick,
  tr,
}: Props) {
  const [creating, setCreating] = useState<CreateState | null>(null)

  /** Switch the dialog into "create new player" mode with sensible defaults. */
  const startCreate = () => {
    setCreating({
      name: '',
      color: pickDefaultColor(profiles),
      emoji: pickDefaultEmoji(profiles),
    })
  }

  /** Discard the inline create pane and return to the picker list. */
  const cancelCreate = () => setCreating(null)

  /**
   * Persist the newly drafted profile and immediately assign it to the seat
   * that opened the picker. No-ops if the name is empty.
   */
  const saveCreate = () => {
    if (!creating) return
    const name = creating.name.trim()
    if (!name) return
    const newProfile: PlayerProfile = {
      id: makeProfileId(),
      name,
      color: creating.color,
      emoji: creating.emoji,
      createdAt: Date.now(),
    }
    setProfiles(prev => [...prev, newProfile])
    setCreating(null)
    onPick(newProfile.id)
  }

  /**
   * Forward the open/close request, dismissing any in-progress create pane on
   * close so reopening starts on the picker list rather than mid-create.
   */
  const handleOpenChange = (next: boolean) => {
    if (!next) setCreating(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {creating ? tr('picker.createTitle') : tr('picker.title')}
          </DialogTitle>
        </DialogHeader>

        {!creating && (
          <div className="space-y-2 mt-2">
            {profiles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">
                {tr('picker.empty')}
              </p>
            )}

            {profiles.map(profile => {
              const isTaken = takenIds.has(profile.id)
              return (
                <button
                  key={profile.id}
                  disabled={isTaken}
                  onClick={() => onPick(profile.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-md border transition-colors text-left ${
                    isTaken
                      ? 'opacity-50 cursor-not-allowed border-border'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: profile.color }}
                  >
                    {profile.emoji}
                  </div>
                  <span className="flex-1 font-medium truncate" style={{ color: profile.color }}>
                    {profile.name}
                  </span>
                  {isTaken && (
                    <span className="text-xs text-muted-foreground">
                      {tr('picker.taken')}
                    </span>
                  )}
                </button>
              )
            })}

            <Button onClick={startCreate} variant="outline" className="w-full mt-2">
              <Plus size={16} className="mr-1" />
              {tr('picker.createNew')}
            </Button>
          </div>
        )}

        {creating && (
          <Card className="p-3 space-y-3 mt-2 border-primary">
            <div>
              <Label className="text-sm mb-2 block">{tr('players.name')}</Label>
              <Input
                autoFocus
                placeholder={tr('players.namePlaceholder')}
                value={creating.name}
                onChange={e => setCreating({ ...creating, name: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-sm mb-2 block">{tr('players.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {PROFILE_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCreating({ ...creating, color })}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      creating.color === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">{tr('players.emoji')}</Label>
              <div className="grid grid-cols-10 gap-1">
                {PROFILE_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCreating({ ...creating, emoji })}
                    className={`w-8 h-8 rounded-md text-lg flex items-center justify-center transition-colors ${
                      creating.emoji === emoji ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-muted'
                    }`}
                    aria-label={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={saveCreate} disabled={!creating.name.trim()} className="flex-1">
                {tr('picker.createAndSelect')}
              </Button>
              <Button variant="outline" onClick={cancelCreate}>
                {tr('rename.cancel')}
              </Button>
            </div>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * A single seat button shown on the setup screen.
 *
 * When `profile` is null the button renders an empty-seat affordance with a
 * dashed border prompting the user to pick a player. When a profile is
 * assigned it renders the profile's emoji and name tinted with its color.
 * Clicking either form opens the {@link ProfilePicker} for that seat.
 */
export function ProfileSeatButton({
  profile,
  seatIndex,
  onClick,
  tr,
}: {
  /** The profile assigned to this seat, or null for an empty seat. */
  profile: PlayerProfile | null
  /** Zero-based seat index, used in the empty-seat label "Select Player N". */
  seatIndex: number
  /** Called when the button is clicked, typically to open the picker. */
  onClick: () => void
  /** Translation helper. */
  tr: (key: string, params?: Record<string, string>) => string
}) {
  if (!profile) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 rounded-md border-2 border-dashed border-border hover:border-primary hover:bg-muted/50 transition-colors text-left"
      >
        <UserCircle size={32} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">
          {tr('setup.selectSeat', { n: String(seatIndex + 1) })}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-md border-2 hover:bg-muted/30 transition-colors text-left"
      style={{ borderColor: profile.color }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: profile.color }}
      >
        {profile.emoji}
      </div>
      <span className="flex-1 font-medium truncate" style={{ color: profile.color }}>
        {profile.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {tr('setup.change')}
      </span>
    </button>
  )
}
