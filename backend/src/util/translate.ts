import { describeHttpError, httpClient } from './http.js'

// In-memory cache: dataset is small (a few hundred program strings) so an
// unbounded Map is fine for an MVP and avoids re-hitting the unofficial
// endpoint below across polls/requests.
const cache = new Map<string, string>()

const MAX_BATCH_ITEMS = 50
const MAX_BATCH_CHARS = 1500

type GoogleSegment = [string, string, ...unknown[]]

/**
 * Translates a list of short strings, batching cache-missing ones into as few
 * upstream requests as possible. Returns translations aligned 1:1 with `texts`.
 */
export async function translateBatch(texts: string[], target: string): Promise<string[]> {
  const results = new Array<string>(texts.length)
  const pending = new Map<string, number[]>()

  texts.forEach((text, i) => {
    if (!text.trim()) {
      results[i] = text // nothing to translate, and an empty `q` upsets the upstream endpoint
      return
    }
    const cached = cache.get(cacheKey(target, text))
    if (cached !== undefined) {
      results[i] = cached
      return
    }
    const indices = pending.get(text)
    if (indices) indices.push(i)
    else pending.set(text, [i])
  })

  const uncached = [...pending.keys()]
  for (const chunk of chunkTexts(uncached, MAX_BATCH_ITEMS, MAX_BATCH_CHARS)) {
    const translated = (await translateJoined(chunk, target)) ?? (await translateEachIndividually(chunk, target))
    chunk.forEach((text, i) => {
      const t = translated[i] ?? text
      cache.set(cacheKey(target, text), t)
      for (const idx of pending.get(text) ?? []) results[idx] = t
    })
  }

  return results
}

function cacheKey(target: string, text: string): string {
  return `${target}:${text}`
}

export function chunkTexts(texts: string[], maxItems: number, maxChars: number): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  let currentChars = 0
  for (const text of texts) {
    if (current.length > 0 && (current.length >= maxItems || currentChars + text.length > maxChars)) {
      chunks.push(current)
      current = []
      currentChars = 0
    }
    current.push(text)
    currentChars += text.length + 1
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

/**
 * Joins several short strings with "\n" into a single upstream call -- Google
 * reliably treats each line as its own segment when the lines are short
 * phrases. Verified by reconstructing the original text from the segments'
 * own "original text" field: if it doesn't match exactly (e.g. Google split
 * one of our lines into multiple sentences on its own), returns null so the
 * caller falls back to per-item requests instead of returning misaligned data.
 */
async function translateJoined(texts: string[], target: string): Promise<string[] | null> {
  if (texts.length === 1) return null // no batching benefit, skip the alignment dance
  const joined = texts.join('\n')
  let segments: GoogleSegment[]
  try {
    segments = await callGoogle(joined, target)
  } catch (err) {
    // A too-long/malformed joined call (e.g. Google 400s on it) must fall
    // back to per-item requests, same as an alignment mismatch below -- this
    // was previously an unguarded throw, which the `?? translateEachIndividually(...)`
    // in translateBatch can't catch (`??` only substitutes on null/undefined,
    // never on a throw), so one bad joined call used to take the whole chunk
    // down with it instead of falling back.
    logTranslateFailure('joined', joined.length, target, err)
    return null
  }
  const reconstructedOriginal = segments.map((s) => s[1]).join('')
  if (segments.length !== texts.length || reconstructedOriginal !== joined) return null
  return segments.map((s) => s[0].replace(/\n$/, ''))
}

async function translateEachIndividually(texts: string[], target: string): Promise<string[]> {
  return Promise.all(
    texts.map(async (text) => {
      try {
        const segments = await callGoogle(text, target)
        return segments.map((s) => s[0]).join('')
      } catch (err) {
        // Isolated per item on purpose: Promise.all would otherwise reject
        // (and discard) every other successfully-translated text in this
        // chunk just because one text -- often an unusually long field --
        // got rejected upstream. Falling back to the original text for just
        // that one field beats losing the whole card's translation.
        logTranslateFailure('single', text.length, target, err)
        return text
      }
    }),
  )
}

function logTranslateFailure(kind: 'joined' | 'single', chars: number, target: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[translate] ${kind} call failed (${chars} chars, target=${target}): ${message}`)
}

// Uses the unofficial, no-key translate.googleapis.com endpoint (the same one
// browser extensions use). No SLA/auth -- can break or rate-limit without
// notice; there's no official Google Translate free tier to fall back to.
async function callGoogle(text: string, target: string): Promise<GoogleSegment[]> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
  try {
    const data = await httpClient.get(url).json<unknown>()
    return (data as unknown[])[0] as GoogleSegment[]
  } catch (err) {
    throw new Error(describeHttpError(err), { cause: err })
  }
}
