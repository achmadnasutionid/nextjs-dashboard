import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT rt.id, rt.name, rt."deletedAt", rt."createdAt", rt."updatedAt",
        COALESCE(
          json_agg(json_build_object('id', rti.id, 'templateId', rti."templateId", 'text', rti.text, 'order', rti."order") ORDER BY rti."order")
          FILTER (WHERE rti.id IS NOT NULL), '[]'::json
        ) AS items
      FROM "RemarkTemplate" rt
      LEFT JOIN "RemarkTemplateItem" rti ON rti."templateId" = rt.id
      WHERE rt.id = $1 AND rt."deletedAt" IS NULL
      GROUP BY rt.id
    `, id)
    if (rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error("Error fetching remark template:", error)
    return NextResponse.json({ error: "Failed to fetch remark template" }, { status: 500 })
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

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "RemarkTemplate" WHERE name = $1 AND "deletedAt" IS NULL AND id != $2 LIMIT 1`,
      name.trim(), id
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: "Template name already exists" }, { status: 400 })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "RemarkTemplate" SET name = $1, "updatedAt" = NOW() WHERE id = $2`,
      name.trim(), id
    )
    await prisma.$executeRawUnsafe(
      `DELETE FROM "RemarkTemplateItem" WHERE "templateId" = $1`,
      id
    )

    const itemList: string[] = (items as string[] || []).filter(Boolean)
    for (let i = 0; i < itemList.length; i++) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RemarkTemplateItem" (id, "templateId", text, "order", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        crypto.randomUUID(), id, itemList[i], i
      )
    }

    const [template] = await prisma.$queryRawUnsafe<any[]>(`
      SELECT rt.id, rt.name, rt."deletedAt", rt."createdAt", rt."updatedAt",
        COALESCE(
          json_agg(json_build_object('id', rti.id, 'templateId', rti."templateId", 'text', rti.text, 'order', rti."order") ORDER BY rti."order")
          FILTER (WHERE rti.id IS NOT NULL), '[]'::json
        ) AS items
      FROM "RemarkTemplate" rt
      LEFT JOIN "RemarkTemplateItem" rti ON rti."templateId" = rt.id
      WHERE rt.id = $1
      GROUP BY rt.id
    `, id)

    return NextResponse.json(template)
  } catch (error) {
    console.error("Error updating remark template:", error)
    return NextResponse.json({ error: "Failed to update remark template" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.$executeRawUnsafe(
      `UPDATE "RemarkTemplate" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
      id
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting remark template:", error)
    return NextResponse.json({ error: "Failed to delete remark template" }, { status: 500 })
  }
}
