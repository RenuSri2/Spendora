import { NextRequest, NextResponse } from 'next/server'
import { scrapeProduct } from '@/lib/scraper'
import { compareAcrossPlatforms, ComparisonOutcome } from '@/lib/scraper/compare'
import { asinFromUrl, nameHintFromUrl } from '@/lib/scraper/match'
import { searchSerper, serperConfigured } from '@/lib/scraper/serper'
import { availableBackends } from '@/lib/scraper/renderer'
import { unblockerProvider } from '@/lib/scraper/unblocker'
import { detectPlatform } from '@/lib/scraper/detectPlatform'
import { generateProductInsight, hfConfigured } from '@/lib/ai/productInsight'
import { computeValueScore, computeDataConfidence } from '@/lib/scoring'
import { prisma } from '@/lib/prisma'
import type { DataSource, Platform } from '@/lib/scraper/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Vercel: allow up to 60s (Hobby max without fluid compute). Everything
// below runs against an internal ~52s budget so the response always comes
// back as JSON instead of a platform 504 HTML page.
export const maxDuration = 60

const TOTAL_BUDGET_MS = Number(process.env.ANALYSIS_BUDGET_MS) || 52_000

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Store pages append " : Amazon.in: Electronics", " | Flipkart.com" etc. */
function cleanSearchTitle(title: string): string {
  return title
    .split(/\s+[:|]\s+(?:Amazon|Flipkart|Myntra|Nykaa|Croma|Buy\b)/i)[0]
    .replace(/^Buy\s+/i, '')
    .replace(/\s+-\s+Buy .*$/i, '')
    .replace(/\s+Online at .*$/i, '')
    .trim()
}

/**
 * When the store page blocks us, find out what the product is anyway:
 * a Google search for the ASIN / URL usually returns the listing itself.
 */
async function identifyFromSearch(url: string): Promise<{ name: string; price: number | null } | null> {
  if (!serperConfigured()) return null
  const host = hostOf(url)
  const asin = asinFromUrl(url)
  const query = asin ? `${asin}${host ? ` site:${host}` : ''}` : url
  const results = await searchSerper(query, 5)
  const sameSite = results.find((r) => host && hostOf(r.url)?.endsWith(host.replace(/^m\./, ''))) || results[0]
  if (!sameSite?.title) return null
  const name = cleanSearchTitle(sameSite.title)
  if (name.length < 4) return null
  return { name, price: typeof sameSite.price === 'number' && (sameSite.currency ?? 'INR') === 'INR' ? sameSite.price : null }
}

async function persistSnapshot(params: {
  url: string
  platform: string
  name: string
  image: string | null
  price: number
  currency: string
  source: string
}): Promise<Array<{ price: number; capturedAt: Date }> | null> {
  if (!process.env.DATABASE_URL) return null
  const work = (async () => {
    const tracked = await prisma.trackedProduct.upsert({
      where: { url: params.url },
      update: { name: params.name, platform: params.platform, image: params.image ?? undefined },
      create: { url: params.url, platform: params.platform, name: params.name, image: params.image ?? undefined },
    })
    await prisma.priceSnapshot.create({
      data: { productId: tracked.id, price: params.price, currency: params.currency, source: params.source },
    })
    return prisma.priceSnapshot.findMany({
      where: { productId: tracked.id },
      orderBy: { capturedAt: 'asc' },
      select: { price: true, capturedAt: true },
    })
  })()
  // History is nice-to-have: a slow/broken database must not break analysis.
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
  ]).catch((err) => {
    console.error('[ai-analysis] price history unavailable:', err instanceof Error ? err.message : err)
    return null
  })
}

/** GET /api/ai-analysis — which parts of the pipeline are configured (no secrets). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    search: serperConfigured(),
    ai: hfConfigured(),
    aiModels: process.env.HF_MODEL || 'default chain',
    renderBackends: availableBackends(),
    scrapingApi: unblockerProvider(),
    database: Boolean(process.env.DATABASE_URL),
    node: process.version,
  })
}

export async function POST(request: NextRequest) {
  const started = Date.now()
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - started)

  let productUrl: string
  try {
    const body = await request.json()
    productUrl = String(body?.productUrl || '').trim()
  } catch {
    return NextResponse.json({ success: false, error: 'Request body must be JSON: { "productUrl": "…" }' }, { status: 400 })
  }

  if (!productUrl) {
    return NextResponse.json({ success: false, error: 'Product URL is required' }, { status: 400 })
  }
  if (!/^https?:\/\//i.test(productUrl)) productUrl = `https://${productUrl}`

  try {
    const url = new URL(productUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid URL format. Please provide a valid product URL.' },
      { status: 400 }
    )
  }

  try {
    // ---- 1. Origin listing ----
    const scraped = await scrapeProduct(productUrl, { fetchTimeoutMs: 8000, renderTimeoutMs: 12000, unblockTimeoutMs: 18000 })
    const canonicalUrl = scraped.finalUrl || productUrl
    const platform: Platform = scraped.platform !== 'generic' ? scraped.platform : detectPlatform(canonicalUrl)

    let name = scraped.success ? scraped.name : null
    let price = scraped.success ? scraped.price : null
    let currency = scraped.currency || 'INR'
    let dataSource: DataSource | null = scraped.success ? scraped.source : null
    const notes: string[] = []

    if (!scraped.success) {
      notes.push(`Couldn't read the store page directly: ${scraped.error}`)
      // Identify the product some other way so comparison + AI still run.
      const fromSearch = await identifyFromSearch(canonicalUrl).catch(() => null)
      name = fromSearch?.name || nameHintFromUrl(canonicalUrl) || nameHintFromUrl(productUrl)
      if (fromSearch?.price) {
        price = fromSearch.price
        dataSource = 'search-listing'
      }
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          platform,
          error:
            (scraped.error || 'Could not extract product name and price from this link.') +
            (serperConfigured() ? '' : ' (Tip: set SERPER_API_KEY so blocked pages can still be identified via search.)'),
        },
        { status: 422 }
      )
    }

    // ---- 2. Cross-platform comparison (bounded) ----
    const compareBudget = Math.max(5000, Math.min(25_000, remaining() - 14_000))
    let outcome: ComparisonOutcome
    try {
      outcome = await compareAcrossPlatforms(name, canonicalUrl, platform, { budgetMs: compareBudget, referencePrice: price })
    } catch (err) {
      console.error('[ai-analysis] comparison failed:', err)
      outcome = {
        comparisons: [],
        originListing: null,
        diagnostics: { searchConfigured: serperConfigured(), renderAvailable: false, shoppingResults: 0, timedOut: [], tookMs: 0 },
      }
      notes.push('Price comparison failed unexpectedly')
    }

    // Origin page blocked + no snippet price → use its own Google Shopping listing.
    if (price === null && outcome.originListing?.price) {
      price = outcome.originListing.price
      currency = outcome.originListing.currency
      dataSource = 'search-listing'
    }
    if (dataSource === 'search-listing') {
      notes.push("Price shown is the store's Google Shopping listing price, not read from the live page")
    }

    // ---- 3. Price history (only for real prices) ----
    const history =
      price !== null
        ? await persistSnapshot({
            url: productUrl,
            platform,
            name,
            image: scraped.image,
            price,
            currency,
            source: dataSource ?? 'unknown',
          })
        : null
    const historyPoints = history ?? (price !== null ? [{ price, capturedAt: new Date() }] : [])

    const comparison = outcome.comparisons
    const matched = comparison.filter((c) => c.matched && c.price !== null)

    const valueScore = computeValueScore(
      price,
      comparison.map((c) => ({ matched: c.matched, price: c.price })),
      historyPoints.map((h) => ({ price: h.price }))
    )
    const dataConfidence = computeDataConfidence(dataSource, matched.length)

    // ---- 4. AI narrative (HF), with rule-based fallback ----
    const insightResult = await generateProductInsight(
      {
        name,
        price,
        currency,
        platform,
        priceSource: dataSource,
        priceHistory: historyPoints.map((h) => ({ price: h.price, capturedAt: h.capturedAt.toISOString() })),
        comparison: matched.map((c) => ({ platform: c.label, price: c.price as number })),
        valueScoreLabel: valueScore.label,
      },
      { budgetMs: Math.max(3000, remaining() - 1500) }
    )

    return NextResponse.json({
      success: true,
      partial: price === null || dataSource === 'search-listing',
      product: {
        name,
        price,
        currency,
        image: scraped.image,
        platform,
        url: productUrl,
        dataSource, // 'json-ld' | 'og-meta' | 'platform-selector' | 'search-listing' | null
      },
      priceHistory: historyPoints.map((h) => ({ price: h.price, date: h.capturedAt.toISOString() })),
      comparison, // per-platform: matched product + real price, or an honest reason it couldn't match
      valueScore, // deterministic 0-100 score + plain-English basis, not an LLM guess
      dataConfidence, // how reliable the scraped data itself is (source tier + match count)
      insight: insightResult.insight,
      notes,
      meta: {
        insightSource: insightResult.source,
        insightModel: insightResult.model ?? null,
        insightError: insightResult.error ?? null,
        renderedWithBrowser: Boolean(scraped.renderedWithBrowser),
        renderBackend: scraped.renderBackend ?? null,
        historyStored: history !== null,
        comparison: outcome.diagnostics,
        tookMs: Date.now() - started,
      },
    })
  } catch (err) {
    console.error('[ai-analysis] unexpected failure:', err)
    return NextResponse.json(
      { success: false, error: 'Something went wrong while analysing this product. Please try again.' },
      { status: 500 }
    )
  }
}
