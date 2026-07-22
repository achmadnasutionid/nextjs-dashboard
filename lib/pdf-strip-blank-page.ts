/**
 * react-pdf occasionally spills a tiny layout overflow onto a brand new page that ends up
 * with nothing on it besides the `fixed` header/footer (a known pagination quirk). This
 * inspects the last page's own content stream and drops it if there's no real text on it
 * beyond that boilerplate. Works in both the browser and Node since it only uses pdf-lib's
 * bundled (universal) stream decoding instead of Node's zlib.
 */
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from "pdf-lib"

// Comfortably below the shortest real content section (e.g. Billing info alone is 150+ chars)
// but above the fixed header ("QUOTATION" + id/date) + footer ("Generated on ... | id") combined.
const MIN_MEANINGFUL_TEXT_LENGTH = 120

/** True if the page embeds an actual image (e.g. a signature) — never strip a page carrying one. */
function pageHasImage(pdfDoc: PDFDocument, page: ReturnType<PDFDocument["getPages"]>[number]): boolean {
  const resources = page.node.Resources()
  if (!(resources instanceof PDFDict)) return false

  const xObjectsRef = resources.get(PDFName.XObject)
  const xObjects = xObjectsRef instanceof PDFRef ? pdfDoc.context.lookup(xObjectsRef) : xObjectsRef
  if (!(xObjects instanceof PDFDict)) return false

  for (const key of xObjects.keys()) {
    const entryRef = xObjects.get(key)
    const entry = entryRef instanceof PDFRef ? pdfDoc.context.lookup(entryRef) : entryRef
    if (entry instanceof PDFStream && entry.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) {
      return true
    }
  }
  return false
}

function extractTextFromStream(stream: PDFRawStream): string {
  const decoded = decodePDFRawStream(stream).decode()
  const str = new TextDecoder("latin1").decode(decoded)
  const hexRe = /<([0-9a-fA-F]+)>/g
  let match: RegExpExecArray | null
  let text = ""
  while ((match = hexRe.exec(str)) !== null) {
    const hex = match[1]
    for (let i = 0; i + 1 < hex.length; i += 2) {
      text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
    }
  }
  return text
}

/** Removes the last page from `pdfBytes` if it has no meaningful content, returns the bytes unchanged otherwise. */
export async function stripBlankTrailingPage(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pageCount = pdfDoc.getPageCount()
  if (pageCount <= 1) return pdfBytes

  const lastPage = pdfDoc.getPages()[pageCount - 1]
  const contents = lastPage.node.Contents()
  if (!contents) return pdfBytes

  let text = ""
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const entry = contents.get(i)
      const obj = entry instanceof PDFRef ? pdfDoc.context.lookup(entry) : entry
      if (obj instanceof PDFRawStream) text += extractTextFromStream(obj)
    }
  } else if (contents instanceof PDFRawStream) {
    text += extractTextFromStream(contents)
  }

  const meaningfulLength = text.replace(/\s+/g, "").length
  if (meaningfulLength >= MIN_MEANINGFUL_TEXT_LENGTH) return pdfBytes
  if (pageHasImage(pdfDoc, lastPage)) return pdfBytes

  pdfDoc.removePage(pageCount - 1)
  return pdfDoc.save()
}
