import { NextResponse } from "next/server"
import { runJsonDriveSync } from "@/lib/backup-json-drive-sync"
import { getBackupSyncStatus } from "@/lib/backup-sync-status"

/**
 * POST /api/backup/sync-pdf-drive – start JSON backup → Google Drive (async).
 * Uploads one JSON file per quotation/invoice/ticket (no PDF rendering). Returns 202 immediately.
 * Poll GET /api/backup/sync-status for progress. Stops after 3 failures.
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

    runJsonDriveSync()
      .then((result) => {
        if (result.ok) {
          console.log("[sync-drive] JSON backup completed. uploaded:", result.uploaded, "skipped:", result.skipped)
        } else {
          console.error("[sync-drive] JSON backup finished with error:", result.error)
        }
      })
      .catch((e) => {
        console.error("[sync-drive] JSON backup failed:", e)
      })

    return NextResponse.json(
      { ok: true, message: "Backup started. Check progress below." },
      { status: 202 }
    )
  } catch (e) {
    console.error("Backup sync start failed:", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    )
  }
}
