import type { WebSocket } from 'ws'
import { describe, expect, it } from 'vitest'
import { addClient, broadcast, removeClient } from './ws.js'

function fakeSocket(onSend?: (payload: string) => void, readyState = 1 /* OPEN */): WebSocket {
  return {
    readyState,
    OPEN: 1,
    send: (payload: string) => onSend?.(payload),
  } as unknown as WebSocket
}

describe('WS client registry', () => {
  it('assigns increasing ids and delivers broadcasts to registered clients', () => {
    const received: string[] = []
    const id = addClient(fakeSocket((payload) => received.push(payload)))
    expect(id).not.toBeNull()

    broadcast({ hello: 'world' })

    expect(received).toHaveLength(1)
    expect(JSON.parse(received[0]!)).toEqual({ hello: 'world' })

    removeClient(id!)
  })

  it('skips a socket that is not open', () => {
    const received: string[] = []
    const socket = fakeSocket((payload) => received.push(payload), 2 /* CLOSING */)
    const id = addClient(socket)

    broadcast({})

    expect(received).toHaveLength(0)
    removeClient(id!)
  })

  it('stops delivering to a client after it is removed', () => {
    const received: string[] = []
    const id = addClient(fakeSocket((payload) => received.push(payload)))
    removeClient(id!)

    broadcast({})

    expect(received).toHaveLength(0)
  })

  it('refuses new connections once at capacity, and accepts again once a slot frees up', () => {
    const ids: number[] = []
    // Fill to the connection cap (1000) -- cheap, just Map insertions.
    for (let i = 0; i < 1000; i++) {
      const id = addClient(fakeSocket())
      expect(id).not.toBeNull()
      ids.push(id!)
    }

    expect(addClient(fakeSocket())).toBeNull()

    removeClient(ids[0]!)
    const freedSlotId = addClient(fakeSocket())
    expect(freedSlotId).not.toBeNull()

    // Clean up so this doesn't bleed into other tests in this file.
    for (const id of ids.slice(1)) removeClient(id)
    removeClient(freedSlotId!)
  })
})
