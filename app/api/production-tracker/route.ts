import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateId } from "@/lib/id-generator"
import { cache, cacheKeys } from "@/lib/redis"
import { generateUniqueName } from "@/lib/name-validator"

// GET all production trackers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const sortBy = searchParams.get("sortBy") || "newest"
    
    const where: any = {
      deletedAt: null
    }
    
    if (search) {
      where.AND = [
        { deletedAt: null },
        {
          OR: [
            { trackerId: { contains: search, mode: 'insensitive' } },
            { expenseId: { contains: search, mode: 'insensitive' } },
            { projectName: { contains: search, mode: 'insensitive' } }
          ]
        }
      ]
    }

    const trackers = await prisma.productionTracker.findMany({
      where,
      orderBy: {
        createdAt: sortBy === "oldest" ? "asc" : "desc"
      }
    })

    return NextResponse.json(trackers)
  } catch (error) {
    console.error("Error fetching production trackers:", error)
    return NextResponse.json(
      { error: "Failed to fetch production trackers" },
      { status: 500 }
    )
  }
}

// POST create new production tracker
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate unique tracker ID
    const trackerId = await generateId('PT', 'productionTracker')

    // Generate unique project name if there's a conflict
    const uniqueProjectName = await generateUniqueName(body.projectName || "", 'productionTracker')

    // Create production tracker
    const tracker = await prisma.productionTracker.create({
      data: {
        trackerId,
        expenseId: body.expenseId || "",
        invoiceId: body.invoiceId || null,
        projectName: uniqueProjectName,
        date: body.date ? new Date(body.date) : new Date(),
        subtotal: parseFloat(body.subtotal) || 0,
        totalAmount: parseFloat(body.totalAmount) || 0,
        expense: parseFloat(body.expense) || 0,
        productAmounts: body.productAmounts || {},
        cellNotes: body.cellNotes ?? {},
        notes: body.notes || null,
        status: body.status || "pending"
      }
    })

    // Invalidate caches after creating tracker (non-fatal)
    try {
      await Promise.all([
        cache.delete(cacheKeys.dashboardStats()),
        cache.delete('tracker:list:*'),
      ])
    } catch (cacheErr) {
      console.warn("Cache invalidation failed after create:", cacheErr)
    }

    return NextResponse.json(tracker, { status: 201 })
  } catch (error: any) {
    console.error("Error creating production tracker:", error)
    const message = error?.message || "Unknown error"
    const isPrisma = message.includes("column") && message.includes("does not exist")
    return NextResponse.json(
      {
        error: "Failed to create production tracker",
        details: message,
        hint: isPrisma ? "Run: npx prisma migrate deploy" : undefined
      },
      { status: 500 }
    )
  }
}
