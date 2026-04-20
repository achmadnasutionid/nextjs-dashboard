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
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type CopyDocumentChoice =
  | { mode: "general" }
  | { mode: "downPayment"; percentage: number }

type CopyModeOption = "general" | "downPayment"

export function CopyDocumentDialog({
  open,
  onOpenChange,
  copying,
  title,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  copying: boolean
  title: string
  onConfirm: (choice: CopyDocumentChoice) => void
}) {
  const [mode, setMode] = useState<CopyModeOption>("general")
  const [pct, setPct] = useState("")

  useEffect(() => {
    if (!open) {
      setMode("general")
      setPct("")
    }
  }, [open])

  const handleConfirm = () => {
    if (mode === "downPayment") {
      const n = parseFloat(pct.replace(",", "."))
      if (Number.isNaN(n) || n <= 0 || n > 100) {
        toast.error("Enter a percentage greater than 0 and at most 100.")
        return
      }
      onConfirm({ mode: "downPayment", percentage: n })
      return
    }
    onConfirm({ mode: "general" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            General copies amounts as-is. Down payment scales every line on the new
            document and adds a matching deduction line on the original so its total
            reflects the amount still owed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={copying}
              onClick={() => setMode("general")}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
                mode === "general"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              )}
            >
              General
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Copy all items and amounts
              </span>
            </button>
            <button
              type="button"
              disabled={copying}
              onClick={() => setMode("downPayment")}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
                mode === "downPayment"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              )}
            >
              Down payment
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Scale all rows by this %
              </span>
            </button>
          </div>
          {mode === "downPayment" && (
            <div className="grid gap-2">
              <Label htmlFor="copy-dp-percent">Percentage of original total</Label>
              <Input
                id="copy-dp-percent"
                type="number"
                min={0.01}
                max={100}
                step="any"
                inputMode="decimal"
                placeholder="e.g. 30"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                disabled={copying}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={copying}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={copying}>
            {copying ? "Copying…" : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
