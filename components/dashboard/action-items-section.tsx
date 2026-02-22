import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Receipt, Clock, FileX } from "lucide-react"
import type { ActionItems } from "@/types"

interface ActionItemsSectionProps {
  actionItems: ActionItems
  loading: boolean
  formatCurrency: (amount: number) => string
  onNavigate: (path: string) => void
}

export function ActionItemsSection({
  actionItems,
  loading,
  formatCurrency,
  onNavigate,
}: ActionItemsSectionProps) {
  if (loading) return null

  const totalItems =
    actionItems.pendingInvoices.count +
    actionItems.pendingQuotations.count

  if (totalItems === 0) return null

  const activeCount =
    (actionItems.pendingInvoices.count > 0 ? 1 : 0) +
    (actionItems.pendingQuotations.count > 0 ? 1 : 0)

  const gridCols = activeCount === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-orange-600" />
        <h2 className="text-xl font-bold tracking-tight">Action Items</h2>
        <span className="text-sm text-muted-foreground">
          ({totalItems} items need attention)
        </span>
      </div>

      <div className={`grid gap-6 ${gridCols}`}>
        {/* Pending Invoices */}
        {actionItems.pendingInvoices.count > 0 && (
          <Card
            className="group cursor-pointer transition-all hover:shadow-lg hover:border-blue-500/50"
            onClick={() => onNavigate("/invoice?status=pending")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base">Pending Invoices</CardTitle>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {actionItems.pendingInvoices.count}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground">
                    Total Amount:
                  </span>
                  <span className="text-lg font-semibold text-blue-700">
                    {formatCurrency(actionItems.pendingInvoices.totalAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Quotations */}
        {actionItems.pendingQuotations.count > 0 && (
          <Card
            className="group cursor-pointer transition-all hover:shadow-lg hover:border-yellow-500/50"
            onClick={() => onNavigate("/quotation?status=pending")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <CardTitle className="text-base">
                    Pending Quotations
                  </CardTitle>
                </div>
                <span className="text-2xl font-bold text-yellow-600">
                  {actionItems.pendingQuotations.count}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actionItems.pendingQuotations.items
                  .slice(0, 2)
                  .map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-muted-foreground truncate flex-1">
                        {q.quotationId}
                      </span>
                      <span className="text-yellow-700 font-medium whitespace-nowrap ml-2">
                        {q.daysSinceUpdate}d ago
                      </span>
                    </div>
                  ))}
                {actionItems.pendingQuotations.count > 2 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    +{actionItems.pendingQuotations.count - 2} more
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
