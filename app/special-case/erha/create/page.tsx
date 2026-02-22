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
import { Save, CheckCircle, Plus, Trash2, GripVertical, Percent } from "lucide-react"
import { SortableItems } from "@/components/ui/sortable-items"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog"
import { ReorderableRemarks } from "@/components/ui/reorderable-remarks"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PPH_OPTIONS } from "@/lib/constants"
import { scrollToFirstError } from "@/lib/form-utils"
import { compressFinalWorkScreenshot } from "@/lib/image-utils"
import { formatProductName } from "@/lib/utils"
import { AdjustByPercentageModal } from "@/components/ui/adjust-by-percentage-modal"

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

interface Signature {
  id: string
  name: string
  role?: string
  imageData: string
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

export default function CreateErhaTicketPage() {
  const router = useRouter()
  
  // Form fields
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productionDate, setProductionDate] = useState<Date>()
  const [quotationDate, setQuotationDate] = useState<Date>()
  const [invoiceBastDate, setInvoiceBastDate] = useState<Date>()
  const [billTo, setBillTo] = useState("")
  const [projectName, setProjectName] = useState("")
  const [billToAddress, setBillToAddress] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactPosition, setContactPosition] = useState("")
  const [bastContactPerson, setBastContactPerson] = useState("")
  const [bastContactPosition, setBastContactPosition] = useState("")
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
  const [finalWorkImage, setFinalWorkImage] = useState<string>("")
  const [adjustmentPercentage, setAdjustmentPercentage] = useState<number | null>(null)
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>("")
  
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
  const [showAdjustModal, setShowAdjustModal] = useState(false)

  // Refs for error scrolling
  const companyRef = useRef<HTMLDivElement>(null)
  const productionDateRef = useRef<HTMLDivElement>(null)
  const quotationDateRef = useRef<HTMLDivElement>(null)
  const invoiceBastDateRef = useRef<HTMLDivElement>(null)
  const billToRef = useRef<HTMLDivElement>(null)
  const projectNameRef = useRef<HTMLDivElement>(null)
  const billToAddressRef = useRef<HTMLDivElement>(null)
  const contactPersonRef = useRef<HTMLDivElement>(null)
  const contactPositionRef = useRef<HTMLDivElement>(null)
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

  // Handle screenshot final work upload with compression
  const handleFinalWorkImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    markInteracted()
    const file = e.target.files?.[0]
    if (file) {
      try {
        const compressedImage = await compressFinalWorkScreenshot(file)
        setFinalWorkImage(compressedImage)
      } catch (error) {
        console.error("Failed to compress image:", error)
        toast.error("Failed to process image")
      }
    }
  }

  const removeFinalWorkImage = () => {
    markInteracted()
    setFinalWorkImage("")
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

  const removeItem = (itemId: string) => {
    markInteracted()
    setItems(items.filter(item => item.id !== itemId))
  }

  const handleReorderItems = (reorderedItems: Item[]) => {
    markInteracted()
    setItems(reorderedItems)
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
    markInteracted()
    setAdjustmentPercentage(percentage === 0 ? null : percentage)
    setAdjustmentNotes(percentage === 0 ? "" : (notes ?? ""))
    // One adjustment only: apply new % to logical base (undo previous % then apply new %). 0% = cancel adjustment.
    const prevMultiplier = 1 + (adjustmentPercentage ?? 0) / 100
    const newMultiplier = percentage === 0 ? 1 : 1 + percentage / 100
    const multiplier = newMultiplier / prevMultiplier
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const validateField = (field: string, value: string | Date | null | undefined) => {
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
      case "quotationDate":
        if (!value) {
          fieldErrors.quotationDate = "Quotation date is required"
        } else {
          delete fieldErrors.quotationDate
        }
        break
      case "invoiceBastDate":
        if (!value) {
          fieldErrors.invoiceBastDate = "Invoice/BAST date is required"
        } else {
          delete fieldErrors.invoiceBastDate
        }
        break
      case "billTo":
        if (!value || (typeof value === "string" && !value.trim())) {
          fieldErrors.billTo = "Bill To is required"
        } else {
          delete fieldErrors.billTo
        }
        break
      case "projectName":
        if (!value || (typeof value === "string" && !value.trim())) {
          fieldErrors.projectName = "Project name is required"
        } else {
          delete fieldErrors.projectName
        }
        break
      case "billToAddress":
        if (!value || (typeof value === "string" && !value.trim())) {
          fieldErrors.billToAddress = "Bill To Address is required"
        } else {
          delete fieldErrors.billToAddress
        }
        break
      case "contactPerson":
        if (!value || (typeof value === "string" && !value.trim())) {
          fieldErrors.contactPerson = "Contact Person is required"
        } else {
          delete fieldErrors.contactPerson
        }
        break
      case "contactPosition":
        if (!value || (typeof value === "string" && !value.trim())) {
          fieldErrors.contactPosition = "Position is required"
        } else {
          delete fieldErrors.contactPosition
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
    if (!quotationDate) newErrors.quotationDate = "Quotation date is required"
    if (!invoiceBastDate) newErrors.invoiceBastDate = "Invoice/BAST date is required"
    if (!billTo.trim()) newErrors.billTo = "Bill To is required"
    if (!projectName.trim()) newErrors.projectName = "Project name is required"
    if (!billToAddress.trim()) newErrors.billToAddress = "Bill To Address is required"
    if (!contactPerson.trim()) newErrors.contactPerson = "Contact Person is required"
    if (!contactPosition.trim()) newErrors.contactPosition = "Position is required"
    if (!selectedBillingId) newErrors.billing = "Billing is required"
    if (!selectedSignatureId) newErrors.signature = "Signature is required"

    setErrors(newErrors)
    
    // Scroll to first error after React paints the error state
    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => {
        scrollToFirstError(newErrors, {
          company: companyRef,
          productionDate: productionDateRef,
          quotationDate: quotationDateRef,
          invoiceBastDate: invoiceBastDateRef,
          billTo: billToRef,
          projectName: projectNameRef,
          billToAddress: billToAddressRef,
          contactPerson: contactPersonRef,
          contactPosition: contactPositionRef,
          billing: billingRef,
          signature: signatureRef,
        })
      }, 0)
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
        quotationDate: quotationDate?.toISOString() || new Date().toISOString(),
        invoiceBastDate: invoiceBastDate?.toISOString() || new Date().toISOString(),
        billTo: billTo.trim(),
        projectName: projectName.trim(),
        billToAddress: billToAddress.trim(),
        contactPerson: contactPerson.trim(),
        contactPosition: contactPosition.trim(),
        bastContactPerson: bastContactPerson.trim() || null,
        bastContactPosition: bastContactPosition.trim() || null,
        billingName: billing?.name || "",
        billingBankName: billing?.bankName || "",
        billingBankAccount: billing?.bankAccount || "",
        billingBankAccountName: billing?.bankAccountName || "",
        billingKtp: billing?.ktp || null,
        billingNpwp: billing?.npwp || null,
        signatureName: signature?.name || "",
        signatureRole: signature?.role || null,
        signatureImageData: signature?.imageData || "",
        finalWorkImageData: finalWorkImage || null,
        pph,
        totalAmount: calculateTotalAmount(),
        adjustmentPercentage: adjustmentPercentage ?? undefined,
        adjustmentNotes: adjustmentNotes.trim() || undefined,
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
        }))
      }

      // Create new ticket
      const response = await fetch("/api/erha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()        
        {
          const statusText = status === "pending" ? "saved as pending" : "saved as draft"
          toast.success("Erha Ticket saved successfully", {
            description: `Erha Ticket has been ${statusText}.`
          })
          
          // Clear interaction flag
          setHasInteracted(false)
          
          // Redirect to view page
          router.push(`/special-case/erha/${data.id}/view`)
        }
      } else {
        let description = "An error occurred while saving."
        try {
          const errorData = await response.json()
          description = errorData.error || description
        } catch {
          if (response.status === 413) description = "Request too large. Try using smaller images for signature and screenshot."
        }
        toast.error("Failed to save erha ticket", { description })
      }
    } catch (error) {
      console.error("Error saving erha ticket:", error)
      toast.error("Failed to save erha ticket", {
        description: "An unexpected error occurred."
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader 
        title="Create Erha Ticket" 
        showBackButton={true} 
        onBackClick={() => interceptNavigation("/special-case/erha")}
      />
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        <div className="container mx-auto max-w-5xl space-y-6">
          <Breadcrumb items={[
            { label: "Erha Tickets", href: "/special-case/erha" },
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" ref={quotationDateRef}>
                    <Label>Quotation Date <span className="text-destructive">*</span></Label>
                    <DatePicker date={quotationDate} onDateChange={(date) => {
                      markInteracted()
                      setQuotationDate(date)
                      if (errors.quotationDate) validateField("quotationDate", date || null)
                    }} error={!!errors.quotationDate} />
                    {errors.quotationDate && (
                      <p className="text-sm text-destructive">{errors.quotationDate}</p>
                    )}
                  </div>

                  <div className="space-y-2" ref={invoiceBastDateRef}>
                    <Label>Invoice / BAST Date <span className="text-destructive">*</span></Label>
                    <DatePicker date={invoiceBastDate} onDateChange={(date) => {
                      markInteracted()
                      setInvoiceBastDate(date)
                      if (errors.invoiceBastDate) validateField("invoiceBastDate", date || null)
                    }} error={!!errors.invoiceBastDate} />
                    {errors.invoiceBastDate && (
                      <p className="text-sm text-destructive">{errors.invoiceBastDate}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                      placeholder="Client / bill-to name (used in PDF)"
                      error={!!errors.billTo}
                    />
                    {errors.billTo && (
                      <p className="text-sm text-destructive">{errors.billTo}</p>
                    )}
                  </div>
                  <div className="space-y-2" ref={projectNameRef}>
                    <Label>Project name <span className="text-destructive">*</span></Label>
                    <Input
                      value={projectName}
                      onChange={(e) => {
                        markInteracted()
                        setProjectName(e.target.value)
                        if (errors.projectName) validateField("projectName", e.target.value)
                      }}
                      onBlur={(e) => validateField("projectName", e.target.value)}
                      placeholder="Shown in lists"
                      error={!!errors.projectName}
                    />
                    {errors.projectName && (
                      <p className="text-sm text-destructive">{errors.projectName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2" ref={billToAddressRef}>
                  <Label>Bill To Address <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={billToAddress}
                    onChange={(e) => {
                      markInteracted()
                      setBillToAddress(e.target.value)
                      if (errors.billToAddress) validateField("billToAddress", e.target.value)
                    }}
                    onBlur={(e) => validateField("billToAddress", e.target.value)}
                    placeholder="Enter bill to address"
                    error={!!errors.billToAddress}
                  />
                  {errors.billToAddress && (
                    <p className="text-sm text-destructive">{errors.billToAddress}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" ref={contactPersonRef}>
                    <Label>Contact Person (Quotation) <span className="text-destructive">*</span></Label>
                    <Input
                      value={contactPerson}
                      onChange={(e) => {
                        markInteracted()
                        setContactPerson(e.target.value)
                        if (errors.contactPerson) validateField("contactPerson", e.target.value)
                      }}
                      onBlur={(e) => validateField("contactPerson", e.target.value)}
                      placeholder="Enter contact person for quotation"
                      error={!!errors.contactPerson}
                    />
                    {errors.contactPerson && (
                      <p className="text-sm text-destructive">{errors.contactPerson}</p>
                    )}
                  </div>

                  <div className="space-y-2" ref={contactPositionRef}>
                    <Label>Position (Quotation) <span className="text-destructive">*</span></Label>
                    <Input
                      value={contactPosition}
                      onChange={(e) => {
                        markInteracted()
                        setContactPosition(e.target.value)
                        if (errors.contactPosition) validateField("contactPosition", e.target.value)
                      }}
                      onBlur={(e) => validateField("contactPosition", e.target.value)}
                      placeholder="Enter position for quotation"
                      error={!!errors.contactPosition}
                    />
                    {errors.contactPosition && (
                      <p className="text-sm text-destructive">{errors.contactPosition}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Contact Person (BAST / Invoice)</Label>
                    <Input
                      value={bastContactPerson}
                      onChange={(e) => { markInteracted(); setBastContactPerson(e.target.value) }}
                      placeholder="Leave blank to use same as quotation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Position (BAST / Invoice)</Label>
                    <Input
                      value={bastContactPosition}
                      onChange={(e) => { markInteracted(); setBastContactPosition(e.target.value) }}
                      placeholder="Leave blank to use same as quotation"
                    />
                  </div>
                </div>

                {/* Remarks Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Remarks</Label>
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

              {/* Billing Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Billing Information</h3>
                
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

                {selectedBillingId && (() => {
                  const selectedBilling = billings.find(b => b.id === selectedBillingId)
                  if (!selectedBilling) return null
                  return (
                    <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                      <p className="text-sm"><span className="font-medium">Bank:</span> {selectedBilling.bankName}</p>
                      <p className="text-sm"><span className="font-medium">Account:</span> {selectedBilling.bankAccount}</p>
                      <p className="text-sm"><span className="font-medium">Account Name:</span> {selectedBilling.bankAccountName}</p>
                      {selectedBilling.npwp && (
                        <p className="text-sm"><span className="font-medium">NPWP:</span> {selectedBilling.npwp}</p>
                      )}
                      {selectedBilling.ktp && (
                        <p className="text-sm"><span className="font-medium">KTP:</span> {selectedBilling.ktp}</p>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Signature Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Signature Information</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
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

                  <div className="space-y-2">
                    <Label>PPh</Label>
                    <Select value={pph} onValueChange={(value) => {
                      markInteracted()
                      setPph(value)
                    }}>
                      <SelectTrigger>
                        <span className="truncate text-left">{PPH_OPTIONS.find((o) => o.value === pph)?.label ?? "Select PPh"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {PPH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label.trim()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Screenshot Final Work */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Screenshot Final Work</h3>
                <div className="space-y-2">
                  <Label>Upload Screenshot (for BAST PDF)</Label>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFinalWorkImageChange}
                      className="hidden"
                      id="finalWorkImageInput"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('finalWorkImageInput')?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                  {finalWorkImage && (
                    <div className="mt-2">
                      <img 
                        src={finalWorkImage} 
                        alt="Final work screenshot" 
                        className="max-w-xs rounded border"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeFinalWorkImage}
                        className="mt-2"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Image
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Items</h3>
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
                <div className="flex justify-end">
                  <Button type="button" onClick={addItem} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              </div>

              {/* Summary */}
              {items.length > 0 && (
                <div className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Summary</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowAdjustModal(true)}
                      title="Adjust all amounts by percentage"
                    >
                      <Percent className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{PPH_OPTIONS.find(opt => opt.value === pph)?.label || `PPh (${pph}%)`}:</span>
                      <span className="font-medium text-green-600">
                        + {formatCurrency(calculatePphAmount())}
                      </span>
                    </div>
                    {adjustmentPercentage != null && (
                      <div className="text-xs text-muted-foreground">
                        {adjustmentNotes.trim()
                          ? `Price adjusted by ${adjustmentPercentage > 0 ? "+" : ""}${adjustmentPercentage}% because ${adjustmentNotes.trim()}.`
                          : `Price adjusted by ${adjustmentPercentage > 0 ? "+" : ""}${adjustmentPercentage}%.`}
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 text-base font-bold">
                      <span>Total Amount:</span>
                      <span className="text-primary">{formatCurrency(calculateTotalAmount())}</span>
                    </div>
                  </div>
                  <AdjustByPercentageModal
                    open={showAdjustModal}
                    onOpenChange={setShowAdjustModal}
                    onConfirm={handleAdjustByPercentage}
                    initialPercentage={adjustmentPercentage}
                    initialNotes={adjustmentNotes}
                  />
                </div>
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

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

