import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Runs once per test file, before that file's own imports are evaluated --
// `db/client.ts` reads DB_PATH at import time, so this has to land first.
// Each file gets its own throwaway sqlite file (never the real dev/prod db).
process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'bountyhunter-test-')), 'test.db')

// Small on purpose -- summarize.test.ts exercises the daily-budget cutoff
// without looping dozens of times. Read once at that module's import time,
// same as DB_PATH above, so it has to be set before anything imports it.
process.env.SUMMARIZE_DAILY_LIMIT = '3'

const { runMigrations } = await import('../src/db/migrate.js')
runMigrations()
