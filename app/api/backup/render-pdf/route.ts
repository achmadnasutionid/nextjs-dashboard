import { NextResponse } from "next/server"
import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { QuotationBackupPDF } from "@/components/pdf/quotation-backup-pdf"
import { InvoiceBackupPDF } from "@/components/pdf/invoice-backup-pdf"

type DocType = "quotation" | "invoice"

/**
 * POST /api/backup/render-pdf – render a single document (from backup JSON) to PDF.
 * Body: { type: 'quotation' | 'invoice', data: { ... } }
 * Returns: PDF buffer (application/pdf). Used for "Download PDF" on restore preview.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const type = (body.type ?? "").toLowerCase() as DocType
    const data = body.data

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Missing or invalid data" }, { status: 400 })
    }

    // Ensure date fields are strings for PDF components
    const normalized = {
      ...data,
      productionDate: typeof data.productionDate === "string" ? data.productionDate : data.productionDate ? new Date(data.productionDate).toISOString() : new Date().toISOString(),
      createdAt: typeof data.createdAt === "string" ? data.createdAt : (data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()),
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : (data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString()),
    }

    if (type === "quotation") {
      const el = React.createElement(QuotationBackupPDF, { data: normalized })
      const buffer = await renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
      const filename = `${normalized.quotationId ?? "quotation"}.pdf`
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    if (type === "invoice") {
      const el = React.createElement(InvoiceBackupPDF, { data: normalized })
      const buffer = await renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
      const filename = `${normalized.invoiceId ?? "invoice"}.pdf`
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ error: "Unsupported type. Use quotation or invoice." }, { status: 400 })
  } catch (e) {
    console.error("Render PDF failed:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Render failed" },
      { status: 500 }
    )
  }
}
