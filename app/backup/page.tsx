"use client"

import { useState, useRef, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Download, Upload, AlertTriangle, Loader2, FolderSync, ExternalLink } from "lucide-react"
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
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)

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

  const handleSyncPdfToDrive = async () => {
    setSyncingPdf(true)
    setLastSyncError(null)
    try {
      const res = await fetch("/api/backup/sync-pdf-drive", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errMsg = data.error || "Sync failed"
        setLastSyncError(errMsg)
        throw new Error(errMsg)
      }
      toast.success("PDFs synced to Google Drive")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed"
      setLastSyncError(msg)
      toast.error("Sync failed — see error below to copy")
    } finally {
      setSyncingPdf(false)
    }
  }

  const copySyncError = () => {
    if (lastSyncError) {
      navigator.clipboard.writeText(lastSyncError)
      toast.success("Error copied to clipboard")
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

      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
            {/* PDF to Google Drive */}
            <Card className="flex flex-col bg-card text-card-foreground">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderSync className="h-5 w-5" />
                  PDF to Google Drive
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Upload generated PDFs (Quotations, Invoices, Paragon, Erha) to Google Drive. Same document = replace existing file. Run manually when you want to backup PDFs.
                </p>
                {driveStatus?.configured && driveStatus.rootFolderUrl && (
                  <a
                    href={driveStatus.rootFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
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
                  {syncingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderSync className="h-4 w-4 mr-2" />
                  )}
                  {syncingPdf ? "Syncing…" : "Sync PDFs to Drive now"}
                </Button>
                {lastSyncError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 dark:bg-destructive/10 p-3 text-sm space-y-2">
                    <p className="font-medium text-destructive">Last sync error (copy and share for debugging):</p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs bg-muted/50 p-2 rounded select-all">
                      {lastSyncError}
                    </pre>
                    <Button type="button" variant="outline" size="sm" onClick={copySyncError}>
                      Copy full error
                    </Button>
                  </div>
                )}
                {driveStatus && !driveStatus.configured && (
                  <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-2">
                    <p className="font-medium">Setup required (in .env or environment):</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs">
                      <li>
                        <strong>Root folder</strong> — <code className="bg-black/10 dark:bg-white/10 px-1 rounded">GOOGLE_DRIVE_ROOT_FOLDER_ID</code>
                        <br />
                        Create a folder in Google Drive, open it in the browser. The URL is <code className="bg-black/10 dark:bg-white/10 px-1 rounded">https://drive.google.com/drive/folders/FOLDER_ID</code>. Copy <code className="bg-black/10 dark:bg-white/10 px-1 rounded">FOLDER_ID</code> into this variable.
                      </li>
                      <li>
                        <strong>Google credential</strong> — use one of:
                        <br />
                        • <code className="bg-black/10 dark:bg-white/10 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_JSON</code> = full JSON key as a string (e.g. from Google Cloud Console → Service account → Keys → Add key → JSON). Good for Railway/hosted env.
                        <br />
                        • <code className="bg-black/10 dark:bg-white/10 px-1 rounded">GOOGLE_APPLICATION_CREDENTIALS</code> = path to the JSON file on the server.
                      </li>
                    </ol>
                    <p className="text-xs pt-1">After saving env and restarting, this section will show the sync button and link to open the Drive folder.</p>
                    <p className="text-xs pt-1">
                      <strong>Full step-by-step guide:</strong> open <code className="bg-black/10 dark:bg-white/10 px-1 rounded">docs/GOOGLE_DRIVE_SETUP.md</code> in this repo.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save backup (primary) */}
            <Card className="flex flex-col bg-card text-card-foreground">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Save className="h-5 w-5" />
                  Save backup
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Save the current database to the backup DB. The latest 5 backups are kept. No file download needed.
                </p>
                <Button onClick={handleSaveBackup} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save backup now"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDownload} disabled={downloading} className="w-full">
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download as file (optional)
                </Button>
              </CardContent>
            </Card>

            {/* Restore */}
            <Card className="flex flex-col border-destructive/50 dark:border-destructive/60 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Upload className="h-5 w-5" />
                  Restore backup
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 dark:border-destructive/50 bg-destructive/5 dark:bg-destructive/15 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Restore replaces all current data. Save a backup first if you need to keep it. Data loss is permanent.
                  </span>
                </div>

                {/* Restore from saved backup */}
                <div className="space-y-2">
                  <Label>From saved backup</Label>
                  <Select value={selectedBackupId} onValueChange={setSelectedBackupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a backup…" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedBackups.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {formatBackupDate(b.createdAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder={requiredPhrase}
                    value={restoreConfirm}
                    onChange={(e) => setRestoreConfirm(e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRestore}
                    disabled={!canRestore || restoring}
                    className="w-full"
                  >
                    {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore this backup"}
                  </Button>
                </div>

                {/* Restore from file */}
                <div className="space-y-2 border-t pt-4">
                  <Label>From file (JSON)</Label>
                  <Input
                    type="file"
                    accept=".json,application/json"
                    ref={fileInputRef}
                    onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  />
                  <Input
                    type="text"
                    placeholder={requiredPhrase}
                    value={importConfirm}
                    onChange={(e) => setImportConfirm(e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImport}
                    disabled={!canImport || importing}
                    className="w-full border-destructive/50 dark:border-destructive/60 text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore from file"}
                  </Button>
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
