import { NextResponse } from "next/server"
import { exportDatabaseToJson } from "@/lib/backup-export"

/**
 * GET /api/backup/export – export current database to JSON and return as downloadable file.
 */
export async function GET() {
  try {
    const payload = await exportDatabaseToJson()
    const json = JSON.stringify(payload, null, 2)
    const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error("Backup export failed:", e)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
