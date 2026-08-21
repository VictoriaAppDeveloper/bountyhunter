import type { WebSocket } from 'ws'

// Each open connection holds a live socket for as long as the client stays
// subscribed -- with no cap, a slow client farm (or one client opening many
// tabs) could grow this without bound and exhaust memory/sockets.
const MAX_CLIENTS = 1000

let nextId = 1
const clients = new Map<number, WebSocket>()

export function addClient(socket: WebSocket): number | null {
  if (clients.size >= MAX_CLIENTS) return null
  const id = nextId++
  clients.set(id, socket)
  return id
}

export function removeClient(id: number) {
  clients.delete(id)
}

export function broadcast(data: unknown) {
  const payload = JSON.stringify(data)
  for (const socket of clients.values()) {
    if (socket.readyState === socket.OPEN) socket.send(payload)
  }
}
