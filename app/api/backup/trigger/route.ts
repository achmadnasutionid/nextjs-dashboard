import { NextResponse } from "next/server"
import { exportDatabaseToJson } from "@/lib/backup-export"
import { getBackupDb, isBackupConfigured, saveBackupKeepLastN } from "@/lib/backup-db"

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const MAX_MB = Math.min(Math.max(1, parseInt(process.env.BACKUP_MAX_RESPONSE_MB || "100", 10) || 100), 500)
const MAX_BACKUP_RESPONSE_BYTES = MAX_MB * 1024 * 1024

/**
 * GET /api/backup/trigger – create backup in backup DB only if last one was > 24h ago.
 * Returns backup payload for client cache when under size cap.
 */
export async function GET() {
  if (!isBackupConfigured()) {
    return NextResponse.json(
      { error: "Backup not configured. Set BACKUP_DATABASE_URL." },
      { status: 503 }
    )
  }
  try {
    const db = getBackupDb()
    const last = await db.backup.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })

    const now = Date.now()
    const lastAt = last ? new Date(last.createdAt).getTime() : 0
    const shouldRun = now - lastAt >= ONE_DAY_MS

    if (!shouldRun) {
      const nextEligibleAt = new Date(lastAt + ONE_DAY_MS).toISOString()
      return NextResponse.json({
        triggered: false,
        nextEligibleAt,
        message: "Backup already run in the last 24h",
      })
    }

    const { summary, data } = await exportDatabaseToJson()
    const backup = await saveBackupKeepLastN(summary, data)

    const backupPayload = { summary, data }
    const json = JSON.stringify(backupPayload)
    const sizeBytes = Buffer.byteLength(json, "utf8")
    const includeInResponse = sizeBytes <= MAX_BACKUP_RESPONSE_BYTES

    const body: Record<string, unknown> = {
      triggered: true,
      id: backup.id,
      createdAt: backup.createdAt,
      summary: backup.summary as Record<string, number>,
      nextEligibleAt: new Date(now + ONE_DAY_MS).toISOString(),
      backupSizeBytes: sizeBytes,
    }
    if (includeInResponse) {
      body.backupData = backupPayload
    } else {
      body.backupTooLargeToCache = true
      body.message = "Backup created in backup DB but too large to send to browser cache."
    }

    return NextResponse.json(body)
  } catch (e) {
    console.error("Backup trigger failed:", e)
    return NextResponse.json({ error: "Backup failed" }, { status: 500 })
  }
}
