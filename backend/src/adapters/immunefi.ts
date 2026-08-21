import { fetchJson } from '../util/http.js'
import type { ImpactTag, NormalizedProgram, ScopeAsset, SourceAdapter } from './types.js'

const FEED_URL =
  'https://raw.githubusercontent.com/infosec-us-team/Immunefi-Bug-Bounty-Programs-Unofficial/main/projects.json'

// Field names confirmed by fetching the live feed directly (2026-08-19).
// Note: this is an unofficial, community-maintained mirror of Immunefi's internal
// data, not an Immunefi API — field names could change without notice upstream.
interface ImmunefiRewardTier {
  severity: string
  minReward: number | null
  maxReward: number | null
}

interface ImmunefiAsset {
  url: string
  type: string
  description: string | null
}

interface ImmunefiImpact {
  type: string
  severity: string
  title: string
}

interface ImmunefiProject {
  slug: string
  project: string
  websiteUrl: string | null
  githubUrl: string | null
  maxBounty: number | null
  ecosystem: string[] | null
  isPaused: boolean
  rewards: ImmunefiRewardTier[] | null
  kyc: boolean | null
  description: string | null
  programOverview: string | null
  rewardsBody: string | null
  defaultProhibitedActivities: string | null
  customProhibitedActivities: string[] | null
  defaultFeasibilityLimitations: string | null
  assetsBodyV2: string | null
  programType: string[] | null
  productType: string[] | null
  projectType: string[] | null
  assets: ImmunefiAsset[] | null
  impacts: ImmunefiImpact[] | null
}

export const immunefiAdapter: SourceAdapter = {
  platform: 'immunefi',
  pollIntervalMs: 3 * 60 * 1000,

  async poll(): Promise<NormalizedProgram[]> {
    const projects = await fetchJson<ImmunefiProject[]>(FEED_URL, 30_000)
    return projects.filter((p) => p.slug && p.project).map(normalize)
  },
}

function normalize(p: ImmunefiProject): NormalizedProgram {
  const minRewards = (p.rewards ?? []).map((r) => r.minReward).filter((v): v is number => typeof v === 'number')
  const rewardMin = minRewards.length > 0 ? Math.min(...minRewards) : null
  const rewardMax = typeof p.maxBounty === 'number' ? p.maxBounty : null

  return {
    platform: 'immunefi',
    externalId: p.slug,
    name: p.project,
    url: `https://immunefi.com/bug-bounty/${p.slug}/`,
    repositoryUrl: p.githubUrl?.trim() || null,
    category: 'security-bounty',
    rewardMin,
    rewardMax,
    rewardCurrency: rewardMax !== null || rewardMin !== null ? 'USD' : null,
    rewardRaw: rewardMax !== null ? String(rewardMax) : null,
    chains: Array.isArray(p.ecosystem) ? p.ecosystem : [],
    status: p.isPaused ? 'paused' : 'active',
    kycRequired: typeof p.kyc === 'boolean' ? p.kyc : null,
    description: (p.description ?? '').trim() || null,
    programOverview: (p.programOverview ?? '').trim() || null,
    rewardsBody: (p.rewardsBody ?? '').trim() || null,
    prohibitedActivities: joinNonEmpty([p.defaultProhibitedActivities, ...(p.customProhibitedActivities ?? [])]),
    feasibilityLimitations: (p.defaultFeasibilityLimitations ?? '').trim() || null,
    documentation: (p.assetsBodyV2 ?? '').trim() || null,
    taskTags: dedupe([...(p.programType ?? []), ...(p.productType ?? []), ...(p.projectType ?? [])]),
    scope: (p.assets ?? []).map((a): ScopeAsset => ({
      url: a.url,
      type: a.type,
      description: a.description?.trim() || null,
    })),
    impacts: (p.impacts ?? []).map((i): ImpactTag => ({ severity: i.severity, title: i.title })),
    raw: p,
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)]
}

function joinNonEmpty(parts: (string | null | undefined)[]): string | null {
  const cleaned = parts.map((p) => p?.trim()).filter((p): p is string => !!p)
  return cleaned.length > 0 ? cleaned.join('\n\n') : null
}
