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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  profiles: PlayerProfile[]
  setProfiles: React.Dispatch<React.SetStateAction<PlayerProfile[]>>
  tr: (key: string, params?: Record<string, string>) => string
}

type EditorState = {
  mode: 'create' | 'edit'
  id: string | null
  name: string
  color: string
  emoji: string
}

export function PlayersScreen({ open, onOpenChange, profiles, setProfiles, tr }: Props) {
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const openCreate = () => {
    setEditor({
      mode: 'create',
      id: null,
      name: '',
      color: pickDefaultColor(profiles),
      emoji: pickDefaultEmoji(profiles),
    })
  }

  const openEdit = (profile: PlayerProfile) => {
    setEditor({
      mode: 'edit',
      id: profile.id,
      name: profile.name,
      color: profile.color,
      emoji: profile.emoji,
    })
  }

  const closeEditor = () => setEditor(null)

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
      setProfiles(prev => [...prev, newProfile])
    } else if (editor.id) {
      setProfiles(prev => prev.map(p =>
        p.id === editor.id ? { ...p, name, color: editor.color, emoji: editor.emoji } : p
      ))
    }
    setEditor(null)
  }

  const deleteProfile = (id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

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
              <Card key={profile.id} className="p-3 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: profile.color }}
                >
                  {profile.emoji}
                </div>
                <div className="flex-1 font-medium truncate" style={{ color: profile.color }}>
                  {profile.name}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(profile)} aria-label={tr('players.edit')}>
                  <PencilSimple size={18} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDeleteId(profile.id)}
                  className="text-destructive hover:text-destructive"
                  aria-label={tr('players.delete')}
                >
                  <Trash size={18} />
                </Button>
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
