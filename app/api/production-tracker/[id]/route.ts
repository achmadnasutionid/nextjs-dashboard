import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cache, cacheKeys } from "@/lib/redis"
import { generateUniqueName } from "@/lib/name-validator"

// GET single production tracker
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tracker = await prisma.productionTracker.findUnique({
      where: { id }
    })

    if (!tracker) {
      return NextResponse.json(
        { error: "Production tracker not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(tracker)
  } catch (error) {
    console.error("Error fetching production tracker:", error)
    return NextResponse.json(
      { error: "Failed to fetch production tracker" },
      { status: 500 }
    )
  }
}

// PUT update production tracker
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // If projectName is being updated, check for conflicts and generate unique name
    let finalProjectName = body.projectName
    if (body.projectName !== undefined) {
      finalProjectName = await generateUniqueName(body.projectName, 'productionTracker', id)
    }

    const tracker = await prisma.productionTracker.update({
      where: { id },
      data: {
        expenseId: body.expenseId,
        invoiceId: body.invoiceId !== undefined ? body.invoiceId : undefined,
        projectName: finalProjectName,
        date: body.date ? new Date(body.date) : undefined,
        subtotal: body.subtotal !== undefined ? parseFloat(body.subtotal) : undefined,
        totalAmount: body.totalAmount !== undefined ? parseFloat(body.totalAmount) : undefined,
        expense: body.expense !== undefined ? parseFloat(body.expense) : undefined,
        productAmounts: body.productAmounts !== undefined ? body.productAmounts : undefined,
        cellNotes: body.cellNotes !== undefined ? body.cellNotes : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        status: body.status !== undefined ? body.status : undefined
      }
    })

    // Invalidate caches after updating tracker
    await Promise.all([
      cache.delete(cacheKeys.dashboardStats()),
      cache.delete('tracker:list:*'),
      cache.delete(cacheKeys.tracker(id)),
    ])

    return NextResponse.json(tracker)
  } catch (error) {
    console.error("Error updating production tracker:", error)
    return NextResponse.json(
      { error: "Failed to update production tracker" },
      { status: 500 }
    )
  }
}

// DELETE production tracker
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Soft delete
    await prisma.productionTracker.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    })

    // Invalidate caches after deleting tracker
    await Promise.all([
      cache.delete(cacheKeys.dashboardStats()),
      cache.delete('tracker:list:*'),
      cache.delete(cacheKeys.tracker(id)),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting production tracker:", error)
    return NextResponse.json(
      { error: "Failed to delete production tracker" },
      { status: 500 }
    )
  }
}
