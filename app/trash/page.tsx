"use client"

import { useEffect, useState, useCallback } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCcw, Trash2, Eye, Loader2 } from "lucide-react"
import { ListCardSkeleton } from "@/components/ui/skeleton"
import { EmptyState, type EmptyStateType } from "@/components/ui/empty-state"
import Link from "next/link"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type CategoryKey =
  | "invoice" | "quotation" | "paragon" | "erha" | "barclay"
  | "company" | "product" | "signature" | "billing"
  | "production-tracker" | "remark-template" | "quotation-template"

interface CategoryConfig {
  key: CategoryKey
  label: string
  endpoint: string
  shape: "paginated" | "array"
  viewBase: string | null
  emptyType: EmptyStateType
}

const CATEGORIES: CategoryConfig[] = [
  { key: "invoice", label: "Invoice", endpoint: "/api/invoice", shape: "paginated", viewBase: "/invoice", emptyType: "invoices" },
  { key: "quotation", label: "Quotation", endpoint: "/api/quotation", shape: "paginated", viewBase: "/quotation", emptyType: "quotations" },
  { key: "paragon", label: "Paragon Ticket", endpoint: "/api/paragon", shape: "paginated", viewBase: "/special-case/paragon", emptyType: "paragon-tickets" },
  { key: "erha", label: "Erha Ticket", endpoint: "/api/erha", shape: "paginated", viewBase: "/special-case/erha", emptyType: "erha-tickets" },
  { key: "barclay", label: "Barclay Ticket", endpoint: "/api/barclay", shape: "paginated", viewBase: "/special-case/barclay", emptyType: "barclay-tickets" },
  { key: "company", label: "Company", endpoint: "/api/companies", shape: "array", viewBase: null, emptyType: "companies" },
  { key: "product", label: "Product", endpoint: "/api/products", shape: "array", viewBase: null, emptyType: "products" },
  { key: "signature", label: "Signature", endpoint: "/api/signatures", shape: "array", viewBase: null, emptyType: "signatures" },
  { key: "billing", label: "Billing", endpoint: "/api/billings", shape: "array", viewBase: null, emptyType: "billings" },
  { key: "production-tracker", label: "Production Tracker", endpoint: "/api/production-tracker", shape: "array", viewBase: null, emptyType: "generic" },
  { key: "remark-template", label: "Remark Template", endpoint: "/api/remark-templates", shape: "array", viewBase: null, emptyType: "templates" },
  { key: "quotation-template", label: "Quotation Template", endpoint: "/api/quotation-templates", shape: "array", viewBase: null, emptyType: "templates" },
]

interface TrashRow {
  id: string
  primary: string
  secondary?: string
  badge?: string
  badgeClass?: string
  date?: string
  amount?: number
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("en-GB") : "—"

const statusBadgeClass = (status?: string) => {
  if (status === "paid" || status === "final") return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
  if (status === "pending") return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
  return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100"
}

function toRow(key: CategoryKey, item: any): TrashRow {
  switch (key) {
    case "invoice":
      return { id: item.id, primary: item.invoiceId, secondary: item.billTo, badge: item.status?.toUpperCase(), badgeClass: statusBadgeClass(item.status), date: formatDate(item.productionDate), amount: item.totalAmount }
    case "quotation":
      return { id: item.id, primary: item.quotationId, secondary: item.billTo, badge: item.status?.toUpperCase(), badgeClass: statusBadgeClass(item.status), date: formatDate(item.productionDate), amount: item.totalAmount }
    case "paragon":
    case "erha":
    case "barclay":
      return { id: item.id, primary: item.ticketId, secondary: item.billTo || item.projectName, badge: item.status?.toUpperCase(), badgeClass: statusBadgeClass(item.status), date: formatDate(item.productionDate), amount: item.totalAmount }
    case "company":
      return { id: item.id, primary: item.name, secondary: [item.city, item.email].filter(Boolean).join(" · "), date: formatDate(item.createdAt) }
    case "product":
      return { id: item.id, primary: item.name, secondary: `${item.details?.length ?? 0} detail row(s)`, date: formatDate(item.createdAt) }
    case "signature":
      return { id: item.id, primary: item.name, secondary: item.role || undefined, date: formatDate(item.createdAt) }
    case "billing":
      return { id: item.id, primary: item.name, secondary: `${item.bankName} · ${item.bankAccount}`, date: formatDate(item.createdAt) }
    case "production-tracker":
      return { id: item.id, primary: item.trackerId, secondary: item.projectName, badge: item.status?.toUpperCase(), badgeClass: statusBadgeClass(item.status), date: formatDate(item.date), amount: item.totalAmount }
    case "remark-template":
    case "quotation-template":
      return { id: item.id, primary: item.name, secondary: `${item.items?.length ?? 0} item(s)`, date: formatDate(item.createdAt) }
  }
}

function TrashPageContent() {
  const [category, setCategory] = useState<CategoryKey>("invoice")
  const [rows, setRows] = useState<TrashRow[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TrashRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const config = CATEGORIES.find((c) => c.key === category)!

  const fetchTrash = useCallback(async () => {
    setLoading(true)
    try {
      const url = config.shape === "paginated"
        ? `${config.endpoint}?includeDeleted=true&limit=200&sortBy=newest`
        : `${config.endpoint}?includeDeleted=true`
      const response = await fetch(url, { cache: "no-store" })
      if (!response.ok) {
        setRows([])
        return
      }
      const json = await response.json()
      const items: any[] = config.shape === "paginated" ? (json.data || []) : (Array.isArray(json) ? json : [])
      const deletedItems = items.filter((item) => item.deletedAt)
      setRows(deletedItems.map((item) => toRow(config.key, item)))
    } catch (error) {
      console.error("Error fetching trash:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [config])

  useEffect(() => {
    fetchTrash()
  }, [fetchTrash])

  const handleRestore = async (row: TrashRow) => {
    if (restoringId) return
    setRestoringId(row.id)
    try {
      const response = await fetch(`${config.endpoint}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      })
      if (response.ok) {
        toast.success(`${config.label} restored`, { description: `${row.primary} has been restored.` })
        setRows((prev) => prev.filter((r) => r.id !== row.id))
      } else {
        toast.error(`Failed to restore ${config.label.toLowerCase()}`)
      }
    } catch (error) {
      console.error("Error restoring item:", error)
      toast.error(`Failed to restore ${config.label.toLowerCase()}`)
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`${config.endpoint}/${deleteTarget.id}?permanent=true`, {
        method: "DELETE",
      })
      if (response.ok) {
        toast.success(`${config.label} permanently deleted`)
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      } else {
        const data = await response.json().catch(() => null)
        toast.error(data?.error || `Failed to permanently delete ${config.label.toLowerCase()}`)
      }
    } catch (error) {
      console.error("Error permanently deleting item:", error)
      toast.error(`Failed to permanently delete ${config.label.toLowerCase()}`)
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const hasBadges = rows.some((r) => r.badge)
  const hasAmounts = rows.some((r) => r.amount !== undefined)

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Trash" showBackButton backTo="/" />
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        <div className="container mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold tracking-tight">Trash</h2>
            <Select value={category} onValueChange={(value) => setCategory(value as CategoryKey)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <ListCardSkeleton key={i} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-0">
                <EmptyState
                  type={config.emptyType}
                  title={`No deleted ${config.label.toLowerCase()}s`}
                  description="Items you delete will show up here and can be restored."
                  showAction={false}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Header Row */}
              <div className="hidden lg:flex items-center justify-between gap-4 px-4 py-2 bg-muted/50 rounded-lg">
                <div className="flex-1 text-xs font-semibold text-muted-foreground uppercase">
                  {config.label}
                </div>
                <div className="flex items-center gap-4">
                  {hasBadges && (
                    <div className="text-xs font-semibold text-muted-foreground uppercase" style={{ width: "100px" }}>
                      Status
                    </div>
                  )}
                  <div className="text-xs font-semibold text-muted-foreground uppercase" style={{ width: "90px" }}>
                    Date
                  </div>
                  {hasAmounts && (
                    <div className="text-xs font-semibold text-muted-foreground uppercase text-right" style={{ width: "125px" }}>
                      Total
                    </div>
                  )}
                </div>
                <div style={{ width: "140px" }} className="text-xs font-semibold text-muted-foreground uppercase text-center">
                  Actions
                </div>
              </div>

              {/* Data Rows */}
              {rows.map((row) => {
                const href = config.viewBase ? `${config.viewBase}/${row.id}/view` : null
                return (
                  <Card key={row.id} className="transition-all hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-semibold text-sm whitespace-nowrap">
                            {row.primary}
                          </span>
                          {row.secondary && (
                            <>
                              <span className="text-muted-foreground">-</span>
                              <span className="font-medium text-sm truncate">
                                {row.secondary}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="hidden lg:flex items-center gap-4">
                          {hasBadges && (
                            <div style={{ width: "100px" }}>
                              {row.badge && (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${row.badgeClass}`}>
                                  {row.badge}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-sm font-medium" style={{ width: "90px" }}>
                            {row.date}
                          </div>
                          {hasAmounts && (
                            <div className="text-sm font-semibold text-right" style={{ width: "125px" }}>
                              {row.amount !== undefined ? formatCurrency(row.amount) : ""}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 justify-end" style={{ width: "140px" }}>
                          {href && (
                            <Link href={href}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleRestore(row)}
                            disabled={restoringId === row.id}
                          >
                            {restoringId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !isDeleting && !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. &quot;{deleteTarget?.primary}&quot; will be permanently erased from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Forever"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function TrashPage() {
  return <TrashPageContent />
}
