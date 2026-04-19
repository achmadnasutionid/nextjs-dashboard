/**
 * Shared helpers for "copy document" with optional down-payment mode:
 * one line item named `Down Payment (X%)` with amount = round(originalTotal * X / 100).
 */

export type ParsedCopyOptions =
  | { mode: "general" }
  | { mode: "downPayment"; percentage: number }

export type ParseCopyResult =
  | { ok: true; value: ParsedCopyOptions }
  | { ok: false; error: string }

function formatPercentageLabel(pct: number): string {
  if (Number.isInteger(pct)) return String(pct)
  const rounded = Math.round(pct * 100) / 100
  return String(rounded)
}

export function downPaymentAmountFromTotal(
  originalTotal: number,
  percentage: number
): number {
  return Math.round((originalTotal * percentage) / 100)
}

/** Prisma nested `create` shape for QuotationItem / InvoiceItem / Paragon / Erha items. */
export function downPaymentItemCreate(
  originalTotalAmount: number,
  percentage: number
) {
  const amount = downPaymentAmountFromTotal(originalTotalAmount, percentage)
  const label = `Down Payment (${formatPercentageLabel(percentage)}%)`
  return {
    productName: label,
    total: amount,
    details: {
      create: [
        {
          detail: label,
          unitPrice: amount,
          qty: 1,
          amount: amount,
        },
      ],
    },
  }
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
