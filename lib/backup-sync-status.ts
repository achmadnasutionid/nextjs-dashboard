/**
 * In-memory status for PDF/backup sync to Drive.
 * Used so the backup page can show progress and we can stop after 3 failures.
 */

export const MAX_FAILURES = 3

export type BackupSyncStatus = {
  status: "idle" | "running" | "completed" | "stopped"
  phase: string
  current: number
  total: number
  uploaded: number
  failed: number
  failureCount: number
  lastError: string | null
  message: string | null
  updatedAt: string
}

const initialState: BackupSyncStatus = {
  status: "idle",
  phase: "",
  current: 0,
  total: 0,
  uploaded: 0,
  failed: 0,
  failureCount: 0,
  lastError: null,
  message: null,
  updatedAt: new Date().toISOString(),
}

let state: BackupSyncStatus = { ...initialState }

function tick() {
  state.updatedAt = new Date().toISOString()
}

export function getBackupSyncStatus(): BackupSyncStatus {
  return { ...state }
}

export function setBackupSyncRunning(phase: string, total: number): void {
  state = {
    ...initialState,
    status: "running",
    phase,
    total,
    current: 0,
    uploaded: 0,
    failed: 0,
    failureCount: 0,
    lastError: null,
    message: null,
    updatedAt: new Date().toISOString(),
  }
}

export function updateBackupSyncProgress(partial: Partial<Pick<BackupSyncStatus, "phase" | "current" | "total" | "uploaded" | "failed">>): void {
  if (state.status !== "running") return
  Object.assign(state, partial)
  tick()
}

/** Call on any failure (render or upload). Returns true if we should stop (>= MAX_FAILURES). */
export function recordBackupSyncFailure(lastError: string): boolean {
  if (state.status !== "running") return true
  state.failed += 1
  state.failureCount += 1
  state.lastError = lastError
  tick()
  return state.failureCount >= MAX_FAILURES
}

export function setBackupSyncCompleted(uploaded: number, skipped: number): void {
  if (state.status !== "running") return
  state.status = "completed"
  state.message = `Done. Uploaded: ${uploaded}, skipped: ${skipped}.`
  tick()
}

export function setBackupSyncStopped(reason: string): void {
  state.status = "stopped"
  state.message = reason
  tick()
}

export function getBackupSyncFailureCount(): number {
  return state.failureCount
}

/** Delay helper for spacing out work (e.g. between PDF renders). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
