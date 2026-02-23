import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { BackupPayload } from "@/lib/backup-export"
import { importFromPayload } from "@/lib/backup-import"

const DEFAULT_CONFIRMATION_PHRASE = "RESTORE"

function getRequiredPhrase(): string {
  return (process.env.BACKUP_IMPORT_CONFIRMATION_PHRASE || DEFAULT_CONFIRMATION_PHRASE).trim()
}

/**
 * POST /api/backup/import – replace database with uploaded backup. Requires confirmation phrase in body.
 * Body: JSON { confirmation: "RESTORE", backup: { summary, data } } or FormData with "file" (JSON) + "confirmation".
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || ""
    let backup: BackupPayload
    let confirmation: string

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      confirmation = (formData.get("confirmation") as string) || ""
      if (!file) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 })
      }
      const text = await file.text()
      backup = JSON.parse(text) as BackupPayload
    } else {
      const body = await request.json() as { confirmation?: string; backup?: BackupPayload }
      confirmation = (body.confirmation ?? "").trim()
      backup = body.backup as BackupPayload
      if (!backup?.summary || !backup?.data) {
        return NextResponse.json({ error: "Invalid body: need confirmation and backup" }, { status: 400 })
      }
    }

    const required = getRequiredPhrase()
    if (confirmation !== required) {
      return NextResponse.json(
        { error: `Import requires typing the exact confirmation phrase. Type: ${required}` },
        { status: 400 }
      )
    }

    await prisma.$transaction(async () => {
      await importFromPayload(backup)
    })

    return NextResponse.json({ ok: true, message: "Import completed" })
  } catch (e) {
    console.error("Backup import failed:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    )
  }
}
