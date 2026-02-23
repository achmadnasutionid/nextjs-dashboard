import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBackupDb, isBackupConfigured } from "@/lib/backup-db"
import { importFromPayload } from "@/lib/backup-import"
import type { BackupPayload } from "@/lib/backup-export"

const DEFAULT_CONFIRMATION_PHRASE = "RESTORE"

function getRequiredPhrase(): string {
  return (process.env.BACKUP_IMPORT_CONFIRMATION_PHRASE || DEFAULT_CONFIRMATION_PHRASE).trim()
}

/**
 * POST /api/backup/restore – restore main DB from a saved backup in the backup DB. Requires confirmation phrase.
 * Body: JSON { backupId: string, confirmation: string }
 */
export async function POST(request: Request) {
  if (!isBackupConfigured()) {
    return NextResponse.json(
      { error: "Backup not configured. Set BACKUP_DATABASE_URL." },
      { status: 503 }
    )
  }
  try {
    const body = (await request.json()) as { backupId?: string; confirmation?: string }
    const backupId = body.backupId?.trim()
    const confirmation = (body.confirmation ?? "").trim()
    if (!backupId) {
      return NextResponse.json({ error: "Missing backupId" }, { status: 400 })
    }
    const required = getRequiredPhrase()
    if (confirmation !== required) {
      return NextResponse.json(
        { error: `Restore requires typing the exact confirmation phrase. Type: ${required}` },
        { status: 400 }
      )
    }
    const db = getBackupDb()
    const row = await db.backup.findUnique({
      where: { id: backupId },
      select: { summary: true, data: true },
    })
    if (!row) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 })
    }
    const payload: BackupPayload = {
      summary: row.summary as Record<string, number>,
      data: row.data as Record<string, unknown[]>,
    }
    await prisma.$transaction(async () => {
      await importFromPayload(payload)
    })
    return NextResponse.json({ ok: true, message: "Restore completed" })
  } catch (e) {
    console.error("Backup restore failed:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Restore failed" },
      { status: 500 }
    )
  }
}
