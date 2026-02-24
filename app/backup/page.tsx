"use client"

import { useState, useRef, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Download, Upload, AlertTriangle, Loader2, FolderSync, ExternalLink, FileJson, FileDown, PlusCircle } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const DEFAULT_PHRASE = "RESTORE"

type SavedBackup = { id: string; createdAt: string; summary: Record<string, number> }

export default function BackupPage() {
  const [requiredPhrase, setRequiredPhrase] = useState(DEFAULT_PHRASE)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [importConfirm, setImportConfirm] = useState("")
  const [importFile, setImportFile] = useState<File | null>(null)
  const [savedBackups, setSavedBackups] = useState<SavedBackup[]>([])
  const [selectedBackupId, setSelectedBackupId] = useState<string>("")
  const [restoreConfirm, setRestoreConfirm] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [driveStatus, setDriveStatus] = useState<{ configured: boolean; rootFolderUrl?: string } | null>(null)
  const [syncingPdf, setSyncingPdf] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{
    status: string
    phase: string
    current: number
    total: number
    uploaded: number
    failed: number
    message: string | null
    lastError: string | null
  } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [lastSkipReason, setLastSkipReason] = useState<string | null>(null)
  // Restore from backup file (single document JSON from Drive)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restorePreview, setRestorePreview] = useState<{
    type: "quotation" | "invoice"
    id: string
    billTo: string
    totalAmount: number
    data: unknown
  } | null>(null)
  const [restoreFileError, setRestoreFileError] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState(false)
  const restoreFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/backup/import-phrase")
      .then((r) => r.json())
      .then((body) => body.phrase && setRequiredPhrase(String(body.phrase)))
      .catch(() => {})
  }, [])

  const loadSavedBackups = () => {
    fetch("/api/backup")
      .then((r) => {
        if (r.status === 503) return []
        if (!r.ok) return []
        return r.json()
      })
      .then((list) => setSavedBackups(Array.isArray(list) ? list : []))
      .catch(() => setSavedBackups([]))
  }

  useEffect(() => {
    loadSavedBackups()
  }, [])

  useEffect(() => {
    fetch("/api/backup/drive-status")
      .then((r) => r.json())
      .then((data) => setDriveStatus({ configured: !!data.configured, rootFolderUrl: data.rootFolderUrl }))
      .catch(() => setDriveStatus({ configured: false }))
  }, [])

  const canImport = importFile && importConfirm.trim() === requiredPhrase
  const canRestore = selectedBackupId && restoreConfirm.trim() === requiredPhrase

  const handleSaveBackup = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/backup", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        toast.error("Backup DB not configured. Set BACKUP_DATABASE_URL.")
        return
      }
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast.success("Backup saved. Latest 5 are kept in the backup DB.")
      loadSavedBackups()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch("/api/backup/export")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Export failed")
      }
      const blob = await res.blob()
      const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || "backup.json"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Backup downloaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setDownloading(false)
    }
  }

  const handleImport = async () => {
    if (!importFile || !canImport) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append("file", importFile)
      formData.append("confirmation", importConfirm.trim())
      const res = await fetch("/api/backup/import", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Import failed")
      toast.success("Import completed")
      setImportConfirm("")
      setImportFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedBackupId || !canRestore) return
    setRestoring(true)
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: selectedBackupId, confirmation: restoreConfirm.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Restore failed")
      toast.success("Restore completed")
      setRestoreConfirm("")
      setSelectedBackupId("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed")
    } finally {
      setRestoring(false)
    }
  }

  const fetchSyncStatus = () => {
    fetch("/api/backup/sync-status")
      .then((r) => r.json())
      .then((data) => {
        setSyncProgress({
          status: data.status ?? "idle",
          phase: data.phase ?? "",
          current: data.current ?? 0,
          total: data.total ?? 0,
          uploaded: data.uploaded ?? 0,
          failed: data.failed ?? 0,
          message: data.message ?? null,
          lastError: data.lastError ?? null,
        })
        if (data.status === "completed" || data.status === "stopped") {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setSyncingPdf(false)
          if (data.status === "stopped" && data.lastError) setLastSyncError(data.lastError)
          if (data.message) {
            if (data.status === "stopped") toast.warning(data.message)
            else toast.success(data.message)
          }
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!syncingPdf) return
    fetchSyncStatus()
    const id = setInterval(fetchSyncStatus, 2500)
    pollRef.current = id
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [syncingPdf])

  useEffect(() => {
    fetch("/api/backup/sync-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "running") {
          setSyncingPdf(true)
          setSyncProgress({
            status: data.status,
            phase: data.phase ?? "",
            current: data.current ?? 0,
            total: data.total ?? 0,
            uploaded: data.uploaded ?? 0,
            failed: data.failed ?? 0,
            message: data.message ?? null,
            lastError: data.lastError ?? null,
          })
        }
      })
      .catch(() => {})
  }, [])

  const handleSyncPdfToDrive = async () => {
    setLastSyncError(null)
    setLastSkipReason(null)
    setSyncProgress(null)
    try {
      const res = await fetch("/api/backup/sync-pdf-drive", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.info(data.error ?? "Backup already in progress")
        setSyncingPdf(true)
        return
      }
      if (!res.ok) {
        const errMsg = data.error || "Sync failed"
        setLastSyncError(errMsg)
        if (data.skipReason) setLastSkipReason(data.skipReason)
        toast.error(errMsg)
        return
      }
      if (res.status === 202) {
        toast.success(data.message ?? "Backup started. Check progress below.")
        setSyncingPdf(true)
        return
      }
      const count = typeof data.uploaded === "number" ? data.uploaded : 0
      const skipCount = typeof data.skipped === "number" ? data.skipped : 0
      const skipReason = typeof data.skipReason === "string" ? data.skipReason : null
      if (skipReason) setLastSkipReason(skipReason)
      if (count === 0) {
        toast.warning(
          skipCount > 0
            ? `0 PDFs uploaded, ${skipCount} skipped. See "Why skipped" below.`
            : "Sync completed but 0 PDFs uploaded."
        )
      } else {
        toast.success(`${count} PDF${count === 1 ? "" : "s"} synced to Google Drive`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed"
      setLastSyncError(msg)
      toast.error("Sync failed — see error below to copy")
    }
  }

  const copySyncError = () => {
    if (lastSyncError) {
      navigator.clipboard.writeText(lastSyncError)
      toast.success("Error copied to clipboard")
    }
  }

  const copySkipReason = () => {
    if (lastSkipReason) {
      navigator.clipboard.writeText(lastSkipReason)
      toast.success("Skip reason copied to clipboard")
    }
  }

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setRestoreFile(file)
    setRestorePreview(null)
    setRestoreFileError(null)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const data = JSON.parse(text) as Record<string, unknown>
        if (data.quotationId && typeof data.quotationId === "string") {
          setRestorePreview({
            type: "quotation",
            id: data.quotationId,
            billTo: typeof data.billTo === "string" ? data.billTo : "",
            totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : 0,
            data,
          })
          return
        }
        if (data.invoiceId && typeof data.invoiceId === "string") {
          setRestorePreview({
            type: "invoice",
            id: data.invoiceId,
            billTo: typeof data.billTo === "string" ? data.billTo : "",
            totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : 0,
            data,
          })
          return
        }
        setRestoreFileError("Unknown backup format. Expected quotation or invoice JSON (quotationId or invoiceId).")
      } catch {
        setRestoreFileError("Invalid JSON file.")
      }
    }
    reader.readAsText(file, "utf-8")
  }

  const handleDownloadRestorePdf = async () => {
    if (!restorePreview) return
    setDownloadingPdf(true)
    try {
      const res = await fetch("/api/backup/render-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: restorePreview.type, data: restorePreview.data }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "PDF generation failed")
      }
      const blob = await res.blob()
      const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? `${restorePreview.id}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleCreateFromRestore = async () => {
    if (!restorePreview) return
    setCreatingDoc(true)
    try {
      const url = restorePreview.type === "quotation" ? "/api/backup/restore-quotation" : "/api/backup/restore-invoice"
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restorePreview.data),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.error(body.error ?? "This document already exists. Cannot overwrite.")
        return
      }
      if (!res.ok) throw new Error(body.error || "Create failed")
      const label = restorePreview.type === "quotation" ? "Quotation" : "Invoice"
      toast.success(`${label} created.`)
      setRestorePreview(null)
      setRestoreFile(null)
      setRestoreFileError(null)
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = ""
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed")
    } finally {
      setCreatingDoc(false)
    }
  }

  const formatBackupDate = (createdAt: string) => {
    try {
      return new Date(createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    } catch {
      return createdAt
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PageHeader title="Backup" showBackButton backTo="/" />

      <main className="flex-1 bg-muted/20">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="grid gap-8 sm:grid-cols-2">
            {/* Drive sync */}
            <Card className="overflow-hidden border shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="border-b bg-card/50 pb-4">
                <CardTitle className="flex items-center gap-3 text-base font-semibold">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderSync className="h-5 w-5" />
                  </span>
                  Sync to Drive
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Upload backup JSON files (Quotations, Invoices, Paragon, Erha) to Google Drive. One file per document; same ID replaces existing.
                </p>
                {driveStatus?.configured && driveStatus.rootFolderUrl && (
                  <a
                    href={driveStatus.rootFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Drive folder
                  </a>
                )}
                <Button
                  onClick={handleSyncPdfToDrive}
                  disabled={!driveStatus?.configured || syncingPdf}
                  variant="outline"
                  className="w-full"
                >
                  {syncingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSync className="h-4 w-4 mr-2" />}
                  {syncingPdf ? "Syncing…" : "Sync backup to Drive"}
                </Button>
                {syncingPdf && syncProgress?.status === "running" && (
                  <p className="text-sm text-muted-foreground">
                    {syncProgress.phase} {syncProgress.total > 0 ? `${syncProgress.current} / ${syncProgress.total}` : ""} · {syncProgress.uploaded} uploaded
                  </p>
                )}
                {(syncProgress?.status === "completed" || syncProgress?.status === "stopped") && syncProgress?.message && (
                  <p className={`text-sm font-medium ${syncProgress.status === "stopped" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                    {syncProgress.message}
                  </p>
                )}
                {lastSyncError && (
                  <details className="rounded-lg border bg-muted/50">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-destructive">View sync error</summary>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words p-3 text-xs">{lastSyncError}</pre>
                    <div className="border-t px-3 py-2">
                      <Button type="button" variant="outline" size="sm" onClick={copySyncError}>Copy error</Button>
                    </div>
                  </details>
                )}
                {lastSkipReason && !lastSyncError && (
                  <details className="rounded-lg border bg-muted/50">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">Why some items were skipped</summary>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words p-3 text-xs">{lastSkipReason}</pre>
                    <div className="border-t px-3 py-2">
                      <Button type="button" variant="outline" size="sm" onClick={copySkipReason}>Copy</Button>
                    </div>
                  </details>
                )}
                {driveStatus && !driveStatus.configured && (
                  <details className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-200">Setup required</summary>
                    <div className="space-y-2 p-3 text-sm text-amber-900 dark:text-amber-200">
                      <p>Use a <strong>Shared Drive</strong> folder and add your service account as Content manager. Set <code className="rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">GOOGLE_DRIVE_ROOT_FOLDER_ID</code> to that folder ID.</p>
                      <p>Set <code className="rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">GOOGLE_SERVICE_ACCOUNT_JSON</code> or <code className="rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">GOOGLE_APPLICATION_CREDENTIALS</code>.</p>
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>

            {/* Save backup */}
            <Card className="overflow-hidden border shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="border-b bg-card/50 pb-4">
                <CardTitle className="flex items-center gap-3 text-base font-semibold">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Save className="h-5 w-5" />
                  </span>
                  Save backup
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Save the current database to the backup DB. The latest 5 backups are kept. You can also download a full export as a file.
                </p>
                <div className="flex flex-col gap-3">
                  <Button onClick={handleSaveBackup} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save backup now"}
                  </Button>
                  <Button variant="ghost" onClick={handleDownload} disabled={downloading} className="w-full">
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Download as file
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Restore full DB */}
            <Card className="overflow-hidden border-l-4 border-l-destructive/80 border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
              <CardHeader className="border-b bg-destructive/5 pb-4">
                <CardTitle className="flex items-center gap-3 text-base font-semibold text-destructive">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                    <Upload className="h-5 w-5" />
                  </span>
                  Restore full database
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">
                    Restore replaces all current data. Save a backup first if you need to keep it. This action cannot be undone.
                  </p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">From saved backup</Label>
                    <Select value={selectedBackupId} onValueChange={setSelectedBackupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a backup…" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedBackups.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{formatBackupDate(b.createdAt)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={`Type "${requiredPhrase}" to confirm`}
                        value={restoreConfirm}
                        onChange={(e) => setRestoreConfirm(e.target.value)}
                        className="font-mono"
                      />
                      <Button variant="destructive" onClick={handleRestore} disabled={!canRestore || restoring} className="shrink-0">
                        {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">From file (full DB JSON)</Label>
                    <Input type="file" accept=".json,application/json" ref={fileInputRef} onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={`Type "${requiredPhrase}" to confirm`}
                        value={importConfirm}
                        onChange={(e) => setImportConfirm(e.target.value)}
                        className="font-mono"
                      />
                      <Button variant="outline" onClick={handleImport} disabled={!canImport || importing} className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10">
                        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Restore single document */}
            <Card className="overflow-hidden border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
              <CardHeader className="border-b bg-card/50 pb-4">
                <CardTitle className="flex items-center gap-3 text-base font-semibold">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileJson className="h-5 w-5" />
                  </span>
                  Restore from backup file
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Upload a single-document backup JSON (e.g. from Drive: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">QTN-2026-1820.json</code>, <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">INV-2026-xxx.json</code>). Preview it, download as PDF, or create as a new Quotation/Invoice. Creating fails if that ID already exists.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Choose JSON file</Label>
                    <Input type="file" accept=".json,application/json" ref={restoreFileInputRef} onChange={handleRestoreFileChange} className="mt-2" />
                  </div>
                  {restoreFileError && <p className="text-sm text-destructive">{restoreFileError}</p>}
                  {restorePreview && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="font-medium">{restorePreview.type === "quotation" ? "Quotation" : "Invoice"} · {restorePreview.id}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{restorePreview.billTo || "—"}</p>
                      <p className="text-sm font-medium">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(restorePreview.totalAmount)}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleDownloadRestorePdf} disabled={downloadingPdf}>
                          {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                          Download PDF
                        </Button>
                        <Button type="button" onClick={handleCreateFromRestore} disabled={creatingDoc}>
                          {creatingDoc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                          Create as new {restorePreview.type === "quotation" ? "Quotation" : "Invoice"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
