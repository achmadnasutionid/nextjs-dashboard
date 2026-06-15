import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const templates = await prisma.remarkTemplate.findMany({
      where: { deletedAt: null },
      include: {
        items: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching remark templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch remark templates" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, items } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const existing = await prisma.remarkTemplate.findFirst({
      where: { name: name.trim(), deletedAt: null },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Template name already exists" },
        { status: 400 }
      )
    }

    const template = await prisma.remarkTemplate.create({
      data: {
        name: name.trim(),
        items: {
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

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Error creating remark template:", error)
    return NextResponse.json(
      { error: "Failed to create remark template" },
      { status: 500 }
    )
  }
}
