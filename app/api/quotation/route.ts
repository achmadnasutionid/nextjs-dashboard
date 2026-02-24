import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateId } from "@/lib/id-generator"
import { invalidateQuotationCaches } from "@/lib/cache-invalidation"
import { cache, cacheKeys } from "@/lib/redis"
import { generateUniqueName } from "@/lib/name-validator"
import { syncTracker } from "@/lib/tracker-sync"

// GET all quotations (optimized with pagination + Redis caching)
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
      ? `${cacheKeys.quotationList(status || 'all', page)}:${sortBy}:${limit}`
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
        { quotationId: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { billTo: { contains: search, mode: 'insensitive' } }
      ]
    }

    const orderByUpdated = { updatedAt: sortBy === "oldest" ? "asc" as const : "desc" as const }
    const select = {
      id: true,
      quotationId: true,
      companyName: true,
      billTo: true,
      productionDate: true,
      totalAmount: true,
      status: true,
      generatedInvoiceId: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          productName: true,
          total: true
        }
      }
    }

    // When showing all statuses: non-accepted first (by updatedAt), accepted at bottom
    let quotations: Awaited<ReturnType<typeof prisma.quotation.findMany<{ select: typeof select }>>>
    let total: number

    if (!status || status === "all") {
      const whereNonAccepted = { ...where, status: { in: ["draft", "pending"] } }
      const whereAccepted = { ...where, status: "accepted" }
      const [nonAccepted, accepted, countNon, countAcc] = await Promise.all([
        prisma.quotation.findMany({ where: whereNonAccepted, orderBy: orderByUpdated, select }),
        prisma.quotation.findMany({ where: whereAccepted, orderBy: orderByUpdated, select }),
        prisma.quotation.count({ where: whereNonAccepted }),
        prisma.quotation.count({ where: whereAccepted })
      ])
      const merged = [...nonAccepted, ...accepted]
      total = countNon + countAcc
      quotations = merged.slice(skip, skip + limit)
    } else {
      const [data, count] = await Promise.all([
        prisma.quotation.findMany({
          where,
          orderBy: orderByUpdated,
          select,
          take: limit,
          skip
        }),
        prisma.quotation.count({ where })
      ])
      quotations = data
      total = count
    }

    const response = {
      data: quotations,
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
    console.error("Error fetching quotations:", error)
    return NextResponse.json(
      { error: "Failed to fetch quotations" },
      { status: 500 }
    )
  }
}

// POST create new quotation
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate unique quotation ID (optimized with cache)
    const quotationId = await generateId('QTN', 'quotation')

    // For drafts, provide defaults for required fields if not provided
    const isDraft = body.status === "draft"
    
    // Generate unique billTo name if there's a conflict
    const billToValue = body.billTo || (isDraft ? "" : body.billTo)
    const uniqueBillTo = billToValue ? await generateUniqueName(billToValue, 'quotation') : billToValue
    
    // Create quotation with items and details
    const quotation = await prisma.quotation.create({
      data: {
        quotationId,
        companyName: body.companyName || (isDraft ? "" : body.companyName),
        companyAddress: body.companyAddress || (isDraft ? "" : body.companyAddress),
        companyCity: body.companyCity || (isDraft ? "" : body.companyCity),
        companyProvince: body.companyProvince || (isDraft ? "" : body.companyProvince),
        companyTelp: body.companyTelp || null,
        companyEmail: body.companyEmail || null,
        productionDate: body.productionDate ? new Date(body.productionDate) : new Date(),
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
          subtotal: subtotal
        })
      } catch (trackerError) {
        console.error("Error syncing tracker:", trackerError)
        // Don't fail quotation creation if tracker sync fails
      }
    }

    // Invalidate caches after creating quotation
    await invalidateQuotationCaches()

    return NextResponse.json(quotation, { status: 201 })
  } catch (error) {
    console.error("Error creating quotation:", error)
    return NextResponse.json(
      { error: "Failed to create quotation" },
      { status: 500 }
    )
  }
}

