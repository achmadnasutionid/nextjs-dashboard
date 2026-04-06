import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLeft: {
    width: "60%",
  },
  headerRight: {
    width: "40%",
    textAlign: "right",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 3,
  },
  ticketNumber: {
    fontSize: 10,
    marginBottom: 5,
  },
  dateLocation: {
    fontSize: 10,
    marginBottom: 2,
  },
  companySection: {
    marginBottom: 15,
  },
  companyTitle: {
    fontSize: 10,
    marginBottom: 3,
  },
  companyName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 9,
    marginBottom: 1,
    lineHeight: 1.3,
  },
  billToSection: {
    marginBottom: 15,
  },
  billToTitle: {
    fontSize: 10,
    marginBottom: 3,
  },
  billToValue: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  billToAddress: {
    fontSize: 9,
    lineHeight: 1.3,
  },
  table: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#B4C7E7",
    padding: 6,
    fontWeight: "bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8,
    minHeight: 20,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8,
    minHeight: 20,
    backgroundColor: "#F8F8F8",
  },
  col1: { width: "30%", paddingRight: 4 },
  col2: { width: "30%", paddingRight: 4 },
  col3: { width: "15%", textAlign: "right", paddingRight: 4 },
  col4: { width: "8%", textAlign: "center" },
  col5: { width: "17%", textAlign: "right" },
  summarySection: {
    marginTop: 10,
    marginBottom: 15,
  },
  summaryBox: {
    backgroundColor: "#E7E6E6",
    padding: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
    width: "80%",
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
    width: "20%",
  },
  summaryValueHighlight: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
    width: "20%",
    color: "#C00000",
  },
  billingInfo: {
    fontSize: 8,
    marginBottom: 1,
    lineHeight: 1.3,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  footerLeft: {
    width: "45%",
  },
  footerRight: {
    width: "45%",
    alignItems: "flex-end",
  },
  footerLabel: {
    fontSize: 10,
    marginBottom: 5,
  },
  signatureImage: {
    width: 80,
    height: 40,
    marginBottom: 5,
  },
  signatureImagePlaceholder: {
    width: 80,
    height: 40,
    marginBottom: 5,
    backgroundColor: "#f0f0f0",
    border: "1 solid #ccc",
  },
  footerName: {
    fontSize: 10,
    fontWeight: "bold",
    textDecoration: "underline",
  },
  footerRole: {
    fontSize: 9,
    color: "#666",
    marginTop: 2,
  },
  termsBlock: {
    marginBottom: 4,
    fontSize: 8,
    lineHeight: 1.5,
  },
})

interface ErhaInvoicePDFProps {
  /** When true, omit signature image for Drive sync to avoid react-pdf 'S' bug. */
  forSync?: boolean
  data: {
    ticketId: string
    invoiceId: string
    companyName: string
    companyAddress: string
    companyCity: string
    companyProvince: string
    companyPostalCode?: string
    companyTelp?: string
    companyEmail?: string
    invoiceBastDate: string
    billTo: string
    billToAddress?: string
    contactPerson: string
    contactPosition: string
    productionDate: string
    signatureName: string
    signatureRole?: string
    signatureImageData: string
    billingName?: string
    billingBankName?: string
    billingBankAccount?: string
    billingBankAccountName?: string
    billingNpwp?: string
    pph: string
    totalAmount: number
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
    updatedAt: string
  }
}

export const ErhaInvoicePDF: React.FC<ErhaInvoicePDFProps> = ({ data, forSync = false }) => {
  const formatCurrency = (amount: number) => {
    return `Rp${new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`
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

  // Calculate totals
  const calculateGrossTotal = () => {
    // Total before PPh deduction (Total Inc PPH)
    return data.totalAmount
  }

  const calculatePph = () => {
    // PPh amount based on percentage
    const pphRate = parseFloat(data.pph) / 100
    return data.totalAmount * pphRate
  }

  const calculateNett = () => {
    // Nett amount after PPh deduction
    return data.totalAmount - calculatePph()
  }

  // Flatten items for table - each detail is a separate row
  // Only show product name on first detail of each product
  const flattenedItems = data.items.flatMap((item) =>
    item.details.map((detail, index) => ({
      productName: index === 0 ? item.productName : "", // Only show on first row
      detail: detail.detail,
      unitPrice: detail.unitPrice,
      qty: detail.qty,
      amount: detail.amount,
    }))
  )

  return (
    <Document pdfVersion="1.3">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.ticketNumber}>No : {data.invoiceId}</Text>
            <Text style={styles.dateLocation}>
              {data.companyCity}, {new Date(data.invoiceBastDate).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>

        {/* Company Section */}
        <View style={styles.companySection}>
          <Text style={styles.companyTitle}>Company</Text>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyDetail}>{data.companyAddress},</Text>
          <Text style={styles.companyDetail}>
            Kec {data.companyCity}, {data.companyProvince} {data.companyPostalCode}
          </Text>
          <Text style={styles.companyDetail}>
            {data.companyTelp} / {data.companyEmail}
          </Text>
        </View>

        {/* Bill To */}
        <View style={styles.billToSection}>
          <Text style={styles.billToTitle}>Bill To:</Text>
          <Text style={styles.billToValue}>{data.billTo}</Text>
          {data.billToAddress && (
            <Text style={styles.billToAddress}>{data.billToAddress}</Text>
          )}
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>PRODUCT NAME</Text>
            <Text style={styles.col2}>Detail</Text>
            <Text style={styles.col3}>Unit Price</Text>
            <Text style={styles.col4}>Qty</Text>
            <Text style={styles.col5}>TOTAL</Text>
          </View>

          {/* Table Rows - Each detail as separate row */}
          {flattenedItems.map((item, index) => (
            <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.col1}>{item.productName}</Text>
              <Text style={styles.col2}>{item.detail}</Text>
              <Text style={styles.col3}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.col4}>{item.qty}</Text>
              <Text style={styles.col5}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            {parseFloat(data.pph || "0") > 0 ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Inc PPH</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(calculateGrossTotal())}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>PPH 23</Text>
                  <Text style={styles.summaryValueHighlight}>{formatCurrency(calculatePph())}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Nett</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(calculateNett())}</Text>
                </View>
              </>
            ) : (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryValue}>{formatCurrency(data.totalAmount)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Billing Information */}
        {data.billingName && (
          <View style={{ marginBottom: 20 }} wrap={false}>
            <Text style={styles.billingInfo}>{data.billingName}</Text>
            {data.billingBankName && data.billingBankAccount && data.billingBankAccountName && (
              <Text style={styles.billingInfo}>
                Bank {data.billingBankName} {data.billingBankAccount} an {data.billingBankAccountName}
              </Text>
            )}
            {data.billingNpwp && (
              <Text style={styles.billingInfo}>NO NPWP CV : {data.billingNpwp}</Text>
            )}
          </View>
        )}

        {/* Detailed Terms & Conditions (S&K) - view and sync separate */}
        {data.termsAndConditions && (
          forSync ? (
            <View style={{ marginBottom: 15 }}>
              <Text style={styles.billingInfo}>Detailed S&K:</Text>
              <View style={{ fontSize: 8, lineHeight: 1.5 }}>
                {parseHTMLToTextBlocks(data.termsAndConditions).map((block, index) => (
                  <Text key={index} style={styles.termsBlock}>{block.text}</Text>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ marginBottom: 15 }}>
              <Text style={styles.billingInfo}>Detailed S&K:</Text>
              <View style={{ fontSize: 8, lineHeight: 1.5 }}>
                {parseHTMLToTextBlocks(data.termsAndConditions).map((block, index) => (
                  <Text key={index} style={{ marginBottom: 4, ...block.style }}>{block.text}</Text>
                ))}
              </View>
            </View>
          )
        )}

        {/* Footer with Signature */}
        <View style={styles.footer} wrap={false}>
          {/* Left: Empty or Client */}
          <View style={styles.footerLeft} />

          {/* Right: Company Signature */}
          <View style={styles.footerRight}>
            <Text style={{ fontSize: 10, marginBottom: 5 }}>Best Regards,</Text>
            {data.signatureImageData && !forSync ? (
              <Image src={data.signatureImageData} style={styles.signatureImage} />
            ) : data.signatureImageData && forSync ? (
              <View style={styles.signatureImagePlaceholder} />
            ) : (
              <View style={{ height: 60, borderBottom: "1px solid #999", marginTop: 10, marginBottom: 5, width: 150 }} />
            )}
            <Text style={styles.footerName}>{data.signatureName}</Text>
            {data.signatureRole && (
              <Text style={styles.footerRole}>{data.signatureRole}</Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}

