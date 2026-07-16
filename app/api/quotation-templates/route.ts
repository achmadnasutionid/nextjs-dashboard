import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all quotation templates
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeDeleted = searchParams.get("includeDeleted") === "true"

    const templates = await prisma.quotationTemplate.findMany({
      where: includeDeleted ? {} : {
        deletedAt: null
      },
      include: {
        items: {
          include: {
            details: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching quotation templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch quotation templates" },
      { status: 500 }
    )
  }
}

// POST create new quotation template
export async function POST(request: Request) {
  try {
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

    // Check for duplicate name (excluding soft-deleted)
    const existing = await prisma.quotationTemplate.findFirst({
      where: { 
        name: body.name.trim(),
        deletedAt: null
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Template name already exists. Please use a different name." },
        { status: 400 }
      )
    }

    // Create template with items and details
    const template = await prisma.quotationTemplate.create({
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

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Error creating quotation template:", error)
    
    // Check if it's a Prisma unique constraint error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "Template name already exists. Please use a different name." },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create quotation template" },
      { status: 500 }
    )
  }
}
