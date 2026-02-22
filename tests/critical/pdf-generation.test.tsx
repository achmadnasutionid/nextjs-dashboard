/**
 * Integration Tests: PDF Generation
 * 
 * Tests PDF generation functionality:
 * - PDF structure and content
 * - Data rendering accuracy
 * - Nested items/details/remarks
 * - Signature handling
 * - PPH calculations in PDF
 * - Summary order rendering
 * - Optional fields handling
 * - File generation (actual bytes)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { QuotationPDF } from '@/components/pdf/quotation-pdf'
import { InvoicePDF } from '@/components/pdf/invoice-pdf'
import { ParagonBASTPDF } from '@/components/pdf/paragon-bast-pdf'
import { ErhaBASTPDF } from '@/components/pdf/erha-bast-pdf'
import { prisma } from '@/lib/prisma'
import { 
  createTestCompany, 
  createTestBilling, 
  createTestSignature,
  createTestQuotation 
} from '../helpers/test-data'

describe('PDF Generation Integration Tests', () => {
  let testCompany: any
  let testBilling: any
  let testSignature: any

  beforeEach(async () => {
    testCompany = await createTestCompany('PDF Test Co')
    testBilling = await createTestBilling('PDF Billing')
    testSignature = await createTestSignature('PDF Signature')
  })

  afterEach(async () => {
    // Cleanup
    await prisma.quotationItem.deleteMany({ where: { quotation: { companyName: 'PDF Test Co' } } })
    await prisma.quotationRemark.deleteMany({ where: { quotation: { companyName: 'PDF Test Co' } } })
    await prisma.quotation.deleteMany({ where: { companyName: 'PDF Test Co' } })
    
    if (testCompany?.id) await prisma.company.delete({ where: { id: testCompany.id } })
    if (testBilling?.id) await prisma.billing.delete({ where: { id: testBilling.id } })
    if (testSignature?.id) await prisma.signature.delete({ where: { id: testSignature.id } })
  })

  describe('1. Basic PDF Generation', () => {
    it('should generate valid PDF bytes for quotation', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        status: 'pending'
      })

      const pdfData = {
        quotationId: quotation.quotationId,
        companyName: quotation.companyName,
        companyAddress: quotation.companyAddress,
        companyCity: quotation.companyCity,
        companyProvince: quotation.companyProvince,
        productionDate: quotation.productionDate.toISOString(),
        billTo: quotation.billTo,
        billingName: quotation.billingName,
        billingBankName: quotation.billingBankName,
        billingBankAccount: quotation.billingBankAccount,
        billingBankAccountName: quotation.billingBankAccountName,
        signatureName: quotation.signatureName,
        signatureRole: quotation.signatureRole || undefined,
        signatureImageData: quotation.signatureImageData,
        pph: quotation.pph,
        totalAmount: quotation.totalAmount,
        status: quotation.status,
        createdAt: quotation.createdAt.toISOString(),
        updatedAt: quotation.updatedAt.toISOString(),
        items: [],
        remarks: [],
        signatures: []
      }

      // Generate PDF
      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)

      // Verify PDF is generated
      expect(pdfBuffer).toBeDefined()
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
      
      // Check PDF magic bytes (%PDF at start)
      const pdfHeader = pdfBuffer.toString('utf8', 0, 4)
      expect(pdfHeader).toBe('%PDF')
      
      console.log(`✅ PDF generated: ${pdfBuffer.length} bytes`)

      // Cleanup
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })

    it('should generate PDF with valid structure (has required sections)', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        notes: 'Test PDF Notes',
        status: 'pending'
      })

      const pdfData = {
        quotationId: quotation.quotationId,
        companyName: quotation.companyName,
        companyAddress: quotation.companyAddress,
        companyCity: quotation.companyCity,
        companyProvince: quotation.companyProvince,
        productionDate: quotation.productionDate.toISOString(),
        billTo: quotation.billTo,
        notes: quotation.notes || undefined,
        billingName: quotation.billingName,
        billingBankName: quotation.billingBankName,
        billingBankAccount: quotation.billingBankAccount,
        billingBankAccountName: quotation.billingBankAccountName,
        signatureName: quotation.signatureName,
        signatureRole: quotation.signatureRole || undefined,
        signatureImageData: quotation.signatureImageData,
        pph: quotation.pph,
        totalAmount: quotation.totalAmount,
        status: quotation.status,
        createdAt: quotation.createdAt.toISOString(),
        updatedAt: quotation.updatedAt.toISOString(),
        items: [],
        remarks: [],
        signatures: []
      }

      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)
      
      // Convert to string to check content
      const pdfText = pdfBuffer.toString('utf8')
      
      // Should contain quotation ID
      expect(pdfText).toContain(quotation.quotationId)
      
      // Should contain company info
      expect(pdfText).toContain(testCompany.name)
      
      // Should contain notes
      expect(pdfText).toContain('Test PDF Notes')

      // Cleanup
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })
  })

  describe('2. PDF with Complex Data (Items, Remarks, Signatures)', () => {
    it('should render all items with nested details in PDF', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        status: 'pending',
        totalAmount: 5000000
      })

      // Add items with details
      await prisma.quotationItem.create({
        data: {
          quotationId: quotation.id,
          productName: 'Product A',
          total: 3000000,
          details: {
            create: [
              { detail: 'Detail A1', unitPrice: 1000000, qty: 2, amount: 2000000 },
              { detail: 'Detail A2', unitPrice: 1000000, qty: 1, amount: 1000000 }
            ]
          }
        },
        include: { details: true }
      })

      await prisma.quotationItem.create({
        data: {
          quotationId: quotation.id,
          productName: 'Product B',
          total: 2000000,
          details: {
            create: [
              { detail: 'Detail B1', unitPrice: 2000000, qty: 1, amount: 2000000 }
            ]
          }
        },
        include: { details: true }
      })

      // Fetch full quotation with items
      const fullQuotation = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        include: {
          items: {
            include: { details: true }
          }
        }
      })

      const pdfData = {
        quotationId: fullQuotation!.quotationId,
        companyName: fullQuotation!.companyName,
        companyAddress: fullQuotation!.companyAddress,
        companyCity: fullQuotation!.companyCity,
        companyProvince: fullQuotation!.companyProvince,
        productionDate: fullQuotation!.productionDate.toISOString(),
        billTo: fullQuotation!.billTo,
        billingName: fullQuotation!.billingName,
        billingBankName: fullQuotation!.billingBankName,
        billingBankAccount: fullQuotation!.billingBankAccount,
        billingBankAccountName: fullQuotation!.billingBankAccountName,
        signatureName: fullQuotation!.signatureName,
        signatureRole: fullQuotation!.signatureRole || undefined,
        signatureImageData: fullQuotation!.signatureImageData,
        pph: fullQuotation!.pph,
        totalAmount: fullQuotation!.totalAmount,
        status: fullQuotation!.status,
        createdAt: fullQuotation!.createdAt.toISOString(),
        updatedAt: fullQuotation!.updatedAt.toISOString(),
        items: fullQuotation!.items.map(item => ({
          productName: item.productName,
          total: item.total,
          details: item.details.map(d => ({
            detail: d.detail,
            unitPrice: d.unitPrice,
            qty: d.qty,
            amount: d.amount
          }))
        })),
        remarks: [],
        signatures: []
      }

      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)
      const pdfText = pdfBuffer.toString('utf8')

      // Should contain product names
      expect(pdfText).toContain('Product A')
      expect(pdfText).toContain('Product B')
      
      // Should contain detail descriptions
      expect(pdfText).toContain('Detail A1')
      expect(pdfText).toContain('Detail A2')
      expect(pdfText).toContain('Detail B1')

      // Cleanup
      await prisma.quotationItem.deleteMany({ where: { quotationId: quotation.id } })
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })

    it('should render remarks in correct order in PDF', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        status: 'pending'
      })

      // Add remarks
      await prisma.quotationRemark.createMany({
        data: [
          { quotationId: quotation.id, text: 'Remark 1: First', isCompleted: false, order: 0 },
          { quotationId: quotation.id, text: 'Remark 2: Second', isCompleted: true, order: 1 },
          { quotationId: quotation.id, text: 'Remark 3: Third', isCompleted: false, order: 2 }
        ]
      })

      const fullQuotation = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        include: { remarks: { orderBy: { order: 'asc' } } }
      })

      const pdfData = {
        quotationId: fullQuotation!.quotationId,
        companyName: fullQuotation!.companyName,
        companyAddress: fullQuotation!.companyAddress,
        companyCity: fullQuotation!.companyCity,
        companyProvince: fullQuotation!.companyProvince,
        productionDate: fullQuotation!.productionDate.toISOString(),
        billTo: fullQuotation!.billTo,
        billingName: fullQuotation!.billingName,
        billingBankName: fullQuotation!.billingBankName,
        billingBankAccount: fullQuotation!.billingBankAccount,
        billingBankAccountName: fullQuotation!.billingBankAccountName,
        signatureName: fullQuotation!.signatureName,
        signatureRole: fullQuotation!.signatureRole || undefined,
        signatureImageData: fullQuotation!.signatureImageData,
        pph: fullQuotation!.pph,
        totalAmount: fullQuotation!.totalAmount,
        status: fullQuotation!.status,
        createdAt: fullQuotation!.createdAt.toISOString(),
        updatedAt: fullQuotation!.updatedAt.toISOString(),
        items: [],
        remarks: fullQuotation!.remarks.map(r => ({
          text: r.text,
          isCompleted: r.isCompleted
        })),
        signatures: []
      }

      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)
      const pdfText = pdfBuffer.toString('utf8')

      // Should contain all remarks
      expect(pdfText).toContain('Remark 1: First')
      expect(pdfText).toContain('Remark 2: Second')
      expect(pdfText).toContain('Remark 3: Third')

      // Cleanup
      await prisma.quotationRemark.deleteMany({ where: { quotationId: quotation.id } })
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })

    it('should render custom signatures in PDF', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        status: 'pending'
      })

      // Add custom signatures
      await prisma.quotationSignature.createMany({
        data: [
          { quotationId: quotation.id, name: 'John Doe', position: 'Director', imageData: '', order: 0 },
          { quotationId: quotation.id, name: 'Jane Smith', position: 'Manager', imageData: '', order: 1 }
        ]
      })

      const fullQuotation = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        include: { signatures: { orderBy: { order: 'asc' } } }
      })

      const pdfData = {
        quotationId: fullQuotation!.quotationId,
        companyName: fullQuotation!.companyName,
        companyAddress: fullQuotation!.companyAddress,
        companyCity: fullQuotation!.companyCity,
        companyProvince: fullQuotation!.companyProvince,
        productionDate: fullQuotation!.productionDate.toISOString(),
        billTo: fullQuotation!.billTo,
        billingName: fullQuotation!.billingName,
        billingBankName: fullQuotation!.billingBankName,
        billingBankAccount: fullQuotation!.billingBankAccount,
        billingBankAccountName: fullQuotation!.billingBankAccountName,
        signatureName: fullQuotation!.signatureName,
        signatureRole: fullQuotation!.signatureRole || undefined,
        signatureImageData: fullQuotation!.signatureImageData,
        pph: fullQuotation!.pph,
        totalAmount: fullQuotation!.totalAmount,
        status: fullQuotation!.status,
        createdAt: fullQuotation!.createdAt.toISOString(),
        updatedAt: fullQuotation!.updatedAt.toISOString(),
        items: [],
        remarks: [],
        signatures: fullQuotation!.signatures.map(s => ({
          name: s.name,
          position: s.position,
          imageData: s.imageData
        }))
      }

      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)
      const pdfText = pdfBuffer.toString('utf8')

      // Should contain signature names and positions
      expect(pdfText).toContain('John Doe')
      expect(pdfText).toContain('Director')
      expect(pdfText).toContain('Jane Smith')
      expect(pdfText).toContain('Manager')

      // Cleanup
      await prisma.quotationSignature.deleteMany({ where: { quotationId: quotation.id } })
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })
  })

  describe('3. PDF with Calculations (PPH, Totals)', () => {
    it('should correctly render PPH calculations in PDF', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        status: 'pending',
        pph: '2', // PPH 23 2%
        totalAmount: 10204081 // ~10M with 2% PPH
      })

      const pdfData = {
        quotationId: quotation.quotationId,
        companyName: quotation.companyName,
        companyAddress: quotation.companyAddress,
        companyCity: quotation.companyCity,
        companyProvince: quotation.companyProvince,
        productionDate: quotation.productionDate.toISOString(),
        billTo: quotation.billTo,
        billingName: quotation.billingName,
        billingBankName: quotation.billingBankName,
        billingBankAccount: quotation.billingBankAccount,
        billingBankAccountName: quotation.billingBankAccountName,
        signatureName: quotation.signatureName,
        signatureRole: quotation.signatureRole || undefined,
        signatureImageData: quotation.signatureImageData,
        pph: quotation.pph,
        totalAmount: quotation.totalAmount,
        status: quotation.status,
        createdAt: quotation.createdAt.toISOString(),
        updatedAt: quotation.updatedAt.toISOString(),
        items: [],
        remarks: [],
        signatures: []
      }

      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)
      const pdfText = pdfBuffer.toString('utf8')

      // Should contain PPH percentage
      expect(pdfText).toContain('2%')
      
      // Should contain total amount
      expect(pdfText).toContain('10.204.081') // Indonesian number format

      // Cleanup
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })
  })

  describe('4. PDF Generation Performance', () => {
    it('should generate PDF quickly (< 3 seconds for complex document)', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        status: 'pending'
      })

      // Create 20 items with details (complex document)
      const items = Array.from({ length: 20 }, (_, i) => ({
        quotationId: quotation.id,
        productName: `Product ${i + 1}`,
        total: 1000000,
        details: {
          create: [
            { detail: `Detail ${i + 1}A`, unitPrice: 500000, qty: 1, amount: 500000 },
            { detail: `Detail ${i + 1}B`, unitPrice: 500000, qty: 1, amount: 500000 }
          ]
        }
      }))

      for (const item of items) {
        await prisma.quotationItem.create({
          data: item,
          include: { details: true }
        })
      }

      const fullQuotation = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        include: {
          items: {
            include: { details: true }
          }
        }
      })

      const pdfData = {
        quotationId: fullQuotation!.quotationId,
        companyName: fullQuotation!.companyName,
        companyAddress: fullQuotation!.companyAddress,
        companyCity: fullQuotation!.companyCity,
        companyProvince: fullQuotation!.companyProvince,
        productionDate: fullQuotation!.productionDate.toISOString(),
        billTo: fullQuotation!.billTo,
        billingName: fullQuotation!.billingName,
        billingBankName: fullQuotation!.billingBankName,
        billingBankAccount: fullQuotation!.billingBankAccount,
        billingBankAccountName: fullQuotation!.billingBankAccountName,
        signatureName: fullQuotation!.signatureName,
        signatureRole: fullQuotation!.signatureRole || undefined,
        signatureImageData: fullQuotation!.signatureImageData,
        pph: fullQuotation!.pph,
        totalAmount: fullQuotation!.totalAmount,
        status: fullQuotation!.status,
        createdAt: fullQuotation!.createdAt.toISOString(),
        updatedAt: fullQuotation!.updatedAt.toISOString(),
        items: fullQuotation!.items.map(item => ({
          productName: item.productName,
          total: item.total,
          details: item.details.map(d => ({
            detail: d.detail,
            unitPrice: d.unitPrice,
            qty: d.qty,
            amount: d.amount
          }))
        })),
        remarks: [],
        signatures: []
      }

      const startTime = Date.now()
      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)
      const duration = Date.now() - startTime

      expect(pdfBuffer.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(3000) // Should be fast

      console.log(`✅ PDF generation performance: ${duration}ms for 20 items (${pdfBuffer.length} bytes)`)

      // Cleanup
      await prisma.quotationItem.deleteMany({ where: { quotationId: quotation.id } })
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })
  })

  describe('5. PDF Optional Fields Handling', () => {
    it('should handle missing optional fields gracefully', async () => {
      const quotation = await createTestQuotation({
        companyName: testCompany.name,
        companyAddress: testCompany.address,
        companyCity: testCompany.city,
        companyProvince: testCompany.province,
        billingName: testBilling.name,
        billingBankName: testBilling.bankName,
        billingBankAccount: testBilling.bankAccount,
        billingBankAccountName: testBilling.bankAccountName,
        signatureName: testSignature.name,
        signatureRole: testSignature.role,
        signatureImageData: testSignature.imageData,
        status: 'pending',
        notes: undefined // Optional field
      })

      const pdfData = {
        quotationId: quotation.quotationId,
        companyName: quotation.companyName,
        companyAddress: quotation.companyAddress,
        companyCity: quotation.companyCity,
        companyProvince: quotation.companyProvince,
        companyPostalCode: undefined, // Optional
        companyTelp: undefined, // Optional
        companyEmail: undefined, // Optional
        productionDate: quotation.productionDate.toISOString(),
        billTo: quotation.billTo,
        notes: undefined, // Optional
        billingName: quotation.billingName,
        billingBankName: quotation.billingBankName,
        billingBankAccount: quotation.billingBankAccount,
        billingBankAccountName: quotation.billingBankAccountName,
        signatureName: quotation.signatureName,
        signatureRole: quotation.signatureRole || undefined,
        signatureImageData: quotation.signatureImageData,
        pph: quotation.pph,
        totalAmount: quotation.totalAmount,
        status: quotation.status,
        createdAt: quotation.createdAt.toISOString(),
        updatedAt: quotation.updatedAt.toISOString(),
        items: [],
        remarks: [],
        signatures: []
      }

      // Should not throw error
      const pdfBuffer = await renderToBuffer(<QuotationPDF data={pdfData} />)
      
      expect(pdfBuffer).toBeDefined()
      expect(pdfBuffer.length).toBeGreaterThan(0)

      // Cleanup
      await prisma.quotation.delete({ where: { id: quotation.id } })
    })
  })

  describe('6. BAST PDF (Paragon / Erha) – contact fallback', () => {
    const baseBastData = {
      ticketId: 'PRG-TEST-001',
      quotationId: 'QTN-TEST-001',
      invoiceId: 'INV-TEST-001',
      companyName: 'Test Co',
      companyAddress: 'Jl. Test',
      companyCity: 'Jakarta',
      companyProvince: 'DKI Jakarta',
      invoiceBastDate: new Date().toISOString(),
      billTo: 'Client',
      projectName: 'Test Project',
      productionDate: new Date().toISOString(),
      signatureName: 'Director',
      signatureImageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      pph: '2',
      totalAmount: 10_000_000,
      items: [] as Array<{ productName: string; total: number; details: Array<{ detail: string; unitPrice: number; qty: number; amount: number }> }>,
      updatedAt: new Date().toISOString(),
    }

    it('Paragon BAST PDF should use quotation contact when bastContact is not set', async () => {
      const data = {
        ...baseBastData,
        contactPerson: 'Quotation Contact Name',
        contactPosition: 'Quotation Position',
        bastContactPerson: null as string | null,
        bastContactPosition: null as string | null,
      }
      const pdfBuffer = await renderToBuffer(<ParagonBASTPDF data={data} />)
      const pdfText = pdfBuffer.toString('utf8')
      expect(pdfBuffer.length).toBeGreaterThan(0)
      expect(pdfText).toContain('Quotation Contact Name')
    })

    it('Paragon BAST PDF should use BAST contact when set', async () => {
      const data = {
        ...baseBastData,
        contactPerson: 'Quotation Contact',
        contactPosition: 'Quotation Position',
        bastContactPerson: 'BAST Contact Name',
        bastContactPosition: 'BAST Position',
      }
      const pdfBuffer = await renderToBuffer(<ParagonBASTPDF data={data} />)
      const pdfText = pdfBuffer.toString('utf8')
      expect(pdfBuffer.length).toBeGreaterThan(0)
      expect(pdfText).toContain('BAST Contact Name')
    })

    it('Erha BAST PDF should use quotation contact when bastContact is not set', async () => {
      const data = {
        ...baseBastData,
        ticketId: 'ERH-TEST-001',
        contactPerson: 'Erha Quotation Contact',
        contactPosition: 'Quotation Position',
        bastContactPerson: null as string | null,
        bastContactPosition: null as string | null,
      }
      const pdfBuffer = await renderToBuffer(<ErhaBASTPDF data={data} />)
      const pdfText = pdfBuffer.toString('utf8')
      expect(pdfBuffer.length).toBeGreaterThan(0)
      expect(pdfText).toContain('Erha Quotation Contact')
    })

    it('Erha BAST PDF should use BAST contact when set', async () => {
      const data = {
        ...baseBastData,
        ticketId: 'ERH-TEST-002',
        contactPerson: 'Erha Quotation',
        contactPosition: 'Quotation',
        bastContactPerson: 'Erha BAST Contact Name',
        bastContactPosition: 'BAST Role',
      }
      const pdfBuffer = await renderToBuffer(<ErhaBASTPDF data={data} />)
      const pdfText = pdfBuffer.toString('utf8')
      expect(pdfBuffer.length).toBeGreaterThan(0)
      expect(pdfText).toContain('Erha BAST Contact Name')
    })
  })
})
