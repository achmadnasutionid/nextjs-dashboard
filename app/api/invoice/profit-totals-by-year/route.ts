import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Match tracker page: PHOTOGRAPHER is first; rest are expense columns
const EXPENSE_PRODUCTS = [
  "PROPS/SET",
  "VIDEOGRAPHER",
  "RETOUCHER",
  "MUA HAIR",
  "MODEL/HANDMODEL",
  "STUDIO/LIGHTING",
  "FASHION STYLIST",
  "GRAFFER",
  "MANAGER",
  "FOOD & DRINK",
  "ACCOMMODATION",
  "PRINT",
]

function expenseFromProductAmounts(productAmounts: Record<string, number> | null): number {
  if (!productAmounts || typeof productAmounts !== "object") return 0
  return EXPENSE_PRODUCTS.reduce((sum, key) => sum + (Number(productAmounts[key]) || 0), 0)
}

function photographerFromTracker(totalAmount: number, productAmounts: Record<string, number> | null): number {
  const expense = expenseFromProductAmounts(productAmounts)
  return Math.max(0, totalAmount - expense)
}

/**
 * GET profit totals by year: for each paid invoice (Invoice paid + Paragon/Erha final),
 * look up tracker by invoiceId and sum tracker "photographer" (totalAmount - expense) by year.
 * Returns { years, byYear, missingIds }.
 * missingIds = document IDs that are paid but have no matching tracker (for redirect card).
 */
export async function GET() {
  try {
    const [invoices, paragon, erha, trackers] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: "paid", deletedAt: null },
        select: { invoiceId: true, productionDate: true },
      }),
      prisma.paragonTicket.findMany({
        where: { status: "final", deletedAt: null },
        select: { invoiceId: true, productionDate: true },
      }),
      prisma.erhaTicket.findMany({
        where: { status: "final", deletedAt: null },
        select: { invoiceId: true, productionDate: true },
      }),
      prisma.productionTracker.findMany({
        where: { deletedAt: null },
        select: { invoiceId: true, totalAmount: true, productAmounts: true, date: true },
      }),
    ])

    const trackerByInvoiceId = new Map<string, { totalAmount: number; productAmounts: Record<string, number> | null; date: Date }>()
    trackers.forEach((t) => {
      if (t.invoiceId && t.invoiceId.trim()) {
        trackerByInvoiceId.set(t.invoiceId.trim(), {
          totalAmount: t.totalAmount,
          productAmounts: (t.productAmounts as Record<string, number>) || null,
          date: t.date,
        })
      }
    })

    const byYear: Record<string, number> = {}
    const missingIds: string[] = []

    const addProfit = (date: Date | null, amount: number) => {
      const year = date ? new Date(date).getFullYear() : new Date().getFullYear()
      byYear[year] = (byYear[year] ?? 0) + amount
    }

    for (const r of invoices) {
      const id = r.invoiceId?.trim()
      if (!id) continue
      const tracker = trackerByInvoiceId.get(id)
      if (tracker) {
        const photographer = photographerFromTracker(tracker.totalAmount, tracker.productAmounts)
        addProfit(r.productionDate, photographer)
      } else {
        if (!missingIds.includes(id)) missingIds.push(id)
      }
    }

    for (const r of paragon) {
      const id = r.invoiceId?.trim()
      if (!id) continue
      const tracker = trackerByInvoiceId.get(id)
      if (tracker) {
        const photographer = photographerFromTracker(tracker.totalAmount, tracker.productAmounts)
        addProfit(r.productionDate, photographer)
      } else {
        if (!missingIds.includes(id)) missingIds.push(id)
      }
    }

    for (const r of erha) {
      const id = r.invoiceId?.trim()
      if (!id) continue
      const tracker = trackerByInvoiceId.get(id)
      if (tracker) {
        const photographer = photographerFromTracker(tracker.totalAmount, tracker.productAmounts)
        addProfit(r.productionDate, photographer)
      } else {
        if (!missingIds.includes(id)) missingIds.push(id)
      }
    }

    const years = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => b - a)

    return NextResponse.json({ years, byYear, missingIds })
  } catch (error) {
    console.error("Error fetching profit totals by year:", error)
    return NextResponse.json(
      { error: "Failed to fetch profit totals" },
      { status: 500 }
    )
  }
}
