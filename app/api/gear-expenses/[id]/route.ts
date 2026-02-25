import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { invalidateGearExpenseCaches } from "@/lib/cache-invalidation"

// GET single gear expense
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const expense = await prisma.gearExpense.findUnique({
      where: { id },
    })

    if (!expense) {
      return NextResponse.json(
        { error: "Gear expense not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error fetching gear expense:", error)
    return NextResponse.json(
      { error: "Failed to fetch gear expense" },
      { status: 500 }
    )
  }
}

// PUT update gear expense
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, amount, date } = body

    const dateObj = date !== undefined ? (date ? new Date(date) : null) : undefined
    const year =
      dateObj !== undefined
        ? (dateObj ? dateObj.getFullYear() : new Date().getFullYear())
        : undefined

    const expense = await prisma.gearExpense.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(dateObj !== undefined && { date: dateObj }),
        ...(year !== undefined && { year }),
      },
    })

    // Invalidate caches after updating gear expense
    await invalidateGearExpenseCaches()

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error updating gear expense:", error)
    return NextResponse.json(
      { error: "Failed to update gear expense" },
      { status: 500 }
    )
  }
}

// DELETE (soft delete) gear expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const expense = await prisma.gearExpense.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    // Invalidate caches after deleting gear expense
    await invalidateGearExpenseCaches()

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error deleting gear expense:", error)
    return NextResponse.json(
      { error: "Failed to delete gear expense" },
      { status: 500 }
    )
  }
}

