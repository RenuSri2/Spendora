import { scrapeProduct } from './index'
import { nameSimilarity, MATCH_CONFIDENCE_THRESHOLD } from './match'
import { searchSerper } from './serper'

interface RawResult {
  title: string
  url: string
  content: string
}

// Obviously-not-a-store domains — skip these before even attempting a
// scrape, since they'll never have Product schema and would just waste a
// fetch. Everything else gets a real attempt; a page only counts as a
// match if scraping it actually returns a genuine name+price, so this list
// only needs to catch high-traffic noise, not be exhaustive.
const EXCLUDE_DOMAINS = [
  'wikipedia.org', 'youtube.com', 'reddit.com', 'quora.com', 'facebook.com',
  'instagram.com', 'twitter.com', 'x.com', 'pinterest.com', 'threads.net',
  'medium.com', 'blogspot.com', 'tumblr.com', 'linkedin.com', 'news.google.com',
]

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

async function searchGeneral(query: string): Promise<RawResult[]> {
  return searchSerper(`buy ${query} online`)
}

export interface DiscoveredListing {
  domain: string
  name: string
  price: number
  url: string
  confidence: number
}

/**
 * Searches broadly (not restricted to any specific site), skips domains we
 * already handle via the known-platform path or obviously aren't stores,
 * then actually scrapes each remaining candidate — a domain only makes it
 * into the results if that scrape genuinely returns a matching product.
 * No listing is ever included on search-result text alone.
 */
export async function discoverOtherSellers(
  productName: string,
  query: string,
  originUrl: string,
  knownDomains: string[],
  maxCandidates = 6
): Promise<DiscoveredListing[]> {
  const originHost = hostnameOf(originUrl)
  const results = await searchGeneral(query)

  const seenDomains = new Set<string>(knownDomains)
  if (originHost) seenDomains.add(originHost)

  const candidates: RawResult[] = []
  for (const r of results) {
    const host = hostnameOf(r.url)
    if (!host) continue
    if (EXCLUDE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) continue
    if (seenDomains.has(host) || knownDomains.some((d) => host.endsWith(`.${d}`))) continue
    seenDomains.add(host)
    candidates.push(r)
    if (candidates.length >= maxCandidates) break
  }

  const attempts = await Promise.allSettled(
    // Fetch-only (no browser render) and a short timeout: these are
    // speculative candidates, not worth spending the request budget on.
    candidates.map(async (c) => ({
      candidate: c,
      result: await scrapeProduct(c.url, { allowRender: false, allowUnblock: false, fetchTimeoutMs: 6000 }),
    }))
  )

  const listings: DiscoveredListing[] = []
  for (const attempt of attempts) {
    if (attempt.status !== 'fulfilled') continue
    const { candidate, result } = attempt.value
    if (!result.success || result.price === null || !result.name) continue
    // Only rupee prices are comparable — foreign stores would otherwise show
    // a USD number as if it were ₹.
    if (result.currency && result.currency !== 'INR') continue

    const score = nameSimilarity(productName, result.name)
    if (score < MATCH_CONFIDENCE_THRESHOLD) continue

    listings.push({
      domain: hostnameOf(candidate.url) || candidate.url,
      name: result.name,
      price: result.price,
      url: candidate.url,
      confidence: Math.round(score * 100) / 100,
    })
  }

  return listings.sort((a, b) => a.price - b.price)
}
