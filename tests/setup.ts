/**
 * Global Test Setup
 * 
 * This file runs ONCE before all tests
 * - Ensures test database has correct schema
 * - Cleans up test data after all tests complete
 */

import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Safety check: NEVER run tests against production (setup truncates all tables in afterAll)
const databaseUrl = process.env.DATABASE_URL || ''
const isTestDb =
  databaseUrl.includes('/test') ||
  databaseUrl.includes('_test') ||
  databaseUrl.includes('test_') ||
  databaseUrl.includes('testdb') ||
  databaseUrl.includes('test-db') ||
  process.env.USE_TEST_DATABASE === 'true'

if (!isTestDb) {
  console.error('❌ FATAL: Tests must NOT run against production database.')
  console.error('   The test setup TRUNCATES all tables after the run.')
  console.error('   DATABASE_URL must point to a dedicated test DB (e.g. URL contains "test" or use a separate test DB).')
  console.error('   Current DATABASE_URL host:', databaseUrl.replace(/:[^:@]+@/, ':****@').split('?')[0])
  process.exit(1)
}

console.log('🧪 Test Environment Check:')
console.log('  - NODE_ENV:', process.env.NODE_ENV)
console.log('  - Database: ✅ TEST DB (safe to run)')

// Run ONCE before all tests
beforeAll(async () => {
  console.log('\n🗄️  Setting up test database...')
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  const backupUrl = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL
  try {
    console.log('  - Applying main migrations...')
    execSync('npx prisma migrate deploy', { env, stdio: 'inherit' })
    if (backupUrl) {
      console.log('  - Applying backup DB migrations...')
      execSync('npx prisma migrate deploy --schema=prisma-backup/schema.prisma', {
        env: { ...env, BACKUP_DATABASE_URL: backupUrl },
        stdio: 'inherit'
      })
    }
    console.log('✅ Test database ready\n')
  } catch (error) {
    console.error('❌ Failed to setup test database:', error)
    process.exit(1)
  }
}, 60000) // 60 second timeout for migrations

// Run ONCE after all tests
afterAll(async () => {
  console.log('\n🧹 Cleaning up test database...')
  
  try {
    // Truncate all tables (faster than deleting)
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "ProductionTracker",
        "Invoice",
        "InvoiceItem",
        "InvoiceItemDetail",
        "InvoiceRemark",
        "InvoiceSignature",
        "Quotation",
        "QuotationItem",
        "QuotationItemDetail",
        "QuotationRemark",
        "QuotationSignature",
        "QuotationTemplateItemDetail",
        "QuotationTemplateItem",
        "QuotationTemplate",
        "ParagonTicket",
        "ParagonTicketItem",
        "ParagonTicketItemDetail",
        "ParagonTicketRemark",
        "ErhaTicket",
        "ErhaTicketItem",
        "ErhaTicketItemDetail",
        "ErhaTicketRemark",
        "GearExpense",
        "BigExpense",
        "Company",
        "Billing",
        "Signature",
        "Product",
        "ProductDetail"
      CASCADE
    `)
    
    console.log('✅ Test database cleaned')
  } catch (error) {
    console.error('⚠️  Failed to clean test database:', error)
    // Don't fail the test run if cleanup fails
  } finally {
    await prisma.$disconnect()
    console.log('👋 Disconnected from test database\n')
  }
}, 30000) // 30 second timeout for cleanup
