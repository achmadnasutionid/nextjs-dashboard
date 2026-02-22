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

/**
 * Ensure sequence exists for this prefix-year
 */
async function ensureSequence(prefix: string, year: number, modelName: string): Promise<void> {
  const sequenceName = getSequenceName(prefix, year)
  
  // Check if sequence exists
  const existing = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM pg_sequences 
      WHERE schemaname = 'public' AND sequencename = ${sequenceName}
    ) as exists
  `
  
  if (!existing[0]?.exists) {
    // Find the current max number from database
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
      const parts = lastRecord[idField].split('-')
      const lastNumber = parseInt(parts[2]) || 0
      startValue = lastNumber + 1
    }
    
    // Create sequence starting from the next number
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
