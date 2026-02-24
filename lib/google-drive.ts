/**
 * Google Drive API helpers for PDF sync.
 * Upload or update file by name in a folder (same ID = replace).
 *
 * Credentials: set one of
 *   - GOOGLE_APPLICATION_CREDENTIALS = path to service account JSON file
 *   - GOOGLE_SERVICE_ACCOUNT_JSON = stringified JSON of the service account key
 * Root folder: GOOGLE_DRIVE_ROOT_FOLDER_ID = ID of the main folder where Quotations/, Invoices/, etc. live
 *
 * If you get "Method doesn't allow unregistered callers", add an API key from the same GCP project:
 *   - GOOGLE_DRIVE_API_KEY or GOOGLE_API_KEY = API key (Credentials → Create credentials → API key)
 */

import { Readable } from "stream"
import { google, drive_v3 } from "googleapis"

const MIME_PDF = "application/pdf"

/** Drive API scope for full access to files/folders (e.g. shared folder). */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"

/** Required when root folder is on a shared drive (Team Drive). */
const SHARED_DRIVE_PARAMS = { supportsAllDrives: true }

function bufferToStream(buf: Buffer): Readable {
  return Readable.from(buf)
}

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (json) {
    try {
      const key = JSON.parse(json) as object
      return new google.auth.GoogleAuth({
        credentials: key,
        scopes: [DRIVE_SCOPE],
      })
    } catch (e) {
      console.error("[google-drive] Invalid GOOGLE_SERVICE_ACCOUNT_JSON:", e)
      return null
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [DRIVE_SCOPE],
    })
  }
  return null
}

/** Optional API key for projects that require consumer identity (fixes "unregistered callers" error). */
function getApiKeyParams(): { key?: string } {
  const key = process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_API_KEY
  return key ? { key } : {}
}

let drive: drive_v3.Drive | null = null

function getDrive(): drive_v3.Drive | null {
  if (drive) return drive
  const auth = getAuth()
  if (!auth) return null
  drive = google.drive({ version: "v3", auth })
  return drive
}

export function isDriveConfigured(): boolean {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  if (!rootId) return false
  return getDrive() !== null
}

/**
 * Sanitize a string for use in Drive file/folder names (avoid invalid chars).
 */
export function sanitizeName(name: string): string {
  return name.replace(/[/\\?*:"|]/g, "_").replace(/\s+/g, " ").trim() || "unnamed"
}

/**
 * Get or create a child folder by name under parentId. Returns folder ID or null.
 */
export async function getOrCreateFolder(
  parentId: string,
  folderName: string
): Promise<string | null> {
  const d = getDrive()
  if (!d) return null
  const safeName = sanitizeName(folderName)
  const keyParams = getApiKeyParams()
  const res = await d.files.list({
    ...keyParams,
    ...SHARED_DRIVE_PARAMS,
    q: `'${parentId}' in parents and name = '${safeName.replace(/'/g, "''")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  })
  const existing = res.data.files?.[0]
  if (existing?.id) return existing.id
  const create = await d.files.create({
    ...keyParams,
    ...SHARED_DRIVE_PARAMS,
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  })
  return create.data.id ?? null
}

/**
 * Upload or update a file in the given folder. Same name = replace content.
 * parentId: folder ID. fileName: exact file name. buffer: PDF bytes.
 * Returns { ok: true } on success, { ok: false, error } on failure (so caller can show reason).
 */
export async function uploadOrUpdateFile(
  parentId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ ok: true } | { ok: false; error: string }> {
  const d = getDrive()
  if (!d) return { ok: false, error: "Google Drive client not initialized" }
  const safeName = sanitizeName(fileName)
  if (!safeName.endsWith(".pdf")) {
    console.warn("[google-drive] File name should end with .pdf:", fileName)
  }
  const keyParams = getApiKeyParams()
  try {
    const res = await d.files.list({
      ...keyParams,
      ...SHARED_DRIVE_PARAMS,
      q: `'${parentId}' in parents and name = '${safeName.replace(/'/g, "''")}' and trashed = false`,
      fields: "files(id)",
      pageSize: 1,
    })
    const existing = res.data.files?.[0]
    if (existing?.id) {
      await d.files.update({
        ...keyParams,
        ...SHARED_DRIVE_PARAMS,
        fileId: existing.id,
        media: { mimeType: MIME_PDF, body: bufferToStream(buffer) },
      })
      return { ok: true }
    }
    await d.files.create({
      ...keyParams,
      ...SHARED_DRIVE_PARAMS,
      requestBody: {
        name: safeName,
        mimeType: MIME_PDF,
        parents: [parentId],
      },
      media: { mimeType: MIME_PDF, body: bufferToStream(buffer) },
      fields: "id",
    })
    return { ok: true }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error("[google-drive] uploadOrUpdateFile failed:", fileName, e)
    return { ok: false, error: errMsg }
  }
}
