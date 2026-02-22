import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET pending + draft invoice totals grouped by year.
 * Uses same sources as invoice list: Invoice + ParagonTicket + ErhaTicket (status = pending or draft).
 * Returns { years: number[], byYear: Record<string, number> } for landing page card.
 */
export async function GET() {
  try {
    const statuses: string[] = ["pending", "draft"]
    const where = { status: { in: statuses }, deletedAt: null }

    const [invoices, paragon, erha] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: { productionDate: true, totalAmount: true },
      }),
      prisma.paragonTicket.findMany({
        where,
        select: { productionDate: true, totalAmount: true },
      }),
      prisma.erhaTicket.findMany({
        where,
        select: { productionDate: true, totalAmount: true },
      }),
    ])

    const byYear: Record<string, number> = {}

    const add = (date: Date | null, amount: number) => {
      const year = date ? new Date(date).getFullYear() : new Date().getFullYear()
      byYear[year] = (byYear[year] ?? 0) + amount
    }

    invoices.forEach((r) => add(r.productionDate, r.totalAmount))
    paragon.forEach((r) => add(r.productionDate, r.totalAmount))
    erha.forEach((r) => add(r.productionDate, r.totalAmount))

    const years = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => b - a)

    return NextResponse.json({ years, byYear })
  } catch (error) {
    console.error("Error fetching pending totals by year:", error)
    return NextResponse.json(
      { error: "Failed to fetch pending totals" },
      { status: 500 }
    )
  }
}
