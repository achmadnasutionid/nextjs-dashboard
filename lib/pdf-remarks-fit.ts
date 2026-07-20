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
  // Terms/S&K blocks can carry explicit line breaks (parsed from <br> tags), and remarks
  // can contain manually-typed newlines -- each one forces its own visual line in react-pdf's
  // <Text>, on top of whatever character-count wrapping applies within each line.
  const lines = text
    .split('\n')
    .reduce((total, segment) => total + Math.max(1, Math.ceil(segment.length / charsPerLine)), 0)
  return Math.max(1, lines) * fontSize * lineHeight
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

// Items table: col1 is 50% of the ~535pt content width, minus the "  • " bullet prefix.
const ITEM_DETAIL_FONT_SIZE_PT = 9
const ITEM_DETAIL_WIDTH_PT = 267.5 - 20
const ITEM_ROW_PADDING_PT = 8 // tableRow padding: 4pt top + 4pt bottom

/**
 * Estimated height of one product's header row + all its detail rows in the Items table.
 * Detail text can be long free-form descriptions with embedded blank-line breaks (not just
 * short one-liners), so this can't be a flat per-row height -- same reasoning as Remarks/Terms.
 */
export function estimateItemHeight(detailTexts: string[]): number {
  const headerRowHeight = ITEM_DETAIL_FONT_SIZE_PT * 1.3 + ITEM_ROW_PADDING_PT
  const detailRowsHeight = detailTexts.reduce(
    (sum, text) => sum + estimateParagraphHeight(text, ITEM_DETAIL_FONT_SIZE_PT, ITEM_DETAIL_WIDTH_PT, 1.3) + ITEM_ROW_PADDING_PT,
    0
  )
  return headerRowHeight + detailRowsHeight
}

/**
 * Extra height for a summary row's optional note line (e.g. the PPh withholding-tax-slip
 * reminder) -- summary rows are otherwise a flat height, but a note can wrap to several
 * lines of its own and isn't covered by a flat per-row assumption.
 */
export function estimateSummaryNoteHeight(note: string | null | undefined): number {
  if (!note) return 0
  return estimateParagraphHeight(note, FONT_SIZE_PT, DEFAULT_CONTENT_WIDTH_PT, 1.3) + 2
}
