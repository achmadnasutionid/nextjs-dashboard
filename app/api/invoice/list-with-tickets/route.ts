import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET invoice list including Paragon and Erha tickets (same list, source badge + link to ticket view).
 * Query: status, sortBy, page, limit, search.
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

    const invWhere: any = { deletedAt: null }
    if (status !== "all") invWhere.status = status
    if (search) {
      invWhere.OR = [
        { invoiceId: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { billTo: { contains: search, mode: "insensitive" } }
      ]
    }

    const ticketWhere: any = { deletedAt: null }
    if (status !== "all") ticketWhere.status = status
    if (search) {
      ticketWhere.OR = [
        { quotationId: { contains: search, mode: "insensitive" } },
        { invoiceId: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { billTo: { contains: search, mode: "insensitive" } },
        { projectName: { contains: search, mode: "insensitive" } }
      ]
    }

    const [invoices, paragonTickets, erhaTickets, totalInv, totalP, totalE] = await Promise.all([
      prisma.invoice.findMany({
        where: invWhere,
        select: {
          id: true,
          invoiceId: true,
          billTo: true,
          productionDate: true,
          totalAmount: true,
          status: true,
          updatedAt: true
        },
        orderBy: { updatedAt: orderBy },
        take: takePerSource
      }),
      prisma.paragonTicket.findMany({
        where: ticketWhere,
        select: {
          id: true,
          invoiceId: true,
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
          invoiceId: true,
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
      prisma.invoice.count({ where: invWhere }),
      prisma.paragonTicket.count({ where: ticketWhere }),
      prisma.erhaTicket.count({ where: ticketWhere })
    ])

    type Row = {
      source: "invoice" | "paragon" | "erha"
      id: string
      documentId: string
      billTo: string
      productionDate: Date
      totalAmount: number
      status: string
      updatedAt: Date
      viewHref: string
    }

    const rows: Row[] = [
      ...invoices.map((inv) => ({
        source: "invoice" as const,
        id: inv.id,
        documentId: inv.invoiceId,
        billTo: inv.billTo,
        productionDate: inv.productionDate,
        totalAmount: inv.totalAmount,
        status: inv.status,
        updatedAt: inv.updatedAt,
        viewHref: `/invoice/${inv.id}/view`
      })),
      ...paragonTickets.map((t) => {
        const docId = (t.invoiceId && t.invoiceId.trim()) ? t.invoiceId : "—"
        return {
          source: "paragon" as const,
          id: t.id,
          documentId: docId,
          billTo: t.projectName,
          productionDate: t.productionDate,
          totalAmount: t.totalAmount,
          status: t.status,
          updatedAt: t.updatedAt,
          viewHref: `/special-case/paragon/${t.id}/view`
        }
      }),
      ...erhaTickets.map((t) => {
        const docId = (t.invoiceId && t.invoiceId.trim()) ? t.invoiceId : "—"
        return {
          source: "erha" as const,
          id: t.id,
          documentId: docId,
          billTo: t.projectName,
          productionDate: t.productionDate,
          totalAmount: t.totalAmount,
          status: t.status,
          updatedAt: t.updatedAt,
          viewHref: `/special-case/erha/${t.id}/view`
        }
      })
    ]

    rows.sort((a, b) =>
      orderBy === "desc"
        ? b.updatedAt.getTime() - a.updatedAt.getTime()
        : a.updatedAt.getTime() - b.updatedAt.getTime()
    )

    const total = totalInv + totalP + totalE
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
    console.error("Error fetching invoice list with tickets:", error)
    return NextResponse.json(
      { error: "Failed to fetch list" },
      { status: 500 }
    )
  }
}
