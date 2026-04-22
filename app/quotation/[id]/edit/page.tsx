"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
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
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
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
import { ReorderableRemarks } from "@/components/ui/reorderable-remarks"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { QuotationDetailRow } from "@/components/form/QuotationDetailRow"
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator"
import { useSmartAutoSave } from "@/lib/smart-auto-save"

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

const SUMMARY_ITEM_IDS = ["subtotal", "pph", "total"] as const
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

const DEFAULT_REMARKS: Remark[] = [
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
]

export default function EditQuotationPage() {
  const router = useRouter()
  const params = useParams()
  const quotationId = params?.id as string
  
  // Form fields
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productionDate, setProductionDate] = useState<Date>()
  const [billTo, setBillTo] = useState("")
  const [notes, setNotes] = useState("")
  const [remarks, setRemarks] = useState<Remark[]>([])
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<any>({})
  const [quotationNumber, setQuotationNumber] = useState<string>("")
  const [quotationStatus, setQuotationStatus] = useState<string>("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const initialDataRef = useRef<string>("")
  const lastUpdatedAtRef = useRef<string>("")
  const [showStaleDataDialog, setShowStaleDataDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Refs for error scrolling
  const companyRef = useRef<HTMLDivElement>(null)
  const productionDateRef = useRef<HTMLDivElement>(null)
  const billToRef = useRef<HTMLDivElement>(null)
  const billingRef = useRef<HTMLDivElement>(null)
  const signatureRef = useRef<HTMLDivElement>(null)

  // Auto-save setup
  const {
    autoSaveStatus,
    triggerAutoSave,
    setIsSavingManually,
    cancelAutoSave
  } = useSmartAutoSave({
    recordId: quotationId,
    type: 'quotation',
    getData: () => {
      const company = companies.find(c => c.id === selectedCompanyId)
      const billing = billings.find(b => b.id === selectedBillingId)
      const signature = signatures.find(s => s.id === selectedSignatureId)
      
      if (!company || !billing || !signature || !productionDate) {
        return null
      }
      
      return {
        selectedCompanyId,
        selectedBillingId,
        selectedSignatureId,
        companyName: company.name,
        companyAddress: company.address,
        companyCity: company.city,
        companyProvince: company.province,
        companyPostalCode: company.postalCode,
        companyTelp: company.telp,
        companyEmail: company.email,
        productionDate: productionDate.toISOString(),
        billTo: billTo.trim(),
        notes: notes.trim() || null,
        billingName: billing.name,
        billingBankName: billing.bankName,
        billingBankAccount: billing.bankAccount,
        billingBankAccountName: billing.bankAccountName,
        billingKtp: billing.ktp,
        billingNpwp: billing.npwp,
        signatureName: signature.name,
        signatureRole: signature.role,
        signatureImageData: signature.imageData,
        pph,
        totalAmount: items.reduce((sum, item) => sum + item.total, 0) + 
                     (items.reduce((sum, item) => sum + item.total, 0) * (100 / (100 - parseFloat(pph))) - items.reduce((sum, item) => sum + item.total, 0)),
        summaryOrder: summaryOrder.join(","),
        adjustmentPercentage: adjustmentPercentage ?? undefined,
        adjustmentNotes: adjustmentNotes.trim() || undefined,
        downPaymentPercentage: downPaymentPercentage ?? undefined,
        termsAndConditions: showTerms ? termsAndConditions : null,
        status: 'draft', // Always save as draft for auto-save
        updatedAt: lastUpdatedAtRef.current,
        remarks: remarks.map(remark => ({
          id: remark.id,
          text: remark.text,
          isCompleted: remark.isCompleted
        })),
        customSignatures: customSignatures
          .filter(s => s.position.trim())
          .map((sig, index) => ({
            id: sig.id,
            name: sig.name.trim() || "_______________",
            position: sig.position.trim(),
            imageData: "",
            order: index
          })),
        items: items.map(item => ({
          id: item.id,
          productName: item.productName,
          total: item.total,
          details: item.details
            .filter(detail => detail.detail.trim() || parseFloat(detail.unitPrice) || parseFloat(detail.qty))
            .map(detail => ({
              id: detail.id,
              detail: detail.detail,
              unitPrice: parseFloat(detail.unitPrice) || 0,
              qty: parseFloat(detail.qty) || 0,
              amount: detail.amount
            }))
        }))
      }
    },
    onSuccess: (result) => {
      if (result && typeof result === "object" && "updatedAt" in result && (result as { updatedAt?: string }).updatedAt) {
        lastUpdatedAtRef.current = (result as { updatedAt: string }).updatedAt
      }
      setHasUnsavedChanges(false)
    },
    onError: (error) => {
      console.error('[AUTO-SAVE] Error:', error)
    }
  })

  // Fetch quotation data
  useEffect(() => {
    if (!quotationId) return

    Promise.all([
      fetch(`/api/quotation/${quotationId}`).then(res => res.json()),
      fetch("/api/companies").then(res => res.json()),
      fetch("/api/billings").then(res => res.json()),
      fetch("/api/signatures").then(res => res.json()),
      fetch("/api/products").then(res => res.json()),
    ]).then(([quotationData, companiesData, billingsData, signaturesData, productsData]) => {
      setQuotationNumber(quotationData.quotationId)
      setQuotationStatus(quotationData.status)

      // Find company by name
      const company = companiesData.find((c: Company) => c.name === quotationData.companyName)
      if (company) setSelectedCompanyId(company.id)
      
      // Parse production date safely
      const parsedDate = quotationData.productionDate ? new Date(quotationData.productionDate) : new Date()
      setProductionDate(isNaN(parsedDate.getTime()) ? new Date() : parsedDate)
      
      setBillTo(quotationData.billTo)
      setNotes(quotationData.notes || "")
      
      // Find billing by name
      const billing = billingsData.find((b: Billing) => b.name === quotationData.billingName)
      if (billing) setSelectedBillingId(billing.id)
      
      // Find signature by name
      const signature = signaturesData.find((s: Signature) => s.name === quotationData.signatureName)
      if (signature) setSelectedSignatureId(signature.id)
      
      setPph(quotationData.pph)
      setSummaryOrder(normalizeSummaryOrder(quotationData.summaryOrder ? quotationData.summaryOrder.split(',') : undefined))
      setAdjustmentPercentage(quotationData.adjustmentPercentage ?? null)
      setAdjustmentNotes(quotationData.adjustmentNotes ?? "")
      setDownPaymentPercentage(quotationData.downPaymentPercentage ?? null)
      
      // Store the updatedAt timestamp for stale data detection
      lastUpdatedAtRef.current = quotationData.updatedAt
      
      // Load items with details
      const loadedItems = quotationData.items && Array.isArray(quotationData.items)
        ? quotationData.items.map((item: any) => ({
            id: item.id,
            productName: item.productName,
            total: item.total,
            details: item.details && Array.isArray(item.details)
              ? item.details.map((detail: any) => ({
                  id: detail.id,
                  detail: detail.detail,
                  unitPrice: detail.unitPrice.toString(),
                  qty: detail.qty.toString(),
                  amount: detail.amount
                }))
              : []
          }))
        : []
      setItems(loadedItems)
      
      // Load remarks
      const loadedRemarks = quotationData.remarks && Array.isArray(quotationData.remarks)
        ? quotationData.remarks.map((remark: any) => ({
            id: remark.id,
            text: remark.text,
            isCompleted: remark.isCompleted
          }))
        : []
      setRemarks(loadedRemarks)
      
      // Load terms and conditions
      setTermsAndConditions(quotationData.termsAndConditions || "")
      setShowTerms(!!quotationData.termsAndConditions)
      
      // Load custom signatures
      if (quotationData.signatures && Array.isArray(quotationData.signatures)) {
        const loadedSignatures = quotationData.signatures.map((sig: any) => ({
          id: sig.id,
          name: sig.name,
          position: sig.position
        }))
        setCustomSignatures(loadedSignatures)
        if (loadedSignatures.length > 0) {
          setShowSignatures(true)
        }
      }
      
      setCompanies(companiesData)
      setBillings(billingsData)
      setSignatures(signaturesData)
      setProducts(productsData.map((p: any) => p.name))
      setProductDetails(productsData) // Store full product objects with details
      
      setLoading(false)
      
      // Store initial data snapshot for change detection
      initialDataRef.current = JSON.stringify({
        selectedCompanyId: company?.id,
        productionDate: parsedDate.toISOString(),
        billTo: quotationData.billTo,
        notes: quotationData.notes || "",
        selectedBillingId: billing?.id,
        selectedSignatureId: signature?.id,
        pph: quotationData.pph,
        summaryOrder: normalizeSummaryOrder(quotationData.summaryOrder ? quotationData.summaryOrder.split(',') : undefined),
        adjustmentPercentage: quotationData.adjustmentPercentage ?? null,
        adjustmentNotes: quotationData.adjustmentNotes ?? "",
        downPaymentPercentage: quotationData.downPaymentPercentage ?? null,
        remarks: loadedRemarks,
        items: loadedItems
      })
    }).catch((error) => {
      console.error("Error fetching quotation:", error)
      toast.error("Failed to load quotation", {
        description: "An error occurred while loading the quotation."
      })
      setLoading(false)
    })
  }, [quotationId])

  // Track changes
  useEffect(() => {
    if (loading || !initialDataRef.current) return
    
    const currentData = JSON.stringify({
      selectedCompanyId,
      productionDate: productionDate?.toISOString(),
      billTo,
      notes,
      selectedBillingId,
      selectedSignatureId,
      pph,
      summaryOrder,
      adjustmentPercentage,
      adjustmentNotes,
      downPaymentPercentage,
      remarks,
      items
    })
    
    setHasUnsavedChanges(currentData !== initialDataRef.current)
  }, [selectedCompanyId, productionDate, billTo, notes, selectedBillingId, selectedSignatureId, pph, summaryOrder, adjustmentPercentage, adjustmentNotes, downPaymentPercentage, remarks, items, loading])

  // Trigger auto-save when data changes (only if mandatory fields filled)
  useEffect(() => {
    if (loading || !quotationId) return
    
    // Only trigger if all mandatory fields are filled
    if (selectedCompanyId && productionDate && billTo.trim() && selectedBillingId && selectedSignatureId) {
      triggerAutoSave()
    }
  }, [selectedCompanyId, productionDate, billTo, selectedBillingId, selectedSignatureId, items, notes, pph, remarks, termsAndConditions, customSignatures, summaryOrder, downPaymentPercentage, loading, quotationId, triggerAutoSave])

  // Check for stale data when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !loading && quotationId && lastUpdatedAtRef.current) {
        try {
          const response = await fetch(`/api/quotation/${quotationId}`)
          if (response.ok) {
            const latestData = await response.json()
            
            // Compare timestamps
            if (latestData.updatedAt !== lastUpdatedAtRef.current) {
              setShowStaleDataDialog(true)
            }
          }
        } catch (error) {
          console.error("Error checking for updates:", error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [quotationId, loading])

  const handleReloadData = () => {
    setShowStaleDataDialog(false)
    window.location.reload()
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
    hasUnsavedChanges,
    onSave: async () => {
      // Save with current status, don't force to draft
      await handleSubmit((quotationStatus as "draft" | "pending" | "accepted") || "draft")
    },
    enabled: !loading
  })

  const addCustomSignature = () => {
    setHasUnsavedChanges(true)
    setShowSignatures(true)
    setCustomSignatures([...customSignatures, {
      id: crypto.randomUUID(),
      name: "",
      position: ""
    }])
  }

  const removeCustomSignature = (id: string) => {
    setHasUnsavedChanges(true)
    const newSignatures = customSignatures.filter(sig => sig.id !== id)
    setCustomSignatures(newSignatures)
    if (newSignatures.length === 0) {
      setShowSignatures(false)
    }
  }

  const updateCustomSignature = (id: string, field: 'name' | 'position', value: string) => {
    setHasUnsavedChanges(true)
    setCustomSignatures(customSignatures.map(sig =>
      sig.id === id ? { ...sig, [field]: value } : sig
    ))
  }

  // Remark management
  const addRemark = () => {
    setRemarks([...remarks, {
      id: crypto.randomUUID(),
      text: "",
      isCompleted: false
    }])
  }

  const removeRemark = (id: string) => {
    setRemarks(remarks.filter(remark => remark.id !== id))
  }

  const updateRemarkText = (id: string, text: string) => {
    setRemarks(remarks.map(remark =>
      remark.id === id ? { ...remark, text } : remark
    ))
  }

  const toggleRemarkCompleted = (id: string) => {
    setRemarks(remarks.map(remark =>
      remark.id === id ? { ...remark, isCompleted: !remark.isCompleted } : remark
    ))
  }

  const resetRemarksToDefault = () => {
    setHasUnsavedChanges(true)
    setRemarks(DEFAULT_REMARKS.map(r => ({
      ...r,
      id: crypto.randomUUID() // Generate new IDs for these default remarks
    })))
  }

  // Item management functions (optimized with useCallback)
  const addItem = useCallback(() => {
    const newItemId = Date.now().toString()
    setItems(prevItems => [...prevItems, {
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
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId))
  }, [])

  const handleReorderItems = useCallback((reorderedItems: Item[]) => {
    setItems(reorderedItems)
  }, [])

  const updateItemName = useCallback((itemId: string, productName: string) => {
    // Just update the raw name (allow spaces while typing)
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? { ...item, productName } : item
    ))
  }, [])

  const formatItemName = useCallback((itemId: string) => {
    setItems(prevItems => {
      const item = prevItems.find(i => i.id === itemId)
      if (!item || !item.productName.trim()) return prevItems
      
      // Format on blur: Auto-capitalize if not from master data, normalize spaces
      const finalName = formatProductName(item.productName, products)
      
      // Check if this product exists in master data and has details
      const masterProduct = productDetails.find((p: any) => 
        p.name.toLowerCase() === finalName.toLowerCase()
      )
      
      return prevItems.map(item => {
        if (item.id !== itemId) return item
        
        // If master product has details, auto-fill them
        if (masterProduct && masterProduct.details && masterProduct.details.length > 0) {
          const autoFilledDetails = masterProduct.details.map((detail: any) => ({
            id: `temp-detail-${Date.now()}-${Math.random()}`,
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
      })
    })
  }, [products, productDetails])

  const addDetail = useCallback((itemId: string) => {
    setItems(prevItems => prevItems.map(item =>
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
  }, [])

  const removeDetail = useCallback((itemId: string, detailId: string) => {
    setItems(prevItems => {
      const item = prevItems.find(i => i.id === itemId)
      if (item && item.details.length === 1) {
        toast.warning("Cannot remove detail", {
          description: "Each product must have at least one detail."
        })
        return prevItems
      }
      
      return prevItems.map(item =>
        item.id === itemId
          ? {
              ...item,
              details: item.details.filter(d => d.id !== detailId),
              total: item.details
                .filter(d => d.id !== detailId)
                .reduce((sum, d) => sum + d.amount, 0)
            }
          : item
      )
    })
  }, [])

  const updateDetail = useCallback((itemId: string, detailId: string, field: string, value: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item

      const updatedDetails = item.details.map(detail => {
        if (detail.id !== detailId) return detail

        const updated = { ...detail, [field]: value }
        
        const unitPrice = parseFloat(updated.unitPrice) || 0
        const qty = parseFloat(updated.qty) || 0
        updated.amount = unitPrice * qty

        return updated
      })

      const total = updatedDetails.reduce((sum, d) => sum + d.amount, 0)

      return { ...item, details: updatedDetails, total }
    }))
  }, [])

  const handleAdjustByPercentage = useCallback((percentage: number, notes?: string) => {
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
    setHasUnsavedChanges(true)
    toast.success(`All amounts adjusted by ${percentage > 0 ? "+" : ""}${percentage}%`)
  }, [adjustmentPercentage])

  // Memoized calculations - only recalculate when dependencies change
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }, [items])

  const pphAmount = useMemo(() => {
    const pphRate = parseFloat(pph)
    if (pphRate === 0) return 0
    // Formula: Gross = Net × (100 / (100 - pph%))
    // PPh Amount = Gross - Net
    const grossAmount = subtotal * (100 / (100 - pphRate))
    return grossAmount - subtotal
  }, [subtotal, pph])

  const totalAmount = useMemo(() => {
    return subtotal + pphAmount
  }, [subtotal, pphAmount])

  const downPaymentAmount = useMemo(() => {
    const pct = downPaymentPercentage ?? 0
    if (pct <= 0) return 0
    return totalAmount * (pct / 100)
  }, [downPaymentPercentage, totalAmount])

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

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

  const handleSubmit = async (status: "draft" | "pending" | "accepted") => {
    if (saving) return
    
    // Cancel any pending auto-save
    cancelAutoSave()
    
    // Mark as manual save
    setIsSavingManually(true)
    
    if (!validateForm()) {
      toast.error("Validation failed", {
        description: "Please fill in all required fields"
      })
      setIsSavingManually(false)
      return
    }

    if (status === "pending") {
      if (items.length === 0) {
        toast.warning("Cannot save as pending", {
          description: "Please add at least one item before saving as pending."
        })
        setIsSavingManually(false)
        return
      }

      const emptyProducts = items.filter(item => !item.productName.trim())
      if (emptyProducts.length > 0) {
        toast.warning("Cannot save as pending", {
          description: "All items must have a product name filled in."
        })
        setIsSavingManually(false)
        return
      }

      const itemsWithoutDetails = items.filter(item => item.details.length === 0)
      if (itemsWithoutDetails.length > 0) {
        toast.warning("Cannot save as pending", {
          description: "All products must have at least one detail."
        })
        setIsSavingManually(false)
        return
      }
    }

    setSaving(true)
    try {
      const company = companies.find(c => c.id === selectedCompanyId)!
      const billing = billings.find(b => b.id === selectedBillingId)!
      const signature = signatures.find(s => s.id === selectedSignatureId)!

      const payload = {
        companyName: company.name,
        companyAddress: company.address,
        companyCity: company.city,
        companyProvince: company.province,
        companyPostalCode: company.postalCode,
        companyTelp: company.telp,
        companyEmail: company.email,
        productionDate: productionDate!.toISOString(),
        billTo: billTo.trim(),
        notes: notes.trim() || null,
        billingName: billing.name,
        billingBankName: billing.bankName,
        billingBankAccount: billing.bankAccount,
        billingBankAccountName: billing.bankAccountName,
        billingKtp: billing.ktp,
        billingNpwp: billing.npwp,
        signatureName: signature.name,
        signatureRole: signature.role,
        signatureImageData: signature.imageData,
        pph,
        totalAmount: totalAmount,
        summaryOrder: summaryOrder.join(","),
        adjustmentPercentage: adjustmentPercentage ?? undefined,
        adjustmentNotes: adjustmentNotes.trim() || undefined,
        downPaymentPercentage: downPaymentPercentage ?? undefined,
        termsAndConditions: showTerms ? termsAndConditions : null,
        status,
        updatedAt: lastUpdatedAtRef.current, // OPTIMISTIC LOCKING: Send version
        remarks: remarks.map(remark => ({
          id: remark.id,
          text: remark.text,
          isCompleted: remark.isCompleted
        })),
        customSignatures: customSignatures
          .filter(s => s.position.trim()) // Only position is required
          .map((sig, index) => ({
            id: sig.id,
            name: sig.name.trim() || "_______________", // Auto-fill empty name with underscores
            position: sig.position.trim(),
            imageData: "", // No image - will be signed manually by client
            order: index
          })),
        items: items.map(item => ({
          id: item.id,
          productName: item.productName,
          total: item.total,
          details: item.details
            .filter(detail => detail.detail.trim() || parseFloat(detail.unitPrice) || parseFloat(detail.qty))
            .map(detail => ({
              id: detail.id,
              detail: detail.detail,
              unitPrice: parseFloat(detail.unitPrice) || 0,
              qty: parseFloat(detail.qty) || 0,
              amount: detail.amount
            }))
        }))
      }

      const response = await fetch(`/api/quotation/${quotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const saved = await response.json()
        if (saved?.updatedAt) {
          lastUpdatedAtRef.current = saved.updatedAt
        }
        const statusText = status === "accepted"
          ? "Changes saved. Status remains accepted."
          : status === "pending"
            ? "saved as pending"
            : "saved as draft"
        toast.success("Quotation updated successfully", {
          description: status === "accepted" ? statusText : `Quotation has been ${statusText}.`
        })
        
        // Clear unsaved changes flag
        setHasUnsavedChanges(false)
        
        // Redirect to view page if pending or accepted, otherwise to list
        if (status === "pending" || status === "accepted") {
          router.push(`/quotation/${quotationId}/view`)
        } else {
          router.push("/quotation")
        }
      } else {
        const data = await response.json()
        
        // Handle optimistic lock conflict
        if (data.code === "OPTIMISTIC_LOCK_ERROR") {
          toast.error("Conflict Detected", {
            description: data.message || "This quotation was modified by another user. Please refresh and try again.",
            duration: 5000,
            action: {
              label: "Refresh",
              onClick: () => window.location.reload()
            }
          })
          setShowStaleDataDialog(true)
          return
        }
        
        toast.error("Failed to update quotation", {
          description: data.error || "An error occurred while updating."
        })
      }
    } catch (error) {
      console.error("Error updating quotation:", error)
      toast.error("Failed to update quotation", {
        description: "An unexpected error occurred."
      })
    } finally {
      setSaving(false)
      setIsSavingManually(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/quotation/${quotationId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        toast.success("Quotation deleted successfully")
        setHasUnsavedChanges(false) // Clear unsaved changes to avoid dialog
        router.push("/quotation")
      } else {
        const data = await response.json()
        toast.error("Failed to delete quotation", {
          description: data.error || "An error occurred while deleting."
        })
      }
    } catch (error) {
      console.error("Error deleting quotation:", error)
      toast.error("Failed to delete quotation", {
        description: "An unexpected error occurred."
      })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PageHeader 
        title="Edit Quotation" 
        showBackButton={true} 
        onBackClick={() => interceptNavigation("/quotation")}
      />
        <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
          <div className="container mx-auto max-w-5xl space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-8 w-48 animate-pulse rounded bg-muted" />
              <div className="flex gap-2">
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
            {[1, 2].map((section) => (
              <div key={section} className="rounded-lg border bg-card p-6 space-y-4">
                <div className="h-6 w-40 animate-pulse rounded bg-muted" />
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((field) => (
                    <div key={field} className="space-y-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader 
        title="Edit Quotation" 
        showBackButton={true} 
        onBackClick={() => interceptNavigation("/quotation")}
      />
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        <div className="container mx-auto max-w-5xl space-y-6">
          <Breadcrumb items={[
            { label: "Quotations", href: "/quotation" },
            { label: quotationNumber || "Edit" }
          ]} />
          
          {/* Auto-save indicator */}
          <div className="flex justify-end">
            <AutoSaveIndicator status={autoSaveStatus} />
          </div>
          
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" ref={companyRef}>
                    <Label>Company <span className="text-destructive">*</span></Label>
                    <Select value={selectedCompanyId} onValueChange={(value) => {
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
                        variant="ghost"
                        size="icon"
                        onClick={resetRemarksToDefault}
                        className="h-8 w-8"
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
              </div>

              {/* Additional Signatures */}
              <div className="space-y-3">
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
                          size="icon"
                          onClick={() => removeCustomSignature(sig.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Section - Same as create page */}
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
                    renderItem={(item, index) => (
                      <Card className="border-2">
                        <CardContent className="space-y-4 pt-4">
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

                          <div className="space-y-2">
                            <Label className="text-sm font-semibold">Details</Label>

                            {item.details.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">
                                No details added yet. Click "Add Detail" to start.
                              </p>
                            ) : (
                              <>
                                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-muted rounded-md text-xs font-bold">
                                  <div>Detail</div>
                                  <div>Unit Price</div>
                                  <div>Qty</div>
                                  <div>Amount</div>
                                  <div className="w-8"></div>
                                </div>

                                <div className="space-y-2">
                                  {item.details.map((detail) => (
                                    <QuotationDetailRow
                                      key={detail.id}
                                      detail={detail}
                                      itemId={item.id}
                                      canRemove={item.details.length > 1}
                                      onUpdate={updateDetail}
                                      onRemove={removeDetail}
                                      formatCurrency={formatCurrency}
                                    />
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
                        value: formatCurrency(subtotal)
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
                        value: formatCurrency(pphAmount),
                        note: pphNote
                      }
                    } else {
                      return {
                        id: 'total',
                        label: 'Total Amount',
                        value: formatCurrency(totalAmount)
                      }
                    }
                  })}
                  onReorder={(newOrder) => {
                    setHasUnsavedChanges(true)
                    setSummaryOrder(normalizeSummaryOrder(newOrder))
                  }}
                  onSetDownPayment={(percentage) => {
                    setHasUnsavedChanges(true)
                    setDownPaymentPercentage(percentage === 0 ? null : percentage)
                    toast.success(`Down payment set to ${percentage}%`)
                  }}
                  downPaymentPercentage={downPaymentPercentage}
                />
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Delete Button - Left side */}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting || saving}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>

                {/* Save Buttons - Right side. When accepted, only Save (status stays accepted). */}
                <div className="flex flex-wrap gap-3">
                  {quotationStatus === "accepted" ? (
                    <Button
                      type="button"
                      onClick={() => handleSubmit("accepted")}
                      disabled={saving}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save changes
                    </Button>
                  ) : (
                    <>
                      {quotationStatus === "draft" && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSubmit("draft")}
                          disabled={saving}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save as Draft
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => handleSubmit("pending")}
                        disabled={saving}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save as Pending
                      </Button>
                    </>
                  )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the quotation{" "}
              <strong>{quotationNumber}</strong> and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stale Data Warning Dialog */}
      <AlertDialog open={showStaleDataDialog} onOpenChange={setShowStaleDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Data Has Been Updated</AlertDialogTitle>
            <AlertDialogDescription>
              This quotation has been modified since you opened it. Your current changes may overwrite recent updates.
              <br /><br />
              <strong>Would you like to reload the latest data?</strong>
              <br />
              <span className="text-red-600 text-sm">Warning: Reloading will discard your current unsaved changes.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing (Not Recommended)</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReloadData}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Reload Latest Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

