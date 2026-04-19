/**
 * Shared helpers for "copy document" with optional down-payment mode:
 * every line item and detail amount is scaled by (percentage / 100).
 */

export type ParsedCopyOptions =
  | { mode: "general" }
  | { mode: "downPayment"; percentage: number }

export type ParseCopyResult =
  | { ok: true; value: ParsedCopyOptions }
  | { ok: false; error: string }

type LineItemInput = {
  productName: string
  total: number
  details: Array<{
    detail: string
    unitPrice: number
    qty: number
    amount: number
  }>
}

/** Nested shape for Prisma `items: { create: [...] }` on quotation / invoice / tickets. */
export type ScaledItemCreate = {
  productName: string
  total: number
  details: {
    create: Array<{
      detail: string
      unitPrice: number
      qty: number
      amount: number
    }>
  }
}

export function downPaymentAmountFromTotal(
  originalTotal: number,
  percentage: number
): number {
  return Math.round((originalTotal * percentage) / 100)
}

/**
 * Scale all line items and detail rows by the down-payment percentage.
 * Per-line totals are the sum of scaled detail amounts (IDR rounding per row).
 */
export function scaleItemsForDownPayment(
  items: LineItemInput[],
  percentage: number
): ScaledItemCreate[] {
  const factor = percentage / 100
  return items.map((item) => {
    const scaledDetails = item.details.map((d) => ({
      detail: d.detail,
      unitPrice: Math.round(d.unitPrice * factor),
      qty: d.qty,
      amount: Math.round(d.amount * factor),
    }))
    const lineTotal = scaledDetails.reduce((s, d) => s + d.amount, 0)
    return {
      productName: item.productName,
      total: lineTotal,
      details: { create: scaledDetails },
    }
  })
}

export function sumScaledItemsTotal(items: ScaledItemCreate[]): number {
  return items.reduce((s, i) => s + i.total, 0)
}

export function parseCopyOptionsFromJson(body: unknown): ParseCopyResult {
  if (body == null || typeof body !== "object") {
    return { ok: true, value: { mode: "general" } }
  }
  const o = body as Record<string, unknown>
  const mode = o.mode
  if (mode !== "downPayment") {
    return { ok: true, value: { mode: "general" } }
  }
  const raw = o.downPaymentPercentage ?? o.percentage
  const pct =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw.replace(",", "."))
        : NaN
  if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
    return {
      ok: false,
      error: "Down payment requires a percentage between 0 and 100 (exclusive of 0).",
    }
  }
  return { ok: true, value: { mode: "downPayment", percentage: pct } }
}

export async function readCopyOptions(request: Request): Promise<ParseCopyResult> {
  try {
    const body = await request.json()
    return parseCopyOptionsFromJson(body)
  } catch {
    return parseCopyOptionsFromJson(null)
  }
}
