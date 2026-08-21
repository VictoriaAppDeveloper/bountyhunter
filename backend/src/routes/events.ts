import type { FastifyInstance } from 'fastify'
import { addClient, removeClient } from '../realtime/ws.js'

const HEARTBEAT_MS = 25_000

export async function eventsRoutes(app: FastifyInstance) {
  app.get('/api/events', { websocket: true }, (socket) => {
    const id = addClient(socket)
    if (id === null) {
      // 1013 ("Try Again Later") is the standard WS close code for a
      // server-side capacity refusal -- the client's own reconnect-with-
      // backoff (see frontend/src/api/stream.ts) handles the retry.
      socket.close(1013, 'over capacity')
      return
    }

    // Proxies (and browsers) can drop a WS connection that goes quiet for
    // too long -- a periodic ping keeps it alive between real broadcasts.
    const heartbeat = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping()
    }, HEARTBEAT_MS)

    socket.on('close', () => {
      clearInterval(heartbeat)
      removeClient(id)
    })
  })
}
