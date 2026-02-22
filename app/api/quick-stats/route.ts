import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cache, cacheKeys } from "@/lib/redis"

/**
 * Quick Stats API - Lightweight endpoint for dashboard cards
 * 
 * Returns only essential counts/sums without fetching full records
 * Lightweight counts for dashboard (quotation, invoice, expense).
 * Performance: ~50-100ms.
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get("year")
    const currentYear = new Date().getFullYear()
    const selectedYear = yearParam ? parseInt(yearParam) : currentYear
    
    // Build date range
    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear + 1, 0, 1)
    
    // Cache key
    const cacheKey = `quick-stats:${selectedYear}`
    
    // Try cache first
    const cached = await cache.get(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, fromCache: true })
    }
    
    // Use aggregate queries for maximum performance
    const [
      invoiceStats,
      quotationStats,
      pendingInvoicesCount,
      pendingQuotationsCount,
    ] = await Promise.all([
      // Invoice aggregations
      prisma.invoice.groupBy({
        by: ['status'],
        where: {
          deletedAt: null,
          productionDate: { gte: yearStart, lt: yearEnd }
        },
        _sum: { totalAmount: true },
        _count: { id: true }
      }),
      
      // Quotation aggregations
      prisma.quotation.groupBy({
        by: ['status'],
        where: {
          deletedAt: null,
          productionDate: { gte: yearStart, lt: yearEnd }
        },
        _sum: { totalAmount: true },
        _count: { id: true }
      }),
      
      // Action items - pending invoices count
      prisma.invoice.count({
        where: {
          deletedAt: null,
          status: 'pending'
        }
      }),
      
      // Action items - pending quotations count
      prisma.quotation.count({
        where: {
          deletedAt: null,
          status: 'pending'
        }
      }),
      
    ])
    
    // Transform grouped results into simple stats
    const invoiceMap = new Map(invoiceStats.map(s => [s.status, s]))
    const quotationMap = new Map(quotationStats.map(s => [s.status, s]))
    
    const response = {
      invoices: {
        draft: invoiceMap.get('draft')?._count?.id || 0,
        pending: {
          count: invoiceMap.get('pending')?._count?.id || 0,
          total: invoiceMap.get('pending')?._sum?.totalAmount || 0
        },
        paid: {
          count: invoiceMap.get('paid')?._count?.id || 0,
          total: invoiceMap.get('paid')?._sum?.totalAmount || 0
        },
        total: invoiceStats.reduce((sum, s) => 
          sum + (s.status !== 'draft' ? (s._sum?.totalAmount || 0) : 0), 0
        )
      },
      quotations: {
        draft: quotationMap.get('draft')?._count?.id || 0,
        pending: {
          count: quotationMap.get('pending')?._count?.id || 0,
          total: quotationMap.get('pending')?._sum?.totalAmount || 0
        },
        accepted: {
          count: quotationMap.get('accepted')?._count?.id || 0,
          total: quotationMap.get('accepted')?._sum?.totalAmount || 0
        },
        total: quotationStats.reduce((sum, s) => 
          sum + (s.status !== 'draft' ? (s._sum?.totalAmount || 0) : 0), 0
        )
      },
      actionItems: {
        pendingInvoices: pendingInvoicesCount,
        pendingQuotations: pendingQuotationsCount,
      },
      year: selectedYear,
      timestamp: new Date().toISOString(),
      fromCache: false
    }
    
    // Cache for 3 minutes
    await cache.set(cacheKey, response, 180)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching quick stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch quick statistics" },
      { status: 500 }
    )
  }
}
