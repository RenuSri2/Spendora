import { searchPlatform, ALL_PLATFORMS, PLATFORM_DOMAINS } from './search'
import { discoverOtherSellers } from './discover'
import { nameSimilarity, MATCH_CONFIDENCE_THRESHOLD } from './match'
import { scrapeProduct } from './index'
import { Platform } from './types'

export interface PlatformComparison {
  platform: string // known platform key ('amazon' etc) OR a discovered domain ('someshop.in')
  matched: boolean
  name: string | null
  price: number | null
  url: string | null
  confidence: number | null
  reason?: string // set when matched === false, explains why (no honest guess)
}

const MAX_COMPARISONS = 10

/**
 * Two passes: (1) the 5 known platforms via site-restricted search — more
 * precise since we have selector fallbacks for them; (2) a general web
 * search with no site restriction, for sellers not on that list (useful
 * for niche/regional products the big platforms don't carry). A domain
 * only appears in the general-search results if a real scrape confirmed a
 * matching product — never from search-snippet text alone.
 *
 * Never fabricates a price for a platform/site it couldn't confidently
 * match on. Results are capped at 10, cheapest confirmed matches first.
 */
export async function compareAcrossPlatforms(
  productName: string,
  originUrl: string,
  originPlatform: Platform
): Promise<PlatformComparison[]> {
  const targets = ALL_PLATFORMS.filter((p) => p !== originPlatform)

  const knownResults = await Promise.all(
    targets.map((platform) => compareOnePlatform(productName, platform))
  )

  const knownDomains = targets.map((p) => PLATFORM_DOMAINS[p])
  const discovered = await discoverOtherSellers(productName, originUrl, knownDomains)

  const discoveredResults: PlatformComparison[] = discovered.map((d) => ({
    platform: d.domain,
    matched: true,
    name: d.name,
    price: d.price,
    url: d.url,
    confidence: d.confidence,
  }))

  const merged = [...knownResults, ...discoveredResults]

  // Confirmed matches first (cheapest first), unmatched entries after.
  merged.sort((a, b) => {
    if (a.matched && b.matched) return (a.price ?? 0) - (b.price ?? 0)
    if (a.matched) return -1
    if (b.matched) return 1
    return 0
  })

  return merged.slice(0, MAX_COMPARISONS)
}

async function compareOnePlatform(
  productName: string,
  platform: Exclude<Platform, 'generic'>
): Promise<PlatformComparison> {
  const base = { platform, matched: false, name: null, price: null, url: null, confidence: null }

  if (!process.env.SERPER_API_KEY) {
    return { ...base, reason: 'Search not configured (SERPER_API_KEY unset)' }
  }

  const candidates = await searchPlatform(productName, platform)
  if (candidates.length === 0) {
    return { ...base, reason: 'No search results found' }
  }

  // Score each candidate by name similarity, keep the best.
  let best = candidates[0]
  let bestScore = nameSimilarity(productName, candidates[0].title)

  for (const candidate of candidates.slice(1)) {
    const score = nameSimilarity(productName, candidate.title)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  if (bestScore < MATCH_CONFIDENCE_THRESHOLD) {
    return { ...base, reason: 'No confident product match on this platform' }
  }

  const scraped = await scrapeProduct(best.url)
  if (!scraped.success || scraped.price === null) {
    return {
      ...base,
      reason: scraped.error || 'Found a likely match but could not extract its price',
    }
  }

  return {
    platform,
    matched: true,
    name: scraped.name,
    price: scraped.price,
    url: best.url,
    confidence: Math.round(bestScore * 100) / 100,
  }
}
