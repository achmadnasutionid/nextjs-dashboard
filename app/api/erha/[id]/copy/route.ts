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
import { invalidateErhaCaches } from "@/lib/cache-invalidation"

function extractIdNumber(id: string | null | undefined): number {
  if (!id) return 0
  const parts = id.split("-")
  const num = parseInt(parts[2])
  return isNaN(num) ? 0 : num
}

// POST copy erha ticket (generates new ticketId, quotationId, invoiceId)
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

    const originalErha = await prisma.erhaTicket.findUnique({
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

    if (!originalErha) {
      return NextResponse.json(
        { error: "Erha ticket not found" },
        { status: 404 }
      )
    }

    const year = new Date().getFullYear()

    const copiedErha = await prisma.$transaction(async (tx) => {
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
        tx.erhaTicket.findFirst({
          where: { ticketId: { startsWith: `ERH-${year}-` } },
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

      const ticketId = `ERH-${year}-${nextTicketNum.toString().padStart(4, "0")}`
      const quotationId = `QTN-${year}-${nextQuotationNum.toString().padStart(4, "0")}`
      const invoiceId = `INV-${year}-${nextInvoiceNum.toString().padStart(4, "0")}`

      const scaledItems = useDownPayment
        ? scaleItemsForDownPayment(originalErha.items, dpPercentage)
        : null

      const created = await tx.erhaTicket.create({
        data: {
          ticketId,
          quotationId,
          invoiceId,
          companyName: originalErha.companyName,
          companyAddress: originalErha.companyAddress,
          companyCity: originalErha.companyCity,
          companyProvince: originalErha.companyProvince,
          companyTelp: originalErha.companyTelp,
          companyEmail: originalErha.companyEmail,
          productionDate: originalErha.productionDate,
          quotationDate: originalErha.quotationDate,
          invoiceBastDate: originalErha.invoiceBastDate,
          billTo: `${originalErha.billTo}${copyDocumentLabelSuffix(useDownPayment, dpPercentage)}`,
          projectName: `${originalErha.projectName}${copyDocumentLabelSuffix(useDownPayment, dpPercentage)}`,
          billToAddress: originalErha.billToAddress,
          contactPerson: originalErha.contactPerson,
          contactPosition: originalErha.contactPosition,
          bastContactPerson: originalErha.bastContactPerson,
          bastContactPosition: originalErha.bastContactPosition,
          billingName: originalErha.billingName,
          billingBankName: originalErha.billingBankName,
          billingBankAccount: originalErha.billingBankAccount,
          billingBankAccountName: originalErha.billingBankAccountName,
          billingKtp: originalErha.billingKtp,
          billingNpwp: originalErha.billingNpwp,
          signatureName: originalErha.signatureName,
          signatureRole: originalErha.signatureRole,
          signatureImageData: originalErha.signatureImageData,
          finalWorkImageData: originalErha.finalWorkImageData,
          pph: originalErha.pph,
          totalAmount: useDownPayment
            ? sumScaledItemsTotal(scaledItems!)
            : originalErha.totalAmount,
          status: "draft",
          items: {
            create: useDownPayment
              ? scaledItems!
              : originalErha.items.map(item => ({
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
            create: originalErha.remarks.map(remark => ({
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
          const maxOrder = originalErha.items.length
            ? Math.max(...originalErha.items.map((i) => i.order))
            : 0
          const ded = downPaymentDeductionLineCreate(
            dpNet,
            dpPercentage,
            quotationId
          )
          await tx.erhaTicketItem.create({
            data: {
              ticketId: id,
              order: maxOrder + 1,
              productName: ded.productName,
              total: ded.total,
              details: ded.details,
            },
          })
          const oldSub = originalErha.items.reduce((s, i) => s + i.total, 0)
          const newSub = oldSub - dpNet
          await tx.erhaTicket.update({
            where: { id },
            data: {
              totalAmount: grandTotalFromSubtotalAndPph(
                newSub,
                originalErha.pph
              ),
            },
          })
        }
      }

      return created
    })

    if (useDownPayment) {
      await Promise.all([
        invalidateErhaCaches(id),
        invalidateErhaCaches(copiedErha.id),
      ])
    }

    return NextResponse.json(copiedErha, { status: 201 })
  } catch (error) {
    console.error("Error copying erha ticket:", error)
    return NextResponse.json(
      { error: "Failed to copy erha ticket" },
      { status: 500 }
    )
  }
}
