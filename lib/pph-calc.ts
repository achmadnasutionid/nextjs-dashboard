/**
 * Shared PPh calculation — used by create/edit pages, PDF templates, and copy routes
 * so the gross-up vs deduction formula stays consistent everywhere.
 */

export function calculatePphAmount(netAmount: number, pph: string, pphDeduction: boolean): number {
  const rate = parseFloat(pph)
  if (!rate || rate <= 0) return 0
  if (pphDeduction) return netAmount * (rate / 100)
  if (rate >= 100) return 0
  return netAmount * (100 / (100 - rate)) - netAmount
}

export function calculateGrandTotal(netAmount: number, pphAmount: number, pphDeduction: boolean): number {
  return pphDeduction ? netAmount - pphAmount : netAmount + pphAmount
}

function grossUpFactor(pph: string): number {
  const rate = parseFloat(pph)
  if (!rate || rate <= 0 || rate >= 100) return 1
  return 100 / (100 - rate)
}

/**
 * In deduction mode, each item detail's amount is grossed up so the summary's
 * Subtotal already carries the tax, and subtracting PPh recovers the entered net figure.
 * Unit price stays as typed; only the computed amount is scaled.
 */
export function applyPphToAmount(rawAmount: number, pph: string, pphDeduction: boolean): number {
  return pphDeduction ? rawAmount * grossUpFactor(pph) : rawAmount
}
