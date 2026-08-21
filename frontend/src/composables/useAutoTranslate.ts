import { translateTexts } from '@/api/client'

// Shared across every card: identical source strings recur a lot across
// programs (e.g. the same task-tag or severity title on many platforms), and
// this avoids re-hitting the backend (which itself batches+caches, but a
// client-side cache also saves the round-trip entirely) on repeat views.
const cache = new Map<string, string>()

/** Translates a batch of strings, only hitting the network for cache misses. */
async function translateManyCached(texts: string[], target: string): Promise<string[]> {
  const results = new Array<string>(texts.length)
  const missingIndices: number[] = []
  const missingTexts: string[] = []

  texts.forEach((text, i) => {
    const key = `${target}:${text}`
    const cached = cache.get(key)
    if (cached !== undefined) {
      results[i] = cached
    } else {
      missingIndices.push(i)
      missingTexts.push(text)
    }
  })

  if (missingTexts.length > 0) {
    const translated = await translateTexts(missingTexts, target)
    missingTexts.forEach((text, j) => {
      const t = translated[j] ?? text
      cache.set(`${target}:${text}`, t)
      results[missingIndices[j] as number] = t
    })
  }

  return results
}

const SINGLE_FIELDS = [
  'description',
  'programOverview',
  'rewardsBody',
  'prohibitedActivities',
  'feasibilityLimitations',
  'documentation',
] as const
type SingleField = (typeof SINGLE_FIELDS)[number]

const LIST_FIELDS = ['taskTags', 'impactTitles', 'scopeDescriptions'] as const
type ListField = (typeof LIST_FIELDS)[number]

export type TranslateGroup = Record<SingleField, string | null> & Record<ListField, string[]>

/**
 * Translates everything a program card needs in ONE network call, instead of
 * one call per field.
 *
 * Toggling a card open/closed or flipping locale quickly can fire this watcher
 * several times before the first request lands. Rather than cancelling the
 * in-flight request, later triggers are simply blocked while one is running;
 * if the source/locale changed again in the meantime, one more pass runs
 * immediately after so the final state still reflects the latest input.
 */
export function useAutoTranslateGroup(source: Ref<TranslateGroup>) {
  const { locale } = useI18n()
  const display = ref<TranslateGroup>({ ...source.value })
  const loading = ref(false)

  let running = false
  let rerunNeeded = false

  async function translateOnce(group: TranslateGroup, loc: string) {
    if (loc === 'en') {
      display.value = { ...group }
      return
    }

    const flat: string[] = []
    const singleIndex = new Map<SingleField, number>()
    for (const key of SINGLE_FIELDS) {
      const value = group[key]
      if (value) {
        singleIndex.set(key, flat.length)
        flat.push(value)
      }
    }
    // Per-item, not a [start, length) range -- a blank entry (e.g. an
    // untitled scope item) has nothing to translate and is skipped rather
    // than sent, but its position in the original list still has to line up
    // with visibleImpacts/visibleScope afterwards, so `undefined` marks "not
    // sent" instead of just shortening the list.
    const listIndexes = new Map<ListField, (number | undefined)[]>()
    for (const key of LIST_FIELDS) {
      const indexes = group[key].map((item) => {
        if (!item) return undefined
        const idx = flat.length
        flat.push(item)
        return idx
      })
      listIndexes.set(key, indexes)
    }

    if (flat.length === 0) {
      display.value = { ...group }
      return
    }

    try {
      const translated = await translateManyCached(flat, loc)
      const result = { ...group }
      for (const key of SINGLE_FIELDS) {
        const idx = singleIndex.get(key)
        if (idx !== undefined) result[key] = translated[idx] ?? group[key]
      }
      for (const key of LIST_FIELDS) {
        const indexes = listIndexes.get(key)
        if (indexes) {
          const original = group[key]
          result[key] = indexes.map((idx, i) => (idx !== undefined ? translated[idx] : undefined) ?? original[i] ?? '')
        }
      }
      display.value = result
    } catch {
      display.value = { ...group }
    }
  }

  watch(
    [source, locale],
    async () => {
      if (running) {
        rerunNeeded = true
        return
      }
      running = true
      loading.value = true
      try {
        await translateOnce(source.value, locale.value)
        while (rerunNeeded) {
          rerunNeeded = false
          await translateOnce(source.value, locale.value)
        }
      } finally {
        running = false
        loading.value = false
      }
    },
    { immediate: true, deep: true },
  )

  return { display, loading }
}
