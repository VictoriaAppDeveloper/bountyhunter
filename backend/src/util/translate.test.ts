import { describe, expect, it } from 'vitest'
import { chunkTexts } from './translate.js'

describe('chunkTexts', () => {
  it('keeps everything in one chunk when under both limits', () => {
    expect(chunkTexts(['a', 'b', 'c'], 50, 1500)).toEqual([['a', 'b', 'c']])
  })

  it('splits once the item-count limit is reached', () => {
    const texts = Array.from({ length: 5 }, (_, i) => `t${i}`)
    expect(chunkTexts(texts, 2, 1500)).toEqual([['t0', 't1'], ['t2', 't3'], ['t4']])
  })

  it('splits once the character-count limit would be exceeded', () => {
    // maxChars=10, each text ~4 chars + 1 separator counted per item
    const texts = ['aaaa', 'bbbb', 'cccc']
    expect(chunkTexts(texts, 50, 10)).toEqual([['aaaa', 'bbbb'], ['cccc']])
  })

  it('never splits a single oversized item into an empty chunk', () => {
    const huge = 'x'.repeat(5000)
    expect(chunkTexts([huge], 50, 1500)).toEqual([[huge]])
  })

  it('starts a new chunk for the next item after a lone oversized item', () => {
    const huge = 'x'.repeat(5000)
    expect(chunkTexts([huge, 'small'], 50, 1500)).toEqual([[huge], ['small']])
  })

  it('returns an empty array for empty input', () => {
    expect(chunkTexts([], 50, 1500)).toEqual([])
  })
})
