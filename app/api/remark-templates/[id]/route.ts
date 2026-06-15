import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const template = await prisma.remarkTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { order: "asc" } } },
    })
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(template)
  } catch (error) {
    console.error("Error fetching remark template:", error)
    return NextResponse.json(
      { error: "Failed to fetch remark template" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, items } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const existing = await prisma.remarkTemplate.findFirst({
      where: { name: name.trim(), deletedAt: null, NOT: { id } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Template name already exists" },
        { status: 400 }
      )
    }

    const template = await prisma.remarkTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        items: {
          deleteMany: {},
          create: (items as string[] || []).map((text, index) => ({
            text,
            order: index,
          })),
        },
      },
      include: {
        items: { orderBy: { order: "asc" } },
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error("Error updating remark template:", error)
    return NextResponse.json(
      { error: "Failed to update remark template" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.remarkTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting remark template:", error)
    return NextResponse.json(
      { error: "Failed to delete remark template" },
      { status: 500 }
    )
  }
}
