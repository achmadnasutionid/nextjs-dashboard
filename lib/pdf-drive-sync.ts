/**
 * PDF → Google Drive sync. Runs in background when backup trigger runs (24h).
 * - Quotations / Invoices: status not draft (pending + accepted/paid), same ID = replace in Drive.
 * - Paragon / Erha / Barclay: status not draft, non-deleted (same as Quotations/Invoices); 3 PDFs per ticket
 *   (quotation, invoice, BAST). Same file name = replace. Skips quotation/invoice PDF if ID empty.
 * Folder structure: root/Quotations, root/Invoices, root/Paragon/{projectName}, root/Erha/{projectName}, root/Barclay/{projectName}.
 */

import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { prisma } from "@/lib/prisma"
import {
  getOrCreateFolder,
  uploadOrUpdateFile,
  sanitizeName,
  isDriveConfigured,
} from "@/lib/google-drive"
import {
  setBackupSyncRunning,
  updateBackupSyncProgress,
  recordBackupSyncFailure,
  setBackupSyncCompleted,
  setBackupSyncStopped,
  delay,
} from "@/lib/backup-sync-status"
import { QuotationBackupPDF } from "@/components/pdf/quotation-backup-pdf"
import { InvoiceBackupPDF } from "@/components/pdf/invoice-backup-pdf"
import { ParagonQuotationPDF } from "@/components/pdf/paragon-quotation-pdf"
import { ParagonInvoicePDF } from "@/components/pdf/paragon-invoice-pdf"
import { ParagonBASTPDF } from "@/components/pdf/paragon-bast-pdf"
import { BarclayBASTPDF } from "@/components/pdf/barclay-bast-pdf"
import { ErhaQuotationPDF } from "@/components/pdf/erha-quotation-pdf"
import { ErhaInvoicePDF } from "@/components/pdf/erha-invoice-pdf"
import { ErhaBASTPDF } from "@/components/pdf/erha-bast-pdf"

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

export function toQuotationPdfData(q: {
  quotationId: string
  companyName: string
  companyAddress: string
  companyCity: string
  companyProvince: string
  companyPostalCode: string | null
  companyTelp: string | null
  companyEmail: string | null
  productionDate: Date
  billTo: string
  notes: string | null
  billingName: string
  billingBankName: string
  billingBankAccount: string
  billingBankAccountName: string
  signatureName: string
  signatureRole: string | null
  signatureImageData: string
  pph: string
  totalAmount: number
  status: string
  createdAt: Date
  updatedAt: Date
  items: Array<{
    productName: string
    total: number
    details: Array<{ detail: string; unitPrice: number; qty: number; amount: number }>
  }>
  remarks: Array<{ text: string; isCompleted: boolean }>
  signatures: Array<{ name: string; position: string; imageData: string }>
  summaryOrder?: string | null
  termsAndConditions?: string | null
}) {
  return {
    quotationId: q.quotationId,
    companyName: q.companyName,
    companyAddress: q.companyAddress,
    companyCity: q.companyCity,
    companyProvince: q.companyProvince,
    companyPostalCode: q.companyPostalCode ?? undefined,
    companyTelp: q.companyTelp ?? undefined,
    companyEmail: q.companyEmail ?? undefined,
    productionDate: q.productionDate.toISOString(),
    billTo: q.billTo,
    notes: q.notes ?? undefined,
    billingName: q.billingName,
    billingBankName: q.billingBankName,
    billingBankAccount: q.billingBankAccount,
    billingBankAccountName: q.billingBankAccountName,
    signatureName: q.signatureName,
    signatureRole: q.signatureRole ?? undefined,
    signatureImageData: q.signatureImageData,
    pph: q.pph,
    totalAmount: q.totalAmount,
    status: q.status,
    summaryOrder: q.summaryOrder ?? undefined,
    termsAndConditions: q.termsAndConditions ?? undefined,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    items: q.items.map((i) => ({
      productName: i.productName,
      total: i.total,
      details: i.details.map((d) => ({
        detail: d.detail,
        unitPrice: d.unitPrice,
        qty: d.qty,
        amount: d.amount,
      })),
    })),
    remarks: q.remarks.map((r) => ({ text: r.text, isCompleted: r.isCompleted })),
    signatures: q.signatures.map((s) => ({ name: s.name, position: s.position, imageData: s.imageData })),
  }
}

export function toInvoicePdfData(inv: {
  invoiceId: string
  companyName: string
  companyAddress: string
  companyCity: string
  companyProvince: string
  companyPostalCode: string | null
  companyTelp: string | null
  companyEmail: string | null
  productionDate: Date
  billTo: string
  notes: string | null
  billingName: string
  billingBankName: string
  billingBankAccount: string
  billingBankAccountName: string
  signatureName: string
  signatureRole: string | null
  signatureImageData: string
  pph: string
  totalAmount: number
  status: string
  createdAt: Date
  updatedAt: Date
  items: Array<{
    productName: string
    total: number
    details: Array<{ detail: string; unitPrice: number; qty: number; amount: number }>
  }>
  remarks: Array<{ text: string; isCompleted: boolean }>
  signatures: Array<{ name: string; position: string; imageData: string }>
  summaryOrder?: string | null
  termsAndConditions?: string | null
}) {
  return {
    invoiceId: inv.invoiceId,
    companyName: inv.companyName,
    companyAddress: inv.companyAddress,
    companyCity: inv.companyCity,
    companyProvince: inv.companyProvince,
    companyPostalCode: inv.companyPostalCode ?? undefined,
    companyTelp: inv.companyTelp ?? undefined,
    companyEmail: inv.companyEmail ?? undefined,
    productionDate: inv.productionDate.toISOString(),
    billTo: inv.billTo,
    notes: inv.notes ?? undefined,
    billingName: inv.billingName,
    billingBankName: inv.billingBankName,
    billingBankAccount: inv.billingBankAccount,
    billingBankAccountName: inv.billingBankAccountName,
    signatureName: inv.signatureName,
    signatureRole: inv.signatureRole ?? undefined,
    signatureImageData: inv.signatureImageData,
    pph: inv.pph,
    totalAmount: inv.totalAmount,
    status: inv.status,
    summaryOrder: inv.summaryOrder ?? undefined,
    termsAndConditions: inv.termsAndConditions ?? undefined,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    items: inv.items.map((i) => ({
      productName: i.productName,
      total: i.total,
      details: i.details.map((d) => ({
        detail: d.detail,
        unitPrice: d.unitPrice,
        qty: d.qty,
        amount: d.amount,
      })),
    })),
    remarks: inv.remarks.map((r) => ({ text: r.text, isCompleted: r.isCompleted })),
    signatures: inv.signatures.map((s) => ({ name: s.name, position: s.position, imageData: s.imageData })),
  }
}

export function toParagonPdfData(t: {
  ticketId: string
  quotationId: string
  invoiceId: string
  companyName: string
  companyAddress: string
  companyCity: string
  companyProvince: string
  companyPostalCode: string | null
  companyTelp: string | null
  companyEmail: string | null
  productionDate: Date
  quotationDate: Date
  invoiceBastDate: Date
  billTo: string
  projectName: string
  contactPerson: string
  contactPosition: string
  bastContactPerson: string | null
  bastContactPosition: string | null
  signatureName: string
  signatureRole: string | null
  signatureImageData: string
  finalWorkImageData: string | null
  pph: string
  totalAmount: number
  updatedAt: Date
  items: Array<{
    productName: string
    total: number
    details: Array<{ detail: string; unitPrice: number; qty: number; amount: number }>
  }>
  remarks: Array<{ text: string; isCompleted: boolean }>
}) {
  return {
    ticketId: t.ticketId,
    quotationId: t.quotationId,
    invoiceId: t.invoiceId,
    companyName: t.companyName,
    companyAddress: t.companyAddress,
    companyCity: t.companyCity,
    companyProvince: t.companyProvince,
    companyPostalCode: t.companyPostalCode ?? undefined,
    companyTelp: t.companyTelp ?? undefined,
    companyEmail: t.companyEmail ?? undefined,
    productionDate: t.productionDate.toISOString(),
    quotationDate: t.quotationDate.toISOString(),
    invoiceBastDate: t.invoiceBastDate.toISOString(),
    billTo: t.billTo,
    projectName: t.projectName,
    contactPerson: t.contactPerson,
    contactPosition: t.contactPosition,
    bastContactPerson: t.bastContactPerson ?? undefined,
    bastContactPosition: t.bastContactPosition ?? undefined,
    signatureName: t.signatureName,
    signatureRole: t.signatureRole ?? undefined,
    signatureImageData: t.signatureImageData,
    finalWorkImageData: t.finalWorkImageData ?? undefined,
    pph: t.pph,
    totalAmount: t.totalAmount,
    updatedAt: t.updatedAt.toISOString(),
    items: t.items.map((i) => ({
      productName: i.productName,
      total: i.total,
      details: i.details.map((d) => ({
        detail: d.detail,
        unitPrice: d.unitPrice,
        qty: d.qty,
        amount: d.amount,
      })),
    })),
    remarks: t.remarks.map((r) => ({ text: r.text, isCompleted: r.isCompleted })),
  }
}

export function toErhaPdfData(t: {
  ticketId: string
  quotationId: string
  invoiceId: string
  companyName: string
  companyAddress: string
  companyCity: string
  companyProvince: string
  companyPostalCode: string | null
  companyTelp: string | null
  companyEmail: string | null
  productionDate: Date
  quotationDate: Date
  invoiceBastDate: Date
  billTo: string
  projectName: string
  billToAddress: string
  contactPerson: string
  contactPosition: string
  bastContactPerson: string | null
  bastContactPosition: string | null
  billingName: string
  billingBankName: string
  billingBankAccount: string
  billingBankAccountName: string
  billingKtp: string | null
  billingNpwp: string | null
  signatureName: string
  signatureRole: string | null
  signatureImageData: string
  finalWorkImageData: string | null
  pph: string
  totalAmount: number
  updatedAt: Date
  items: Array<{
    productName: string
    total: number
    details: Array<{ detail: string; unitPrice: number; qty: number; amount: number }>
  }>
  remarks: Array<{ text: string; isCompleted: boolean }>
}) {
  return {
    ticketId: t.ticketId,
    quotationId: t.quotationId,
    invoiceId: t.invoiceId,
    companyName: t.companyName,
    companyAddress: t.companyAddress,
    companyCity: t.companyCity,
    companyProvince: t.companyProvince,
    companyPostalCode: t.companyPostalCode ?? undefined,
    companyTelp: t.companyTelp ?? undefined,
    companyEmail: t.companyEmail ?? undefined,
    productionDate: t.productionDate.toISOString(),
    quotationDate: t.quotationDate.toISOString(),
    invoiceBastDate: t.invoiceBastDate.toISOString(),
    billTo: t.billTo,
    projectName: t.projectName,
    billToAddress: t.billToAddress ?? undefined,
    contactPerson: t.contactPerson,
    contactPosition: t.contactPosition,
    bastContactPerson: t.bastContactPerson ?? undefined,
    bastContactPosition: t.bastContactPosition ?? undefined,
    billingName: t.billingName,
    billingBankName: t.billingBankName,
    billingBankAccount: t.billingBankAccount,
    billingBankAccountName: t.billingBankAccountName,
    billingNpwp: t.billingNpwp ?? undefined,
    signatureName: t.signatureName,
    signatureRole: t.signatureRole ?? undefined,
    signatureImageData: t.signatureImageData,
    finalWorkImageData: t.finalWorkImageData ?? undefined,
    pph: t.pph,
    totalAmount: t.totalAmount,
    updatedAt: t.updatedAt.toISOString(),
    items: t.items.map((i) => ({
      productName: i.productName,
      total: i.total,
      details: i.details.map((d) => ({
        detail: d.detail,
        unitPrice: d.unitPrice,
        qty: d.qty,
        amount: d.amount,
      })),
    })),
    remarks: t.remarks.map((r) => ({ text: r.text, isCompleted: r.isCompleted })),
  }
}

export function toBarclayPdfData(t: {
  ticketId: string
  quotationId: string
  invoiceId: string
  companyName: string
  companyAddress: string
  companyCity: string
  companyProvince: string
  companyPostalCode: string | null
  companyTelp: string | null
  companyEmail: string | null
  productionDate: Date
  quotationDate: Date
  invoiceBastDate: Date
  billTo: string
  projectName: string
  contactPerson: string
  contactPosition: string
  bastContactPerson: string | null
  bastContactPosition: string | null
  signatureName: string
  signatureRole: string | null
  signatureImageData: string
  finalWorkImageData: string | null
  pph: string
  totalAmount: number
  updatedAt: Date
  items: Array<{
    productName: string
    total: number
    details: Array<{ detail: string; unitPrice: number; qty: number; amount: number }>
  }>
  remarks: Array<{ text: string; isCompleted: boolean }>
}) {
  return toParagonPdfData(t)
}

function pdfFileName(id: string, billTo: string): string {
  const safe = sanitizeName(billTo).replace(/\s+/g, "_").slice(0, 80)
  return `${id}_${safe}.pdf`
}

function errToString(e: unknown): string {
  if (e instanceof Error) return e.message + (e.stack ? "\n" + e.stack : "")
  return String(e)
}

export async function runPdfDriveSync(): Promise<{
  ok: boolean
  error?: string
  uploaded?: number
  skipped?: number
  skipReason?: string
}> {
  if (!ROOT_FOLDER_ID || !isDriveConfigured()) {
    return { ok: false, error: "Google Drive not configured" }
  }

  let firstError: string | null = null
  let firstSkipReason: string | null = null
  let uploaded = 0
  let skipped = 0
  function setFirstSkipReason(context: string, e: unknown) {
    if (firstSkipReason) return
    firstSkipReason = `${context}: ${errToString(e)}`
  }
  function captureError(e: unknown, context: string) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error && e.stack ? e.stack : ""
    const full = stack ? `${context}: ${msg}\n\nStack:\n${stack}` : `${context}: ${msg}`
    console.error("[pdf-drive-sync]", context, e)
    console.error("[pdf-drive-sync] FULL ERROR (copy this):\n", full)
    if (!firstError) firstError = full
  }

  try {
    const quotationsFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, "Quotations")
    const invoicesFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, "Invoices")
    const paragonFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, "Paragon")
    const erhaFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, "Erha")
    const barclayFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, "Barclay")
    if (!quotationsFolderId || !invoicesFolderId || !paragonFolderId || !erhaFolderId || !barclayFolderId) {
      return { ok: false, error: "Failed to get or create Drive folders" }
    }

    const quotationInclude = {
      items: { include: { details: true }, orderBy: { order: "asc" as const } },
      remarks: { orderBy: { order: "asc" as const } },
      signatures: { orderBy: { order: "asc" as const } },
    }

    // Quotations (exclude draft, exclude deleted)
    const quotations = await prisma.quotation.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: quotationInclude,
    })
    // Invoices (exclude draft, exclude deleted)
    const invoices = await prisma.invoice.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: quotationInclude,
    })
    const paragonTickets = await prisma.paragonTicket.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: {
        items: { include: { details: true }, orderBy: { order: "asc" as const } },
        remarks: { orderBy: { order: "asc" as const } },
      },
    })
    const erhaTickets = await prisma.erhaTicket.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: {
        items: { include: { details: true }, orderBy: { order: "asc" as const } },
        remarks: { orderBy: { order: "asc" as const } },
      },
    })
    const barclayTickets = await prisma.barclayTicket.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: {
        items: { include: { details: true }, orderBy: { order: "asc" as const } },
        remarks: { orderBy: { order: "asc" as const } },
      },
    })
    console.log(
      "[pdf-drive-sync] Syncing:",
      quotations.length,
      "quotations,",
      invoices.length,
      "invoices,",
      paragonTickets.length,
      "Paragon tickets,",
      erhaTickets.length,
      "Erha tickets,",
      barclayTickets.length,
      "Barclay tickets"
    )

    setBackupSyncRunning("Quotations", quotations.length)
    let currentIndex = 0
    for (const q of quotations) {
      currentIndex += 1
      updateBackupSyncProgress({ phase: "Quotations", current: currentIndex, total: quotations.length, uploaded, failed: skipped })
      try {
        const data = toQuotationPdfData(q)
        const buffer = await renderToBuffer(
          React.createElement(QuotationBackupPDF, { data }) as Parameters<typeof renderToBuffer>[0]
        )
        const fileName = pdfFileName(q.quotationId, q.billTo)
        const uploadResult = await uploadOrUpdateFile(
          quotationsFolderId,
          fileName,
          Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
        )
        if (uploadResult.ok) {
          uploaded += 1
          updateBackupSyncProgress({ uploaded })
        } else {
          skipped += 1
          setFirstSkipReason(`Quotation ${fileName} upload`, uploadResult.error)
          console.error("[pdf-drive-sync] Upload failed for quotation:", fileName, uploadResult.error)
          if (recordBackupSyncFailure(uploadResult.error ?? "Upload failed")) {
            setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${uploadResult.error}`)
            return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      } catch (e) {
        captureError(e, `Quotation ${q.quotationId}`)
        const errStr = e instanceof Error ? e.message : String(e)
        if (recordBackupSyncFailure(errStr)) {
          setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${errStr}`)
          return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
        }
      }
      await delay(200)
    }

    updateBackupSyncProgress({ phase: "Invoices", current: 0, total: invoices.length })
    currentIndex = 0
    for (const inv of invoices) {
      currentIndex += 1
      updateBackupSyncProgress({ phase: "Invoices", current: currentIndex, total: invoices.length, uploaded, failed: skipped })
      try {
        const data = toInvoicePdfData(inv)
        const buffer = await renderToBuffer(
          React.createElement(InvoiceBackupPDF, { data }) as Parameters<typeof renderToBuffer>[0]
        )
        const fileName = pdfFileName(inv.invoiceId, inv.billTo)
        const uploadResult = await uploadOrUpdateFile(
          invoicesFolderId,
          fileName,
          Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
        )
        if (uploadResult.ok) {
          uploaded += 1
          updateBackupSyncProgress({ uploaded })
        } else {
          skipped += 1
          setFirstSkipReason(`Invoice ${fileName} upload`, uploadResult.error)
          console.error("[pdf-drive-sync] Upload failed for invoice:", fileName, uploadResult.error)
          if (recordBackupSyncFailure(uploadResult.error ?? "Upload failed")) {
            setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${uploadResult.error}`)
            return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      } catch (e) {
        captureError(e, `Invoice ${inv.invoiceId}`)
        const errStr = e instanceof Error ? e.message : String(e)
        if (recordBackupSyncFailure(errStr)) {
          setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${errStr}`)
          return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
        }
      }
      await delay(200)
    }

    updateBackupSyncProgress({ phase: "Paragon", current: 0, total: paragonTickets.length })
    let paragonIndex = 0
    for (const t of paragonTickets) {
      paragonIndex += 1
      updateBackupSyncProgress({ phase: "Paragon", current: paragonIndex, total: paragonTickets.length, uploaded, failed: skipped })
      const folderName = (t.projectName?.trim() || t.billTo) || "unnamed"
      const projectFolderId = await getOrCreateFolder(paragonFolderId, folderName)
      if (!projectFolderId) continue
      const data = toParagonPdfData(t)
      const files: [string, React.ReactElement][] = [[t.ticketId + "_BAST.pdf", React.createElement(ParagonBASTPDF, { data, forSync: true })]]
      if (t.quotationId?.trim()) files.push([t.quotationId + ".pdf", React.createElement(ParagonQuotationPDF, { data, forSync: true })])
      if (t.invoiceId?.trim()) files.push([t.invoiceId + ".pdf", React.createElement(ParagonInvoicePDF, { data, forSync: true })])
      for (const [fileName, el] of files) {
        try {
          const buffer = await renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
          const uploadResult = await uploadOrUpdateFile(projectFolderId, fileName, Buffer.from(buffer))
          if (uploadResult.ok) {
            uploaded += 1
            updateBackupSyncProgress({ uploaded })
          } else {
            skipped += 1
            setFirstSkipReason(`Paragon ${fileName} upload`, uploadResult.error)
            console.error("[pdf-drive-sync] Upload failed for Paragon:", fileName, uploadResult.error)
            if (recordBackupSyncFailure(uploadResult.error ?? "Upload failed")) {
              setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${uploadResult.error}`)
              return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
            }
          }
        } catch (e) {
          skipped += 1
          setFirstSkipReason(`Paragon ${t.ticketId} ${fileName} render`, e)
          console.error("[pdf-drive-sync] Paragon", t.ticketId, fileName, "skipped:", e)
          const errStr = e instanceof Error ? e.message : String(e)
          if (recordBackupSyncFailure(errStr)) {
            setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${errStr}`)
            return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      }
      await delay(200)
    }

    updateBackupSyncProgress({ phase: "Barclay", current: 0, total: barclayTickets.length })
    let barclayIndex = 0
    for (const t of barclayTickets) {
      barclayIndex += 1
      updateBackupSyncProgress({ phase: "Barclay", current: barclayIndex, total: barclayTickets.length, uploaded, failed: skipped })
      const folderName = (t.projectName?.trim() || t.billTo) || "unnamed"
      const projectFolderId = await getOrCreateFolder(barclayFolderId, folderName)
      if (!projectFolderId) continue
      const data = toBarclayPdfData(t)
      const files: [string, React.ReactElement][] = [[t.ticketId + "_BAST.pdf", React.createElement(BarclayBASTPDF, { data, forSync: true })]]
      if (t.quotationId?.trim()) files.push([t.quotationId + ".pdf", React.createElement(ParagonQuotationPDF, { data, forSync: true })])
      if (t.invoiceId?.trim()) files.push([t.invoiceId + ".pdf", React.createElement(ParagonInvoicePDF, { data, forSync: true })])
      for (const [fileName, el] of files) {
        try {
          const buffer = await renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
          const uploadResult = await uploadOrUpdateFile(projectFolderId, fileName, Buffer.from(buffer))
          if (uploadResult.ok) {
            uploaded += 1
            updateBackupSyncProgress({ uploaded })
          } else {
            skipped += 1
            setFirstSkipReason(`Barclay ${fileName} upload`, uploadResult.error)
            console.error("[pdf-drive-sync] Upload failed for Barclay:", fileName, uploadResult.error)
            if (recordBackupSyncFailure(uploadResult.error ?? "Upload failed")) {
              setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${uploadResult.error}`)
              return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
            }
          }
        } catch (e) {
          skipped += 1
          setFirstSkipReason(`Barclay ${t.ticketId} ${fileName} render`, e)
          console.error("[pdf-drive-sync] Barclay", t.ticketId, fileName, "skipped:", e)
          const errStr = e instanceof Error ? e.message : String(e)
          if (recordBackupSyncFailure(errStr)) {
            setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${errStr}`)
            return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      }
      await delay(200)
    }

    updateBackupSyncProgress({ phase: "Erha", current: 0, total: erhaTickets.length })
    let erhaIndex = 0
    for (const t of erhaTickets) {
      erhaIndex += 1
      updateBackupSyncProgress({ phase: "Erha", current: erhaIndex, total: erhaTickets.length, uploaded, failed: skipped })
      const folderName = (t.projectName?.trim() || t.billTo) || "unnamed"
      const projectFolderId = await getOrCreateFolder(erhaFolderId, folderName)
      if (!projectFolderId) continue
      const data = toErhaPdfData(t)
      const files: [string, React.ReactElement][] = [[t.ticketId + "_BAST.pdf", React.createElement(ErhaBASTPDF, { data, forSync: true })]]
      if (t.quotationId?.trim()) files.push([t.quotationId + ".pdf", React.createElement(ErhaQuotationPDF, { data, forSync: true })])
      if (t.invoiceId?.trim()) files.push([t.invoiceId + ".pdf", React.createElement(ErhaInvoicePDF, { data, forSync: true })])
      for (const [fileName, el] of files) {
        try {
          const buffer = await renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
          const uploadResult = await uploadOrUpdateFile(projectFolderId, fileName, Buffer.from(buffer))
          if (uploadResult.ok) {
            uploaded += 1
            updateBackupSyncProgress({ uploaded })
          } else {
            skipped += 1
            setFirstSkipReason(`Erha ${fileName} upload`, uploadResult.error)
            console.error("[pdf-drive-sync] Upload failed for Erha:", fileName, uploadResult.error)
            if (recordBackupSyncFailure(uploadResult.error ?? "Upload failed")) {
              setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${uploadResult.error}`)
              return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
            }
          }
        } catch (e) {
          skipped += 1
          setFirstSkipReason(`Erha ${t.ticketId} ${fileName} render`, e)
          console.error("[pdf-drive-sync] Erha", t.ticketId, fileName, "skipped:", e)
          const errStr = e instanceof Error ? e.message : String(e)
          if (recordBackupSyncFailure(errStr)) {
            setBackupSyncStopped(`Stopped after 3 failures to avoid burdening the service. Last error: ${errStr}`)
            return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      }
      await delay(200)
    }

    if (skipped > 0) {
      console.log("[pdf-drive-sync] Done. uploaded:", uploaded, "skipped:", skipped, "first skip reason:", firstSkipReason ?? "(none)")
    }
    if (firstError) return { ok: false, error: firstError, uploaded, skipped, skipReason: firstSkipReason ?? undefined }
    setBackupSyncCompleted(uploaded, skipped)
    return { ok: true, uploaded, skipped, skipReason: firstSkipReason ?? undefined }
  } catch (e) {
    console.error("[pdf-drive-sync] Failed:", e)
    const errStr = e instanceof Error ? e.message : String(e)
    setBackupSyncStopped(errStr)
    return { ok: false, error: errStr }
  }
}

/**
 * Start PDF→Drive sync in the background (fire-and-forget). Call when backup runs after 24h.
 */
export function runPdfDriveSyncInBackground(): void {
  if (!isDriveConfigured()) return
  runPdfDriveSync()
    .then((r) => {
      if (r.ok) console.log("[pdf-drive-sync] Completed.")
      else console.error("[pdf-drive-sync] Error:", r.error)
    })
    .catch((e) => console.error("[pdf-drive-sync] Failed:", e))
}
