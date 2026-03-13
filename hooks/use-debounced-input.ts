import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook for debounced state that updates immediately in UI but delays parent state update
 * Perfect for form inputs that need to feel responsive but shouldn't trigger heavy calculations on every keystroke
 * 
 * @param initialValue - Initial value for the state
 * @param delay - Delay in milliseconds before updating parent (default: 300ms)
 * @returns [localValue, debouncedValue, setLocalValue]
 * 
 * @example
 * const [localPrice, debouncedPrice, setLocalPrice] = useDebouncedInput(item.unitPrice, 300)
 * 
 * // Use localPrice for the input (feels instant)
 * <Input value={localPrice} onChange={(e) => setLocalPrice(e.target.value)} />
 * 
 * // Use debouncedPrice to update parent state (delayed)
 * useEffect(() => {
 *   updateParentState(debouncedPrice)
 * }, [debouncedPrice])
 */
export function useDebouncedInput<T>(
  initialValue: T,
  delay: number = 300
): [T, T, (value: T) => void] {
  const [localValue, setLocalValue] = useState<T>(initialValue)
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Sync both local + debounced when prop changes.
  // This prevents a stale debounced value from "writing back" the old value
  // after parent state is updated programmatically (e.g. percentage adjustment).
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
    setLocalValue(initialValue)
    setDebouncedValue(initialValue)
  }, [initialValue])

  // Debounce the local value to update debounced value
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(localValue)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [localValue, delay])

  return [localValue, debouncedValue, setLocalValue]
}

/**
 * Alternative: Simple debounced callback for actions
 * Use this when you just want to debounce a function call
 * 
 * @example
 * const debouncedSave = useDebouncedAction((data) => {
 *   saveToServer(data)
 * }, 500)
 * 
 * // Call multiple times, only last call within 500ms will execute
 * debouncedSave(formData)
 */
export function useDebouncedAction<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const callbackRef = useRef<T>(callback)

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}
