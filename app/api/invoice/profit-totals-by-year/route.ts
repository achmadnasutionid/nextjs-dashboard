import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET profit totals by year: paid invoices + final Paragon/Erha tickets.
 * Returns { years: number[], byYear: Record<string, number> } for Finance Overview.
 */
export async function GET() {
  try {
    const [invoices, paragon, erha] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: "paid", deletedAt: null },
        select: { productionDate: true, totalAmount: true },
      }),
      prisma.paragonTicket.findMany({
        where: { status: "final", deletedAt: null },
        select: { productionDate: true, totalAmount: true },
      }),
      prisma.erhaTicket.findMany({
        where: { status: "final", deletedAt: null },
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
    console.error("Error fetching profit totals by year:", error)
    return NextResponse.json(
      { error: "Failed to fetch profit totals" },
      { status: 500 }
    )
  }
}
