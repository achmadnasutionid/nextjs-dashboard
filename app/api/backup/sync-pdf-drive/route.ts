import { NextResponse } from "next/server"
import { runPdfDriveSync } from "@/lib/pdf-drive-sync"
import { getBackupSyncStatus } from "@/lib/backup-sync-status"

/**
 * POST /api/backup/sync-pdf-drive – start PDF → Google Drive sync (async).
 * Returns 202 immediately; sync runs in background. Poll GET /api/backup/sync-status for progress.
 * Stops after 3 failures to avoid burdening the service.
 */
export async function POST() {
  try {
    const status = getBackupSyncStatus()
    if (status.status === "running") {
      return NextResponse.json(
        { ok: false, error: "Backup already in progress. Check progress below." },
        { status: 409 }
      )
    }

    runPdfDriveSync()
      .then((result) => {
        if (result.ok) {
          console.log("[sync-pdf-drive] Completed. uploaded:", result.uploaded, "skipped:", result.skipped)
        } else {
          console.error("[sync-pdf-drive] Finished with error:", result.error)
        }
      })
      .catch((e) => {
        console.error("[sync-pdf-drive] Failed:", e)
      })

    return NextResponse.json(
      { ok: true, message: "Backup started. Check progress below." },
      { status: 202 }
    )
  } catch (e) {
    console.error("PDF Drive sync start failed:", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    )
  }
}
