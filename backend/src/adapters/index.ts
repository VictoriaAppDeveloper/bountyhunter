import { code4renaAdapter } from './code4rena.js'
import { immunefiAdapter } from './immunefi.js'
import type { SourceAdapter } from './types.js'

// Gitcoin, Sherlock, Cantina, HackenProof, HackerOne, Layer3 are still
// pending Phase 4 (devtools investigation for a hidden JSON API, or cheerio
// scraping as a fallback). Gitcoin's previously-known public GraphQL indexer
// (grants-stack-indexer-v2.gitcoin.co) no longer resolves as of 2026-08-19 and
// needs to be re-investigated from scratch, not just re-added. Sherlock's
// `/api/contests` is public and clean but only covers time-boxed audit
// contests -- its live, higher-value "Bug Bounties" section is Next.js
// SSR/RSC with no backing JSON endpoint, so it'd need HTML/RSC scraping
// (~35+ per-program detail pages) rather than a single feed fetch.
export const adapters: SourceAdapter[] = [immunefiAdapter, code4renaAdapter]
