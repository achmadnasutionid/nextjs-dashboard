import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Calendar,
  FileCheck,
  Receipt,
  Wallet,
  Building2,
  FileText,
  FileSignature,
  Package,
  PackageOpen,
  Table,
  Database,
  Trash2,
} from "lucide-react"
import type { DashboardCard } from "@/types"

/**
 * Get icon component by icon name
 * Shared helper for all dashboard card sections
 */
function getIcon(iconName: string, className = "h-6 w-6 text-primary") {
  switch (iconName) {
    case "calendar":
      return <Calendar className={className} />
    case "file-check":
      return <FileCheck className={className} />
    case "receipt":
      return <Receipt className={className} />
    case "wallet":
      return <Wallet className={className} />
    case "building":
      return <Building2 className={className} />
    case "file-text":
      return <FileText className={className} />
    case "file-signature":
      return <FileSignature className={className} />
    case "package":
      return <Package className={className} />
    case "package-open":
      return <PackageOpen className={className} />
    case "table":
      return <Table className={className} />
    case "database":
      return <Database className={className} />
    case "trash":
      return <Trash2 className={className} />
    default:
      return <Package className={className} />
  }
}

interface QuickActionSectionProps {
  cards: DashboardCard[]
  onNavigate: (path: string) => void
}

const QUICK_ACTION_STYLES: Record<string, { card: string; iconWrap: string; icon: string }> = {
  quotation: {
    card: "bg-green-50 border-green-200 hover:border-green-400 hover:shadow-lg dark:bg-green-950/40 dark:border-green-900",
    iconWrap: "bg-green-100 group-hover:bg-green-200 dark:bg-green-900 dark:group-hover:bg-green-800",
    icon: "text-green-600 dark:text-green-100",
  },
  invoice: {
    card: "bg-blue-50 border-blue-200 hover:border-blue-400 hover:shadow-lg dark:bg-blue-950/40 dark:border-blue-900",
    iconWrap: "bg-blue-100 group-hover:bg-blue-200 dark:bg-blue-900 dark:group-hover:bg-blue-800",
    icon: "text-blue-600 dark:text-blue-100",
  },
}

export function QuickActionSection({ cards, onNavigate }: QuickActionSectionProps) {
  if (cards.length === 0) return null

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Quick Action</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {cards.map((card) => {
          const style = QUICK_ACTION_STYLES[card.id]
          return (
            <Card
              key={card.id}
              className={`group cursor-pointer transition-all ${style?.card ?? "hover:shadow-lg hover:border-primary/50"}`}
              onClick={() => onNavigate(card.route)}
            >
              <CardHeader className="py-10">
                <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-lg transition-colors ${style?.iconWrap ?? "bg-primary/10 group-hover:bg-primary/20"}`}>
                  {getIcon(card.icon, `h-8 w-8 ${style?.icon ?? "text-primary"}`)}
                </div>
                <CardTitle className="text-2xl">{card.title}</CardTitle>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

interface CardsSectionProps {
  cards: DashboardCard[]
  sectionTitle: "Special Case" | "Management"
  onNavigate: (path: string) => void
}

export function CardsSection({ cards, sectionTitle, onNavigate }: CardsSectionProps) {
  if (cards.length === 0) return null

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">{sectionTitle}</h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.id}
            className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
            onClick={() => onNavigate(card.route)}
          >
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                {getIcon(card.icon)}
              </div>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
