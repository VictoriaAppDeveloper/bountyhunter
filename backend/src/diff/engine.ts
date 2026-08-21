import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { changeEvents, programs } from '../db/schema.js'
import type { NormalizedProgram } from '../adapters/types.js'

export type ChangeEventType = 'new' | 'reward_changed' | 'status_changed' | 'closed' | 'other_changed'

export interface AppliedChange {
  type: ChangeEventType
  program: typeof programs.$inferSelect
}

/**
 * Diffs a fresh poll result against stored state for one platform and applies
 * inserts/updates. `fetched` must be a complete, successful snapshot for the
 * platform -- an empty array here is treated by the caller as "don't touch
 * anything", never as "everything closed" (see scheduler/poller.ts).
 */
export function applyPoll(platform: string, fetched: NormalizedProgram[]): AppliedChange[] {
  const now = new Date()
  const events: AppliedChange[] = []

  const existingRows = db.select().from(programs).where(eq(programs.platform, platform)).all()
  const existingByExternalId = new Map(existingRows.map((r) => [r.externalId, r]))
  const fetchedIds = new Set(fetched.map((p) => p.externalId))

  for (const p of fetched) {
    const existing = existingByExternalId.get(p.externalId)
    const chainsJson = JSON.stringify(p.chains)
    const taskTagsJson = JSON.stringify(p.taskTags)
    const scopeJson = JSON.stringify(p.scope)
    const impactsJson = JSON.stringify(p.impacts)
    const rawJson = p.raw !== undefined ? JSON.stringify(p.raw) : null

    if (!existing) {
      const inserted = db
        .insert(programs)
        .values({
          platform: p.platform,
          externalId: p.externalId,
          name: p.name,
          url: p.url,
          repositoryUrl: p.repositoryUrl,
          category: p.category,
          rewardMin: p.rewardMin,
          rewardMax: p.rewardMax,
          rewardCurrency: p.rewardCurrency,
          rewardRaw: p.rewardRaw,
          chains: chainsJson,
          status: p.status,
          kycRequired: p.kycRequired,
          description: p.description,
          programOverview: p.programOverview,
          rewardsBody: p.rewardsBody,
          prohibitedActivities: p.prohibitedActivities,
          feasibilityLimitations: p.feasibilityLimitations,
          documentation: p.documentation,
          taskTags: taskTagsJson,
          scope: scopeJson,
          impacts: impactsJson,
          firstSeenAt: now,
          lastSeenAt: now,
          lastChangedAt: now,
          raw: rawJson,
        })
        .returning()
        .get()

      recordEvent(inserted.id, platform, p.externalId, 'new', null, null, null)
      events.push({ type: 'new', program: inserted })
      continue
    }

    const changed: { field: string; oldValue: string | null; newValue: string | null }[] = []
    if (existing.name !== p.name) changed.push({ field: 'name', oldValue: existing.name, newValue: p.name })
    if (existing.url !== p.url) changed.push({ field: 'url', oldValue: existing.url, newValue: p.url })
    if (existing.status !== p.status) changed.push({ field: 'status', oldValue: existing.status, newValue: p.status })
    if (existing.rewardMin !== p.rewardMin)
      changed.push({ field: 'rewardMin', oldValue: numStr(existing.rewardMin), newValue: numStr(p.rewardMin) })
    if (existing.rewardMax !== p.rewardMax)
      changed.push({ field: 'rewardMax', oldValue: numStr(existing.rewardMax), newValue: numStr(p.rewardMax) })
    if (existing.rewardCurrency !== p.rewardCurrency)
      changed.push({ field: 'rewardCurrency', oldValue: existing.rewardCurrency, newValue: p.rewardCurrency })
    if (existing.chains !== chainsJson)
      changed.push({ field: 'chains', oldValue: existing.chains, newValue: chainsJson })
    if (existing.kycRequired !== p.kycRequired)
      changed.push({ field: 'kycRequired', oldValue: boolStr(existing.kycRequired), newValue: boolStr(p.kycRequired) })
    if (existing.description !== p.description)
      changed.push({ field: 'description', oldValue: existing.description, newValue: p.description })
    if (existing.taskTags !== taskTagsJson)
      changed.push({ field: 'taskTags', oldValue: existing.taskTags, newValue: taskTagsJson })
    if (existing.scope !== scopeJson) changed.push({ field: 'scope', oldValue: existing.scope, newValue: scopeJson })
    // These fields affect stored state but aren't diffed as change events --
    // rules/reference metadata, not "news" worth surfacing live. Still
    // compared so the row update below fires and stays in sync with them.
    const silentlyChanged =
      existing.impacts !== impactsJson ||
      existing.repositoryUrl !== p.repositoryUrl ||
      existing.programOverview !== p.programOverview ||
      existing.rewardsBody !== p.rewardsBody ||
      existing.prohibitedActivities !== p.prohibitedActivities ||
      existing.feasibilityLimitations !== p.feasibilityLimitations ||
      existing.documentation !== p.documentation

    if (changed.length === 0 && !silentlyChanged) {
      db.update(programs).set({ lastSeenAt: now }).where(eq(programs.id, existing.id)).run()
      continue
    }

    const updated = db
      .update(programs)
      .set({
        name: p.name,
        url: p.url,
        repositoryUrl: p.repositoryUrl,
        category: p.category,
        rewardMin: p.rewardMin,
        rewardMax: p.rewardMax,
        rewardCurrency: p.rewardCurrency,
        rewardRaw: p.rewardRaw,
        chains: chainsJson,
        status: p.status,
        kycRequired: p.kycRequired,
        description: p.description,
        programOverview: p.programOverview,
        rewardsBody: p.rewardsBody,
        prohibitedActivities: p.prohibitedActivities,
        feasibilityLimitations: p.feasibilityLimitations,
        documentation: p.documentation,
        taskTags: taskTagsJson,
        scope: scopeJson,
        impacts: impactsJson,
        lastSeenAt: now,
        lastChangedAt: now,
        raw: rawJson,
      })
      .where(eq(programs.id, existing.id))
      .returning()
      .get()

    const statusChanged = changed.some((c) => c.field === 'status')
    const rewardChanged = changed.some((c) => c.field.startsWith('reward'))
    const type: ChangeEventType = statusChanged
      ? p.status === 'closed'
        ? 'closed'
        : 'status_changed'
      : rewardChanged
        ? 'reward_changed'
        : 'other_changed'

    for (const c of changed) {
      recordEvent(updated.id, platform, p.externalId, type, c.field, c.oldValue, c.newValue)
    }
    events.push({ type, program: updated })
  }

  if (fetched.length > 0) {
    for (const existing of existingRows) {
      if (existing.status === 'closed' || fetchedIds.has(existing.externalId)) continue
      const updated = db
        .update(programs)
        .set({ status: 'closed', lastChangedAt: now, lastSeenAt: now })
        .where(eq(programs.id, existing.id))
        .returning()
        .get()
      recordEvent(updated.id, platform, existing.externalId, 'closed', 'status', existing.status, 'closed')
      events.push({ type: 'closed', program: updated })
    }
  }

  return events
}

function numStr(v: number | null): string | null {
  return v === null ? null : String(v)
}

function boolStr(v: boolean | null): string | null {
  return v === null ? null : String(v)
}

function recordEvent(
  programId: number,
  platform: string,
  externalId: string,
  type: ChangeEventType,
  field: string | null,
  oldValue: string | null,
  newValue: string | null,
) {
  db.insert(changeEvents)
    .values({ programId, platform, externalId, type, field, oldValue, newValue, createdAt: new Date() })
    .run()
}
