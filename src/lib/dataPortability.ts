/**
 * Platform-aware file IO for the data backup feature (issue #45).
 *
 * - Export: web build downloads via a Blob URL; native (Capacitor Android)
 *   writes the file to the cache directory and opens the system share sheet
 *   so the user can route it to Drive / email / etc.
 * - Import: both platforms use a hidden `<input type="file">` driven by the
 *   React component — the Capacitor WebView supports it, so we don't need a
 *   second code path. This module just exposes the parse helper.
 */

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { BackupJson } from './db/portability'

/**
 * Filename used for both the web download and the native share. The date is
 * formatted in local time because that's what the user sees on their device —
 * matching the issue's `scopa-backup-YYYY-MM-DD.json` spec.
 */
export function buildBackupFilename(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `scopa-backup-${y}-${m}-${d}.json`
}

/**
 * Trigger the platform-appropriate "save backup" flow.
 *
 * Resolves once the action has been kicked off. On native we await the share
 * sheet — the resolution doesn't mean the user actually saved the file
 * (they may dismiss the sheet), just that the flow ran cleanly.
 */
export async function exportBackup(json: BackupJson): Promise<void> {
  const text = JSON.stringify(json, null, 2)
  const filename = buildBackupFilename()
  if (Capacitor.getPlatform() === 'web') {
    downloadAsFile(text, filename)
    return
  }
  await writeAndShare(text, filename)
}

/**
 * Web path: build a Blob, create a temporary `<a download>`, click it, and
 * revoke the object URL. The anchor is appended to `document.body` because
 * Firefox refuses to trigger downloads on detached anchors.
 */
function downloadAsFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer the revoke a tick so Safari has time to start the download — it
  // sometimes cancels in-flight downloads when the URL is revoked too eagerly.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Native path: write the JSON to the cache directory and open the system
 * share sheet pointed at the file URI. Cache is the right directory because
 * the file is transient — once the user routes it to its final destination
 * (Drive, email, etc.) the OS can reclaim the space.
 */
async function writeAndShare(text: string, filename: string): Promise<void> {
  const writeResult = await Filesystem.writeFile({
    path: filename,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  await Share.share({
    title: 'Scopa backup',
    url: writeResult.uri,
    dialogTitle: 'Save backup',
  })
}

/**
 * Read a backup file from a browser File object and parse it as JSON.
 * Validation (zod) is the caller's job — this function only reports parse
 * errors. Used by both the web and native import paths since `<input
 * type="file">` works in the Capacitor WebView.
 */
export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text()
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(
      `Backup file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}
