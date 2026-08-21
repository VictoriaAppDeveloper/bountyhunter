import type { FastifyReply } from 'fastify'
import { describe, expect, it } from 'vitest'
import { addClient, broadcast, removeClient } from './sse.js'

function fakeReply(onWrite?: (chunk: string) => void): FastifyReply {
  return { raw: { write: (chunk: string) => onWrite?.(chunk) } } as unknown as FastifyReply
}

describe('SSE client registry', () => {
  it('assigns increasing ids and delivers broadcasts to registered clients', () => {
    const received: string[] = []
    const id = addClient(fakeReply((chunk) => received.push(chunk)))
    expect(id).not.toBeNull()

    broadcast('program-change', { hello: 'world' })

    expect(received).toHaveLength(1)
    expect(received[0]).toContain('event: program-change')
    expect(received[0]).toContain('"hello":"world"')

    removeClient(id!)
  })

  it('stops delivering to a client after it is removed', () => {
    const received: string[] = []
    const id = addClient(fakeReply((chunk) => received.push(chunk)))
    removeClient(id!)

    broadcast('program-change', {})

    expect(received).toHaveLength(0)
  })

  it('refuses new connections once at capacity, and accepts again once a slot frees up', () => {
    const ids: number[] = []
    // Fill to the connection cap (1000) -- cheap, just Map insertions.
    for (let i = 0; i < 1000; i++) {
      const id = addClient(fakeReply())
      expect(id).not.toBeNull()
      ids.push(id!)
    }

    expect(addClient(fakeReply())).toBeNull()

    removeClient(ids[0]!)
    const freedSlotId = addClient(fakeReply())
    expect(freedSlotId).not.toBeNull()

    // Clean up so this doesn't bleed into other tests in this file.
    for (const id of ids.slice(1)) removeClient(id)
    removeClient(freedSlotId!)
  })
})
