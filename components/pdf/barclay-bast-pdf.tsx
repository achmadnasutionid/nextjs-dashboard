import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { extractClientNameFromBillTo } from "@/lib/barclay"

const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 52,
    paddingHorizontal: 64,
    fontSize: 10.5,
    fontFamily: "Times-Roman",
    lineHeight: 1.4,
  },
  title: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 28,
  },
  section: {
    marginBottom: 18,
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    width: 100,
    fontWeight: "bold",
  },
  colon: {
    width: 10,
    textAlign: "center",
  },
  value: {
    flex: 1,
  },
  signerIntro: {
    marginBottom: 8,
  },
  signerBlock: {
    marginBottom: 10,
  },
  signerTitleRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  signerIndex: {
    width: 18,
  },
  signerTitle: {
    fontWeight: "bold",
  },
  signerRepresenting: {
    marginLeft: 18,
  },
  paragraph: {
    textAlign: "justify",
    marginBottom: 10,
  },
  signatureContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  signatureColumn: {
    width: "44%",
  },
  signatureCompany: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  signatureImage: {
    width: 82,
    height: 40,
    marginTop: 12,
    marginBottom: 8,
  },
  signatureImagePlaceholder: {
    width: 82,
    height: 40,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#f0f0f0",
    border: "1 solid #ccc",
  },
  signatureSpacer: {
    height: 60,
  },
  signatureName: {
    marginTop: 2,
  },
  signatureRole: {
    marginTop: 1,
  },
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
  buktiImage: {
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
})

interface BarclayBASTPDFProps {
  forSync?: boolean
  data: {
    ticketId: string
    invoiceBastDate: string
    projectName: string
    billTo: string
    contactPerson: string
    contactPosition: string
    bastContactPerson?: string | null
    bastContactPosition?: string | null
    signatureName: string
    signatureRole?: string
    signatureImageData: string
    finalWorkImageData?: string
    finalWorkDriveLink?: string | null
    billingName?: string
  }
}

const DEFAULT_PROVIDER_NAME = "CV. CATA KARYA ABADI"
const DEFAULT_EXECUTOR_NAME = "Cataracta Studio"

function formatDateIndonesian(dateString: string): string {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export const BarclayBASTPDF: React.FC<BarclayBASTPDFProps> = ({ data, forSync = false }) => {
  const contactPerson = data.bastContactPerson ?? data.contactPerson
  const contactPosition = data.bastContactPosition ?? data.contactPosition
  const clientCompany = extractClientNameFromBillTo(data.billTo, data.projectName) || "PT. Barclay Product"
  const providerCompany = (data.billingName ?? "").trim() || DEFAULT_PROVIDER_NAME
  const bastDate = formatDateIndonesian(data.invoiceBastDate)

  return (
    <Document pdfVersion="1.3">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>BERITA ACARA SERAH TERIMA PEKERJAAN</Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Pekerjaan</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.projectName || "-"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tanggal BAST</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{bastDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pelaksana</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{DEFAULT_EXECUTOR_NAME}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.signerIntro}>Kami yang bertanda tangan di bawah ini:</Text>

          <View style={styles.signerBlock}>
            <View style={styles.signerTitleRow}>
              <Text style={styles.signerIndex}>1.</Text>
              <Text style={styles.signerTitle}>Nama</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.value}>{contactPerson || "-"}</Text>
            </View>
            <View style={styles.signerTitleRow}>
              <Text style={styles.signerIndex}></Text>
              <Text style={styles.signerTitle}>Jabatan</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.value}>{contactPosition || "-"}</Text>
            </View>
            <Text style={styles.signerRepresenting}>Dalam hal ini mewakili {clientCompany}</Text>
          </View>

          <View style={styles.signerBlock}>
            <View style={styles.signerTitleRow}>
              <Text style={styles.signerIndex}>2.</Text>
              <Text style={styles.signerTitle}>Nama</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.value}>{data.signatureName || "-"}</Text>
            </View>
            <View style={styles.signerTitleRow}>
              <Text style={styles.signerIndex}></Text>
              <Text style={styles.signerTitle}>Jabatan</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.value}>{data.signatureRole || "-"}</Text>
            </View>
            <Text style={styles.signerRepresenting}>Dalam hal ini mewakili {providerCompany}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            {providerCompany} telah mengadakan pelaksanaan pekerjaan {data.projectName || "-"} yang sudah diselesaikan
            dan diserahkan hasilnya dalam kondisi baik berupa link drive kepada {clientCompany} pada tanggal {bastDate}.
          </Text>
          <Text style={styles.paragraph}>
            Demikian Berita Acara Serah Terima Pekerjaan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.
          </Text>
          <Text style={styles.paragraph}>Untuk perhatian dan kerjasamanya kami ucapkan terima kasih.</Text>
        </View>

        <View style={styles.signatureContainer} wrap={false}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureCompany}>{providerCompany}</Text>
            {data.signatureImageData && !forSync ? (
              <Image src={data.signatureImageData} style={styles.signatureImage} />
            ) : data.signatureImageData && forSync ? (
              <View style={styles.signatureImagePlaceholder} />
            ) : (
              <View style={styles.signatureSpacer} />
            )}
            <Text style={styles.signatureName}>{data.signatureName || "-"}</Text>
            <Text style={styles.signatureRole}>{data.signatureRole || "-"}</Text>
          </View>

          <View style={styles.signatureColumn}>
            <Text style={styles.signatureCompany}>{clientCompany}</Text>
            <View style={styles.signatureSpacer} />
            <Text style={styles.signatureName}>{contactPerson || "-"}</Text>
            <Text style={styles.signatureRole}>{contactPosition || "-"}</Text>
          </View>
        </View>

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
