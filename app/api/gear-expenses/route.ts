import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { invalidateGearExpenseCaches } from "@/lib/cache-invalidation"

// GET all gear expenses (with optional year filter)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const showDeleted = searchParams.get("showDeleted") === "true"

    const whereClause: any = {}

    // Year is a filter: show expenses whose date falls in that year (not stored year)
    if (year && year !== "all") {
      const y = parseInt(year)
      whereClause.date = {
        gte: new Date(y, 0, 1),
        lt: new Date(y + 1, 0, 1),
      }
    }

    if (!showDeleted) {
      whereClause.deletedAt = null
    }

    const expenses = await prisma.gearExpense.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("Error fetching gear expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch gear expenses" },
      { status: 500 }
    )
  }
}

// POST create new gear expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, amount, date } = body

    if (!name || amount === undefined) {
      return NextResponse.json(
        { error: "Name and amount are required" },
        { status: 400 }
      )
    }

    const dateObj = date ? new Date(date) : null
    const year = dateObj ? dateObj.getFullYear() : new Date().getFullYear()

    const expense = await prisma.gearExpense.create({
      data: {
        name,
        amount: parseFloat(amount),
        date: dateObj,
        year,
      },
    })

    // Invalidate caches after creating gear expense
    await invalidateGearExpenseCaches()

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error creating gear expense:", error)
    return NextResponse.json(
      { error: "Failed to create gear expense" },
      { status: 500 }
    )
  }
}

