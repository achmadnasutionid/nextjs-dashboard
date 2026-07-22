"use client"

import { useEffect, useState, type CSSProperties, type ReactElement } from "react"
import { Loader2 } from "lucide-react"
import { renderStrippedPdfBlob } from "@/lib/pdf-client-render"

interface StrippedPDFViewerProps {
  children: ReactElement
  className?: string
  style?: CSSProperties
}

/**
 * Drop-in replacement for react-pdf's <PDFViewer> that renders through
 * renderStrippedPdfBlob first, so a trailing blank page (a known react-pdf
 * pagination quirk) never shows up in the preview either.
 */
export function StrippedPDFViewer({ children, className, style }: StrippedPDFViewerProps) {
  const [mounted, setMounted] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const childType = children?.type as any
  const typeKey = childType?.displayName || childType?.name || String(childType)
  const depKey = `${typeKey}:${JSON.stringify((children as any)?.props)}`

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    let objectUrl: string | null = null

    setUrl(null)
    renderStrippedPdfBlob(children).then((blob) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, depKey])

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${className || ""}`} style={style}>
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Preparing document...</p>
        </div>
      </div>
    )
  }

  return <iframe src={url} className={className} style={{ border: "none", ...style }} title="PDF preview" />
}
