import { searchPlatform, ALL_PLATFORMS, PLATFORM_DOMAINS, PLATFORM_LABELS } from './search'
import { discoverOtherSellers } from './discover'
import { nameSimilarity, MATCH_CONFIDENCE_THRESHOLD, searchQueryFor, plausiblePrice } from './match'
import { scrapeProduct } from './index'
import { searchShopping, serperConfigured, ShoppingResult } from './serper'
import { renderAvailable } from './renderer'
import { Platform } from './types'

export type ComparisonSource = 'scraped' | 'google-shopping'

export interface PlatformComparison {
  platform: string // known platform key ('amazon' etc) OR a merchant/domain ('reliancedigital.in')
  label: string // human-friendly name for the UI
  matched: boolean
  name: string | null
  price: number | null
  currency: string
  url: string | null
  confidence: number | null
  source?: ComparisonSource // how the price was obtained (only when matched)
  reason?: string // set when matched === false, explains why (no honest guess)
}

export interface ComparisonOutcome {
  comparisons: PlatformComparison[]
  /** The origin platform's own Google Shopping listing, if one matched — used
   *  as a clearly-labelled fallback price when the origin page blocked us. */
  originListing: (ShoppingResult & { confidence: number }) | null
  diagnostics: {
    searchConfigured: boolean
    renderAvailable: boolean
    shoppingResults: number
    timedOut: string[]
    tookMs: number
  }
}

const MAX_RESULTS = 12

/** Maps a Google Shopping merchant name to one of our known platform keys. */
export function merchantToPlatform(source: string): Exclude<Platform, 'generic'> | null {
  const s = source.toLowerCase().replace(/[^a-z]/g, '')
  if (s.startsWith('amazon')) return 'amazon'
  if (s.startsWith('flipkart')) return 'flipkart'
  if (s.startsWith('myntra')) return 'myntra'
  if (s.startsWith('nykaa')) return 'nykaa'
  if (s.startsWith('croma')) return 'croma'
  return null
}

function normalizeMerchant(s: string): string {
  return s.toLowerCase().replace(/^www\./, '').replace(/\.(com|in|co\.in|net|store|shop)$/, '').replace(/[^a-z0-9]/g, '')
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout()), Math.max(0, ms))
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        clearTimeout(timer)
        resolve(onTimeout())
      }
    )
  })
}

/**
 * Three sources, run in parallel under one time budget:
 *  1. Google Shopping (via Serper) — merchant + feed price per listing. This
 *     is what makes comparison work on Vercel, where most stores block
 *     direct scraping from datacenter IPs.
 *  2. The 5 known platforms via site-restricted search → scrape the matched
 *     page for its live price (fetch, then Lightpanda if configured).
 *  3. A broad "buy … online" search for sellers beyond the known 5 —
 *     a domain only appears if a real scrape confirmed a matching product.
 *
 * Never fabricates a price for a platform/site it couldn't confidently
 * match on. Confirmed matches come first, cheapest first.
 */
export async function compareAcrossPlatforms(
  productName: string,
  originUrl: string,
  originPlatform: Platform,
  options: { budgetMs?: number; referencePrice?: number | null } = {}
): Promise<ComparisonOutcome> {
  const referencePrice = options.referencePrice ?? null
  const started = Date.now()
  const budgetMs = options.budgetMs ?? 25_000
  const timedOut: string[] = []
  const searchOn = serperConfigured()
  const canRender = renderAvailable()
  const query = searchQueryFor(productName)

  const targets = ALL_PLATFORMS.filter((p) => p !== originPlatform)

  if (!searchOn) {
    return {
      comparisons: targets.map((platform) => ({
        platform,
        label: PLATFORM_LABELS[platform],
        matched: false,
        name: null,
        price: null,
        currency: 'INR',
        url: null,
        confidence: null,
        reason: 'Search not configured (SERPER_API_KEY unset)',
      })),
      originListing: null,
      diagnostics: { searchConfigured: false, renderAvailable: canRender, shoppingResults: 0, timedOut, tookMs: 0 },
    }
  }

  // Leave headroom so slow scrapes can't push the whole request past the
  // serverless time limit — whatever hasn't finished by then is reported
  // as "timed out" instead of hanging the response.
  const scrapeBudget = Math.max(4000, budgetMs - 1500)

  const shoppingP = withTimeout(searchShopping(query), Math.min(10_000, budgetMs), () => {
    timedOut.push('google-shopping')
    return [] as ShoppingResult[]
  })

  const knownP = Promise.all(
    targets.map((platform) =>
      withTimeout(compareOnePlatform(productName, query, platform, canRender, referencePrice), scrapeBudget, () => {
        timedOut.push(platform)
        return unmatched(platform, 'Timed out while checking this platform')
      })
    )
  )

  const knownDomains = ALL_PLATFORMS.map((p) => PLATFORM_DOMAINS[p])
  const discoveredP = withTimeout(
    discoverOtherSellers(productName, query, originUrl, knownDomains),
    scrapeBudget,
    () => {
      timedOut.push('other-sellers')
      return []
    }
  )

  const [shopping, knownResults, discovered] = await Promise.all([shoppingP, knownP, discoveredP])

  // ---- Score Google Shopping listings ----
  const scoredShopping = shopping
    .filter((s) => s.price !== null && s.currency === 'INR' && plausiblePrice(s.price, referencePrice))
    .map((s) => ({ ...s, confidence: nameSimilarity(productName, s.title) }))
    .filter((s) => s.confidence >= MATCH_CONFIDENCE_THRESHOLD)

  // Best listing per merchant: highest confidence, then lowest price.
  const bestByMerchant = new Map<string, (typeof scoredShopping)[number]>()
  for (const s of scoredShopping) {
    const key = merchantToPlatform(s.source) ?? normalizeMerchant(s.source || s.url)
    const prev = bestByMerchant.get(key)
    if (
      !prev ||
      s.confidence > prev.confidence + 0.05 ||
      (Math.abs(s.confidence - prev.confidence) <= 0.05 && (s.price as number) < (prev.price as number))
    ) {
      bestByMerchant.set(key, s)
    }
  }

  const originListing = originPlatform !== 'generic' ? bestByMerchant.get(originPlatform) ?? null : null

  // ---- Merge: known platforms (scraped > shopping > honest "not found") ----
  const results: PlatformComparison[] = knownResults.map((scraped) => {
    if (scraped.matched) return scraped
    const shop = bestByMerchant.get(scraped.platform)
    if (shop) return fromShopping(scraped.platform, PLATFORM_LABELS[scraped.platform as keyof typeof PLATFORM_LABELS], shop)
    return scraped
  })

  // ---- Other merchants: discovered scrapes + remaining shopping listings ----
  const seen = new Set<string>([...ALL_PLATFORMS, normalizeMerchant(hostOf(originUrl) || '')])
  for (const d of discovered) {
    const key = normalizeMerchant(d.domain)
    if (seen.has(key) || !plausiblePrice(d.price, referencePrice)) continue
    seen.add(key)
    results.push({
      platform: d.domain,
      label: d.domain,
      matched: true,
      name: d.name,
      price: d.price,
      currency: 'INR',
      url: d.url,
      confidence: d.confidence,
      source: 'scraped',
    })
  }
  for (const [key, shop] of bestByMerchant) {
    if (seen.has(key) || [...seen].some((k) => k && (k.startsWith(key) || key.startsWith(k)))) continue
    seen.add(key)
    results.push(fromShopping(key, shop.source || key, shop))
  }

  // Confirmed matches first (cheapest first), unmatched entries after.
  results.sort((a, b) => {
    if (a.matched && b.matched) return (a.price ?? 0) - (b.price ?? 0)
    if (a.matched) return -1
    if (b.matched) return 1
    return 0
  })

  return {
    comparisons: results.slice(0, MAX_RESULTS),
    originListing,
    diagnostics: {
      searchConfigured: true,
      renderAvailable: canRender,
      shoppingResults: shopping.length,
      timedOut,
      tookMs: Date.now() - started,
    },
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function unmatched(platform: Exclude<Platform, 'generic'>, reason: string): PlatformComparison {
  return {
    platform,
    label: PLATFORM_LABELS[platform],
    matched: false,
    name: null,
    price: null,
    currency: 'INR',
    url: null,
    confidence: null,
    reason,
  }
}

function fromShopping(platform: string, label: string, shop: ShoppingResult & { confidence: number }): PlatformComparison {
  return {
    platform,
    label,
    matched: true,
    name: shop.title,
    price: shop.price,
    currency: shop.currency,
    url: shop.url,
    confidence: shop.confidence,
    source: 'google-shopping',
  }
}

async function compareOnePlatform(
  productName: string,
  query: string,
  platform: Exclude<Platform, 'generic'>,
  canRender: boolean,
  referencePrice: number | null
): Promise<PlatformComparison> {
  const candidates = await searchPlatform(query, platform)
  if (candidates.length === 0) {
    return unmatched(platform, 'No search results found on this platform')
  }

  // Score each candidate by name similarity, keep the best.
  const scored = candidates
    .map((c) => ({ ...c, score: nameSimilarity(productName, c.title) }))
    .sort((a, b) => b.score - a.score)
  const best = scored[0]

  if (best.score < MATCH_CONFIDENCE_THRESHOLD) {
    return unmatched(platform, 'No confident product match on this platform')
  }

  const scraped = await scrapeProduct(best.url, {
    allowRender: canRender,
    fetchTimeoutMs: 6000,
    renderTimeoutMs: 12000,
    unblockTimeoutMs: 15000,
  })

  if (scraped.success && scraped.price !== null && scraped.currency === 'INR' && !plausiblePrice(scraped.price, referencePrice)) {
    return unmatched(platform, `Closest match is priced very differently (₹${scraped.price.toLocaleString('en-IN')}) — likely a different variant or product`)
  }

  if (scraped.success && scraped.price !== null && scraped.currency === 'INR') {
    // Re-check similarity against the real page title, not just the search title.
    const confidence = scraped.name ? Math.max(nameSimilarity(productName, scraped.name), best.score * 0.9) : best.score
    return {
      platform,
      label: PLATFORM_LABELS[platform],
      matched: true,
      name: scraped.name,
      price: scraped.price,
      currency: 'INR',
      url: scraped.finalUrl || best.url,
      confidence: Math.round(confidence * 100) / 100,
      source: 'scraped',
    }
  }

  // Page blocked us, but Google's rich snippet for that exact result had a price.
  if (typeof best.price === 'number' && (best.currency ?? 'INR') === 'INR' && plausiblePrice(best.price, referencePrice)) {
    return {
      platform,
      label: PLATFORM_LABELS[platform],
      matched: true,
      name: best.title,
      price: best.price,
      currency: 'INR',
      url: best.url,
      confidence: best.score,
      source: 'google-shopping',
    }
  }

  return unmatched(
    platform,
    scraped.blocked
      ? 'Found a likely match, but the site blocked price extraction'
      : scraped.error || 'Found a likely match but could not extract its price'
  )
}
