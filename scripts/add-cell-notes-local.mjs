#!/usr/bin/env node
/**
 * Add cellNotes column to the DB used in development (DATABASE_URL_LOCAL).
 * Use this when you see "The column `cellNotes` does not exist" while running npm run dev.
 *
 * Usage: node scripts/add-cell-notes-local.mjs
 *    or: npm run db:add-cell-notes-local
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return {}
  const content = readFileSync(path, 'utf8')
  const env = { ...process.env }
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const value = m[2].replace(/^["']|["']$/g, '').trim()
    env[m[1]] = value
  }
  return env
}

const env = loadEnv()
const localUrl = env.DATABASE_URL_LOCAL

if (!localUrl) {
  console.error('DATABASE_URL_LOCAL is required in .env (this is the DB used when you run npm run dev).')
  process.exit(1)
}

console.log('Adding cellNotes column to DATABASE_URL_LOCAL...')
try {
  execSync('npx prisma db execute --file prisma/add_cell_notes.sql', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: localUrl, DIRECT_URL: localUrl }
  })
  console.log('Done. You can create tracker rows again.')
} catch (e) {
  console.error('Failed.')
  process.exit(1)
}
