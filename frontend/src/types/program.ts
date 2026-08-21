export type ProgramCategory = 'security-bounty' | 'audit-contest' | 'grant-bounty' | 'quest'
export type ProgramStatus = 'active' | 'upcoming' | 'closed' | 'paused'
export type ChangeEventType = 'new' | 'reward_changed' | 'status_changed' | 'closed' | 'other_changed'

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

export interface Program {
  id: number
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
  summary: string | null
  summaryLocale: string | null
  taskTags: string[]
  scope: ScopeAsset[]
  impacts: ImpactTag[]
  firstSeenAt: string
  lastSeenAt: string
  lastChangedAt: string
}

export interface ChangeEvent {
  id: number
  programId: number
  platform: string
  externalId: string
  type: ChangeEventType
  field: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface SourceStatusRow {
  platform: string
  lastPolledAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  lastProgramCount: number | null
  pollIntervalMs: number
}

export interface ProgramChangeEvent {
  type: ChangeEventType
  program: Program
}
