"use client"

import { useState, useRef, useEffect } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Footer } from "@/components/layout/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Download, Upload, AlertTriangle, Loader2 } from "lucide-react"
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

  const formatBackupDate = (createdAt: string) => {
    try {
      return new Date(createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    } catch {
      return createdAt
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Backup" showBackButton backTo="/" />

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="grid w-full max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
            {/* Save backup (primary) */}
            <Card className="flex flex-col">
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
            <Card className="flex flex-col border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Upload className="h-5 w-5" />
                  Restore backup
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
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
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
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
