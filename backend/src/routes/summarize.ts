import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { programs } from '../db/schema.js'
import { summarizeProgram } from '../util/summarize.js'

interface SummarizeBody {
  locale?: string
}

export async function summarizeRoutes(app: FastifyInstance) {
  app.post(
    '/api/programs/:id/summarize',
    // DeepSeek calls cost real money -- keep this tighter than /api/translate.
    { config: { rateLimit: { max: 10, timeWindow: '10 seconds' } } },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const { locale = 'en' } = (req.body ?? {}) as SummarizeBody

      const row = db
        .select()
        .from(programs)
        .where(eq(programs.id, Number(id)))
        .get()
      if (!row) return reply.code(404).send({ error: 'not found' })

      // Persisted in the programs row (not an in-memory cache) so it survives
      // backend restarts and a page reload doesn't lose it. Only considered
      // fresh if generated for the program's *current* lastChangedAt and
      // locale -- a real data change (reward, status, etc.) invalidates it.
      const isFresh =
        row.summary !== null &&
        row.summaryLocale === locale &&
        row.summaryForChangeAt?.getTime() === row.lastChangedAt.getTime()
      if (isFresh) return { summary: row.summary }

      if (!process.env.DEEPSEEK_API_KEY) {
        return reply.code(503).send({ error: 'DEEPSEEK_API_KEY is not configured on the backend' })
      }

      try {
        const summary = await summarizeProgram(
          {
            name: row.name,
            platform: row.platform,
            category: row.category,
            status: row.status,
            rewardMin: row.rewardMin,
            rewardMax: row.rewardMax,
            rewardCurrency: row.rewardCurrency,
            kycRequired: row.kycRequired,
            chains: JSON.parse(row.chains) as string[],
            taskTags: JSON.parse(row.taskTags) as string[],
            description: row.description,
            programOverview: row.programOverview,
            rewardsBody: row.rewardsBody,
            prohibitedActivities: row.prohibitedActivities,
            feasibilityLimitations: row.feasibilityLimitations,
            impacts: JSON.parse(row.impacts) as { severity: string; title: string }[],
            scopeCount: (JSON.parse(row.scope) as unknown[]).length,
            scopeTypes: [...new Set((JSON.parse(row.scope) as { type: string }[]).map((s) => s.type))],
          },
          locale,
        )
        db.update(programs)
          .set({ summary, summaryLocale: locale, summaryForChangeAt: row.lastChangedAt })
          .where(eq(programs.id, row.id))
          .run()
        return { summary }
      } catch (err) {
        // Full detail (may include upstream response bodies) goes to the
        // server log only -- the client gets a generic message.
        const message = err instanceof Error ? err.message : String(err)
        app.log.error({ err }, `[summarize] request failed: ${message}`)
        return reply.code(502).send({ error: 'summarize failed' })
      }
    },
  )
}
