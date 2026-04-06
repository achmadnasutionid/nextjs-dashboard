/**
 * Backup PDF for Quotation – Google Drive sync only.
 * Same information as the general Quotation PDF, but simple layout and StyleSheet-only
 * so it renders reliably on the server (no 'S' bug). No images.
 */

import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
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
  summaryLabelCol: {
    flexDirection: "column" as const,
  },
  termsLine: {
    marginBottom: 4,
    fontSize: 8,
    lineHeight: 1.5,
  },
  remarkRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  remarkCheck: {
    fontSize: 8,
    marginRight: 5,
  },
  remarkText: {
    fontSize: 8,
  },
  signatureLine: {
    fontSize: 8,
    marginTop: 2,
  },
  footer: {
    position: "absolute" as const,
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

function stripHtmlToLines(html: string): string[] {
  if (!html || typeof html !== "string") return []
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export type QuotationBackupPDFData = {
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
  signatureImageData?: string
  summaryOrder?: string
  signatures?: Array<{ name: string; position: string; imageData?: string }>
  pph: string
  totalAmount: number
  status: string
  remarks?: Array<{ text: string; isCompleted: boolean }>
  termsAndConditions?: string
  items: Array<{
    productName: string
    total: number
    details: Array<{ detail: string; unitPrice: number; qty: number; amount: number }>
  }>
  createdAt: string
  updatedAt: string
}

export const QuotationBackupPDF: React.FC<{ data: QuotationBackupPDFData }> = ({ data }) => {
  const safeItems = (data.items || []).map((item) => ({
    ...item,
    details: item.details || [],
  }))
  const netAmount = safeItems.reduce((sum, item) => sum + (item.total || 0), 0)
  const pphRate = parseFloat(data.pph || "0")
  const grossAmount = pphRate > 0 ? netAmount * (100 / (100 - pphRate)) : netAmount
  const pphAmount = grossAmount - netAmount
  const pphOption = PPH_OPTIONS.find((o) => o.value === data.pph)
  const pphLabel = pphOption ? pphOption.label : `PPh (${data.pph}%)`
  const pphParts = pphLabel.split(" - After reporting")
  const pphMainLabel = pphParts[0]
  const pphNote = pphParts[1] ? "After reporting" + pphParts[1] : null
  const summaryOrderRaw = data.summaryOrder ? data.summaryOrder.split(",") : ["subtotal", "pph", "total"]
  const showPph = pphRate > 0
  const summaryItems = summaryOrderRaw.filter((id) => (id === "pph" ? showPph : true)).map((id) => {
    if (id === "subtotal") return { id: "subtotal", label: "Subtotal", value: netAmount }
    if (id === "pph") return { id: "pph", label: pphMainLabel, value: pphAmount, note: pphNote }
    return { id: "total", label: "Total Amount", value: grossAmount, isTotal: true }
  })
  const mainSig = { name: data.signatureName, position: data.signatureRole || "" }
  const extraSigs = Array.isArray(data.signatures)
    ? data.signatures.filter((s) => s && s.name?.trim()).map((s) => ({ name: s.name, position: s.position || "" }))
    : []
  const allSignatures = [...(data.signatureName ? [mainSig] : []), ...extraSigs]
  const termsLines = data.termsAndConditions ? stripHtmlToLines(data.termsAndConditions) : []

  return (
    <Document pdfVersion="1.3">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>QUOTATION</Text>
          <Text style={styles.subtitle}>
            {data.quotationId} - {new Date(data.createdAt).toLocaleDateString("id-ID")}
          </Text>
        </View>

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
              <Text style={styles.value}>{new Date(data.productionDate).toLocaleDateString("id-ID")}</Text>
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
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>{item.productName || "\u00A0"}</Text>
                  <Text style={styles.col2}>{"\u00A0"}</Text>
                  <Text style={styles.col3}>{"\u00A0"}</Text>
                  <Text style={styles.col4}>{"\u00A0"}</Text>
                </View>
                {(item.details || []).map((detail, detailIndex) => (
                  <View key={`d-${itemIndex}-${detailIndex}`} style={styles.tableRow}>
                    <Text style={styles.col1}>  • {detail.detail || ""}</Text>
                    <Text style={styles.col2}>{formatCurrency(detail.unitPrice || 0)}</Text>
                    <Text style={styles.col3}>{detail.qty || 0}</Text>
                    <Text style={styles.col4}>{formatCurrency(detail.amount || 0)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.summary} wrap={false}>
          {summaryItems.map((item) => (
            <View key={item.id}>
              <View style={item.isTotal ? styles.summaryTotal : styles.summaryRow}>
                <View style={styles.summaryLabelCol}>
                  <Text>{item.label}:</Text>
                  {item.note ? <Text style={styles.termsLine}>{item.note}</Text> : null}
                </View>
                <Text>{item.id === "pph" ? "+ " : ""}{formatCurrency(item.value)}</Text>
              </View>
            </View>
          ))}
        </View>

        {data.remarks && data.remarks.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Remarks</Text>
            {(data.remarks || []).map((remark, index) => (
              <View key={`r-${index}`} style={styles.remarkRow}>
                <Text style={styles.remarkCheck}>{remark.isCompleted ? "☑" : "☐"}</Text>
                <Text style={styles.remarkText}>{remark.text || ""}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {termsLines.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Detailed S&K:</Text>
            {termsLines.map((line, index) => (
              <Text key={`t-${index}`} style={styles.termsLine}>{line}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.grid} wrap={false}>
          <View style={styles.gridCol}>
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
          <View style={styles.gridCol}>
            <Text style={styles.sectionTitle}>Signature(s)</Text>
            {allSignatures.map((sig, idx) => (
              <View key={idx}>
                <Text style={styles.signatureLine}>{sig.name}</Text>
                {sig.position ? <Text style={styles.signatureLine}>{sig.position}</Text> : null}
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Generated on {new Date().toLocaleDateString("id-ID")} | {data.quotationId}
        </Text>
      </Page>
    </Document>
  )
}
