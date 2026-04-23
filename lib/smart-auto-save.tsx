"use client"

/**
 * ROBUST AUTO-SAVE STRATEGY
 * 
 * Handles real-world issues:
 * - Railway network latency
 * - Mandatory field validation
 * - Network failures
 * - User interruptions
 */

import { useState, useRef } from 'react'
import { useDebouncedCallback } from '@/hooks/use-debounce'
import { AutoSaveStatus } from '@/components/ui/auto-save-indicator'
import { toast } from 'sonner'

/**
 * SMART AUTO-SAVE RULES
 */
const AUTO_SAVE_RULES = {
  // Only auto-save if these mandatory fields are filled
  requiredFields: {
    quotation: ['selectedCompanyId', 'productionDate', 'billTo', 'selectedBillingId', 'selectedSignatureId'],
    invoice: ['selectedCompanyId', 'productionDate', 'billTo', 'selectedBillingId', 'selectedSignatureId'],
    expense: ['projectName', 'productionDate'],
    erha: ['selectedCompanyId', 'productionDate', 'quotationDate', 'invoiceBastDate', 'billTo', 'projectName', 'billToAddress', 'contactPerson', 'contactPosition', 'selectedBillingId', 'selectedSignatureId'],
    paragon: ['selectedCompanyId', 'productionDate', 'quotationDate', 'invoiceBastDate', 'billTo', 'projectName', 'contactPerson', 'contactPosition', 'selectedSignatureId'],
    barclay: ['selectedCompanyId', 'productionDate', 'quotationDate', 'invoiceBastDate', 'billTo', 'projectName', 'contactPerson', 'contactPosition', 'selectedSignatureId']
  },
  
  // Don't auto-save if user is actively typing (wait for pause)
  debounceDelay: 15000, // 15 seconds (better for careful editing)
  
  // Retry strategy
  maxRetries: 2, // Don't retry too many times
  retryDelay: 10000, // 10 seconds between retries
  
  // Network timeout
  timeout: 15000, // 15 seconds (Railway can be slow)
  
  // Don't spam saves
  minTimeBetweenSaves: 15000 // At least 15 seconds between saves
}

function isValidProductionDate(value: unknown): boolean {
  if (value == null || value === "") return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (typeof value === "string") return !Number.isNaN(Date.parse(value))
  return false
}

/**
 * VALIDATION: Check if data is "good enough" to auto-save
 */
function canAutoSave(data: any, type: 'quotation' | 'invoice' | 'expense' | 'erha' | 'paragon' | 'barclay'): { canSave: boolean; reason?: string } {
  const required = AUTO_SAVE_RULES.requiredFields[type]
  
  // Check mandatory fields
  for (const field of required) {
    if (!data[field]) {
      return { 
        canSave: false, 
        reason: `Missing required field: ${field}` 
      }
    }
  }
  
  // productionDate may be a Date (some screens) or ISO string from getData()
  if (!isValidProductionDate(data.productionDate)) {
    return { canSave: false, reason: 'Invalid date' }
  }
  
  // All good!
  return { canSave: true }
}

/**
 * SMART AUTO-SAVE HOOK
 * 
 * Usage:
 * const { autoSaveStatus, triggerAutoSave } = useSmartAutoSave({
 *   quotationId,
 *   getData: () => ({ selectedCompanyId, productionDate, ... }),
 *   type: 'quotation'
 * })
 */
export function useSmartAutoSave({
  recordId,
  getData,
  type = 'quotation',
  onSuccess,
  onError
}: {
  recordId: string
  getData: () => any
  type: 'quotation' | 'invoice' | 'expense' | 'erha' | 'paragon' | 'barclay'
  /** Receives the PUT response body so callers can sync optimistic-lock version (e.g. updatedAt). */
  onSuccess?: (result: unknown) => void
  onError?: (error: any) => void
}) {
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')
  const [isSavingManually, setIsSavingManually] = useState(false)
  const lastSaveTime = useRef<number>(0)
  const retryCount = useRef<number>(0)
  const saveController = useRef<AbortController | null>(null)
  
  /**
   * CORE AUTO-SAVE FUNCTION
   */
  const performAutoSave = async () => {
    // Rule 1: Don't auto-save during manual save
    if (isSavingManually) {
      console.log('[AUTO-SAVE] Skipped: Manual save in progress')
      return
    }
    
    // Rule 2: Rate limiting (don't save too frequently)
    const now = Date.now()
    const timeSinceLastSave = now - lastSaveTime.current
    if (timeSinceLastSave < AUTO_SAVE_RULES.minTimeBetweenSaves) {
      console.log('[AUTO-SAVE] Skipped: Too soon since last save')
      return
    }
    
    // Get current form data
    const data = getData()
    if (data == null) {
      console.log('[AUTO-SAVE] Skipped: getData() returned null')
      return
    }

    // Rule 3: Validate data is "good enough"
    const validation = canAutoSave(data, type)
    if (!validation.canSave) {
      console.log(`[AUTO-SAVE] Skipped: ${validation.reason}`)
      return
    }
    
    setAutoSaveStatus('saving')
    
    try {
      // Cancel any pending save
      if (saveController.current) {
        saveController.current.abort()
      }
      
      // Create new abort controller for timeout
      saveController.current = new AbortController()
      const timeoutId = setTimeout(() => {
        saveController.current?.abort()
      }, AUTO_SAVE_RULES.timeout)
      
      // Prepare payload (always save as draft for auto-save)
      // Use data.updatedAt from getData(); do not use lastKnownUpdatedAt (was never set — wiped locking).
      const payload = {
        ...data,
        status: 'draft', // ALWAYS draft for auto-save
        updatedAt: data.updatedAt ?? data.lastKnownUpdatedAt,
      }
      
      // Make API call
      const response = await fetch(`/api/${type}/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: saveController.current.signal
      })
      
      clearTimeout(timeoutId)
      
      // Handle response
      if (response.ok) {
        const result = await response.json()
        
        // Update timestamps for next save
        lastSaveTime.current = now
        retryCount.current = 0
        
        // Success!
        setAutoSaveStatus('saved')
        console.log('[AUTO-SAVE] Success ✓')
        
        // Call success callback (pass API JSON so edit pages can refresh updatedAt for the next save)
        if (onSuccess) {
          onSuccess(result)
        }
        
        // Hide indicator after 2 seconds
        setTimeout(() => {
          setAutoSaveStatus('idle')
        }, 2000)
        
        return result
      } else {
        // Handle errors
        const errorData = await response.json()
        
        // Optimistic lock conflict - data changed by another user
        if (errorData.code === 'OPTIMISTIC_LOCK_ERROR') {
          setAutoSaveStatus('error')
          console.warn('[AUTO-SAVE] Conflict detected - data changed by another user')
          
          // Show non-intrusive warning
          toast.warning('Document Updated', {
            description: 'Someone else modified this record. Your changes are still here.',
            duration: 5000
          })
          
          // Don't retry on conflicts
          setTimeout(() => setAutoSaveStatus('idle'), 3000)
          return
        }
        
        // Validation error (shouldn't happen if canAutoSave is correct)
        if (response.status === 400) {
          setAutoSaveStatus('error')
          console.error('[AUTO-SAVE] Validation error:', errorData)
          
          // Don't retry validation errors
          setTimeout(() => setAutoSaveStatus('idle'), 3000)
          return
        }
        
        // Network/Server error - retry
        throw new Error(errorData.error || 'Auto-save failed')
      }
    } catch (error: any) {
      // Handle abort (timeout or manual cancel)
      if (error.name === 'AbortError') {
        console.warn('[AUTO-SAVE] Timeout or cancelled')
        setAutoSaveStatus('error')
        
        // Retry if we haven't exceeded max retries
        if (retryCount.current < AUTO_SAVE_RULES.maxRetries) {
          retryCount.current++
          console.log(`[AUTO-SAVE] Will retry (${retryCount.current}/${AUTO_SAVE_RULES.maxRetries})`)
          
          setTimeout(() => {
            setAutoSaveStatus('idle')
            performAutoSave() // Retry
          }, AUTO_SAVE_RULES.retryDelay)
        } else {
          console.error('[AUTO-SAVE] Max retries exceeded')
          setTimeout(() => setAutoSaveStatus('idle'), 3000)
        }
        return
      }
      
      // Other network errors
      console.error('[AUTO-SAVE] Error:', error)
      setAutoSaveStatus('error')
      
      if (onError) {
        onError(error)
      }
      
      // Retry logic
      if (retryCount.current < AUTO_SAVE_RULES.maxRetries) {
        retryCount.current++
        setTimeout(() => {
          setAutoSaveStatus('idle')
          performAutoSave()
        }, AUTO_SAVE_RULES.retryDelay)
      } else {
        setTimeout(() => setAutoSaveStatus('idle'), 3000)
      }
    }
  }
  
  /**
   * DEBOUNCED AUTO-SAVE
   * Waits 5 seconds after last change before saving
   */
  const debouncedAutoSave = useDebouncedCallback(
    performAutoSave,
    AUTO_SAVE_RULES.debounceDelay,
    []
  )
  
  /**
   * PUBLIC API
   */
  return {
    autoSaveStatus,
    triggerAutoSave: debouncedAutoSave,
    setIsSavingManually, // Call this when user clicks "Save"
    cancelAutoSave: () => {
      if (saveController.current) {
        saveController.current.abort()
      }
      setAutoSaveStatus('idle')
    }
  }
}

