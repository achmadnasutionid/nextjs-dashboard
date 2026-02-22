import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      // Will be overridden by .env.test when using dotenv-cli
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
