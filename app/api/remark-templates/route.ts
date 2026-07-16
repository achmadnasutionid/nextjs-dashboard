import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeDeleted = searchParams.get("includeDeleted") === "true"
    const whereClause = includeDeleted ? "" : `WHERE rt."deletedAt" IS NULL`

    const templates = await prisma.$queryRawUnsafe<any[]>(`
      SELECT rt.id, rt.name, rt."deletedAt", rt."createdAt", rt."updatedAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', rti.id,
              'templateId', rti."templateId",
              'text', rti.text,
              'order', rti."order",
              'createdAt', rti."createdAt",
              'updatedAt', rti."updatedAt"
            ) ORDER BY rti."order"
          ) FILTER (WHERE rti.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM "RemarkTemplate" rt
      LEFT JOIN "RemarkTemplateItem" rti ON rti."templateId" = rt.id
      ${whereClause}
      GROUP BY rt.id
      ORDER BY rt."createdAt" ASC
    `)
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

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "RemarkTemplate" WHERE name = $1 AND "deletedAt" IS NULL LIMIT 1`,
      name.trim()
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: "Template name already exists" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RemarkTemplate" (id, name, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())`,
      id, name.trim()
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

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Error creating remark template:", error)
    return NextResponse.json(
      { error: "Failed to create remark template" },
      { status: 500 }
    )
  }
}
