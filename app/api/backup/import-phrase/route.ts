import { NextResponse } from "next/server"

const DEFAULT = "RESTORE"

/**
 * GET /api/backup/import-phrase – return the phrase user must type to confirm import (for UI placeholder/validation).
 */
export async function GET() {
  const phrase = (process.env.BACKUP_IMPORT_CONFIRMATION_PHRASE || DEFAULT).trim()
  return NextResponse.json({ phrase })
}
