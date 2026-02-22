import { Card, CardContent } from "@/components/ui/card"
import { Wallet } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ExtraExpenses } from "@/types"

interface FinancialHealthSectionProps {
  extraExpenses: ExtraExpenses
  selectedYear: string
  availableYears: number[]
  onYearChange: (year: string) => void
  loading: boolean
  formatCurrency: (amount: number) => string
  hideYearFilter?: boolean
}

export function FinancialHealthSection({
  extraExpenses,
  selectedYear,
  availableYears,
  onYearChange,
  loading,
  formatCurrency,
  hideYearFilter = false,
}: FinancialHealthSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Financial Health</h2>
        </div>
        {!hideYearFilter && (
          <Select value={selectedYear} onValueChange={onYearChange}>
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
        )}
      </div>

      {loading ? (
        <>
          <Card className="animate-pulse">
            <CardContent className="pt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-8 w-32 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="animate-pulse border-2">
            <CardContent className="pt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-8 w-32 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Gear Expenses */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Gear Expenses
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600 break-words">
                  {formatCurrency(extraExpenses.gearTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total gear expenses
                </p>
              </div>

              {/* Big Expenses */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Big Expenses
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600 break-words">
                  {formatCurrency(extraExpenses.bigTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total big expenses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
