"use client"

import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Receipt } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Dashboard components
import { QuickActionSection, CardsSection } from "@/components/dashboard/cards-section"

// Types
import type { DashboardCard } from "@/types"
import { saveBackupToCache } from "@/lib/backup-cache"

// Dashboard cards configuration
const ALL_CARDS: DashboardCard[] = [
  // Quick Action
  { id: "quotation", section: "Quick Action", title: "Quotation", keywords: "quotation quote qtn", route: "/quotation", icon: "file-check" },
  { id: "invoice", section: "Quick Action", title: "Invoice", keywords: "invoice inv payment bill", route: "/invoice", icon: "receipt" },
  { id: "production-tracker", section: "Quick Action", title: "Tracker", keywords: "tracker production entry actual", route: "/special-case/production-tracker", icon: "table" },
  
  // Special Case
  { id: "paragon", section: "Special Case", title: "Paragon", keywords: "paragon special", route: "/special-case/paragon", icon: "building" },
  { id: "erha", section: "Special Case", title: "Erha", keywords: "erha special", route: "/special-case/erha", icon: "building" },
  { id: "gear-expenses", section: "Special Case", title: "Gear Expenses", keywords: "gear expenses equipment", route: "/special-case/gear-expenses", icon: "wallet" },
  { id: "big-expenses", section: "Special Case", title: "Big Expenses", keywords: "big expenses large", route: "/special-case/big-expenses", icon: "wallet" },
  
  // Management
  { id: "companies", section: "Management", title: "Companies", keywords: "companies company client master", route: "/companies", icon: "building" },
  { id: "billings", section: "Management", title: "Billings", keywords: "billings billing bank account master", route: "/billings", icon: "file-text" },
  { id: "signatures", section: "Management", title: "Signatures", keywords: "signatures signature sign master", route: "/signatures", icon: "file-signature" },
  { id: "products", section: "Management", title: "Products", keywords: "products product master", route: "/products", icon: "package" },
  { id: "templates", section: "Management", title: "Templates", keywords: "templates template quotation master", route: "/templates", icon: "package-open" },
]

export default function Home() {
  const router = useRouter()
  
  // State management
  const [searchQuery, setSearchQuery] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [pendingTotals, setPendingTotals] = useState<{ years: number[]; byYear: Record<string, number> } | null>(null)
  const [selectedPendingYear, setSelectedPendingYear] = useState<string>("")

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch pending invoice totals by year (same data as invoice list: Invoice + Paragon + Erha)
  useEffect(() => {
    if (!isClient) return
    fetch("/api/invoice/pending-totals-by-year")
      .then((res) => res.json())
      .then((data) => {
        if (data.years && data.byYear) {
          setPendingTotals({ years: data.years, byYear: data.byYear })
          setSelectedPendingYear(data.years.length > 0 ? String(data.years[0]) : "all")
        }
      })
      .catch(() => {})
  }, [isClient])

  const pendingDisplayAmount = useMemo(() => {
    if (!pendingTotals?.byYear) return 0
    if (selectedPendingYear === "all") {
      return Object.values(pendingTotals.byYear).reduce((a, b) => a + b, 0)
    }
    return pendingTotals.byYear[selectedPendingYear] ?? 0
  }, [pendingTotals, selectedPendingYear])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

  // First landing: trigger backup if not run in last 24h; cache 1 day so we don't call every visit.
  // When backup is triggered, backup data is returned and stored in IndexedDB (copy off the DB).
  useEffect(() => {
    if (!isClient) return
    const CACHE_KEY = "backup_trigger_until"
    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(CACHE_KEY) : null
    const until = cached ? parseInt(cached, 10) : 0
    if (Date.now() < until) return
    fetch("/api/backup/trigger")
      .then((res) => res.json())
      .then((body) => {
        if (body.triggered || body.nextEligibleAt) {
          sessionStorage.setItem(CACHE_KEY, String(Date.now() + ONE_DAY_MS))
        }
        if (body.backupData) {
          saveBackupToCache(body.backupData).catch(() => {})
        }
      })
      .catch(() => {})
  }, [isClient])

  // Navigation handler
  const handleNavigate = (path: string) => {
    router.push(path)
  }

  // Filter cards based on search
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return ALL_CARDS
    const query = searchQuery.toLowerCase()
    return ALL_CARDS.filter(
      (card) =>
        card.title.toLowerCase().includes(query) ||
        card.keywords.toLowerCase().includes(query) ||
        card.section.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // Group cards by section
  const cardsBySection = useMemo(() => {
    const sections: { [key: string]: DashboardCard[] } = {
      "Quick Action": [],
      "Special Case": [],
      Management: [],
    }
    filteredCards.forEach((card) => {
      sections[card.section].push(card)
    })
    return sections
  }, [filteredCards])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 pt-8 pb-12">
        <div className="container mx-auto max-w-7xl space-y-8">
          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search pages... (e.g., invoice, quotation, products)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </Button>
            )}
          </div>

          {/* No results message */}
          {searchQuery && filteredCards.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No pages found matching &quot;{searchQuery}&quot;
              </p>
              <Button
                variant="link"
                onClick={() => setSearchQuery("")}
                className="mt-2"
              >
                Clear search
              </Button>
            </Card>
          )}

          {/* Quick Action Section */}
          {cardsBySection["Quick Action"].length > 0 && (
            <QuickActionSection
              cards={cardsBySection["Quick Action"]}
              onNavigate={handleNavigate}
            />
          )}

          {/* Special Case Section */}
          {cardsBySection["Special Case"].length > 0 && (
            <CardsSection
              cards={cardsBySection["Special Case"]}
              sectionTitle="Special Case"
              onNavigate={handleNavigate}
            />
          )}

          {/* Pending Invoices by Year - under Special Case */}
          {isClient && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight">Pending Invoices</h2>
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={selectedPendingYear || "all"}
                    onValueChange={setSelectedPendingYear}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {(pendingTotals?.years ?? []).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Card
                className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 max-w-md"
                onClick={() => handleNavigate("/invoice?status=pending")}
              >
                <div className="p-6">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Receipt className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-2xl font-semibold">
                    {pendingTotals ? formatCurrency(pendingDisplayAmount) : "—"}
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* Management Section */}
          {cardsBySection["Management"].length > 0 && (
            <CardsSection
              cards={cardsBySection["Management"]}
              sectionTitle="Management"
              onNavigate={handleNavigate}
            />
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
