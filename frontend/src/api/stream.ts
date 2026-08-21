import type { ProgramChangeEvent } from '@/types/program'

/**
 * Subscribes to the backend's live change feed. `onReconnect` fires when the
 * EventSource re-opens after a drop -- callers should re-fetch the full list
 * as a safety net against events missed while disconnected.
 */
export function subscribeToProgramChanges(
  onChange: (event: ProgramChangeEvent) => void,
  onReconnect: () => void,
): () => void {
  let hasConnectedBefore = false
  const source = new EventSource('/api/events')

  source.addEventListener('program-change', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as ProgramChangeEvent
    onChange(data)
  })

  source.addEventListener('open', () => {
    if (hasConnectedBefore) onReconnect()
    hasConnectedBefore = true
  })

  return () => source.close()
}
