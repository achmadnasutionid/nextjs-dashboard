import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { invalidateParagonCaches } from "@/lib/cache-invalidation"
import { generateUniqueName } from "@/lib/name-validator"
import { syncTracker } from "@/lib/tracker-sync"

// GET all paragon tickets (optimized with pagination)
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

    const orderByUpdated = sortBy === "oldest" ? { updatedAt: "asc" as const } : { updatedAt: "desc" as const }
    const select = {
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
    }

    // When showing all statuses: non-final first (by updatedAt), final at bottom
    let tickets: Awaited<ReturnType<typeof prisma.paragonTicket.findMany<{ select: typeof select }>>>
    let total: number

    if (!status || status === "all") {
      const whereNonFinal = { ...where, status: { in: ["draft", "pending"] } }
      const whereFinal = { ...where, status: "final" }
      const [nonFinal, final, countNonFinal, countFinal] = await Promise.all([
        prisma.paragonTicket.findMany({ where: whereNonFinal, orderBy: orderByUpdated, select }),
        prisma.paragonTicket.findMany({ where: whereFinal, orderBy: orderByUpdated, select }),
        prisma.paragonTicket.count({ where: whereNonFinal }),
        prisma.paragonTicket.count({ where: whereFinal })
      ])
      const merged = [...nonFinal, ...final]
      total = countNonFinal + countFinal
      tickets = merged.slice(skip, skip + limit)
    } else {
      const [data, count] = await Promise.all([
        prisma.paragonTicket.findMany({
          where,
          orderBy: orderByUpdated,
          select,
          take: limit,
          skip
        }),
        prisma.paragonTicket.count({ where })
      ])
      tickets = data
      total = count
    }

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
    console.error("Error fetching paragon tickets:", error)
    return NextResponse.json(
      { error: "Failed to fetch paragon tickets" },
      { status: 500 }
    )
  }
}

// Helper to extract number from ID (e.g., "PRG-2024-0001" -> 1)
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

// POST create new paragon ticket
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const year = new Date().getFullYear()

    const isDraft = body.status === "draft"
    const projectNameStored = (body.projectName ?? "").trim()
    const combined = combinedBillTo(body.billTo, body.projectName)
    const uniqueBillTo = combined ? await generateUniqueName(combined, 'paragon') : (isDraft ? "" : combined)

    // Use transaction for atomic ID generation and creation
    const ticket = await prisma.$transaction(async (tx) => {
      // Fetch all IDs with year prefix (numeric max is reliable; orderBy string desc is not)
      const [
        paragonTicketIds,
        quotationIds,
        paragonQuotationIds,
        erhaQuotationIds,
        barclayQuotationIds,
        invoiceIds,
        paragonInvoiceIds,
        erhaInvoiceIds,
        barclayInvoiceIds
      ] = await Promise.all([
        tx.paragonTicket.findMany({
          where: { ticketId: { startsWith: `PRG-${year}-` } },
          select: { ticketId: true }
        }),
        tx.quotation.findMany({
          where: { quotationId: { startsWith: `QTN-${year}-` } },
          select: { quotationId: true }
        }),
        tx.paragonTicket.findMany({
          where: { quotationId: { startsWith: `QTN-${year}-`, not: "" } },
          select: { quotationId: true }
        }),
        tx.erhaTicket.findMany({
          where: { quotationId: { startsWith: `QTN-${year}-`, not: "" } },
          select: { quotationId: true }
        }),
        tx.barclayTicket.findMany({
          where: { quotationId: { startsWith: `QTN-${year}-`, not: "" } },
          select: { quotationId: true }
        }),
        tx.invoice.findMany({
          where: { invoiceId: { startsWith: `INV-${year}-` } },
          select: { invoiceId: true }
        }),
        tx.paragonTicket.findMany({
          where: { invoiceId: { startsWith: `INV-${year}-`, not: "" } },
          select: { invoiceId: true }
        }),
        tx.erhaTicket.findMany({
          where: { invoiceId: { startsWith: `INV-${year}-`, not: "" } },
          select: { invoiceId: true }
        }),
        tx.barclayTicket.findMany({
          where: { invoiceId: { startsWith: `INV-${year}-`, not: "" } },
          select: { invoiceId: true }
        })
      ])

      const maxQuotationNum = Math.max(
        0,
        ...quotationIds.map((r) => extractIdNumber(r.quotationId)),
        ...paragonQuotationIds.map((r) => extractIdNumber(r.quotationId)),
        ...erhaQuotationIds.map((r) => extractIdNumber(r.quotationId)),
        ...barclayQuotationIds.map((r) => extractIdNumber(r.quotationId))
      )
      const maxInvoiceNum = Math.max(
        0,
        ...invoiceIds.map((r) => extractIdNumber(r.invoiceId)),
        ...paragonInvoiceIds.map((r) => extractIdNumber(r.invoiceId)),
        ...erhaInvoiceIds.map((r) => extractIdNumber(r.invoiceId)),
        ...barclayInvoiceIds.map((r) => extractIdNumber(r.invoiceId))
      )

      let nextTicketNum = Math.max(0, ...paragonTicketIds.map((r) => extractIdNumber(r.ticketId))) + 1
      let nextQuotationNum = maxQuotationNum + 1
      let nextInvoiceNum = maxInvoiceNum + 1

      let ticketId = `PRG-${year}-${nextTicketNum.toString().padStart(4, "0")}`
      let quotationId = `QTN-${year}-${nextQuotationNum.toString().padStart(4, "0")}`
      let invoiceId = `INV-${year}-${nextInvoiceNum.toString().padStart(4, "0")}`

      // Avoid collision with real Quotation/Invoice: if ID already exists there, increment until free
      while (await tx.quotation.findUnique({ where: { quotationId }, select: { id: true } })) {
        nextQuotationNum++
        quotationId = `QTN-${year}-${nextQuotationNum.toString().padStart(4, "0")}`
      }
      while (await tx.invoice.findUnique({ where: { invoiceId }, select: { id: true } })) {
        nextInvoiceNum++
        invoiceId = `INV-${year}-${nextInvoiceNum.toString().padStart(4, "0")}`
      }

      // Create ticket atomically
      return tx.paragonTicket.create({
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
          contactPerson: body.contactPerson || (isDraft ? "" : body.contactPerson),
          contactPosition: body.contactPosition || (isDraft ? "" : body.contactPosition),
          bastContactPerson: body.bastContactPerson || null,
          bastContactPosition: body.bastContactPosition || null,
          signatureName: body.signatureName || (isDraft ? "" : body.signatureName),
          signatureRole: body.signatureRole || null,
          signatureImageData: body.signatureImageData || (isDraft ? "" : body.signatureImageData),
          finalWorkImageData: body.finalWorkImageData || null,
          finalWorkDriveLink: body.finalWorkDriveLink?.trim() || null,
          pph: body.pph || (isDraft ? "" : body.pph),
          totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : 0,
          adjustmentPercentage: body.adjustmentPercentage != null ? parseFloat(body.adjustmentPercentage) : null,
          adjustmentNotes: body.adjustmentNotes ?? null,
          termsAndConditions: body.termsAndConditions || null,
          status: body.status || "pending",
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
          subtotal: subtotal,
          invoiceId: ticket.invoiceId || null
        })
      } catch (trackerError) {
        console.error("Error syncing tracker:", trackerError)
        // Don't fail paragon creation if tracker sync fails
      }
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error("Error creating paragon ticket:", error)
    const message = error instanceof Error ? error.message : String(error)
    const isPayloadTooLarge =
      message.includes("body") ||
      message.includes("payload") ||
      message.includes("size") ||
      message.includes("413") ||
      message.includes("limit")
    const userMessage = isPayloadTooLarge
      ? "Request too large. Try using smaller images for signature and screenshot."
      : message || "Failed to create paragon ticket"
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    )
  }
}

