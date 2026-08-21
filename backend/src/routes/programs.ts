import { and, eq, gte, lte, ne } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { programs } from '../db/schema.js'

export async function programsRoutes(app: FastifyInstance) {
  app.get('/api/programs', async (req) => {
    const q = req.query as Record<string, string | undefined>
    const conditions = []
    if (q.platform) conditions.push(eq(programs.platform, q.platform))
    if (q.category) conditions.push(eq(programs.category, q.category))
    // Closed programs are excluded from the default listing -- pass
    // ?status=closed explicitly to see them.
    if (q.status) conditions.push(eq(programs.status, q.status))
    else conditions.push(ne(programs.status, 'closed'))
    if (q.minReward) conditions.push(gte(programs.rewardMax, Number(q.minReward)))
    if (q.maxReward) conditions.push(lte(programs.rewardMax, Number(q.maxReward)))
    if (q.kyc === 'true') conditions.push(eq(programs.kycRequired, true))
    if (q.kyc === 'false') conditions.push(eq(programs.kycRequired, false))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const rows = whereClause ? db.select().from(programs).where(whereClause).all() : db.select().from(programs).all()

    const filtered = q.chain ? rows.filter((r) => (JSON.parse(r.chains) as string[]).includes(q.chain as string)) : rows
    return filtered.map(serialize)
  })

  app.get('/api/programs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const row = db
      .select()
      .from(programs)
      .where(eq(programs.id, Number(id)))
      .get()
    if (!row) return reply.code(404).send({ error: 'not found' })
    return serialize(row)
  })
}

function serialize(row: typeof programs.$inferSelect) {
  return {
    id: row.id,
    platform: row.platform,
    externalId: row.externalId,
    name: row.name,
    url: row.url,
    repositoryUrl: row.repositoryUrl,
    category: row.category,
    rewardMin: row.rewardMin,
    rewardMax: row.rewardMax,
    rewardCurrency: row.rewardCurrency,
    rewardRaw: row.rewardRaw,
    chains: JSON.parse(row.chains) as string[],
    status: row.status,
    kycRequired: row.kycRequired,
    description: row.description,
    programOverview: row.programOverview,
    rewardsBody: row.rewardsBody,
    prohibitedActivities: row.prohibitedActivities,
    feasibilityLimitations: row.feasibilityLimitations,
    documentation: row.documentation,
    summary: row.summary,
    summaryLocale: row.summaryLocale,
    taskTags: JSON.parse(row.taskTags) as string[],
    scope: JSON.parse(row.scope) as { url: string; type: string; description: string | null }[],
    impacts: JSON.parse(row.impacts) as { severity: string; title: string }[],
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    lastChangedAt: row.lastChangedAt,
  }
}
