import { NextResponse } from "next/server"
import { getBackupSyncStatus } from "@/lib/backup-sync-status"

/**
 * GET /api/backup/sync-status – current backup sync progress (for polling from Backup page).
 */
export async function GET() {
  const status = getBackupSyncStatus()
  return NextResponse.json(status)
}
