import type { FastifyReply } from 'fastify'

interface Client {
  id: number
  reply: FastifyReply
}

// Each open connection holds a socket + a FastifyReply for as long as the
// client stays subscribed -- with no cap, a slow client farm (or one client
// opening many tabs) could grow this without bound and exhaust file
// descriptors/memory. `null` tells the caller the connection was refused.
const MAX_CLIENTS = 1000

let nextId = 1
const clients = new Map<number, Client>()

export function addClient(reply: FastifyReply): number | null {
  if (clients.size >= MAX_CLIENTS) return null
  const id = nextId++
  clients.set(id, { id, reply })
  return id
}

export function removeClient(id: number) {
  clients.delete(id)
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const { reply } of clients.values()) {
    reply.raw.write(payload)
  }
}
