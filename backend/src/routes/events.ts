import type { FastifyInstance } from 'fastify'
import { addClient, removeClient } from '../realtime/sse.js'

export async function eventsRoutes(app: FastifyInstance) {
  app.get('/api/events', (req, reply) => {
    reply.hijack()

    const id = addClient(reply)
    if (id === null) {
      reply.raw.writeHead(503, { 'Retry-After': '30' })
      reply.raw.end()
      return
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    reply.raw.write(': connected\n\n')

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n')
    }, 25_000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      removeClient(id)
    })
  })
}
