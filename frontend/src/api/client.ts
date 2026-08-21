import type { ChangeEvent, Program, SourceStatusRow } from '@/types/program'
import ky, { HTTPError } from 'ky'

const api = ky.create({ prefix: '/api' })
// Translation can take several sequential round-trips server-side, and a
// summary call waits on an LLM (allowed up to 60s server-side) -- ky's
// default 10s timeout suits the plain reads below but is too short for
// these two; summarize's must outlast the backend's own 60s allowance.
const translateApi = api.extend({ timeout: 30_000 })
const summarizeApi = api.extend({ timeout: 65_000 })

export interface ProgramFilters {
  platform?: string
  category?: string
  status?: string
  chain?: string
  minReward?: number
  kyc?: 'true' | 'false'
}

export function fetchPrograms(filters: ProgramFilters = {}): Promise<Program[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return api.get('programs', { searchParams: params }).json<Program[]>()
}

export function fetchProgram(id: number): Promise<Program> {
  return api.get(`programs/${id}`).json<Program>()
}

export function fetchProgramHistory(id: number): Promise<ChangeEvent[]> {
  return api.get(`programs/${id}/history`).json<ChangeEvent[]>()
}

export function fetchSources(): Promise<SourceStatusRow[]> {
  return api.get('sources').json<SourceStatusRow[]>()
}

export async function translateTexts(texts: string[], target = 'ru'): Promise<string[]> {
  const data = await translateApi.post('translate', { json: { texts, target } }).json<{ translations: string[] }>()
  return data.translations
}

export async function summarizeProgram(id: number, locale: string): Promise<string> {
  try {
    const data = await summarizeApi.post(`programs/${id}/summarize`, { json: { locale } }).json<{ summary: string }>()
    return data.summary
  } catch (err) {
    if (err instanceof HTTPError) {
      // ky pre-parses a failed response's body into `err.data` (JSON here,
      // per this route's Content-Type) -- `err.response.json()` would just
      // hang, since the body stream is already drained by then.
      const body = err.data as { error?: string } | undefined
      throw new Error(body?.error ?? `summarize failed: ${err.response.status}`, { cause: err })
    }
    throw err
  }
}
