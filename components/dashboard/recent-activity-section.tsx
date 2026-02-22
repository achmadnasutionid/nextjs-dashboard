import { Card, CardContent } from "@/components/ui/card"
import { Activity, Receipt, FileCheck, Wallet, Calendar } from "lucide-react"
import type { RecentActivity } from "@/types"

interface RecentActivitySectionProps {
  activities: RecentActivity[]
  loading: boolean
  onNavigate: (path: string) => void
  getRelativeTime: (date: string) => string
}

export function RecentActivitySection({
  activities,
  loading,
  onNavigate,
  getRelativeTime,
}: RecentActivitySectionProps) {
  if (loading || activities.length === 0) return null

  const getActivityLink = (activity: RecentActivity) => {
    switch (activity.type) {
      case "invoice":
        return `/invoice/${activity.id}/view`
      case "quotation":
        return `/quotation/${activity.id}/view`
      default:
        return "#"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight">Recent Activity</h2>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid gap-2 lg:grid-cols-2">
            {activities.map((activity, index) => (
              <div
                key={`${activity.type}-${activity.id}-${index}`}
                className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors"
                onClick={() => onNavigate(getActivityLink(activity))}
              >
                {/* Icon */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                    activity.color === "green"
                      ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-100"
                      : activity.color === "blue"
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-100"
                      : activity.color === "yellow"
                      ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-100"
                      : activity.color === "orange"
                      ? "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-100"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {activity.icon === "receipt" && <Receipt className="h-4 w-4" />}
                  {activity.icon === "file-check" && (
                    <FileCheck className="h-4 w-4" />
                  )}
                  {activity.icon === "wallet" && <Wallet className="h-4 w-4" />}
                  {activity.icon === "calendar" && <Calendar className="h-4 w-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-semibold">
                      {activity.type.charAt(0).toUpperCase() +
                        activity.type.slice(1)}
                    </span>{" "}
                    <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                      {activity.displayId}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {activity.action}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {getRelativeTime(activity.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
