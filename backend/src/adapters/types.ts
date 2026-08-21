export type ProgramCategory = 'security-bounty' | 'audit-contest' | 'grant-bounty' | 'quest'
export type ProgramStatus = 'active' | 'upcoming' | 'closed' | 'paused'

// "Where" -- an in-scope target (contract, repo, endpoint) the task applies to.
export interface ScopeAsset {
  url: string
  type: string
  description: string | null
}

// "What" -- a category of finding that counts as a valid submission.
export interface ImpactTag {
  severity: string
  title: string
}

export interface NormalizedProgram {
  platform: string
  externalId: string
  name: string
  url: string
  repositoryUrl: string | null
  category: ProgramCategory
  rewardMin: number | null
  rewardMax: number | null
  rewardCurrency: string | null
  rewardRaw: string | null
  chains: string[]
  status: ProgramStatus
  kycRequired: boolean | null
  description: string | null
  programOverview: string | null
  rewardsBody: string | null
  prohibitedActivities: string | null
  feasibilityLimitations: string | null
  documentation: string | null
  taskTags: string[]
  scope: ScopeAsset[]
  impacts: ImpactTag[]
  raw?: unknown
}

export interface SourceAdapter {
  platform: string
  pollIntervalMs: number
  poll(): Promise<NormalizedProgram[]>
}
