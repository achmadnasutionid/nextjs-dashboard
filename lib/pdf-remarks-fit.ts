/**
 * Decides how Remarks + Terms & Conditions + Billing/Signature should be laid out
 * together at the end of a quotation/invoice PDF (react-pdf has no runtime
 * shrink-to-fit or "only force a break if it'll actually fit" primitive, so both
 * are pre-computed here from estimated text height).
 */

// A4 height minus the page's top/bottom padding (matches `styles.page` in the PDF templates).
export const PAGE_USABLE_HEIGHT_PT = 841.89 - 30 - 60

const FONT_SIZE_TIERS = [8, 7, 6] as const

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

export interface FitResult {
  /** Font size to use for the Remarks checklist and Terms & Conditions text. */
  fontSize: number
  /** Whether it's safe to force the whole Billing+Remarks+Terms block to stay on one page. */
  atomic: boolean
}

function estimateBillingSignatureHeight(signatureCount: number): number {
  const billingRows = 100 // section title + 4 label/value rows
  const signatureRows = signatureCount <= 1 ? 90 : Math.ceil(signatureCount / 2) * 90
  return billingRows + signatureRows
}

function estimateRemarksTermsBillingHeight(input: FitInput, fontSize: number): number {
  const contentWidthPt = input.contentWidthPt ?? DEFAULT_CONTENT_WIDTH_PT
  let height = estimateBillingSignatureHeight(input.signatureCount)

  if (input.remarksCount > 0) {
    height += 20 // "Remarks" section title
    height += input.remarksCount * (fontSize * 1.4 + 3)
  }

  if (input.termsTexts.length > 0) {
    height += 20 // "Detailed S&K:" section title
    for (const text of input.termsTexts) {
      height += estimateParagraphHeight(text, fontSize, contentWidthPt, 1.5) + 4
    }
  }

  return height
}

export function fitRemarksTermsBilling(input: FitInput): FitResult {
  for (const fontSize of FONT_SIZE_TIERS) {
    const height = estimateRemarksTermsBillingHeight(input, fontSize)
    if (height <= PAGE_USABLE_HEIGHT_PT) {
      return { fontSize, atomic: true }
    }
  }

  const floor = FONT_SIZE_TIERS[FONT_SIZE_TIERS.length - 1]
  return { fontSize: floor, atomic: false }
}
