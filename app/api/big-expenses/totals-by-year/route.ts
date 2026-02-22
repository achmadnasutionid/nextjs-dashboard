import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET big expense totals grouped by year (excluding deleted).
 * Returns { years: number[], byYear: Record<string, number> } for Finance Overview.
 */
export async function GET() {
  try {
    const expenses = await prisma.bigExpense.findMany({
      where: { deletedAt: null },
      select: { year: true, amount: true },
    })
    const byYear: Record<string, number> = {}
    expenses.forEach((r) => {
      byYear[r.year] = (byYear[r.year] ?? 0) + r.amount
    })
    const years = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => b - a)
    return NextResponse.json({ years, byYear })
  } catch (error) {
    console.error("Error fetching big expense totals by year:", error)
    return NextResponse.json(
      { error: "Failed to fetch big expense totals" },
      { status: 500 }
    )
  }
}
