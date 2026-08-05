import * as cheerio from 'cheerio'
import { browserHeaders } from './headers'
import { detectPlatform } from './detectPlatform'
import { extractFromJsonLd, extractFromOpenGraph } from './extractors/structuredData'
import { extractFromPlatformSelectors } from './platforms'
import { fetchHtmlWithBrowser } from './browserFetch'
import { ExtractedRaw, Platform, ProductResult } from './types'

const FETCH_TIMEOUT_MS = 8000

// For platforms we have hand-verified selectors for, try those FIRST.
// Reason: Amazon/Flipkart's JSON-LD and Open Graph tags frequently carry
// the MRP/list price (populated for SEO), while the actual selling price
// only exists in the rendered DOM. Structured data "succeeding" with the
// wrong number is worse than it failing, so known platforms skip straight
// to the selectors that specifically target the buybox/sale price.
const KNOWN_PLATFORMS_PREFER_SELECTORS = new Set<Platform>([
  'amazon',
  'flipkart',
  'myntra',
  'nykaa',
  'croma',
])

class BlockedError extends Error {}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: browserHeaders(),
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!res.ok) {
      // 403/503 here almost always means bot-detection, not a bad URL —
      // surface that distinction to the caller instead of a generic error.
      if (res.status === 403 || res.status === 503) {
        throw new BlockedError(`Site blocked the request (HTTP ${res.status}) — likely bot detection`)
      }
      throw new Error(`Failed to fetch page (HTTP ${res.status})`)
    }

    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

function looksLikeBlockPage(html: string): boolean {
  return /captcha|robot check|access denied|are you a human|unusual traffic|verify you are a human/i.test(
    html
  )
}

interface ExtractionAttempt {
  result: ExtractedRaw | null
  source: 'json-ld' | 'og-meta' | 'platform-selector' | null
  blocked: boolean
  htmlLength: number
  pageTitle: string
}

/**
 * Runs all three extraction tiers against a given HTML string. Shared by
 * both the fast-path (plain fetch) and the fallback (browser-rendered) HTML
 * so the extraction logic itself only lives in one place.
 */
function tryExtract(html: string, platform: Platform): ExtractionAttempt {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const pageTitle = titleMatch?.[1]?.trim() || '(no title found)'
  const blocked = looksLikeBlockPage(html)

  if (KNOWN_PLATFORMS_PREFER_SELECTORS.has(platform)) {
    const $ = cheerio.load(html)
    const platformResult = extractFromPlatformSelectors($, platform)
    if (platformResult) {
      return { result: platformResult, source: 'platform-selector', blocked, htmlLength: html.length, pageTitle }
    }
  }

  const jsonLd = extractFromJsonLd(html)
  if (jsonLd) {
    return { result: jsonLd, source: 'json-ld', blocked, htmlLength: html.length, pageTitle }
  }

  const og = extractFromOpenGraph(html)
  if (og) {
    return { result: og, source: 'og-meta', blocked, htmlLength: html.length, pageTitle }
  }

  // Reachable for 'generic' sites (known platforms already tried selectors
  // above), or as a last resort if a known platform's selectors are stale.
  const $ = cheerio.load(html)
  const platformResult = extractFromPlatformSelectors($, platform)
  if (platformResult) {
    return { result: platformResult, source: 'platform-selector', blocked, htmlLength: html.length, pageTitle }
  }

  return { result: null, source: null, blocked, htmlLength: html.length, pageTitle }
}

export async function scrapeProduct(url: string): Promise<ProductResult> {
  const platform = detectPlatform(url)

  const base: Omit<ProductResult, 'success' | 'name' | 'price' | 'source'> = {
    platform,
    url,
    currency: 'INR',
    image: null,
  }

  // ---- Fast path: plain fetch ----
  let fastAttempt: ExtractionAttempt | null = null
  let fastPathError: string | null = null

  try {
    const html = await fetchHtml(url)
    fastAttempt = tryExtract(html, platform)
  } catch (err) {
    fastPathError = err instanceof Error ? err.message : 'Failed to fetch page'
    console.warn(`[scraper] fast path failed for ${url}: ${fastPathError}`)
  }

  if (fastAttempt?.result && !fastAttempt.blocked) {
    return {
      ...base,
      success: true,
      name: fastAttempt.result.name ?? null,
      price: fastAttempt.result.price ?? null,
      currency: fastAttempt.result.currency || base.currency,
      image: fastAttempt.result.image ?? null,
      source: fastAttempt.source,
      renderedWithBrowser: false,
    }
  }

  // ---- Fallback: real headless browser (handles bot-walls + JS-rendered
  // pages that plain fetch can't get past) ----
  console.warn(
    `[scraper] escalating to browser render for ${url} ` +
      `(fast path: ${fastPathError ?? (fastAttempt?.blocked ? 'blocked page' : 'no data extracted')})`
  )

  let browserAttempt: ExtractionAttempt | null = null
  let browserError: string | null = null

  try {
    const html = await fetchHtmlWithBrowser(url)
    browserAttempt = tryExtract(html, platform)
  } catch (err) {
    browserError = err instanceof Error ? err.message : 'Browser render failed'
    console.error(`[scraper] browser fallback failed for ${url}: ${browserError}`)
  }

  if (browserAttempt?.result) {
    return {
      ...base,
      success: true,
      name: browserAttempt.result.name ?? null,
      price: browserAttempt.result.price ?? null,
      currency: browserAttempt.result.currency || base.currency,
      image: browserAttempt.result.image ?? null,
      source: browserAttempt.source,
      renderedWithBrowser: true,
    }
  }

  // ---- Explicit, honest failure — no random/fabricated fallback data ----
  const finalAttempt = browserAttempt ?? fastAttempt
  const looksBlocked = finalAttempt?.blocked ?? false

  console.error(
    `[scraper] all extraction tiers failed for ${url}\n` +
      `  platform: ${platform}\n` +
      `  fast path error: ${fastPathError ?? 'n/a'}\n` +
      `  browser fallback error: ${browserError ?? 'n/a'}\n` +
      `  page title: "${finalAttempt?.pageTitle ?? 'n/a'}"\n` +
      `  looks like a bot-block/CAPTCHA page: ${looksBlocked}`
  )

  return {
    ...base,
    success: false,
    name: null,
    price: null,
    source: null,
    renderedWithBrowser: Boolean(browserAttempt),
    error: looksBlocked
      ? 'Site returned a bot-detection/CAPTCHA page instead of the product page, even after a browser retry.'
      : browserError || fastPathError || 'Could not extract product data — the page markup may have changed.',
  }
}
