/**
 * Parses a human/markup price string into a number.
 *
 * Handles "₹1,299.00", "Rs. 1,299", "INR 2,49,999", "1299", 1299 and
 * "$12.50". The old implementation stripped every non-digit/non-dot
 * character, which turned "Rs. 1,299" into ".1299" → 0.1299.
 */
export function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null

  const text = String(raw).replace(/ /g, ' ')
  const match = text.match(/\d[\d,]*(?:\.\d+)?/)
  if (!match) return null

  const num = parseFloat(match[0].replace(/,/g, ''))
  return Number.isFinite(num) && num > 0 ? num : null
}

/** Best-effort currency detection from a price string. Defaults to INR. */
export function detectCurrency(raw: unknown, fallback = 'INR'): string {
  const text = String(raw ?? '')
  if (/₹|\bRs\.?|\bINR\b/i.test(text)) return 'INR'
  if (/\$|\bUSD\b/.test(text)) return 'USD'
  if (/€|\bEUR\b/.test(text)) return 'EUR'
  if (/£|\bGBP\b/.test(text)) return 'GBP'
  return fallback
}
