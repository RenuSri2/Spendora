import * as cheerio from 'cheerio'
import { ExtractedRaw } from '../types'

// JSON-LD payloads are arbitrary external data — no fixed shape to trust.
// `unknown` (not `any`) keeps that honest while still letting us narrow
// down to the bits we actually read.
type JsonLdNode = Record<string, unknown>

function isRecord(value: unknown): value is JsonLdNode {
  return typeof value === 'object' && value !== null
}

/**
 * Walks a JSON-LD graph looking for a Product node (or an @graph containing one).
 * Sites nest this differently, so we check a few common shapes rather than
 * assuming one fixed structure.
 */
function findProductNode(json: unknown): JsonLdNode | null {
  if (!json) return null

  if (isRecord(json)) {
    const type = json['@type']
    const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'))
    if (isProduct) return json

    if (Array.isArray(json['@graph'])) {
      return findProductNode(json['@graph'])
    }
  }

  if (Array.isArray(json)) {
    for (const item of json) {
      const found = findProductNode(item)
      if (found) return found
    }
  }

  return null
}

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const cleaned = String(raw).replace(/[^\d.]/g, '')
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

export function extractFromJsonLd(html: string): ExtractedRaw | null {
  const $ = cheerio.load(html)
  const scripts = $('script[type="application/ld+json"]')

  for (const el of scripts.toArray()) {
    const raw = $(el).contents().text()
    if (!raw) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue // some sites emit malformed JSON-LD, just skip it
    }

    const product = findProductNode(parsed)
    if (!product) continue

    const offersRaw = product.offers
    const offer = isRecord(offersRaw)
      ? offersRaw
      : Array.isArray(offersRaw) && isRecord(offersRaw[0])
        ? (offersRaw[0] as JsonLdNode)
        : null

    const price = parsePrice(offer?.price ?? offer?.lowPrice)
    const currency = (typeof offer?.priceCurrency === 'string' && offer.priceCurrency) || 'INR'
    const name = typeof product.name === 'string' ? product.name : null
    const imageRaw = product.image
    const image =
      (Array.isArray(imageRaw) ? imageRaw[0] : imageRaw) as string | undefined ?? null

    if (name && price !== null) {
      return { name, price, currency, image }
    }
  }

  return null
}

export function extractFromOpenGraph(html: string): ExtractedRaw | null {
  const $ = cheerio.load(html)

  const metaContent = (prop: string) =>
    $(`meta[property="${prop}"]`).attr('content') ||
    $(`meta[name="${prop}"]`).attr('content') ||
    null

  const name = metaContent('og:title') || $('title').first().text() || null

  const priceRaw =
    metaContent('product:price:amount') ||
    metaContent('og:price:amount') ||
    metaContent('twitter:data1') // some sites stash price here

  const price = priceRaw ? parsePrice(priceRaw) : null
  const currency =
    metaContent('product:price:currency') ||
    metaContent('og:price:currency') ||
    'INR'
  const image = metaContent('og:image')

  if (name && price !== null) {
    return { name, price, currency, image }
  }

  return null
}
