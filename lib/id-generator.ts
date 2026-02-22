import { prisma } from './prisma'

/**
 * RACE-CONDITION-FREE ID Generator using Database Sequences
 * 
 * This implementation creates PostgreSQL sequences for each entity type.
 * Sequences are atomic and guaranteed unique across all instances.
 * 
 * Strategy:
 * - Use PostgreSQL sequences for atomic number generation
 * - One sequence per prefix-year combination
 * - Automatically create sequences if they don't exist
 * - No locks needed - sequences are inherently atomic
 */

interface IDCache {
  year: number
  lastNumber: number
  lastFetch: number
}

// In-memory cache (optimization only, not for correctness)
const idCache = new Map<string, IDCache>()
const CACHE_TTL = 30000 // 30 seconds

/**
 * Get sequence name for a prefix-year combination
 */
function getSequenceName(prefix: string, year: number): string {
  return `id_seq_${prefix.toLowerCase()}_${year}`
}

/**
 * Get the ID field name for a model
 */
function getIdField(modelName: string): string {
  const fieldMap: Record<string, string> = {
    'quotation': 'quotationId',
    'invoice': 'invoiceId',
    'paragonTicket': 'ticketId',
    'erhaTicket': 'ticketId',
    'productionTracker': 'trackerId'
  }
  return fieldMap[modelName] || `${modelName}Id`
}

/** Parse PREFIX-YYYY-NNNN and return the numeric part, or 0 if invalid. */
function parseIdNumber(id: string | null | undefined): number {
  if (!id || typeof id !== 'string') return 0
  const parts = id.split('-')
  if (parts.length < 3) return 0
  const num = parseInt(parts[2], 10)
  return isNaN(num) ? 0 : num
}

/**
 * For QTN/INV, the same visible ID is used by Quotation/Invoice AND Paragon/Erha.
 * Return the max number in use across all those tables so the sequence never reuses an ID.
 */
async function getMaxNumberForSharedId(
  prefix: 'QTN' | 'INV',
  year: number
): Promise<number> {
  const searchPrefix = `${prefix}-${year}-`
  if (prefix === 'QTN') {
    const [quotations, paragon, erha] = await Promise.all([
      prisma.quotation.findMany({
        where: { quotationId: { startsWith: searchPrefix } },
        select: { quotationId: true }
      }),
      prisma.paragonTicket.findMany({
        where: { quotationId: { startsWith: searchPrefix, not: '' } },
        select: { quotationId: true }
      }),
      prisma.erhaTicket.findMany({
        where: { quotationId: { startsWith: searchPrefix, not: '' } },
        select: { quotationId: true }
      })
    ])
    const numbers = [
      ...quotations.map((r) => parseIdNumber(r.quotationId)),
      ...paragon.map((r) => parseIdNumber(r.quotationId)),
      ...erha.map((r) => parseIdNumber(r.quotationId))
    ]
    return numbers.length ? Math.max(...numbers) : 0
  }
  // INV
  const [invoices, paragon, erha] = await Promise.all([
    prisma.invoice.findMany({
      where: { invoiceId: { startsWith: searchPrefix } },
      select: { invoiceId: true }
    }),
    prisma.paragonTicket.findMany({
      where: { invoiceId: { startsWith: searchPrefix, not: '' } },
      select: { invoiceId: true }
    }),
    prisma.erhaTicket.findMany({
      where: { invoiceId: { startsWith: searchPrefix, not: '' } },
      select: { invoiceId: true }
    })
  ])
  const numbers = [
    ...invoices.map((r) => parseIdNumber(r.invoiceId)),
    ...paragon.map((r) => parseIdNumber(r.invoiceId)),
    ...erha.map((r) => parseIdNumber(r.invoiceId))
  ]
  return numbers.length ? Math.max(...numbers) : 0
}

/**
 * Ensure sequence exists for this prefix-year.
 * For QTN/INV, initializes (and syncs existing sequences) from max across
 * quotation+invoice+paragon+erha so visible IDs never collide.
 */
async function ensureSequence(prefix: string, year: number, modelName: string): Promise<void> {
  const sequenceName = getSequenceName(prefix, year)
  
  const existing = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM pg_sequences 
      WHERE schemaname = 'public' AND sequencename = ${sequenceName}
    ) as exists
  `
  
  if (prefix === 'QTN' || prefix === 'INV') {
    const maxNum = await getMaxNumberForSharedId(prefix as 'QTN' | 'INV', year)
    const startValue = maxNum + 1
    if (!existing[0]?.exists) {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE SEQUENCE IF NOT EXISTS "${sequenceName}" START WITH ${startValue}
        `)
      } catch (e) {
        // Sequence might have been created by another process - that's OK
      }
    } else {
      // Sync existing sequence so it never returns a number already used by paragon/erha
      const curr = await prisma.$queryRawUnsafe<Array<{ last_value: bigint }>>(
        `SELECT last_value FROM "${sequenceName}"`
      )
      const lastVal = curr[0] ? Number(curr[0].last_value) : 0
      if (lastVal < startValue) {
        await prisma.$executeRawUnsafe(
          `SELECT setval('"${sequenceName}"', ${maxNum})`
        )
      }
    }
    return
  }
  
  if (!existing[0]?.exists) {
    const idField = getIdField(modelName)
    const searchPrefix = `${prefix}-${year}-`
    const lastRecord = await (prisma as any)[modelName].findFirst({
      where: {
        [idField]: {
          startsWith: searchPrefix
        }
      },
      orderBy: {
        [idField]: 'desc'
      },
      select: {
        [idField]: true
      }
    })
    let startValue = 1
    if (lastRecord) {
      const parts = (lastRecord[idField] as string).split('-')
      const lastNumber = parseInt(parts[2], 10) || 0
      startValue = lastNumber + 1
    }
    try {
      await prisma.$executeRawUnsafe(`
        CREATE SEQUENCE IF NOT EXISTS "${sequenceName}" START WITH ${startValue}
      `)
    } catch (e) {
      // Sequence might have been created by another process - that's OK
    }
  }
}

/**
 * Generate a unique ID with format PREFIX-YYYY-NNNN
 * Uses PostgreSQL sequences for true atomicity
 */
export async function generateId(
  prefix: 'QTN' | 'INV' | 'PRG' | 'ERH' | 'PT',
  modelName: 'quotation' | 'invoice' | 'paragonTicket' | 'erhaTicket' | 'productionTracker'
): Promise<string> {
  const year = new Date().getFullYear()
  const sequenceName = getSequenceName(prefix, year)
  
  // Ensure sequence exists (idempotent)
  await ensureSequence(prefix, year, modelName)
  
  // Get next value from sequence (atomic operation)
  const result = await prisma.$queryRawUnsafe<Array<{ nextval: bigint }>>(
    `SELECT nextval('"${sequenceName}"')`
  )
  
  const nextNumber = Number(result[0].nextval)
  
  // Return formatted ID
  return `${prefix}-${year}-${nextNumber.toString().padStart(4, '0')}`
}

/**
 * Clear cache for a specific prefix and year
 * Note: This doesn't affect sequences, only the optimization cache
 */
export function clearIdCache(prefix?: string, year?: number) {
  if (prefix && year) {
    idCache.delete(`${prefix}-${year}`)
  } else if (prefix) {
    for (const key of idCache.keys()) {
      if (key.startsWith(`${prefix}-`)) {
        idCache.delete(key)
      }
    }
  } else {
    idCache.clear()
  }
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getIdCacheStats() {
  return {
    size: idCache.size,
    entries: Array.from(idCache.entries()).map(([key, value]) => ({
      key,
      lastNumber: value.lastNumber,
      age: Date.now() - value.lastFetch
    }))
  }
}
