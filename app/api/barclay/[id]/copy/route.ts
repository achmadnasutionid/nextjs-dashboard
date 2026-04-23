import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  readCopyOptions,
  scaleItemsForDownPayment,
  sumScaledItemsTotal,
  copyDocumentLabelSuffix,
  grandTotalFromSubtotalAndPph,
  downPaymentDeductionLineCreate,
} from "@/lib/copy-down-payment"
import { invalidateBarclayCaches } from "@/lib/cache-invalidation"

function extractIdNumber(id: string | null | undefined): number {
  if (!id) return 0
  const parts = id.split("-")
  const num = parseInt(parts[2])
  return isNaN(num) ? 0 : num
}

// POST copy barclay ticket (generates new ticketId, quotationId, invoiceId)
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

    const originalBarclay = await prisma.barclayTicket.findUnique({
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

    if (!originalBarclay) {
      return NextResponse.json(
        { error: "Barclay ticket not found" },
        { status: 404 }
      )
    }

    const year = new Date().getFullYear()

    const copiedBarclay = await prisma.$transaction(async (tx) => {
      const [
        latestTicket,
        latestQuotation,
        latestParagonQuotation,
        latestBarclayQuotation,
        latestErhaQuotation,
        latestInvoice,
        latestParagonInvoice,
        latestBarclayInvoice,
        latestErhaInvoice
      ] = await Promise.all([
        tx.barclayTicket.findFirst({
          where: { ticketId: { startsWith: `BRC-${year}-` } },
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
        tx.barclayTicket.findFirst({
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
        tx.barclayTicket.findFirst({
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
        extractIdNumber(latestBarclayQuotation?.quotationId),
        extractIdNumber(latestErhaQuotation?.quotationId)
      ) + 1
      const nextInvoiceNum = Math.max(
        extractIdNumber(latestInvoice?.invoiceId),
        extractIdNumber(latestParagonInvoice?.invoiceId),
        extractIdNumber(latestBarclayInvoice?.invoiceId),
        extractIdNumber(latestErhaInvoice?.invoiceId)
      ) + 1

      const ticketId = `BRC-${year}-${nextTicketNum.toString().padStart(4, "0")}`
      const quotationId = `QTN-${year}-${nextQuotationNum.toString().padStart(4, "0")}`
      const invoiceId = `INV-${year}-${nextInvoiceNum.toString().padStart(4, "0")}`

      const scaledItems = useDownPayment
        ? scaleItemsForDownPayment(originalBarclay.items, dpPercentage)
        : null

      const created = await tx.barclayTicket.create({
        data: {
          ticketId,
          quotationId,
          invoiceId,
          companyName: originalBarclay.companyName,
        companyAddress: originalBarclay.companyAddress,
        companyCity: originalBarclay.companyCity,
        companyProvince: originalBarclay.companyProvince,
          companyTelp: originalBarclay.companyTelp,
          companyEmail: originalBarclay.companyEmail,
          productionDate: originalBarclay.productionDate,
          quotationDate: originalBarclay.quotationDate,
          invoiceBastDate: originalBarclay.invoiceBastDate,
          billTo: `${originalBarclay.billTo}${copyDocumentLabelSuffix(useDownPayment, dpPercentage)}`,
          projectName: `${originalBarclay.projectName}${copyDocumentLabelSuffix(useDownPayment, dpPercentage)}`,
          contactPerson: originalBarclay.contactPerson,
          contactPosition: originalBarclay.contactPosition,
          bastContactPerson: originalBarclay.bastContactPerson,
          bastContactPosition: originalBarclay.bastContactPosition,
          signatureName: originalBarclay.signatureName,
          signatureRole: originalBarclay.signatureRole,
          signatureImageData: originalBarclay.signatureImageData,
          finalWorkImageData: originalBarclay.finalWorkImageData,
          finalWorkDriveLink: originalBarclay.finalWorkDriveLink,
          pph: originalBarclay.pph,
          totalAmount: useDownPayment
            ? sumScaledItemsTotal(scaledItems!)
            : originalBarclay.totalAmount,
          status: "draft",
          items: {
            create: useDownPayment
              ? scaledItems!
              : originalBarclay.items.map(item => ({
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
            create: originalBarclay.remarks.map(remark => ({
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

      if (useDownPayment && scaledItems) {
        const dpNet = sumScaledItemsTotal(scaledItems)
        if (dpNet > 0) {
          const maxOrder = originalBarclay.items.length
            ? Math.max(...originalBarclay.items.map((i) => i.order))
            : 0
          const ded = downPaymentDeductionLineCreate(
            dpNet,
            dpPercentage,
            quotationId
          )
          await tx.barclayTicketItem.create({
            data: {
              ticketId: id,
              order: maxOrder + 1,
              productName: ded.productName,
              total: ded.total,
              details: ded.details,
            },
          })
          const oldSub = originalBarclay.items.reduce((s, i) => s + i.total, 0)
          const newSub = oldSub - dpNet
          await tx.barclayTicket.update({
            where: { id },
            data: {
              totalAmount: grandTotalFromSubtotalAndPph(
                newSub,
                originalBarclay.pph
              ),
            },
          })
        }
      }

      return created
    })

    if (useDownPayment) {
      await Promise.all([
        invalidateBarclayCaches(id),
        invalidateBarclayCaches(copiedBarclay.id),
      ])
    }

    return NextResponse.json(copiedBarclay, { status: 201 })
  } catch (error) {
    console.error("Error copying barclay ticket:", error)
    return NextResponse.json(
      { error: "Failed to copy barclay ticket" },
      { status: 500 }
    )
  }
}

