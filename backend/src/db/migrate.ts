import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { config } from '../config.js'
import { db } from './client.js'

export function runMigrations() {
  migrate(db, { migrationsFolder: config.migrationsFolder })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
  console.log('Migrations applied.')
}
