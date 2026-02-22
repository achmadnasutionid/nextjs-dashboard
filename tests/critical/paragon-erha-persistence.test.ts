/**
 * CRITICAL TEST: Paragon & Erha persistence (BAST contact + adjustment)
 *
 * Covers recent changes:
 * - bastContactPerson, bastContactPosition (optional; BAST/Invoice contact)
 * - adjustmentPercentage, adjustmentNotes (persist and update)
 * Ensures create and update work for both Paragon and Erha tickets.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

const TEST_ID = `TEST-${Date.now()}`
const PARAGON_TICKET_ID = `PRG-${new Date().getFullYear()}-9001`
const PARAGON_QUOTATION_ID = `QTN-${new Date().getFullYear()}-9001`
const PARAGON_INVOICE_ID = `INV-${new Date().getFullYear()}-9001`
const ERHA_TICKET_ID = `ERH-${new Date().getFullYear()}-9001`
const ERHA_QUOTATION_ID = `QTN-${new Date().getFullYear()}-9002`
const ERHA_INVOICE_ID = `INV-${new Date().getFullYear()}-9002`

const baseDate = new Date()

describe('🔴 CRITICAL: Paragon & Erha persistence (BAST contact + adjustment)', () => {
  let paragonId: string | undefined
  let erhaId: string | undefined

  beforeAll(async () => {
    const [paragon, erha] = await Promise.all([
      prisma.paragonTicket.create({
        data: {
          ticketId: PARAGON_TICKET_ID,
          quotationId: PARAGON_QUOTATION_ID,
          invoiceId: PARAGON_INVOICE_ID,
          companyName: 'Test Paragon Co',
          companyAddress: 'Jl. Test',
          companyCity: 'Jakarta',
          companyProvince: 'DKI Jakarta',
          productionDate: baseDate,
          quotationDate: baseDate,
          invoiceBastDate: baseDate,
          billTo: `BillTo ${TEST_ID}`,
          projectName: `Project ${TEST_ID}`,
          contactPerson: 'Quotation Contact',
          contactPosition: 'Quotation Position',
          bastContactPerson: 'BAST Contact',
          bastContactPosition: 'BAST Position',
          signatureName: 'Sig',
          signatureImageData: 'data:image/png;base64,x',
          pph: '2',
          totalAmount: 1_000_000,
          adjustmentPercentage: 5,
          adjustmentNotes: 'Early payment discount',
          status: 'draft',
        },
      }),
      prisma.erhaTicket.create({
        data: {
          ticketId: ERHA_TICKET_ID,
          quotationId: ERHA_QUOTATION_ID,
          invoiceId: ERHA_INVOICE_ID,
          companyName: 'Test Erha Co',
          companyAddress: 'Jl. Test',
          companyCity: 'Jakarta',
          companyProvince: 'DKI Jakarta',
          productionDate: baseDate,
          quotationDate: baseDate,
          invoiceBastDate: baseDate,
          billTo: `BillTo Erha ${TEST_ID}`,
          projectName: `Project Erha ${TEST_ID}`,
          billToAddress: 'Address',
          billingName: 'Test Billing Erha',
          billingBankName: 'Test Bank',
          billingBankAccount: '1234567890',
          billingBankAccountName: 'Test Account',
          contactPerson: 'Quotation Contact Erha',
          contactPosition: 'Quotation Position Erha',
          bastContactPerson: 'BAST Contact Erha',
          bastContactPosition: 'BAST Position Erha',
          signatureName: 'Sig',
          signatureImageData: 'data:image/png;base64,x',
          pph: '2',
          totalAmount: 2_000_000,
          adjustmentPercentage: 10,
          adjustmentNotes: 'Volume discount',
          status: 'draft',
        },
      }),
    ])
    paragonId = paragon.id
    erhaId = erha.id
  })

  afterAll(async () => {
    if (paragonId) {
      await prisma.paragonTicket.delete({ where: { id: paragonId } }).catch(() => {})
    }
    if (erhaId) {
      await prisma.erhaTicket.delete({ where: { id: erhaId } }).catch(() => {})
    }
  })

  describe('Paragon ticket', () => {
    it('should persist bastContactPerson and bastContactPosition on create', async () => {
      expect(paragonId).toBeDefined()
      const found = await prisma.paragonTicket.findUnique({
        where: { id: paragonId! },
        select: { bastContactPerson: true, bastContactPosition: true },
      })
      expect(found).not.toBeNull()
      expect(found!.bastContactPerson).toBe('BAST Contact')
      expect(found!.bastContactPosition).toBe('BAST Position')
    })

    it('should persist adjustmentPercentage and adjustmentNotes on create', async () => {
      const found = await prisma.paragonTicket.findUnique({
        where: { id: paragonId! },
        select: { adjustmentPercentage: true, adjustmentNotes: true },
      })
      expect(found).not.toBeNull()
      expect(found!.adjustmentPercentage).toBe(5)
      expect(found!.adjustmentNotes).toBe('Early payment discount')
    })

    it('should update BAST contact and adjustment and allow clearing to null', async () => {
      await prisma.paragonTicket.update({
        where: { id: paragonId! },
        data: {
          bastContactPerson: null,
          bastContactPosition: null,
          adjustmentPercentage: null,
          adjustmentNotes: null,
        },
      })
      const after = await prisma.paragonTicket.findUnique({
        where: { id: paragonId! },
        select: {
          bastContactPerson: true,
          bastContactPosition: true,
          adjustmentPercentage: true,
          adjustmentNotes: true,
        },
      })
      expect(after!.bastContactPerson).toBeNull()
      expect(after!.bastContactPosition).toBeNull()
      expect(after!.adjustmentPercentage).toBeNull()
      expect(after!.adjustmentNotes).toBeNull()
    })
  })

  describe('Erha ticket', () => {
    it('should persist bastContactPerson and bastContactPosition on create', async () => {
      expect(erhaId).toBeDefined()
      const found = await prisma.erhaTicket.findUnique({
        where: { id: erhaId! },
        select: { bastContactPerson: true, bastContactPosition: true },
      })
      expect(found).not.toBeNull()
      expect(found!.bastContactPerson).toBe('BAST Contact Erha')
      expect(found!.bastContactPosition).toBe('BAST Position Erha')
    })

    it('should persist adjustmentPercentage and adjustmentNotes on create', async () => {
      const found = await prisma.erhaTicket.findUnique({
        where: { id: erhaId! },
        select: { adjustmentPercentage: true, adjustmentNotes: true },
      })
      expect(found).not.toBeNull()
      expect(found!.adjustmentPercentage).toBe(10)
      expect(found!.adjustmentNotes).toBe('Volume discount')
    })

    it('should update BAST contact and adjustment and allow clearing to null', async () => {
      await prisma.erhaTicket.update({
        where: { id: erhaId! },
        data: {
          bastContactPerson: null,
          bastContactPosition: null,
          adjustmentPercentage: null,
          adjustmentNotes: null,
        },
      })
      const after = await prisma.erhaTicket.findUnique({
        where: { id: erhaId! },
        select: {
          bastContactPerson: true,
          bastContactPosition: true,
          adjustmentPercentage: true,
          adjustmentNotes: true,
        },
      })
      expect(after!.bastContactPerson).toBeNull()
      expect(after!.bastContactPosition).toBeNull()
      expect(after!.adjustmentPercentage).toBeNull()
      expect(after!.adjustmentNotes).toBeNull()
    })
  })
})
