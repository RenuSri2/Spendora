// Product names differ across platforms ("Nike Air Max 90 White UK 9" vs
// "Nike Air Max 90 - White - Men's UK9"), so exact string matching would
// miss almost everything. This uses token-overlap (Jaccard-style) similarity
// instead — good enough to rank candidates, not good enough to claim
// certainty. Callers should treat the score as a confidence signal, not proof.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'for', 'with', 'and', 'or', 'in', 'of', 'by',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  )
}

/** Returns a 0–1 similarity score between two product names. */
export function nameSimilarity(a: string, b: string): number {
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  const union = new Set([...setA, ...setB]).size

  return union === 0 ? 0 : intersection / union
}

/** Below this, we treat it as "no confident match" rather than guessing. */
export const MATCH_CONFIDENCE_THRESHOLD = 0.35
