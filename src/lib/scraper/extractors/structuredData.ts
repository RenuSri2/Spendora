import * as cheerio from 'cheerio'
import { ExtractedRaw } from '../types'
import { parsePrice, detectCurrency } from '../price'

// JSON-LD payloads are arbitrary external data — no fixed shape to trust.
// `unknown` (not `any`) keeps that honest while still letting us narrow
// down to the bits we actually read.
type JsonLdNode = Record<string, unknown>

function isRecord(value: unknown): value is JsonLdNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasType(node: JsonLdNode, ...types: string[]): boolean {
  const t = node['@type']
  if (typeof t === 'string') return types.includes(t)
  if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && types.includes(x))
  return false
}

/**
 * Walks a JSON-LD graph looking for Product nodes. Sites nest these very
 * differently (top-level, inside @graph, inside mainEntity, as a
 * ProductGroup with hasVariant…), so walk everything rather than assuming
 * one fixed shape. Depth-limited so hostile payloads can't blow the stack.
 */
function collectProductNodes(json: unknown, out: JsonLdNode[] = [], depth = 0): JsonLdNode[] {
  if (!json || depth > 8) return out
  if (Array.isArray(json)) {
    for (const item of json) collectProductNodes(item, out, depth + 1)
    return out
  }
  if (!isRecord(json)) return out

  if (hasType(json, 'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel')) out.push(json)

  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item', 'hasVariant']) {
    if (json[key]) collectProductNodes(json[key], out, depth + 1)
  }
  return out
}

function firstOffer(offersRaw: unknown): JsonLdNode | null {
  if (Array.isArray(offersRaw)) {
    for (const o of offersRaw) {
      const found = firstOffer(o)
      if (found) return found
    }
    return null
  }
  if (!isRecord(offersRaw)) return null
  // AggregateOffer → may nest real offers; prefer a concrete price
  if (offersRaw.price !== undefined || offersRaw.lowPrice !== undefined) return offersRaw
  if (offersRaw.offers) return firstOffer(offersRaw.offers)
  if (isRecord(offersRaw.priceSpecification)) return offersRaw.priceSpecification
  return null
}

function imageOf(raw: unknown): string | null {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return imageOf(raw[0])
  if (isRecord(raw)) return (typeof raw.url === 'string' && raw.url) || (typeof raw.contentUrl === 'string' && raw.contentUrl) || null
  return null
}

function productFromNode(product: JsonLdNode): ExtractedRaw | null {
  let offer = firstOffer(product.offers)
  // ProductGroup: the price usually lives on a variant
  if (!offer && Array.isArray(product.hasVariant)) {
    for (const v of product.hasVariant) {
      if (isRecord(v)) {
        offer = firstOffer(v.offers)
        if (offer) break
      }
    }
  }
  const priceRaw = offer?.price ?? offer?.lowPrice
  const price = parsePrice(priceRaw)
  const currency =
    (typeof offer?.priceCurrency === 'string' && offer.priceCurrency) || detectCurrency(priceRaw)
  const name = typeof product.name === 'string' ? product.name.trim() : null
  const image = imageOf(product.image)

  if (name && price !== null) return { name, price, currency, image }
  return null
}

export function extractFromJsonLd(html: string): ExtractedRaw | null {
  const $ = cheerio.load(html)
  const scripts = $('script[type="application/ld+json"]')

  for (const el of scripts.toArray()) {
    const raw = $(el).contents().text()
    if (!raw) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      // some sites emit trailing commas / control chars — one cheap repair attempt
      try {
        parsed = JSON.parse(raw.trim().replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]/g, ' '))
      } catch {
        continue
      }
    }

    for (const node of collectProductNodes(parsed)) {
      const result = productFromNode(node)
      if (result) return result
    }
  }

  return null
}

export function extractFromOpenGraph(html: string): ExtractedRaw | null {
  const $ = cheerio.load(html)

  const metaContent = (prop: string) =>
    $(`meta[property="${prop}"]`).attr('content') ||
    $(`meta[name="${prop}"]`).attr('content') ||
    $(`meta[itemprop="${prop}"]`).attr('content') ||
    null

  const name = metaContent('og:title') || $('title').first().text().trim() || null

  const priceRaw =
    metaContent('product:price:amount') ||
    metaContent('og:price:amount') ||
    metaContent('price') || // schema.org microdata <meta itemprop="price">
    $('[itemprop="price"]').first().attr('content') ||
    null

  const price = priceRaw ? parsePrice(priceRaw) : null
  const currency =
    metaContent('product:price:currency') ||
    metaContent('og:price:currency') ||
    metaContent('priceCurrency') ||
    'INR'
  const image = metaContent('og:image')

  if (name && price !== null) {
    return { name, price, currency, image }
  }

  return null
}
