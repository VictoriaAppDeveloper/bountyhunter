import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { NormalizedProgram } from '../adapters/types.js'
import { db } from '../db/client.js'
import { changeEvents, programs } from '../db/schema.js'
import { applyPoll } from './engine.js'

function program(overrides: Partial<NormalizedProgram> = {}): NormalizedProgram {
  return {
    platform: 'immunefi',
    externalId: 'acme',
    name: 'Acme Protocol',
    url: 'https://immunefi.com/bug-bounty/acme/',
    repositoryUrl: null,
    category: 'security-bounty',
    rewardMin: 1000,
    rewardMax: 50000,
    rewardCurrency: 'USD',
    rewardRaw: '$50,000',
    chains: ['ethereum'],
    status: 'active',
    kycRequired: false,
    description: 'A protocol.',
    programOverview: null,
    rewardsBody: null,
    prohibitedActivities: null,
    feasibilityLimitations: null,
    documentation: null,
    taskTags: [],
    scope: [],
    impacts: [],
    ...overrides,
  }
}

beforeEach(() => {
  db.delete(changeEvents).run()
  db.delete(programs).run()
})

describe('applyPoll', () => {
  it('inserts a program never seen before and records a "new" event', () => {
    const [change] = applyPoll('immunefi', [program()])

    expect(change).toBeDefined()
    expect(change!.type).toBe('new')
    expect(change!.program.externalId).toBe('acme')

    const events = db.select().from(changeEvents).all()
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('new')
  })

  it('touches lastSeenAt but records no event when nothing changed', () => {
    applyPoll('immunefi', [program()])
    const firstRow = db.select().from(programs).where(eq(programs.externalId, 'acme')).get()!

    const changes = applyPoll('immunefi', [program()])

    expect(changes).toHaveLength(0)
    expect(db.select().from(changeEvents).all()).toHaveLength(1) // still just the original "new"
    const secondRow = db.select().from(programs).where(eq(programs.externalId, 'acme')).get()!
    expect(secondRow.lastSeenAt.getTime()).toBeGreaterThanOrEqual(firstRow.lastSeenAt.getTime())
  })

  it('records a reward_changed event when only the reward moves', () => {
    applyPoll('immunefi', [program()])
    const changes = applyPoll('immunefi', [program({ rewardMax: 75000 })])

    expect(changes).toHaveLength(1)
    expect(changes[0]!.type).toBe('reward_changed')
    expect(changes[0]!.program.rewardMax).toBe(75000)
  })

  it('records a closed event (not status_changed) when status flips to closed', () => {
    applyPoll('immunefi', [program({ status: 'active' })])
    const changes = applyPoll('immunefi', [program({ status: 'closed' })])

    expect(changes).toHaveLength(1)
    expect(changes[0]!.type).toBe('closed')
    expect(changes[0]!.program.status).toBe('closed')
  })

  it('records status_changed for a non-closed status transition', () => {
    applyPoll('immunefi', [program({ status: 'active' })])
    const changes = applyPoll('immunefi', [program({ status: 'paused' })])

    expect(changes).toHaveLength(1)
    expect(changes[0]!.type).toBe('status_changed')
  })

  it('marks a program closed when it drops out of a non-empty poll result, without touching other platforms', () => {
    applyPoll('immunefi', [program({ externalId: 'acme' })])
    applyPoll('code4rena', [program({ platform: 'code4rena', externalId: 'other-platform-contest' })])

    const changes = applyPoll('immunefi', []) // acme no longer present in a real (non-empty) fetch would trigger this;
    // an empty array means "fetch failed", so simulate the real "disappeared" case with a different program present instead
    expect(changes).toHaveLength(0) // empty fetch = don't touch anything, per applyPoll's own contract

    const stillActive = db.select().from(programs).where(eq(programs.externalId, 'acme')).get()!
    expect(stillActive.status).toBe('active')

    const afterRealDisappearance = applyPoll('immunefi', [program({ externalId: 'someone-else' })])
    const closedEvent = afterRealDisappearance.find((c) => c.program.externalId === 'acme')
    expect(closedEvent?.type).toBe('closed')

    const otherPlatformRow = db.select().from(programs).where(eq(programs.externalId, 'other-platform-contest')).get()!
    expect(otherPlatformRow.status).toBe('active') // untouched by the immunefi-only poll above
  })

  it('does not re-close an already-closed program on subsequent polls', () => {
    applyPoll('immunefi', [program({ status: 'closed' })])
    const changes = applyPoll('immunefi', [program({ externalId: 'someone-else' })])
    expect(changes.find((c) => c.program.externalId === 'acme')).toBeUndefined()
  })
})
