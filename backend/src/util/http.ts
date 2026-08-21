import ky, { HTTPError } from 'ky'
import { config } from '../config.js'

export const httpClient = ky.create({
  headers: { 'User-Agent': config.userAgent },
})

export async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  try {
    return await httpClient.get(url, { timeout: timeoutMs }).text()
  } catch (err) {
    throw new Error(`${url} -> ${describeHttpError(err)}`, { cause: err })
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  try {
    return await httpClient.get(url, { timeout: timeoutMs }).json<T>()
  } catch (err) {
    throw new Error(`${url} -> ${describeHttpError(err)}`, { cause: err })
  }
}

// ky pre-consumes and parses a failed response's body into `HTTPError.data`
// (JSON if the Content-Type says so, otherwise text) before the error ever
// reaches a catch block -- `err.response.text()`/`.json()` would just hang
// or throw at that point, since the body stream is already drained.
export function describeHttpError(err: unknown): string {
  if (err instanceof HTTPError) {
    const body = typeof err.data === 'string' ? err.data : err.data ? JSON.stringify(err.data) : ''
    return `HTTP ${err.response.status}${body ? `: ${body.slice(0, 300)}` : ''}`
  }
  return err instanceof Error ? err.message : String(err)
}
