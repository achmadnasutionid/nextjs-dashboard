"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
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
import { Save, Plus, Trash2, GripVertical, Percent } from "lucide-react"
import { SortableItems } from "@/components/ui/sortable-items"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog"
import { ReorderableRemarks } from "@/components/ui/reorderable-remarks"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ParagonDetailRow } from "@/components/form/ParagonDetailRow"
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator"
import { useSmartAutoSave } from "@/lib/smart-auto-save"
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

export default function EditParagonTicketPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string
  
  // Form fields
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productionDate, setProductionDate] = useState<Date>()
  const [quotationDate, setQuotationDate] = useState<Date>()
  const [invoiceBastDate, setInvoiceBastDate] = useState<Date>()
  const [billTo, setBillTo] = useState("")
  const [projectName, setProjectName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactPosition, setContactPosition] = useState("")
  const [bastContactPerson, setBastContactPerson] = useState("")
  const [bastContactPosition, setBastContactPosition] = useState("")
  const [remarks, setRemarks] = useState<Remark[]>([])
  const [termsAndConditions, setTermsAndConditions] = useState("")
  const [showTerms, setShowTerms] = useState(false)
  const [selectedSignatureId, setSelectedSignatureId] = useState("")
  const [pph, setPph] = useState("2") // Auto-select PPH 23 2%
  const [items, setItems] = useState<Item[]>([])
  const [finalWorkImage, setFinalWorkImage] = useState<string>("")
  const [adjustmentPercentage, setAdjustmentPercentage] = useState<number | null>(null)
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>("")
  const [currentStatus, setCurrentStatus] = useState<string>("draft")
  
  // Master data
  const [companies, setCompanies] = useState<Company[]>([])
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [productDetails, setProductDetails] = useState<any[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isSavingManually, setIsSavingManually] = useState(false)
  const [errors, setErrors] = useState<any>({})
  const [ticketNumber, setTicketNumber] = useState<string>("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const initialDataRef = useRef<string>("")
  const lastUpdatedAtRef = useRef<string>("")
  const [showStaleDataDialog, setShowStaleDataDialog] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  
  // Refs for error scrolling
  const companyRef = useRef<HTMLDivElement>(null)
  const productionDateRef = useRef<HTMLDivElement>(null)
  const quotationDateRef = useRef<HTMLDivElement>(null)
  const invoiceBastDateRef = useRef<HTMLDivElement>(null)
  const billToRef = useRef<HTMLDivElement>(null)
  const projectNameRef = useRef<HTMLDivElement>(null)
  const contactPersonRef = useRef<HTMLDivElement>(null)
  const contactPositionRef = useRef<HTMLDivElement>(null)
  const signatureRef = useRef<HTMLDivElement>(null)

  // Auto-save integration
  const { autoSaveStatus, triggerAutoSave, cancelAutoSave } = useSmartAutoSave({
    recordId: ticketId,
    type: 'paragon',
    getData: () => {
      const company = companies.find(c => c.id === selectedCompanyId)
      const signature = signatures.find(s => s.id === selectedSignatureId)

      return {
        companyName: company?.name,
        companyAddress: company?.address,
        companyCity: company?.city,
        companyProvince: company?.province,
        companyPostalCode: company?.postalCode,
        companyTelp: company?.telp,
        companyEmail: company?.email,
        productionDate: productionDate?.toISOString(),
        quotationDate: quotationDate?.toISOString(),
        invoiceBastDate: invoiceBastDate?.toISOString(),
        billTo,
        projectName,
        contactPerson,
        contactPosition,
        signatureName: signature?.name,
        signatureRole: signature?.role || null,
        signatureImageData: signature?.imageData,
        finalWorkImageData: finalWorkImage || null,
        pph,
        totalAmount,
        adjustmentPercentage: adjustmentPercentage ?? undefined,
        adjustmentNotes: adjustmentNotes.trim() || undefined,
        termsAndConditions: showTerms ? termsAndConditions : null,
        status: 'draft',
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
        })),
        remarks: remarks.filter(r => r.text.trim()).map(remark => ({
          id: remark.id,
          text: remark.text,
          isCompleted: remark.isCompleted
        })),
        lastKnownUpdatedAt: lastUpdatedAtRef.current,
        // Mandatory fields for validation
        selectedCompanyId,
        selectedSignatureId
      }
    },
    onSuccess: () => {
      setHasUnsavedChanges(false)
    },
    onError: (error: any) => {
      if (error.conflict) {
        setShowStaleDataDialog(true)
      }
    }
  })
  
  // Fetch master data and ticket data
  useEffect(() => {
    Promise.all([
      fetch("/api/companies").then(res => res.json()),
      fetch("/api/signatures").then(res => res.json()),
      fetch("/api/products").then(res => res.json()),
      fetch(`/api/paragon/${ticketId}`).then(res => res.json()),
    ]).then(([companiesData, signaturesData, productsData, ticketData]) => {
      setCompanies(companiesData)
      setSignatures(signaturesData)
      setProducts(productsData.map((p: any) => p.name))
      setProductDetails(productsData) // Store full product objects with details
      
      // Populate form with existing ticket data
      setTicketNumber(ticketData.ticketId)
      setCurrentStatus(ticketData.status)
      setProductionDate(new Date(ticketData.productionDate))
      setQuotationDate(new Date(ticketData.quotationDate))
      setInvoiceBastDate(new Date(ticketData.invoiceBastDate))
      setProjectName(ticketData.projectName ?? "")
      const billToClientPart = (ticketData.projectName && ticketData.billTo.endsWith(" - " + ticketData.projectName))
        ? ticketData.billTo.slice(0, -(ticketData.projectName.length + 3)).trim()
        : ticketData.billTo
      setBillTo(billToClientPart)
      setContactPerson(ticketData.contactPerson)
      setContactPosition(ticketData.contactPosition)
      setBastContactPerson(ticketData.bastContactPerson ?? "")
      setBastContactPosition(ticketData.bastContactPosition ?? "")
      setPph(ticketData.pph)
      setAdjustmentPercentage(ticketData.adjustmentPercentage ?? null)
      setAdjustmentNotes(ticketData.adjustmentNotes ?? "")
      
      // Find matching company
      const matchingCompany = companiesData.find((c: Company) => c.name === ticketData.companyName)
      if (matchingCompany) {
        setSelectedCompanyId(matchingCompany.id)
      }
      
      // Find matching signature
      const matchingSignature = signaturesData.find((s: Signature) => s.name === ticketData.signatureName)
      if (matchingSignature) {
        setSelectedSignatureId(matchingSignature.id)
      }
      
      // Set items
      setItems(ticketData.items.map((item: any) => ({
        id: item.id,
        productName: item.productName,
        total: item.total,
        details: item.details.map((detail: any) => ({
          id: detail.id,
          detail: detail.detail,
          unitPrice: detail.unitPrice.toString(),
          qty: detail.qty.toString(),
          amount: detail.amount
        }))
      })))
      
      // Set remarks
      setRemarks(ticketData.remarks?.map((remark: any) => ({
        id: remark.id,
        text: remark.text,
        isCompleted: remark.isCompleted
      })) || [])
      
      // Set final work image
      setFinalWorkImage(ticketData.finalWorkImageData || "")
      
      setLoading(false)
      
      // Store the updatedAt timestamp for stale data detection
      lastUpdatedAtRef.current = ticketData.updatedAt
      
      // Store initial data snapshot for change detection
      const loadedItems = ticketData.items.map((item: any) => ({
        id: item.id,
        productName: item.productName,
        total: item.total,
        details: item.details
      }))
      const loadedRemarks = ticketData.remarks?.map((remark: any) => ({
        id: remark.id,
        text: remark.text,
        isCompleted: remark.isCompleted
      })) || []
      
      initialDataRef.current = JSON.stringify({
        selectedCompanyId,
        productionDate,
        quotationDate,
        invoiceBastDate,
        billTo,
        projectName,
        contactPerson,
        contactPosition,
        bastContactPerson: ticketData.bastContactPerson ?? "",
        bastContactPosition: ticketData.bastContactPosition ?? "",
        selectedSignatureId,
        pph,
        items: loadedItems,
        remarks: loadedRemarks,
        finalWorkImage: ticketData.finalWorkImageData || ""
      })
    }).catch(error => {
      console.error("Error fetching data:", error)
      toast.error("Failed to load ticket data")
      setLoading(false)
    })
  }, [ticketId])

  // Track changes
  useEffect(() => {
    if (loading || !initialDataRef.current) return
    
    const currentData = JSON.stringify({
      selectedCompanyId,
      productionDate: productionDate?.toISOString(),
      quotationDate: quotationDate?.toISOString(),
      invoiceBastDate: invoiceBastDate?.toISOString(),
      billTo,
      projectName,
      contactPerson,
      contactPosition,
      bastContactPerson,
      bastContactPosition,
      selectedSignatureId,
      pph,
      items,
      remarks,
      finalWorkImage
    })
    
    setHasUnsavedChanges(currentData !== initialDataRef.current)
  }, [selectedCompanyId, productionDate, quotationDate, invoiceBastDate, billTo, projectName, contactPerson, contactPosition, bastContactPerson, bastContactPosition, selectedSignatureId, pph, items, remarks, finalWorkImage, loading])

  // Auto-save trigger when data changes (only if mandatory fields filled)
  useEffect(() => {
    if (loading || isSavingManually) return
    
    // Check if mandatory fields are filled
    const mandatoryFilled = selectedCompanyId && productionDate && quotationDate && 
      invoiceBastDate && billTo.trim() && projectName.trim() && contactPerson.trim() && 
      contactPosition.trim() && selectedSignatureId
    
    if (mandatoryFilled) {
      triggerAutoSave()
    }
  }, [selectedCompanyId, productionDate, quotationDate, invoiceBastDate, billTo, projectName, contactPerson, contactPosition, bastContactPerson, bastContactPosition, selectedSignatureId, pph, items, remarks, finalWorkImage, loading, isSavingManually, triggerAutoSave])

  // Check for stale data when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !loading && ticketId && lastUpdatedAtRef.current) {
        try {
          const response = await fetch(`/api/paragon/${ticketId}`)
          if (response.ok) {
            const latestData = await response.json()
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
  }, [ticketId, loading])

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
      await handleSubmit((currentStatus as "draft" | "pending" | "final") || "draft")
    },
    enabled: !loading
  })

  // Handle screenshot final work upload with compression
  const handleFinalWorkImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setFinalWorkImage("")
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

  // Item management (optimized with useCallback)
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
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? { ...item, productName } : item
    ))
  }, [])

  const formatItemName = useCallback((itemId: string) => {
    setItems(prevItems => {
      const item = prevItems.find(i => i.id === itemId)
      if (!item || !item.productName.trim()) return prevItems
      
      const finalName = formatProductName(item.productName, products)
      const masterProduct = productDetails.find((p: any) => 
        p.name.toLowerCase() === finalName.toLowerCase()
      )
      
      return prevItems.map(item => {
        if (item.id !== itemId) return item
        
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
      if (item && item.details.length <= 1) {
        toast.warning("Cannot remove detail", {
          description: "Each item must have at least one detail."
        })
        return prevItems
      }
      
      return prevItems.map(item => {
        if (item.id === itemId) {
          const newDetails = item.details.filter(d => d.id !== detailId)
          return {
            ...item,
            details: newDetails,
            total: newDetails.reduce((sum, d) => sum + d.amount, 0)
          }
        }
        return item
      })
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
    setHasUnsavedChanges(true)
    toast.success(`All amounts adjusted by ${percentage > 0 ? "+" : ""}${percentage}%`)
  }, [adjustmentPercentage])

  // Memoized calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }, [items])

  const pphAmount = useMemo(() => {
    const pphRate = parseFloat(pph)
    if (pphRate === 0) return 0
    const grossAmount = subtotal * (100 / (100 - pphRate))
    return grossAmount - subtotal
  }, [subtotal, pph])

  const totalAmount = useMemo(() => {
    return subtotal + pphAmount
  }, [subtotal, pphAmount])

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

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
    if (!contactPerson.trim()) newErrors.contactPerson = "Contact Person is required"
    if (!contactPosition.trim()) newErrors.contactPosition = "Position is required"
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
          contactPerson: contactPersonRef,
          contactPosition: contactPositionRef,
          signature: signatureRef,
        })
      }, 0)
    }
    
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (status: "draft" | "pending" | "final") => {
    if (saving) return

    // Cancel any pending auto-save
    cancelAutoSave()
    setIsSavingManually(true)

    try {
      if (!validateForm()) {
        toast.error("Validation failed", {
          description: "Please fill in all required fields"
        })
        return
      }

      // Additional validation for pending and final (same as quotation/invoice)
      if (status === "pending" || status === "final") {
        if (items.length === 0) {
          toast.warning(status === "final" ? "Cannot finalize ticket" : "Cannot save as pending", {
            description: status === "final"
              ? "Please add at least one item before finalizing."
              : "Please add at least one item before saving as pending."
          })
          return
        }

        const emptyProducts = items.filter(item => !item.productName.trim())
        if (emptyProducts.length > 0) {
          toast.warning(status === "final" ? "Cannot finalize ticket" : "Cannot save as pending", {
            description: "All items must have a product name filled in."
          })
          return
        }

        const itemsWithoutDetails = items.filter(item => item.details.length === 0)
        if (itemsWithoutDetails.length > 0) {
          toast.warning(status === "final" ? "Cannot finalize ticket" : "Cannot save as pending", {
            description: "All products must have at least one detail."
          })
          return
        }
      }

      setSaving(true)
      const company = companies.find(c => c.id === selectedCompanyId)!
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
        quotationDate: quotationDate!.toISOString(),
        invoiceBastDate: invoiceBastDate!.toISOString(),
        billTo: billTo.trim(),
        projectName: projectName.trim(),
        contactPerson: contactPerson.trim(),
        contactPosition: contactPosition.trim(),
        bastContactPerson: bastContactPerson.trim() || null,
        bastContactPosition: bastContactPosition.trim() || null,
        signatureName: signature.name,
        signatureRole: signature.role || null,
        signatureImageData: signature.imageData,
        finalWorkImageData: finalWorkImage || null,
        pph,
        totalAmount: totalAmount,
        adjustmentPercentage: adjustmentPercentage ?? undefined,
        adjustmentNotes: adjustmentNotes.trim() || undefined,
        termsAndConditions: showTerms ? termsAndConditions : null,
        status,
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
        })),
        remarks: remarks.filter(r => r.text.trim()).map(remark => ({
          id: remark.id,
          text: remark.text,
          isCompleted: remark.isCompleted
        }))
      }

      const response = await fetch(`/api/paragon/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const msg =
          status === "final"
            ? "Ticket finalized successfully!"
            : status === "pending"
              ? "Ticket saved as pending successfully!"
              : "Ticket saved as draft successfully!"
        toast.success(msg)
        setHasUnsavedChanges(false)
        // Redirect to view if pending or final (like quotation/invoice), so user can review and finalize from view
        if (status === "pending" || status === "final") {
          router.push(`/special-case/paragon/${ticketId}/view`)
        } else {
          router.push("/special-case/paragon")
        }
      } else {
        let description = "An error occurred"
        try {
          const errorData = await response.json()
          description = errorData.error || description
        } catch {
          if (response.status === 413) description = "Request too large. Try using smaller images for signature and screenshot."
        }
        toast.error("Failed to update ticket", { description })
      }
    } catch (error) {
      console.error("Error updating ticket:", error)
      toast.error("Failed to update ticket")
    } finally {
      setSaving(false)
      setIsSavingManually(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/paragon/${ticketId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        toast.success("Paragon ticket deleted successfully")
        setHasUnsavedChanges(false) // Clear unsaved changes to avoid dialog
        router.push("/special-case/paragon")
      } else {
        const data = await response.json()
        toast.error("Failed to delete ticket", {
          description: data.error || "An error occurred while deleting."
        })
      }
    } catch (error) {
      console.error("Error deleting ticket:", error)
      toast.error("Failed to delete ticket", {
        description: "An unexpected error occurred."
      })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader 
        title="Edit Paragon Ticket" 
        showBackButton={true} 
        onBackClick={() => interceptNavigation("/special-case/paragon")}
      />
      <main className="flex flex-1 flex-col bg-gradient-to-br from-background via-background to-muted px-4 py-12">
        {loading ? (
          <div className="container mx-auto max-w-5xl space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-8 w-56 animate-pulse rounded bg-muted" />
              <div className="flex gap-2">
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
            {[1, 2, 3].map((section) => (
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
        ) : (
        <div className="container mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <Breadcrumb items={[
              { label: "Paragon Tickets", href: "/special-case/paragon" },
              { label: ticketNumber || "Edit" }
            ]} />
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" ref={quotationDateRef}>
                    <Label>Quotation Date <span className="text-destructive">*</span></Label>
                    <DatePicker date={quotationDate} onDateChange={(date) => {
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" ref={contactPersonRef}>
                    <Label>Contact Person (Quotation) <span className="text-destructive">*</span></Label>
                    <Input
                      value={contactPerson}
                      onChange={(e) => {
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
                      onChange={(e) => setBastContactPerson(e.target.value)}
                      placeholder="Leave blank to use same as quotation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Position (BAST / Invoice)</Label>
                    <Input
                      value={bastContactPosition}
                      onChange={(e) => setBastContactPosition(e.target.value)}
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

              {/* Signature Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Signature Information</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
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

                  <div className="space-y-2">
                    <Label>PPh</Label>
                    <Select value={pph} onValueChange={(value) => {
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
                                    <ParagonDetailRow
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
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{PPH_OPTIONS.find(opt => opt.value === pph)?.label || `PPh (${pph}%)`}:</span>
                      <span className="font-medium text-green-600">
                        + {formatCurrency(pphAmount)}
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
                      <span className="text-primary">{formatCurrency(totalAmount)}</span>
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

                {/* Save Buttons: when final, only Save changes (status stays final). Otherwise Draft and Pending only; finalize is on list/view. */}
                <div className="flex flex-wrap gap-3">
                  {currentStatus === "final" ? (
                    <Button
                      type="button"
                      onClick={() => handleSubmit("final")}
                      disabled={saving}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save changes
                    </Button>
                  ) : (
                    <>
                      {currentStatus === "draft" && (
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
        )}
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
            <AlertDialogTitle>Delete Paragon Ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the ticket{" "}
              <strong>{ticketNumber}</strong> and all its associated data.
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
              This ticket has been modified since you opened it. Your current changes may overwrite recent updates.
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

