"use client"

import { useEffect, useState, memo, useCallback, Suspense } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Pencil, Trash2, Eye, Search, CheckCircle, Loader2 } from "lucide-react"
import { ListCardSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type InvoiceListItem =
  | {
      source: "invoice"
      id: string
      documentId: string
      billTo: string
      productionDate: string
      totalAmount: number
      status: string
      updatedAt: string
      viewHref: string
    }
  | {
      source: "paragon" | "erha"
      id: string
      documentId: string
      billTo: string
      productionDate: string
      totalAmount: number
      status: string
      updatedAt: string
      viewHref: string
    }

function InvoicePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize statusFilter and search from URL parameters
  const initialStatus = (() => {
    const statusParam = searchParams.get("status")
    if (statusParam && ["draft", "pending", "paid"].includes(statusParam)) {
      return statusParam
    }
    return "all"
  })()
  const initialSearch = searchParams.get("search") ?? ""

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus)
  const [sortBy, setSortBy] = useState<string>("newest")
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [markPaidDialogId, setMarkPaidDialogId] = useState<string | null>(null)
  
  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const ITEMS_PER_PAGE = 20

  // Update filter and search when URL parameters change (e.g. landing from Paragon/Erha "View Invoice")
  useEffect(() => {
    const statusParam = searchParams.get("status")
    const newStatus = statusParam && ["draft", "pending", "paid"].includes(statusParam) 
      ? statusParam 
      : "all"
    if (newStatus !== statusFilter) {
      setStatusFilter(newStatus)
    }
    const searchParam = searchParams.get("search") ?? ""
    setSearchQuery(searchParam)
  }, [searchParams])

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      params.append("sortBy", sortBy)
      params.append("page", currentPage.toString())
      params.append("limit", ITEMS_PER_PAGE.toString())
      if (debouncedSearchQuery.trim()) params.append("search", debouncedSearchQuery.trim())

      const response = await fetch(`/api/invoice/list-with-tickets?${params}`, { cache: "no-store" })
      if (response.ok) {
        const result = await response.json()
        const data = result.data || []
        setInvoices(data)
        setTotalPages(result.pagination?.totalPages || 1)
        setTotalItems(result.pagination?.total || 0)
      }
    } catch (error) {
      console.error("Error fetching invoices:", error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sortBy, currentPage, debouncedSearchQuery, ITEMS_PER_PAGE])

  useEffect(() => {
    setLoading(true)
    fetchInvoices()
  }, [fetchInvoices])

  // Refetch when page becomes visible (e.g., after navigation back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchInvoices()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refetch when page regains focus (navigating back)
    window.addEventListener('focus', fetchInvoices)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', fetchInvoices)
    }
  }, [fetchInvoices])

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, statusFilter])

  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return

    setIsDeleting(true)
    const idToDelete = deleteId
    setDeleteId(null)

    try {
      const response = await fetch(`/api/invoice/${idToDelete}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Refresh the list FIRST, THEN show success toast
        await fetchInvoices()
        toast.success("Invoice deleted", {
          description: "The invoice has been removed."
        })
      } else {
        toast.error("Failed to delete invoice", {
          description: "An error occurred while deleting."
        })
      }
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast.error("Failed to delete invoice", {
        description: "An unexpected error occurred."
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMarkPaid = async (invoiceId: string) => {
    if (markingPaid) return
    
    // Optimistic update: update status immediately
    const previousInvoices = [...invoices]
    setInvoices(invoices.map(inv => 
      inv.id === invoiceId ? { ...inv, status: "paid" } : inv
    ))
    
    setMarkingPaid(invoiceId)
    try {
      // First, mark invoice as paid
      const response = await fetch(`/api/invoice/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      })

      if (response.ok) {
        toast.success("Invoice marked as paid!")
      } else {
        // Revert optimistic update on error
        setInvoices(previousInvoices)
        const errorData = await response.json()
        toast.error("Failed to mark invoice as paid", {
          description: errorData.error || "An error occurred."
        })
      }
    } catch (error) {
      // Revert optimistic update on error
      setInvoices(previousInvoices)
      console.error("Error marking invoice as paid:", error)
      toast.error("Failed to mark invoice as paid", {
        description: error instanceof Error ? error.message : "An unexpected error occurred."
      })
    } finally {
      setMarkingPaid(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PageHeader title="Invoice" showBackButton={true} />
        <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
          <div className="container mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="h-7 w-40 animate-pulse rounded bg-muted" />
              <div className="flex gap-2">
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
                <div className="h-10 w-40 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <ListCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Invoice" showBackButton={true} />
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        <div className="container mx-auto max-w-7xl space-y-6">
          {/* Header with filters and create button */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold tracking-tight">Invoice List</h2>
              <div className="flex flex-wrap gap-2">
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                  </SelectContent>
                </Select>

                {/* Create Button */}
                <Link href="/invoice/create">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Button>
                </Link>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Invoice ID or Client Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Invoice List */}
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-0">
                <EmptyState
                  type="invoices"
                  isSearchResult={!!debouncedSearchQuery}
                  searchQuery={debouncedSearchQuery}
                  showAction={false}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Header Row */}
              <div className="hidden lg:flex items-center justify-between gap-4 px-4 py-2 bg-muted/50 rounded-lg">
                <div className="flex-1 text-xs font-semibold text-muted-foreground uppercase">
                  Invoice
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase" style={{ width: '100px' }}>
                    Status
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase" style={{ width: '90px' }}>
                    Date
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase text-right" style={{ width: '125px' }}>
                    Total
                  </div>
                </div>
                <div style={{ width: '220px' }} className="text-xs font-semibold text-muted-foreground uppercase text-center">
                  Actions
                </div>
              </div>

              {/* Data Rows */}
              {invoices.map((row) => {
                const isInvoice = row.source === "invoice"
                const productionDateStr = typeof row.productionDate === "string" ? row.productionDate : (row.productionDate as Date)?.toISOString?.() ?? ""
                return (
                  <Card key={`${row.source}-${row.id}`} className="transition-all hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Source badge (Paragon/Erha) + ID - Bill To */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {row.source !== "invoice" && (
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                row.source === "paragon"
                                  ? "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-100"
                                  : "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-100"
                              }`}
                            >
                              {row.source}
                            </span>
                          )}
                          <span className="font-semibold text-sm whitespace-nowrap">
                            {row.documentId}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span className="font-medium text-sm truncate">
                            {row.billTo}
                          </span>
                        </div>

                        {/* Middle: Status, Production Date, Total Amount */}
                        <div className="hidden lg:flex items-center gap-4">
                          <div style={{ width: "100px" }}>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                                row.status === "paid" || row.status === "final"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
                                  : row.status === "pending"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100"
                              }`}
                            >
                              {row.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium" style={{ width: "90px" }}>
                            {productionDateStr ? new Date(productionDateStr).toLocaleDateString("en-GB") : "—"}
                          </div>
                          <div className="text-sm font-semibold text-right" style={{ width: "125px" }}>
                            {formatCurrency(row.totalAmount)}
                          </div>
                        </div>

                        {/* Right: Action Buttons */}
                        <div className="flex items-center gap-1 justify-end" style={{ width: "220px" }}>
                          {isInvoice && row.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => setMarkPaidDialogId(row.id)}
                              disabled={markingPaid === row.id}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Link href={row.viewHref}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {isInvoice && (
                            <Link href={`/invoice/${row.id}/edit`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {row.source === "paragon" && (
                            <Link href={`/special-case/paragon/${row.id}/edit`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {row.source === "erha" && (
                            <Link href={`/special-case/erha/${row.id}/edit`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {isInvoice && (
                            <>
                              <div className="h-8 w-px bg-border mx-1" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteId(row.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              
              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !isDeleting && !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the Invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Paid Confirmation Dialog */}
      <AlertDialog open={!!markPaidDialogId} onOpenChange={(open) => !markingPaid && !open && setMarkPaidDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Invoice as Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the invoice as paid and create an expense record. This action tracks the payment in your expense management.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!markingPaid}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (markPaidDialogId) {
                  handleMarkPaid(markPaidDialogId)
                  setMarkPaidDialogId(null)
                }
              }}
              disabled={!!markingPaid}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {markingPaid ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Mark as Paid"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <InvoicePageContent />
    </Suspense>
  )
}
