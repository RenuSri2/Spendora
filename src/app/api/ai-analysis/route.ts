import { NextRequest, NextResponse } from 'next/server'
import { scrapeProduct } from '@/lib/scraper'
import { compareAcrossPlatforms } from '@/lib/scraper/compare'
import { generateProductInsight } from '@/lib/ai/productInsight'
import { computeValueScore, computeDataConfidence } from '@/lib/scoring'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { productUrl } = await request.json()

  if (!productUrl) {
    return NextResponse.json({ error: 'Product URL is required' }, { status: 400 })
  }

  try {
    const url = new URL(productUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format. Please provide a valid product URL.' },
      { status: 400 }
    )
  }

  const scraped = await scrapeProduct(productUrl)

  if (!scraped.success || scraped.price === null || !scraped.name) {
    // Honest failure — no fallback to fabricated data.
    return NextResponse.json(
      {
        success: false,
        error: scraped.error || 'Could not extract product name and price from this link.',
        platform: scraped.platform,
      },
      { status: 422 }
    )
  }

  // Upsert the tracked product and append a real price snapshot. This is
  // how price history accumulates — genuinely, over repeated checks — rather
  // than being generated on the spot.
  const tracked = await prisma.trackedProduct.upsert({
    where: { url: productUrl },
    update: { name: scraped.name, platform: scraped.platform, image: scraped.image ?? undefined },
    create: {
      url: productUrl,
      platform: scraped.platform,
      name: scraped.name,
      image: scraped.image ?? undefined,
    },
  })

  await prisma.priceSnapshot.create({
    data: {
      productId: tracked.id,
      price: scraped.price,
      currency: scraped.currency,
      source: scraped.source ?? 'unknown',
    },
  })

  const history = await prisma.priceSnapshot.findMany({
    where: { productId: tracked.id },
    orderBy: { capturedAt: 'asc' },
    select: { price: true, capturedAt: true },
  })

  const comparison = await compareAcrossPlatforms(scraped.name, productUrl, scraped.platform)

  const valueScore = computeValueScore(
    scraped.price,
    comparison.map((c) => ({ matched: c.matched, price: c.price })),
    history.map((h: { price: number }) => ({ price: h.price }))
  )
  const dataConfidence = computeDataConfidence(
    scraped.source,
    comparison.filter((c) => c.matched).length
  )

  const insight = await generateProductInsight({
    name: scraped.name,
    price: scraped.price,
    currency: scraped.currency,
    platform: scraped.platform,
    priceHistory: history.map((h: { price: number; capturedAt: Date }) => ({
      price: h.price,
      capturedAt: h.capturedAt.toISOString(),
    })),
    comparison: comparison
      .filter((c) => c.matched)
      .map((c) => ({ platform: c.platform, price: c.price as number })),
    valueScoreLabel: valueScore.label,
  })

  return NextResponse.json({
    success: true,
    product: {
      name: scraped.name,
      price: scraped.price,
      currency: scraped.currency,
      image: scraped.image,
      platform: scraped.platform,
      url: productUrl,
      dataSource: scraped.source, // 'json-ld' | 'og-meta' | 'platform-selector' — transparent about how we got it
    },
    priceHistory: history.map((h: { price: number; capturedAt: Date }) => ({
      price: h.price,
      date: h.capturedAt.toISOString(),
    })),
    comparison, // per-platform: matched product + real price, or an honest reason it couldn't match
    valueScore, // deterministic 0-100 score + plain-English basis, not an LLM guess
    dataConfidence, // how reliable the scraped data itself is (source tier + match count)
    insight, // null if HF_API_TOKEN isn't set or generation failed — frontend should handle that gracefully
  })
}
