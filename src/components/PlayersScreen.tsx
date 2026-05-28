import { useState } from 'react'
import { Plus, PencilSimple, Trash, Check, X } from '@phosphor-icons/react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  PROFILE_COLORS,
  PROFILE_EMOJIS,
  type PlayerProfile,
  makeProfileId,
  pickDefaultColor,
  pickDefaultEmoji,
} from '@/lib/profiles'
import {
  useInsertProfileMutation,
  useUpdateProfileMutation,
  useDeleteProfileMutation,
} from '@/lib/db/hooks'

/** Props for {@link PlayersScreen}. */
type Props = {
  /** Whether the dialog is open. */
  open: boolean
  /** Called when the dialog requests to open or close. */
  onOpenChange: (open: boolean) => void
  /** Current list of profiles, displayed in the screen. */
  profiles: PlayerProfile[]
  /** Translation helper. */
  tr: (key: string, params?: Record<string, string>) => string
}

/**
 * Local state of the inline create/edit pane.
 *
 * `mode === 'create'` means a new profile is being drafted and `id` is null.
 * `mode === 'edit'` means we're editing an existing profile, identified by `id`.
 */
type EditorState = {
  mode: 'create' | 'edit'
  id: string | null
  name: string
  color: string
  emoji: string
}

/**
 * Dedicated dialog for managing the player-profile roster (CRUD).
 *
 * Renders a list of profiles each with edit/delete buttons, plus an inline
 * editor pane for create-or-edit and a confirmation prompt for deletion.
 * State for the editor and the delete-confirm prompt is reset whenever the
 * dialog closes so reopening starts from a clean slate.
 *
 * Reachable from the in-game dropdown menu and the setup screen.
 */
export function PlayersScreen({ open, onOpenChange, profiles, tr }: Props) {
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const insertProfileMut = useInsertProfileMutation()
  const updateProfileMut = useUpdateProfileMutation()
  const deleteProfileMut = useDeleteProfileMutation()

  /** Open the editor pane in create mode with sensible default color/emoji. */
  const openCreate = () => {
    setEditor({
      mode: 'create',
      id: null,
      name: '',
      color: pickDefaultColor(profiles),
      emoji: pickDefaultEmoji(profiles),
    })
  }

  /** Open the editor pane in edit mode, pre-filled from the given profile. */
  const openEdit = (profile: PlayerProfile) => {
    setEditor({
      mode: 'edit',
      id: profile.id,
      name: profile.name,
      color: profile.color,
      emoji: profile.emoji,
    })
  }

  /** Discard the editor pane without saving. */
  const closeEditor = () => setEditor(null)

  /**
   * Persist the current editor pane via the appropriate mutation.
   *
   * In create mode this inserts a new profile; in edit mode it updates the
   * profile identified by `editor.id`. No-ops if the name is empty.
   */
  const saveEditor = () => {
    if (!editor) return
    const name = editor.name.trim()
    if (!name) return

    if (editor.mode === 'create') {
      const newProfile: PlayerProfile = {
        id: makeProfileId(),
        name,
        color: editor.color,
        emoji: editor.emoji,
        createdAt: Date.now(),
      }
      insertProfileMut.mutate(newProfile)
    } else if (editor.id) {
      updateProfileMut.mutate({ id: editor.id, name, color: editor.color, emoji: editor.emoji })
    }
    setEditor(null)
  }

  /**
   * Delete the profile with the given id.
   *
   * Historical games keep their snapshotted name/color/emoji because the
   * SQLite schema's FK uses `ON DELETE SET NULL` — `game_players.profile_id`
   * becomes NULL but the snapshot fields remain.
   */
  const deleteProfile = (id: string) => {
    deleteProfileMut.mutate(id)
    setConfirmDeleteId(null)
  }

  /**
   * Forward the dialog open/close request, clearing transient UI state on
   * close so a stale editor pane or delete-confirm prompt doesn't resume on
   * reopen.
   */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEditor(null)
      setConfirmDeleteId(null)
    }
    onOpenChange(next)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('players.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {profiles.length === 0 && !editor && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {tr('players.empty')}
              </p>
            )}

            {profiles.map(profile => (
              <Card key={profile.id} className="flex-row items-center gap-3 p-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: profile.color }}
                >
                  {profile.emoji}
                </div>
                <div
                  className="flex-1 min-w-0 font-medium truncate text-profile"
                  style={{ '--profile-color': profile.color } as React.CSSProperties}
                >
                  {profile.name}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(profile)}
                    aria-label={tr('players.edit') + ': ' + profile.name}
                    className="h-11 w-11"
                  >
                    <PencilSimple size={18} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDeleteId(profile.id)}
                    className="text-destructive hover:text-destructive h-11 w-11"
                    aria-label={tr('players.delete') + ': ' + profile.name}
                  >
                    <Trash size={18} aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            ))}

            {editor && (
              <Card className="p-3 space-y-3 border-primary">
                <div>
                  <Label className="text-sm mb-2 block">{tr('players.name')}</Label>
                  <Input
                    autoFocus
                    placeholder={tr('players.namePlaceholder')}
                    value={editor.name}
                    onChange={e => setEditor({ ...editor, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-sm mb-2 block">{tr('players.color')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {PROFILE_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditor({ ...editor, color })}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          editor.color === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
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
                        onClick={() => setEditor({ ...editor, emoji })}
                        className={`w-8 h-8 rounded-md text-lg flex items-center justify-center transition-colors ${
                          editor.emoji === emoji ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-muted'
                        }`}
                        aria-label={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button onClick={saveEditor} disabled={!editor.name.trim()} className="flex-1">
                    <Check size={16} className="mr-1" />
                    {tr('players.save')}
                  </Button>
                  <Button variant="outline" onClick={closeEditor}>
                    <X size={16} />
                  </Button>
                </div>
              </Card>
            )}

            {!editor && (
              <Button onClick={openCreate} variant="outline" className="w-full">
                <Plus size={16} className="mr-1" />
                {tr('players.add')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('players.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tr('players.confirmDeleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('confirm.no')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && deleteProfile(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tr('players.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
