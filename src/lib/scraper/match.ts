// Product names differ across platforms ("Nike Air Max 90 White UK 9" vs
// "Nike Air Max 90 - White - Men's UK9"), so exact string matching would
// miss almost everything. This blends token-overlap measures — good enough
// to rank candidates, not good enough to claim certainty. Callers should
// treat the score as a confidence signal, not proof.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'for', 'with', 'and', 'or', 'in', 'of', 'by', 'to', 'on', 'at', 'from',
  'buy', 'online', 'best', 'price', 'india', 'new', 'latest', 'free', 'delivery', 'shipping',
  'offer', 'offers', 'deal', 'deals', 'sale', 'shop', 'store', 'official', 'original', 'genuine',
  'pack', 'combo', 'men', 'mens', 'women', 'womens', 'unisex', 'inch', 'cm', 'mm',
])

// Amazon titles in particular append marketing copy after a separator:
// "Apple iPhone 15 (128 GB) - Black | Dynamic Island | 48MP camera …".
// Everything after the first long-copy separator is noise for matching.
function coreTitle(text: string): string {
  return text.split(/\s*[|｜]\s*|\s[-–—]\s(?=[A-Za-z].{40,})/)[0]
}

export function tokenize(text: string): string[] {
  const tokens = coreTitle(text)
    .toLowerCase()
    // keep "128gb" and "128 gb" comparable
    .replace(/(\d)\s+(gb|tb|mb|ml|l|kg|g|w|mah|hz|inch|in)\b/g, '$1$2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  return [...new Set(tokens)]
}

// Listings for accessories share almost every token with the product they
// fit ("Spigen case for Apple iPhone 15"), so they need an explicit guard.
const ACCESSORY_WORDS = new Set([
  'case', 'cover', 'covers', 'cases', 'protector', 'tempered', 'skin', 'skins',
  'charger', 'cable', 'adapter', 'stand', 'holder', 'mount', 'strap', 'pouch', 'sleeve', 'refill',
  'replacement', 'compatible', 'sticker',
])

// Model-tier words that make it a different product, not a different listing.
const TIER_WORDS = new Set(['pro', 'max', 'ultra', 'plus', 'mini', 'lite', 'fe', 'neo', 'prime', 'air'])

function hasDigit(t: string) {
  return /\d/.test(t)
}

const UNIT_RE = /^(\d+(?:\.\d+)?)(gb|tb|mb|ml|l|kg|g|w|mah|hz|inch|in)$/

function variantPenalty(ta: string[], tb: string[]): number {
  const numA = ta.filter(hasDigit)
  const numB = tb.filter(hasDigit)
  if (!numA.length || !numB.length) return 1

  let factor = 1
  // Same unit, different values (storage, volume, wattage…)
  const units = (tokens: string[]) => {
    const m = new Map<string, Set<string>>()
    for (const t of tokens) {
      const u = t.match(UNIT_RE)
      if (u) m.set(u[2], (m.get(u[2]) ?? new Set()).add(u[1]))
    }
    return m
  }
  const ua = units(numA)
  const ub = units(numB)
  for (const [unit, values] of ua) {
    const other = ub.get(unit)
    if (other && ![...values].some((v) => other.has(v))) factor *= 0.5
  }

  // Model-style tokens (s24, m35, 15, wh1000xm5) present only on one side each
  const models = (tokens: string[]) => tokens.filter((t) => !UNIT_RE.test(t))
  const ma = models(numA)
  const mb = models(numB)
  const onlyA = ma.filter((t) => !mb.includes(t))
  const onlyB = mb.filter((t) => !ma.includes(t))
  if (ma.length && mb.length) {
    if (ma.filter((t) => mb.includes(t)).length === 0) factor *= 0.5
    else if (onlyA.length && onlyB.length) factor *= 0.7
  }
  return factor
}

/**
 * Returns a 0–1 similarity score between two product names.
 *
 * Blend of Jaccard (penalises extra words) and the overlap coefficient
 * (tolerates one title being a long version of the other — which the old
 * pure-Jaccard score did not, so long Amazon titles never matched anything).
 * Conflicting model/variant tokens (e.g. "128gb" vs "256gb") are penalised.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.length === 0 || tb.length === 0) return 0

  const setB = new Set(tb)
  const intersection = ta.filter((t) => setB.has(t)).length
  const union = new Set([...ta, ...tb]).size
  const jaccard = intersection / union
  const overlap = intersection / Math.min(ta.length, tb.length)
  let score = 0.4 * jaccard + 0.6 * overlap

  // Variant guard: digit-bearing tokens that disagree are a strong
  // "different product" signal — "128gb" vs "256gb", "m35" vs "m15".
  score *= variantPenalty(ta, tb)

  // Tier guard: "S24" vs "S24 Ultra", "iPhone 15" vs "iPhone 15 Pro".
  const tierA = ta.filter((t) => TIER_WORDS.has(t))
  const tierB = tb.filter((t) => TIER_WORDS.has(t))
  if (tierA.join() !== tierB.join()) score *= 0.6

  // Accessory guard: one side is an accessory listing, the other isn't.
  const accA = ta.some((t) => ACCESSORY_WORDS.has(t))
  const accB = tb.some((t) => ACCESSORY_WORDS.has(t))
  if (accA !== accB) score *= 0.4

  return Math.round(Math.min(1, score) * 100) / 100
}

/**
 * Price sanity check for a candidate match: a "match" at a fraction (or a
 * multiple) of the reference price is almost always a different product —
 * an accessory, a bundle, or a different variant.
 */
export function plausiblePrice(candidate: number, reference: number | null): boolean {
  if (!reference || reference <= 0) return true
  const ratio = candidate / reference
  return ratio >= 0.4 && ratio <= 2.5
}

/** Below this, we treat it as "no confident match" rather than guessing. */
export const MATCH_CONFIDENCE_THRESHOLD = 0.5

/**
 * Compact search query from a (possibly very long) product title — Google
 * does badly with a 200-character Amazon title pasted verbatim.
 */
export function searchQueryFor(name: string, maxTokens = 9): string {
  const words = coreTitle(name)
    .replace(/[()[\]{},|/]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words.slice(0, maxTokens).join(' ')
}

/**
 * Best-effort product name from the URL itself, for when the page blocks
 * us. Amazon/Flipkart/Myntra/Croma/Nykaa URLs all carry a readable slug:
 *   amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY
 *   flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4
 */
export function nameHintFromUrl(rawUrl: string): string | null {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }
  const segments = u.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  const marker = segments.findIndex((s) => ['dp', 'p', 'gp', 'buy', 'product'].includes(s.toLowerCase()))
  const candidates = marker > 0 ? [segments[marker - 1], ...segments] : segments

  let best: string | null = null
  for (const seg of candidates) {
    if (!/[-_]/.test(seg)) continue
    const words = seg.split(/[-_+]+/).filter((w) => w && !/^(itm|pid|lid)[a-z0-9]+$/i.test(w))
    // A slug of mostly random IDs isn't a name
    const alpha = words.filter((w) => /[a-z]/i.test(w) && !/^[A-Z0-9]{10}$/.test(w))
    if (alpha.length < 2) continue
    const phrase = words.join(' ')
    if (!best || phrase.length > best.length) best = phrase
  }
  return best ? best.replace(/\s+/g, ' ').trim().slice(0, 140) : null
}

/** Amazon ASIN from a product URL, if present. */
export function asinFromUrl(rawUrl: string): string | null {
  const m = rawUrl.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i)
  return m ? m[1].toUpperCase() : null
}
