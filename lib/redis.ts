import Redis from 'ioredis'

/**
 * Redis Client Singleton
 * 
 * Usage:
 * - Caches dashboard data for faster load times
 * - Reduces database queries
 * - Auto-expires cached data
 * 
 * Environment Variables:
 * - REDIS_URL: Full Redis connection URL (Railway provides this)
 * - If not set, Redis is disabled (graceful fallback)
 */

let redis: Redis | null = null

// Initialize Redis only if REDIS_URL is provided
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      lazyConnect: true, // Don't connect immediately
    })

    // Connect and handle errors
    redis.connect().catch((err) => {
      console.warn('Redis connection failed, caching disabled:', err.message)
      redis = null
    })

    redis.on('error', (err) => {
      console.warn('Redis error:', err.message)
    })

    redis.on('ready', () => {
      console.log('✅ Redis connected and ready')
    })
  } catch (error) {
    console.warn('Redis initialization failed, caching disabled:', error)
    redis = null
  }
}

/**
 * Cache Helper Functions
 */

export const cache = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null
    
    try {
      const data = await redis.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.warn(`Redis get error for key ${key}:`, error)
      return null
    }
  },

  /**
   * Set cached value with TTL (Time To Live)
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (default: 5 minutes)
   */
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    if (!redis) return
    
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.warn(`Redis set error for key ${key}:`, error)
    }
  },

  /**
   * Delete cached value(s)
   * Supports wildcards: "invoice:*" deletes all invoice keys
   */
  async delete(pattern: string): Promise<void> {
    if (!redis) return
    
    try {
      if (pattern.includes('*')) {
        // Delete by pattern (wildcard)
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      } else {
        // Delete single key
        await redis.del(pattern)
      }
    } catch (error) {
      console.warn(`Redis delete error for pattern ${pattern}:`, error)
    }
  },

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    if (!redis) return
    
    try {
      await redis.flushall()
    } catch (error) {
      console.warn('Redis flush error:', error)
    }
  },

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return redis?.status === 'ready'
  }
}

/**
 * Cache key generators for consistent naming
 */
export const cacheKeys = {
  dashboardStats: () => 'dashboard:stats',
  invoiceList: (status?: string, page?: number) => 
    `invoice:list:${status || 'all'}:${page || 1}`,
  quotationList: (status?: string, page?: number) => 
    `quotation:list:${status || 'all'}:${page || 1}`,
  productList: () => 'product:list',
  trackerList: (page?: number) => `tracker:list:${page || 1}`,
  
  // Detail caches
  invoice: (id: string) => `invoice:${id}`,
  quotation: (id: string) => `quotation:${id}`,
  tracker: (id: string) => `tracker:${id}`,
}

export default redis
