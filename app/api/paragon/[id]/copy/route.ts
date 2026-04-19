import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  readCopyOptions,
  scaleItemsForDownPayment,
  sumScaledItemsTotal,
} from "@/lib/copy-down-payment"

function extractIdNumber(id: string | null | undefined): number {
  if (!id) return 0
  const parts = id.split("-")
  const num = parseInt(parts[2])
  return isNaN(num) ? 0 : num
}

// POST copy paragon ticket (generates new ticketId, quotationId, invoiceId)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const parsed = await readCopyOptions(request)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const copyOpts = parsed.value
    const useDownPayment = copyOpts.mode === "downPayment"
    const dpPercentage = useDownPayment ? copyOpts.percentage : 0

    const originalParagon = await prisma.paragonTicket.findUnique({
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

    if (!originalParagon) {
      return NextResponse.json(
        { error: "Paragon ticket not found" },
        { status: 404 }
      )
    }

    const year = new Date().getFullYear()

    const copiedParagon = await prisma.$transaction(async (tx) => {
      const [
        latestTicket,
        latestQuotation,
        latestParagonQuotation,
        latestErhaQuotation,
        latestInvoice,
        latestParagonInvoice,
        latestErhaInvoice
      ] = await Promise.all([
        tx.paragonTicket.findFirst({
          where: { ticketId: { startsWith: `PRG-${year}-` } },
          orderBy: { ticketId: "desc" },
          select: { ticketId: true }
        }),
        tx.quotation.findFirst({
          where: { quotationId: { startsWith: `QTN-${year}-` } },
          orderBy: { quotationId: "desc" },
          select: { quotationId: true }
        }),
        tx.paragonTicket.findFirst({
          where: { quotationId: { startsWith: `QTN-${year}-`, not: "" } },
          orderBy: { quotationId: "desc" },
          select: { quotationId: true }
        }),
        tx.erhaTicket.findFirst({
          where: { quotationId: { startsWith: `QTN-${year}-`, not: "" } },
          orderBy: { quotationId: "desc" },
          select: { quotationId: true }
        }),
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

      const nextTicketNum = extractIdNumber(latestTicket?.ticketId) + 1
      const nextQuotationNum = Math.max(
        extractIdNumber(latestQuotation?.quotationId),
        extractIdNumber(latestParagonQuotation?.quotationId),
        extractIdNumber(latestErhaQuotation?.quotationId)
      ) + 1
      const nextInvoiceNum = Math.max(
        extractIdNumber(latestInvoice?.invoiceId),
        extractIdNumber(latestParagonInvoice?.invoiceId),
        extractIdNumber(latestErhaInvoice?.invoiceId)
      ) + 1

      const ticketId = `PRG-${year}-${nextTicketNum.toString().padStart(4, "0")}`
      const quotationId = `QTN-${year}-${nextQuotationNum.toString().padStart(4, "0")}`
      const invoiceId = `INV-${year}-${nextInvoiceNum.toString().padStart(4, "0")}`

      const scaledItems = useDownPayment
        ? scaleItemsForDownPayment(originalParagon.items, dpPercentage)
        : null

      return tx.paragonTicket.create({
        data: {
          ticketId,
          quotationId,
          invoiceId,
          companyName: originalParagon.companyName,
        companyAddress: originalParagon.companyAddress,
        companyCity: originalParagon.companyCity,
        companyProvince: originalParagon.companyProvince,
          companyTelp: originalParagon.companyTelp,
          companyEmail: originalParagon.companyEmail,
          productionDate: originalParagon.productionDate,
          quotationDate: originalParagon.quotationDate,
          invoiceBastDate: originalParagon.invoiceBastDate,
          billTo: `${originalParagon.billTo} - Copy`,
          projectName: `${originalParagon.projectName} - Copy`,
          contactPerson: originalParagon.contactPerson,
          contactPosition: originalParagon.contactPosition,
          bastContactPerson: originalParagon.bastContactPerson,
          bastContactPosition: originalParagon.bastContactPosition,
          signatureName: originalParagon.signatureName,
          signatureRole: originalParagon.signatureRole,
          signatureImageData: originalParagon.signatureImageData,
          finalWorkImageData: originalParagon.finalWorkImageData,
          pph: originalParagon.pph,
          totalAmount: useDownPayment
            ? sumScaledItemsTotal(scaledItems!)
            : originalParagon.totalAmount,
          status: "draft",
          items: {
            create: useDownPayment
              ? scaledItems!
              : originalParagon.items.map(item => ({
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
            create: originalParagon.remarks.map(remark => ({
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

    return NextResponse.json(copiedParagon, { status: 201 })
  } catch (error) {
    console.error("Error copying paragon ticket:", error)
    return NextResponse.json(
      { error: "Failed to copy paragon ticket" },
      { status: 500 }
    )
  }
}
