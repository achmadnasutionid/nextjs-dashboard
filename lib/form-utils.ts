import { RefObject } from "react"

interface DetailLike {
  id: string
  unitPrice: string
  qty: string
}

interface ItemLike {
  details: DetailLike[]
}

/**
 * Finds item details where a unit price is set but qty is missing/zero.
 * This silently zeroes out the line amount (amount = unitPrice * qty),
 * which has caused real invoices/quotations to under-bill clients.
 * Returns a map of detailId -> error message.
 */
export function findQtyPriceErrors(items: ItemLike[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const item of items) {
    for (const detail of item.details) {
      const price = parseFloat(detail.unitPrice)
      const qty = parseFloat(detail.qty)
      const hasPrice = !isNaN(price) && price > 0
      const hasQty = !isNaN(qty) && qty > 0
      if (hasPrice && !hasQty) {
        errors[detail.id] = "Qty is required when unit price is set"
      }
    }
  }
  return errors
}

/**
 * Scrolls to the first error field in a form
 * @param errorObj - Object containing error messages (e.g., { company: "Required", billTo: "Required" })
 * @param errorRefMap - Map of error keys to React refs (e.g., { company: companyRef, billTo: billToRef })
 */
export function scrollToFirstError(
  errorObj: Record<string, string>,
  errorRefMap: Record<string, RefObject<HTMLDivElement | null>>
) {
  // Find the first error field and scroll to it
  for (const [key, ref] of Object.entries(errorRefMap)) {
    if (errorObj[key] && ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
      
      // Focus the element if possible
      const input = ref.current.querySelector('input, button, select, textarea')
      if (input instanceof HTMLElement) {
        setTimeout(() => input.focus(), 300)
      }
      
      break
    }
  }
}
