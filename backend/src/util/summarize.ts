import { describeHttpError, httpClient } from './http.js'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const MAX_FIELD_CHARS = 3000
const MAX_IMPACTS = 20

// LLM completions can take a while; previously had no timeout at all.
const deepseekClient = httpClient.extend({ timeout: 60_000 })

export interface SummarizeInput {
  name: string
  platform: string
  category: string
  status: string
  rewardMin: number | null
  rewardMax: number | null
  rewardCurrency: string | null
  kycRequired: boolean | null
  chains: string[]
  taskTags: string[]
  description: string | null
  programOverview: string | null
  rewardsBody: string | null
  prohibitedActivities: string | null
  feasibilityLimitations: string | null
  impacts: { severity: string; title: string }[]
  scopeCount: number
  scopeTypes: string[]
}

/**
 * Asks DeepSeek for a short, practical brief: what the program is about and
 * where a researcher should look first, given its scope and impact
 * categories. Throws if DEEPSEEK_API_KEY isn't set or the call fails --
 * callers decide how to surface that (see routes/summarize.ts).
 */
export async function summarizeProgram(input: SummarizeInput, locale: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured')

  const languageName = locale === 'ru' ? 'Russian' : 'English'

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = await deepseekClient
      .post(DEEPSEEK_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
        json: {
          model: 'deepseek-chat',
          temperature: 0.3,
          max_tokens: 700,
          messages: [
            {
              role: 'system',
              content:
                `You are a security researcher's assistant. Given a bug bounty program's rules and scope, ` +
                `write a short, practical brief in ${languageName}: (1) one short paragraph on what the ` +
                `protocol does and what kind of bugs are being sought, (2) a bulleted list of 3-6 concrete ` +
                `places or approaches a researcher should look at first, grounded in the actual scope and ` +
                `impact categories given. Be concise, no fluff, do not restate the raw input verbatim.`,
            },
            { role: 'user', content: buildPrompt(input) },
          ],
        },
      })
      .json()
  } catch (err) {
    throw new Error(`DeepSeek API ${describeHttpError(err)}`, { cause: err })
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('DeepSeek API returned no content')
  return content
}

function truncate(text: string | null): string | null {
  if (!text) return text
  return text.length > MAX_FIELD_CHARS ? `${text.slice(0, MAX_FIELD_CHARS)}…` : text
}

function buildPrompt(input: SummarizeInput): string {
  const rewardLine =
    input.rewardMax !== null
      ? `Reward: up to ${input.rewardMax} ${input.rewardCurrency ?? ''}${input.rewardMin !== null ? ` (min ${input.rewardMin})` : ''}`
      : 'Reward: not specified'

  const impactsLines =
    input.impacts
      .slice(0, MAX_IMPACTS)
      .map((i) => `- [${i.severity}] ${i.title}`)
      .join('\n') || 'none published'

  return [
    `Program: ${input.name} (${input.platform}, ${input.category}, status: ${input.status})`,
    rewardLine,
    `KYC required: ${input.kycRequired === null ? 'unknown' : input.kycRequired ? 'yes' : 'no'}`,
    `Chains/ecosystems: ${input.chains.join(', ') || 'not specified'}`,
    `Tags: ${input.taskTags.join(', ') || 'none'}`,
    `Scope: ${input.scopeCount} asset(s), types: ${input.scopeTypes.join(', ') || 'unspecified'}`,
    '',
    truncate(input.description) ? `Description:\n${truncate(input.description)}` : '',
    truncate(input.programOverview) ? `Program overview:\n${truncate(input.programOverview)}` : '',
    truncate(input.rewardsBody) ? `Reward mechanics:\n${truncate(input.rewardsBody)}` : '',
    truncate(input.prohibitedActivities) ? `Prohibited activities:\n${truncate(input.prohibitedActivities)}` : '',
    truncate(input.feasibilityLimitations) ? `Feasibility limitations:\n${truncate(input.feasibilityLimitations)}` : '',
    '',
    `Impact categories (what counts as a valid finding):\n${impactsLines}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
