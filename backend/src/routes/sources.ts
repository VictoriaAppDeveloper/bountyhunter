import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { sourceStatus } from '../db/schema.js'

export async function sourcesRoutes(app: FastifyInstance) {
  app.get('/api/sources', async () => {
    return db.select().from(sourceStatus).all()
  })
}
