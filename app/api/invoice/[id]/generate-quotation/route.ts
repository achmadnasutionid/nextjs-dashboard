import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateId } from "@/lib/id-generator"
import { invalidateInvoiceCaches, invalidateQuotationCaches } from "@/lib/cache-invalidation"

// POST - Generate quotation from invoice (for invoices created by mistake instead of a quotation)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            details: true
          }
        },
        remarks: true
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // If we have a linked quotation, verify it still exists (e.g. not deleted)
    if (invoice.generatedQuotationId) {
      const existingQuotation = await prisma.quotation.findUnique({
        where: { id: invoice.generatedQuotationId }
      })
      if (existingQuotation) {
        return NextResponse.json(existingQuotation, { status: 200 })
      }
      // Quotation was deleted: fall through to create a new one and update the link
    }

    // Generate Quotation ID using centralized generator (prevents race conditions)
    const quotationId = await generateId('QTN', 'quotation')

    // Create quotation by copying all invoice data
    const quotation = await prisma.quotation.create({
      data: {
        quotationId,
        companyName: invoice.companyName,
        companyAddress: invoice.companyAddress,
        companyCity: invoice.companyCity,
        companyProvince: invoice.companyProvince,
        companyPostalCode: invoice.companyPostalCode,
        companyTelp: invoice.companyTelp,
        companyEmail: invoice.companyEmail,
        productionDate: invoice.productionDate,
        billTo: invoice.billTo,
        billToEmail: invoice.billToEmail,
        notes: invoice.notes,
        billingName: invoice.billingName,
        billingBankName: invoice.billingBankName,
        billingBankAccount: invoice.billingBankAccount,
        billingBankAccountName: invoice.billingBankAccountName,
        billingKtp: invoice.billingKtp,
        billingNpwp: invoice.billingNpwp,
        signatureName: invoice.signatureName,
        signatureRole: invoice.signatureRole,
        signatureImageData: invoice.signatureImageData,
        summaryOrder: invoice.summaryOrder,
        downPaymentPercentage: invoice.downPaymentPercentage,
        termsAndConditions: invoice.termsAndConditions,
        pph: invoice.pph,
        pphDeduction: invoice.pphDeduction,
        totalAmount: invoice.totalAmount,
        status: "draft",
        sourceInvoiceId: invoice.id,
        items: {
          create: invoice.items.map((item) => ({
            productName: item.productName,
            total: item.total,
            details: {
              create: item.details.map((detail) => ({
                detail: detail.detail,
                unitPrice: detail.unitPrice,
                qty: detail.qty,
                amount: detail.amount
              }))
            }
          }))
        },
        remarks: {
          create: invoice.remarks.map((remark) => ({
            text: remark.text,
            isCompleted: remark.isCompleted
          }))
        }
      },
      include: {
        items: {
          include: {
            details: true
          }
        },
        remarks: true
      }
    })

    // Update invoice with generated quotation ID
    await prisma.invoice.update({
      where: { id },
      data: { generatedQuotationId: quotation.id }
    })

    // Invalidate caches for both invoice and quotation
    await Promise.all([
      invalidateInvoiceCaches(id),
      invalidateQuotationCaches(quotation.id)
    ])

    return NextResponse.json(quotation, { status: 201 })
  } catch (error) {
    console.error("Error generating quotation:", error)
    return NextResponse.json(
      { error: "Failed to generate quotation" },
      { status: 500 }
    )
  }
}
