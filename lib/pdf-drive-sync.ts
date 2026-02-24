/**
 * PDF → Google Drive sync. Runs in background when backup trigger runs (24h).
 * - Quotations / Invoices: status not draft (pending + accepted/paid), same ID = replace in Drive.
 * - Paragon / Erha: status not draft, non-deleted (same as Quotations/Invoices); 3 PDFs per ticket
 *   (quotation, invoice, BAST). Same file name = replace. Skips quotation/invoice PDF if ID empty.
 * Folder structure: root/Quotations, root/Invoices, root/Paragon/{projectName}, root/Erha/{projectName}.
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
import { QuotationPDF, QuotationPDFMinimal } from "@/components/pdf/quotation-pdf"
import { InvoicePDF, InvoicePDFMinimal } from "@/components/pdf/invoice-pdf"
import { ParagonQuotationPDF } from "@/components/pdf/paragon-quotation-pdf"
import { ParagonInvoicePDF } from "@/components/pdf/paragon-invoice-pdf"
import { ParagonBASTPDF } from "@/components/pdf/paragon-bast-pdf"
import { ErhaQuotationPDF } from "@/components/pdf/erha-quotation-pdf"
import { ErhaInvoicePDF } from "@/components/pdf/erha-invoice-pdf"
import { ErhaBASTPDF } from "@/components/pdf/erha-bast-pdf"

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

function toQuotationPdfData(q: {
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

function toInvoicePdfData(inv: {
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

function toParagonPdfData(t: {
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

function toErhaPdfData(t: {
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

function pdfFileName(id: string, billTo: string): string {
  const safe = sanitizeName(billTo).replace(/\s+/g, "_").slice(0, 80)
  return `${id}_${safe}.pdf`
}

export async function runPdfDriveSync(): Promise<{ ok: boolean; error?: string }> {
  if (!ROOT_FOLDER_ID || !isDriveConfigured()) {
    return { ok: false, error: "Google Drive not configured" }
  }

  let firstError: string | null = null
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
    if (!quotationsFolderId || !invoicesFolderId || !paragonFolderId || !erhaFolderId) {
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
    for (const q of quotations) {
      try {
        const data = toQuotationPdfData(q)
        let buffer: ArrayBuffer | Buffer
        try {
          buffer = await renderToBuffer(
            React.createElement(QuotationPDF, { data }) as Parameters<typeof renderToBuffer>[0]
          )
        } catch {
          // Fall back to minimal PDF (e.g. structure-tree 'S' bug in full PDF)
          try {
            buffer = await renderToBuffer(
              React.createElement(QuotationPDFMinimal, { data }) as Parameters<typeof renderToBuffer>[0]
            )
          } catch (minimalErr) {
            console.error("[pdf-drive-sync] Quotation", q.quotationId, "minimal fallback failed:", minimalErr)
            continue
          }
        }
        const fileName = pdfFileName(q.quotationId, q.billTo)
        await uploadOrUpdateFile(quotationsFolderId, fileName, Buffer.from(buffer))
      } catch (e) {
        captureError(e, `Quotation ${q.quotationId}`)
      }
    }

    // Invoices (exclude draft, exclude deleted)
    const invoices = await prisma.invoice.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: quotationInclude,
    })
    for (const inv of invoices) {
      try {
        const data = toInvoicePdfData(inv)
        let buffer: ArrayBuffer | Buffer
        try {
          buffer = await renderToBuffer(
            React.createElement(InvoicePDF, { data }) as Parameters<typeof renderToBuffer>[0]
          )
        } catch {
          try {
            buffer = await renderToBuffer(
              React.createElement(InvoicePDFMinimal, { data }) as Parameters<typeof renderToBuffer>[0]
            )
          } catch (minimalErr) {
            console.error("[pdf-drive-sync] Invoice", inv.invoiceId, "minimal fallback failed:", minimalErr)
            continue
          }
        }
        const fileName = pdfFileName(inv.invoiceId, inv.billTo)
        await uploadOrUpdateFile(invoicesFolderId, fileName, Buffer.from(buffer))
      } catch (e) {
        captureError(e, `Invoice ${inv.invoiceId}`)
      }
    }

    // Paragon tickets (non-draft, exclude deleted) – up to 3 PDFs per ticket under Paragon/{projectName}
    const paragonTickets = await prisma.paragonTicket.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: {
        items: { include: { details: true }, orderBy: { order: "asc" as const } },
        remarks: { orderBy: { order: "asc" as const } },
      },
    })
    for (const t of paragonTickets) {
      const folderName = (t.projectName?.trim() || t.billTo) || "unnamed"
      const projectFolderId = await getOrCreateFolder(paragonFolderId, folderName)
      if (!projectFolderId) continue
      const data = toParagonPdfData(t)
      const files: [string, React.ReactElement][] = [[t.ticketId + "_BAST.pdf", React.createElement(ParagonBASTPDF, { data })]]
      if (t.quotationId?.trim()) files.push([t.quotationId + ".pdf", React.createElement(ParagonQuotationPDF, { data })])
      if (t.invoiceId?.trim()) files.push([t.invoiceId + ".pdf", React.createElement(ParagonInvoicePDF, { data })])
      for (const [fileName, el] of files) {
        try {
          const buffer = await renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
          await uploadOrUpdateFile(projectFolderId, fileName, Buffer.from(buffer))
        } catch (e) {
          captureError(e, `Paragon ${t.ticketId} ${fileName}`)
        }
      }
    }

    // Erha tickets (non-draft, exclude deleted) – up to 3 PDFs per ticket under Erha/{projectName}
    const erhaTickets = await prisma.erhaTicket.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: {
        items: { include: { details: true }, orderBy: { order: "asc" as const } },
        remarks: { orderBy: { order: "asc" as const } },
      },
    })
    for (const t of erhaTickets) {
      const folderName = (t.projectName?.trim() || t.billTo) || "unnamed"
      const projectFolderId = await getOrCreateFolder(erhaFolderId, folderName)
      if (!projectFolderId) continue
      const data = toErhaPdfData(t)
      const files: [string, React.ReactElement][] = [[t.ticketId + "_BAST.pdf", React.createElement(ErhaBASTPDF, { data })]]
      if (t.quotationId?.trim()) files.push([t.quotationId + ".pdf", React.createElement(ErhaQuotationPDF, { data })])
      if (t.invoiceId?.trim()) files.push([t.invoiceId + ".pdf", React.createElement(ErhaInvoicePDF, { data })])
      for (const [fileName, el] of files) {
        try {
          const buffer = await renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
          await uploadOrUpdateFile(projectFolderId, fileName, Buffer.from(buffer))
        } catch (e) {
          captureError(e, `Erha ${t.ticketId} ${fileName}`)
        }
      }
    }

    if (firstError) return { ok: false, error: firstError }
    return { ok: true }
  } catch (e) {
    console.error("[pdf-drive-sync] Failed:", e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
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
