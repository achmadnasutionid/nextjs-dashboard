import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { PPH_OPTIONS } from "@/lib/constants"

const styles = StyleSheet.create({
  page: {
    padding: 30,
    paddingBottom: 60,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottom: "2 solid #000",
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
    backgroundColor: "#f0f0f0",
    padding: 4,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: "30%",
    fontWeight: "bold",
    fontSize: 8,
  },
  value: {
    width: "70%",
    fontSize: 8,
  },
  grid: {
    flexDirection: "row",
    marginBottom: 12,
  },
  gridCol: {
    width: "50%",
    paddingRight: 10,
  },
  table: {
    marginTop: 8,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#000",
    color: "#fff",
    padding: 5,
    fontWeight: "bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #ddd",
    padding: 4,
    minHeight: 20,
  },
  col1: { width: "50%" },
  col2: { width: "17%", textAlign: "right" },
  col3: { width: "16%", textAlign: "right" },
  col4: { width: "17%", textAlign: "right" },
  summary: {
    marginTop: 12,
    marginBottom: 50,
    padding: 8,
    backgroundColor: "#f9f9f9",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 9,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTop: "2 solid #000",
    fontSize: 11,
    fontWeight: "bold",
  },
  signature: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "40%",
    alignItems: "flex-end",
  },
  signatureLabel: {
    fontSize: 9,
    marginBottom: 5,
  },
  signatureImage: {
    maxWidth: 150,
    height: 60,
    objectFit: "contain",
  },
  /** Placeholder when Image is skipped to avoid react-pdf structure-tree bug (reading 'S'). */
  signatureImagePlaceholder: {
    width: 150,
    height: 60,
    backgroundColor: "#f0f0f0",
    border: "1 solid #ccc",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    color: "#666",
    fontSize: 7,
    borderTop: "1 solid #ddd",
    paddingTop: 8,
  },
})

interface QuotationPDFProps {
  /** When true, omit signature/proof images to avoid react-pdf 'S' bug; use only for Drive sync. */
  forSync?: boolean
  data: {
    quotationId: string
    companyName: string
    companyAddress: string
    companyCity: string
    companyProvince: string
    companyPostalCode?: string
    companyTelp?: string
    companyEmail?: string
    productionDate: string
    billTo: string
    notes?: string
    billingName: string
    billingBankName: string
    billingBankAccount: string
    billingBankAccountName: string
    signatureName: string
    signatureRole?: string
    signatureImageData: string
    summaryOrder?: string
    signatures?: Array<{
      name: string
      position: string
      imageData: string
    }>
    pph: string
    totalAmount: number
    status: string
    remarks?: Array<{
      text: string
      isCompleted: boolean
    }>
    termsAndConditions?: string
    items: Array<{
      productName: string
      total: number
      details: Array<{
        detail: string
        unitPrice: number
        qty: number
        amount: number
      }>
    }>
    createdAt: string
    updatedAt: string
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Helper to decode HTML entities
const decodeHTMLEntities = (text: string) => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// Helper to parse HTML and convert to formatted text blocks with inline styles
const parseHTMLToTextBlocks = (html: string) => {
  if (!html || typeof html !== 'string') return []
  
  const blocks: { text: string; style?: any }[] = []
  
  try {
    // Handle paragraphs
    const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi
    let match
    while ((match = paragraphPattern.exec(html)) !== null) {
      let content = match[1]
      
      // Check if paragraph is empty or contains only whitespace/br tags
      const isEmpty = !content.trim() || /^(<br\s*\/?>|\s|&nbsp;)*$/i.test(content)
      
      if (isEmpty) {
        // Preserve empty paragraphs as blank lines
        blocks.push({ text: ' ', style: { fontSize: 8 } })
      } else {
        // Check if entire content is wrapped in strong or em
        const isFullyBold = /^<strong[^>]*>([\s\S]*?)<\/strong>$/i.test(content.trim())
        const isFullyItalic = /^<em[^>]*>([\s\S]*?)<\/em>$/i.test(content.trim())
        
        // Extract text
        let text = content
          .replace(/<strong[^>]*>/gi, '')
          .replace(/<\/strong>/gi, '')
          .replace(/<em[^>]*>/gi, '')
          .replace(/<\/em>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '')
        
        // Decode HTML entities
        text = decodeHTMLEntities(text).trim()
        
        if (text) {
          const style: any = { fontSize: 8 }
          if (isFullyBold) style.fontWeight = 'bold'
          if (isFullyItalic) style.fontStyle = 'italic'
          blocks.push({ text, style })
        }
      }
    }
    
    // Handle headings
    const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
    while ((match = h2Pattern.exec(html)) !== null) {
      let text = match[1]
        .replace(/<[^>]*>/g, '')
      
      // Decode HTML entities
      text = decodeHTMLEntities(text).trim()
      
      if (text) {
        blocks.push({ 
          text, 
          style: { fontSize: 9, fontWeight: 'bold' } 
        })
      }
    }
    
    // Handle list items
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
    while ((match = liPattern.exec(html)) !== null) {
      let text = match[1]
        .replace(/<strong[^>]*>/gi, '')
        .replace(/<\/strong>/gi, '')
        .replace(/<em[^>]*>/gi, '')
        .replace(/<\/em>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
      
      // Decode HTML entities
      text = decodeHTMLEntities(text).trim()
      
      if (text) {
        blocks.push({ 
          text: '• ' + text, 
          style: { fontSize: 8 } 
        })
      }
    }
    
    // If no blocks found, just strip all HTML
    if (blocks.length === 0 && html.trim()) {
      const plainText = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
      
      // Decode HTML entities
      const decodedText = decodeHTMLEntities(plainText).trim()
      
      if (decodedText) {
        blocks.push({ text: decodedText, style: { fontSize: 8 } })
      }
    }
    
  } catch (error) {
    console.error('Error parsing HTML:', error)
    const fallbackText = decodeHTMLEntities(html.replace(/<[^>]*>/g, ' '))
    return [{ text: fallbackText, style: { fontSize: 8 } }]
  }
  
  return blocks
}

export const QuotationPDF: React.FC<QuotationPDFProps> = ({ data, forSync = false }) => {
  // Ensure items is an array with valid structure
  const safeItems = (data.items || []).map(item => ({
    ...item,
    details: (item.details || [])
  }))
  
  // Items total is the NET amount (after tax deduction)
  const netAmount = safeItems.reduce((sum, item) => sum + (item.total || 0), 0)
  
  // Calculate GROSS amount (before tax deduction)
  // Formula: Gross = Net × (100 / (100 - pph%))
  const pphRate = parseFloat(data.pph || "0")
  const grossAmount = pphRate > 0 ? netAmount * (100 / (100 - pphRate)) : netAmount
  
  // PPh amount is the difference
  const pphAmount = grossAmount - netAmount
  
  // Get PPh label from constants
  const pphOption = PPH_OPTIONS.find(option => option.value === data.pph)
  const pphLabel = pphOption ? pphOption.label : `PPh (${data.pph}%)`
  
  // Split PPh label into main text and note (if exists)
  const pphParts = pphLabel.split(' - After reporting')
  const pphMainLabel = pphParts[0]
  const pphNote = pphParts[1] ? 'After reporting' + pphParts[1] : null

  // Always include the main signature (if it has data), plus any additional signatures
  const mainSignature = {
    name: data.signatureName,
    position: data.signatureRole || '',
    imageData: data.signatureImageData
  }
  
  // Only include main signature if it has a name
  // Add safety checks for signatures array
  const additionalSignatures = Array.isArray(data.signatures) 
    ? data.signatures
        .filter(sig => {
          // Extra safety: check if sig is a valid object
          if (!sig || typeof sig !== 'object') return false
          if (typeof sig.name !== 'string' || typeof sig.position !== 'string') return false
          // Check if name and position are not just whitespace
          if (!sig.name.trim() || !sig.position.trim()) return false
          return true
        })
        .map(sig => ({
          name: String(sig.name || ''),
          position: String(sig.position || ''),
          imageData: String(sig.imageData || '')
        }))
    : []
  
  const allSignatures = [
    ...(data.signatureName ? [mainSignature] : []),
    ...additionalSignatures
  ]

  // Get summary order or use default
  const summaryOrder = data.summaryOrder ? data.summaryOrder.split(',') : ['subtotal', 'pph', 'total']

  // Create summary items based on order
  const summaryItems = summaryOrder.map(id => {
    if (id === 'subtotal') {
      return { id: 'subtotal', label: 'Subtotal', value: netAmount, showPlus: false }
    } else if (id === 'pph') {
      return { id: 'pph', label: pphMainLabel, value: pphAmount, showPlus: true, note: pphNote }
    } else {
      return { id: 'total', label: 'Total Amount', value: grossAmount, showPlus: false, isTotal: true }
    }
  })

  // Render signatures based on count
  const renderSignatures = () => {
    const sigCount = allSignatures.length

    if (sigCount === 1) {
      // Single signature: on the right side next to billing
      const sig = allSignatures[0]
      return (
        <View style={[styles.gridCol, { paddingRight: 0, alignItems: "center", justifyContent: "center" }]}>
          <View style={{ alignItems: "center", width: "100%" }}>
            {sig.imageData && String(sig.imageData).trim() ? (
              <View>
                <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                  {data.companyCity}, {data.companyProvince}
                </Text>
                <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                  {new Date(data.updatedAt).toLocaleDateString("id-ID")}
                </Text>
                {forSync ? (
                  <View style={styles.signatureImagePlaceholder} />
                ) : (
                  <Image src={sig.imageData} style={styles.signatureImage} />
                )}
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                  __________,__________
                </Text>
                <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                  ___/___/_______
                </Text>
                <View style={{ height: 60 }} />
              </View>
            )}
            <Text style={{ fontSize: 8, marginTop: 4, textAlign: "center" }}>
              {sig.name}
            </Text>
            {sig.position ? (
              <Text style={{ fontSize: 7, marginTop: 2, textAlign: "center", color: "#666" }}>
                {sig.position}
              </Text>
            ) : null}
          </View>
        </View>
      )
    }

    // Multiple signatures: below billing, arranged based on count
    return null // Will be rendered separately below
  }

  const renderMultipleSignatures = () => {
    const sigCount = allSignatures.length
    
    if (sigCount <= 1) return null

    const signatureBoxStyle = {
      alignItems: "center" as const,
      width: sigCount === 2 ? "48%" : sigCount === 3 ? "30%" : "48%",
      marginBottom: 10
    }

    const renderSigImage = (sig: { imageData: string }, isMainWithData: boolean) => {
      if (!isMainWithData) return <View style={{ height: 60 }} />
      if (forSync) return <View style={styles.signatureImagePlaceholder} />
      return <Image src={sig.imageData} style={styles.signatureImage} />
    }

    if (sigCount === 2) {
      // Side by side
      return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 15 }} wrap={false}>
          {allSignatures.map((sig, idx) => (
            <View key={idx} style={signatureBoxStyle}>
              {/* Only show real location/date for main signature (idx 0) with imageData, rest are for client signatures */}
              {sig.imageData && String(sig.imageData).trim() && idx === 0 ? (
                <View>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                    {data.companyCity}, {data.companyProvince}
                  </Text>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                    {new Date(data.updatedAt).toLocaleDateString("id-ID")}
                  </Text>
                  {renderSigImage(sig, true)}
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                    __________,__________
                  </Text>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                    ___/___/_______
                  </Text>
                  <View style={{ height: 60 }} />
                </View>
              )}
              <Text style={{ fontSize: 8, marginTop: 4, textAlign: "center" }}>
                {sig.name}
              </Text>
              {sig.position ? (
                <Text style={{ fontSize: 7, marginTop: 2, textAlign: "center", color: "#666" }}>
                  {sig.position}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )
    } else if (sigCount === 3) {
      // All aligned with one centered
      return (
        <View style={{ marginTop: 15 }} wrap={false}>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 10 }}>
            {allSignatures.map((sig, idx) => (
              <View key={idx} style={signatureBoxStyle}>
                {/* Only show real location/date for main signature (idx 0) with imageData, rest are for client signatures */}
                {sig.imageData && String(sig.imageData).trim() && idx === 0 ? (
                  <View>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                      {data.companyCity}, {data.companyProvince}
                    </Text>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                      {new Date(data.updatedAt).toLocaleDateString("id-ID")}
                    </Text>
                    {renderSigImage(sig, true)}
                  </View>
                ) : (
                  <View>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                      __________,__________
                    </Text>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                      ___/___/_______
                    </Text>
                    <View style={{ height: 60 }} />
                  </View>
                )}
                <Text style={{ fontSize: 8, marginTop: 4, textAlign: "center" }}>
                  {sig.name}
                </Text>
                {sig.position ? (
                  <Text style={{ fontSize: 7, marginTop: 2, textAlign: "center", color: "#666" }}>
                    {sig.position}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )
    } else if (sigCount === 4) {
      // 2x2 grid
      return (
        <View style={{ marginTop: 15 }} wrap={false}>
          {/* Top row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            {allSignatures.slice(0, 2).map((sig, idx) => (
              <View key={idx} style={signatureBoxStyle}>
                {/* Only show real location/date for main signature (idx 0) with imageData, rest are for client signatures */}
                {sig.imageData && String(sig.imageData).trim() && idx === 0 ? (
                  <View>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                      {data.companyCity}, {data.companyProvince}
                    </Text>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                      {new Date(data.updatedAt).toLocaleDateString("id-ID")}
                    </Text>
                    {renderSigImage(sig, true)}
                  </View>
                ) : (
                  <View>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                      __________,__________
                    </Text>
                    <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                      ___/___/_______
                    </Text>
                    <View style={{ height: 60 }} />
                  </View>
                )}
                <Text style={{ fontSize: 8, marginTop: 4, textAlign: "center" }}>
                  {sig.name}
                </Text>
                {sig.position ? (
                  <Text style={{ fontSize: 7, marginTop: 2, textAlign: "center", color: "#666" }}>
                    {sig.position}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
          {/* Bottom row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {allSignatures.slice(2, 4).map((sig, idx) => (
              <View key={idx + 2} style={signatureBoxStyle}>
                {/* Additional signatures always have blank fields */}
                <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                  __________,__________
                </Text>
                <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                  ___/___/_______
                </Text>
                <View style={{ height: 60 }} />
                <Text style={{ fontSize: 8, marginTop: 4, textAlign: "center" }}>
                  {sig.name}
                </Text>
                {sig.position ? (
                  <Text style={{ fontSize: 7, marginTop: 2, textAlign: "center", color: "#666" }}>
                    {sig.position}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )
    } else {
      // 5+ signatures: wrap layout
      return (
        <View style={{ marginTop: 15, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around" }} wrap={false}>
          {allSignatures.map((sig, idx) => (
            <View key={idx} style={{ ...signatureBoxStyle, width: "30%", marginBottom: 15 }}>
              {/* Only show real location/date for main signature (idx 0) with imageData, rest are for client signatures */}
              {sig.imageData && String(sig.imageData).trim() && idx === 0 ? (
                <View>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                    {data.companyCity}, {data.companyProvince}
                  </Text>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                    {new Date(data.updatedAt).toLocaleDateString("id-ID")}
                  </Text>
                  {renderSigImage(sig, true)}
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 2 }}>
                    __________,__________
                  </Text>
                  <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 5 }}>
                    ___/___/_______
                  </Text>
                  <View style={{ height: 60 }} />
                </View>
              )}
              <Text style={{ fontSize: 8, marginTop: 4, textAlign: "center" }}>
                {sig.name}
              </Text>
              {sig.position ? (
                <Text style={{ fontSize: 7, marginTop: 2, textAlign: "center", color: "#666" }}>
                  {sig.position}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )
    }
  }

  return (
    <Document pdfVersion="1.3">
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.title}>QUOTATION</Text>
          <Text style={styles.subtitle}>
            {data.quotationId} - {new Date(data.createdAt).toLocaleDateString("id-ID")}
          </Text>
        </View>

        {/* Company & Basic Info */}
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionTitle}>Company Information</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{data.companyName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Address:</Text>
              <Text style={styles.value}>{data.companyAddress}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>City:</Text>
              <Text style={styles.value}>{data.companyCity}, {data.companyProvince}</Text>
            </View>
            {data.companyPostalCode ? (
              <View style={styles.row}>
                <Text style={styles.label}>Postal Code:</Text>
                <Text style={styles.value}>{data.companyPostalCode}</Text>
              </View>
            ) : null}
            {data.companyTelp ? (
              <View style={styles.row}>
                <Text style={styles.label}>Tel:</Text>
                <Text style={styles.value}>{data.companyTelp}</Text>
              </View>
            ) : null}
            {data.companyEmail ? (
              <View style={styles.row}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{data.companyEmail}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.gridCol}>
            <Text style={styles.sectionTitle}>Quotation Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Production Date:</Text>
              <Text style={styles.value}>
                {new Date(data.productionDate).toLocaleDateString("id-ID")}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Bill To:</Text>
              <Text style={styles.value}>{data.billTo}</Text>
            </View>
            {data.notes ? (
              <View style={styles.row}>
                <Text style={styles.label}>Notes:</Text>
                <Text style={styles.value}>{data.notes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Items */}
        <View style={styles.section} break={false}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Product / Description</Text>
              <Text style={styles.col2}>Unit Price</Text>
              <Text style={styles.col3}>Qty</Text>
              <Text style={styles.col4}>Amount</Text>
            </View>

            {safeItems.map((item, itemIndex) => (
              <View key={`item-${itemIndex}`} wrap={false}>
                {/* Product Header Row - No Amount */}
                <View style={[styles.tableRow, { backgroundColor: "#f9f9f9", fontWeight: "bold" }]}>
                  <Text style={styles.col1}>{item.productName ? item.productName : "\u00A0"}</Text>
                  <Text style={styles.col2}>{"\u00A0"}</Text>
                  <Text style={styles.col3}>{"\u00A0"}</Text>
                  <Text style={styles.col4}>{"\u00A0"}</Text>
                </View>

                {/* Detail Rows */}
                {(item.details || []).map((detail, detailIndex) => (
                  <View key={`detail-${itemIndex}-${detailIndex}`} style={styles.tableRow}>
                    <Text style={styles.col1}>  • {detail.detail || ''}</Text>
                    <Text style={styles.col2}>{formatCurrency(detail.unitPrice || 0)}</Text>
                    <Text style={styles.col3}>{detail.qty || 0}</Text>
                    <Text style={styles.col4}>{formatCurrency(detail.amount || 0)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summary} wrap={false}>
          {summaryItems.map((item, index) => (
            <View key={item.id}>
              <View style={index === 2 ? styles.summaryTotal : styles.summaryRow}>
                <View style={{ flexDirection: "column" }}>
                  <Text>{item.label}:</Text>
                  {item.note ? (
                    <Text style={{ fontSize: 8, fontWeight: "bold", marginTop: 2 }}>
                      {item.note}
                    </Text>
                  ) : null}
                </View>
                <Text style={item.id === 'pph' ? { color: "green" } : { color: "#000" }}>
                  {item.id === 'pph' ? "+ " : ""}{formatCurrency(item.value)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Remarks */}
        {data.remarks && data.remarks.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Remarks</Text>
            {(data.remarks || []).map((remark, index) => (
              <View key={`remark-${index}`} style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={{ fontSize: 8, marginRight: 5 }}>
                  {remark.isCompleted ? "☑" : "☐"}
                </Text>
                <Text style={{ 
                  fontSize: 8, 
                  textDecoration: remark.isCompleted ? "line-through" : "none",
                  color: remark.isCompleted ? "#999" : "#000"
                }}>
                  {remark.text || ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Detailed Terms & Conditions (S&K) */}
        {data.termsAndConditions ? (
          <View style={{ marginBottom: 15 }}>
            <Text style={styles.sectionTitle}>Detailed S&K:</Text>
            <View style={{ fontSize: 8, lineHeight: 1.5 }}>
              {parseHTMLToTextBlocks(data.termsAndConditions).map((block, index) => (
                <Text key={index} style={{ marginBottom: 4, fontSize: 8, ...(block.style || {}) }}>
                  {block.text}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* Billing & Signature */}
        <View style={allSignatures.length === 1 ? styles.grid : { width: "100%" }} wrap={false}>
          <View style={allSignatures.length === 1 ? styles.gridCol : { width: "100%" }}>
            <Text style={styles.sectionTitle}>Billing Information</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Account:</Text>
              <Text style={styles.value}>{data.billingName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Bank:</Text>
              <Text style={styles.value}>{data.billingBankName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Number:</Text>
              <Text style={styles.value}>{data.billingBankAccount}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{data.billingBankAccountName}</Text>
            </View>
          </View>

          {/* Render single signature on right if count is 1 */}
          {allSignatures.length === 1 ? renderSignatures() : null}
        </View>

        {/* Render multiple signatures below if count is 2+ */}
        {allSignatures.length > 1 ? renderMultipleSignatures() : null}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Generated on {new Date().toLocaleDateString("id-ID")} | {data.quotationId}
        </Text>
      </Page>
    </Document>
  )
}

/** Minimal quotation PDF: Document > Page > Text only. Used when full render throws (e.g. structure-tree 'S' bug). */
export const QuotationPDFMinimal: React.FC<{ data: QuotationPDFProps["data"] }> = ({ data }) => (
  <Document pdfVersion="1.3">
    <Page size="A4" style={{ padding: 30, fontSize: 10, fontFamily: "Helvetica" }}>
      <Text style={{ fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>QUOTATION</Text>
      <Text style={{ marginBottom: 4 }}>No. {data.quotationId}</Text>
      <Text style={{ marginBottom: 4 }}>Bill To: {data.billTo}</Text>
      <Text style={{ marginBottom: 4 }}>Total: {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(data.totalAmount)}</Text>
    </Page>
  </Document>
)
