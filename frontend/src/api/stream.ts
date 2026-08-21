import type { ProgramChangeEvent } from '@/types/program'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30_000

/**
 * Subscribes to the backend's live change feed over a WebSocket.
 * `onReconnect` fires once a dropped connection re-opens -- callers should
 * re-fetch the full list as a safety net against events missed while
 * disconnected. Unlike EventSource, WebSocket has no built-in retry, so this
 * reconnects itself with a capped exponential backoff.
 */
export function subscribeToProgramChanges(
  onChange: (event: ProgramChangeEvent) => void,
  onReconnect: () => void,
): () => void {
  let hasConnectedBefore = false
  let closedByCaller = false
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    socket = new WebSocket(`${protocol}//${location.host}/api/events`)

    socket.addEventListener('open', () => {
      attempt = 0
      if (hasConnectedBefore) onReconnect()
      hasConnectedBefore = true
    })

    socket.addEventListener('message', (event) => {
      onChange(JSON.parse(event.data as string) as ProgramChangeEvent)
    })

    // A dropped connection (network blip, proxy timeout, server restart)
    // fires 'close', not 'error' -- schedule the retry there so both a clean
    // close and a close-after-error end up in the same place.
    socket.addEventListener('close', scheduleReconnect)
  }

  function scheduleReconnect() {
    if (closedByCaller) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS)
    attempt++
    reconnectTimer = setTimeout(connect, delay)
  }

  connect()

  return () => {
    closedByCaller = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    socket?.close()
  }
}
