import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET quotation list including Paragon, Erha, and Barclay tickets (same list, source badge + link to ticket view).
 * Query: status, sortBy, page, limit, search, includeTickets (default true).
 *
 * Special case – Paragon, Erha, and Barclay use status: draft | pending | final (same three-state model).
 * Mapping for list filter: draft → draft; pending → draft + pending (in progress); accepted → final.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "all"
    const sortBy = searchParams.get("sortBy") || "newest"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")))
    const search = (searchParams.get("search") || "").trim()

    const orderBy = sortBy === "oldest" ? "asc" as const : "desc" as const
    const takePerSource = page * limit

    // Pending = in progress (draft + pending) for both quotation and Paragon/Erha
    const pendingStatuses: string[] = ["draft", "pending"]

    // Quotation where
    const qWhere: any = { deletedAt: null }
    if (status !== "all") {
      if (status === "pending") {
        qWhere.status = { in: pendingStatuses }
      } else {
        qWhere.status = status
      }
    }
    if (search) {
      qWhere.OR = [
        { quotationId: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { billTo: { contains: search, mode: "insensitive" } }
      ]
    }

    // Special tickets: draft/pending/final – map accepted → final, pending → draft + pending
    const ticketWhere: any = { deletedAt: null }
    if (status !== "all") {
      if (status === "accepted") {
        ticketWhere.status = "final"
      } else if (status === "pending") {
        ticketWhere.status = { in: pendingStatuses }
      } else {
        ticketWhere.status = status
      }
    }
    if (search) {
      ticketWhere.OR = [
        { quotationId: { contains: search, mode: "insensitive" } },
        { invoiceId: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { billTo: { contains: search, mode: "insensitive" } },
        { projectName: { contains: search, mode: "insensitive" } }
      ]
    }

    const [quotations, paragonTickets, erhaTickets, barclayTickets, totalQ, totalP, totalE, totalB] = await Promise.all([
      prisma.quotation.findMany({
        where: qWhere,
        select: {
          id: true,
          quotationId: true,
          billTo: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          generatedInvoiceId: true,
          updatedAt: true
        },
        orderBy: { updatedAt: orderBy },
        take: takePerSource
      }),
      prisma.paragonTicket.findMany({
        where: ticketWhere,
        select: {
          id: true,
          quotationId: true,
          projectName: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          generatedInvoiceId: true,
          updatedAt: true
        },
        orderBy: { updatedAt: orderBy },
        take: takePerSource
      }),
      prisma.erhaTicket.findMany({
        where: ticketWhere,
        select: {
          id: true,
          quotationId: true,
          projectName: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          generatedInvoiceId: true,
          updatedAt: true
        },
        orderBy: { updatedAt: orderBy },
        take: takePerSource
      }),
      prisma.barclayTicket.findMany({
        where: ticketWhere,
        select: {
          id: true,
          quotationId: true,
          projectName: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          generatedInvoiceId: true,
          updatedAt: true
        },
        orderBy: { updatedAt: orderBy },
        take: takePerSource
      }),
      prisma.quotation.count({ where: qWhere }),
      prisma.paragonTicket.count({ where: ticketWhere }),
      prisma.erhaTicket.count({ where: ticketWhere }),
      prisma.barclayTicket.count({ where: ticketWhere })
    ])

    type Row = {
      source: "quotation" | "paragon" | "erha" | "barclay"
      id: string
      documentId: string
      billTo: string
      productionDate: Date
      totalAmount: number
      status: string
      updatedAt: Date
      viewHref: string
      generatedInvoiceId?: string | null
    }

    const rows: Row[] = [
      ...quotations.map((q) => ({
        source: "quotation" as const,
        id: q.id,
        documentId: q.quotationId,
        billTo: q.billTo,
        productionDate: q.productionDate,
        totalAmount: q.totalAmount,
        status: q.status,
        updatedAt: q.updatedAt,
        viewHref: `/quotation/${q.id}/view`,
        generatedInvoiceId: q.generatedInvoiceId
      })),
      ...paragonTickets.map((t) => {
        const docId = (t.quotationId && t.quotationId.trim()) ? t.quotationId : "—"
        return {
          source: "paragon" as const,
          id: t.id,
          documentId: docId,
          billTo: t.projectName,
          productionDate: t.productionDate,
          totalAmount: t.totalAmount,
          status: t.status,
          updatedAt: t.updatedAt,
          viewHref: `/special-case/paragon/${t.id}/view`,
          generatedInvoiceId: t.generatedInvoiceId
        }
      }),
      ...erhaTickets.map((t) => {
        const docId = (t.quotationId && t.quotationId.trim()) ? t.quotationId : "—"
        return {
          source: "erha" as const,
          id: t.id,
          documentId: docId,
          billTo: t.projectName,
          productionDate: t.productionDate,
          totalAmount: t.totalAmount,
          status: t.status,
          updatedAt: t.updatedAt,
          viewHref: `/special-case/erha/${t.id}/view`,
          generatedInvoiceId: t.generatedInvoiceId
        }
      }),
      ...barclayTickets.map((t) => {
        const docId = (t.quotationId && t.quotationId.trim()) ? t.quotationId : "—"
        return {
          source: "barclay" as const,
          id: t.id,
          documentId: docId,
          billTo: t.projectName,
          productionDate: t.productionDate,
          totalAmount: t.totalAmount,
          status: t.status,
          updatedAt: t.updatedAt,
          viewHref: `/special-case/barclay/${t.id}/view`,
          generatedInvoiceId: t.generatedInvoiceId
        }
      })
    ]

    // Non-final (draft/pending) first by updatedAt, final/accepted at bottom
    const isFinalStatus = (r: Row) =>
      (r.source === "quotation" && r.status === "accepted") ||
      ((r.source === "paragon" || r.source === "erha" || r.source === "barclay") && r.status === "final")
    rows.sort((a, b) => {
      const aFinal = isFinalStatus(a)
      const bFinal = isFinalStatus(b)
      if (aFinal !== bFinal) return aFinal ? 1 : -1
      return orderBy === "desc"
        ? b.updatedAt.getTime() - a.updatedAt.getTime()
        : a.updatedAt.getTime() - b.updatedAt.getTime()
    })

    const total = totalQ + totalP + totalE + totalB
    const start = (page - 1) * limit
    const data = rows.slice(start, start + limit)

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching quotation list with tickets:", error)
    return NextResponse.json(
      { error: "Failed to fetch list" },
      { status: 500 }
    )
  }
}
