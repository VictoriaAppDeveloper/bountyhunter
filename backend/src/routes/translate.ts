import type { FastifyInstance } from 'fastify'
import { translateBatch } from '../util/translate.js'

interface TranslateBody {
  texts?: unknown
  target?: string
}

// Caps how much upstream fan-out a single request can trigger -- translateBatch
// chunks into groups of 50, so an unbounded array could still turn one request
// into hundreds of calls to the (unauthenticated, unofficial) Google endpoint
// before the per-route rate limit below even sees a second request.
const MAX_TEXTS = 200

export async function translateRoutes(app: FastifyInstance) {
  app.post(
    '/api/translate',
    // The unofficial Google endpoint has no real rate limit of its own -- cap
    // how often the frontend can hit ours instead of trying to cancel
    // in-flight work (the frontend is responsible for not firing duplicate
    // requests in the first place; see useAutoTranslate.ts).
    { config: { rateLimit: { max: 20, timeWindow: '10 seconds' } } },
    async (req, reply) => {
      const { texts, target = 'ru' } = (req.body ?? {}) as TranslateBody
      // A stray empty string in the batch (e.g. an untitled scope entry) is
      // tolerated, not rejected -- translateBatch passes those through
      // unchanged. Only reject genuinely malformed input.
      if (!Array.isArray(texts) || texts.length === 0 || texts.some((t) => typeof t !== 'string')) {
        return reply.code(400).send({ error: 'texts must be a non-empty array of strings' })
      }
      if (texts.length > MAX_TEXTS) {
        return reply.code(400).send({ error: `texts must contain at most ${MAX_TEXTS} items` })
      }

      try {
        const translations = await translateBatch(texts as string[], target)
        return { translations }
      } catch (err) {
        // translateBatch itself no longer throws for per-item upstream
        // failures (those fall back to the original text -- see
        // util/translate.ts); reaching here means something unexpected.
        // Full detail (which may include upstream response bodies) goes to
        // the server log only -- the client gets a generic message.
        const message = err instanceof Error ? err.message : String(err)
        app.log.error({ err }, `[translate] request failed: ${message}`)
        return reply.code(502).send({ error: 'translation failed' })
      }
    },
  )
}
