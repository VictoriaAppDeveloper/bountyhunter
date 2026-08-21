import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Program } from '@/types/program'

vi.mock('@/api/client', () => ({
  fetchPrograms: vi.fn(),
}))

import { fetchPrograms } from '@/api/client'
import { useProgramsStore } from './programs'

function program(overrides: Partial<Program> = {}): Program {
  const now = new Date().toISOString()
  return {
    id: 1,
    platform: 'immunefi',
    externalId: 'acme',
    name: 'Acme',
    url: 'https://example.com',
    repositoryUrl: null,
    category: 'security-bounty',
    rewardMin: 1000,
    rewardMax: 50000,
    rewardCurrency: 'USD',
    rewardRaw: '$50,000',
    chains: ['ethereum'],
    status: 'active',
    kycRequired: false,
    description: null,
    programOverview: null,
    rewardsBody: null,
    prohibitedActivities: null,
    feasibilityLimitations: null,
    documentation: null,
    summary: null,
    summaryLocale: null,
    taskTags: [],
    scope: [],
    impacts: [],
    firstSeenAt: now,
    lastSeenAt: now,
    lastChangedAt: now,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchPrograms).mockReset()
})

describe('programs store', () => {
  it('filters by platform and reward together', async () => {
    vi.mocked(fetchPrograms).mockResolvedValue([
      program({ id: 1, platform: 'immunefi', rewardMax: 10000 }),
      program({ id: 2, platform: 'code4rena', rewardMax: 50000 }),
    ])
    const store = useProgramsStore()
    await store.fetchInitial()

    expect(store.list).toHaveLength(2)

    store.filters.platform = 'immunefi'
    expect(store.filteredList.map((p) => p.id)).toEqual([1])

    store.filters.platform = ''
    store.filters.minReward = '20000'
    expect(store.filteredList.map((p) => p.id)).toEqual([2])
  })

  it('sorts by reward descending', async () => {
    vi.mocked(fetchPrograms).mockResolvedValue([
      program({ id: 1, rewardMax: 1000 }),
      program({ id: 2, rewardMax: 90000 }),
      program({ id: 3, rewardMax: 5000 }),
    ])
    const store = useProgramsStore()
    await store.fetchInitial()

    store.filters.sort = 'rewardDesc'
    expect(store.filteredList.map((p) => p.id)).toEqual([2, 3, 1])
  })

  it('derives distinct, sorted filter option lists from the loaded programs', async () => {
    vi.mocked(fetchPrograms).mockResolvedValue([
      program({ id: 1, platform: 'immunefi', chains: ['ethereum', 'polygon'] }),
      program({ id: 2, platform: 'code4rena', chains: ['polygon'] }),
    ])
    const store = useProgramsStore()
    await store.fetchInitial()

    expect(store.platformOptions).toEqual(['code4rena', 'immunefi'])
    expect(store.chainOptions).toEqual(['ethereum', 'polygon'])
  })

  it('captures a fetch failure in `error` instead of throwing', async () => {
    vi.mocked(fetchPrograms).mockRejectedValue(new Error('network down'))
    const store = useProgramsStore()

    await store.fetchInitial()

    expect(store.error).toBe('network down')
    expect(store.loading).toBe(false)
    expect(store.list).toHaveLength(0)
  })
})
