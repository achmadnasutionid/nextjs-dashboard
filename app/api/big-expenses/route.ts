import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { invalidateBigExpenseCaches } from "@/lib/cache-invalidation"

// GET all big expenses (with optional year filter)
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

    const expenses = await prisma.bigExpense.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("Error fetching big expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch big expenses" },
      { status: 500 }
    )
  }
}

// POST create new big expense
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

    const expense = await prisma.bigExpense.create({
      data: {
        name,
        amount: parseFloat(amount),
        date: dateObj,
        year,
      },
    })

    // Invalidate caches after creating big expense
    await invalidateBigExpenseCaches()

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error creating big expense:", error)
    return NextResponse.json(
      { error: "Failed to create big expense" },
      { status: 500 }
    )
  }
}

