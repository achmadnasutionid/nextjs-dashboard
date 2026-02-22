import { prisma } from "@/lib/prisma"

/**
 * Entity types that support unique name validation
 */
export type EntityType = 
  | 'quotation' 
  | 'invoice' 
  | 'paragon' 
  | 'erha' 
  | 'productionTracker'

/**
 * Field names for each entity type
 */
type FieldNameMap = {
  quotation: 'billTo'
  invoice: 'billTo'
  paragon: 'billTo'
  erha: 'billTo'
  productionTracker: 'projectName'
}

/**
 * Generate a unique name by appending incremental suffix (" 02", " 03", etc.) if duplicates exist
 * 
 * @param baseName - The base name to check for uniqueness
 * @param entityType - The type of entity (quotation, invoice, expense, etc.)
 * @param excludeId - Optional ID to exclude from duplicate check (for updates)
 * @returns Promise<string> - The unique name (original or with suffix)
 * 
 * @example
 * // If "Project ABC" exists, returns "Project ABC 02"
 * const uniqueName = await generateUniqueName("Project ABC", "expense")
 * 
 * @example
 * // When updating, exclude current record
 * const uniqueName = await generateUniqueName("Client XYZ", "quotation", currentId)
 */
export async function generateUniqueName(
  baseName: string,
  entityType: EntityType,
  excludeId?: string
): Promise<string> {
  // Return empty/whitespace names as-is
  if (!baseName.trim()) {
    return baseName
  }

  // Map entity types to Prisma model names
  const modelNameMap: Record<EntityType, string> = {
    quotation: 'quotation',
    invoice: 'invoice',
    paragon: 'paragonTicket',
    erha: 'erhaTicket',
    productionTracker: 'productionTracker'
  }

  // Get the field name for this entity type
  const fieldNameMap: FieldNameMap = {
    quotation: 'billTo',
    invoice: 'billTo',
    paragon: 'billTo',
    erha: 'billTo',
    productionTracker: 'projectName'
  }

  const modelName = modelNameMap[entityType]
  const fieldName = fieldNameMap[entityType]

  // Check if base name already exists
  const where: any = {
    [fieldName]: baseName,
    deletedAt: null
  }
  if (excludeId) {
    where.id = { not: excludeId }
  }

  const existingRecord = await (prisma as any)[modelName].findFirst({ where })

  // If no conflict, return original name
  if (!existingRecord) {
    return baseName
  }

  // If conflict exists, find the next available number
  let suffix = 2
  let newName = `${baseName} 0${suffix}`
  
  while (true) {
    const conflictWhere: any = {
      [fieldName]: newName,
      deletedAt: null
    }
    if (excludeId) {
      conflictWhere.id = { not: excludeId }
    }

    const conflict = await (prisma as any)[modelName].findFirst({
      where: conflictWhere
    })

    if (!conflict) {
      return newName
    }

    suffix++
    // Format: " 02", " 03", ..., " 09", " 10", " 11", etc.
    newName = `${baseName} ${suffix < 10 ? '0' : ''}${suffix}`
  }
}

/**
 * Batch check if multiple names have conflicts
 * 
 * @param names - Array of names to check
 * @param entityType - The type of entity
 * @returns Promise<Record<string, boolean>> - Map of name to hasConflict boolean
 */
export async function checkNameConflicts(
  names: string[],
  entityType: EntityType
): Promise<Record<string, boolean>> {
  // Map entity types to Prisma model names
  const modelNameMap: Record<EntityType, string> = {
    quotation: 'quotation',
    invoice: 'invoice',
    paragon: 'paragonTicket',
    erha: 'erhaTicket',
    productionTracker: 'productionTracker'
  }

  const fieldNameMap: FieldNameMap = {
    quotation: 'billTo',
    invoice: 'billTo',
    paragon: 'billTo',
    erha: 'billTo',
    productionTracker: 'projectName'
  }

  const modelName = modelNameMap[entityType]
  const fieldName = fieldNameMap[entityType]
  
  const results: Record<string, boolean> = {}
  
  // Check all names in parallel
  await Promise.all(
    names.map(async (name) => {
      if (!name.trim()) {
        results[name] = false
        return
      }

      const exists = await (prisma as any)[modelName].findFirst({
        where: {
          [fieldName]: name,
          deletedAt: null
        }
      })

      results[name] = !!exists
    })
  )

  return results
}
