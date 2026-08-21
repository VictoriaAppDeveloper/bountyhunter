import { fetchJson, fetchText } from '../util/http.js'
import type { NormalizedProgram, ScopeAsset, SourceAdapter } from './types.js'

const API_BASE = 'https://code4rena.com/api/v1/audits'
const PER_PAGE = 100
const DETAIL_CONCURRENCY = 4

// Code4rena's own first-party API (confirmed live 2026-08-20), not a
// third-party mirror. Unauthenticated, paginated. Its own `status` field
// (Completed/Reporting/Awarding/Pre-Contest/Pre-sort/Sponsor Review/Needs
// Judging/null) is unreliable for old contests -- many archived entries
// were never updated past whatever phase they were in when C4R's own status
// tracking last touched them. `startTime`/`endTime` are the only signal
// that's consistently trustworthy across the whole history, so status here
// is derived from those instead of the source's own label.
interface Code4renaOrg {
  name: string | null
  link: string | null
  image: string | null
}

interface Code4renaAudit {
  contestId: number
  slug: string
  title: string
  details: string | null
  auditType: string | null
  status: string | null
  startTime: string
  endTime: string
  formattedAmount: string | null
  league: string | null
  repo: string | null
  findingsRepo: string | null
  org: Code4renaOrg | null
}

interface Code4renaResponse {
  data: { audits: Code4renaAudit[] }
  pagination: { lastPage: number }
}

// The listing API has no description/scope/reward-breakdown -- that only
// lives on each contest's own page, server-rendered by Next.js into the
// initial HTML as a single markdown blob (the same document backing that
// page's "Details" tab, itself the contest repo's README). Fetching and
// parsing ~475 of those pages is expensive and slow-changing content, so
// results are cached for the life of the process: a genuinely new contest
// gets its detail fetched once and then reused on every later poll, and
// only a process restart pays the full backlog cost again. `null` (fetch or
// parse failure) is cached too, so a permanently-broken page isn't retried
// every cycle -- detail enrichment is best-effort and must never abort the
// whole poll the way a listing-fetch failure does.
interface AuditDetail {
  programOverview: string | null
  rewardsBody: string | null
  prohibitedActivities: string | null
  feasibilityLimitations: string | null
  documentation: string | null
  scope: ScopeAsset[]
}

const detailCache = new Map<string, AuditDetail | null>()

export const code4renaAdapter: SourceAdapter = {
  platform: 'code4rena',
  // Longer than Immunefi's -- a poll here can fetch/parse many contest
  // detail pages on a cold cache (process restart), and this is a
  // slower-moving platform than a continuously-updated bounty feed.
  pollIntervalMs: 10 * 60 * 1000,

  async poll(): Promise<NormalizedProgram[]> {
    const audits = await fetchAllAudits()
    const valid = audits.filter((a) => a.slug && a.title)
    const details = await fetchDetailsThrottled(valid.map((a) => a.slug))
    return valid.map((a) => normalize(a, details.get(a.slug) ?? null))
  },
}

async function fetchAllAudits(): Promise<Code4renaAudit[]> {
  const first = await fetchJson<Code4renaResponse>(`${API_BASE}?page=1&perPage=${PER_PAGE}`, 30_000)
  const all = [...first.data.audits]
  for (let page = 2; page <= first.pagination.lastPage; page++) {
    const next = await fetchJson<Code4renaResponse>(`${API_BASE}?page=${page}&perPage=${PER_PAGE}`, 30_000)
    all.push(...next.data.audits)
  }
  return all
}

async function fetchDetailsThrottled(slugs: string[]): Promise<Map<string, AuditDetail | null>> {
  const result = new Map<string, AuditDetail | null>()
  const queue = [...slugs]

  async function worker() {
    for (let slug = queue.shift(); slug !== undefined; slug = queue.shift()) {
      const cached = detailCache.get(slug)
      if (cached !== undefined) {
        result.set(slug, cached)
        continue
      }
      const detail = await fetchAuditDetail(slug)
      detailCache.set(slug, detail)
      result.set(slug, detail)
    }
  }

  await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker))
  return result
}

async function fetchAuditDetail(slug: string): Promise<AuditDetail | null> {
  try {
    const html = await fetchText(`https://code4rena.com/audits/${slug}`, 20_000)
    const markdown = extractAuditMarkdown(html)
    return markdown ? parseAuditMarkdown(markdown) : null
  } catch (err) {
    console.error(`[code4rena] detail fetch failed for ${slug}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// Next.js streams page data as `self.__next_f.push([1, "<chunk>"])` calls;
// most chunks are short UI/component strings, but the contest's markdown
// document is the one that (a) starts with a heading and (b) has several
// more headings after it -- true of every contest checked across 2023-2026
// even though the exact section names/count vary between contest eras.
export function extractAuditMarkdown(html: string): string | null {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let text: string
    try {
      text = JSON.parse(m[1]!) as string
    } catch {
      continue
    }
    if (/^#{1,2} /.test(text) && (text.match(/^#{1,3} /gm)?.length ?? 0) >= 3) {
      return text
    }
  }
  return null
}

interface MdHeading {
  level: number
  title: string
  line: number
}

export function parseHeadings(markdown: string): MdHeading[] {
  const headings: MdHeading[] = []
  markdown.split('\n').forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s+(.*)$/)
    if (m?.[1] && m[2] !== undefined) headings.push({ level: m[1].length, title: m[2].trim(), line: i })
  })
  return headings
}

// A section's body runs from right after its heading to the next heading of
// the same or shallower level (matching normal markdown document nesting),
// so this also works for extracting a `###` subsection buried inside a
// larger `#` section (e.g. "important notes for wardens" inside the top
// "{title} audit details" section).
export function sectionBody(markdown: string, headings: MdHeading[], matcher: RegExp): string | null {
  const idx = headings.findIndex((h) => matcher.test(h.title))
  if (idx === -1) return null
  const cur = headings[idx]!
  const lines = markdown.split('\n')
  let endLine = lines.length
  for (let j = idx + 1; j < headings.length; j++) {
    if (headings[j]!.level <= cur.level) {
      endLine = headings[j]!.line
      break
    }
  }
  return (
    lines
      .slice(cur.line + 1, endLine)
      .join('\n')
      .trim() || null
  )
}

function parseAuditMarkdown(markdown: string): AuditDetail {
  const headings = parseHeadings(markdown)
  return {
    programOverview: sectionBody(markdown, headings, /^overview\b|^abstract\b/i),
    rewardsBody: sectionBody(markdown, headings, /audit details$/i),
    prohibitedActivities: joinNonEmpty([
      sectionBody(markdown, headings, /publicly known issues/i),
      sectionBody(markdown, headings, /v12 findings/i),
    ]),
    feasibilityLimitations: sectionBody(markdown, headings, /important notes for wardens/i),
    documentation: sectionBody(markdown, headings, /additional context/i),
    scope: parseScopeTable(sectionBody(markdown, headings, /files in scope/i)),
  }
}

// The "Files in scope" section is a `| file | nSLOC |` markdown table with a
// header row, a `---` separator row, and a trailing bold "Totals" row --
// only real rows have a `[path](url)` link in their first cell, which is
// what actually distinguishes a data row from the rest here.
export function parseScopeTable(tableSection: string | null): ScopeAsset[] {
  if (!tableSection) return []
  const assets: ScopeAsset[] = []
  for (const line of tableSection.split('\n')) {
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
    const linkMatch = cells[0]?.match(/^\[(.+?)\]\((https?:\/\/[^)]+)\)/)
    if (!linkMatch?.[2]) continue
    assets.push({ url: linkMatch[2], type: 'contract', description: cells[1] ? `${cells[1]} nSLOC` : null })
  }
  return assets
}

function normalize(a: Code4renaAudit, detail: AuditDetail | null): NormalizedProgram {
  const { amount, currency } = parseReward(a.formattedAmount)

  return {
    platform: 'code4rena',
    externalId: a.slug,
    name: a.title,
    url: `https://code4rena.com/audits/${a.slug}`,
    repositoryUrl: a.repo?.trim() || null,
    category: 'audit-contest',
    rewardMin: amount,
    rewardMax: amount,
    rewardCurrency: currency,
    rewardRaw: a.formattedAmount?.trim() || null,
    chains: a.league ? [a.league] : [],
    status: deriveStatus(a.startTime, a.endTime),
    kycRequired: null,
    description: (a.details ?? '').trim() || null,
    programOverview: detail?.programOverview ?? null,
    rewardsBody: detail?.rewardsBody ?? null,
    prohibitedActivities: detail?.prohibitedActivities ?? null,
    feasibilityLimitations: detail?.feasibilityLimitations ?? null,
    documentation: joinNonEmpty([
      a.findingsRepo ? `[Findings repo](${a.findingsRepo})` : null,
      detail?.documentation ?? null,
    ]),
    taskTags: a.auditType ? [a.auditType] : [],
    scope: detail?.scope ?? [],
    impacts: [],
    raw: a,
  }
}

function joinNonEmpty(parts: (string | null | undefined)[]): string | null {
  const cleaned = parts.map((p) => p?.trim()).filter((p): p is string => !!p)
  return cleaned.length > 0 ? cleaned.join('\n\n') : null
}

export function deriveStatus(startTime: string, endTime: string): 'upcoming' | 'active' | 'closed' {
  const now = Date.now()
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  if (now < start) return 'upcoming'
  if (now <= end) return 'active'
  return 'closed'
}

// Handles "$135,000 in USDC", "Up to $300,500 in USDC", plain "$36,500"
// (currency defaults to USD), and non-dollar prizes like "200,000 OP" or
// "27 ETH + 1000 VETH" (first amount+token pair only -- `rewardRaw` keeps
// the full original string regardless).
export function parseReward(formatted: string | null): { amount: number | null; currency: string | null } {
  if (!formatted) return { amount: null, currency: null }
  const dollarMatch = formatted.match(/\$([\d,]+)/)
  if (dollarMatch?.[1]) {
    const currencyMatch = formatted.match(/in\s+([A-Za-z]{2,10})\b/)
    return { amount: Number(dollarMatch[1].replace(/,/g, '')), currency: currencyMatch?.[1] ?? 'USD' }
  }
  const tokenMatch = formatted.match(/^([\d,]+)\s+([A-Za-z]{2,10})\b/)
  if (tokenMatch?.[1] && tokenMatch[2]) {
    return { amount: Number(tokenMatch[1].replace(/,/g, '')), currency: tokenMatch[2] }
  }
  return { amount: null, currency: null }
}
