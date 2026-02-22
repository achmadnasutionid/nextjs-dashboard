import { prisma } from "@/lib/prisma"

const BACKUP_MODEL_NAMES = [
  "company",
  "billing",
  "signature",
  "product",
  "productDetail",
  "quotation",
  "quotationItem",
  "quotationItemDetail",
  "quotationRemark",
  "quotationSignature",
  "quotationTemplate",
  "quotationTemplateItem",
  "quotationTemplateItemDetail",
  "invoice",
  "invoiceItem",
  "invoiceItemDetail",
  "invoiceRemark",
  "invoiceSignature",
  "paragonTicket",
  "paragonTicketItem",
  "paragonTicketItemDetail",
  "paragonTicketRemark",
  "erhaTicket",
  "erhaTicketItem",
  "erhaTicketItemDetail",
  "erhaTicketRemark",
  "gearExpense",
  "bigExpense",
  "productionTracker",
] as const

function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  return value
}

export type BackupPayload = {
  summary: Record<string, number>
  data: Record<string, unknown[]>
}

export async function exportDatabaseToJson(): Promise<BackupPayload> {
  const summary: Record<string, number> = {}
  const data: Record<string, unknown[]> = {}

  for (const name of BACKUP_MODEL_NAMES) {
    const model = (prisma as unknown as Record<string, { findMany: (args?: object) => Promise<unknown[]> }>)[name]
    if (!model?.findMany) continue
    try {
      const rows = (await model.findMany({})) as Record<string, unknown>[]
      const normalized = rows.map((r) => {
        const o: Record<string, unknown> = {}
        for (const k of Object.keys(r)) o[k] = serialize(r[k])
        return o
      })
      summary[name] = normalized.length
      data[name] = normalized
    } catch (e) {
      summary[name] = 0
      data[name] = []
    }
  }

  return { summary, data }
}
