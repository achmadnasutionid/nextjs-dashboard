"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface DownPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (percentage: number) => void
  initialPercentage?: number | null
}

export function DownPaymentModal({
  open,
  onOpenChange,
  onConfirm,
  initialPercentage,
}: DownPaymentModalProps) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(initialPercentage != null ? String(initialPercentage) : "")
      setError(null)
    }
  }, [open, initialPercentage])

  const handleConfirm = () => {
    const trimmed = value.trim()
    if (trimmed === "") {
      setError("Please enter down payment percentage.")
      return
    }

    const num = Number.parseFloat(trimmed)
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setError("Please enter a valid percentage between 0 and 100.")
      return
    }

    setError(null)
    onConfirm(num)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set down payment percentage</DialogTitle>
          <DialogDescription>
            Down payment is calculated from total amount after tax.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="down-payment-percentage">Down Payment (%)</Label>
            <Input
              id="down-payment-percentage"
              type="number"
              min="0"
              max="100"
              step="any"
              placeholder="e.g. 50"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
