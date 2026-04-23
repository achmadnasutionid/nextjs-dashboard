import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET calendar events (accepted quotations)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const month = searchParams.get("month")

    if (!year || !month) {
      return NextResponse.json(
        { error: "Year and month are required" },
        { status: 400 }
      )
    }

    // Get start and end of the month
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999)

    // Fetch accepted quotations within the date range
    const quotations = await prisma.quotation.findMany({
      where: {
        status: "accepted",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        quotationId: true,
        productionDate: true,
        totalAmount: true,
        billTo: true
      },
      orderBy: {
        productionDate: "asc"
      }
    })

    // Also fetch Paragon, Erha, and Barclay tickets (finalized status)
    const paragonTickets = await prisma.paragonTicket.findMany({
      where: {
        status: "finalized",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        ticketId: true,
        productionDate: true,
        totalAmount: true,
        billTo: true,
        projectName: true
      }
    })

    const erhaTickets = await prisma.erhaTicket.findMany({
      where: {
        status: "finalized",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        ticketId: true,
        productionDate: true,
        totalAmount: true,
        billTo: true,
        projectName: true
      }
    })
    const barclayTickets = await prisma.barclayTicket.findMany({
      where: {
        status: "finalized",
        deletedAt: null,
        productionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        ticketId: true,
        productionDate: true,
        totalAmount: true,
        billTo: true,
        projectName: true
      }
    })

    // Combine all events — use billTo/projectName for display title (not company name)
    const events = [
      ...quotations.map(q => ({
        id: q.id,
        type: "quotation" as const,
        referenceId: q.quotationId,
        productionDate: q.productionDate,
        totalAmount: q.totalAmount,
        billTo: q.billTo,
        displayTitle: q.billTo || q.quotationId
      })),
      ...paragonTickets.map(t => ({
        id: t.id,
        type: "paragon" as const,
        referenceId: t.ticketId,
        productionDate: t.productionDate,
        totalAmount: t.totalAmount,
        billTo: t.billTo,
        projectName: t.projectName,
        displayTitle: (t.projectName?.trim() || t.billTo) || t.ticketId
      })),
      ...erhaTickets.map(t => ({
        id: t.id,
        type: "erha" as const,
        referenceId: t.ticketId,
        productionDate: t.productionDate,
        totalAmount: t.totalAmount,
        billTo: t.billTo,
        projectName: t.projectName,
        displayTitle: (t.projectName?.trim() || t.billTo) || t.ticketId
      })),
      ...barclayTickets.map(t => ({
        id: t.id,
        type: "barclay" as const,
        referenceId: t.ticketId,
        productionDate: t.productionDate,
        totalAmount: t.totalAmount,
        billTo: t.billTo,
        projectName: t.projectName,
        displayTitle: (t.projectName?.trim() || t.billTo) || t.ticketId
      }))
    ]

    return NextResponse.json(events)
  } catch (error) {
    console.error("Error fetching calendar events:", error)
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    )
  }
}
