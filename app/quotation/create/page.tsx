"use client"

import { useEffect, useState, useRef } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AutoExpandInput } from "@/components/ui/auto-expand-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Save, CheckCircle, Plus, Trash2, GripVertical } from "lucide-react"
import { SortableItems } from "@/components/ui/sortable-items"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { TemplateSelectionModal } from "@/components/ui/template-selection-modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PPH_OPTIONS } from "@/lib/constants"
import { formatProductName } from "@/lib/utils"
import { scrollToFirstError } from "@/lib/form-utils"
import { ReorderableSummary } from "@/components/ui/reorderable-summary"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { ReorderableRemarks } from "@/components/ui/reorderable-remarks"

interface Company {
  id: string
  name: string
  address: string
  city: string
  province: string
  postalCode?: string
  telp?: string
  email?: string
}

interface Billing {
  id: string
  name: string
  bankName: string
  bankAccount: string
  bankAccountName: string
  ktp?: string
  npwp?: string
}

interface Signature {
  id: string
  name: string
  role?: string
  imageData: string
}

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

interface Remark {
  id: string
  text: string
  isCompleted: boolean
}

interface CustomSignature {
  id: string
  name: string
  position: string
}

const SUMMARY_ITEM_IDS = ["subtotal", "pph", "downPayment", "total"] as const
type SummaryItemId = (typeof SUMMARY_ITEM_IDS)[number]

function normalizeSummaryOrder(input?: string[] | null): SummaryItemId[] {
  const values = Array.isArray(input) ? input : []
  const valid = values.filter((value): value is SummaryItemId =>
    (SUMMARY_ITEM_IDS as readonly string[]).includes(value)
  )
  const unique = Array.from(new Set(valid))
  const missing = SUMMARY_ITEM_IDS.filter((id) => !unique.includes(id))
  return [...unique, ...missing]
}

export default function CreateQuotationPage() {
  const router = useRouter()
  
  // Template selection
  const [showTemplateModal, setShowTemplateModal] = useState(true)
  const [templateSelected, setTemplateSelected] = useState(false)
  
  // Form fields
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productionDate, setProductionDate] = useState<Date>()
  const [billTo, setBillTo] = useState("")
  const [notes, setNotes] = useState("")
  const [remarks, setRemarks] = useState<Remark[]>([
    { id: "1", text: "Terms & Conditions :", isCompleted: false },
    { id: "2", text: "* Overtime Production Shooting Day 10 % dari Fee invoice", isCompleted: false },
    { id: "3", text: "* Quotation is valid for 7 days from the issue date.", isCompleted: false },
    { id: "4", text: "* 50% down payment must be paid at least 1 day before the first project meeting. The remaining 50% is paid after the project is finished.", isCompleted: false },
    { id: "5", text: "* More than 3 revisions per frame will be charged extra.", isCompleted: false },
    { id: "6", text: "Penalty will be applied if client use our Photo & Videshoot without our consent for printed media placement outside the initial agreement :", isCompleted: false },
    { id: "7", text: "* Small Ussage ( Flyer, Katalog, Brosur, Kupon, Kotak Gift, Booklet PR Package, Kartu Ucapan ) 15% dari invoice awal", isCompleted: false },
    { id: "8", text: "* Medium Ussage (POP, TV Store, TV Led Instore, both, bazaar, Backwall, Wobler, add 20%", isCompleted: false },
    { id: "9", text: "* Big Print (Billboard, OOH Outdoor, LED Screen Outdoor, Megatron, Umbull, dll) 50% + tnc berlanjut", isCompleted: false },
    { id: "10", text: "* Additional overseas media placement (digital and printed) will be charged .(bisa di edit) % of total", isCompleted: false },
  ])
  const [termsAndConditions, setTermsAndConditions] = useState("")
  const [showTerms, setShowTerms] = useState(false)
  const [selectedBillingId, setSelectedBillingId] = useState("")
  const [selectedSignatureId, setSelectedSignatureId] = useState("")
  const [pph, setPph] = useState("2") // Auto-select PPH 23 2%
  const [items, setItems] = useState<Item[]>([])
  const [customSignatures, setCustomSignatures] = useState<CustomSignature[]>([])
  const [showSignatures, setShowSignatures] = useState(false)
  const [summaryOrder, setSummaryOrder] = useState<SummaryItemId[]>(normalizeSummaryOrder())
  const [adjustmentPercentage, setAdjustmentPercentage] = useState<number | null>(null)
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>("")
  const [downPaymentPercentage, setDownPaymentPercentage] = useState<number | null>(null)
  
  // Master data
  const [companies, setCompanies] = useState<Company[]>([])
  const [billings, setBillings] = useState<Billing[]>([])
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [productDetails, setProductDetails] = useState<any[]>([])
  
  // UI state
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<any>({})
  const [hasInteracted, setHasInteracted] = useState(false)

  // Refs for error scrolling
  const companyRef = useRef<HTMLDivElement>(null)
  const productionDateRef = useRef<HTMLDivElement>(null)
  const billToRef = useRef<HTMLDivElement>(null)
  const billingRef = useRef<HTMLDivElement>(null)
  const signatureRef = useRef<HTMLDivElement>(null)

  // Fetch master data
  useEffect(() => {
    Promise.all([
      fetch("/api/companies").then(res => res.json()),
      fetch("/api/billings").then(res => res.json()),
      fetch("/api/signatures").then(res => res.json()),
      fetch("/api/products").then(res => res.json()),
    ]).then(([companiesData, billingsData, signaturesData, productsData]) => {
      setCompanies(companiesData)
      setBillings(billingsData)
      setSignatures(signaturesData)
      setProducts(productsData.map((p: any) => p.name))
      setProductDetails(productsData) // Store full product objects with details
    }).catch(console.error)
  }, [])

  const markInteracted = () => {
    if (!hasInteracted) {
      setHasInteracted(true)
    }
  }

  // Unsaved changes dialog
  const {
    showDialog: showUnsavedDialog,
    setShowDialog: setShowUnsavedDialog,
    isSaving: isSavingDraft,
    interceptNavigation,
    handleSaveAndLeave,
    handleLeaveWithoutSaving
  } = useUnsavedChanges({
    hasUnsavedChanges: hasInteracted,
    onSave: async () => {
      await handleSubmit("draft")
    },
    enabled: true
  })

  // Handle template selection
  const handleTemplateSelect = (templates: any[] | null) => {
    setTemplateSelected(true)
    
    if (templates && templates.length > 0) {
      // Merge all template items in the order templates were selected
      const allFormItems: Item[] = []
      
      templates.forEach((template: any) => {
        const templateItems = template.items.map((item: any) => ({
          id: `${Date.now()}-${Math.random()}`,
          productName: item.productName,
          details: item.details.map((detail: any) => ({
            id: `detail-${Date.now()}-${Math.random()}`,
            detail: detail.detail,
            unitPrice: detail.unitPrice.toString(),
            qty: detail.qty.toString(),
            amount: detail.unitPrice * detail.qty
          })),
          total: item.details.reduce((sum: number, d: any) => sum + (d.unitPrice * d.qty), 0)
        }))
        
        allFormItems.push(...templateItems)
      })
      
      setItems(allFormItems)
      
      const templateNames = templates.map(t => t.name).join(', ')
      toast.success(`${templates.length} template(s) loaded: ${templateNames}`)
    }
  }

  // Remark management
  const addRemark = () => {
    markInteracted()
    setRemarks([...remarks, {
      id: crypto.randomUUID(),
      text: "",
      isCompleted: false
    }])
  }

  const resetToDefaultRemarks = () => {
    markInteracted()
    setRemarks([
      { id: "1", text: "Terms & Conditions :", isCompleted: false },
      { id: "2", text: "* Overtime Production Shooting Day 10 % dari Fee invoice", isCompleted: false },
      { id: "3", text: "* Quotation is valid for 7 days from the issue date.", isCompleted: false },
      { id: "4", text: "* 50% down payment must be paid at least 1 day before the first project meeting. The remaining 50% is paid after the project is finished.", isCompleted: false },
      { id: "5", text: "* More than 3 revisions per frame will be charged extra.", isCompleted: false },
      { id: "6", text: "Penalty will be applied if client use our Photo & Videshoot without our consent for printed media placement outside the initial agreement :", isCompleted: false },
      { id: "7", text: "* Small Ussage ( Flyer, Katalog, Brosur, Kupon, Kotak Gift, Booklet PR Package, Kartu Ucapan ) 15% dari invoice awal", isCompleted: false },
      { id: "8", text: "* Medium Ussage (POP, TV Store, TV Led Instore, both, bazaar, Backwall, Wobler, add 20%", isCompleted: false },
      { id: "9", text: "* Big Print (Billboard, OOH Outdoor, LED Screen Outdoor, Megatron, Umbull, dll) 50% + tnc berlanjut", isCompleted: false },
      { id: "10", text: "* Additional overseas media placement (digital and printed) will be charged .(bisa di edit) % of total", isCompleted: false },
    ])
  }

  const removeRemark = (id: string) => {
    markInteracted()
    setRemarks(remarks.filter(remark => remark.id !== id))
  }

  const updateRemarkText = (id: string, text: string) => {
    markInteracted()
    setRemarks(remarks.map(remark =>
      remark.id === id ? { ...remark, text } : remark
    ))
  }

  const toggleRemarkCompleted = (id: string) => {
    markInteracted()
    setRemarks(remarks.map(remark =>
      remark.id === id ? { ...remark, isCompleted: !remark.isCompleted } : remark
    ))
  }

  // Custom signature management
  const addCustomSignature = () => {
    markInteracted()
    setShowSignatures(true)
    setCustomSignatures([...customSignatures, {
      id: crypto.randomUUID(),
      name: "",
      position: ""
    }])
  }

  const removeCustomSignature = (id: string) => {
    markInteracted()
    const newSignatures = customSignatures.filter(sig => sig.id !== id)
    setCustomSignatures(newSignatures)
    if (newSignatures.length === 0) {
      setShowSignatures(false)
    }
  }

  const updateCustomSignature = (id: string, field: 'name' | 'position', value: string) => {
    markInteracted()
    setCustomSignatures(customSignatures.map(sig =>
      sig.id === id ? { ...sig, [field]: value } : sig
    ))
  }

  // Item management
  const addItem = () => {
    markInteracted()
    const newItemId = Date.now().toString()
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

  const handleReorderItems = (reorderedItems: Item[]) => {
    markInteracted()
    setItems(reorderedItems)
  }

  const removeItem = (itemId: string) => {
    markInteracted()
    setItems(items.filter(item => item.id !== itemId))
  }

  const updateItemName = (itemId: string, productName: string) => {
    markInteracted()
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
    
    // Check if this product exists in master data and has details
    const masterProduct = productDetails.find((p: any) => 
      p.name.toLowerCase() === finalName.toLowerCase()
    )
    
    setItems(items.map(item => {
      if (item.id !== itemId) return item
      
      // If master product has details, auto-fill them
      if (masterProduct && masterProduct.details && masterProduct.details.length > 0) {
        const autoFilledDetails = masterProduct.details.map((detail: any) => ({
          id: `detail-${Date.now()}-${Math.random()}`,
          detail: detail.detail,
          unitPrice: detail.unitPrice.toString(),
          qty: detail.qty.toString(),
          amount: detail.unitPrice * detail.qty
        }))
        
        const total = autoFilledDetails.reduce((sum: number, d: any) => sum + d.amount, 0)
        
        toast.success(`Auto-filled ${autoFilledDetails.length} detail(s) from master data`)
        
        return {
          ...item,
          productName: finalName,
          details: autoFilledDetails,
          total
        }
      }
      
      // No master data details, just update formatted name
      return { ...item, productName: finalName }
    }))
  }

  const addDetail = (itemId: string) => {
    markInteracted()
    setItems(items.map(item =>
      item.id === itemId
        ? {
            ...item,
            details: [...item.details, {
              id: crypto.randomUUID(),
              detail: "",
              unitPrice: "",
              qty: "",
              amount: 0
            }]
          }
        : item
    ))
  }

  const removeDetail = (itemId: string, detailId: string) => {
    markInteracted()
    setItems(items.map(item => {
      if (item.id === itemId) {
        // Prevent removing the last detail
        if (item.details.length <= 1) {
          toast.warning("Cannot remove detail", {
            description: "Each item must have at least one detail."
          })
          return item
        }
        
        const newDetails = item.details.filter(d => d.id !== detailId)
        return {
          ...item,
          details: newDetails,
          total: newDetails.reduce((sum, d) => sum + d.amount, 0)
        }
      }
      return item
    }))
  }

  const updateDetail = (itemId: string, detailId: string, field: string, value: string) => {
    markInteracted()
    setItems(items.map(item => {
      if (item.id !== itemId) return item

      const updatedDetails = item.details.map(detail => {
        if (detail.id !== detailId) return detail

        const updated = { ...detail, [field]: value }
        
        // Calculate amount
        const unitPrice = parseFloat(updated.unitPrice) || 0
        const qty = parseFloat(updated.qty) || 0
        updated.amount = unitPrice * qty

        return updated
      })

      // Calculate item total
      const total = updatedDetails.reduce((sum, d) => sum + d.amount, 0)

      return { ...item, details: updatedDetails, total }
    }))
  }

  const handleAdjustByPercentage = (percentage: number, notes?: string) => {
    // One adjustment only: apply new % to logical base (undo previous % then apply new %). 0% = cancel adjustment.
    const prevMultiplier = 1 + (adjustmentPercentage ?? 0) / 100
    const newMultiplier = percentage === 0 ? 1 : 1 + percentage / 100
    const multiplier = newMultiplier / prevMultiplier
    setAdjustmentPercentage(percentage === 0 ? null : percentage)
    setAdjustmentNotes(percentage === 0 ? "" : (notes ?? ""))
    setItems(prevItems =>
      prevItems.map(item => {
        const updatedDetails = item.details.map(detail => {
          const unitPrice = parseFloat(detail.unitPrice) || 0
          const qty = parseFloat(detail.qty) || 0
          const newUnitPrice = unitPrice * multiplier
          const newAmount = Math.round(newUnitPrice * qty)
          return {
            ...detail,
            unitPrice: String(Math.round(newUnitPrice)),
            amount: newAmount,
          }
        })
        const total = updatedDetails.reduce((sum, d) => sum + d.amount, 0)
        return { ...item, details: updatedDetails, total }
      })
    )
    markInteracted()
    toast.success(`All amounts adjusted by ${percentage > 0 ? "+" : ""}${percentage}%`)
  }

  // Calculate totals
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }

  const calculatePphAmount = () => {
    const netAmount = calculateSubtotal()
    const pphRate = parseFloat(pph)
    if (pphRate === 0) return 0
    // Formula: Gross = Net × (100 / (100 - pph%))
    // PPh Amount = Gross - Net
    const grossAmount = netAmount * (100 / (100 - pphRate))
    return grossAmount - netAmount
  }

  const calculateTotalAmount = () => {
    return calculateSubtotal() + calculatePphAmount()
  }

  const calculateDownPaymentAmount = () => {
    const pct = downPaymentPercentage ?? 0
    if (pct <= 0) return 0
    return calculateTotalAmount() * (pct / 100)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const validateField = (field: string, value: string | Date | null) => {
    const fieldErrors: any = { ...errors }
    
    switch (field) {
      case "company":
        if (!value) {
          fieldErrors.company = "Company is required"
        } else {
          delete fieldErrors.company
        }
        break
      case "productionDate":
        if (!value) {
          fieldErrors.productionDate = "Production date is required"
        } else {
          delete fieldErrors.productionDate
        }
        break
      case "billTo":
        if (!value || (typeof value === "string" && !value.trim())) {
          fieldErrors.billTo = "Bill To is required"
        } else {
          delete fieldErrors.billTo
        }
        break
      case "billing":
        if (!value) {
          fieldErrors.billing = "Billing is required"
        } else {
          delete fieldErrors.billing
        }
        break
      case "signature":
        if (!value) {
          fieldErrors.signature = "Signature is required"
        } else {
          delete fieldErrors.signature
        }
        break
    }
    
    setErrors(fieldErrors)
  }

  const validateForm = () => {
    const newErrors: any = {}
    if (!selectedCompanyId) newErrors.company = "Company is required"
    if (!productionDate) newErrors.productionDate = "Production date is required"
    if (!billTo.trim()) newErrors.billTo = "Bill To is required"
    if (!selectedBillingId) newErrors.billing = "Billing is required"
    if (!selectedSignatureId) newErrors.signature = "Signature is required"

    setErrors(newErrors)
    
    // Scroll to first error
    if (Object.keys(newErrors).length > 0) {
      scrollToFirstError(newErrors, {
        company: companyRef,
        productionDate: productionDateRef,
        billTo: billToRef,
        billing: billingRef,
        signature: signatureRef,
      })
    }
    
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (status: "draft" | "pending") => {
    if (saving) return
    if (!validateForm()) {
      toast.error("Validation failed", {
        description: "Please fill in all required fields"
      })
      return
    }

    // Additional validation for pending status
    if (status === "pending") {
      if (items.length === 0) {
        toast.warning("Cannot save as pending", {
          description: "Please add at least one item before saving as pending."
        })
        return
      }

      const emptyProducts = items.filter(item => !item.productName.trim())
      if (emptyProducts.length > 0) {
        toast.warning("Cannot save as pending", {
          description: "All items must have a product name filled in."
        })
        return
      }

      const itemsWithoutDetails = items.filter(item => item.details.length === 0)
      if (itemsWithoutDetails.length > 0) {
        toast.warning("Cannot save as pending", {
          description: "All products must have at least one detail."
        })
        return
      }
    }

    setSaving(true)
    try {
      const company = companies.find(c => c.id === selectedCompanyId)
      const billing = billings.find(b => b.id === selectedBillingId)
      const signature = signatures.find(s => s.id === selectedSignatureId)

      const payload = {
        companyName: company?.name || "",
        companyAddress: company?.address || "",
        companyCity: company?.city || "",
        companyProvince: company?.province || "",
        companyPostalCode: company?.postalCode || null,
        companyTelp: company?.telp || null,
        companyEmail: company?.email || null,
        productionDate: productionDate?.toISOString() || new Date().toISOString(),
        billTo: billTo.trim(),
        notes: notes.trim() || null,
        billingName: billing?.name || "",
        billingBankName: billing?.bankName || "",
        billingBankAccount: billing?.bankAccount || "",
        billingBankAccountName: billing?.bankAccountName || "",
        billingKtp: billing?.ktp || null,
        billingNpwp: billing?.npwp || null,
        signatureName: signature?.name || "",
        signatureRole: signature?.role || null,
        signatureImageData: signature?.imageData || "",
        pph,
        totalAmount: calculateTotalAmount(),
        summaryOrder: summaryOrder.join(","),
        adjustmentPercentage: adjustmentPercentage ?? undefined,
        adjustmentNotes: adjustmentNotes.trim() || undefined,
        downPaymentPercentage: downPaymentPercentage ?? undefined,
        termsAndConditions: showTerms ? termsAndConditions : null,
        status,
        items: items.map(item => ({
          productName: item.productName,
          total: item.total,
          details: item.details
            .filter(detail => detail.detail.trim() || parseFloat(detail.unitPrice) || parseFloat(detail.qty))
            .map(detail => ({
              detail: detail.detail,
              unitPrice: parseFloat(detail.unitPrice) || 0,
              qty: parseFloat(detail.qty) || 0,
              amount: detail.amount
            }))
        })),
        remarks: remarks.filter(r => r.text.trim()).map(remark => ({
          text: remark.text,
          isCompleted: remark.isCompleted
        })),
        customSignatures: customSignatures
          .filter(s => s.position.trim()) // Only position is required
          .map((sig, index) => ({
            name: sig.name.trim() || "_______________", // Auto-fill empty name with underscores
            position: sig.position.trim(),
            imageData: "", // No image - will be signed manually by client
            order: index
          }))
      }

      // Create new quotation
      const response = await fetch("/api/quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()        
        {
          const statusText = status === "pending" ? "saved as pending" : "saved as draft"
          toast.success("Quotation saved successfully", {
            description: `Quotation has been ${statusText}.`
          })
          
          // Clear interaction flag
          setHasInteracted(false)
          
          // Redirect to view page if pending, otherwise to list
          if (status === "pending") {
            router.push(`/quotation/${data.id}/view`)
          } else {
            router.push("/quotation")
          }
        }
      } else {
        const errorData = await response.json()
        toast.error("Failed to save quotation", {
          description: errorData.error || "An error occurred while saving."
        })
      }
    } catch (error) {
      console.error("Error saving quotation:", error)
      toast.error("Failed to save quotation", {
        description: "An unexpected error occurred."
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader 
        title="Create Quotation" 
        showBackButton={true} 
        onBackClick={() => interceptNavigation("/quotation")}
      />
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        <div className="container mx-auto max-w-5xl space-y-6">
          <Breadcrumb items={[
            { label: "Quotations", href: "/quotation" },
            { label: "Create" }
          ]} />
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" ref={companyRef}>
                    <Label>Company <span className="text-destructive">*</span></Label>
                    <Select value={selectedCompanyId} onValueChange={(value) => {
                      markInteracted()
                      setSelectedCompanyId(value)
                      if (errors.company) validateField("company", value)
                    }}>
                      <SelectTrigger error={!!errors.company}>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.company && (
                      <p className="text-sm text-destructive">{errors.company}</p>
                    )}
                  </div>

                  <div className="space-y-2" ref={productionDateRef}>
                    <Label>Production Date <span className="text-destructive">*</span></Label>
                    <DatePicker date={productionDate} onDateChange={(date) => {
                      markInteracted()
                      setProductionDate(date)
                      if (errors.productionDate) validateField("productionDate", date || null)
                    }} error={!!errors.productionDate} />
                    {errors.productionDate && (
                      <p className="text-sm text-destructive">{errors.productionDate}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2" ref={billToRef}>
                  <Label>Bill To <span className="text-destructive">*</span></Label>
                  <Input
                    value={billTo}
                    onChange={(e) => {
                      markInteracted()
                      setBillTo(e.target.value)
                      if (errors.billTo) validateField("billTo", e.target.value)
                    }}
                    onBlur={(e) => validateField("billTo", e.target.value)}
                    placeholder="Enter bill to"
                    error={!!errors.billTo}
                  />
                  {errors.billTo && (
                    <p className="text-sm text-destructive">{errors.billTo}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => {
                      markInteracted()
                      setNotes(e.target.value)
                    }}
                    placeholder="Enter additional notes"
                    rows={3}
                  />
                </div>

                {/* Remarks Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Remarks</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={resetToDefaultRemarks}
                        className="h-8 w-8"
                        title="Reset to Default Remarks"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M8 16H3v5"/>
                        </svg>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRemark}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Remark
                      </Button>
                    </div>
                  </div>
                  {remarks.length > 0 && (
                    <ReorderableRemarks
                      remarks={remarks}
                      onRemarksChange={setRemarks}
                      onUpdateRemark={updateRemarkText}
                      onToggleRemark={toggleRemarkCompleted}
                      onRemoveRemark={removeRemark}
                    />
                  )}
                </div>

                {/* Terms & Conditions (S&K) */}
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTerms(!showTerms)}
                    className="w-full"
                  >
                    {showTerms ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                          <path d="m18 15-6-6-6 6"/>
                        </svg>
                        Hide S&K
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                          <path d="m6 9 6 6 6-6"/>
                        </svg>
                        Add S&K
                      </>
                    )}
                  </Button>
                  {showTerms && (
                    <div className="space-y-2">
                      <Label>Detailed Terms & Conditions (S&K)</Label>
                      <RichTextEditor
                        content={termsAndConditions}
                        onChange={setTermsAndConditions}
                        placeholder="Enter detailed terms and conditions..."
                        minHeight="300px"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Payment Information</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" ref={billingRef}>
                    <Label>Billing <span className="text-destructive">*</span></Label>
                    <Select value={selectedBillingId} onValueChange={(value) => {
                      markInteracted()
                      setSelectedBillingId(value)
                      if (errors.billing) validateField("billing", value)
                    }}>
                      <SelectTrigger error={!!errors.billing}>
                        <SelectValue placeholder="Select billing" />
                      </SelectTrigger>
                      <SelectContent>
                        {billings.map((billing) => (
                          <SelectItem key={billing.id} value={billing.id}>
                            {billing.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.billing && (
                      <p className="text-sm text-destructive">{errors.billing}</p>
                    )}
                  </div>

                  <div className="space-y-2" ref={signatureRef}>
                    <Label>Signature <span className="text-destructive">*</span></Label>
                    <Select value={selectedSignatureId} onValueChange={(value) => {
                      markInteracted()
                      setSelectedSignatureId(value)
                      if (errors.signature) validateField("signature", value)
                    }}>
                      <SelectTrigger error={!!errors.signature}>
                        <SelectValue placeholder="Select signature" />
                      </SelectTrigger>
                      <SelectContent>
                        {signatures.map((signature) => (
                          <SelectItem key={signature.id} value={signature.id}>
                            {signature.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.signature && (
                      <p className="text-sm text-destructive">{errors.signature}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>PPh</Label>
                  <Select value={pph} onValueChange={(value) => {
                    markInteracted()
                    setPph(value)
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select PPh" />
                    </SelectTrigger>
                    <SelectContent>
                      {PPH_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Signatures Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Additional Signatures</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomSignature}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Signature
                    </Button>
                  </div>
                  {customSignatures.length > 0 && (
                    <div className="space-y-2">
                      {customSignatures.map((sig) => (
                        <div key={sig.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                          <Input
                            value={sig.name}
                            onChange={(e) => updateCustomSignature(sig.id, 'name', e.target.value)}
                            placeholder="Name"
                          />
                          <Input
                            value={sig.position}
                            onChange={(e) => updateCustomSignature(sig.id, 'position', e.target.value)}
                            placeholder="Position"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomSignature(sig.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Items</h3>
                  <p className="text-xs text-muted-foreground">Drag items to reorder</p>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-md bg-muted p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No items added yet. Click "Add Product" to start.
                    </p>
                  </div>
                ) : (
                  <SortableItems
                    items={items}
                    onReorder={handleReorderItems}
                    renderItem={(item, itemIndex) => (
                      <Card className="border-2">
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
                                  <option key={product} value={product} />
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

                          {/* Details Header */}
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
                                  {item.details.map((detail) => (
                                    <div key={detail.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
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
                                      />
                                      <div className="flex h-11 items-center rounded-md border px-3 text-sm font-medium bg-muted">
                                        {formatCurrency(detail.amount)}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeDetail(item.id, detail.id)}
                                        disabled={item.details.length === 1}
                                        className="h-9 w-8 p-0"
                                        title={item.details.length === 1 ? "Cannot remove the last detail" : "Remove detail"}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            {/* Add Detail Button - Moved to bottom */}
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
                              Product Total: <span className="text-primary">{formatCurrency(item.total)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  />
                )}

                {/* Add Product Button - Moved to bottom */}
                <div className="flex justify-end gap-2">
                  <Button type="button" onClick={addItem} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              </div>

              {/* Summary */}
              {items.length > 0 && (
                <ReorderableSummary
                  items={summaryOrder.map(id => {
                    if (id === 'subtotal') {
                      return {
                        id: 'subtotal',
                        label: 'Subtotal',
                        value: formatCurrency(calculateSubtotal())
                      }
                    } else if (id === 'pph') {
                      const pphOption = PPH_OPTIONS.find(opt => opt.value === pph)
                      const pphLabel = pphOption ? pphOption.label : `PPh (${pph}%)`
                      const pphParts = pphLabel.split(' - After reporting')
                      const pphMainLabel = pphParts[0]
                      const pphNote = pphParts[1] ? 'After reporting' + pphParts[1] : undefined
                      
                      return {
                        id: 'pph',
                        label: pphMainLabel,
                        value: formatCurrency(calculatePphAmount()),
                        note: pphNote
                      }
                    } else if (id === "downPayment") {
                      const downPaymentPct = downPaymentPercentage ?? 0
                      return {
                        id: "downPayment",
                        label: `Down Payment (${downPaymentPct}%)`,
                        value: formatCurrency(calculateDownPaymentAmount()),
                      }
                    } else {
                      return {
                        id: 'total',
                        label: 'Total Amount',
                        value: formatCurrency(calculateTotalAmount())
                      }
                    }
                  })}
                  onReorder={(newOrder) => {
                    markInteracted()
                    setSummaryOrder(normalizeSummaryOrder(newOrder))
                  }}
                  onAdjustByPercentage={handleAdjustByPercentage}
                  onSetDownPayment={(percentage) => {
                    markInteracted()
                    setDownPaymentPercentage(percentage === 0 ? null : percentage)
                    toast.success(`Down payment set to ${percentage}%`)
                  }}
                  downPaymentPercentage={downPaymentPercentage}
                  adjustment={adjustmentPercentage != null ? { percentage: adjustmentPercentage, notes: adjustmentNotes.trim() || undefined } : null}
                />
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Auto-save status */}                <div className="flex flex-wrap gap-3 ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSubmit("draft")}
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save as Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit("pending")}
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save as Pending
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        open={showTemplateModal && !templateSelected}
        onClose={() => setShowTemplateModal(false)}
        onSelect={handleTemplateSelect}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onSave={handleSaveAndLeave}
        onLeave={handleLeaveWithoutSaving}
        isSaving={isSavingDraft}
      />
    </div>
  )
}

