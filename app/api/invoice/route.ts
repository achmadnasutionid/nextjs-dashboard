import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateId } from "@/lib/id-generator"
import { invalidateInvoiceCaches } from "@/lib/cache-invalidation"
import { cache, cacheKeys } from "@/lib/redis"
import { generateUniqueName } from "@/lib/name-validator"
import { syncTracker } from "@/lib/tracker-sync"

// GET all invoices (optimized with pagination + Redis caching)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const sortBy = searchParams.get("sortBy") || "newest"
    const includeDeleted = searchParams.get("includeDeleted") === "true"
    const search = searchParams.get("search") || ""
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Build cache key (only cache non-search queries to avoid cache pollution)
    const shouldCache = !search && !includeDeleted
    const cacheKey = shouldCache 
      ? `${cacheKeys.invoiceList(status || 'all', page)}:${sortBy}:${limit}`
      : null

    // Try to get from cache first
    if (cacheKey) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({ ...cached, fromCache: true })
      }
    }

    // Build where clause
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }
    if (!includeDeleted) {
      where.deletedAt = null
    }
    
    // Add search filter (if provided)
    if (search) {
      where.OR = [
        { invoiceId: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { billTo: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Fetch data with pagination - optimized for list view
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceId: true,
          companyName: true,
          billTo: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          // Only fetch item summaries, not full details
          items: {
            select: {
              productName: true,
              total: true
            }
          }
          // Don't fetch remarks in list view
        },
        orderBy: {
          updatedAt: sortBy === "oldest" ? "asc" : "desc"
        },
        take: limit,
        skip: skip
      }),
      prisma.invoice.count({ where })
    ])

    const response = {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      fromCache: false
    }

    // Cache for 2 minutes (common list queries)
    if (cacheKey) {
      await cache.set(cacheKey, response, 120)
    }

    // Return paginated response
    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

// POST create new invoice
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate unique invoice ID (optimized with cache)
    const invoiceId = await generateId('INV', 'invoice')

    // For drafts, provide defaults for required fields if not provided
    const isDraft = body.status === "draft"

    // Generate unique billTo name if there's a conflict
    const billToValue = body.billTo || (isDraft ? "" : body.billTo)
    const uniqueBillTo = billToValue ? await generateUniqueName(billToValue, 'invoice') : billToValue

    // Calculate paidDate: productionDate + 7 days (if productionDate is provided)
    let paidDate = null
    if (body.productionDate) {
      paidDate = new Date(body.productionDate)
      paidDate.setDate(paidDate.getDate() + 7)
    }
    // If paidDate is explicitly provided in body, use that instead
    if (body.paidDate) {
      paidDate = new Date(body.paidDate)
    }

    // Create invoice with items and details
    const invoice = await prisma.invoice.create({
      data: {
        invoiceId,
        companyName: body.companyName || (isDraft ? "" : body.companyName),
        companyAddress: body.companyAddress || (isDraft ? "" : body.companyAddress),
        companyCity: body.companyCity || (isDraft ? "" : body.companyCity),
        companyProvince: body.companyProvince || (isDraft ? "" : body.companyProvince),
        companyPostalCode: body.companyPostalCode || null,
        companyTelp: body.companyTelp || null,
        companyEmail: body.companyEmail || null,
        productionDate: body.productionDate ? new Date(body.productionDate) : new Date(),
        paidDate: paidDate,
        billTo: uniqueBillTo,
        notes: body.notes || null,
        billingName: body.billingName || (isDraft ? "" : body.billingName),
        billingBankName: body.billingBankName || (isDraft ? "" : body.billingBankName),
        billingBankAccount: body.billingBankAccount || (isDraft ? "" : body.billingBankAccount),
        billingBankAccountName: body.billingBankAccountName || (isDraft ? "" : body.billingBankAccountName),
        billingKtp: body.billingKtp || null,
        billingNpwp: body.billingNpwp || null,
        signatureName: body.signatureName || (isDraft ? "" : body.signatureName),
        signatureRole: body.signatureRole || null,
        signatureImageData: body.signatureImageData || (isDraft ? "" : body.signatureImageData),
        pph: body.pph || (isDraft ? "" : body.pph),
        totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : 0,
        summaryOrder: body.summaryOrder || "subtotal,pph,total",
        adjustmentPercentage: body.adjustmentPercentage != null ? parseFloat(body.adjustmentPercentage) : null,
        adjustmentNotes: body.adjustmentNotes ?? null,
        status: body.status || "draft",
        items: {
          create: body.items?.map((item: any) => ({
            productName: item.productName || "",
            total: item.total ? parseFloat(item.total) : 0,
            details: {
              create: item.details?.map((detail: any) => ({
                detail: detail.detail || "",
                unitPrice: detail.unitPrice ? parseFloat(detail.unitPrice) : 0,
                qty: detail.qty ? parseFloat(detail.qty) : 0,
                amount: detail.amount ? parseFloat(detail.amount) : 0
              })) || []
            }
          })) || []
        },
        remarks: {
          create: body.remarks?.map((remark: any, index: number) => ({
            text: remark.text || "",
            isCompleted: remark.isCompleted || false,
            order: index
          })) || []
        },
        signatures: {
          create: body.customSignatures?.map((sig: any) => ({
            name: sig.name,
            position: sig.position,
            imageData: sig.imageData || "", // Empty for manual signatures
            order: sig.order
          })) || []
        }
      },
      include: {
        items: {
          include: {
            details: true
          }
        },
        remarks: true,
        signatures: true
      }
    })

    // Sync tracker if billTo is not empty
    if (uniqueBillTo && uniqueBillTo.trim()) {
      try {
        // Calculate subtotal (sum of items before PPH)
        const subtotal = body.items?.reduce((sum: number, item: any) => {
          return sum + (item.total ? parseFloat(item.total) : 0)
        }, 0) || 0

        await syncTracker({
          projectName: uniqueBillTo,
          date: body.productionDate ? new Date(body.productionDate) : new Date(),
          totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : 0,
          invoiceId: invoiceId, // Include invoice ID for invoices
          subtotal: subtotal
        })
      } catch (trackerError) {
        console.error("Error syncing tracker:", trackerError)
        // Don't fail invoice creation if tracker sync fails
      }
    }

    // Invalidate caches after creating invoice
    await invalidateInvoiceCaches()

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    )
  }
}

