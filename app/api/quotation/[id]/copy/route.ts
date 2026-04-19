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

// POST copy quotation (generates new quotationId from max of quotation + paragon + erha)
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

    // Get the original quotation with all related data
    const originalQuotation = await prisma.quotation.findUnique({
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

    if (!originalQuotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      )
    }

    const year = new Date().getFullYear()

    // Generate new quotation ID from max across Quotation, Paragon, Erha (same as Paragon/Erha copy)
    const copiedQuotation = await prisma.$transaction(async (tx) => {
      const [latestQuotation, latestParagonQuotation, latestErhaQuotation] = await Promise.all([
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
        })
      ])

      const nextQuotationNum = Math.max(
        extractIdNumber(latestQuotation?.quotationId),
        extractIdNumber(latestParagonQuotation?.quotationId),
        extractIdNumber(latestErhaQuotation?.quotationId)
      ) + 1

      const newQuotationId = `QTN-${year}-${nextQuotationNum.toString().padStart(4, "0")}`

      const scaledItems = useDownPayment
        ? scaleItemsForDownPayment(originalQuotation.items, dpPercentage)
        : null

      return tx.quotation.create({
        data: {
          quotationId: newQuotationId,
        companyName: originalQuotation.companyName,
        companyAddress: originalQuotation.companyAddress,
        companyCity: originalQuotation.companyCity,
        companyProvince: originalQuotation.companyProvince,
        companyTelp: originalQuotation.companyTelp,
        companyEmail: originalQuotation.companyEmail,
        productionDate: originalQuotation.productionDate,
        billTo: `${originalQuotation.billTo} - Copy`,
        notes: originalQuotation.notes,
        billingName: originalQuotation.billingName,
        billingBankName: originalQuotation.billingBankName,
        billingBankAccount: originalQuotation.billingBankAccount,
        billingBankAccountName: originalQuotation.billingBankAccountName,
        billingKtp: originalQuotation.billingKtp,
        billingNpwp: originalQuotation.billingNpwp,
        signatureName: originalQuotation.signatureName,
        signatureRole: originalQuotation.signatureRole,
        signatureImageData: originalQuotation.signatureImageData,
        pph: originalQuotation.pph,
        totalAmount: useDownPayment
          ? sumScaledItemsTotal(scaledItems!)
          : originalQuotation.totalAmount,
        status: "draft", // Always create copy as draft
        items: {
          create: useDownPayment
            ? scaledItems!
            : originalQuotation.items.map(item => ({
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
          create: originalQuotation.remarks.map(remark => ({
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

    return NextResponse.json(copiedQuotation, { status: 201 })
  } catch (error) {
    console.error("Error copying quotation:", error)
    return NextResponse.json(
      { error: "Failed to copy quotation" },
      { status: 500 }
    )
  }
}
