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
  remarksCount: number
  termsTexts: string[]
  signatureCount: number
  contentWidthPt?: number
}

function estimateBillingSignatureHeight(signatureCount: number): number {
  const billingRows = 100 // section title + 4 label/value rows
  const signatureRows = signatureCount <= 1 ? 90 : Math.ceil(signatureCount / 2) * 90
  return billingRows + signatureRows
}

function estimateRemarksTermsBillingHeight(input: FitInput): number {
  const contentWidthPt = input.contentWidthPt ?? DEFAULT_CONTENT_WIDTH_PT
  let height = estimateBillingSignatureHeight(input.signatureCount)

  if (input.remarksCount > 0) {
    height += 20 // "Remarks" section title
    height += input.remarksCount * (FONT_SIZE_PT * 1.4 + 3)
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
