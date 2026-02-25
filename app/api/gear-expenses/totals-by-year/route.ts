import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET gear expense totals grouped by year (excluding deleted).
 * Returns { years: number[], byYear: Record<string, number> } for Finance Overview.
 */
export async function GET() {
  try {
    const expenses = await prisma.gearExpense.findMany({
      where: { deletedAt: null },
      select: { date: true, amount: true },
    })
    const byYear: Record<string, number> = {}
    expenses.forEach((r) => {
      const year = r.date ? new Date(r.date).getFullYear() : new Date().getFullYear()
      byYear[year] = (byYear[year] ?? 0) + r.amount
    })
    const years = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => b - a)
    return NextResponse.json({ years, byYear })
  } catch (error) {
    console.error("Error fetching gear expense totals by year:", error)
    return NextResponse.json(
      { error: "Failed to fetch gear expense totals" },
      { status: 500 }
    )
  }
}
