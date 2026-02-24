import { NextResponse } from "next/server"
import { runPdfDriveSync } from "@/lib/pdf-drive-sync"

/**
 * POST /api/backup/sync-pdf-drive – manually run PDF → Google Drive sync.
 * Uploads Quotations, Invoices, Paragon (final), Erha (final) PDFs to Drive. Same file name = replace.
 */
export async function POST() {
  try {
    const result = await runPdfDriveSync()
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "Sync failed",
          uploaded: result.uploaded ?? 0,
          skipped: result.skipped ?? 0,
          skipReason: result.skipReason,
        },
        { status: 400 }
      )
    }
    return NextResponse.json({
      ok: true,
      uploaded: result.uploaded ?? 0,
      skipped: result.skipped ?? 0,
      skipReason: result.skipReason,
    })
  } catch (e) {
    console.error("PDF Drive sync failed:", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    )
  }
}
