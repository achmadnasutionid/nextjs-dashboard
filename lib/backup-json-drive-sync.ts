/**
 * JSON → Google Drive backup sync. No PDF rendering; uploads one JSON file per document/ticket.
 * Same folder structure: root/Quotations, root/Invoices, root/Paragon/{projectName}, root/Erha/{projectName}, root/Barclay/{projectName}.
 * Files: QTN-2026-1820.json, INV-2026-xxx.json, and one JSON per special-case ticket.
 */

import { prisma } from "@/lib/prisma"
import { getOrCreateFolder, uploadOrUpdateJsonFile, isDriveConfigured } from "@/lib/google-drive"
import {
  toQuotationPdfData,
  toInvoicePdfData,
  toParagonPdfData,
  toErhaPdfData,
  toBarclayPdfData,
} from "@/lib/pdf-drive-sync"
import {
  setBackupSyncRunning,
  updateBackupSyncProgress,
  recordBackupSyncFailure,
  setBackupSyncCompleted,
  setBackupSyncStopped,
  delay,
} from "@/lib/backup-sync-status"

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

export async function runJsonDriveSync(): Promise<{
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
    firstSkipReason = `${context}: ${e instanceof Error ? e.message : String(e)}`
  }
  function captureError(e: unknown, context: string) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[backup-json-drive-sync]", context, e)
    if (!firstError) firstError = `${context}: ${msg}`
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

    const quotations = await prisma.quotation.findMany({
      where: { status: { not: "draft" }, deletedAt: null },
      include: quotationInclude,
    })
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
      "[backup-json-drive-sync] Syncing:",
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
        const jsonStr = JSON.stringify(data)
        const fileName = `${q.quotationId}.json`
        const result = await uploadOrUpdateJsonFile(quotationsFolderId, fileName, jsonStr)
        if (result.ok) {
          uploaded += 1
          updateBackupSyncProgress({ uploaded })
        } else {
          skipped += 1
          setFirstSkipReason(`Quotation ${fileName} upload`, result.error)
          if (recordBackupSyncFailure(result.error)) {
            setBackupSyncStopped(`Stopped after 3 failures. Last error: ${result.error}`)
            return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      } catch (e) {
        captureError(e, `Quotation ${q.quotationId}`)
        const errStr = e instanceof Error ? e.message : String(e)
        if (recordBackupSyncFailure(errStr)) {
          setBackupSyncStopped(`Stopped after 3 failures. Last error: ${errStr}`)
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
        const jsonStr = JSON.stringify(data)
        const fileName = `${inv.invoiceId}.json`
        const result = await uploadOrUpdateJsonFile(invoicesFolderId, fileName, jsonStr)
        if (result.ok) {
          uploaded += 1
          updateBackupSyncProgress({ uploaded })
        } else {
          skipped += 1
          setFirstSkipReason(`Invoice ${fileName} upload`, result.error)
          if (recordBackupSyncFailure(result.error)) {
            setBackupSyncStopped(`Stopped after 3 failures. Last error: ${result.error}`)
            return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      } catch (e) {
        captureError(e, `Invoice ${inv.invoiceId}`)
        const errStr = e instanceof Error ? e.message : String(e)
        if (recordBackupSyncFailure(errStr)) {
          setBackupSyncStopped(`Stopped after 3 failures. Last error: ${errStr}`)
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
      try {
        const data = toParagonPdfData(t)
        const jsonStr = JSON.stringify(data)
        const fileName = `${t.ticketId}.json`
        const result = await uploadOrUpdateJsonFile(projectFolderId, fileName, jsonStr)
        if (result.ok) {
          uploaded += 1
          updateBackupSyncProgress({ uploaded })
        } else {
          skipped += 1
          setFirstSkipReason(`Paragon ${fileName} upload`, result.error)
          if (recordBackupSyncFailure(result.error)) {
            setBackupSyncStopped(`Stopped after 3 failures. Last error: ${result.error}`)
            return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      } catch (e) {
        captureError(e, `Paragon ${t.ticketId}`)
        const errStr = e instanceof Error ? e.message : String(e)
        if (recordBackupSyncFailure(errStr)) {
          setBackupSyncStopped(`Stopped after 3 failures. Last error: ${errStr}`)
          return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
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
      try {
        const data = toErhaPdfData(t)
        const jsonStr = JSON.stringify(data)
        const fileName = `${t.ticketId}.json`
        const result = await uploadOrUpdateJsonFile(projectFolderId, fileName, jsonStr)
        if (result.ok) {
          uploaded += 1
          updateBackupSyncProgress({ uploaded })
        } else {
          skipped += 1
          setFirstSkipReason(`Erha ${fileName} upload`, result.error)
          if (recordBackupSyncFailure(result.error)) {
            setBackupSyncStopped(`Stopped after 3 failures. Last error: ${result.error}`)
            return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      } catch (e) {
        captureError(e, `Erha ${t.ticketId}`)
        const errStr = e instanceof Error ? e.message : String(e)
        if (recordBackupSyncFailure(errStr)) {
          setBackupSyncStopped(`Stopped after 3 failures. Last error: ${errStr}`)
          return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
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
      try {
        const data = toBarclayPdfData(t)
        const jsonStr = JSON.stringify(data)
        const fileName = `${t.ticketId}.json`
        const result = await uploadOrUpdateJsonFile(projectFolderId, fileName, jsonStr)
        if (result.ok) {
          uploaded += 1
          updateBackupSyncProgress({ uploaded })
        } else {
          skipped += 1
          setFirstSkipReason(`Barclay ${fileName} upload`, result.error)
          if (recordBackupSyncFailure(result.error)) {
            setBackupSyncStopped(`Stopped after 3 failures. Last error: ${result.error}`)
            return { ok: false, error: "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
          }
        }
      } catch (e) {
        captureError(e, `Barclay ${t.ticketId}`)
        const errStr = e instanceof Error ? e.message : String(e)
        if (recordBackupSyncFailure(errStr)) {
          setBackupSyncStopped(`Stopped after 3 failures. Last error: ${errStr}`)
          return { ok: false, error: firstError ?? "Stopped after 3 failures", uploaded, skipped, skipReason: firstSkipReason ?? undefined }
        }
      }
      await delay(200)
    }

    if (skipped > 0) {
      console.log("[backup-json-drive-sync] Done. uploaded:", uploaded, "skipped:", skipped)
    }
    if (firstError) return { ok: false, error: firstError, uploaded, skipped, skipReason: firstSkipReason ?? undefined }
    setBackupSyncCompleted(uploaded, skipped)
    return { ok: true, uploaded, skipped, skipReason: firstSkipReason ?? undefined }
  } catch (e) {
    console.error("[backup-json-drive-sync] Failed:", e)
    const errStr = e instanceof Error ? e.message : String(e)
    setBackupSyncStopped(errStr)
    return { ok: false, error: errStr }
  }
}
