import { desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { changeEvents } from '../db/schema.js'

export async function historyRoutes(app: FastifyInstance) {
  app.get('/api/programs/:id/history', async (req) => {
    const { id } = req.params as { id: string }
    return db
      .select()
      .from(changeEvents)
      .where(eq(changeEvents.programId, Number(id)))
      .orderBy(desc(changeEvents.createdAt))
      .all()
  })
}
