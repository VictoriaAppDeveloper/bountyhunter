import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import { adapters } from './adapters/index.js'
import { config } from './config.js'
import { runMigrations } from './db/migrate.js'
import { eventsRoutes } from './routes/events.js'
import { healthRoutes } from './routes/health.js'
import { historyRoutes } from './routes/history.js'
import { programsRoutes } from './routes/programs.js'
import { sourcesRoutes } from './routes/sources.js'
import { summarizeRoutes } from './routes/summarize.js'
import { translateRoutes } from './routes/translate.js'
import { startPoller } from './scheduler/poller.js'

runMigrations()

// Only ever reached through the frontend's nginx container on the compose
// network (the backend port isn't published to the host), and nginx is
// configured to overwrite X-Forwarded-For with the real connecting IP
// rather than append to it (see docker/nginx.conf) -- so the header can't
// be spoofed by a client, and it's safe to trust it for rate limiting
// instead of seeing every request as coming from nginx.
const app = Fastify({ logger: true, trustProxy: true })

// This is a JSON+WebSocket API, not an HTML app (the frontend's nginx serves
// and CSPs the actual page) -- CSP/COEP/COOP here would only add noise, so
// only the headers that matter for a pure API are kept on.
await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
})

// Generous global ceiling so a single client can't hammer the cheap
// read-only routes or hold open unbounded /api/events connections; the
// tighter per-route limits below (translate, summarize) still apply on top
// of this since Fastify merges route config over the global default.
await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' })

await app.register(websocket)

await app.register(programsRoutes)
await app.register(historyRoutes)
await app.register(sourcesRoutes)
await app.register(eventsRoutes)
await app.register(healthRoutes)
await app.register(translateRoutes)
await app.register(summarizeRoutes)

startPoller(adapters)

app.listen({ port: config.port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
