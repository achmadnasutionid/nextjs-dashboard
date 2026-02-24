import { NextResponse } from "next/server"
import { isDriveConfigured } from "@/lib/google-drive"

const DRIVE_FOLDER_URL_PREFIX = "https://drive.google.com/drive/folders/"

/**
 * GET /api/backup/drive-status – whether Google Drive is configured and the root folder URL.
 */
export async function GET() {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  const configured = !!(rootId && isDriveConfigured())
  const rootFolderUrl = rootId ? `${DRIVE_FOLDER_URL_PREFIX}${rootId}` : undefined
  return NextResponse.json({ configured, rootFolderUrl })
}
