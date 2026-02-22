/**
 * Test Data Helpers
 * Create realistic test data for all critical features
 */

import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id-generator'

export const createTestCompany = async (name?: string) => {
  return await prisma.company.create({
    data: {
      name: name || `Test Company ${Date.now()}`,
      address: 'Jl. Test No. 123',
      city: 'Jakarta',
      province: 'DKI Jakarta',
      postalCode: '12345',
      telp: '021-12345678',
      email: 'test@company.com'
    }
  })
}

export const createTestBilling = async (name?: string) => {
  return await prisma.billing.create({
    data: {
      name: name || `Test Billing ${Date.now()}`,
      bankName: 'Bank Test',
      bankAccount: '1234567890',
      bankAccountName: 'Test Account',
      ktp: '1234567890123456',
      npwp: '12.345.678.9-012.345'
    }
  })
}

export const createTestSignature = async (name?: string) => {
  return await prisma.signature.create({
    data: {
      name: name || `Test Signature ${Date.now()}`,
      role: 'Director',
      imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }
  })
}

export const createTestQuotation = async (options: {
  companyName: string
  companyAddress?: string
  companyCity?: string
  companyProvince?: string
  billingName: string
  billingBankName?: string
  billingBankAccount?: string
  billingBankAccountName?: string
  signatureName: string
  signatureRole?: string
  signatureImageData?: string
  billTo?: string // Allow custom billTo
  status?: string
  notes?: string | null
  totalAmount?: number
  pph?: string
}) => {
  const quotationId = await generateId('QTN', 'quotation')
  const testId = `TEST-${Date.now()}` // Unique per test run
  
  const quotation = await prisma.quotation.create({
    data: {
      quotationId,
      companyName: options.companyName,
      companyAddress: options.companyAddress || 'Jl. Test No. 123',
      companyCity: options.companyCity || 'Jakarta',
      companyProvince: options.companyProvince || 'DKI Jakarta',
      companyPostalCode: '12345',
      companyTelp: '021-12345678',
      companyEmail: 'test@company.com',
      productionDate: new Date(),
      billTo: options.billTo || `Test Client ${testId}`, // Unique default
      billToEmail: 'client@test.com',
      notes: options.notes !== undefined ? options.notes : 'Test notes',
      billingName: options.billingName,
      billingBankName: options.billingBankName || 'Bank Test',
      billingBankAccount: options.billingBankAccount || '1234567890',
      billingBankAccountName: options.billingBankAccountName || 'Test Account',
      billingKtp: '1234567890123456',
      billingNpwp: '12.345.678.9-012.345',
      signatureName: options.signatureName,
      signatureRole: options.signatureRole || 'Director',
      signatureImageData: options.signatureImageData || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      pph: options.pph || '2',
      totalAmount: options.totalAmount !== undefined ? options.totalAmount : 0,
      summaryOrder: 'subtotal,pph,total',
      status: options.status || 'draft'
    }
  })
  
  // Return tracker info for cleanup (created automatically via syncTracker in API)
  // Note: Tracker is only created when using API routes, not direct Prisma calls
  return quotation
}
