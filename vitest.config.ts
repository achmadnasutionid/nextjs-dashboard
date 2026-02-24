import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      // Load .env via dotenv -e .env in package.json test scripts
    },
    // Run tests sequentially to avoid database conflicts
    pool: 'forks',
    maxConcurrency: 1,
    fileParallelism: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './')
    }
  }
})
