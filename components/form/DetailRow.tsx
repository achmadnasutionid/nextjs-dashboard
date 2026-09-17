"use client"

import { useEffect } from "react"
import { AutoExpandInput } from "@/components/ui/auto-expand-input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useDebouncedInput } from "@/hooks/use-debounced-input"

/**
 * Shared ItemDetail interface for all document types
 * Used by Quotation, Invoice, Paragon, and Erha
 */
export interface ItemDetail {
  id: string
  detail: string
  unitPrice: string
  qty: string
  amount: number
}

interface DetailRowProps {
  detail: ItemDetail
  itemId: string
  canRemove: boolean
  onUpdate: (itemId: string, detailId: string, field: string, value: string) => void
  onRemove: (itemId: string, detailId: string) => void
  formatCurrency: (amount: number) => string
  error?: string
  rowRef?: (el: HTMLDivElement | null) => void
}

/**
 * Shared DetailRow component for Quotation, Invoice, Paragon, and Erha
 * 
 * Handles item detail editing with:
 * - Debounced inputs for smooth UX
 * - Auto-calculated amount (unitPrice * qty)
 * - Currency formatting
 * - Remove button with validation
 */
export function DetailRow({
  detail,
  itemId,
  canRemove,
  onUpdate,
  onRemove,
  formatCurrency,
  error,
  rowRef
}: DetailRowProps) {
  // Debounced inputs - updates UI instantly, delays state update
  const [localDetail, debouncedDetail, setLocalDetail] = useDebouncedInput(detail.detail, 300)
  const [localPrice, debouncedPrice, setLocalPrice] = useDebouncedInput(detail.unitPrice, 300)
  const [localQty, debouncedQty, setLocalQty] = useDebouncedInput(detail.qty, 300)

  // Update parent state when debounced values change
  useEffect(() => {
    if (debouncedDetail !== detail.detail) {
      onUpdate(itemId, detail.id, "detail", debouncedDetail)
    }
  }, [debouncedDetail, itemId, detail.id, detail.detail, onUpdate])

  useEffect(() => {
    if (debouncedPrice !== detail.unitPrice) {
      onUpdate(itemId, detail.id, "unitPrice", debouncedPrice)
    }
  }, [debouncedPrice, itemId, detail.id, detail.unitPrice, onUpdate])

  useEffect(() => {
    if (debouncedQty !== detail.qty) {
      onUpdate(itemId, detail.id, "qty", debouncedQty)
    }
  }, [debouncedQty, itemId, detail.id, detail.qty, onUpdate])

  return (
    <div
      ref={rowRef}
      className="space-y-1 rounded-md border p-3 sm:border-0 sm:p-0"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">
            Detail
          </label>
          <AutoExpandInput
            value={localDetail}
            onChange={(e) => setLocalDetail(e.target.value)}
            placeholder="Enter detail"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">
              Unit Price
            </label>
            <CurrencyInput
              value={localPrice}
              onValueChange={setLocalPrice}
              placeholder="Rp 0"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">
              Qty
            </label>
            <Input
              type="number"
              value={localQty}
              onChange={(e) => setLocalQty(e.target.value)}
              placeholder="0"
              error={!!error}
            />
          </div>
        </div>
        <div className="flex items-end gap-2 sm:contents">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">
              Amount
            </label>
            <div className="flex h-11 items-center rounded-md border px-3 text-sm font-medium bg-muted">
              {formatCurrency(detail.amount)}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(itemId, detail.id)}
            className="h-9 w-8 p-0"
            disabled={!canRemove}
            title={!canRemove ? "Cannot remove the last detail" : "Remove detail"}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
