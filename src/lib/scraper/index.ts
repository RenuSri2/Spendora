import * as cheerio from 'cheerio'
import { browserHeaders } from './headers'
import { detectPlatform } from './detectPlatform'
import { extractFromJsonLd, extractFromOpenGraph } from './extractors/structuredData'
import { extractFromPlatformSelectors } from './platforms'
import { renderHtml, renderAvailable } from './renderer'
import { fetchViaUnblocker, unblockerAvailable, premiumPlan } from './unblocker'
import { DataSource, ExtractedRaw, Platform, ProductResult } from './types'

const DEFAULT_FETCH_TIMEOUT_MS = 8000
const DEFAULT_RENDER_TIMEOUT_MS = 15000

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

export interface ScrapeOptions {
  /** Allow escalating to the Lightpanda render tier. Default true. */
  allowRender?: boolean
  /** Allow the paid scraping-API tier (residential proxies). Default true. */
  allowUnblock?: boolean
  unblockTimeoutMs?: number
  fetchTimeoutMs?: number
  renderTimeoutMs?: number
}

class FetchError extends Error {
  constructor(message: string, public finalUrl?: string, public blocked = false) {
    super(message)
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<{ html: string; finalUrl: string }> {
  try {
    const res = await fetch(url, {
      headers: browserHeaders(),
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })

    if (!res.ok) {
      // 403/503/429 here almost always means bot-detection, not a bad URL —
      // surface that distinction to the caller instead of a generic error.
      const blocked = res.status === 403 || res.status === 503 || res.status === 429
      throw new FetchError(
        blocked
          ? `Site blocked the request (HTTP ${res.status}) — likely bot detection`
          : `Failed to fetch page (HTTP ${res.status})`,
        res.url || url,
        blocked
      )
    }

    return { html: await res.text(), finalUrl: res.url || url }
  } catch (err) {
    if (err instanceof FetchError) throw err
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new FetchError(`Timed out after ${Math.round(timeoutMs / 1000)}s fetching the page`, url)
    }
    throw new FetchError(err instanceof Error ? err.message : 'Failed to fetch page', url)
  }
}

export function looksLikeBlockPage(html: string): boolean {
  // Only look at the start of the document + title, so a product page that
  // merely mentions "captcha" in a footer script isn't flagged.
  const head = html.slice(0, 20000)
  return /captcha|robot check|access denied|are you a human|unusual traffic|verify you are a human|attention required|pardon our interruption|just a moment\.\.\./i.test(
    head
  )
}

interface ExtractionAttempt {
  result: ExtractedRaw | null
  source: Exclude<DataSource, 'search-listing'> | null
  blocked: boolean
  htmlLength: number
  pageTitle: string
}

/**
 * Runs all three extraction tiers against a given HTML string. Shared by
 * both the fast-path (plain fetch) and the fallback (Lightpanda-rendered)
 * HTML so the extraction logic itself only lives in one place.
 */
export function tryExtract(html: string, platform: Platform): ExtractionAttempt {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const pageTitle = titleMatch?.[1]?.trim() || '(no title found)'
  const blocked = looksLikeBlockPage(html)
  const meta = { blocked, htmlLength: html.length, pageTitle }

  if (KNOWN_PLATFORMS_PREFER_SELECTORS.has(platform)) {
    const $ = cheerio.load(html)
    const platformResult = extractFromPlatformSelectors($, platform)
    if (platformResult) return { result: platformResult, source: 'platform-selector', ...meta }
  }

  const jsonLd = extractFromJsonLd(html)
  if (jsonLd) return { result: jsonLd, source: 'json-ld', ...meta }

  const og = extractFromOpenGraph(html)
  if (og) return { result: og, source: 'og-meta', ...meta }

  return { result: null, source: null, ...meta }
}

function toSuccess(
  base: Omit<ProductResult, 'success' | 'name' | 'price' | 'source'>,
  attempt: ExtractionAttempt,
  extra: Partial<ProductResult>
): ProductResult {
  return {
    ...base,
    success: true,
    name: attempt.result?.name ?? null,
    price: attempt.result?.price ?? null,
    currency: attempt.result?.currency || base.currency,
    image: attempt.result?.image ?? null,
    source: attempt.source,
    ...extra,
  }
}

export async function scrapeProduct(url: string, options: ScrapeOptions = {}): Promise<ProductResult> {
  const {
    allowRender = true,
    allowUnblock = true,
    fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    renderTimeoutMs = DEFAULT_RENDER_TIMEOUT_MS,
    unblockTimeoutMs = 20_000,
  } = options

  let platform = detectPlatform(url)
  const base: Omit<ProductResult, 'success' | 'name' | 'price' | 'source'> = {
    platform,
    url,
    currency: 'INR',
    image: null,
  }

  // ---- Fast path: plain fetch ----
  let fastAttempt: ExtractionAttempt | null = null
  let fastPathError: string | null = null
  let fetchBlocked = false

  try {
    const { html, finalUrl } = await fetchHtml(url, fetchTimeoutMs)
    base.finalUrl = finalUrl
    // Short links (amzn.in, fkrt.it…) only reveal the platform after redirect.
    if (platform === 'generic') {
      platform = detectPlatform(finalUrl)
      base.platform = platform
    }
    fastAttempt = tryExtract(html, platform)
  } catch (err) {
    fastPathError = err instanceof Error ? err.message : 'Failed to fetch page'
    if (err instanceof FetchError) {
      fetchBlocked = err.blocked
      if (err.finalUrl) base.finalUrl = err.finalUrl
      if (platform === 'generic' && err.finalUrl) {
        platform = detectPlatform(err.finalUrl)
        base.platform = platform
      }
    }
    console.warn(`[scraper] fast path failed for ${url}: ${fastPathError}`)
  }

  if (fastAttempt?.result && !fastAttempt.blocked) {
    return toSuccess(base, fastAttempt, { renderedWithBrowser: false })
  }

  // ---- Fallbacks ----
  // Lightpanda fixes JS-rendered pages but not IP blocks (it sends an honest
  // UA from the same datacenter IP). A scraping API fixes IP blocks. So:
  // blocked → scraping API first; merely empty → Lightpanda first.
  let renderAttempt: ExtractionAttempt | null = null
  let renderError: string | null = null
  let renderBackend: string | undefined
  const wasBlocked = fetchBlocked || Boolean(fastAttempt?.blocked)

  const tryLightpanda = async (): Promise<ProductResult | null> => {
    if (!allowRender) return null
    if (!renderAvailable()) {
      renderError = renderError ?? 'no browser renderer configured'
      return null
    }
    console.warn(
      `[scraper] escalating to Lightpanda render for ${url} ` +
        `(fast path: ${fastPathError ?? (fastAttempt?.blocked ? 'blocked page' : 'no data extracted')})`
    )
    try {
      const rendered = await renderHtml(base.finalUrl || url, renderTimeoutMs)
      renderBackend = rendered.backend
      if (rendered.finalUrl) base.finalUrl = rendered.finalUrl
      renderAttempt = tryExtract(rendered.html, platform)
    } catch (err) {
      renderError = err instanceof Error ? err.message : 'Render failed'
      console.error(`[scraper] render fallback failed for ${url}: ${renderError}`)
    }
    if (renderAttempt?.result && !renderAttempt.blocked) {
      return toSuccess(base, renderAttempt, { renderedWithBrowser: true, renderBackend })
    }
    return null
  }

  const tryUnblocker = async (): Promise<ProductResult | null> => {
    if (!allowUnblock || !unblockerAvailable()) return null
    const plan = premiumPlan()
    const deadline = Date.now() + unblockTimeoutMs
    for (let i = 0; i < plan.length; i++) {
      const premium = plan[i]
      const remaining = deadline - Date.now()
      if (remaining < 3000) break
      // Leave room for the premium retry when the cheap attempt comes first.
      const budget = i < plan.length - 1 ? Math.min(remaining, Math.max(6000, remaining / 2)) : remaining
      try {
        const { html, provider } = await fetchViaUnblocker(base.finalUrl || url, budget, premium)
        const attempt = tryExtract(html, platform)
        if (attempt.result && !attempt.blocked) {
          return toSuccess(base, attempt, {
            renderedWithBrowser: false,
            renderBackend: `scraping-api:${provider}${premium ? ':premium' : ''}`,
          })
        }
        renderAttempt = renderAttempt ?? attempt
        renderError = `${provider}${premium ? ' (premium)' : ''}: ${attempt.blocked ? 'still got a bot-check page' : 'no product data in page'}`
        // A page that loaded fine but has no product data won't improve with premium.
        if (!attempt.blocked) break
      } catch (err) {
        renderError = err instanceof Error ? err.message : 'Scraping API failed'
        console.error(`[scraper] scraping API failed for ${url}: ${renderError}`)
        if (/unauthorized|out of credits/i.test(renderError)) break
      }
    }
    return null
  }

  for (const tier of wasBlocked ? [tryUnblocker, tryLightpanda] : [tryLightpanda, tryUnblocker]) {
    const result = await tier()
    if (result) return result
  }

  // ---- Explicit, honest failure — no random/fabricated fallback data ----
  const finalAttempt = renderAttempt ?? fastAttempt
  const looksBlocked = fetchBlocked || (finalAttempt?.blocked ?? false)

  console.error(
    `[scraper] all extraction tiers failed for ${url}\n` +
      `  platform: ${platform}\n` +
      `  fast path error: ${fastPathError ?? 'n/a'}\n` +
      `  render fallback: ${renderError ?? (allowRender ? 'n/a' : 'skipped')}\n` +
      `  page title: "${finalAttempt?.pageTitle ?? 'n/a'}"\n` +
      `  looks like a bot-block/CAPTCHA page: ${looksBlocked}`
  )

  return {
    ...base,
    success: false,
    name: null,
    price: null,
    source: null,
    renderedWithBrowser: Boolean(renderAttempt),
    renderBackend,
    blocked: looksBlocked,
    error: looksBlocked
      ? 'The site returned a bot-detection/CAPTCHA page instead of the product page.'
      : fastPathError || renderError || 'Could not extract product data — the page markup may have changed.',
  }
}
