"use client"

import { pdf } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import { stripBlankTrailingPage } from "./pdf-strip-blank-page"

/** Renders a react-pdf document to a Blob, dropping a trailing blank page if react-pdf added one. */
export async function renderStrippedPdfBlob(element: ReactElement): Promise<Blob> {
  const blob = await pdf(element as any).toBlob()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const stripped = await stripBlankTrailingPage(bytes)
  return new Blob([stripped as BlobPart], { type: "application/pdf" })
}
