import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Runs once per test file, before that file's own imports are evaluated --
// `db/client.ts` reads DB_PATH at import time, so this has to land first.
// Each file gets its own throwaway sqlite file (never the real dev/prod db).
process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'bountieshunter-test-')), 'test.db')

const { runMigrations } = await import('../src/db/migrate.js')
runMigrations()
