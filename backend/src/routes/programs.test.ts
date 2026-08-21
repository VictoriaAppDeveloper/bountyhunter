import Fastify from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/client.js'
import { programs } from '../db/schema.js'
import { programsRoutes } from './programs.js'

function buildApp() {
  const app = Fastify()
  app.register(programsRoutes)
  return app
}

function seed(overrides: Partial<typeof programs.$inferInsert> = {}) {
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
      ...overrides,
    })
    .returning()
    .get()
}

beforeEach(() => {
  db.delete(programs).run()
})

describe('GET /api/programs', () => {
  it('excludes closed programs by default', async () => {
    seed({ status: 'active', name: 'Active One' })
    seed({ status: 'closed', name: 'Closed One' })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/programs' })
    const body = res.json() as { name: string; status: string }[]

    expect(body).toHaveLength(1)
    expect(body[0]!.status).toBe('active')
  })

  it('returns closed programs when status=closed is passed explicitly', async () => {
    seed({ status: 'active' })
    seed({ status: 'closed' })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/programs?status=closed' })
    const body = res.json() as { status: string }[]

    expect(body).toHaveLength(1)
    expect(body[0]!.status).toBe('closed')
  })

  it('filters by platform', async () => {
    seed({ platform: 'immunefi' })
    seed({ platform: 'code4rena' })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/programs?platform=code4rena' })
    const body = res.json() as { platform: string }[]

    expect(body).toHaveLength(1)
    expect(body[0]!.platform).toBe('code4rena')
  })
})

describe('GET /api/programs/:id', () => {
  it('returns 404 for a missing program', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/programs/999999' })
    expect(res.statusCode).toBe(404)
  })

  it('returns the serialized program for a valid id', async () => {
    const row = seed({ name: 'Findable' })
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: `/api/programs/${row.id}` })

    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Findable')
  })
})
