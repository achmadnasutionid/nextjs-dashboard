import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function extractIdNumber(id: string | null | undefined): number {
  if (!id) return 0
  const parts = id.split("-")
  const num = parseInt(parts[2])
  return isNaN(num) ? 0 : num
}

// POST copy invoice (generates new invoiceId from max of invoice + paragon + erha)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get the original invoice with all related data
    const originalInvoice = await prisma.invoice.findUnique({
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

    if (!originalInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    const year = new Date().getFullYear()

    // Generate new invoice ID from max across Invoice, Paragon, Erha (same as Paragon/Erha copy)
    const copiedInvoice = await prisma.$transaction(async (tx) => {
      const [latestInvoice, latestParagonInvoice, latestErhaInvoice] = await Promise.all([
        tx.invoice.findFirst({
          where: { invoiceId: { startsWith: `INV-${year}-` } },
          orderBy: { invoiceId: "desc" },
          select: { invoiceId: true }
        }),
        tx.paragonTicket.findFirst({
          where: { invoiceId: { startsWith: `INV-${year}-`, not: "" } },
          orderBy: { invoiceId: "desc" },
          select: { invoiceId: true }
        }),
        tx.erhaTicket.findFirst({
          where: { invoiceId: { startsWith: `INV-${year}-`, not: "" } },
          orderBy: { invoiceId: "desc" },
          select: { invoiceId: true }
        })
      ])

      const nextInvoiceNum = Math.max(
        extractIdNumber(latestInvoice?.invoiceId),
        extractIdNumber(latestParagonInvoice?.invoiceId),
        extractIdNumber(latestErhaInvoice?.invoiceId)
      ) + 1

      const newInvoiceId = `INV-${year}-${nextInvoiceNum.toString().padStart(4, "0")}`

      return tx.invoice.create({
        data: {
          invoiceId: newInvoiceId,
        companyName: originalInvoice.companyName,
        companyAddress: originalInvoice.companyAddress,
        companyCity: originalInvoice.companyCity,
        companyProvince: originalInvoice.companyProvince,
        companyPostalCode: originalInvoice.companyPostalCode,
        companyTelp: originalInvoice.companyTelp,
        companyEmail: originalInvoice.companyEmail,
        productionDate: originalInvoice.productionDate,
        billTo: `${originalInvoice.billTo} - Copy`,
        notes: originalInvoice.notes,
        billingName: originalInvoice.billingName,
        billingBankName: originalInvoice.billingBankName,
        billingBankAccount: originalInvoice.billingBankAccount,
        billingBankAccountName: originalInvoice.billingBankAccountName,
        billingKtp: originalInvoice.billingKtp,
        billingNpwp: originalInvoice.billingNpwp,
        signatureName: originalInvoice.signatureName,
        signatureRole: originalInvoice.signatureRole,
        signatureImageData: originalInvoice.signatureImageData,
        pph: originalInvoice.pph,
        totalAmount: originalInvoice.totalAmount,
        status: "draft", // Always create copy as draft
        items: {
          create: originalInvoice.items.map(item => ({
            productName: item.productName,
            total: item.total,
            details: {
              create: item.details.map(detail => ({
                detail: detail.detail,
                unitPrice: detail.unitPrice,
                qty: detail.qty,
                amount: detail.amount
              }))
            }
          }))
        },
        remarks: {
          create: originalInvoice.remarks.map(remark => ({
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
    })

    return NextResponse.json(copiedInvoice, { status: 201 })
  } catch (error) {
    console.error("Error copying invoice:", error)
    return NextResponse.json(
      { error: "Failed to copy invoice" },
      { status: 500 }
    )
  }
}
