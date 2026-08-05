import { Platform } from './types'
import { searchSerper, SearchResult } from './serper'

export type { SearchResult }

export const PLATFORM_DOMAINS: Record<Exclude<Platform, 'generic'>, string> = {
  amazon: 'amazon.in',
  flipkart: 'flipkart.com',
  myntra: 'myntra.com',
  nykaa: 'nykaa.com',
  croma: 'croma.com',
}

export const ALL_PLATFORMS: Exclude<Platform, 'generic'>[] = [
  'amazon', 'flipkart', 'myntra', 'nykaa', 'croma',
]

/**
 * Searches for a product name restricted to one platform's domain via
 * Serper, so we find a real candidate product URL on that site instead of
 * scraping that site's fragile search-results page directly. The
 * candidate URL then gets run through our existing scrapeProduct() for the
 * actual price (JSON-LD etc).
 */
export async function searchPlatform(
  productName: string,
  platform: Exclude<Platform, 'generic'>
): Promise<SearchResult[]> {
  const domain = PLATFORM_DOMAINS[platform]
  const query = `site:${domain} ${productName}`

  const results = await searchSerper(query)
  return results.filter((r) => r.url.includes(domain)).slice(0, 5)
}
