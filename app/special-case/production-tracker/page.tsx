"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { NumericFormat } from "react-number-format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Search, Loader2, ExternalLink, Calendar, Pencil } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

interface ProductionTracker {
  id: string
  trackerId: string
  expenseId: string
  invoiceId?: string | null
  projectName: string
  date: string
  subtotal: number
  totalAmount: number
  expense: number
  productAmounts: Record<string, number>
  notes?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

const PRODUCT_COLUMNS = [
  "PHOTOGRAPHER",
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
  "PRINT"
]

// Display names for headers (shorter versions)
const PRODUCT_DISPLAY_NAMES: Record<string, string> = {
  "MODEL/HANDMODEL": "MODEL",
  "ACCOMMODATION": "ACCOM"
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "in progress", label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "paid", label: "Paid", color: "bg-green-50 text-green-700 border-green-200" }
]

export default function ProductionTrackerPage() {
  const router = useRouter()
  const [trackers, setTrackers] = useState<ProductionTracker[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [editingCell, setEditingCell] = useState<{rowId: string, field: string} | null>(null)
  const [editValue, setEditValue] = useState<any>("")
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const isClickingCell = useRef(false)

  // Wheel scroll: capture phase so we get events even when a cell/input is focused; handle both vertical and horizontal
  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      if (!el.contains(e.target as Node)) return
      const deltaX = e.deltaX
      const deltaY = e.deltaY
      const shiftWheel = e.shiftKey && deltaY !== 0
      const hasHorizontalScroll = el.scrollWidth > el.clientWidth
      const hasVerticalScroll = el.scrollHeight > el.clientHeight
      if (deltaX !== 0 && hasHorizontalScroll) {
        el.scrollLeft += deltaX
        e.preventDefault()
      } else if (shiftWheel && hasHorizontalScroll) {
        el.scrollLeft += deltaY
        e.preventDefault()
      } else if (deltaY !== 0 && hasVerticalScroll) {
        el.scrollTop += deltaY
        e.preventDefault()
      }
    }
    el.addEventListener("wheel", handleWheel, { passive: false, capture: true })
    return () => el.removeEventListener("wheel", handleWheel, true)
  }, [])

  // Calculate expense from all product columns except PHOTOGRAPHER
  const calculateExpense = (productAmounts: Record<string, number>) => {
    const expenseProducts = PRODUCT_COLUMNS.slice(1) // All except PHOTOGRAPHER
    return expenseProducts.reduce((sum, product) => {
      return sum + (productAmounts[product] || 0)
    }, 0)
  }

  // Calculate PHOTOGRAPHER from Total - Expense
  const calculatePhotographer = (totalAmount: number, productAmounts: Record<string, number>) => {
    const expense = calculateExpense(productAmounts)
    return totalAmount - expense
  }

  // Hide number input arrows/spinners
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'hide-number-spinners'
    style.textContent = `
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type=number] {
        -moz-appearance: textfield;
        appearance: textfield;
      }
    `
    document.head.appendChild(style)

    return () => {
      const existingStyle = document.getElementById('hide-number-spinners')
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }
    }
  }, [])

  const fetchTrackers = useCallback(async () => {
    try {
      const response = await fetch(`/api/production-tracker`)
      if (response.ok) {
        const data = await response.json()
        setTrackers(data)
      }
    } catch (error) {
      console.error("Error fetching trackers:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount only
  useEffect(() => {
    fetchTrackers()
  }, [fetchTrackers])

  // Extract available years from trackers
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    trackers.forEach(tracker => {
      const year = new Date(tracker.date).getFullYear()
      if (!isNaN(year)) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a) // Sort descending (newest first)
  }, [trackers])

  // Filter by year, then by status, then by search query
  const filteredTrackers = useMemo(() => {
    let filtered = trackers

    // Filter by year
    if (selectedYear !== "all") {
      filtered = filtered.filter(tracker => {
        const year = new Date(tracker.date).getFullYear()
        return year.toString() === selectedYear
      })
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter(tracker => tracker.status === selectedStatus)
    }

    // Then filter by search query (expense ID or project name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(tracker =>
        tracker.expenseId.toLowerCase().includes(query) ||
        tracker.projectName.toLowerCase().includes(query)
      )
    }

    // Sort: paid status always at the bottom
    return [...filtered].sort((a, b) => {
      const aPaid = a.status === "paid" ? 1 : 0
      const bPaid = b.status === "paid" ? 1 : 0
      return aPaid - bPaid
    })
  }, [trackers, selectedYear, selectedStatus, searchQuery])

  // Calculate totals for filtered trackers
  const totals = useMemo(() => {
    const totalRow: Record<string, number> = {
      totalAmount: 0,
      expense: 0,
      photographer: 0,
    }

    // Initialize product totals
    PRODUCT_COLUMNS.slice(1).forEach(product => {
      totalRow[product] = 0
    })

    // Sum up all filtered trackers
    filteredTrackers.forEach(tracker => {
      totalRow.totalAmount += tracker.totalAmount
      totalRow.expense += calculateExpense(tracker.productAmounts || {})
      totalRow.photographer += calculatePhotographer(tracker.totalAmount, tracker.productAmounts || {})
      
      // Sum product amounts
      PRODUCT_COLUMNS.slice(1).forEach(product => {
        totalRow[product] += tracker.productAmounts?.[product] || 0
      })
    })

    return totalRow
  }, [filteredTrackers])

  const handleCreateRow = async () => {
    if (creating) return
    
    setCreating(true)
    try {
      const response = await fetch("/api/production-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: "",
          projectName: "",
          date: new Date().toISOString(),
          subtotal: 0,
          totalAmount: 0,
          expense: 0, // Will be 0 since all products start at 0
          productAmounts: {},
          status: "pending"
        })
      })

      if (response.ok) {
        const newTracker = await response.json()
        setTrackers([newTracker, ...trackers])
        toast.success("New row created")
      } else {
        toast.error("Failed to create row")
      }
    } catch (error) {
      console.error("Error creating row:", error)
      toast.error("Failed to create row")
    } finally {
      setCreating(false)
    }
  }

  const handleCellClick = async (tracker: ProductionTracker, field: string) => {
    // If we're currently editing another cell, save it first
    if (editingCell && (editingCell.rowId !== tracker.id || editingCell.field !== field)) {
      isClickingCell.current = true
      await handleCellBlur()
      isClickingCell.current = false
    }
    
    // Don't allow editing status via cell click (use dropdown instead)
    if (field === 'status') return
    
    setEditingCell({ rowId: tracker.id, field })
    
    // Set initial value based on field type
    if (field.startsWith('product_')) {
      const productName = field.replace('product_', '')
      setEditValue(tracker.productAmounts?.[productName] || "")
    } else if (field === 'date') {
      setEditValue(tracker.date ? new Date(tracker.date).toISOString().split('T')[0] : "")
    } else if (field === 'invoiceId') {
      setEditValue(tracker.invoiceId || "")
    } else {
      setEditValue((tracker as any)[field] || "")
    }
  }

  const handleStatusChange = async (trackerId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/production-tracker/${trackerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        const updated = await response.json()
        setTrackers(trackers.map(t => t.id === trackerId ? updated : t))
        toast.success("Status updated")
      } else {
        toast.error("Failed to update status")
      }
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    }
  }

  const handleCellBlur = async () => {
    if (!editingCell) return

    const { rowId, field } = editingCell
    const tracker = trackers.find(t => t.id === rowId)
    if (!tracker) return

    // Check if value actually changed
    let hasChanged = false
    if (field.startsWith('product_')) {
      const productName = field.replace('product_', '')
      const currentValue = tracker.productAmounts?.[productName] || 0
      const newValue = parseFloat(editValue) || 0
      hasChanged = currentValue !== newValue
    } else if (field === 'date') {
      const currentValue = tracker.date ? new Date(tracker.date).toISOString().split('T')[0] : ""
      hasChanged = currentValue !== editValue
    } else {
      hasChanged = (tracker as any)[field] !== editValue
    }

    if (!hasChanged) {
      setEditingCell(null)
      return
    }

    // Save the change
    try {
      let updateData: any = {}
      
      if (field.startsWith('product_')) {
        const productName = field.replace('product_', '')
        updateData.productAmounts = {
          ...tracker.productAmounts,
          [productName]: parseFloat(editValue) || 0
        }
        // Recalculate expense
        updateData.expense = calculateExpense(updateData.productAmounts)
        // Recalculate PHOTOGRAPHER
        const photographer = calculatePhotographer(tracker.totalAmount, updateData.productAmounts)
        updateData.productAmounts['PHOTOGRAPHER'] = photographer
      } else if (field === 'totalAmount') {
        updateData[field] = parseFloat(editValue) || 0
        // If totalAmount changed, recalculate PHOTOGRAPHER
        const photographer = calculatePhotographer(parseFloat(editValue) || 0, tracker.productAmounts || {})
        updateData.productAmounts = {
          ...tracker.productAmounts,
          'PHOTOGRAPHER': photographer
        }
        updateData.expense = calculateExpense(tracker.productAmounts || {})
      } else if (field === 'date') {
        updateData[field] = editValue ? new Date(editValue).toISOString() : tracker.date
      } else {
        updateData[field] = editValue
      }

      const response = await fetch(`/api/production-tracker/${rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const updated = await response.json()
        setTrackers(trackers.map(t => t.id === rowId ? updated : t))
        toast.success("Saved")
      } else {
        toast.error("Failed to save")
      }
    } catch (error) {
      console.error("Error saving cell:", error)
      toast.error("Failed to save")
    }

    setEditingCell(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const handleDeleteRow = async (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId || deleting) return

    setDeleting(true)
    const idToDelete = deleteId

    try {
      const response = await fetch(`/api/production-tracker/${idToDelete}`, {
        method: "DELETE"
      })

      if (response.ok) {
        setTrackers(trackers.filter(t => t.id !== idToDelete))
        if (editingCell?.rowId === idToDelete) {
          setEditingCell(null)
        }
        toast.success("Row deleted")
      } else {
        toast.error("Failed to delete row")
      }
    } catch (error) {
      console.error("Error deleting row:", error)
      toast.error("Failed to delete row")
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const handleBlur = () => {
    if (editingCell) {
      handleCellBlur()
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    handleDeleteRow(id)
  }

  const handleInvoiceLink = async (invoiceId: string) => {
    const trimmed = invoiceId?.trim()
    if (!trimmed) return
    try {
      const response = await fetch(`/api/invoice?search=${encodeURIComponent(trimmed)}`)
      if (response.ok) {
        const result = await response.json()
        const invoice = result.data?.find((inv: { invoiceId: string }) => inv.invoiceId === trimmed)
        if (invoice) {
          window.open(`/invoice/${invoice.id}/view`, '_blank')
        } else {
          // Not in main Invoice table; maybe Paragon/Erha – open list with search so user can see it
          window.open(`/invoice?search=${encodeURIComponent(trimmed)}`, '_blank')
        }
      } else {
        window.open(`/invoice?search=${encodeURIComponent(trimmed)}`, '_blank')
      }
    } catch (error) {
      console.error("Error resolving invoice:", error)
      window.open(`/invoice?search=${encodeURIComponent(trimmed)}`, '_blank')
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PageHeader title="Tracker" showBackButton={true} />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Tracker" showBackButton={true} hideThemeToggle={true} />
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-6">
        <div className="w-full max-w-[98vw] mx-auto space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Expense ID or Project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreateRow} disabled={creating}>
                <Plus className="mr-2 h-4 w-4" />
                {creating ? "Creating..." : "New Row"}
              </Button>
            </div>
          </div>

          {/* Full-width Table with Extended Sticky Columns */}
          <div 
            ref={tableRef}
            className="relative overflow-x-auto overflow-y-auto rounded-lg border bg-card shadow-lg max-h-[calc(100vh-250px)]"
          >
            <table className="w-full border-collapse text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-30 bg-muted">
                <tr>
                  {/* ID (invoice) + Link - Gray */}
                  <th className="sticky left-0 z-40 border-r border-b border-border p-1.5 text-left font-semibold min-w-[92px] w-[92px] bg-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    ID
                  </th>
                  
                  {/* Project Info - Blue */}
                  <th className="sticky left-[92px] z-40 border-r border-b border-border p-1.5 text-left font-semibold min-w-[200px] bg-blue-50">
                    Project Name
                  </th>
                  <th className="sticky left-[292px] z-40 border-r border-b border-border p-1.5 text-left font-semibold w-[110px] min-w-[110px] bg-blue-50">
                    Date
                  </th>
                  
                  {/* Total, Expense, PHOTOGRAPHER - Left Sticky after Date */}
                  <th className="sticky left-[402px] z-40 border-r border-b border-border p-2 text-left font-semibold w-[130px] min-w-[130px] max-w-[130px] bg-green-50 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    Total
                  </th>
                  <th className="sticky left-[532px] z-40 border-b border-border p-2 text-left font-semibold w-[130px] min-w-[130px] max-w-[130px] bg-green-50">
                    Expense
                  </th>
                  <th className="sticky left-[662px] z-40 border-l border-r border-b border-border p-2 text-left font-semibold w-[130px] min-w-[130px] max-w-[130px] bg-green-50 whitespace-nowrap">
                    PHOTOGRAPHER
                  </th>
                  
                  {/* Product Columns - Purple */}
                  {PRODUCT_COLUMNS.slice(1).map((product, index) => (
                    <th key={product} className={cn(
                      "border-r border-b border-border p-2 text-left font-semibold w-[110px] min-w-[110px] whitespace-nowrap bg-purple-50",
                      index === PRODUCT_COLUMNS.slice(1).length - 1 && "border-r-2"
                    )}>
                      {PRODUCT_DISPLAY_NAMES[product] || product}
                    </th>
                  ))}
                  
                  {/* Status - Right Sticky - Red */}
                  <th className="sticky right-[60px] z-40 border-l border-r border-b border-border p-1.5 text-center font-semibold w-[90px] min-w-[90px] bg-red-50 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">
                    Status
                  </th>
                  {/* Action Column - Right Sticky - Red */}
                  <th className="sticky right-0 z-40 border-b border-border p-2 text-center font-semibold w-[60px] min-w-[60px] bg-red-50">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton loading rows
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      {/* ID (merged) - Gray */}
                      <td className="sticky left-0 z-20 border-r border-b border-border p-1.5 bg-gray-50 shadow-[2px_0_4px_rgba(0,0,0,0.05)] w-[92px] min-w-[92px]">
                        <Skeleton className="h-4 w-full" />
                      </td>
                      {/* Project Name - Blue */}
                      <td className="sticky left-[92px] z-20 border-r border-b border-border p-1.5 bg-blue-50 min-w-[200px]">
                        <Skeleton className="h-4 w-full" />
                      </td>
                      {/* Date - Blue */}
                      <td className="sticky left-[292px] z-20 border-r border-b border-border p-1.5 bg-blue-50 w-[110px] min-w-[110px]">
                        <Skeleton className="h-4 w-full" />
                      </td>
                      {/* Total, Expense, PHOTOGRAPHER - Left Sticky */}
                      <td className="sticky left-[402px] z-20 border-r border-b border-border p-2 bg-green-50 w-[130px] min-w-[130px] max-w-[130px] shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                        <Skeleton className="h-5 w-full" />
                      </td>
                      <td className="sticky left-[532px] z-20 border-b border-border p-2 bg-green-50 w-[130px] min-w-[130px] max-w-[130px]">
                        <Skeleton className="h-5 w-full" />
                      </td>
                      <td className="sticky left-[662px] z-20 border-l border-r border-b border-border p-2 bg-green-50 w-[130px] min-w-[130px] max-w-[130px]">
                        <Skeleton className="h-5 w-full" />
                      </td>
                      {/* Product Columns - Purple */}
                      {PRODUCT_COLUMNS.slice(1).map((product, idx) => (
                        <td key={product} className={cn(
                          "border-r border-b border-border p-2 bg-purple-50 w-[110px] min-w-[110px]",
                          idx === PRODUCT_COLUMNS.slice(1).length - 1 && "border-r-2"
                        )}>
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                      {/* Status - Right Sticky - Red */}
                      <td className="sticky right-[60px] z-20 border-l border-r border-b border-border p-1.5 bg-red-50 w-[90px] min-w-[90px] shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                        <Skeleton className="h-4 w-full" />
                      </td>
                      {/* Action Column - Right Sticky - Red */}
                      <td className="sticky right-0 z-20 border-b border-border p-2 bg-red-50 w-[60px] min-w-[60px]">
                        <Skeleton className="h-5 w-5 mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : trackers.length === 0 ? (
                  <tr>
                    <td colSpan={PRODUCT_COLUMNS.length + 7} className="p-8 text-center text-muted-foreground">
                      No data yet. Click "New Row" to start.
                    </td>
                  </tr>
                ) : (
                  filteredTrackers.map((tracker) => {
                    return (
                      <tr key={tracker.id} className="group transition-colors">
                        {/* ID + Link (merged) - Gray: link opens invoice, pencil edits */}
                        <td className="sticky left-0 z-20 border-r border-b border-border p-1.5 bg-gray-50 shadow-[2px_0_4px_rgba(0,0,0,0.05)] w-[92px] min-w-[92px] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50 group-focus-within:!shadow-[inset_2px_0_0_0_hsl(var(--primary))]">
                          {editingCell?.rowId === tracker.id && editingCell?.field === 'invoiceId' ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleBlur}
                              onKeyDown={handleKeyDown}
                              className="h-6 text-xs"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-0.5 min-w-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0 hover:bg-gray-200"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCellClick(tracker, 'invoiceId')
                                }}
                                title="Edit ID"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                              {tracker.invoiceId ? (
                                <button
                                  type="button"
                                  className="text-[11px] leading-tight text-blue-600 underline hover:no-underline truncate text-left flex-1 min-w-0"
                                  onClick={() => handleInvoiceLink(tracker.invoiceId!)}
                                  title={`${tracker.invoiceId} – View Invoice`}
                                >
                                  {tracker.invoiceId.length > 4 ? tracker.invoiceId.slice(-4) : tracker.invoiceId}
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground flex-1">-</span>
                              )}
                            </div>
                          )}
                        </td>
                        
                        {/* Project Name - Editable - Blue */}
                        <td 
                          className="sticky left-[92px] z-20 border-r border-b border-border p-1.5 bg-blue-50 cursor-pointer hover:bg-blue-100 min-w-[200px] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleCellClick(tracker, 'projectName')
                          }}
                        >
                          {editingCell?.rowId === tracker.id && editingCell?.field === 'projectName' ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleBlur}
                              onKeyDown={handleKeyDown}
                              className="h-6 text-xs"
                              autoFocus
                            />
                          ) : (
                            <span className="text-xs truncate block">{tracker.projectName || "-"}</span>
                          )}
                        </td>
                        
                        {/* Date - Click to pick - Blue */}
                        <td 
                          className="sticky left-[292px] z-20 border-r border-b border-border p-1.5 bg-blue-50 w-[110px] min-w-[110px] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50"
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1 text-xs hover:underline w-full justify-start">
                                <Calendar className="h-3 w-3" />
                                {formatDate(tracker.date)}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <div className="p-3">
                                <DatePicker
                                  selected={tracker.date ? new Date(tracker.date) : new Date()}
                                  onChange={async (date: Date | null) => {
                                    if (date) {
                                      try {
                                        const response = await fetch(`/api/production-tracker/${tracker.id}`, {
                                          method: "PUT",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ date: date.toISOString() })
                                        })
                                        if (response.ok) {
                                          const updated = await response.json()
                                          setTrackers(trackers.map(t => t.id === tracker.id ? updated : t))
                                          toast.success("Date updated")
                                          // Close popover
                                          document.body.click()
                                        } else {
                                          toast.error("Failed to update date")
                                        }
                                      } catch (error) {
                                        console.error("Error updating date:", error)
                                        toast.error("Failed to update date")
                                      }
                                    }
                                  }}
                                  dateFormat="dd/MM/yyyy"
                                  className="h-9 text-xs border border-input rounded-md px-3 py-2"
                                  inline
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </td>
                        
                        {/* Total, Expense, PHOTOGRAPHER - Left Sticky */}
                        <td 
                          className="sticky left-[402px] z-20 border-r border-b border-border p-2 text-right bg-green-50 cursor-pointer hover:bg-green-100 w-[130px] min-w-[130px] max-w-[130px] shadow-[2px_0_4px_rgba(0,0,0,0.05)] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleCellClick(tracker, 'totalAmount')
                          }}
                        >
                          {editingCell?.rowId === tracker.id && editingCell?.field === 'totalAmount' ? (
                            <NumericFormat
                              value={editValue}
                              onValueChange={(values) => setEditValue(values.value)}
                              onBlur={handleBlur}
                              onKeyDown={handleKeyDown}
                              thousandSeparator="."
                              decimalSeparator=","
                              decimalScale={0}
                              allowNegative={false}
                              placeholder="0"
                              className="flex h-7 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-right ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              autoFocus
                            />
                          ) : (
                            <span className="text-xs font-medium">{formatCurrency(tracker.totalAmount)}</span>
                          )}
                        </td>
                        <td 
                          className="sticky left-[532px] z-20 border-b border-border p-2 text-right bg-green-50 w-[130px] min-w-[130px] max-w-[130px] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50"
                        >
                          <span className="text-xs font-medium text-green-700">
                            {formatCurrency(calculateExpense(tracker.productAmounts || {}))}
                          </span>
                        </td>
                        <td 
                          className="sticky left-[662px] z-20 border-l border-r border-b border-border p-2 text-right bg-green-50 w-[130px] min-w-[130px] max-w-[130px] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50"
                        >
                          <span className="text-xs font-medium text-green-700">
                            {formatCurrency(calculatePhotographer(tracker.totalAmount, tracker.productAmounts || {}))}
                          </span>
                        </td>
                        
                        {/* Scrollable Product Columns - Purple */}
                        {PRODUCT_COLUMNS.slice(1).map((product, index) => {
                          const amount = tracker.productAmounts?.[product] || 0
                          const fieldName = `product_${product}`
                          const isEditing = editingCell?.rowId === tracker.id && editingCell?.field === fieldName
                          
                          return (
                            <td 
                              key={product}
                              className={cn(
                                "border-r border-b border-border p-2 text-right bg-purple-50 cursor-pointer hover:bg-purple-100 w-[110px] min-w-[110px] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50",
                                index === PRODUCT_COLUMNS.slice(1).length - 1 && "border-r-2"
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                handleCellClick(tracker, fieldName)
                              }}
                            >
                              {isEditing ? (
                                <NumericFormat
                                  value={editValue}
                                  onValueChange={(values) => setEditValue(values.value)}
                                  onBlur={handleBlur}
                                  onKeyDown={handleKeyDown}
                                  thousandSeparator="."
                                  decimalSeparator=","
                                  decimalScale={0}
                                  allowNegative={false}
                                  placeholder="0"
                                  className="flex h-7 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-right ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  autoFocus
                                />
                              ) : (
                                <span className={cn("text-xs", amount > 0 ? "font-medium" : "text-muted-foreground")}>
                                  {amount > 0 ? formatCurrency(amount) : "-"}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        
                        {/* Status - Right Sticky - Red */}
                        <td className="sticky right-[60px] z-20 border-l border-r border-b border-border p-1.5 text-center bg-red-50 w-[90px] min-w-[90px] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50">
                          <Select value={tracker.status} onValueChange={(value) => handleStatusChange(tracker.id, value)}>
                            <SelectTrigger className={cn(
                              "h-7 text-xs border w-full min-w-0",
                              STATUS_OPTIONS.find(s => s.value === tracker.status)?.color
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[100]" position="popper" sideOffset={4}>
                              {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  <span className={cn("px-2 py-1 rounded", status.color)}>
                                    {status.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        
                        {/* Action Column - Right Sticky - Red */}
                        <td className="sticky right-0 z-20 border-b border-border p-2 text-center bg-red-50 w-[60px] min-w-[60px] group-hover:!bg-lime-50 group-focus-within:!bg-lime-50">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-red-100"
                            onClick={(e) => handleDeleteClick(e, tracker.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              
              {/* Totals Footer - Sticky Bottom */}
              <tfoot className="sticky bottom-0 z-30 bg-slate-100 border-t-2 border-slate-300">
                <tr className="font-semibold">
                  {/* ID - Gray */}
                  <td className="sticky left-0 z-40 border-r border-slate-300 p-1.5 bg-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.1)] w-[92px] min-w-[92px]">
                    <span className="text-xs text-slate-700 uppercase tracking-wide">TOTAL</span>
                  </td>
                  
                  {/* Project Name - Gray */}
                  <td className="sticky left-[92px] z-40 border-r border-slate-300 p-1.5 bg-slate-100 min-w-[200px]">
                    <span className="text-xs text-slate-600">{filteredTrackers.length} row(s)</span>
                  </td>
                  
                  {/* Date - Gray */}
                  <td className="sticky left-[292px] z-40 border-r border-slate-300 p-1.5 bg-slate-100 w-[110px] min-w-[110px]">
                    <span className="text-xs text-slate-600">-</span>
                  </td>
                  
                  {/* Total, Expense, PHOTOGRAPHER - Left Sticky - Gray */}
                  <td className="sticky left-[402px] z-40 border-r border-slate-300 p-2.5 text-right bg-slate-100 w-[130px] min-w-[130px] max-w-[130px] shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    <span className="text-sm text-green-700 font-bold">{formatCurrency(totals.totalAmount)}</span>
                  </td>
                  <td className="sticky left-[532px] z-40 border-slate-300 p-2.5 text-right bg-slate-100 w-[130px] min-w-[130px] max-w-[130px]">
                    <span className="text-sm text-green-700 font-semibold">{formatCurrency(totals.expense)}</span>
                  </td>
                  <td className="sticky left-[662px] z-40 border-l border-r border-slate-300 p-2.5 text-right bg-slate-100 w-[130px] min-w-[130px] max-w-[130px]">
                    <span className="text-sm text-green-700 font-semibold">{formatCurrency(totals.photographer)}</span>
                  </td>
                  
                  {/* Product Columns - Gray */}
                  {PRODUCT_COLUMNS.slice(1).map((product, index) => (
                    <td key={product} className={cn(
                      "border-r border-slate-300 p-2.5 text-right bg-slate-100 w-[110px] min-w-[110px]",
                      index === PRODUCT_COLUMNS.slice(1).length - 1 && "border-r-2"
                    )}>
                      <span className="text-sm text-slate-700 font-semibold">
                        {totals[product] > 0 ? formatCurrency(totals[product]) : "-"}
                      </span>
                    </td>
                  ))}
                  
                  {/* Status - Right Sticky - Gray */}
                  <td className="sticky right-[60px] z-40 border-l border-r border-slate-300 p-1.5 text-center bg-slate-100 w-[90px] min-w-[90px] shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">
                    <span className="text-xs text-slate-600">-</span>
                  </td>
                  
                  {/* Action Column - Right Sticky - Gray */}
                  <td className="sticky right-0 z-40 border-slate-300 p-2.5 text-center bg-slate-100 w-[60px] min-w-[60px]">
                    <span className="text-sm text-slate-600">-</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* No search results message - outside table, centered */}
          {!loading && trackers.length > 0 && filteredTrackers.length === 0 && searchQuery.trim() && (
            <div className="text-center py-8 text-muted-foreground">
              No trackers found matching your search.
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !deleting && !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Row?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this production tracker entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
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
    </div>
  )
}
