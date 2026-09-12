"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

interface TemplateDetail {
  detail: string
  unitPrice: number
  qty: number
}

interface TemplateItem {
  id: string
  productName: string
  details: TemplateDetail[]
}

interface QuotationTemplate {
  id: string
  name: string
  description: string | null
  items: TemplateItem[]
  createdAt: string
  updatedAt: string
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<QuotationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<QuotationTemplate | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/quotation-templates")
      
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Ensure data is an array before setting it
      if (Array.isArray(data)) {
        setTemplates(data)
      } else {
        console.error("Invalid data format received:", data)
        toast.error("Invalid data format received from server")
        setTemplates([])
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
      toast.error("Failed to load templates")
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!templateToDelete) return

    try {
      const response = await fetch(`/api/quotation-templates/${templateToDelete.id}`, {
        method: "DELETE"
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast.success("Template deleted successfully")
      setTemplates(templates.filter(t => t.id !== templateToDelete.id))
    } catch (error) {
      console.error("Error deleting template:", error)
      toast.error("Failed to delete template")
    } finally {
      setDeleteDialogOpen(false)
      setTemplateToDelete(null)
    }
  }

  const calculateEstimatedTotal = (items: TemplateItem[]) => {
    return items.reduce((total, item) => {
      const itemTotal = item.details.reduce((sum, detail) => {
        return sum + (detail.unitPrice * detail.qty)
      }, 0)
      return total + itemTotal
    }, 0)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Quotation Templates"
        showBackButton={true}
        backTo="/"
      />
      
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        <div className="container mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold tracking-tight">Template List</h2>
            <Button onClick={() => router.push("/templates/create")} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>

          {/* Templates Grid */}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              type="templates"
              actionLabel="Create Template"
              onAction={() => router.push("/templates/create")}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const estimatedTotal = calculateEstimatedTotal(template.items)
                
                return (
                  <Card 
                    key={template.id}
                    className="hover:shadow-lg transition-all"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Stats */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Items:</span>
                            <span className="font-medium">{template.items.length}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Est. Value:</span>
                            <span className="font-medium">{formatCurrency(estimatedTotal)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => router.push(`/templates/${template.id}/edit`)}
                          >
                            <Pencil className="mr-2 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setTemplateToDelete(template)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
