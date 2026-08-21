import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/client.js'
import { programs } from '../db/schema.js'
import { summarizeRoutes } from './summarize.js'

vi.mock('../util/summarize.js', () => ({
  summarizeProgram: vi.fn().mockResolvedValue('a short summary'),
}))

function buildApp() {
  const app = Fastify()
  app.register(summarizeRoutes)
  return app
}

function seed() {
  const now = new Date()
  return db
    .insert(programs)
    .values({
      platform: 'immunefi',
      externalId: `p-${Math.random()}`,
      name: 'Test Program',
      url: 'https://example.com',
      category: 'security-bounty',
      status: 'active',
      firstSeenAt: now,
      lastSeenAt: now,
      lastChangedAt: now,
    })
    .returning()
    .get()
}

beforeEach(() => {
  db.delete(programs).run()
  process.env.DEEPSEEK_API_KEY = 'test-key'
})

describe('POST /api/programs/:id/summarize daily budget', () => {
  // SUMMARIZE_DAILY_LIMIT is set to 3 for tests in tests/setup.ts. One test,
  // not several, because the budget counter is module-level state shared
  // across every call in this file's process -- splitting this into
  // independent `it()`s would mean the first to run silently eats the
  // budget the others expect to have.
  it('caps real DeepSeek calls at the daily limit, but never charges a cache hit against it', async () => {
    const app = buildApp()

    const cached = seed()
    const first = await app.inject({ method: 'POST', url: `/api/programs/${cached.id}/summarize`, payload: {} })
    expect(first.statusCode).toBe(200) // real call, 1 of 3 slots used

    const second = await app.inject({ method: 'POST', url: `/api/programs/${cached.id}/summarize`, payload: {} })
    expect(second.statusCode).toBe(200) // same program, nothing changed -> served from the persisted cache, free

    for (let i = 0; i < 2; i++) {
      const row = seed()
      const res = await app.inject({ method: 'POST', url: `/api/programs/${row.id}/summarize`, payload: {} })
      expect(res.statusCode).toBe(200) // 2 more real calls -> 3 of 3 slots used
    }

    const overBudget = seed()
    const res = await app.inject({ method: 'POST', url: `/api/programs/${overBudget.id}/summarize`, payload: {} })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toMatch(/budget/i)
  })
})
