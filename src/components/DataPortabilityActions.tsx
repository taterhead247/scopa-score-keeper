import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { exportData, importData, zBackup } from '@/lib/db/portability'
import { exportBackup, readBackupFile } from '@/lib/dataPortability'

/** Translation helper signature (same as the one used throughout App.tsx). */
type Tr = (key: string, params?: Record<string, string>) => string

/**
 * Return value from {@link useDataPortability}. `onExport`/`onImport` go on
 * menu items; `element` must be rendered somewhere in the tree so the hidden
 * file input and the confirm dialog stay mounted across menu opens/closes.
 */
export type DataPortabilityHandlers = {
  onExport: () => void
  onImport: () => void
  element: React.ReactNode
}

/**
 * Hook that wires up the data export/import flow.
 *
 * Encapsulates four moving parts: the hidden file input, the confirmation
 * dialog, the validation + import transaction, and the user-facing toasts.
 * App.tsx attaches `onExport`/`onImport` to the dropdown menu items and
 * renders `element` once in each setup/in-game tree so the file input has
 * a stable lifetime.
 */
export function useDataPortability(tr: Tr): DataPortabilityHandlers {
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Parsed backup awaiting user confirmation. Null when no import is pending. */
  const [pending, setPending] = useState<unknown | null>(null)
  const queryClient = useQueryClient()

  /** Build a short error string suitable for a toast body. */
  const errString = (err: unknown) =>
    err instanceof Error ? err.message : String(err)

  /** Snapshot the DB and hand it to the platform-aware download/share flow. */
  const onExport = async () => {
    try {
      const json = await exportData()
      await exportBackup(json)
      toast.success(tr('toast.exportSuccess'))
    } catch (err) {
      toast.error(tr('toast.exportError', { error: errString(err) }))
    }
  }

  /** Open the OS file picker. Result handled in `onFileChange` below. */
  const onImport = () => {
    fileInputRef.current?.click()
  }

  /**
   * File picked: parse JSON, run a zod shape check, then stash for the
   * confirmation dialog. Validation runs before the prompt so we can warn
   * the user upfront if the file isn't a real backup (rather than confirm
   * then fail).
   */
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input value so picking the same file again still fires
    // `onChange`. Without this, retrying after an invalid-file toast is a
    // silent no-op.
    e.target.value = ''
    if (!file) return
    try {
      const parsed = await readBackupFile(file)
      const result = zBackup.safeParse(parsed)
      if (!result.success) {
        toast.error(tr('toast.importInvalid'))
        return
      }
      setPending(result.data)
    } catch {
      toast.error(tr('toast.importInvalid'))
    }
  }

  /** User confirmed the destructive replace; run the import transaction. */
  const onConfirm = async () => {
    const data = pending
    setPending(null)
    if (data === null) return
    try {
      await importData(data)
      // Settings + every query that reads game/profile data have to refetch
      // before the UI re-renders. invalidateQueries() with no key drops the
      // whole cache.
      await queryClient.invalidateQueries()
      toast.success(tr('toast.importSuccess'))
    } catch (err) {
      toast.error(tr('toast.importError', { error: errString(err) }))
    }
  }

  const element = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={onFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <AlertDialog open={pending !== null} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('data.importConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tr('data.importConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('confirm.no')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tr('data.importConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  return { onExport, onImport, element }
}
