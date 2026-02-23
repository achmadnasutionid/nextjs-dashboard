import { prisma } from "@/lib/prisma"
import type { BackupPayload } from "@/lib/backup-export"
import { BACKUP_MODEL_NAMES } from "@/lib/backup-export"

/** Delete order: children before parents (reverse of export order) to respect FKs. */
const DELETE_ORDER = [...BACKUP_MODEL_NAMES].reverse()

function parseDate(value: unknown): Date | unknown {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return value
}

function parseRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = parseDate(v)
  }
  return out
}

/**
 * Replace main database with backup payload. Deletes all data in reverse FK order, then creates from payload.
 * Run inside a transaction by the caller if desired.
 */
export async function importFromPayload(payload: BackupPayload): Promise<void> {
  const { data } = payload
  if (!data || typeof data !== "object") throw new Error("Invalid backup: missing data")

  const prismaAny = prisma as unknown as Record<
    string,
    { deleteMany: (args?: object) => Promise<{ count: number }>; createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }> }
  >

  for (const name of DELETE_ORDER) {
    const model = prismaAny[name]
    if (!model?.deleteMany) continue
    await model.deleteMany({})
  }

  for (const name of BACKUP_MODEL_NAMES) {
    const model = prismaAny[name]
    const rows = data[name]
    if (!model?.createMany || !Array.isArray(rows) || rows.length === 0) continue
    const parsed = rows.map((r) => parseRow(r as Record<string, unknown>))
    await model.createMany({ data: parsed as object[], skipDuplicates: false })
  }
}
