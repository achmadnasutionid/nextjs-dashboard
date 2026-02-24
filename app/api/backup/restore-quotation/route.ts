import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { invalidateQuotationCaches } from "@/lib/cache-invalidation"

/**
 * POST /api/backup/restore-quotation – create a quotation from backup JSON (e.g. from Drive).
 * Body: backup JSON (quotationId, companyName, items, remarks, signatures, ...).
 * Fails with 409 if a quotation with that quotationId already exists.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const quotationId = body.quotationId?.trim()
    if (!quotationId) {
      return NextResponse.json({ error: "Missing quotationId in backup data" }, { status: 400 })
    }

    const existing = await prisma.quotation.findUnique({
      where: { quotationId },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: `A quotation with ID ${quotationId} already exists. Cannot restore to avoid overwriting.` },
        { status: 409 }
      )
    }

    const productionDate = body.productionDate ? new Date(body.productionDate) : new Date()
    const quotation = await prisma.quotation.create({
      data: {
        quotationId,
        companyName: body.companyName ?? "",
        companyAddress: body.companyAddress ?? "",
        companyCity: body.companyCity ?? "",
        companyProvince: body.companyProvince ?? "",
        companyPostalCode: body.companyPostalCode ?? null,
        companyTelp: body.companyTelp ?? null,
        companyEmail: body.companyEmail ?? null,
        productionDate,
        billTo: body.billTo ?? "",
        notes: body.notes ?? null,
        billingName: body.billingName ?? "",
        billingBankName: body.billingBankName ?? "",
        billingBankAccount: body.billingBankAccount ?? "",
        billingBankAccountName: body.billingBankAccountName ?? "",
        signatureName: body.signatureName ?? "",
        signatureRole: body.signatureRole ?? null,
        signatureImageData: body.signatureImageData ?? "",
        pph: body.pph ?? "0",
        totalAmount: body.totalAmount != null ? Number(body.totalAmount) : 0,
        summaryOrder: body.summaryOrder ?? "subtotal,pph,total",
        termsAndConditions: body.termsAndConditions ?? null,
        status: body.status ?? "pending",
        items: {
          create: (body.items ?? []).map((item: { productName?: string; total?: number; details?: Array<{ detail?: string; unitPrice?: number; qty?: number; amount?: number }> }, order: number) => ({
            productName: item.productName ?? "",
            total: item.total != null ? Number(item.total) : 0,
            order,
            details: {
              create: (item.details ?? []).map((d: { detail?: string; unitPrice?: number; qty?: number; amount?: number }) => ({
                detail: d.detail ?? "",
                unitPrice: d.unitPrice != null ? Number(d.unitPrice) : 0,
                qty: d.qty != null ? Number(d.qty) : 0,
                amount: d.amount != null ? Number(d.amount) : 0,
              })),
            },
          })),
        },
        remarks: {
          create: (body.remarks ?? []).map((r: { text?: string; isCompleted?: boolean }, order: number) => ({
            text: r.text ?? "",
            isCompleted: !!r.isCompleted,
            order,
          })),
        },
        signatures: {
          create: (body.signatures ?? []).map((s: { name?: string; position?: string; imageData?: string }, order: number) => ({
            name: s.name ?? "",
            position: s.position ?? "",
            imageData: s.imageData ?? "",
            order,
          })),
        },
      },
      include: {
        items: { include: { details: true } },
        remarks: true,
        signatures: true,
      },
    })

    await invalidateQuotationCaches()
    return NextResponse.json(quotation, { status: 201 })
  } catch (e) {
    console.error("Restore quotation failed:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Restore failed" },
      { status: 500 }
    )
  }
}
