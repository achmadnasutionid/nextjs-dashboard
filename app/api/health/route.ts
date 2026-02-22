import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cache } from "@/lib/redis"

/**
 * Health Check API
 * 
 * Monitors system health for external monitoring tools (Railway, UptimeRobot, etc)
 * Returns database connection status, Redis status, and performance metrics
 */

export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    // Check database connection with a simple query
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - dbStart
    
    // Check Redis connection
    const redisStart = Date.now()
    const redisConnected = cache.isConnected()
    const redisLatency = redisConnected ? Date.now() - redisStart : null
    
    // Test Redis read/write if connected
    let redisWorking = false
    if (redisConnected) {
      try {
        const testKey = '_health_check_test_'
        const testValue = Date.now().toString()
        await cache.set(testKey, testValue, 10) // 10 second TTL
        const retrieved = await cache.get(testKey)
        redisWorking = retrieved === testValue
        await cache.delete(testKey) // Cleanup
      } catch {
        redisWorking = false
      }
    }
    
    // Get database statistics
    const [invoiceCount, quotationCount] = await Promise.all([
      prisma.invoice.count({ where: { deletedAt: null } }),
      prisma.quotation.count({ where: { deletedAt: null } }),
    ])
    
    const totalDuration = Date.now() - startTime
    
    // Determine overall health status
    const isHealthy = dbLatency < 1000 && (redisConnected ? redisWorking : true)
    
    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: {
          status: dbLatency < 1000 ? 'healthy' : 'slow',
          latency: `${dbLatency}ms`,
          connected: true,
        },
        redis: {
          status: redisConnected ? (redisWorking ? 'healthy' : 'error') : 'disconnected',
          latency: redisLatency ? `${redisLatency}ms` : 'N/A',
          connected: redisConnected,
          working: redisWorking,
        }
      },
      stats: {
        invoices: invoiceCount,
        quotations: quotationCount,
        total: invoiceCount + quotationCount,
      },
      performance: {
        responseTime: `${totalDuration}ms`,
        memory: {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        }
      }
    }
    
    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error("Health check failed:", error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'System health check failed',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      uptime: process.uptime(),
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  }
}
