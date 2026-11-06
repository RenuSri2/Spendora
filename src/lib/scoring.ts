interface ComparisonInput {
  matched: boolean
  price: number | null
}

interface HistoryPoint {
  price: number
}

export interface ValueScore {
  score: number // 0-100
  label: string
  basis: string[] // plain-English reasons, shown to the user — no hidden math
}

export interface DataConfidence {
  level: 'high' | 'medium' | 'low'
  reasons: string[]
}

/**
 * A real, reproducible "is this a good price right now" score — built only
 * from prices we actually scraped (this listing + confidently-matched
 * comparisons) and real price history. Never touches reviews/ratings since
 * we have no real data source for those.
 */
export function computeValueScore(
  currentPrice: number | null,
  comparison: ComparisonInput[],
  history: HistoryPoint[]
): ValueScore {
  const basis: string[] = []
  const matchedPrices = comparison.filter((c) => c.matched && c.price !== null).map((c) => c.price as number)

  // The store page blocked us and no fallback price was found: we can't
  // score this listing honestly, only point at what we did confirm.
  if (currentPrice === null) {
    if (matchedPrices.length > 0) {
      const minPrice = Math.min(...matchedPrices)
      return {
        score: 50,
        label: 'Check other stores',
        basis: [
          "Couldn't read the live price on the original listing",
          `Lowest confirmed price elsewhere: ₹${minPrice.toLocaleString('en-IN')}`,
        ],
      }
    }
    return { score: 50, label: 'Price unavailable', basis: ["Couldn't read the live price on the original listing"] }
  }

  let score = 60 // neutral baseline when we don't have enough signal either way
  basis.push('Baseline: not enough data for a confident read yet')

  if (matchedPrices.length > 0) {
    const minPrice = Math.min(...matchedPrices)
    if (currentPrice <= minPrice) {
      score = 90
      basis.length = 0
      basis.push('This is the cheapest price found among confidently-matched platforms')
    } else {
      const premium = (currentPrice - minPrice) / minPrice
      score = Math.max(20, Math.round(90 - premium * 100))
      basis.length = 0
      basis.push(
        `${Math.round(premium * 100)}% more expensive than the cheapest matched price (₹${minPrice.toLocaleString('en-IN')})`
      )
    }
  }

  if (history.length > 1) {
    const prev = history[history.length - 2].price
    const curr = history[history.length - 1].price
    if (curr < prev) {
      score = Math.min(100, score + 10)
      basis.push(`Price has dropped since we last checked (was ₹${prev})`)
    } else if (curr > prev) {
      score = Math.max(0, score - 10)
      basis.push(`Price has risen since we last checked (was ₹${prev})`)
    }
  }

  const label = score >= 80 ? 'Good time to buy' : score >= 55 ? 'Fair price' : 'Consider waiting'

  return { score, label, basis }
}

/**
 * How much to trust the scraped data itself — based on which extraction
 * tier succeeded and whether comparison found real matches, not on
 * anything about the product or seller (we have no signal for that).
 */
export function computeDataConfidence(
  dataSource: string | null,
  comparisonMatchCount: number
): DataConfidence {
  const reasons: string[] = []

  let level: DataConfidence['level'] = 'medium'

  if (dataSource === 'json-ld') {
    reasons.push('Price pulled from structured product data — most reliable source')
    level = 'high'
  } else if (dataSource === 'search-listing') {
    reasons.push("Store page blocked us — price taken from the store's Google Shopping listing, verify before buying")
    level = 'low'
  } else if (dataSource === null) {
    reasons.push("Couldn't read the price from the original listing")
    level = 'low'
  } else if (dataSource === 'og-meta') {
    reasons.push('Price pulled from page metadata — generally reliable')
    level = 'medium'
  } else {
    reasons.push('Price pulled via fallback page-content parsing — verify against the original listing')
    level = 'low'
  }

  if (comparisonMatchCount > 0) {
    reasons.push(`Confidently matched on ${comparisonMatchCount} other platform${comparisonMatchCount > 1 ? 's' : ''}`)
    if (level === 'medium') level = 'high'
  } else {
    reasons.push('No confident cross-platform match found — comparison is limited')
    if (level === 'high') level = 'medium'
  }

  return { level, reasons }
}
