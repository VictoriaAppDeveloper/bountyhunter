import { describe, expect, it } from 'vitest'
import {
  deriveStatus,
  extractAuditMarkdown,
  parseHeadings,
  parseReward,
  parseScopeTable,
  sectionBody,
} from './code4rena.js'

describe('deriveStatus', () => {
  const HOUR = 60 * 60 * 1000

  it('is upcoming before startTime', () => {
    const start = new Date(Date.now() + HOUR).toISOString()
    const end = new Date(Date.now() + 2 * HOUR).toISOString()
    expect(deriveStatus(start, end)).toBe('upcoming')
  })

  it('is active between start and end, inclusive of end', () => {
    const start = new Date(Date.now() - HOUR).toISOString()
    const end = new Date(Date.now() + HOUR).toISOString()
    expect(deriveStatus(start, end)).toBe('active')

    const barelyEnding = new Date(Date.now() + 1000).toISOString()
    expect(deriveStatus(start, barelyEnding)).toBe('active')
  })

  it('is closed once past endTime', () => {
    const start = new Date(Date.now() - 2 * HOUR).toISOString()
    const end = new Date(Date.now() - HOUR).toISOString()
    expect(deriveStatus(start, end)).toBe('closed')
  })
})

describe('parseReward', () => {
  it('returns nulls for missing input', () => {
    expect(parseReward(null)).toEqual({ amount: null, currency: null })
  })

  it('parses a plain dollar amount, defaulting currency to USD', () => {
    expect(parseReward('$36,500')).toEqual({ amount: 36500, currency: 'USD' })
  })

  it('parses "$X in TOKEN"', () => {
    expect(parseReward('$135,000 in USDC')).toEqual({ amount: 135000, currency: 'USDC' })
  })

  it('parses "Up to $X in TOKEN"', () => {
    expect(parseReward('Up to $300,500 in USDC')).toEqual({ amount: 300500, currency: 'USDC' })
  })

  it('parses a leading non-dollar token amount', () => {
    expect(parseReward('200,000 OP')).toEqual({ amount: 200000, currency: 'OP' })
  })

  it('takes only the first amount+token pair out of a multi-token prize', () => {
    expect(parseReward('27 ETH + 1000 VETH')).toEqual({ amount: 27, currency: 'ETH' })
  })

  it('returns nulls when nothing recognizable is present', () => {
    expect(parseReward('TBD')).toEqual({ amount: null, currency: null })
  })
})

describe('parseScopeTable', () => {
  it('returns nothing for a missing section', () => {
    expect(parseScopeTable(null)).toEqual([])
  })

  it('extracts rows with a markdown link, skipping header/separator/totals rows', () => {
    const table = [
      '| Contract | nSLOC |',
      '| --- | --- |',
      '| [src/Vault.sol](https://github.com/org/repo/blob/main/src/Vault.sol) | 120 |',
      '| [src/Router.sol](https://github.com/org/repo/blob/main/src/Router.sol) | 80 |',
      '| **Totals** | 200 |',
    ].join('\n')

    expect(parseScopeTable(table)).toEqual([
      { url: 'https://github.com/org/repo/blob/main/src/Vault.sol', type: 'contract', description: '120 nSLOC' },
      { url: 'https://github.com/org/repo/blob/main/src/Router.sol', type: 'contract', description: '80 nSLOC' },
    ])
  })

  it('omits the description when the nSLOC cell is blank', () => {
    const table = '| [src/A.sol](https://example.com/a) | |'
    expect(parseScopeTable(table)).toEqual([{ url: 'https://example.com/a', type: 'contract', description: null }])
  })
})

describe('parseHeadings + sectionBody', () => {
  const markdown = [
    '# Contest details',
    'intro line',
    '## Overview',
    'This protocol does X.',
    'Second line of overview.',
    '## Scope',
    '### Files in scope',
    '| a | b |',
    '## Known issues',
    'nothing notable',
  ].join('\n')

  it('finds a top-level section body, stopping at the next heading of equal-or-shallower depth', () => {
    const headings = parseHeadings(markdown)
    expect(sectionBody(markdown, headings, /^overview$/i)).toBe('This protocol does X.\nSecond line of overview.')
  })

  it('finds a nested subsection without swallowing the parent section', () => {
    const headings = parseHeadings(markdown)
    expect(sectionBody(markdown, headings, /files in scope/i)).toBe('| a | b |')
  })

  it('returns null for a heading that does not exist', () => {
    const headings = parseHeadings(markdown)
    expect(sectionBody(markdown, headings, /nonexistent section/i)).toBeNull()
  })
})

describe('extractAuditMarkdown', () => {
  it('picks the streamed chunk that looks like the contest document (heading + several subheadings)', () => {
    const doc = '# Audit details\n\n## Overview\ntext\n\n## Scope\nmore text\n\n## Known issues\nmore'
    const html = [
      `<script>self.__next_f.push([1,${JSON.stringify('short ui string')}])</script>`,
      `<script>self.__next_f.push([1,${JSON.stringify(doc)}])</script>`,
    ].join('\n')
    expect(extractAuditMarkdown(html)).toBe(doc)
  })

  it('returns null when no chunk matches the heading-count heuristic', () => {
    const html = `<script>self.__next_f.push([1,${JSON.stringify('just some prose, no headings')}])</script>`
    expect(extractAuditMarkdown(html)).toBeNull()
  })
})
