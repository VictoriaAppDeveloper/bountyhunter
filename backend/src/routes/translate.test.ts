import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { translateRoutes } from './translate.js'

// Only exercises the validation paths that reject before ever calling the
// upstream Google endpoint -- no network mocking needed, and these are
// exactly the checks added to close off a fan-out/abuse vector.
function buildApp() {
  const app = Fastify()
  app.register(translateRoutes)
  return app
}

describe('POST /api/translate validation', () => {
  it('rejects a missing/empty texts array', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/translate', payload: { texts: [] } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a non-array texts field', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/translate', payload: { texts: 'not an array' } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an array containing a non-string item', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/translate', payload: { texts: ['ok', 42] } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a batch larger than the cap', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/translate',
      payload: { texts: Array.from({ length: 201 }, (_, i) => `text-${i}`) },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/at most 200/)
  })
})
