import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET single signature (excluding soft-deleted)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const signature = await prisma.signature.findFirst({
      where: { id, deletedAt: null }
    })

    if (!signature) {
      return NextResponse.json(
        { error: "Signature not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(signature)
  } catch (error) {
    console.error("Error fetching signature:", error)
    return NextResponse.json(
      { error: "Failed to fetch signature" },
      { status: 500 }
    )
  }
}

// PUT update signature
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, role, imageData } = body

    // Validate required fields (imageData is now optional for offline signing)
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    // Check for duplicate name (excluding current signature and soft-deleted)
    const existing = await prisma.signature.findFirst({
      where: {
        name,
        deletedAt: null,
        NOT: { id }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Signature name already exists" },
        { status: 400 }
      )
    }

    const signature = await prisma.signature.update({
      where: { id },
      data: {
        name,
        role,
        imageData: imageData || "" // Store empty string if no image provided
      }
    })

    return NextResponse.json(signature)
  } catch (error) {
    console.error("Error updating signature:", error)
    return NextResponse.json(
      { error: "Failed to update signature" },
      { status: 500 }
    )
  }
}

// DELETE signature (soft delete, or permanent delete via ?permanent=true)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get("permanent") === "true"

    if (permanent) {
      const existing = await prisma.signature.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Signature not found" }, { status: 404 })
      }
      if (!existing.deletedAt) {
        return NextResponse.json(
          { error: "Signature must be in trash before it can be permanently deleted" },
          { status: 400 }
        )
      }
      await prisma.signature.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    await prisma.signature.update({
      where: { id },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting signature:", error)
    return NextResponse.json(
      { error: "Failed to delete signature", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// PATCH restore signature
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    if (body.action === "restore") {
      await prisma.signature.update({
        where: { id },
        data: { deletedAt: null }
      })
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error restoring signature:", error)
    return NextResponse.json(
      { error: "Failed to restore signature" },
      { status: 500 }
    )
  }
}

