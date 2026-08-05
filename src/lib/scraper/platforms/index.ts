import { CheerioAPI } from 'cheerio'
import { ExtractedRaw, Platform } from '../types'

function firstMatch($: CheerioAPI, selectors: string[]): string | null {
  for (const sel of selectors) {
    const text = $(sel).first().text().trim()
    if (text) return text
  }
  return null
}

function firstAttr(
  $: CheerioAPI,
  selectors: string[],
  attr: string
): string | null {
  for (const sel of selectors) {
    const val = $(sel).first().attr(attr)
    if (val) return val
  }
  return null
}

function parsePrice(raw: string | null): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d.]/g, '')
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

// NOTE: these selectors are current as of research at build time. E-commerce
// sites change markup often (especially Amazon/Flipkart, which run frequent
// A/B tests on PDP layout) — treat this file as something to re-verify and
// patch periodically, not a one-time fix. Each field tries several known
// selector variants in order, so a single markup tweak on the site doesn't
// break extraction outright.

const PLATFORM_SELECTORS: Record<
  Exclude<Platform, 'generic'>,
  { name: string[]; price: string[]; image: string[] }
> = {
  amazon: {
    name: ['#productTitle', 'span#productTitle', 'h1.product-title-word-break'],
    price: [
      // IMPORTANT: Amazon marks the crossed-out MRP with an extra
      // `a-text-price` class on the same `.a-price` wrapper used for the
      // real selling price. `:not(.a-text-price)` is what keeps this from
      // randomly grabbing the MRP depending on DOM order. Buybox-specific
      // selectors are listed first since they're the most trustworthy.
      'span.priceToPay .a-offscreen',
      '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price:not(.a-text-price) .a-offscreen',
    ],
    image: ['#landingImage', '#imgTagWrapperId img'],
  },
  flipkart: {
    name: ['span.VU-ZEz', 'span.B_NuCI', 'h1 span.yhB1nd'],
    // Flipkart's strikethrough MRP uses different classes (e.g. `_3I9_wc`,
    // `yRaY8j`) from the selling price (`_30jeq3` / `Nx9bqj`), so these are
    // already selling-price-specific — kept as-is, just reordered so the
    // most current class names are tried first.
    price: ['div.Nx9bqj.CxhGGd', 'div._30jeq3._16Jk6d', 'div._30jeq3'],
    image: ['img.DByuf4', 'img._396cs4'],
  },
  myntra: {
    name: ['h1.pdp-title', 'h1.pdp-name', '.pdp-product-name'],
    price: ['.pdp-price strong', 'span.pdp-price'],
    image: ['picture.image-grid-image img', 'img.image-grid-imageContainer'],
  },
  nykaa: {
    name: ['h1.css-1gc4x7i', 'div.product-title h1', 'h1[class*="title"]'],
    price: [
      'span.css-1jczs19',
      'span[class*="post-card"]',
      'div.product-price span',
    ],
    image: ['img.css-1n4l0mh', 'div.product-image img'],
  },
  croma: {
    name: ['h1.pdp-e-i-head', 'h1[class*="product-title"]'],
    price: ['span.amount', 'span[class*="pdp-price"]', 'span.new-price'],
    image: ['img.pdp-image', 'div.pdp-image-wrapper img'],
  },
}

export function extractFromPlatformSelectors(
  $: CheerioAPI,
  platform: Platform
): ExtractedRaw | null {
  if (platform === 'generic') return null

  const config = PLATFORM_SELECTORS[platform]
  const name = firstMatch($, config.name)
  const priceRaw = firstMatch($, config.price)
  const price = parsePrice(priceRaw)
  const image = firstAttr($, config.image, 'src')

  if (name && price !== null) {
    return { name, price, currency: 'INR', image }
  }

  return null
}
