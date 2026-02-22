import React from "react"
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: "25%",
    fontSize: 10,
  },
  colon: {
    width: "3%",
    fontSize: 10,
  },
  value: {
    width: "72%",
    fontSize: 10,
  },
  boldText: {
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
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
    marginTop: 5,
    marginBottom: 5,
  },
  footerName: {
    fontSize: 10,
    fontWeight: "bold",
  },
  footerCompany: {
    fontSize: 10,
    marginTop: 2,
  },
  footerRole: {
    fontSize: 10,
    marginTop: 2,
  },
  stamp: {
    marginTop: 30,
    fontSize: 10,
  },
  buktiSection: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: "1px solid #ccc",
  },
  buktiTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 8,
  },
  buktiImage: {
    maxWidth: 400,
    maxHeight: 220,
    objectFit: "contain",
  },
})

interface ParagonBASTPDFProps {
  data: {
    ticketId: string
    quotationId: string
    invoiceId: string
    companyName: string
    companyAddress: string
    companyCity: string
    companyProvince: string
    companyPostalCode?: string
    companyTelp?: string
    companyEmail?: string
    invoiceBastDate: string // BAST date
    billTo: string
    projectName: string
    contactPerson: string
    contactPosition: string
    bastContactPerson?: string | null
    bastContactPosition?: string | null
    productionDate: string
    signatureName: string
    signatureRole?: string
    signatureImageData: string
    finalWorkImageData?: string // Screenshot final work
    pph: string
    totalAmount: number
    remarks?: Array<{
      text: string
      isCompleted: boolean
    }>
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

export const ParagonBASTPDF: React.FC<ParagonBASTPDFProps> = ({ data }) => {
  const contactPerson = data.bastContactPerson ?? data.contactPerson
  const contactPosition = data.bastContactPosition ?? data.contactPosition

  // Sign section: use only bill to (company/client), not project name
  const signBillTo =
    data.projectName && data.billTo.endsWith(" - " + data.projectName)
      ? data.billTo.slice(0, -(data.projectName.length + 3)).trim()
      : data.billTo

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)</Text>

        {/* Date */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Pada hari ini, tanggal</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{formatDate(data.invoiceBastDate)}</Text>
          </View>
        </View>

        {/* Signer Info */}
        <View style={styles.section}>
          <Text style={{ fontSize: 10, marginBottom: 5 }}>Saya yang bertanda tangan di bawah ini :</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nama</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.signatureName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Jabatan</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.signatureRole || "-"}</Text>
          </View>
        </View>

        {/* Work Description - Project Name only */}
        <View style={styles.section}>
          <Text style={{ fontSize: 10, marginBottom: 5 }}>Menerangkan Bahwa Pekerjaan Berupa :</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nama Proyek</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.projectName || "-"}</Text>
          </View>
        </View>

        {/* Quotation Reference */}
        <View style={styles.section}>
          <Text style={{ fontSize: 10, marginBottom: 5 }}>Sesuai Dengan :</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Quotation No.</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.quotationId}</Text>
          </View>
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Nama</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{contactPerson}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Jabatan</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{contactPosition}</Text>
          </View>
        </View>

        {/* Closing Statement */}
        <View style={styles.section}>
          <Text style={{ fontSize: 10, marginTop: 10 }}>
            Demikian <Text style={styles.boldText}>Berita Acara</Text> ini dibuat untuk dapat di pergunakan sebagaimana mestinya
          </Text>
        </View>

        {/* Signatures - bill to only (company/client), no project name */}
        <View style={styles.footer} wrap={false}>
          {/* Left: Company Representative */}
          <View style={styles.footerLeft}>
            <Text style={styles.footerLabel}>Hormat Saya,</Text>
            <Text style={{ fontSize: 10, marginBottom: 5, color: "white" }}>{signBillTo}</Text>
            {data.signatureImageData ? (
              <Image
                src={data.signatureImageData}
                style={styles.signatureImage}
              />
            ) : (
              <View style={{ height: 60, borderBottom: "1px solid #999", marginTop: 10, marginBottom: 5, width: 150 }} />
            )}
            <Text style={styles.footerName}>{data.signatureName}</Text>
            <Text style={styles.footerRole}>{data.signatureRole}</Text>
          </View>

          {/* Right: Client Representative */}
          <View style={styles.footerRight}>
            <Text style={styles.footerLabel}>Perwakilan</Text>
            <Text style={styles.footerCompany}>{signBillTo}</Text>
            <View style={{ height: 40, marginTop: 5, marginBottom: 5 }} />
            <Text style={styles.footerName}>{contactPerson}</Text>
            <Text style={styles.footerRole}>{contactPosition}</Text>
          </View>
        </View>

        {/* Bukti Pekerjaan - under signatures, same page so proof is part of signed document */}
        <View style={styles.buktiSection} wrap={false}>
          <Text style={styles.buktiTitle}>Bukti Pekerjaan</Text>
          {data.finalWorkImageData && (
            <Image
              src={data.finalWorkImageData}
              style={styles.buktiImage}
            />
          )}
        </View>
      </Page>
    </Document>
  )
}

