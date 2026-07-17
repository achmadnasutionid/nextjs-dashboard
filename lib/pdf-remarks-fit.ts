/**
 * Decides whether Billing/Signature + Remarks + Terms & Conditions fit together
 * on one page at the end of a quotation/invoice PDF. If they don't, Billing
 * (with a short note) stays with the surrounding content while Remarks + Terms
 * move to their own page and are left free to paginate normally instead of
 * being clipped.
 */

// A4 height minus the page's top/bottom padding (matches `styles.page` in the PDF templates).
export const PAGE_USABLE_HEIGHT_PT = 841.89 - 30 - 60

const FONT_SIZE_PT = 8

// Rough average glyph width as a fraction of font size for Helvetica.
const AVG_CHAR_WIDTH_FACTOR = 0.5

const DEFAULT_CONTENT_WIDTH_PT = 535

function estimateParagraphHeight(text: string, fontSize: number, widthPt: number, lineHeight: number): number {
  if (!text) return 0
  const charsPerLine = Math.max(1, Math.floor(widthPt / (fontSize * AVG_CHAR_WIDTH_FACTOR)))
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine))
  return lines * fontSize * lineHeight
}

export interface FitInput {
  remarksTexts: string[]
  termsTexts: string[]
  signatureCount: number
  contentWidthPt?: number
  /**
   * "boxed" (default): quotation-pdf.tsx / invoice-pdf.tsx renderMultipleSignatures() --
   * each signature is a ~135pt box (date lines + 60pt image/blank + name + position),
   * laid out 2-per-row (counts 2 and 4) or 3-per-row (counts 3 and 5+, taller marginBottom).
   * "simple": quotation-backup-pdf.tsx / invoice-backup-pdf.tsx -- signatures render as
   * short stacked name/position text lines next to Billing, not boxes.
   */
  signatureLayout?: "boxed" | "simple"
}

function estimateBillingSignatureHeight(signatureCount: number, layout: "boxed" | "simple"): number {
  const billingRows = 100 // section title + 4 label/value rows

  if (layout === "simple") {
    const signatureRows = signatureCount <= 0 ? 0 : signatureCount * 26
    return Math.max(billingRows, signatureRows)
  }

  if (signatureCount <= 1) {
    // Single signature renders side-by-side with Billing, not stacked below it --
    // block height is the taller of the two columns, not their sum.
    return Math.max(billingRows, 120)
  }

  const PER_ROW_HEIGHT = 135
  const PER_ROW_HEIGHT_WRAP = 140 // 5+ branch uses a larger marginBottom (15 vs 10)

  let rows: number
  let perRow: number
  if (signatureCount === 4) {
    rows = 2
    perRow = PER_ROW_HEIGHT
  } else if (signatureCount === 2 || signatureCount === 3) {
    rows = 1
    perRow = PER_ROW_HEIGHT
  } else {
    rows = Math.ceil(signatureCount / 3)
    perRow = PER_ROW_HEIGHT_WRAP
  }

  return billingRows + rows * perRow
}

function estimateRemarksTermsBillingHeight(input: FitInput): number {
  const contentWidthPt = input.contentWidthPt ?? DEFAULT_CONTENT_WIDTH_PT
  let height = estimateBillingSignatureHeight(input.signatureCount, input.signatureLayout ?? "boxed")

  if (input.remarksTexts.length > 0) {
    height += 20 // "Remarks" section title
    // Each remark is a checkbox + text row -- the checkbox/margin eats a bit of the
    // content width, and long remarks (full sentences, not just short checklist items)
    // wrap to multiple lines, so this can't be a flat per-item height.
    const remarkWidthPt = contentWidthPt - 13
    for (const text of input.remarksTexts) {
      height += estimateParagraphHeight(text, FONT_SIZE_PT, remarkWidthPt, 1.4) + 3
    }
  }

  if (input.termsTexts.length > 0) {
    height += 20 // "Detailed S&K:" section title
    for (const text of input.termsTexts) {
      height += estimateParagraphHeight(text, FONT_SIZE_PT, contentWidthPt, 1.5) + 4
    }
  }

  return height
}

/** Whether Billing/Signature + Remarks + Terms & Conditions fit together on one page. */
export function fitsBillingRemarksTerms(input: FitInput): boolean {
  return estimateRemarksTermsBillingHeight(input) <= PAGE_USABLE_HEIGHT_PT
}
