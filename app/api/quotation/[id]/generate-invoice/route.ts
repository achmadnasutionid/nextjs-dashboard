import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateId } from "@/lib/id-generator"
import { invalidateInvoiceCaches, invalidateQuotationCaches } from "@/lib/cache-invalidation"

// POST - Generate invoice from quotation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch the quotation
    const quotation = await prisma.quotation.findUnique({
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

    if (!quotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      )
    }

    // Check if quotation is accepted
    if (quotation.status !== "accepted") {
      return NextResponse.json(
        { error: "Only accepted quotations can generate invoice" },
        { status: 400 }
      )
    }

    // If we have a linked invoice, verify it still exists (e.g. not deleted)
    if (quotation.generatedInvoiceId) {
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id: quotation.generatedInvoiceId }
      })
      if (existingInvoice) {
        return NextResponse.json(existingInvoice, { status: 200 })
      }
      // Invoice was deleted: fall through to create a new one and update the link
    }

    // Generate Invoice ID using centralized generator (prevents race conditions)
    const invoiceId = await generateId('INV', 'invoice')

    // Calculate paidDate: productionDate + 7 days
    const paidDate = new Date(quotation.productionDate)
    paidDate.setDate(paidDate.getDate() + 7)

    // Create invoice by copying all quotation data
    const invoice = await prisma.invoice.create({
      data: {
        invoiceId,
        companyName: quotation.companyName,
        companyAddress: quotation.companyAddress,
        companyCity: quotation.companyCity,
        companyProvince: quotation.companyProvince,
        companyPostalCode: quotation.companyPostalCode,
        companyTelp: quotation.companyTelp,
        companyEmail: quotation.companyEmail,
        productionDate: quotation.productionDate,
        paidDate: paidDate,
        billTo: quotation.billTo,
        notes: quotation.notes,
        billingName: quotation.billingName,
        billingBankName: quotation.billingBankName,
        billingBankAccount: quotation.billingBankAccount,
        billingBankAccountName: quotation.billingBankAccountName,
        billingKtp: quotation.billingKtp,
        billingNpwp: quotation.billingNpwp,
        signatureName: quotation.signatureName,
        signatureRole: quotation.signatureRole,
        signatureImageData: quotation.signatureImageData,
        pph: quotation.pph,
        totalAmount: quotation.totalAmount,
        status: "pending",
        items: {
          create: quotation.items.map((item) => ({
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
          create: quotation.remarks.map((remark) => ({
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

    // Update quotation with generated invoice ID
    await prisma.quotation.update({
      where: { id },
      data: { generatedInvoiceId: invoice.id }
    })

    // Invalidate caches for both quotation and invoice
    await Promise.all([
      invalidateQuotationCaches(id),
      invalidateInvoiceCaches(invoice.id)
    ])

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error("Error generating invoice:", error)
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    )
  }
}

