"use client"

import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Receipt, Wallet, TrendingUp } from "lucide-react"
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
  { id: "backup", section: "Management", title: "Backup", keywords: "backup export import restore", route: "/backup", icon: "database" },
]

export default function Home() {
  const router = useRouter()
  
  // State management
  const [searchQuery, setSearchQuery] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [pendingProfitTotals, setPendingProfitTotals] = useState<{ years: number[]; byYear: Record<string, number> } | null>(null)
  const [pendingProfitMissingIds, setPendingProfitMissingIds] = useState<string[]>([])
  const [gearTotals, setGearTotals] = useState<{ years: number[]; byYear: Record<string, number> } | null>(null)
  const [bigTotals, setBigTotals] = useState<{ years: number[]; byYear: Record<string, number> } | null>(null)
  const [profitTotals, setProfitTotals] = useState<{ years: number[]; byYear: Record<string, number> } | null>(null)
  const [selectedFinanceYear, setSelectedFinanceYear] = useState<string>("")

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch Finance Overview data: pending profit, profit, gear, big expense totals by year
  useEffect(() => {
    if (!isClient) return
    Promise.all([
      fetch("/api/invoice/pending-profit-by-year").then((r) => r.json()),
      fetch("/api/invoice/profit-totals-by-year").then((r) => r.json()),
      fetch("/api/gear-expenses/totals-by-year").then((r) => r.json()),
      fetch("/api/big-expenses/totals-by-year").then((r) => r.json()),
    ]).then(([pendingProfit, profit, gear, big]) => {
      if (pendingProfit?.years && pendingProfit?.byYear) setPendingProfitTotals({ years: pendingProfit.years, byYear: pendingProfit.byYear })
      if (pendingProfit?.missingIds) setPendingProfitMissingIds(pendingProfit.missingIds)
      if (profit?.years && profit?.byYear) setProfitTotals({ years: profit.years, byYear: profit.byYear })
      if (gear?.years && gear?.byYear) setGearTotals({ years: gear.years, byYear: gear.byYear })
      if (big?.years && big?.byYear) setBigTotals({ years: big.years, byYear: big.byYear })
      const allYears = [
        ...new Set([
          ...(pendingProfit?.years ?? []),
          ...(profit?.years ?? []),
          ...(gear?.years ?? []),
          ...(big?.years ?? []),
        ]),
      ].sort((a, b) => b - a)
      setSelectedFinanceYear((prev) => (prev ? prev : allYears.length > 0 ? String(allYears[0]) : "all"))
    })
  }, [isClient])

  const financeYears = useMemo(() => {
    const set = new Set<number>()
    pendingProfitTotals?.years.forEach((y) => set.add(y))
    profitTotals?.years.forEach((y) => set.add(y))
    gearTotals?.years.forEach((y) => set.add(y))
    bigTotals?.years.forEach((y) => set.add(y))
    return Array.from(set).sort((a, b) => b - a)
  }, [pendingProfitTotals, profitTotals, gearTotals, bigTotals])

  const pendingProfitDisplayAmount = useMemo(() => {
    if (!pendingProfitTotals?.byYear) return 0
    if (selectedFinanceYear === "all") return Object.values(pendingProfitTotals.byYear).reduce((a, b) => a + b, 0)
    return pendingProfitTotals.byYear[selectedFinanceYear] ?? 0
  }, [pendingProfitTotals, selectedFinanceYear])

  const gearDisplayAmount = useMemo(() => {
    if (!gearTotals?.byYear) return 0
    if (selectedFinanceYear === "all") return Object.values(gearTotals.byYear).reduce((a, b) => a + b, 0)
    return gearTotals.byYear[selectedFinanceYear] ?? 0
  }, [gearTotals, selectedFinanceYear])

  const bigDisplayAmount = useMemo(() => {
    if (!bigTotals?.byYear) return 0
    if (selectedFinanceYear === "all") return Object.values(bigTotals.byYear).reduce((a, b) => a + b, 0)
    return bigTotals.byYear[selectedFinanceYear] ?? 0
  }, [bigTotals, selectedFinanceYear])

  const profitDisplayAmount = useMemo(() => {
    if (!profitTotals?.byYear) return 0
    if (selectedFinanceYear === "all") return Object.values(profitTotals.byYear).reduce((a, b) => a + b, 0)
    return profitTotals.byYear[selectedFinanceYear] ?? 0
  }, [profitTotals, selectedFinanceYear])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

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

          {/* Finance Overview - under Special Case */}
          {isClient && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight">Finance Overview</h2>
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={selectedFinanceYear || "all"}
                    onValueChange={setSelectedFinanceYear}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {financeYears.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Card
                  className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
                  onClick={() => handleNavigate("/invoice?status=pending")}
                >
                  <div className="p-6">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Receipt className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Pending profit</h3>
                    <p className="text-2xl font-semibold">
                      {pendingProfitTotals ? formatCurrency(pendingProfitDisplayAmount) : "—"}
                    </p>
                  </div>
                </Card>
                <Card
                  className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
                  onClick={() => handleNavigate("/invoice?status=paid")}
                >
                  <div className="p-6">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Profit</h3>
                    <p className="text-2xl font-semibold">
                      {profitTotals ? formatCurrency(profitDisplayAmount) : "—"}
                    </p>
                  </div>
                </Card>
                <Card className="transition-all">
                  <div className="p-6">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Wallet className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Expenses</h3>
                    <p className="text-2xl font-semibold">
                      {(gearTotals || bigTotals) ? formatCurrency(gearDisplayAmount + bigDisplayAmount) : "—"}
                    </p>
                  </div>
                </Card>
                {pendingProfitMissingIds.length > 0 && (
                  <Card
                    className="group cursor-pointer transition-all hover:shadow-lg hover:border-amber-500/50"
                    onClick={() => handleNavigate(`/invoice?status=pending&search=${encodeURIComponent(pendingProfitMissingIds.join(","))}`)}
                  >
                    <div className="p-6">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                        <Receipt className="h-6 w-6 text-amber-600" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Pending without tracker</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        {pendingProfitMissingIds.length} invoice(s) have no tracker data
                      </p>
                      <p className="text-xs text-amber-600 font-medium">Click to open filtered list</p>
                    </div>
                  </Card>
                )}
              </div>
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
