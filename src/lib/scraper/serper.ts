import { parsePrice, detectCurrency } from './price'

export interface SearchResult {
  title: string
  url: string
  content: string
  /** Some organic results carry a rich-snippet price (product pages). */
  price?: number | null
  currency?: string
}

export interface ShoppingResult {
  title: string
  source: string // merchant name as Google shows it, e.g. "Amazon.in", "Flipkart"
  url: string
  price: number | null
  currency: string
  image: string | null
  rating?: number
  ratingCount?: number
}

// Overridable so the whole pipeline can be exercised against a mock in tests.
const SERPER_BASE = (process.env.SERPER_BASE_URL || 'https://google.serper.dev').replace(/\/+$/, '')
const SERPER_TIMEOUT_MS = 8000

// Results default to India, since the app prices everything in ₹. Without
// this, Google returned US-centric results and USD prices that were then
// silently treated as rupees.
function locale() {
  return {
    gl: process.env.SERPER_GL || 'in',
    hl: process.env.SERPER_HL || 'en',
  }
}

export function serperConfigured(): boolean {
  return Boolean(process.env.SERPER_API_KEY)
}

async function callSerper<T>(endpoint: 'search' | 'shopping', body: Record<string, unknown>): Promise<T | null> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(`${SERPER_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...locale(), ...body }),
      signal: AbortSignal.timeout(SERPER_TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`Serper /${endpoint} failed:`, res.status, (await res.text()).slice(0, 300))
      return null
    }
    return (await res.json()) as T
  } catch (error) {
    console.error(`Serper /${endpoint} error:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Google organic search via Serper.dev. Site-restricted searches just use a
 * `site:domain.com query` string.
 */
export async function searchSerper(query: string, num = 10): Promise<SearchResult[]> {
  type Organic = {
    title?: string
    link?: string
    snippet?: string
    price?: string | number
    currency?: string
    attributes?: Record<string, string>
  }
  const data = await callSerper<{ organic?: Organic[] }>('search', { q: query, num })
  const organic = data?.organic || []

  return organic
    .filter((r) => typeof r.link === 'string')
    .map((r) => {
      const priceRaw = r.price ?? r.attributes?.Price ?? r.attributes?.price
      return {
        title: r.title || '',
        url: r.link as string,
        content: r.snippet || '',
        price: priceRaw !== undefined ? parsePrice(priceRaw) : null,
        currency: r.currency || (priceRaw !== undefined ? detectCurrency(priceRaw) : undefined),
      }
    })
}

/**
 * Google Shopping via Serper.dev. Each result already carries a merchant
 * and a price from the merchant's own product feed, so cross-platform
 * comparison doesn't depend on being able to scrape every store (most big
 * Indian stores block datacenter IPs like Vercel's).
 */
export async function searchShopping(query: string, num = 20): Promise<ShoppingResult[]> {
  type Shopping = {
    title?: string
    source?: string
    link?: string
    price?: string | number
    imageUrl?: string
    rating?: number
    ratingCount?: number
  }
  const data = await callSerper<{ shopping?: Shopping[] }>('shopping', { q: query, num })
  const items = data?.shopping || []

  return items
    .filter((r) => typeof r.link === 'string' && r.title)
    .map((r) => ({
      title: r.title as string,
      source: r.source || '',
      url: r.link as string,
      price: parsePrice(r.price),
      currency: detectCurrency(r.price),
      image: r.imageUrl || null,
      rating: r.rating,
      ratingCount: r.ratingCount,
    }))
}
