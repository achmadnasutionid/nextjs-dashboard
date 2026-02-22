import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { invalidateErhaCaches } from "@/lib/cache-invalidation"
import { generateUniqueName } from "@/lib/name-validator"
import { syncTracker } from "@/lib/tracker-sync"

// GET all erha tickets (optimized with pagination)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const sortBy = searchParams.get("sortBy")
    const search = searchParams.get("search") || ""
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = status ? { status } : {}
    
    // Add search filter (if provided)
    if (search) {
      where.OR = [
        { ticketId: { contains: search, mode: 'insensitive' } },
        { quotationId: { contains: search, mode: 'insensitive' } },
        { invoiceId: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { billTo: { contains: search, mode: 'insensitive' } },
        { projectName: { contains: search, mode: 'insensitive' } }
      ]
    }

    const orderBy = sortBy === "oldest" ? { createdAt: "asc" as const } : { createdAt: "desc" as const }

    // Fetch data with pagination - optimized for list view
    const [tickets, total] = await Promise.all([
      prisma.erhaTicket.findMany({
        where,
        orderBy,
        select: {
          id: true,
          ticketId: true,
          quotationId: true,
          invoiceId: true,
          companyName: true,
          billTo: true,
          projectName: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          // Include full item details for list view (show all details without opening PDF)
          items: {
            select: {
              id: true,
              productName: true,
              total: true,
              order: true,
              details: {
                select: {
                  id: true,
                  detail: true,
                  unitPrice: true,
                  qty: true,
                  amount: true
                }
              }
            }
          }
        },
        take: limit,
        skip: skip
      }),
      prisma.erhaTicket.count({ where })
    ])

    // Return paginated response
    return NextResponse.json({
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching erha tickets:", error)
    return NextResponse.json(
      { error: "Failed to fetch erha tickets" },
      { status: 500 }
    )
  }
}

// Helper to extract number from ID (e.g., "ERH-2024-0001" -> 1)
function extractIdNumber(id: string | null | undefined): number {
  if (!id) return 0
  const parts = id.split("-")
  const num = parseInt(parts[2])
  return isNaN(num) ? 0 : num
}

// Build combined billTo for PDF/uniqueness: "billTo - projectName"
function combinedBillTo(billToPart: string | undefined, projectNamePart: string | undefined): string {
  const a = (billToPart ?? "").trim()
  const b = (projectNamePart ?? "").trim()
  return [a, b].filter(Boolean).join(" - ") || ""
}

// POST create new erha ticket
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const year = new Date().getFullYear()

    const isDraft = body.status === "draft"
    const projectNameStored = (body.projectName ?? "").trim()
    const combined = combinedBillTo(body.billTo, body.projectName)
    const uniqueBillTo = combined ? await generateUniqueName(combined, 'erha') : (isDraft ? "" : combined)

    // Use transaction for atomic ID generation and creation
    const ticket = await prisma.$transaction(async (tx) => {
      // Fetch all latest IDs in parallel for better performance
      const [
        latestTicket,
        latestQuotation,
        latestParagonQuotation,
        latestErhaQuotation,
        latestInvoice,
        latestParagonInvoice,
        latestErhaInvoice
      ] = await Promise.all([
        tx.erhaTicket.findFirst({
          where: { ticketId: { startsWith: `ERH-${year}-` } },
          orderBy: { ticketId: "desc" },
          select: { ticketId: true }
        }),
        tx.quotation.findFirst({
          where: { quotationId: { startsWith: `QTN-${year}-` } },
          orderBy: { quotationId: "desc" },
          select: { quotationId: true }
        }),
        tx.paragonTicket.findFirst({
          where: { quotationId: { startsWith: `QTN-${year}-`, not: "" } },
          orderBy: { quotationId: "desc" },
          select: { quotationId: true }
        }),
        tx.erhaTicket.findFirst({
          where: { quotationId: { startsWith: `QTN-${year}-`, not: "" } },
          orderBy: { quotationId: "desc" },
          select: { quotationId: true }
        }),
        tx.invoice.findFirst({
          where: { invoiceId: { startsWith: `INV-${year}-` } },
          orderBy: { invoiceId: "desc" },
          select: { invoiceId: true }
        }),
        tx.paragonTicket.findFirst({
          where: { invoiceId: { startsWith: `INV-${year}-`, not: "" } },
          orderBy: { invoiceId: "desc" },
          select: { invoiceId: true }
        }),
        tx.erhaTicket.findFirst({
          where: { invoiceId: { startsWith: `INV-${year}-`, not: "" } },
          orderBy: { invoiceId: "desc" },
          select: { invoiceId: true }
        })
      ])

      // Calculate next IDs
      const nextTicketNum = extractIdNumber(latestTicket?.ticketId) + 1
      const nextQuotationNum = Math.max(
        extractIdNumber(latestQuotation?.quotationId),
        extractIdNumber(latestParagonQuotation?.quotationId),
        extractIdNumber(latestErhaQuotation?.quotationId)
      ) + 1
      const nextInvoiceNum = Math.max(
        extractIdNumber(latestInvoice?.invoiceId),
        extractIdNumber(latestParagonInvoice?.invoiceId),
        extractIdNumber(latestErhaInvoice?.invoiceId)
      ) + 1

      const ticketId = `ERH-${year}-${nextTicketNum.toString().padStart(4, "0")}`
      const quotationId = `QTN-${year}-${nextQuotationNum.toString().padStart(4, "0")}`
      const invoiceId = `INV-${year}-${nextInvoiceNum.toString().padStart(4, "0")}`

      // Create ticket atomically
      return tx.erhaTicket.create({
        data: {
          ticketId,
          quotationId,
          invoiceId,
          companyName: body.companyName || (isDraft ? "" : body.companyName),
          companyAddress: body.companyAddress || (isDraft ? "" : body.companyAddress),
          companyCity: body.companyCity || (isDraft ? "" : body.companyCity),
          companyProvince: body.companyProvince || (isDraft ? "" : body.companyProvince),
          companyPostalCode: body.companyPostalCode || null,
          companyTelp: body.companyTelp || null,
          companyEmail: body.companyEmail || null,
          productionDate: body.productionDate ? new Date(body.productionDate) : new Date(),
          quotationDate: body.quotationDate ? new Date(body.quotationDate) : new Date(),
          invoiceBastDate: body.invoiceBastDate ? new Date(body.invoiceBastDate) : new Date(),
          billTo: uniqueBillTo,
          projectName: projectNameStored,
          billToAddress: body.billToAddress || "",
          contactPerson: body.contactPerson || (isDraft ? "" : body.contactPerson),
          contactPosition: body.contactPosition || (isDraft ? "" : body.contactPosition),
          bastContactPerson: body.bastContactPerson || null,
          bastContactPosition: body.bastContactPosition || null,
          billingName: body.billingName || (isDraft ? "" : body.billingName),
          billingBankName: body.billingBankName || (isDraft ? "" : body.billingBankName),
          billingBankAccount: body.billingBankAccount || (isDraft ? "" : body.billingBankAccount),
          billingBankAccountName: body.billingBankAccountName || (isDraft ? "" : body.billingBankAccountName),
          billingKtp: body.billingKtp || null,
          billingNpwp: body.billingNpwp || null,
          signatureName: body.signatureName || (isDraft ? "" : body.signatureName),
          signatureRole: body.signatureRole || null,
          signatureImageData: body.signatureImageData || (isDraft ? "" : body.signatureImageData),
          finalWorkImageData: body.finalWorkImageData || null,
          pph: body.pph || (isDraft ? "" : body.pph),
          totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : 0,
          adjustmentPercentage: body.adjustmentPercentage != null ? parseFloat(body.adjustmentPercentage) : null,
          adjustmentNotes: body.adjustmentNotes ?? null,
          termsAndConditions: body.termsAndConditions || null,
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
          }
        },
        include: {
          items: { include: { details: true } },
          remarks: {
          orderBy: { order: 'asc' }
        }
        }
      })
    })

    // Sync tracker if project name is not empty
    if (projectNameStored && projectNameStored.trim()) {
      try {
        // Calculate subtotal (sum of items)
        const subtotal = body.items?.reduce((sum: number, item: any) => {
          return sum + (item.total ? parseFloat(item.total) : 0)
        }, 0) || 0

        await syncTracker({
          projectName: projectNameStored,
          date: body.productionDate ? new Date(body.productionDate) : new Date(),
          totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : 0,
          subtotal: subtotal
        })
      } catch (trackerError) {
        console.error("Error syncing tracker:", trackerError)
        // Don't fail erha creation if tracker sync fails
      }
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error("Error creating erha ticket:", error)
    const message = error instanceof Error ? error.message : String(error)
    const isPayloadTooLarge =
      message.includes("body") ||
      message.includes("payload") ||
      message.includes("size") ||
      message.includes("413") ||
      message.includes("limit")
    const userMessage = isPayloadTooLarge
      ? "Request too large. Try using smaller images for signature and screenshot."
      : message || "Failed to create erha ticket"
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    )
  }
}

