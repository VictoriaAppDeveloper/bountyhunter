import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sourceStatus } from '../db/schema.js'
import { applyPoll } from '../diff/engine.js'
import { broadcast } from '../realtime/ws.js'
import type { SourceAdapter } from '../adapters/types.js'

export function startPoller(adapters: SourceAdapter[]) {
  adapters.forEach((adapter, index) => {
    ensureSourceStatusRow(adapter)
    // Stagger initial polls so multiple adapters don't all hit the network at once.
    setTimeout(() => void runOnce(adapter), index * 2000)
    setInterval(() => void runOnce(adapter), adapter.pollIntervalMs)
  })
}

function ensureSourceStatusRow(adapter: SourceAdapter) {
  const existing = db.select().from(sourceStatus).where(eq(sourceStatus.platform, adapter.platform)).get()
  if (!existing) {
    db.insert(sourceStatus).values({ platform: adapter.platform, pollIntervalMs: adapter.pollIntervalMs }).run()
  }
}

async function runOnce(adapter: SourceAdapter) {
  const now = new Date()
  try {
    const fetched = await adapter.poll()
    const changes = applyPoll(adapter.platform, fetched)

    db.update(sourceStatus)
      .set({ lastPolledAt: now, lastSuccessAt: now, lastError: null, lastProgramCount: fetched.length })
      .where(eq(sourceStatus.platform, adapter.platform))
      .run()

    for (const change of changes) {
      broadcast({
        type: change.type,
        program: { ...change.program, chains: JSON.parse(change.program.chains) as string[] },
      })
    }
    if (changes.length > 0) {
      console.log(`[${adapter.platform}] poll: ${fetched.length} programs, ${changes.length} changes`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[${adapter.platform}] poll failed:`, message)
    db.update(sourceStatus)
      .set({ lastPolledAt: now, lastError: message })
      .where(eq(sourceStatus.platform, adapter.platform))
      .run()
  }
}
