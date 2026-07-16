import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET single template
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    const template = await prisma.quotationTemplate.findUnique({
      where: {
        id: params.id
      },
      include: {
        items: {
          include: {
            details: true
          }
        }
      }
    })

    // Check if template exists and is not soft-deleted
    if (!template || template.deletedAt !== null) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error("[GET Template] Error fetching template:", error)
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    )
  }
}

// PUT update template
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()

    // Validation
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      )
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "At least one product item is required" },
        { status: 400 }
      )
    }

    // Check for duplicate name (excluding current template and soft-deleted)
    const existing = await prisma.quotationTemplate.findFirst({
      where: { 
        name: body.name.trim(),
        deletedAt: null,
        NOT: { id: params.id }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Template name already exists" },
        { status: 400 }
      )
    }

    // Delete existing items and remarks, then recreate
    await prisma.quotationTemplate.update({
      where: { id: params.id },
      data: {
        items: {
          deleteMany: {}
        }
      }
    })

    // Update template with new data
    const template = await prisma.quotationTemplate.update({
      where: { id: params.id },
      data: {
        name: body.name.trim(),
        items: {
          create: body.items?.map((item: any) => ({
            productName: item.productName,
            details: {
              create: item.details?.map((detail: any) => ({
                detail: detail.detail,
                unitPrice: parseFloat(detail.unitPrice) || 0,
                qty: parseFloat(detail.qty) || 0
              })) || []
            }
          })) || []
        }
      },
      include: {
        items: {
          include: {
            details: true
          }
        }
      }
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template" },
      { status: 500 }
    )
  }
}

// DELETE soft delete template, or permanent delete via ?permanent=true
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get("permanent") === "true"

    if (permanent) {
      const existing = await prisma.quotationTemplate.findUnique({ where: { id: params.id } })
      if (!existing) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }
      if (!existing.deletedAt) {
        return NextResponse.json(
          { error: "Template must be in trash before it can be permanently deleted" },
          { status: 400 }
        )
      }
      await prisma.quotationTemplate.delete({ where: { id: params.id } })
      return NextResponse.json({ success: true })
    }

    await prisma.quotationTemplate.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}

// PATCH restore template
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()

    if (body.action === "restore") {
      await prisma.quotationTemplate.update({
        where: { id: params.id },
        data: { deletedAt: null }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error restoring template:", error)
    return NextResponse.json(
      { error: "Failed to restore template" },
      { status: 500 }
    )
  }
}
