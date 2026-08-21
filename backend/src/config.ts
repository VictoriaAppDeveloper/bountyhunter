import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.join(__dirname, '..')

export const config = {
  port: Number(process.env.PORT ?? 3001),
  dbPath: process.env.DB_PATH ?? path.join(backendRoot, 'data/bounties.db'),
  migrationsFolder: path.join(backendRoot, 'drizzle'),
  userAgent: 'bountieshunter/0.1 (+https://github.com/; contact: repo owner)',
}
