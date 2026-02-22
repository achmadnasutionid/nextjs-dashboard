import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Batch API Endpoint
 * 
 * Fetch multiple resources in a single request to reduce HTTP overhead
 * Example: /api/batch?invoices=id1,id2&quotations=id3,id4
 * 
 * This reduces:
 * - Network latency (1 request instead of 4)
 * - Server overhead (1 connection instead of 4)
 * - Database connections (parallel queries in single request)
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse requested resources
    const invoiceIds = searchParams.get("invoices")?.split(",").filter(Boolean) || []
    const quotationIds = searchParams.get("quotations")?.split(",").filter(Boolean) || []
    const trackerIds = searchParams.get("trackers")?.split(",").filter(Boolean) || []
    
    // Limit batch size to prevent abuse (max 20 items per resource type)
    const MAX_BATCH_SIZE = 20
    if (invoiceIds.length > MAX_BATCH_SIZE || quotationIds.length > MAX_BATCH_SIZE || 
        trackerIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeded. Maximum ${MAX_BATCH_SIZE} items per resource type.` },
        { status: 400 }
      )
    }
    
    // Fetch all resources in parallel
    const [invoices, quotations, trackers] = await Promise.all([
      // Invoices
      invoiceIds.length > 0 ? prisma.invoice.findMany({
        where: { 
          id: { in: invoiceIds },
          deletedAt: null 
        },
        select: {
          id: true,
          invoiceId: true,
          companyName: true,
          billTo: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          updatedAt: true,
        }
      }) : [],
      
      // Quotations
      quotationIds.length > 0 ? prisma.quotation.findMany({
        where: { 
          id: { in: quotationIds },
          deletedAt: null 
        },
        select: {
          id: true,
          quotationId: true,
          companyName: true,
          billTo: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          updatedAt: true,
        }
      }) : [],
      
      // Production Trackers
      trackerIds.length > 0 ? prisma.productionTracker.findMany({
        where: { 
          id: { in: trackerIds },
          deletedAt: null 
        },
        select: {
          id: true,
          trackerId: true,
          projectName: true,
          date: true,
          totalAmount: true,
          expense: true,
          status: true,
          updatedAt: true,
        }
      }) : [],
    ])
    
    return NextResponse.json({
      invoices,
      quotations,
      trackers,
      _meta: {
        requestedCounts: {
          invoices: invoiceIds.length,
          quotations: quotationIds.length,
          trackers: trackerIds.length,
        },
        returnedCounts: {
          invoices: invoices.length,
          quotations: quotations.length,
          trackers: trackers.length,
        }
      }
    })
  } catch (error) {
    console.error("Error in batch API:", error)
    return NextResponse.json(
      { error: "Failed to fetch batch data" },
      { status: 500 }
    )
  }
}
