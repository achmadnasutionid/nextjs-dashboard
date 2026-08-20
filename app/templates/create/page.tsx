"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AutoExpandInput } from "@/components/ui/auto-expand-input"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Save, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatProductName } from "@/lib/utils"
import { scrollToFirstError, findQtyPriceErrors } from "@/lib/form-utils"

interface ItemDetail {
  id: string
  detail: string
  unitPrice: string
  qty: string
  amount: number
}

interface Item {
  id: string
  productName: string
  details: ItemDetail[]
  total: number
}

interface Product {
  id: string
  name: string
}

export default function CreateTemplatePage() {
  const router = useRouter()
  
  const [name, setName] = useState("")
  const [items, setItems] = useState<Item[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [itemErrorsVisible, setItemErrorsVisible] = useState(false)
  const detailRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products")
      if (!response.ok) {
        console.error("Failed to fetch products:", response.statusText)
        setProducts([]) // Set empty array on error
        return
      }
      const data = await response.json()
      // Ensure data is an array
      if (Array.isArray(data)) {
        setProducts(data)
      } else {
        console.error("Products data is not an array:", data)
        setProducts([])
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      setProducts([]) // Set empty array on error
    }
  }

  // Items management
  const addItem = () => {
    const newItemId = crypto.randomUUID()
    setItems([...items, {
      id: newItemId,
      productName: "",
      details: [{
        id: `${newItemId}-detail-${Date.now()}`,
        detail: "",
        unitPrice: "",
        qty: "",
        amount: 0
      }],
      total: 0
    }])
  }

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId))
  }

  const updateItemName = (itemId: string, productName: string) => {
    // Just update the raw name (allow spaces while typing)
    setItems(items.map(item =>
      item.id === itemId ? { ...item, productName } : item
    ))
  }

  const formatItemName = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || !item.productName.trim()) return
    
    // Format on blur: Auto-capitalize if not from master data, normalize spaces
    const finalName = formatProductName(item.productName, products)
    setItems(items.map(item =>
      item.id === itemId ? { ...item, productName: finalName } : item
    ))
  }

  const addDetail = (itemId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          details: [
            ...item.details,
            {
              id: `${itemId}-detail-${Date.now()}`,
              detail: "",
              unitPrice: "",
              qty: "",
              amount: 0
            }
          ]
        }
      }
      return item
    }))
  }

  const removeDetail = (itemId: string, detailId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newDetails = item.details.filter(d => d.id !== detailId)
        const newTotal = newDetails.reduce((sum, d) => sum + d.amount, 0)
        return { ...item, details: newDetails, total: newTotal }
      }
      return item
    }))
  }

  const updateDetail = (itemId: string, detailId: string, field: string, value: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newDetails = item.details.map(detail => {
          if (detail.id === detailId) {
            const updated = { ...detail, [field]: value }
            const unitPrice = parseFloat(updated.unitPrice) || 0
            const qty = parseFloat(updated.qty) || 0
            updated.amount = unitPrice * qty
            return updated
          }
          return detail
        })
        const newTotal = newDetails.reduce((sum, d) => sum + d.amount, 0)
        return { ...item, details: newDetails, total: newTotal }
      }
      return item
    }))
  }

  const priceQtyErrors = findQtyPriceErrors(items)

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Please enter a template name")
      return
    }

    if (items.length === 0) {
      toast.error("Please add at least one product item")
      return
    }

    // Check if all items have product names
    const hasEmptyItems = items.some(item => !item.productName.trim())
    if (hasEmptyItems) {
      toast.error("Please fill in all product names")
      return
    }

    if (Object.keys(priceQtyErrors).length > 0) {
      setItemErrorsVisible(true)
      const refMap: Record<string, { current: HTMLDivElement | null }> = {}
      for (const item of items) {
        for (const detail of item.details) {
          if (priceQtyErrors[detail.id]) {
            refMap[detail.id] = { current: detailRefs.current[detail.id] }
          }
        }
      }
      scrollToFirstError(priceQtyErrors, refMap)
      toast.error("Some items have a unit price but no quantity filled in", {
        description: "Fill in the quantity or clear the price."
      })
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch("/api/quotation-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          items: items.map(item => ({
            productName: item.productName,
            details: item.details.map(detail => ({
              detail: detail.detail,
              unitPrice: detail.unitPrice,
              qty: detail.qty
            }))
          }))
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create template")
      }

      toast.success("Template created successfully")
      router.push("/templates")
    } catch (error) {
      console.error("Error creating template:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create template")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Create Quotation Template"
        showBackButton={true}
        backTo="/templates"
      />
      
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-8">
        <div className="container mx-auto max-w-5xl space-y-6">
          {/* Basic Information */}
          <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Basic Video Package"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Items */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Product Items *</h3>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-md bg-muted p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No items added yet. Click "Add Product" to start.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <Card key={item.id} className="border-2">
                        <CardContent className="space-y-4 pt-4">
                          {/* Product Header */}
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-2">
                              <Label>Product Name</Label>
                              <Input
                                value={item.productName}
                                onChange={(e) => updateItemName(item.id, e.target.value)}
                                onBlur={() => formatItemName(item.id)}
                                placeholder="Type or select product"
                                list={`products-${item.id}`}
                              />
                              <datalist id={`products-${item.id}`}>
                                {products.map((product) => (
                                  <option key={product.id} value={product.name} />
                                ))}
                              </datalist>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              className="mt-8"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          {/* Details Section */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold">Details</Label>

                            {item.details.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">
                                No details added yet. Click "Add Detail" to start.
                              </p>
                            ) : (
                              <>
                                {/* Details Table Header */}
                                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-muted rounded-md text-xs font-bold">
                                  <div>Detail</div>
                                  <div>Unit Price</div>
                                  <div>Qty</div>
                                  <div>Amount</div>
                                  <div className="w-8"></div>
                                </div>

                                {/* Details Rows */}
                                <div className="space-y-2">
                                  {item.details.map((detail) => {
                                    const detailError = itemErrorsVisible ? priceQtyErrors[detail.id] : undefined
                                    return (
                                    <div
                                      key={detail.id}
                                      ref={(el) => { detailRefs.current[detail.id] = el }}
                                      className="space-y-1"
                                    >
                                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                                        <AutoExpandInput
                                          value={detail.detail}
                                          onChange={(e) =>
                                            updateDetail(item.id, detail.id, "detail", e.target.value)
                                          }
                                          placeholder="Enter detail"
                                        />
                                        <CurrencyInput
                                          value={detail.unitPrice}
                                          onValueChange={(value) =>
                                            updateDetail(item.id, detail.id, "unitPrice", value)
                                          }
                                          placeholder="Rp 0"
                                        />
                                        <Input
                                          type="number"
                                          value={detail.qty}
                                          onChange={(e) =>
                                            updateDetail(item.id, detail.id, "qty", e.target.value)
                                          }
                                          placeholder="0"
                                          error={!!detailError}
                                        />
                                        <div className="flex h-11 items-center rounded-md border px-3 text-sm font-medium bg-muted">
                                          {new Intl.NumberFormat('id-ID', {
                                            style: 'currency',
                                            currency: 'IDR',
                                            minimumFractionDigits: 0
                                          }).format(detail.amount)}
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeDetail(item.id, detail.id)}
                                          className="h-9 w-8 p-0"
                                          title="Remove detail"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                      {detailError && (
                                        <p className="text-sm text-destructive">{detailError}</p>
                                      )}
                                    </div>
                                    )
                                  })}
                                </div>
                              </>
                            )}

                            {/* Add Detail Button */}
                            <div className="flex justify-end pt-2">
                              <Button
                                type="button"
                                onClick={() => addDetail(item.id)}
                                variant="outline"
                                size="sm"
                              >
                                <Plus className="mr-2 h-3 w-3" />
                                Add Detail
                              </Button>
                            </div>
                          </div>

                          {/* Product Total */}
                          <div className="flex justify-end border-t pt-3">
                            <div className="text-sm font-semibold">
                              Product Total: <span className="text-primary">{new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                minimumFractionDigits: 0
                              }).format(item.total)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Add Product Button */}
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={addItem} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              </CardContent>
            </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/templates")}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
