import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET single product (excluding soft-deleted)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        details: {
          where: { deletedAt: null }, // Also exclude soft-deleted details
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error("Error fetching product:", error)
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    )
  }
}

// PUT update product
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, details } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      )
    }

    // Check for duplicate name (excluding current product and soft-deleted)
    const existing = await prisma.product.findFirst({
      where: {
        name: name.trim().toUpperCase(),
        deletedAt: null,
        NOT: { id }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Product name already exists" },
        { status: 400 }
      )
    }

    // Delete existing details and create new ones
    await prisma.productDetail.deleteMany({
      where: { productId: id }
    })

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name.trim().toUpperCase(),
        details: details && Array.isArray(details) ? {
          create: details.map((detail: any) => ({
            detail: detail.detail,
            unitPrice: detail.unitPrice,
            qty: detail.qty
          }))
        } : undefined
      },
      include: {
        details: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Error updating product:", error)
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    )
  }
}

// DELETE product (soft delete with details, or permanent delete via ?permanent=true)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get("permanent") === "true"

    if (permanent) {
      const existing = await prisma.product.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }
      if (!existing.deletedAt) {
        return NextResponse.json(
          { error: "Product must be in trash before it can be permanently deleted" },
          { status: 400 }
        )
      }
      await prisma.$transaction([
        prisma.productDetail.deleteMany({ where: { productId: id } }),
        prisma.product.delete({ where: { id } })
      ])
      return NextResponse.json({ success: true })
    }

    const now = new Date()

    // Soft-delete both product and its details in transaction
    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { deletedAt: now }
      }),
      prisma.productDetail.updateMany({
        where: { productId: id },
        data: { deletedAt: now }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product:", error)
    return NextResponse.json(
      { error: "Failed to delete product", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// PATCH restore product (with details)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    if (body.action === "restore") {
      // Restore both product and its details in transaction
      await prisma.$transaction([
        prisma.product.update({
          where: { id },
          data: { deletedAt: null }
        }),
        prisma.productDetail.updateMany({
          where: { productId: id },
          data: { deletedAt: null }
        })
      ])
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error restoring product:", error)
    return NextResponse.json(
      { error: "Failed to restore product" },
      { status: 500 }
    )
  }
}

