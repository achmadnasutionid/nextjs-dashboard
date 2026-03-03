import { cache, cacheKeys } from './redis'

/**
 * Cache Invalidation Utilities
 * 
 * Centralized cache invalidation to ensure dashboard and lists show fresh data
 * after any mutation (create, update, delete, restore)
 */

/**
 * Invalidate dashboard stats cache
 * Call this after ANY change to invoices, quotations, or gear/big expenses
 * Clears cache for all years since we don't know which year was affected
 */
export async function invalidateDashboardCache(): Promise<void> {
  // Clear all year-based dashboard caches using wildcard
  await cache.delete('dashboard:stats:*')
}

/**
 * Invalidate all invoice-related caches
 * Call after: create, update, delete, restore invoice
 */
export async function invalidateInvoiceCaches(invoiceId?: string): Promise<void> {
  const promises = [
    cache.delete(cacheKeys.dashboardStats()),
    cache.delete('quick-stats:*'), // Quick stats cache (year-based)
    cache.delete('invoice:list:*'), // All invoice list caches (all statuses, all pages)
    cache.delete('calendar:*'), // Calendar events cache
  ]
  
  if (invoiceId) {
    promises.push(cache.delete(cacheKeys.invoice(invoiceId)))
  }
  
  await Promise.all(promises)
}

/**
 * Invalidate all quotation-related caches
 * Call after: create, update, delete, restore, copy quotation
 */
export async function invalidateQuotationCaches(quotationId?: string): Promise<void> {
  const promises = [
    cache.delete(cacheKeys.dashboardStats()),
    cache.delete('quick-stats:*'), // Quick stats cache (year-based)
    cache.delete('quotation:list:*'), // All quotation list caches
    cache.delete('calendar:*'), // Calendar events cache
  ]
  
  if (quotationId) {
    promises.push(cache.delete(cacheKeys.quotation(quotationId)))
  }
  
  await Promise.all(promises)
}

/**
 * Invalidate Paragon ticket caches
 * Call after: create, update, delete, finalize, copy Paragon ticket
 */
export async function invalidateParagonCaches(ticketId?: string): Promise<void> {
  const promises = [
    cache.delete(cacheKeys.dashboardStats()),
    cache.delete('paragon:list:*'), // All Paragon list caches
    cache.delete('calendar:*'), // Calendar events cache
  ]
  
  if (ticketId) {
    promises.push(cache.delete(`paragon:${ticketId}`))
  }
  
  await Promise.all(promises)
}

/**
 * Invalidate Erha ticket caches
 * Call after: create, update, delete, finalize, copy Erha ticket
 */
export async function invalidateErhaCaches(ticketId?: string): Promise<void> {
  const promises = [
    cache.delete(cacheKeys.dashboardStats()),
    cache.delete('erha:list:*'), // All Erha list caches
    cache.delete('calendar:*'), // Calendar events cache
  ]
  
  if (ticketId) {
    promises.push(cache.delete(`erha:${ticketId}`))
  }
  
  await Promise.all(promises)
}

/**
 * Invalidate production tracker caches
 * Call after: create, update, delete production tracker
 */
export async function invalidateProductionTrackerCaches(trackerId?: string): Promise<void> {
  const promises = [
    cache.delete('tracker:list:*'), // All tracker list caches
  ]
  
  if (trackerId) {
    promises.push(cache.delete(cacheKeys.tracker(trackerId)))
  }
  
  await Promise.all(promises)
}

/**
 * Invalidate master data caches (companies, products, billings, signatures)
 * Call after: create, update, delete master data
 * Note: Master data is cached at middleware level (5 min), but we clear here too
 */
export async function invalidateMasterDataCaches(): Promise<void> {
  await Promise.all([
    cache.delete('company:*'),
    cache.delete('product:*'),
    cache.delete('billing:*'),
    cache.delete('signature:*'),
    cache.delete('template:*'),
  ])
}

/**
 * Invalidate calendar events cache
 * Call after: any change to quotations, invoices, or special tickets
 */
export async function invalidateCalendarCache(): Promise<void> {
  await cache.delete('calendar:*')
}

/**
 * Nuclear option: clear ALL caches
 * Use sparingly - only for major data migrations or testing
 */
export async function invalidateAllCaches(): Promise<void> {
  await cache.flush()
}
