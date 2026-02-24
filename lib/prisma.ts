import { PrismaClient } from '@prisma/client'
import { createSlowQueryMiddleware } from './slow-query-logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Never use production DB in local dev or tests. Fail fast if second DB is not configured.
function getDatabaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required in production.')
    return url
  }
  if (process.env.NODE_ENV === 'development') {
    const url = process.env.DATABASE_URL_LOCAL
    if (!url) {
      throw new Error(
        'DATABASE_URL_LOCAL is required in development. Set it in .env to your second/local DB URL so production is never used.'
      )
    }
    return url
  }
  // test: DATABASE_URL from .env (same as local dev when running tests)
  const url = process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL or DATABASE_URL_LOCAL is required for tests.')
  return url
}

const databaseUrl = getDatabaseUrl()

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  // Optimized connection pooling for Railway Hobby plan
  // Railway Hobby can handle ~95 connections, but we limit to be safe
  // Formula: (serverless_functions * connection_limit) should be < 95
  // For Railway: 5 instances * 10 connections = 50 connections max
  // Leaves headroom for direct connections, migrations, etc.
})

// Query optimization middleware - tracks slow queries
prisma.$use(createSlowQueryMiddleware(1000)) // Log queries over 1 second

// Additional performance monitoring middleware
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  
  // Log slow queries in development (> 1000ms)
  if (process.env.NODE_ENV === 'development' && (after - before) > 1000) {
    console.warn(`⚠️ Slow Query: ${params.model}.${params.action} took ${after - before}ms`)
  }
  
  return result
})

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown for production
if (process.env.NODE_ENV === 'production') {
  globalForPrisma.prisma = prisma
  
  // Handle graceful shutdown
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
  
  // Handle termination signals
  process.on('SIGINT', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

