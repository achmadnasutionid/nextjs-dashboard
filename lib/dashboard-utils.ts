import type {
  Invoice,
  Quotation,
  InvoiceStats,
  QuotationStats,
  ActionItems,
  RecentActivity,
  ThisMonthSummary,
} from "@/types"

/**
 * Calculate invoice and quotation statistics
 */
export function calculateStats(
  invoices: Invoice[],
  quotations: Quotation[],
  year: string
): { invoiceStats: InvoiceStats; quotationStats: QuotationStats } {
  // Filter by year if not "all"
  const filteredInvoices =
    year === "all"
      ? invoices
      : invoices.filter(
          (inv) =>
            inv.productionDate &&
            new Date(inv.productionDate).getFullYear().toString() === year
        )

  const filteredQuotations =
    year === "all"
      ? quotations
      : quotations.filter(
          (q) =>
            q.productionDate &&
            new Date(q.productionDate).getFullYear().toString() === year
        )

  // Calculate invoice totals
  const invoiceTotal = filteredInvoices
    .filter((inv) => inv.status !== "draft")
    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  const invoicePending = filteredInvoices
    .filter((inv) => inv.status === "pending")
    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  const invoicePaid = filteredInvoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  const invoiceDraftCount = filteredInvoices.filter(
    (inv) => inv.status === "draft"
  ).length

  // Calculate quotation totals
  const quotationTotal = filteredQuotations
    .filter((q) => q.status !== "draft")
    .reduce((sum, q) => sum + (q.totalAmount || 0), 0)
  const quotationPending = filteredQuotations
    .filter((q) => q.status === "pending")
    .reduce((sum, q) => sum + (q.totalAmount || 0), 0)
  const quotationAccepted = filteredQuotations
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + (q.totalAmount || 0), 0)
  const quotationDraftCount = filteredQuotations.filter(
    (q) => q.status === "draft"
  ).length

  return {
    invoiceStats: {
      total: invoiceTotal,
      draft: invoiceDraftCount,
      pending: invoicePending,
      paid: invoicePaid,
    },
    quotationStats: {
      total: quotationTotal,
      draft: quotationDraftCount,
      pending: quotationPending,
      accepted: quotationAccepted,
    },
  }
}

/**
 * Calculate action items
 */
export function calculateActionItems(
  invoices: Invoice[],
  quotations: Quotation[]
): ActionItems {
  const pendingInvoicesList = invoices.filter((inv) => inv.status === "pending")
  const pendingInvoicesTotal = pendingInvoicesList.reduce(
    (sum, inv) => sum + (inv.totalAmount || 0),
    0
  )

  const now = new Date().getTime()
  const pendingQuotationsList = quotations
    .filter((q) => q.status === "pending")
    .map((q) => {
      const updatedDate = q.updatedAt
        ? new Date(q.updatedAt).getTime()
        : new Date(q.createdAt).getTime()
      const days = Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24))
      return {
        ...q,
        daysSinceUpdate: isNaN(days) ? 0 : days,
      }
    })
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)

  return {
    pendingInvoices: {
      count: pendingInvoicesList.length,
      totalAmount: pendingInvoicesTotal,
      items: pendingInvoicesList,
    },
    pendingQuotations: {
      count: pendingQuotationsList.length,
      items: pendingQuotationsList,
    },
  }
}

/**
 * Calculate recent activities
 */
export function calculateRecentActivities(
  invoices: Invoice[],
  quotations: Quotation[]
): RecentActivity[] {
  const activities: RecentActivity[] = []

  invoices.forEach((inv) => {
    const updatedAt = new Date(inv.updatedAt)
    activities.push({
      type: "invoice",
      id: inv.id,
      displayId: inv.invoiceId,
      action:
        inv.status === "paid"
          ? "marked as PAID"
          : inv.status === "pending"
          ? "set to PENDING"
          : "created",
      timestamp: updatedAt.getTime(),
      date: updatedAt.toISOString(),
      icon: "receipt",
      color:
        inv.status === "paid"
          ? "green"
          : inv.status === "pending"
          ? "blue"
          : "yellow",
    })
  })

  quotations.forEach((q) => {
    const updatedAt = new Date(q.updatedAt)
    activities.push({
      type: "quotation",
      id: q.id,
      displayId: q.quotationId,
      action:
        q.status === "accepted"
          ? "marked as ACCEPTED"
          : q.status === "pending"
          ? "set to PENDING"
          : "created",
      timestamp: updatedAt.getTime(),
      date: updatedAt.toISOString(),
      icon: "file-check",
      color:
        q.status === "accepted"
          ? "green"
          : q.status === "pending"
          ? "yellow"
          : "gray",
    })
  })

  return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6)
}

/**
 * Calculate this month summary
 */
export function calculateThisMonthSummary(invoices: Invoice[]): ThisMonthSummary {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

  const thisMonthPaidInvoices = invoices.filter((inv) => {
    if (inv.status !== "paid") return false
    const invDate = new Date(inv.updatedAt)
    return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear
  })
  const thisMonthRevenue = thisMonthPaidInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount || 0),
    0
  )

  const lastMonthPaidInvoices = invoices.filter((inv) => {
    if (inv.status !== "paid") return false
    const invDate = new Date(inv.updatedAt)
    return invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear
  })
  const lastMonthRevenue = lastMonthPaidInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount || 0),
    0
  )

  const revenueChange =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0
  const profitChange =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0

  return {
    revenue: thisMonthRevenue,
    netProfit: thisMonthRevenue,
    revenueChange,
    profitChange,
  }
}

/**
 * Extract unique years from datasets
 */
export function extractAvailableYears(
  invoices: Invoice[],
  quotations: Quotation[]
): number[] {
  const years = new Set<number>()
  years.add(new Date().getFullYear())

  invoices.forEach((inv) => {
    if (inv.productionDate) {
      years.add(new Date(inv.productionDate).getFullYear())
    }
  })

  quotations.forEach((q) => {
    if (q.productionDate) {
      years.add(new Date(q.productionDate).getFullYear())
    }
  })

  return Array.from(years).sort((a, b) => b - a)
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: string): string {
  const now = new Date().getTime()
  const activityTime = new Date(date).getTime()
  const diff = now - activityTime

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) {
    return minutes === 0 ? "Just now" : `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`
  } else if (days < 7) {
    return `${days} day${days > 1 ? "s" : ""} ago`
  } else {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    })
  }
}
