import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  headerRight: {
    textAlign: "right",
    marginBottom: 20,
  },
  dateLocation: {
    fontSize: 10,
  },
  openingText: {
    fontSize: 10,
    marginBottom: 15,
    lineHeight: 1.4,
  },
  partySection: {
    marginBottom: 15,
  },
  partyTitle: {
    fontSize: 10,
    marginTop: 10,
    marginBottom: 5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: "20%",
    fontSize: 10,
  },
  colon: {
    width: "3%",
    fontSize: 10,
  },
  value: {
    width: "77%",
    fontSize: 10,
  },
  boldValue: {
    width: "77%",
    fontSize: 10,
    fontWeight: "bold",
  },
  workSection: {
    marginBottom: 15,
  },
  workTitle: {
    fontSize: 10,
    marginBottom: 10,
  },
  workRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  workLabel: {
    width: "30%",
    fontSize: 10,
  },
  workValue: {
    width: "67%",
    fontSize: 10,
    fontWeight: "bold",
  },
  paymentSection: {
    marginBottom: 15,
    marginTop: 10,
  },
  paymentText: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  amountHighlight: {
    color: "#C00000",
    fontWeight: "bold",
  },
  spelledAmount: {
    fontSize: 10,
    color: "#C00000",
    lineHeight: 1.4,
  },
  closingText: {
    fontSize: 10,
    lineHeight: 1.4,
    marginTop: 15,
    marginBottom: 30,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  footerLeft: {
    width: "45%",
    alignItems: "center",
  },
  footerRight: {
    width: "45%",
    alignItems: "center",
  },
  footerLabel: {
    fontSize: 10,
    marginBottom: 5,
  },
  signatureImage: {
    width: 80,
    height: 40,
    marginTop: 10,
    marginBottom: 10,
  },
  signatureImagePlaceholder: {
    width: 80,
    height: 40,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: "#f0f0f0",
    border: "1 solid #ccc",
  },
  signaturePlaceholder: {
    height: 50,
    marginTop: 10,
    marginBottom: 10,
  },
  footerCompany: {
    fontSize: 10,
    fontWeight: "bold",
    textDecoration: "underline",
    marginTop: 5,
  },
  footerName: {
    fontSize: 10,
    textDecoration: "underline",
  },
  // Bukti Pekerjaan - under signatures on same page
  buktiSection: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: "1px solid #ccc",
  },
  buktiTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    textDecoration: "underline",
  },
  driveLinkText: {
    fontSize: 9,
    marginBottom: 6,
  },
  buktiImageSingle: {
    maxWidth: 400,
    maxHeight: 220,
    objectFit: "contain",
  },
  buktiImagePlaceholder: {
    width: 400,
    height: 220,
    backgroundColor: "#f0f0f0",
    border: "1 solid #ccc",
  },
  buktiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  buktiImage: {
    width: 150,
    height: 150,
    objectFit: "contain",
    marginBottom: 10,
    marginRight: 10,
  },
})

interface ErhaBASTPDFProps {
  /** When true, omit signature and proof images for Drive sync to avoid react-pdf 'S' bug. */
  forSync?: boolean
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
    invoiceBastDate: string
    billTo: string
    projectName: string
    billToAddress?: string
    contactPerson: string
    contactPosition: string
    bastContactPerson?: string | null
    bastContactPosition?: string | null
    productionDate: string
    signatureName: string
    signatureRole?: string
    signatureImageData: string
    finalWorkImageData?: string
    finalWorkDriveLink?: string
    billingName?: string
    billingBankName?: string
    billingBankAccount?: string
    billingBankAccountName?: string
    billingNpwp?: string
    pph: string
    totalAmount: number
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

export const ErhaBASTPDF: React.FC<ErhaBASTPDFProps> = ({ data, forSync = false }) => {
  const contactPerson = data.bastContactPerson ?? data.contactPerson
  const contactPosition = data.bastContactPosition ?? data.contactPosition

  // Sign section: use only bill to (company/client), not project name
  const signBillTo =
    data.projectName && data.billTo.endsWith(" - " + data.projectName)
      ? data.billTo.slice(0, -(data.projectName.length + 3)).trim()
      : data.billTo

  const formatCurrency = (amount: number) => {
    return `Rp${new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString)
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" })
    const day = date.getDate()
    const month = date.toLocaleDateString("en-US", { month: "long" })
    const year = date.getFullYear()
    return `${dayName}, ${day} ${month} ${year}`
  }

  // Convert number to Indonesian words
  const numberToWords = (num: number): string => {
    const ones = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"]
    const teens = ["sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas", "tujuh belas", "delapan belas", "sembilan belas"]
    const tens = ["", "", "dua puluh", "tiga puluh", "empat puluh", "lima puluh", "enam puluh", "tujuh puluh", "delapan puluh", "sembilan puluh"]

    if (num === 0) return "nol"
    if (num < 10) return ones[num]
    if (num < 20) return teens[num - 10]
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "")
    if (num < 200) return "seratus" + (num % 100 !== 0 ? " " + numberToWords(num % 100) : "")
    if (num < 1000) return ones[Math.floor(num / 100)] + " ratus" + (num % 100 !== 0 ? " " + numberToWords(num % 100) : "")
    if (num < 2000) return "seribu" + (num % 1000 !== 0 ? " " + numberToWords(num % 1000) : "")
    if (num < 1000000) return numberToWords(Math.floor(num / 1000)) + " ribu" + (num % 1000 !== 0 ? " " + numberToWords(num % 1000) : "")
    if (num < 1000000000) return numberToWords(Math.floor(num / 1000000)) + " juta" + (num % 1000000 !== 0 ? " " + numberToWords(num % 1000000) : "")
    return numberToWords(Math.floor(num / 1000000000)) + " miliar" + (num % 1000000000 !== 0 ? " " + numberToWords(num % 1000000000) : "")
  }

  const amountInWords = numberToWords(Math.floor(data.totalAmount)) + " rupiah"

  // Build full address for first party (signer)
  const getSignerAddress = () => {
    let address = data.companyAddress
    if (data.companyCity) address += `, Kec. ${data.companyCity}`
    if (data.companyProvince) address += `, ${data.companyProvince}`
    if (data.companyPostalCode) address += ` ${data.companyPostalCode}`
    return address
  }

  return (
    <Document pdfVersion="1.3">
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)</Text>

        {/* Location and Date - Right aligned */}
        <View style={styles.headerRight}>
          <Text style={styles.dateLocation}>
            {data.companyCity}, {formatDate(data.invoiceBastDate)}
          </Text>
        </View>

        {/* Opening Text */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.openingText}>
            Pada hari ini, {formatDateFull(data.invoiceBastDate)}    <Text style={{ fontWeight: "bold" }}>{formatDate(data.invoiceBastDate)}</Text>    kami yang bertanda tangan dibawah ini:
          </Text>
        </View>

        {/* First Party (PIHAK PERTAMA) - The service provider/signer */}
        <View style={styles.partySection}>
          <View style={styles.row}>
            <Text style={styles.label}>Nama</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.signatureName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Jabatan</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.signatureRole || "Founder Cataracta Studio"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Alamat</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{getSignerAddress()}</Text>
          </View>
          <Text style={styles.partyTitle}>
            Dalam hal ini disebut sebagai <Text style={{ fontWeight: "bold", color: "#0066CC" }}>PIHAK PERTAMA</Text>.
          </Text>
        </View>

        {/* Second Party (PIHAK KEDUA) - The client */}
        <View style={styles.partySection}>
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
          <View style={styles.row}>
            <Text style={styles.label}>Alamat</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.billToAddress || "-"}</Text>
          </View>
          <Text style={styles.partyTitle}>
            Dalam hal ini disebut sebagai <Text style={{ fontWeight: "bold", color: "#0066CC" }}>PIHAK KEDUA</Text>. Telah mengadakan <Text style={{ fontWeight: "bold" }}>SERAH TERIMA</Text> pekerjaan untuk :
          </Text>
        </View>

        {/* Work Details - Project Name only */}
        <View style={styles.workSection}>
          <View style={styles.workRow}>
            <Text style={styles.workLabel}>Nama Proyek</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.workValue}>{data.projectName || "-"}</Text>
          </View>
          <View style={styles.workRow}>
            <Text style={styles.workLabel}>Total Nominal Pekerjaan</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={[styles.workValue, { color: "#0066CC" }]}>{formatCurrency(data.totalAmount)}</Text>
          </View>
        </View>

        {/* Payment Statement */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentText}>
            Atas Pekerjaan tersebut <Text style={{ fontWeight: "bold" }}>PIHAK PERTAMA</Text> berhak menagihkan pembayaran pelunasan pekerjaan sebesar:{"        "}
            <Text style={styles.amountHighlight}>{formatCurrency(data.totalAmount)}</Text>
          </Text>
          <Text style={styles.spelledAmount}>
            ({amountInWords}) kepada <Text style={{ fontWeight: "bold" }}>PIHAK KEDUA</Text>
          </Text>
        </View>

        {/* Closing Statement */}
        <Text style={styles.closingText}>
          Demikian berita acara penyelesaian dan serah terima pekerjaan ini kami buat dan ditanda tangani oleh kedua belah pihak untuk dapat dipergunakan sebagaimana mestinya.
        </Text>

        {/* Signatures - bill to only (company/client), no project name */}
        <View style={styles.footer} wrap={false}>
          {/* Left: Pihak Kedua (Client) */}
          <View style={styles.footerLeft}>
            <Text style={styles.footerLabel}>Pihak Kedua</Text>
            <View style={styles.signaturePlaceholder} />
            <Text style={styles.footerCompany}>{signBillTo}</Text>
            <Text style={styles.footerName}>{contactPerson}</Text>
          </View>

          {/* Right: Pihak Pertama (Service Provider) */}
          <View style={styles.footerRight}>
            <Text style={styles.footerLabel}>Pihak Pertama</Text>
            {data.signatureImageData && !forSync ? (
              <Image src={data.signatureImageData} style={styles.signatureImage} />
            ) : data.signatureImageData && forSync ? (
              <View style={styles.signatureImagePlaceholder} />
            ) : (
              <View style={styles.signaturePlaceholder} />
            )}
            <Text style={styles.footerCompany}>{data.billingName || "CV CATA KARYA ABADI"}</Text>
            <Text style={styles.footerName}>{data.signatureName}</Text>
          </View>
        </View>

        {/* Bukti Pekerjaan - under signatures, same page so proof is part of signed document */}
        <View style={styles.buktiSection} wrap={false}>
          <Text style={styles.buktiTitle}>Bukti Pekerjaan</Text>
          {data.finalWorkDriveLink ? (
            <Text style={styles.driveLinkText}>Google Drive: {data.finalWorkDriveLink}</Text>
          ) : null}
          {data.finalWorkImageData && !forSync ? (
            <Image src={data.finalWorkImageData} style={styles.buktiImage} />
          ) : data.finalWorkImageData && forSync ? (
            <View style={styles.buktiImagePlaceholder} />
          ) : (
            <Text style={{ fontSize: 10, color: "#666" }}>No work evidence uploaded yet.</Text>
          )}
        </View>
      </Page>
    </Document>
  )
}

